use agentic_native_runner::windows_process_truth::{
    Win32OpenState, Win32WaitState, WindowsProcessTruth, WindowsTruthVerdict,
    classify_windows_process_truth,
};

const STILL_ACTIVE: u32 = 259;

fn base_truth() -> WindowsProcessTruth {
    WindowsProcessTruth {
        pid: 4242,
        expected_creation_time: Some(100),
        observed_creation_time: Some(100),
        open_state: Win32OpenState::Opened,
        exit_code: Some(STILL_ACTIVE),
        wait_state: Win32WaitState::Timeout,
        processkit_alive: Some(true),
        job_member: Some(true),
    }
}

#[test]
fn matching_identity_still_active_and_unsignaled_is_active_original() {
    assert_eq!(
        classify_windows_process_truth(&base_truth()),
        WindowsTruthVerdict::ActiveOriginal
    );
}

#[test]
fn matching_identity_signaled_or_exit_code_is_terminated_original() {
    let mut signaled = base_truth();
    signaled.wait_state = Win32WaitState::Signaled;
    signaled.exit_code = Some(0);
    signaled.processkit_alive = Some(true);
    signaled.job_member = Some(false);
    assert_eq!(
        classify_windows_process_truth(&signaled),
        WindowsTruthVerdict::TerminatedOriginal
    );

    let mut exited = base_truth();
    exited.exit_code = Some(7);
    exited.wait_state = Win32WaitState::Signaled;
    assert_eq!(
        classify_windows_process_truth(&exited),
        WindowsTruthVerdict::TerminatedOriginal
    );
}

#[test]
fn creation_identity_mismatch_is_pid_reuse_even_if_pid_is_live() {
    let mut truth = base_truth();
    truth.observed_creation_time = Some(999);
    truth.processkit_alive = Some(true);
    truth.job_member = Some(false);
    assert_eq!(
        classify_windows_process_truth(&truth),
        WindowsTruthVerdict::ReusedPid
    );
}

#[test]
fn missing_process_is_gone_when_open_reports_not_found() {
    let mut truth = base_truth();
    truth.open_state = Win32OpenState::NotFound;
    truth.observed_creation_time = None;
    truth.exit_code = None;
    truth.wait_state = Win32WaitState::Unavailable;
    truth.processkit_alive = Some(false);
    truth.job_member = Some(false);
    assert_eq!(
        classify_windows_process_truth(&truth),
        WindowsTruthVerdict::Gone
    );
}

#[test]
fn permission_or_contradictory_win32_facts_are_inconclusive_fail_closed() {
    let mut denied = base_truth();
    denied.open_state = Win32OpenState::AccessDenied;
    denied.observed_creation_time = None;
    denied.exit_code = None;
    denied.wait_state = Win32WaitState::Unavailable;
    assert_eq!(
        classify_windows_process_truth(&denied),
        WindowsTruthVerdict::Inconclusive
    );

    let mut contradictory = base_truth();
    contradictory.exit_code = Some(STILL_ACTIVE);
    contradictory.wait_state = Win32WaitState::Signaled;
    assert_eq!(
        classify_windows_process_truth(&contradictory),
        WindowsTruthVerdict::Inconclusive
    );
}
