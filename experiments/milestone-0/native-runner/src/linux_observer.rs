use std::collections::BTreeSet;

use serde::{Deserialize, Serialize};

use crate::linux_process_truth::LinuxTruthVerdict;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub struct LinuxObserverSample {
    pub pid: u32,
    pub processkit_alive: Option<bool>,
    pub cgroup_member: Option<bool>,
    pub linux_truth: LinuxTruthVerdict,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LinuxObserverSummary {
    pub active_observed_during_window_pids: Vec<u32>,
    pub zombie_observed_during_window_pids: Vec<u32>,
    pub members_observed_during_window: Vec<u32>,
    pub final_active_original_pids: Vec<u32>,
    pub final_zombie_original_pids: Vec<u32>,
    pub final_reused_pids: Vec<u32>,
    pub final_inconclusive_pids: Vec<u32>,
    pub final_members_after_window: Vec<u32>,
}

pub fn reduce_linux_observer_samples(
    during_window: &[LinuxObserverSample],
    final_snapshot: &[LinuxObserverSample],
) -> LinuxObserverSummary {
    let mut active_observed_during_window = BTreeSet::new();
    let mut zombie_observed_during_window = BTreeSet::new();
    let mut members_observed_during_window = BTreeSet::new();

    for sample in during_window {
        match sample.linux_truth {
            LinuxTruthVerdict::ActiveOriginal => {
                active_observed_during_window.insert(sample.pid);
            }
            LinuxTruthVerdict::ZombieOriginal => {
                zombie_observed_during_window.insert(sample.pid);
            }
            LinuxTruthVerdict::Gone
            | LinuxTruthVerdict::ReusedPid
            | LinuxTruthVerdict::Inconclusive => {}
        }

        if sample.cgroup_member == Some(true) {
            members_observed_during_window.insert(sample.pid);
        }
    }

    let mut final_active_original = BTreeSet::new();
    let mut final_zombie_original = BTreeSet::new();
    let mut final_reused = BTreeSet::new();
    let mut final_inconclusive = BTreeSet::new();
    let mut final_members_after_window = BTreeSet::new();

    for sample in final_snapshot {
        match sample.linux_truth {
            LinuxTruthVerdict::ActiveOriginal => {
                final_active_original.insert(sample.pid);
            }
            LinuxTruthVerdict::ZombieOriginal => {
                final_zombie_original.insert(sample.pid);
            }
            LinuxTruthVerdict::ReusedPid => {
                final_reused.insert(sample.pid);
            }
            LinuxTruthVerdict::Inconclusive => {
                final_inconclusive.insert(sample.pid);
            }
            LinuxTruthVerdict::Gone => {}
        }

        if sample.cgroup_member == Some(true) {
            final_members_after_window.insert(sample.pid);
        }
    }

    LinuxObserverSummary {
        active_observed_during_window_pids: active_observed_during_window.into_iter().collect(),
        zombie_observed_during_window_pids: zombie_observed_during_window.into_iter().collect(),
        members_observed_during_window: members_observed_during_window.into_iter().collect(),
        final_active_original_pids: final_active_original.into_iter().collect(),
        final_zombie_original_pids: final_zombie_original.into_iter().collect(),
        final_reused_pids: final_reused.into_iter().collect(),
        final_inconclusive_pids: final_inconclusive.into_iter().collect(),
        final_members_after_window: final_members_after_window.into_iter().collect(),
    }
}
