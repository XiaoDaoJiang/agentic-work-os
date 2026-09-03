use std::env;
use std::path::PathBuf;
use std::process::Stdio;
use std::time::Duration;

use agentic_native_runner::runtime_reconciliation::{
    CancelApply, CancelState, apply_cancel_request,
};
use processkit::ProcessGroup;
use tokio::process::Command;
use tokio::time;

fn resolve_node() -> PathBuf {
    let path = env::var_os("PATH").expect("PATH must exist for duplicate-cancel test");
    for directory in env::split_paths(&path) {
        let names: &[&str] = if cfg!(windows) {
            &["node.exe", "node.cmd", "node.bat"]
        } else {
            &["node"]
        };
        for name in names {
            let candidate = directory.join(name);
            if candidate.is_file() {
                return candidate
                    .canonicalize()
                    .expect("Node executable path must canonicalize");
            }
        }
    }
    panic!("Node executable was not found on PATH");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn own_04_duplicate_cancel_causes_exactly_one_real_process_group_teardown() {
    let group = ProcessGroup::new().expect("create ProcessKit process boundary");
    let mut command = Command::new(resolve_node());
    command
        .args(["-e", "setInterval(() => {}, 1000)"])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    let mut child = group
        .spawn(command)
        .expect("spawn long-running child inside ProcessKit boundary");

    time::sleep(Duration::from_millis(100)).await;

    let initial = CancelState {
        receipt_fingerprint: "sha256:own-04-receipt".to_owned(),
        boundary_id: format!("processkit:{}", group.mechanism().name()),
        teardown_requested: false,
        terminal_transition_committed: false,
    };

    let mut teardown_calls = 0_u32;
    let (after_first, first) = apply_cancel_request(initial);
    if first == CancelApply::FirstAccepted {
        teardown_calls += 1;
        group.kill_all().expect("first Cancel must tear down boundary");
    }

    let (after_second, second) = apply_cancel_request(after_first.clone());
    if second == CancelApply::FirstAccepted {
        teardown_calls += 1;
        group
            .kill_all()
            .expect("a second effective teardown would violate idempotency");
    }

    assert_eq!(first, CancelApply::FirstAccepted);
    assert_eq!(second, CancelApply::DuplicateIdempotent);
    assert_eq!(teardown_calls, 1, "duplicate Cancel must not call kill_all twice");
    assert_eq!(after_second.receipt_fingerprint, after_first.receipt_fingerprint);
    assert_eq!(after_second.boundary_id, after_first.boundary_id);
    assert!(after_second.teardown_requested);
    assert!(!after_second.terminal_transition_committed);

    let status = time::timeout(Duration::from_secs(3), child.wait())
        .await
        .expect("child must become waitable after the single boundary teardown")
        .expect("waiting for child after teardown must succeed");
    assert!(
        !status.success(),
        "the long-running child must not complete normally after Cancel"
    );
}
