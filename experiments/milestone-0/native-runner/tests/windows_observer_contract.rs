use agentic_native_runner::windows_observer::{
    WindowsObserverFacts, WindowsObserverVerdict, classify_windows_observer,
};
use agentic_native_runner::windows_process_truth::WindowsTruthVerdict;

#[test]
fn terminated_original_is_not_an_executing_survivor_when_processkit_transiently_says_alive() {
    let facts = WindowsObserverFacts {
        processkit_alive: true,
        job_member: false,
        win32_truth: WindowsTruthVerdict::TerminatedOriginal,
    };

    assert_eq!(
        classify_windows_observer(&facts),
        WindowsObserverVerdict::NotExecuting
    );
}

#[test]
fn active_original_after_stop_is_a_hard_survivor() {
    let facts = WindowsObserverFacts {
        processkit_alive: true,
        job_member: false,
        win32_truth: WindowsTruthVerdict::ActiveOriginal,
    };

    assert_eq!(
        classify_windows_observer(&facts),
        WindowsObserverVerdict::ExecutingSurvivor
    );
}

#[test]
fn reuse_or_inconclusive_win32_truth_never_becomes_pass() {
    for win32_truth in [
        WindowsTruthVerdict::ReusedPid,
        WindowsTruthVerdict::Inconclusive,
    ] {
        let facts = WindowsObserverFacts {
            processkit_alive: false,
            job_member: false,
            win32_truth,
        };

        assert_eq!(
            classify_windows_observer(&facts),
            WindowsObserverVerdict::Inconclusive
        );
    }
}

#[test]
fn gone_original_is_not_executing_even_if_processkit_reports_alive() {
    let facts = WindowsObserverFacts {
        processkit_alive: true,
        job_member: false,
        win32_truth: WindowsTruthVerdict::Gone,
    };

    assert_eq!(
        classify_windows_observer(&facts),
        WindowsObserverVerdict::NotExecuting
    );
}
