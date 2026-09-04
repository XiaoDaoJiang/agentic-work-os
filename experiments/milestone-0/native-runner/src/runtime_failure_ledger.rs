use std::collections::BTreeSet;

use serde::{Deserialize, Serialize};

use crate::runtime_reconciliation::RunSafety;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum HistoricalFailure {
    SurvivorObserved,
    LateWriteObserved,
    IncompleteDrain,
    TeardownFailure,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FailureLedger {
    pub receipt_fingerprint: String,
    pub failures: BTreeSet<HistoricalFailure>,
    pub cleanup_succeeded: Option<bool>,
    pub latest_safety: Option<RunSafety>,
}

impl FailureLedger {
    pub fn new(receipt_fingerprint: impl Into<String>) -> Self {
        Self {
            receipt_fingerprint: receipt_fingerprint.into(),
            failures: BTreeSet::new(),
            cleanup_succeeded: None,
            latest_safety: None,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum FailureDisposition {
    HistoricalFailurePreserved,
    PassEligible,
}

pub fn record_historical_failure(ledger: &mut FailureLedger, failure: HistoricalFailure) {
    ledger.failures.insert(failure);
}

pub fn record_cleanup_outcome(ledger: &mut FailureLedger, succeeded: bool) {
    ledger.cleanup_succeeded = Some(succeeded);
}

pub fn record_reconciliation_safety(ledger: &mut FailureLedger, safety: RunSafety) {
    ledger.latest_safety = Some(safety);
}

pub fn failure_disposition(ledger: &FailureLedger) -> FailureDisposition {
    if ledger.failures.is_empty() {
        FailureDisposition::PassEligible
    } else {
        FailureDisposition::HistoricalFailurePreserved
    }
}
