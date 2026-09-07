use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum LinuxProcReadState {
    Opened,
    NotFound,
    AccessDenied,
    Failed,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub struct LinuxProcStat {
    pub state: char,
    pub start_time: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LinuxProcessTruth {
    pub pid: u32,
    pub expected_start_time: Option<u64>,
    pub observed_start_time: Option<u64>,
    pub process_state: Option<char>,
    pub read_state: LinuxProcReadState,
    pub processkit_alive: Option<bool>,
    pub cgroup_member: Option<bool>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum LinuxTruthVerdict {
    ActiveOriginal,
    ZombieOriginal,
    ReusedPid,
    Gone,
    Inconclusive,
}

/// Parse the execution state (field 3) and reuse-safe start-time identity
/// (field 22) from one `/proc/<pid>/stat` line.
///
/// `comm` is parenthesized and may itself contain spaces or `)` characters, so
/// the final closing parenthesis is the only safe delimiter for the remaining
/// whitespace-separated fields.
pub fn parse_linux_proc_stat(stat: &str) -> Option<LinuxProcStat> {
    let close = stat.rfind(')')?;
    let after = stat.get(close + 1..)?.trim_start();
    let fields = after.split_whitespace().collect::<Vec<_>>();

    // Post-comm index 0 is field 3 (`state`); field 22 (`starttime`) is index 19.
    if fields.len() <= 19 {
        return None;
    }

    let state_token = fields[0];
    let mut chars = state_token.chars();
    let state = chars.next()?;
    if chars.next().is_some() {
        return None;
    }
    let start_time = fields[19].parse::<u64>().ok()?;

    Some(LinuxProcStat { state, start_time })
}

pub fn classify_linux_process_truth(truth: &LinuxProcessTruth) -> LinuxTruthVerdict {
    match truth.read_state {
        LinuxProcReadState::NotFound => return LinuxTruthVerdict::Gone,
        LinuxProcReadState::AccessDenied | LinuxProcReadState::Failed => {
            return LinuxTruthVerdict::Inconclusive;
        }
        LinuxProcReadState::Opened => {}
    }

    let (Some(expected_start_time), Some(observed_start_time), Some(process_state)) = (
        truth.expected_start_time,
        truth.observed_start_time,
        truth.process_state,
    ) else {
        return LinuxTruthVerdict::Inconclusive;
    };

    if expected_start_time != observed_start_time {
        return LinuxTruthVerdict::ReusedPid;
    }

    if process_state == 'Z' {
        LinuxTruthVerdict::ZombieOriginal
    } else {
        LinuxTruthVerdict::ActiveOriginal
    }
}

#[cfg(target_os = "linux")]
pub fn observe_linux_process_truth(
    pid: u32,
    expected_start_time: Option<u64>,
    processkit_alive: Option<bool>,
    cgroup_member: Option<bool>,
) -> LinuxProcessTruth {
    use std::fs;
    use std::io::ErrorKind;

    let path = format!("/proc/{pid}/stat");
    match fs::read_to_string(path) {
        Ok(raw) => match parse_linux_proc_stat(&raw) {
            Some(parsed) => LinuxProcessTruth {
                pid,
                expected_start_time,
                observed_start_time: Some(parsed.start_time),
                process_state: Some(parsed.state),
                read_state: LinuxProcReadState::Opened,
                processkit_alive,
                cgroup_member,
            },
            None => LinuxProcessTruth {
                pid,
                expected_start_time,
                observed_start_time: None,
                process_state: None,
                read_state: LinuxProcReadState::Failed,
                processkit_alive,
                cgroup_member,
            },
        },
        Err(error) => {
            let read_state = match error.kind() {
                ErrorKind::NotFound => LinuxProcReadState::NotFound,
                ErrorKind::PermissionDenied => LinuxProcReadState::AccessDenied,
                _ => LinuxProcReadState::Failed,
            };
            LinuxProcessTruth {
                pid,
                expected_start_time,
                observed_start_time: None,
                process_state: None,
                read_state,
                processkit_alive,
                cgroup_member,
            }
        }
    }
}
