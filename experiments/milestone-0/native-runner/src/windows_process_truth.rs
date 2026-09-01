use serde::{Deserialize, Serialize};

pub const STILL_ACTIVE_EXIT_CODE: u32 = 259;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Win32OpenState {
    Opened,
    NotFound,
    AccessDenied,
    Failed,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Win32WaitState {
    Signaled,
    Timeout,
    Failed,
    Unavailable,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct WindowsProcessTruth {
    pub pid: u32,
    pub expected_creation_time: Option<u64>,
    pub observed_creation_time: Option<u64>,
    pub open_state: Win32OpenState,
    pub exit_code: Option<u32>,
    pub wait_state: Win32WaitState,
    pub processkit_alive: Option<bool>,
    pub job_member: Option<bool>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum WindowsTruthVerdict {
    ActiveOriginal,
    TerminatedOriginal,
    ReusedPid,
    Gone,
    Inconclusive,
}

pub fn classify_windows_process_truth(truth: &WindowsProcessTruth) -> WindowsTruthVerdict {
    match truth.open_state {
        Win32OpenState::NotFound => {
            if truth.processkit_alive == Some(true) || truth.job_member == Some(true) {
                return WindowsTruthVerdict::Inconclusive;
            }
            return WindowsTruthVerdict::Gone;
        }
        Win32OpenState::AccessDenied | Win32OpenState::Failed => {
            return WindowsTruthVerdict::Inconclusive;
        }
        Win32OpenState::Opened => {}
    }

    let (Some(expected_creation_time), Some(observed_creation_time)) =
        (truth.expected_creation_time, truth.observed_creation_time)
    else {
        return WindowsTruthVerdict::Inconclusive;
    };

    if expected_creation_time != observed_creation_time {
        return WindowsTruthVerdict::ReusedPid;
    }

    match (truth.exit_code, truth.wait_state) {
        (Some(STILL_ACTIVE_EXIT_CODE), Win32WaitState::Timeout) => {
            WindowsTruthVerdict::ActiveOriginal
        }
        (Some(exit_code), Win32WaitState::Signaled) if exit_code != STILL_ACTIVE_EXIT_CODE => {
            WindowsTruthVerdict::TerminatedOriginal
        }
        _ => WindowsTruthVerdict::Inconclusive,
    }
}
