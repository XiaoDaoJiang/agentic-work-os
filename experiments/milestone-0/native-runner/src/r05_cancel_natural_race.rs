use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use processkit::{ProcessGroup, process_info, process_is_alive};
use serde::Serialize;
use serde_json::{Value, json};
use tokio::io::AsyncReadExt;
use tokio::process::{Child, ChildStderr, ChildStdout, Command};
use tokio::task::JoinHandle;
use tokio::time;

const READY_TIMEOUT_MS: u64 = 5_000;
const WAIT_TIMEOUT_MS: u64 = 3_000;

#[derive(Debug, Clone)]
pub struct R05RaceConfig {
    pub node: PathBuf,
    pub fixture: PathBuf,
    pub scenario: PathBuf,
    pub seed: u32,
    pub repetition: u32,
    pub cancel_delay_ms: u64,
    pub post_stop_observation_ms: u64,
    pub sample_ms: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum R05PhysicalWinner {
    Natural,
    Cancel,
}

#[derive(Debug, Clone, Serialize)]
pub struct R05RaceRecord {
    pub schema: &'static str,
    pub seed: u32,
    pub repetition: u32,
    pub actual_mechanism: String,
    pub root_pid: u32,
    pub fixture_pids: Vec<u32>,
    pub cancel_requested_at_ms: Option<u128>,
    pub natural_exit_observed_at_ms: Option<u128>,
    pub kill_all_invoked: bool,
    pub physical_winner: R05PhysicalWinner,
    pub terminal_candidate_count: u32,
    pub stdout_bytes: u64,
    pub stderr_bytes: u64,
    pub stdout_drained: bool,
    pub stderr_drained: bool,
    pub observation_window_complete: bool,
    pub final_members_after_window: Vec<u32>,
    pub final_survivor_pids: Vec<u32>,
    pub observed_late_write: bool,
    pub post_terminal_output_frames: u32,
    pub control_parse_complete: bool,
}

pub async fn run_r05_race_once(config: R05RaceConfig) -> Result<R05RaceRecord, String> {
    validate_config(&config)?;
    let run_root = create_run_root(config.seed, config.repetition)?;
    let result = run_r05_in_root(&config, &run_root).await;
    let _ = fs::remove_dir_all(&run_root);
    result
}

async fn run_r05_in_root(config: &R05RaceConfig, run_root: &Path) -> Result<R05RaceRecord, String> {
    let effective_scenario = write_effective_scenario(&config.scenario, run_root, config.seed)?;
    let control_file = run_root.join("control.jsonl");
    let marker_file = run_root.join("marker.jsonl");

    let group = ProcessGroup::new().map_err(|error| format!("create ProcessGroup: {error}"))?;
    let actual_mechanism = group.mechanism().name().to_owned();

    let mut command = Command::new(&config.node);
    command
        .arg(&config.fixture)
        .arg("--root")
        .arg(run_root)
        .arg("--scenario")
        .arg(&effective_scenario)
        .arg("--control-file")
        .arg(&control_file)
        .arg("--role")
        .arg("parent")
        .arg("--marker")
        .arg(&marker_file)
        .current_dir(run_root)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = group
        .spawn(command)
        .map_err(|error| format!("spawn finite hostile fixture: {error}"))?;
    let root_pid = child
        .id()
        .ok_or_else(|| "spawned R-05 fixture did not expose root pid".to_owned())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "R-05 stdout pipe was not captured".to_owned())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "R-05 stderr pipe was not captured".to_owned())?;
    let stdout_task = spawn_stdout_drain(stdout);
    let stderr_task = spawn_stderr_drain(stderr);

    wait_for_root_ready(&control_file, root_pid, Duration::from_millis(READY_TIMEOUT_MS)).await?;

    let race_started = Instant::now();
    let cancel_deadline = race_started + Duration::from_millis(config.cancel_delay_ms);
    let mut fixture_pids = BTreeSet::from([root_pid]);
    let mut anchors = BTreeMap::<u32, u64>::new();
    refresh_control_and_anchors(&control_file, &mut fixture_pids, &mut anchors);

    let mut natural_exit_observed_at_ms = None;
    let mut cancel_requested_at_ms = None;
    let mut kill_all_invoked = false;

    let physical_winner = loop {
        refresh_control_and_anchors(&control_file, &mut fixture_pids, &mut anchors);

        if let Some(_status) = child
            .try_wait()
            .map_err(|error| format!("poll natural exit: {error}"))?
        {
            natural_exit_observed_at_ms = Some(race_started.elapsed().as_millis());
            if Instant::now() < cancel_deadline {
                time::sleep(cancel_deadline.saturating_duration_since(Instant::now())).await;
            }
            cancel_requested_at_ms = Some(race_started.elapsed().as_millis());
            break R05PhysicalWinner::Natural;
        }

        if Instant::now() >= cancel_deadline {
            cancel_requested_at_ms = Some(race_started.elapsed().as_millis());
            kill_all_invoked = true;
            group
                .kill_all()
                .map_err(|error| format!("R-05 cancel kill_all: {error}"))?;
            wait_child(&mut child).await?;
            break R05PhysicalWinner::Cancel;
        }

        time::sleep(Duration::from_millis(1)).await;
    };

    refresh_control_and_anchors(&control_file, &mut fixture_pids, &mut anchors);
    let (stdout_bytes, stdout_drained) = finish_drain(stdout_task, "stdout").await;
    let (stderr_bytes, stderr_drained) = finish_drain(stderr_task, "stderr").await;

    let baseline_control = read_file_bytes(&control_file);
    let baseline_marker = read_file_bytes(&marker_file);
    let observation_started = Instant::now();
    let observation_deadline =
        observation_started + Duration::from_millis(config.post_stop_observation_ms);
    let mut observed_late_write = false;

    loop {
        refresh_control_and_anchors(&control_file, &mut fixture_pids, &mut anchors);
        if read_file_bytes(&control_file) != baseline_control || read_file_bytes(&marker_file) != baseline_marker {
            observed_late_write = true;
        }
        if Instant::now() >= observation_deadline {
            break;
        }
        let remaining = observation_deadline.saturating_duration_since(Instant::now());
        time::sleep(std::cmp::min(Duration::from_millis(config.sample_ms), remaining)).await;
    }

    refresh_control_and_anchors(&control_file, &mut fixture_pids, &mut anchors);
    let mut final_members_after_window = group
        .members()
        .map_err(|error| format!("R-05 final ProcessGroup membership: {error}"))?;
    final_members_after_window.sort_unstable();

    let mut final_survivor_pids = Vec::new();
    for pid in &fixture_pids {
        let alive = match anchors.get(pid).copied() {
            Some(start_time) => process_is_alive(*pid, Some(start_time)).unwrap_or(true),
            None => process_is_alive(*pid, None).unwrap_or(true),
        };
        if alive {
            final_survivor_pids.push(*pid);
        }
    }
    final_survivor_pids.sort_unstable();

    let (_, control_parse_complete) = parse_control_pids(&control_file);

    // The business terminal is not committed here. This is one physical terminal candidate
    // that a separate integration test feeds through the existing RunnerEventReducer.
    let terminal_candidate_count = 1;
    let post_terminal_output_frames = 0;

    let record = R05RaceRecord {
        schema: "r05-cancel-natural-race-v0",
        seed: config.seed,
        repetition: config.repetition,
        actual_mechanism,
        root_pid,
        fixture_pids: fixture_pids.into_iter().collect(),
        cancel_requested_at_ms,
        natural_exit_observed_at_ms,
        kill_all_invoked,
        physical_winner,
        terminal_candidate_count,
        stdout_bytes,
        stderr_bytes,
        stdout_drained,
        stderr_drained,
        observation_window_complete: true,
        final_members_after_window,
        final_survivor_pids,
        observed_late_write,
        post_terminal_output_frames,
        control_parse_complete,
    };

    // Defensive cleanup is after the frozen final observation and does not rewrite the record.
    let _ = group.kill_all();
    Ok(record)
}

fn validate_config(config: &R05RaceConfig) -> Result<(), String> {
    if config.cancel_delay_ms == 0 {
        return Err("R-05 cancel_delay_ms must be positive".to_owned());
    }
    if config.post_stop_observation_ms == 0 {
        return Err("R-05 post_stop_observation_ms must be positive".to_owned());
    }
    if config.sample_ms == 0 {
        return Err("R-05 sample_ms must be positive".to_owned());
    }
    for (label, path) in [
        ("node", &config.node),
        ("fixture", &config.fixture),
        ("scenario", &config.scenario),
    ] {
        if !path.is_absolute() {
            return Err(format!("R-05 {label} path must be absolute"));
        }
        if !path.is_file() {
            return Err(format!("R-05 {label} path is not a file: {}", path.display()));
        }
    }
    Ok(())
}

fn create_run_root(seed: u32, repetition: u32) -> Result<PathBuf, String> {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("clock before UNIX epoch: {error}"))?
        .as_nanos();
    let root = std::env::temp_dir().join(format!(
        "agentic-r05-{}-{seed}-{repetition}-{nonce}",
        std::process::id()
    ));
    fs::create_dir_all(&root).map_err(|error| format!("create R-05 run root: {error}"))?;
    Ok(root)
}

fn write_effective_scenario(source: &Path, run_root: &Path, seed: u32) -> Result<PathBuf, String> {
    let text = fs::read_to_string(source)
        .map_err(|error| format!("read R-05 scenario {}: {error}", source.display()))?;
    let mut document: Value =
        serde_json::from_str(&text).map_err(|error| format!("parse R-05 scenario JSON: {error}"))?;
    let scenario = document
        .get_mut("hostile_process_v0")
        .and_then(Value::as_object_mut)
        .ok_or_else(|| "R-05 scenario must contain hostile_process_v0 object".to_owned())?;
    scenario.insert("seed".to_owned(), json!(seed));
    let destination = run_root.join("effective-scenario.json");
    fs::write(
        &destination,
        serde_json::to_vec_pretty(&document)
            .map_err(|error| format!("serialize R-05 scenario: {error}"))?,
    )
    .map_err(|error| format!("write R-05 effective scenario: {error}"))?;
    Ok(destination)
}

async fn wait_for_root_ready(control_file: &Path, root_pid: u32, timeout: Duration) -> Result<(), String> {
    let deadline = Instant::now() + timeout;
    loop {
        if let Ok(text) = fs::read_to_string(control_file) {
            for line in text.lines() {
                let Ok(value) = serde_json::from_str::<Value>(line) else {
                    continue;
                };
                if value.get("event").and_then(Value::as_str) == Some("fixture.started")
                    && value.get("pid").and_then(Value::as_u64) == Some(root_pid as u64)
                {
                    return Ok(());
                }
            }
        }
        if Instant::now() >= deadline {
            return Err(format!("R-05 fixture did not report ready within {} ms", timeout.as_millis()));
        }
        time::sleep(Duration::from_millis(5)).await;
    }
}

fn refresh_control_and_anchors(
    control_file: &Path,
    fixture_pids: &mut BTreeSet<u32>,
    anchors: &mut BTreeMap<u32, u64>,
) {
    let (observed, _) = parse_control_pids(control_file);
    fixture_pids.extend(observed);
    let pids = fixture_pids.iter().copied().collect::<Vec<_>>();
    for pid in pids {
        if anchors.contains_key(&pid) {
            continue;
        }
        if let Ok(Some(info)) = process_info(pid) {
            if let Some(start_time) = info.start_time() {
                anchors.insert(pid, start_time);
            }
        }
    }
}

fn parse_control_pids(control_file: &Path) -> (BTreeSet<u32>, bool) {
    let Ok(text) = fs::read_to_string(control_file) else {
        return (BTreeSet::new(), false);
    };
    let mut pids = BTreeSet::new();
    let mut complete = true;
    for line in text.lines() {
        match serde_json::from_str::<Value>(line) {
            Ok(value) => {
                if let Some(pid) = value.get("pid").and_then(Value::as_u64) {
                    if let Ok(pid) = u32::try_from(pid) {
                        pids.insert(pid);
                    }
                }
                if let Some(pid) = value
                    .get("payload")
                    .and_then(|payload| payload.get("childPid"))
                    .and_then(Value::as_u64)
                {
                    if let Ok(pid) = u32::try_from(pid) {
                        pids.insert(pid);
                    }
                }
            }
            Err(_) => complete = false,
        }
    }
    (pids, complete)
}

async fn wait_child(child: &mut Child) -> Result<(), String> {
    time::timeout(Duration::from_millis(WAIT_TIMEOUT_MS), child.wait())
        .await
        .map_err(|_| format!("R-05 child did not become waitable within {WAIT_TIMEOUT_MS} ms"))?
        .map_err(|error| format!("wait for R-05 child: {error}"))?;
    Ok(())
}

fn spawn_stdout_drain(mut stdout: ChildStdout) -> JoinHandle<Result<u64, String>> {
    tokio::spawn(async move {
        let mut bytes = Vec::new();
        stdout
            .read_to_end(&mut bytes)
            .await
            .map_err(|error| format!("drain R-05 stdout: {error}"))?;
        Ok(bytes.len() as u64)
    })
}

fn spawn_stderr_drain(mut stderr: ChildStderr) -> JoinHandle<Result<u64, String>> {
    tokio::spawn(async move {
        let mut bytes = Vec::new();
        stderr
            .read_to_end(&mut bytes)
            .await
            .map_err(|error| format!("drain R-05 stderr: {error}"))?;
        Ok(bytes.len() as u64)
    })
}

async fn finish_drain(task: JoinHandle<Result<u64, String>>, label: &str) -> (u64, bool) {
    match time::timeout(Duration::from_millis(WAIT_TIMEOUT_MS), task).await {
        Ok(Ok(Ok(bytes))) => (bytes, true),
        Ok(Ok(Err(_))) | Ok(Err(_)) | Err(_) => {
            let _ = label;
            (0, false)
        }
    }
}

fn read_file_bytes(path: &Path) -> Vec<u8> {
    fs::read(path).unwrap_or_default()
}
