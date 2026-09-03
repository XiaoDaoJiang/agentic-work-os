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
