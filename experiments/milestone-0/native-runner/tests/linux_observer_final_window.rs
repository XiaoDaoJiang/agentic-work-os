use agentic_native_runner::linux_observer::{
    LinuxObserverSample, LinuxObserverSummary, reduce_linux_observer_samples,
};
use agentic_native_runner::linux_process_truth::LinuxTruthVerdict;

fn sample(
    pid: u32,
    processkit_alive: Option<bool>,
    cgroup_member: Option<bool>,
    linux_truth: LinuxTruthVerdict,
) -> LinuxObserverSample {
    LinuxObserverSample {
        pid,
        processkit_alive,
        cgroup_member,
        linux_truth,
    }
}

#[test]
fn transient_active_and_zombie_are_diagnostic_but_final_gone_is_not_a_survivor() {
    let during_window = vec![
        sample(
            20,
            Some(true),
            Some(true),
            LinuxTruthVerdict::ActiveOriginal,
        ),
        sample(
            20,
            Some(true),
            Some(true),
            LinuxTruthVerdict::ZombieOriginal,
        ),
        sample(
            21,
            Some(true),
            Some(true),
            LinuxTruthVerdict::ZombieOriginal,
        ),
    ];
    let final_snapshot = vec![
        sample(20, Some(false), Some(false), LinuxTruthVerdict::Gone),
        sample(21, Some(false), Some(false), LinuxTruthVerdict::Gone),
    ];

    assert_eq!(
        reduce_linux_observer_samples(&during_window, &final_snapshot),
        LinuxObserverSummary {
            active_observed_during_window_pids: vec![20],
            zombie_observed_during_window_pids: vec![20, 21],
            members_observed_during_window: vec![20, 21],
            final_active_original_pids: vec![],
            final_zombie_original_pids: vec![],
            final_reused_pids: vec![],
            final_inconclusive_pids: vec![],
            final_members_after_window: vec![],
        }
    );
}

#[test]
fn final_active_original_is_the_gate_relevant_executing_survivor() {
    let during_window = vec![sample(
        30,
        Some(true),
        Some(true),
        LinuxTruthVerdict::ActiveOriginal,
    )];
    let final_snapshot = vec![sample(
        30,
        Some(true),
        Some(true),
        LinuxTruthVerdict::ActiveOriginal,
    )];

    let summary = reduce_linux_observer_samples(&during_window, &final_snapshot);

    assert_eq!(summary.active_observed_during_window_pids, vec![30]);
    assert_eq!(summary.final_active_original_pids, vec![30]);
    assert_eq!(summary.final_members_after_window, vec![30]);
}

#[test]
fn final_zombie_is_not_executing_but_remains_a_resource_fact() {
    let during_window = vec![sample(
        40,
        Some(true),
        Some(true),
        LinuxTruthVerdict::ZombieOriginal,
    )];
    let final_snapshot = vec![sample(
        40,
        Some(true),
        Some(false),
        LinuxTruthVerdict::ZombieOriginal,
    )];

    let summary = reduce_linux_observer_samples(&during_window, &final_snapshot);

    assert!(summary.final_active_original_pids.is_empty());
    assert_eq!(summary.final_zombie_original_pids, vec![40]);
    assert!(summary.final_members_after_window.is_empty());
}

#[test]
fn final_reused_or_inconclusive_truth_fails_closed_without_becoming_the_old_run() {
    let final_snapshot = vec![
        sample(50, Some(false), Some(false), LinuxTruthVerdict::ReusedPid),
        sample(51, None, None, LinuxTruthVerdict::Inconclusive),
    ];

    let summary = reduce_linux_observer_samples(&[], &final_snapshot);

    assert!(summary.final_active_original_pids.is_empty());
    assert_eq!(summary.final_reused_pids, vec![50]);
    assert_eq!(summary.final_inconclusive_pids, vec![51]);
}
