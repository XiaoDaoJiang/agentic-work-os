use agentic_native_runner::runtime_reconciliation::{
    ResourceLock, StartupDisposition, StartupProcessTruth, StartupReconciliationFacts,
    reconcile_startup,
};

fn facts(process_truth: StartupProcessTruth) -> StartupReconciliationFacts {
    StartupReconciliationFacts {
        receipt_fingerprint: "sha256:receipt-01".to_owned(),
        process_truth,
        boundary_empty: Some(true),
        stdout_drained: true,
        stderr_drained: true,
    }
}

#[test]
fn own_05_active_original_after_helper_restart_requires_reconciliation_and_blocks_scheduling() {
    let decision = reconcile_startup(&facts(StartupProcessTruth::ActiveOriginal));

    assert_eq!(
        decision.disposition,
        StartupDisposition::ReconciliationRequired
    );
    assert_eq!(decision.resource_lock, ResourceLock::Held);
    assert_eq!(decision.receipt_fingerprint, "sha256:receipt-01");
    assert!(!decision.auto_adopt);
    assert!(!decision.kill_observed_pid);
}

#[test]
fn own_05_unknown_process_or_boundary_truth_fails_closed_with_lock_held() {
    let process_unknown = reconcile_startup(&facts(StartupProcessTruth::Unknown));
    assert_eq!(
        process_unknown.disposition,
        StartupDisposition::ReconciliationRequired
    );
    assert_eq!(process_unknown.resource_lock, ResourceLock::Held);
    assert!(!process_unknown.auto_adopt);

    let boundary_unknown = StartupReconciliationFacts {
        boundary_empty: None,
        ..facts(StartupProcessTruth::GoneOriginal)
    };
    let decision = reconcile_startup(&boundary_unknown);
    assert_eq!(
        decision.disposition,
        StartupDisposition::ReconciliationRequired
    );
    assert_eq!(decision.resource_lock, ResourceLock::Held);
}

#[test]
fn own_06_original_process_gone_with_empty_boundary_and_drained_streams_reconciles_interrupted() {
    let decision = reconcile_startup(&facts(StartupProcessTruth::GoneOriginal));

    assert_eq!(
        decision.disposition,
        StartupDisposition::InterruptedReconciled
    );
    assert_eq!(decision.resource_lock, ResourceLock::Releasable);
    assert_eq!(decision.receipt_fingerprint, "sha256:receipt-01");
    assert!(!decision.auto_adopt);
    assert!(!decision.kill_observed_pid);
}

#[test]
fn own_06_gone_original_does_not_reconcile_until_boundary_and_streams_are_safe() {
    let boundary_not_empty = StartupReconciliationFacts {
        boundary_empty: Some(false),
        ..facts(StartupProcessTruth::GoneOriginal)
    };
    assert_eq!(
        reconcile_startup(&boundary_not_empty).disposition,
        StartupDisposition::ReconciliationRequired
    );

    let undrained = StartupReconciliationFacts {
        stderr_drained: false,
        ..facts(StartupProcessTruth::GoneOriginal)
    };
    assert_eq!(
        reconcile_startup(&undrained).disposition,
        StartupDisposition::ReconciliationRequired
    );
}

#[test]
fn own_06_reused_pid_is_never_adopted_or_killed_as_the_old_run() {
    let decision = reconcile_startup(&facts(StartupProcessTruth::ReusedPid));

    assert_eq!(decision.disposition, StartupDisposition::ReusedPidDetected);
    assert_eq!(decision.resource_lock, ResourceLock::Held);
    assert!(!decision.auto_adopt);
    assert!(!decision.kill_observed_pid);
}
