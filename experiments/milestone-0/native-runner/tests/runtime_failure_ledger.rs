use agentic_native_runner::runtime_failure_ledger::{
    FailureDisposition, FailureLedger, HistoricalFailure, failure_disposition,
    record_cleanup_outcome, record_historical_failure, record_reconciliation_safety,
};
use agentic_native_runner::runtime_reconciliation::RunSafety;

fn ledger() -> FailureLedger {
    FailureLedger::new("sha256:receipt-01")
}

#[test]
fn own_09_first_physical_failure_sticks_to_the_receipt() {
    let mut ledger = ledger();

    record_historical_failure(&mut ledger, HistoricalFailure::SurvivorObserved);

    assert_eq!(ledger.receipt_fingerprint, "sha256:receipt-01");
    assert_eq!(
        ledger.failures,
        [HistoricalFailure::SurvivorObserved].into()
    );
    assert_eq!(
        failure_disposition(&ledger),
        FailureDisposition::HistoricalFailurePreserved
    );
}

#[test]
fn own_09_multiple_failures_accumulate_and_deduplicate_without_removal() {
    let mut ledger = ledger();

    record_historical_failure(&mut ledger, HistoricalFailure::SurvivorObserved);
    record_historical_failure(&mut ledger, HistoricalFailure::LateWriteObserved);
    record_historical_failure(&mut ledger, HistoricalFailure::IncompleteDrain);
    record_historical_failure(&mut ledger, HistoricalFailure::TeardownFailure);
    record_historical_failure(&mut ledger, HistoricalFailure::SurvivorObserved);

    assert_eq!(ledger.failures.len(), 4);
    assert!(
        ledger
            .failures
            .contains(&HistoricalFailure::SurvivorObserved)
    );
    assert!(
        ledger
            .failures
            .contains(&HistoricalFailure::LateWriteObserved)
    );
    assert!(
        ledger
            .failures
            .contains(&HistoricalFailure::IncompleteDrain)
    );
    assert!(
        ledger
            .failures
            .contains(&HistoricalFailure::TeardownFailure)
    );
}

#[test]
fn own_09_cleanup_success_is_separate_fact_and_cannot_erase_failure() {
    let mut ledger = ledger();
    record_historical_failure(&mut ledger, HistoricalFailure::SurvivorObserved);

    record_cleanup_outcome(&mut ledger, true);

    assert_eq!(ledger.cleanup_succeeded, Some(true));
    assert!(
        ledger
            .failures
            .contains(&HistoricalFailure::SurvivorObserved)
    );
    assert_eq!(
        failure_disposition(&ledger),
        FailureDisposition::HistoricalFailurePreserved
    );
}

#[test]
fn own_09_later_safe_reconciliation_cannot_turn_historical_failure_into_pass() {
    let mut ledger = ledger();
    record_historical_failure(&mut ledger, HistoricalFailure::LateWriteObserved);

    record_reconciliation_safety(&mut ledger, RunSafety::Safe);

    assert_eq!(ledger.latest_safety, Some(RunSafety::Safe));
    assert_eq!(ledger.receipt_fingerprint, "sha256:receipt-01");
    assert!(
        ledger
            .failures
            .contains(&HistoricalFailure::LateWriteObserved)
    );
    assert_eq!(
        failure_disposition(&ledger),
        FailureDisposition::HistoricalFailurePreserved
    );
}

#[test]
fn failure_free_ledger_is_pass_eligible_but_not_a_terminal_transition() {
    let mut ledger = ledger();
    record_cleanup_outcome(&mut ledger, true);
    record_reconciliation_safety(&mut ledger, RunSafety::Safe);

    assert!(ledger.failures.is_empty());
    assert_eq!(
        failure_disposition(&ledger),
        FailureDisposition::PassEligible
    );
}
