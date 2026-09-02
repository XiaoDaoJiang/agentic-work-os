use serde::{Deserialize, Serialize};

use crate::windows_process_truth::WindowsTruthVerdict;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub struct WindowsObserverFacts {
    pub processkit_alive: bool,
    pub job_member: bool,
    pub win32_truth: WindowsTruthVerdict,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum WindowsObserverVerdict {
    ExecutingSurvivor,
    NotExecuting,
    Inconclusive,
}

pub fn classify_windows_observer(facts: &WindowsObserverFacts) -> WindowsObserverVerdict {
    match facts.win32_truth {
        WindowsTruthVerdict::ActiveOriginal => WindowsObserverVerdict::ExecutingSurvivor,
        WindowsTruthVerdict::TerminatedOriginal | WindowsTruthVerdict::Gone => {
            WindowsObserverVerdict::NotExecuting
        }
        WindowsTruthVerdict::ReusedPid | WindowsTruthVerdict::Inconclusive => {
            WindowsObserverVerdict::Inconclusive
        }
    }
}
