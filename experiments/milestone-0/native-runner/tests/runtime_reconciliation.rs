use agentic_native_runner::runtime_reconciliation::{
    CancelApply, CancelState, ResourceTruth, RunSafety, RunSafetyFacts, apply_cancel_request,
    evaluate_run_safety,
};

fn safety_facts(root: ResourceTruth, descendants: Vec<ResourceTruth>) -> RunSafetyFacts {
    RunSafetyFacts {
        root,
        descendants,
        boundary_empty: Some(true),
        stdout_drained: true,
        stderr_drained: true,
    }
}

#[test]
fn own_03_root_exit_with_active_descendant_is_not_safe() {
    let facts = safety_facts(ResourceTruth::Gone, vec![ResourceTruth::Active]);

    assert_eq!(
        evaluate_run_safety(&facts),
        RunSafety::ReconciliationRequired
    );
}

#[test]
fn own_03_root_exit_with_unknown_descendant_is_not_safe() {
    let facts = safety_facts(ResourceTruth::Gone, vec![ResourceTruth::Unknown]);

    assert_eq!(
        evaluate_run_safety(&facts),
        RunSafety::ReconciliationRequired
    );
}

#[test]
fn own_03_all_known_processes_gone_still_requires_empty_boundary_and_drained_streams() {
    let safe = safety_facts(
        ResourceTruth::Gone,
        vec![ResourceTruth::Gone, ResourceTruth::Gone],
    );
    assert_eq!(evaluate_run_safety(&safe), RunSafety::Safe);

    let boundary_unknown = RunSafetyFacts {
        boundary_empty: None,
        ..safe.clone()
    };
    assert_eq!(
        evaluate_run_safety(&boundary_unknown),
        RunSafety::ReconciliationRequired
    );

    let undrained = RunSafetyFacts {
        stdout_drained: false,
        ..safe
    };
    assert_eq!(
        evaluate_run_safety(&undrained),
        RunSafety::ReconciliationRequired
    );
}

#[test]
fn own_04_duplicate_cancel_keeps_one_receipt_one_boundary_and_no_terminal_transition() {
    let initial = CancelState {
        receipt_fingerprint: "sha256:receipt-01".to_owned(),
        boundary_id: "boundary-01".to_owned(),
        teardown_requested: false,
        terminal_transition_committed: false,
    };

    let (after_first, first) = apply_cancel_request(initial.clone());
    assert_eq!(first, CancelApply::FirstAccepted);
    assert!(after_first.teardown_requested);
    assert!(!after_first.terminal_transition_committed);
    assert_eq!(after_first.receipt_fingerprint, initial.receipt_fingerprint);
    assert_eq!(after_first.boundary_id, initial.boundary_id);

    let (after_second, second) = apply_cancel_request(after_first.clone());
    assert_eq!(second, CancelApply::DuplicateIdempotent);
    assert_eq!(after_second, after_first);
    assert!(!after_second.terminal_transition_committed);
}

#[test]
fn own_04_duplicate_cancel_cannot_manufacture_safety_for_unresolved_resources() {
    let unresolved = RunSafetyFacts {
        root: ResourceTruth::Gone,
        descendants: vec![ResourceTruth::Unknown],
        boundary_empty: None,
        stdout_drained: true,
        stderr_drained: true,
    };
    assert_eq!(
        evaluate_run_safety(&unresolved),
        RunSafety::ReconciliationRequired
    );

    let state = CancelState {
        receipt_fingerprint: "sha256:receipt-02".to_owned(),
        boundary_id: "boundary-02".to_owned(),
        teardown_requested: true,
        terminal_transition_committed: false,
    };
    let (after_duplicate, disposition) = apply_cancel_request(state.clone());

    assert_eq!(disposition, CancelApply::DuplicateIdempotent);
    assert_eq!(after_duplicate, state);
    assert_eq!(
        evaluate_run_safety(&unresolved),
        RunSafety::ReconciliationRequired
    );
}
