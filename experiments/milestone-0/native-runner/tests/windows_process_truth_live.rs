#![cfg(windows)]

use std::process::Command;

use agentic_native_runner::windows_process_truth::{
    WindowsTruthVerdict, classify_windows_process_truth, observe_windows_process_truth,
};
use processkit::{process_info, process_is_alive};

#[test]
fn win32_truth_distinguishes_running_from_terminated_but_still_queryable_process_object() {
    let mut child = Command::new("ping")
        .args(["-n", "30", "127.0.0.1"])
        .spawn()
        .expect("spawn long-lived Windows child");
    let pid = child.id();
    let info = process_info(pid)
        .expect("ProcessKit process_info must succeed")
        .expect("spawned child must be observable");
    let start_time = info
        .start_time()
        .expect("Windows process identity must expose creation FILETIME");

    let running = observe_windows_process_truth(
        pid,
        Some(start_time),
        Some(process_is_alive(pid, Some(start_time)).expect("ProcessKit liveness while running")),
        None,
    );
    assert_eq!(
        classify_windows_process_truth(&running),
        WindowsTruthVerdict::ActiveOriginal,
        "running child must be active: {running:?}"
    );

    child.kill().expect("terminate child");
    let status = child
        .wait()
        .expect("reap child while retaining Child handle");
    assert!(
        !status.success(),
        "terminated child should not report success"
    );

    let processkit_alive = process_is_alive(pid, Some(start_time))
        .expect("ProcessKit liveness after termination must return a fact");
    let terminated =
        observe_windows_process_truth(pid, Some(start_time), Some(processkit_alive), None);
    assert_eq!(
        classify_windows_process_truth(&terminated),
        WindowsTruthVerdict::TerminatedOriginal,
        "Win32 exit/wait state must override mere PID/process-object queryability: {terminated:?}"
    );
}
