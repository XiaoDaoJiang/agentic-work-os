use agentic_native_runner::windows_observer::{
    WindowsObserverSample, WindowsObserverSummary, reduce_windows_observer_samples,
};
use agentic_native_runner::windows_process_truth::WindowsTruthVerdict;

#[test]
fn reduction_separates_real_survivor_observer_mismatch_and_inconclusive_pids() {
    let samples = vec![
        WindowsObserverSample {
            pid: 10,
            processkit_alive: true,
            job_member: false,
            win32_truth: WindowsTruthVerdict::TerminatedOriginal,
        },
        WindowsObserverSample {
            pid: 11,
            processkit_alive: true,
            job_member: false,
            win32_truth: WindowsTruthVerdict::ActiveOriginal,
        },
        WindowsObserverSample {
            pid: 12,
            processkit_alive: false,
            job_member: false,
            win32_truth: WindowsTruthVerdict::Inconclusive,
        },
    ];

    assert_eq!(
        reduce_windows_observer_samples(&samples),
        WindowsObserverSummary {
            executing_survivor_pids: vec![11],
            observer_mismatch_pids: vec![10],
            inconclusive_pids: vec![12],
        }
    );
}

#[test]
fn any_active_sample_for_same_pid_dominates_later_termination() {
    let samples = vec![
        WindowsObserverSample {
            pid: 20,
            processkit_alive: true,
            job_member: false,
            win32_truth: WindowsTruthVerdict::ActiveOriginal,
        },
        WindowsObserverSample {
            pid: 20,
            processkit_alive: false,
            job_member: false,
            win32_truth: WindowsTruthVerdict::Gone,
        },
    ];

    let summary = reduce_windows_observer_samples(&samples);
    assert_eq!(summary.executing_survivor_pids, vec![20]);
    assert!(summary.observer_mismatch_pids.is_empty());
    assert!(summary.inconclusive_pids.is_empty());
}

#[test]
fn mismatch_requires_processkit_alive_outside_job_and_terminated_or_gone_win32_truth() {
    let samples = vec![
        WindowsObserverSample {
            pid: 30,
            processkit_alive: false,
            job_member: false,
            win32_truth: WindowsTruthVerdict::TerminatedOriginal,
        },
        WindowsObserverSample {
            pid: 31,
            processkit_alive: true,
            job_member: true,
            win32_truth: WindowsTruthVerdict::TerminatedOriginal,
        },
    ];

    let summary = reduce_windows_observer_samples(&samples);
    assert!(summary.executing_survivor_pids.is_empty());
    assert!(summary.observer_mismatch_pids.is_empty());
    assert!(summary.inconclusive_pids.is_empty());
}

#[test]
fn inconclusive_dominates_non_executing_but_not_active_for_same_pid() {
    let samples = vec![
        WindowsObserverSample {
            pid: 40,
            processkit_alive: true,
            job_member: false,
            win32_truth: WindowsTruthVerdict::TerminatedOriginal,
        },
        WindowsObserverSample {
            pid: 40,
            processkit_alive: false,
            job_member: false,
            win32_truth: WindowsTruthVerdict::ReusedPid,
        },
        WindowsObserverSample {
            pid: 41,
            processkit_alive: false,
            job_member: false,
            win32_truth: WindowsTruthVerdict::Inconclusive,
        },
        WindowsObserverSample {
            pid: 41,
            processkit_alive: true,
            job_member: false,
            win32_truth: WindowsTruthVerdict::ActiveOriginal,
        },
    ];

    let summary = reduce_windows_observer_samples(&samples);
    assert_eq!(summary.executing_survivor_pids, vec![41]);
    assert!(summary.observer_mismatch_pids.is_empty());
    assert_eq!(summary.inconclusive_pids, vec![40]);
}
