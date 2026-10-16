use std::io::{BufRead, Write};
use std::path::Path;
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{OnceLock, mpsc};
use std::time::Duration;

use agentic_native_runner::protocol::parse_stage_b_batch;
use agentic_native_runner::runtime_receipt::{
    ContainmentReceipt, RuntimeReceiptV0, WorkspaceReceipt,
};
use agentic_native_runner::runtime_receipt_publication::{
    ReceiptPublicationState, publish_runtime_receipt,
};
use agentic_native_runner::runtime_receipt_store::persist_published_runtime_receipt;
use agentic_native_runner::runtime_reconciliation::{CancelState, apply_cancel_request};
use processkit::{ProcessGroup, process_info};
use serde::Deserialize;
use serde_json::{Value, json};
use tokio::io::{AsyncRead, AsyncReadExt};
use tokio::time;

static OWNER_OUTPUT_LOST: AtomicBool = AtomicBool::new(false);
static EVENTS: OnceLock<mpsc::SyncSender<Option<Value>>> = OnceLock::new();

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Request {
    start: Value,
    runtime_id: String,
    spawn_nonce: String,
    repository_identity: String,
    base_revision: String,
    helper_revision: String,
    receipt_path: String,
}

fn emit(value: Value) {
    if EVENTS
        .get()
        .is_none_or(|sender| sender.try_send(Some(value)).is_err())
    {
        OWNER_OUTPUT_LOST.store(true, Ordering::Relaxed);
    }
}

fn start_writer() -> mpsc::Receiver<()> {
    let (sender, receiver) = mpsc::sync_channel::<Option<Value>>(64);
    let (finished, completion) = mpsc::sync_channel(1);
    let _ = EVENTS.set(sender);
    std::thread::spawn(move || {
        #[cfg(windows)]
        let mut output = {
            use std::os::windows::io::{AsRawHandle, FromRawHandle};
            // A private raw writer keeps blocked pipe I/O away from Tokio and stdout's global lock.
            std::mem::ManuallyDrop::new(unsafe {
                std::fs::File::from_raw_handle(std::io::stdout().as_raw_handle())
            })
        };
        #[cfg(not(windows))]
        let mut output = std::io::stdout();
        while let Ok(Some(value)) = receiver.recv() {
            if writeln!(output, "{value}")
                .and_then(|_| output.flush())
                .is_err()
            {
                OWNER_OUTPUT_LOST.store(true, Ordering::Relaxed);
                return;
            }
        }
        let _ = finished.send(());
    });
    completion
}

async fn stream<R: AsyncRead + Unpin>(mut reader: R, name: &'static str) -> bool {
    let mut bytes = [0; 8192];
    loop {
        match reader.read(&mut bytes).await {
            Ok(0) => return true,
            Ok(count) => emit(json!({"kind":"output", "stream":name, "bytes": &bytes[..count]})),
            Err(_) => return false,
        }
    }
}

async fn execute(group: &ProcessGroup, request: Request) -> Result<(), String> {
    if !cfg!(windows) {
        return Err("diagnostic profile requires Windows".into());
    }
    for value in [
        &request.runtime_id,
        &request.spawn_nonce,
        &request.repository_identity,
        &request.base_revision,
        &request.helper_revision,
    ] {
        if value.trim().is_empty() {
            return Err("receipt metadata is required".into());
        }
    }
    let run_id = request.start["run_id"]
        .as_str()
        .ok_or("run_id is required")?;
    let finish = json!({"kind":"finish_input", "protocol":"local-runner-jsonl-v0", "run_id":run_id, "request_id":"diagnostic-finish"});
    let batch =
        parse_stage_b_batch(&format!("{}\n{finish}", request.start)).map_err(|e| e.to_string())?;
    let start = batch.start;
    if !Path::new(&start.cwd).is_absolute()
        || !Path::new(&start.program).is_absolute()
        || !Path::new(&request.receipt_path).is_absolute()
    {
        return Err("program, cwd and receipt_path must be absolute".into());
    }
    let mut command = tokio::process::Command::new(&start.program);
    command
        .args(&start.argv)
        .current_dir(&start.cwd)
        .env_clear();
    for name in &start.env.inherit_names {
        if let Some(value) = std::env::var_os(name) {
            command.env(name, value);
        }
    }
    for (name, value) in &start.env.overrides {
        command.env(name, value);
    }
    for name in &start.env.unset {
        command.env_remove(name);
    }
    command
        .env("AGENTIC_RUNTIME_ID", &request.runtime_id)
        .env("AGENTIC_RUN_ID", &start.run_id)
        .env("AGENTIC_SPAWN_NONCE", &request.spawn_nonce);
    command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let mut child = group.spawn(command).map_err(|e| e.to_string())?;
    let pid = child.id().ok_or("spawned process has no pid")?;
    let identity = process_info(pid)
        .map_err(|e| e.to_string())?
        .and_then(|info| info.start_time())
        .ok_or("process identity unavailable")?;
    let receipt = RuntimeReceiptV0 {
        schema: "runtime-receipt-v0".into(),
        runtime_instance_id: request.runtime_id,
        run_id: start.run_id.clone(),
        spawn_nonce: request.spawn_nonce,
        root_pid: pid,
        process_identity: identity.to_string(),
        containment: ContainmentReceipt {
            mechanism: group.mechanism().name().into(),
            boundary_id: format!("diagnostic:{}", start.run_id),
        },
        workspace: WorkspaceReceipt {
            workspace_id: start.run_id.clone(),
            repository_identity: request.repository_identity,
            canonical_path: start.cwd,
        },
        started_at: format!("{:?}", std::time::SystemTime::now()),
        helper_revision: request.helper_revision,
    };
    let (published, _) = publish_runtime_receipt(ReceiptPublicationState::default(), &receipt)
        .map_err(|e| format!("receipt publication {e:?}"))?;
    let published = published.published.ok_or("receipt publication missing")?;
    persist_published_runtime_receipt(Path::new(&request.receipt_path), &published)
        .map_err(|e| e.to_string())?;
    let stdout = child.stdout.take().ok_or("stdout unavailable")?;
    let stderr = child.stderr.take().ok_or("stderr unavailable")?;
    let stdout_task = tokio::spawn(stream(stdout, "stdout"));
    let stderr_task = tokio::spawn(stream(stderr, "stderr"));
    emit(json!({"kind":"started", "receipt":receipt, "base_revision":request.base_revision}));
    let (sender, mut commands) = tokio::sync::mpsc::unbounded_channel();
    std::thread::spawn(move || {
        for line in std::io::stdin().lock().lines() {
            let command = match line {
                Ok(line) if line == "cancel" => "cancel",
                _ => "owner_loss",
            };
            if sender.send(command).is_err() {
                return;
            }
        }
        let _ = sender.send("owner_loss");
    });
    let mut cancel = CancelState {
        receipt_fingerprint: published.sha256,
        boundary_id: receipt.containment.boundary_id,
        teardown_requested: false,
        terminal_transition_committed: false,
    };
    let deadline = time::sleep(Duration::from_millis(start.timeout_ms));
    tokio::pin!(deadline);
    let (trigger, status) = tokio::select! {
        status = child.wait() => ("natural", status.map_err(|e| e.to_string())?),
        trigger = commands.recv() => {
            let (next, _) = apply_cancel_request(cancel); cancel = next;
            group.kill_all().map_err(|e| e.to_string())?;
            (trigger.unwrap_or("owner_loss"), time::timeout(Duration::from_secs(5), child.wait()).await.map_err(|_| "root wait timeout")?.map_err(|e| e.to_string())?)
        },
        _ = &mut deadline => {
            let (next, _) = apply_cancel_request(cancel); cancel = next;
            group.kill_all().map_err(|e| e.to_string())?;
            ("timeout", time::timeout(Duration::from_secs(5), child.wait()).await.map_err(|_| "root wait timeout")?.map_err(|e| e.to_string())?)
        },
        _ = async {
            while !OWNER_OUTPUT_LOST.load(Ordering::Relaxed) { time::sleep(Duration::from_millis(50)).await; }
        } => {
            let (next, _) = apply_cancel_request(cancel); cancel = next;
            group.kill_all().map_err(|e| e.to_string())?;
            ("owner_loss", time::timeout(Duration::from_secs(5), child.wait()).await.map_err(|_| "root wait timeout")?.map_err(|e| e.to_string())?)
        },
    };
    let stdout_drained = time::timeout(Duration::from_secs(2), stdout_task)
        .await
        .is_ok_and(|r| r.is_ok_and(|v| v));
    let stderr_drained = time::timeout(Duration::from_secs(2), stderr_task)
        .await
        .is_ok_and(|r| r.is_ok_and(|v| v));
    #[cfg(windows)]
    let root_gone = {
        use agentic_native_runner::windows_process_truth::{
            WindowsTruthVerdict, classify_windows_process_truth, observe_windows_process_truth,
        };
        matches!(
            classify_windows_process_truth(&observe_windows_process_truth(
                pid,
                Some(identity),
                None,
                None
            )),
            WindowsTruthVerdict::TerminatedOriginal | WindowsTruthVerdict::Gone
        )
    };
    #[cfg(not(windows))]
    let root_gone = false;
    let mut boundary_empty = false;
    let mut survivor_observed = false;
    for _ in 0..15 {
        boundary_empty = match group.members() {
            Ok(members) => {
                survivor_observed |= !members.is_empty();
                members.is_empty()
            }
            Err(_) => false,
        };
        if !boundary_empty {
            break;
        }
        time::sleep(Duration::from_millis(50)).await;
    }
    use agentic_native_runner::runtime_reconciliation::{
        ResourceTruth, RunSafety, RunSafetyFacts, evaluate_run_safety,
    };
    let safe = evaluate_run_safety(&RunSafetyFacts {
        root: if root_gone {
            ResourceTruth::Gone
        } else {
            ResourceTruth::Unknown
        },
        descendants: vec![],
        boundary_empty: Some(boundary_empty),
        stdout_drained,
        stderr_drained,
    }) == RunSafety::Safe
        && !OWNER_OUTPUT_LOST.load(Ordering::Relaxed);
    use agentic_native_runner::runtime_failure_ledger::{
        FailureLedger, HistoricalFailure, record_historical_failure,
    };
    let mut ledger = FailureLedger::new(&cancel.receipt_fingerprint);
    if !stdout_drained || !stderr_drained {
        record_historical_failure(&mut ledger, HistoricalFailure::IncompleteDrain);
    }
    if survivor_observed {
        record_historical_failure(&mut ledger, HistoricalFailure::SurvivorObserved);
    }
    emit(
        json!({"kind":"terminal", "trigger":trigger, "exit_code":status.code(), "resource_state":if safe {"safe"} else {"unknown"}, "resource_lock":if safe {"releasable"} else {"held"}, "stdout_drained":stdout_drained, "stderr_drained":stderr_drained, "teardown_requested":cancel.teardown_requested, "failure_ledger":ledger}),
    );
    if !safe {
        return Err("resource truth unresolved; fixture must remain blocked".into());
    }
    Ok(())
}

#[tokio::main]
async fn main() {
    let writer = start_writer();
    let result = async {
        let file = std::env::args()
            .nth(1)
            .ok_or("request JSON path required")?;
        if std::fs::metadata(&file).map_err(|e| e.to_string())?.len() > 65536 {
            return Err("diagnostic request exceeds 64 KiB".into());
        }
        let request: Request =
            serde_json::from_slice(&std::fs::read(file).map_err(|e| e.to_string())?)
                .map_err(|e| e.to_string())?;
        let group = ProcessGroup::new().map_err(|e| e.to_string())?;
        let result = execute(&group, request).await;
        if result.is_err() {
            let cleanup_succeeded = group.kill_all().is_ok();
            emit(json!({"kind":"cleanup", "kill_all_succeeded":cleanup_succeeded, "resource_state":"unknown", "resource_lock":"held"}));
        }
        result
    }
    .await;
    let failed = result.is_err();
    if let Err(error) = result {
        emit(
            json!({"kind":"error", "error":error, "resource_state":"unknown", "resource_lock":"held"}),
        );
    }
    let flushed = EVENTS
        .get()
        .is_some_and(|sender| sender.try_send(None).is_ok())
        && writer.recv_timeout(Duration::from_secs(1)).is_ok();
    std::process::exit(
        if failed || !flushed || OWNER_OUTPUT_LOST.load(Ordering::Relaxed) {
            1
        } else {
            0
        },
    );
}
