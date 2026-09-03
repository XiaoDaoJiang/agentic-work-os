use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ResourceTruth {
    Active,
    Gone,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RunSafetyFacts {
    pub root: ResourceTruth,
    pub descendants: Vec<ResourceTruth>,
    pub boundary_empty: Option<bool>,
    pub stdout_drained: bool,
    pub stderr_drained: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum RunSafety {
    Safe,
    ReconciliationRequired,
}

pub fn evaluate_run_safety(facts: &RunSafetyFacts) -> RunSafety {
    let all_processes_gone = facts.root == ResourceTruth::Gone
        && facts
            .descendants
            .iter()
            .all(|truth| *truth == ResourceTruth::Gone);

    if all_processes_gone
        && facts.boundary_empty == Some(true)
        && facts.stdout_drained
        && facts.stderr_drained
    {
        RunSafety::Safe
    } else {
        RunSafety::ReconciliationRequired
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CancelState {
    pub receipt_fingerprint: String,
    pub boundary_id: String,
    pub teardown_requested: bool,
    pub terminal_transition_committed: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CancelApply {
    FirstAccepted,
    DuplicateIdempotent,
}

pub fn apply_cancel_request(mut state: CancelState) -> (CancelState, CancelApply) {
    if state.teardown_requested {
        return (state, CancelApply::DuplicateIdempotent);
    }

    state.teardown_requested = true;
    (state, CancelApply::FirstAccepted)
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum StartupProcessTruth {
    ActiveOriginal,
    GoneOriginal,
    ReusedPid,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct StartupReconciliationFacts {
    pub receipt_fingerprint: String,
    pub process_truth: StartupProcessTruth,
    pub boundary_empty: Option<bool>,
    pub stdout_drained: bool,
    pub stderr_drained: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum StartupDisposition {
    ReconciliationRequired,
    InterruptedReconciled,
    ReusedPidDetected,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ResourceLock {
    Held,
    Releasable,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct StartupReconciliationDecision {
    pub receipt_fingerprint: String,
    pub disposition: StartupDisposition,
    pub resource_lock: ResourceLock,
    pub auto_adopt: bool,
    pub kill_observed_pid: bool,
}

pub fn reconcile_startup(facts: &StartupReconciliationFacts) -> StartupReconciliationDecision {
    let safely_gone = facts.process_truth == StartupProcessTruth::GoneOriginal
        && facts.boundary_empty == Some(true)
        && facts.stdout_drained
        && facts.stderr_drained;

    let (disposition, resource_lock) = match facts.process_truth {
        StartupProcessTruth::ReusedPid => (StartupDisposition::ReusedPidDetected, ResourceLock::Held),
        StartupProcessTruth::GoneOriginal if safely_gone => {
            (StartupDisposition::InterruptedReconciled, ResourceLock::Releasable)
        }
        StartupProcessTruth::ActiveOriginal
        | StartupProcessTruth::GoneOriginal
        | StartupProcessTruth::Unknown => {
            (StartupDisposition::ReconciliationRequired, ResourceLock::Held)
        }
    };

    StartupReconciliationDecision {
        receipt_fingerprint: facts.receipt_fingerprint.clone(),
        disposition,
        resource_lock,
        auto_adopt: false,
        kill_observed_pid: false,
    }
}
