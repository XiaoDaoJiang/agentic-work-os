use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum HostileVerdict {
    Pass,
    Fail,
    Inconclusive,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct HostileEvidence {
    pub scenario_id: String,
    pub seed: u32,
    pub repetition: u32,
    pub platform: String,
    pub architecture: String,
    pub processkit_version: String,
    pub actual_mechanism: String,
    pub trigger: String,
    pub root_pid: Option<u32>,
    pub members_before: Vec<u32>,
    pub members_after: Vec<u32>,
    pub fixture_pids: Vec<u32>,
    pub survivor_pids: Vec<u32>,
    pub stdout_bytes: u64,
    pub stderr_bytes: u64,
    pub stdout_drained: bool,
    pub stderr_drained: bool,
    pub teardown_error: Option<String>,
    pub observer_complete: bool,
    pub observed_late_write: bool,
    pub cleanup_succeeded: Option<bool>,
    pub verdict_reasons: Vec<String>,
}

pub fn evaluate_physical_verdict(evidence: &HostileEvidence) -> HostileVerdict {
    if evidence.teardown_error.is_some()
        || !evidence.survivor_pids.is_empty()
        || !evidence.members_after.is_empty()
        || evidence.observed_late_write
        || !evidence.stdout_drained
        || !evidence.stderr_drained
    {
        return HostileVerdict::Fail;
    }

    if !evidence.observer_complete
        || evidence.root_pid.is_none()
        || evidence.actual_mechanism.trim().is_empty()
    {
        return HostileVerdict::Inconclusive;
    }

    HostileVerdict::Pass
}

pub fn record_cleanup_outcome(evidence: &mut HostileEvidence, succeeded: bool) {
    evidence.cleanup_succeeded = Some(succeeded);
}
