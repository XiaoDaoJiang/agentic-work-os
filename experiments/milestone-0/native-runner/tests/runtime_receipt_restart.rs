use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use agentic_native_runner::runtime_receipt::{
    ContainmentReceipt, RuntimeReceiptV0, WorkspaceReceipt,
};
use agentic_native_runner::runtime_receipt_publication::{
    ReceiptPublicationState, publish_runtime_receipt,
};
use agentic_native_runner::runtime_receipt_store::{
    PersistedReceiptErrorKind, load_persisted_runtime_receipt, persist_published_runtime_receipt,
};
use agentic_native_runner::runtime_reconciliation::{
    ResourceLock, StartupDisposition, StartupProcessTruth, StartupReconciliationFacts,
    reconcile_startup,
};

fn disposable_root() -> PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock after epoch")
        .as_nanos();
    std::env::temp_dir().join(format!(
        "agentic-runtime-receipt-restart-{}-{nonce}",
        std::process::id()
    ))
}

fn sample_receipt(root: &Path, run_id: &str, nonce: &str) -> RuntimeReceiptV0 {
    RuntimeReceiptV0 {
        schema: "runtime-receipt-v0".to_owned(),
        runtime_instance_id: "runtime-restart-01".to_owned(),
        run_id: run_id.to_owned(),
        spawn_nonce: nonce.to_owned(),
        root_pid: 4242,
        process_identity: "start-token-4242".to_owned(),
        containment: ContainmentReceipt {
            mechanism: "restart-test-boundary".to_owned(),
            boundary_id: "boundary-restart-01".to_owned(),
        },
        workspace: WorkspaceReceipt {
            workspace_id: "workspace-restart-01".to_owned(),
            repository_identity: "repo-marker-v1:restart-01".to_owned(),
            canonical_path: root.to_string_lossy().into_owned(),
        },
        started_at: "2026-09-03T00:00:00Z".to_owned(),
        helper_revision: "restart-test".to_owned(),
    }
}

#[test]
fn own_05_persisted_nonterminal_receipt_survives_memory_loss_and_blocks_new_run() {
    let root = disposable_root();
    fs::create_dir_all(&root).expect("create disposable root");
    let path = root.join("runtime-receipt.json");
    let receipt = sample_receipt(&root, "run-own-05", "nonce-own-05");
    let (publication, _) = publish_runtime_receipt(ReceiptPublicationState::default(), &receipt)
        .expect("publish receipt");
    let published = publication.published.expect("published receipt");

    persist_published_runtime_receipt(&path, &published)
        .expect("persist receipt before helper loss");

    let reloaded =
        load_persisted_runtime_receipt(&path).expect("restart must load persisted receipt");
    assert_eq!(reloaded.published, published);
    assert_eq!(reloaded.receipt, receipt);

    let decision = reconcile_startup(&StartupReconciliationFacts {
        receipt_fingerprint: reloaded.published.sha256.clone(),
        process_truth: StartupProcessTruth::ActiveOriginal,
        boundary_empty: Some(false),
        stdout_drained: false,
        stderr_drained: false,
    });
    assert_eq!(
        decision.disposition,
        StartupDisposition::ReconciliationRequired
    );
    assert_eq!(decision.resource_lock, ResourceLock::Held);
    assert!(!decision.auto_adopt);
    assert!(!decision.kill_observed_pid);

    fs::remove_dir_all(&root).expect("remove disposable root");
}

#[test]
fn own_06_persisted_stale_receipt_only_releases_after_gone_empty_and_drained_truth() {
    let root = disposable_root();
    fs::create_dir_all(&root).expect("create disposable root");
    let path = root.join("runtime-receipt.json");
    let receipt = sample_receipt(&root, "run-own-06", "nonce-own-06");
    let (publication, _) = publish_runtime_receipt(ReceiptPublicationState::default(), &receipt)
        .expect("publish receipt");
    let published = publication.published.expect("published receipt");
    persist_published_runtime_receipt(&path, &published).expect("persist receipt before restart");

    let reloaded = load_persisted_runtime_receipt(&path).expect("load stale receipt after restart");
    let still_unsafe = reconcile_startup(&StartupReconciliationFacts {
        receipt_fingerprint: reloaded.published.sha256.clone(),
        process_truth: StartupProcessTruth::GoneOriginal,
        boundary_empty: Some(false),
        stdout_drained: true,
        stderr_drained: true,
    });
    assert_eq!(
        still_unsafe.disposition,
        StartupDisposition::ReconciliationRequired
    );
    assert_eq!(still_unsafe.resource_lock, ResourceLock::Held);
    assert!(!still_unsafe.auto_adopt);
    assert!(!still_unsafe.kill_observed_pid);

    let reconciled = reconcile_startup(&StartupReconciliationFacts {
        receipt_fingerprint: reloaded.published.sha256.clone(),
        process_truth: StartupProcessTruth::GoneOriginal,
        boundary_empty: Some(true),
        stdout_drained: true,
        stderr_drained: true,
    });
    assert_eq!(
        reconciled.disposition,
        StartupDisposition::InterruptedReconciled
    );
    assert_eq!(reconciled.resource_lock, ResourceLock::Releasable);
    assert!(!reconciled.auto_adopt);
    assert!(!reconciled.kill_observed_pid);

    fs::remove_dir_all(&root).expect("remove disposable root");
}

#[test]
fn restart_load_fails_closed_when_persisted_receipt_bytes_are_tampered() {
    let root = disposable_root();
    fs::create_dir_all(&root).expect("create disposable root");
    let path = root.join("runtime-receipt.json");
    let receipt = sample_receipt(&root, "run-tamper", "nonce-tamper");
    let (publication, _) = publish_runtime_receipt(ReceiptPublicationState::default(), &receipt)
        .expect("publish receipt");
    let published = publication.published.expect("published receipt");
    persist_published_runtime_receipt(&path, &published).expect("persist receipt");

    let mut envelope: serde_json::Value =
        serde_json::from_slice(&fs::read(&path).expect("read persisted envelope"))
            .expect("persisted envelope must be JSON");
    envelope["raw_bytes"][0] = serde_json::json!(0);
    fs::write(
        &path,
        serde_json::to_vec(&envelope).expect("serialize tampered envelope"),
    )
    .expect("write tampered envelope");

    let error = load_persisted_runtime_receipt(&path).expect_err("tamper must fail closed");
    assert_eq!(error.kind(), PersistedReceiptErrorKind::IntegrityMismatch);

    fs::remove_dir_all(&root).expect("remove disposable root");
}
