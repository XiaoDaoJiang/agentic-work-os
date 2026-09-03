use std::collections::BTreeMap;

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

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub struct WindowsObserverSample {
    pub pid: u32,
    pub processkit_alive: bool,
    pub job_member: bool,
    pub win32_truth: WindowsTruthVerdict,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct WindowsObserverSummary {
    pub executing_survivor_pids: Vec<u32>,
    pub observer_mismatch_pids: Vec<u32>,
    pub inconclusive_pids: Vec<u32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
enum ReducedPidState {
    None,
    Mismatch,
    Inconclusive,
    ExecutingSurvivor,
}

pub fn reduce_windows_observer_samples(samples: &[WindowsObserverSample]) -> WindowsObserverSummary {
    let mut states = BTreeMap::<u32, ReducedPidState>::new();

    for sample in samples {
        let candidate = match sample.win32_truth {
            WindowsTruthVerdict::ActiveOriginal => ReducedPidState::ExecutingSurvivor,
            WindowsTruthVerdict::ReusedPid | WindowsTruthVerdict::Inconclusive => {
                ReducedPidState::Inconclusive
            }
            WindowsTruthVerdict::TerminatedOriginal | WindowsTruthVerdict::Gone
                if sample.processkit_alive && !sample.job_member =>
            {
                ReducedPidState::Mismatch
            }
            WindowsTruthVerdict::TerminatedOriginal | WindowsTruthVerdict::Gone => {
                ReducedPidState::None
            }
        };

        let state = states.entry(sample.pid).or_insert(ReducedPidState::None);
        if candidate > *state {
            *state = candidate;
        }
    }

    let mut summary = WindowsObserverSummary {
        executing_survivor_pids: Vec::new(),
        observer_mismatch_pids: Vec::new(),
        inconclusive_pids: Vec::new(),
    };

    for (pid, state) in states {
        match state {
            ReducedPidState::ExecutingSurvivor => summary.executing_survivor_pids.push(pid),
            ReducedPidState::Mismatch => summary.observer_mismatch_pids.push(pid),
            ReducedPidState::Inconclusive => summary.inconclusive_pids.push(pid),
            ReducedPidState::None => {}
        }
    }

    summary
}
