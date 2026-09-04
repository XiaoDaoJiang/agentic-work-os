use agentic_native_runner::linux_process_truth::{
    LinuxProcReadState, LinuxProcessTruth, LinuxTruthVerdict, classify_linux_process_truth,
    parse_linux_proc_stat,
};

fn stat_line(pid: u32, state: char, start_time: u64) -> String {
    // /proc/<pid>/stat fields after `(comm)` start at field 3 (`state`).
    // starttime is field 22, therefore index 19 in the post-comm token list.
    let mut fields = vec![state.to_string()];
    fields.extend((4..=21).map(|_| "0".to_owned()));
    fields.push(start_time.to_string());
    fields.extend((23..=30).map(|_| "0".to_owned()));
    format!("{pid} (worker (nested) name) {}", fields.join(" "))
}

fn truth(
    read_state: LinuxProcReadState,
    expected_start_time: Option<u64>,
    observed_start_time: Option<u64>,
    process_state: Option<char>,
) -> LinuxProcessTruth {
    LinuxProcessTruth {
        pid: 4242,
        expected_start_time,
        observed_start_time,
        process_state,
        read_state,
        processkit_alive: Some(true),
        cgroup_member: Some(true),
    }
}

#[test]
fn linux_proc_stat_parser_preserves_state_and_reuse_safe_start_time() {
    let parsed = parse_linux_proc_stat(&stat_line(4242, 'Z', 9_876_543))
        .expect("valid proc stat must parse");

    assert_eq!(parsed.state, 'Z');
    assert_eq!(parsed.start_time, 9_876_543);
}

#[test]
fn linux_proc_stat_parser_handles_comm_with_spaces_and_parentheses() {
    let parsed = parse_linux_proc_stat(&stat_line(4242, 'S', 123_456))
        .expect("last closing parenthesis must delimit comm");

    assert_eq!(parsed.state, 'S');
    assert_eq!(parsed.start_time, 123_456);
}

#[test]
fn same_identity_zombie_is_not_an_executing_survivor() {
    let verdict = classify_linux_process_truth(&truth(
        LinuxProcReadState::Opened,
        Some(99),
        Some(99),
        Some('Z'),
    ));

    assert_eq!(verdict, LinuxTruthVerdict::ZombieOriginal);
}

#[test]
fn same_identity_non_zombie_is_active_original() {
    for state in ['R', 'S', 'D', 'T', 't', 'I'] {
        let verdict = classify_linux_process_truth(&truth(
            LinuxProcReadState::Opened,
            Some(99),
            Some(99),
            Some(state),
        ));
        assert_eq!(verdict, LinuxTruthVerdict::ActiveOriginal, "state={state}");
    }
}

#[test]
fn different_start_time_is_reused_pid_even_when_proc_entry_exists() {
    let verdict = classify_linux_process_truth(&truth(
        LinuxProcReadState::Opened,
        Some(99),
        Some(100),
        Some('R'),
    ));

    assert_eq!(verdict, LinuxTruthVerdict::ReusedPid);
}

#[test]
fn missing_proc_entry_is_gone() {
    let verdict =
        classify_linux_process_truth(&truth(LinuxProcReadState::NotFound, Some(99), None, None));

    assert_eq!(verdict, LinuxTruthVerdict::Gone);
}

#[test]
fn unreadable_or_malformed_proc_truth_fails_closed() {
    for read_state in [LinuxProcReadState::AccessDenied, LinuxProcReadState::Failed] {
        let verdict = classify_linux_process_truth(&truth(read_state, Some(99), None, None));
        assert_eq!(verdict, LinuxTruthVerdict::Inconclusive);
    }

    assert!(parse_linux_proc_stat("4242 (broken) S too-short").is_none());
    assert_eq!(
        classify_linux_process_truth(&truth(
            LinuxProcReadState::Opened,
            Some(99),
            None,
            Some('S'),
        )),
        LinuxTruthVerdict::Inconclusive
    );
}
