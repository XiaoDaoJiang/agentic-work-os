use agentic_native_runner::hostile_evidence::{
    HostileEvidence, HostileVerdict, evaluate_physical_verdict, record_cleanup_outcome,
};

fn base_evidence() -> HostileEvidence {
    HostileEvidence {
        scenario_id: "tree-hang".to_owned(),
        seed: 7,
        repetition: 0,
        platform: "test".to_owned(),
        architecture: "test".to_owned(),
        processkit_version: "3.3.4".to_owned(),
        actual_mechanism: "test_mechanism".to_owned(),
        trigger: "cancel".to_owned(),
        root_pid: Some(1234),
        members_before: vec![1234, 1235],
        members_after: Vec::new(),
        fixture_pids: vec![1234, 1235],
        survivor_pids: Vec::new(),
        stdout_bytes: 12,
        stderr_bytes: 8,
        stdout_drained: true,
        stderr_drained: true,
        teardown_error: None,
        observer_complete: true,
        observed_late_write: false,
        cleanup_succeeded: None,
        verdict_reasons: Vec::new(),
    }
}

#[test]
fn complete_zero_survivor_stable_evidence_passes() {
    let evidence = base_evidence();
    assert_eq!(evaluate_physical_verdict(&evidence), HostileVerdict::Pass);
}

#[test]
fn any_survivor_is_a_hard_failure() {
    let mut evidence = base_evidence();
    evidence.survivor_pids = vec![1235];
    assert_eq!(evaluate_physical_verdict(&evidence), HostileVerdict::Fail);
}

#[test]
fn successful_cleanup_cannot_erase_a_survivor_failure() {
    let mut evidence = base_evidence();
    evidence.survivor_pids = vec![1235];
    assert_eq!(evaluate_physical_verdict(&evidence), HostileVerdict::Fail);

    record_cleanup_outcome(&mut evidence, true);

    assert_eq!(evidence.cleanup_succeeded, Some(true));
    assert_eq!(evidence.survivor_pids, vec![1235]);
    assert_eq!(evaluate_physical_verdict(&evidence), HostileVerdict::Fail);
}

#[test]
fn any_write_after_terminal_drain_is_a_hard_failure() {
    let mut evidence = base_evidence();
    evidence.observed_late_write = true;
    assert_eq!(evaluate_physical_verdict(&evidence), HostileVerdict::Fail);
}

#[test]
fn incomplete_drain_is_a_hard_failure() {
    let mut evidence = base_evidence();
    evidence.stderr_drained = false;
    assert_eq!(evaluate_physical_verdict(&evidence), HostileVerdict::Fail);
}

#[test]
fn missing_observer_completion_is_inconclusive_when_no_failure_fact_exists() {
    let mut evidence = base_evidence();
    evidence.observer_complete = false;
    assert_eq!(
        evaluate_physical_verdict(&evidence),
        HostileVerdict::Inconclusive
    );
}

#[test]
fn teardown_error_is_a_hard_failure() {
    let mut evidence = base_evidence();
    evidence.teardown_error = Some("kill_all failed".to_owned());
    assert_eq!(evaluate_physical_verdict(&evidence), HostileVerdict::Fail);
}
