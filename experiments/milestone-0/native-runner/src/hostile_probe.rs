use std::collections::{BTreeMap, BTreeSet};
use std::ffi::OsString;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::{Duration, Instant};

use processkit::ProcessGroup;
use serde::Serialize;
use serde_json::{Value, json};
use tokio::io::{AsyncRead, AsyncReadExt};
use tokio::process::Child;
use tokio::task::JoinHandle;
use tokio::time;

const PROCESSKIT_VERSION: &str = "3.3.4";
const PHYSICAL_VERDICT: &str = "INCONCLUSIVE";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Trigger {
    Cancel,
    Timeout,
    Natural,
}

impl Trigger {
    fn parse(value: &str) -> Result<Self, String> {
        match value {
            "cancel" => Ok(Self::Cancel),
            "timeout" => Ok(Self::Timeout),
            "natural" => Ok(Self::Natural),
            other => Err(format!(
                "--trigger must be cancel, timeout, or natural; got {other}"
            )),
        }
    }

    fn name(self) -> &'static str {
        match self {
            Self::Cancel => "cancel",
            Self::Timeout => "timeout",
            Self::Natural => "natural",
        }
    }
}

#[derive(Debug, Clone)]
pub struct HostileProbeConfig {
    pub node: PathBuf,
    pub fixture: PathBuf,
    pub scenario: PathBuf,
    pub root: PathBuf,
    pub trigger: Trigger,
    pub trigger_ms: u64,
    pub post_stop_ms: u64,
    pub sample_ms: u64,
    pub seed: u32,
    pub repetition: u32,
}

impl HostileProbeConfig {
    pub fn parse(args: impl IntoIterator<Item = OsString>) -> Result<Self, String> {
        let args: Vec<OsString> = args.into_iter().collect();
        if args.len() % 2 != 0 {
            return Err("arguments must be supplied as --name value pairs".to_owned());
        }

        let mut values = BTreeMap::new();
        for pair in args.chunks_exact(2) {
            let key = pair[0]
                .to_str()
                .ok_or_else(|| "argument names must be UTF-8".to_owned())?;
            if !key.starts_with("--") {
                return Err(format!("expected --name, got {key}"));
            }
            let key = key.trim_start_matches("--").to_owned();
            if values.insert(key.clone(), pair[1].clone()).is_some() {
                return Err(format!("duplicate argument --{key}"));
            }
        }

        let node = required_path(&mut values, "node")?;
        let fixture = required_path(&mut values, "fixture")?;
        let scenario = required_path(&mut values, "scenario")?;
        let root = required_path(&mut values, "root")?;
        let trigger = Trigger::parse(&required_string(&mut values, "trigger")?)?;
        let trigger_ms = required_u64(&mut values, "trigger-ms")?;
        let post_stop_ms = required_u64(&mut values, "post-stop-ms")?;
        let sample_ms = required_u64(&mut values, "sample-ms")?;
        let seed = required_u32(&mut values, "seed")?;
        let repetition = required_u32(&mut values, "repetition")?;

        if !values.is_empty() {
            return Err(format!(
                "unknown arguments: {}",
                values
                    .keys()
                    .map(|key| format!("--{key}"))
                    .collect::<Vec<_>>()
                    .join(", ")
            ));
        }
        if trigger_ms == 0 {
            return Err("--trigger-ms must be positive".to_owned());
        }
        if post_stop_ms != 750 {
            return Err("--post-stop-ms is frozen at 750 for the first matrix".to_owned());
        }
        if sample_ms != 50 {
            return Err("--sample-ms is frozen at 50 for the first matrix".to_owned());
        }
        for (label, path) in [
            ("node", &node),
            ("fixture", &fixture),
            ("scenario", &scenario),
            ("root", &root),
        ] {
            if !path.is_absolute() {
                return Err(format!("--{label} must be an absolute path"));
            }
        }
        if !node.is_file() {
            return Err(format!("--node does not name a file: {}", node.display()));
        }
        if !fixture.is_file() {
            return Err(format!(
                "--fixture does not name a file: {}",
                fixture.display()
            ));
        }
        if !scenario.is_file() {
            return Err(format!(
                "--scenario does not name a file: {}",
                scenario.display()
            ));
        }

        Ok(Self {
            node,
            fixture,
            scenario,
            root,
            trigger,
            trigger_ms,
            post_stop_ms,
            sample_ms,
            seed,
            repetition,
        })
    }
}

#[derive(Debug, Serialize)]
pub struct HostileProbeSummary {
    pub schema: &'static str,
    pub scenario_id: String,
    pub seed: u32,
    pub repetition: u32,
    pub platform: &'static str,
    pub architecture: &'static str,
    pub processkit_version: &'static str,
    pub actual_mechanism: String,
    pub trigger: &'static str,
    pub root_pid: Option<u32>,
    pub members_before: Vec<u32>,
    pub members_after: Vec<u32>,
    pub fixture_pids: Vec<u32>,
    pub stdout_bytes: u64,
    pub stderr_bytes: u64,
    pub stdout_drained: bool,
    pub stderr_drained: bool,
    pub teardown_error: Option<String>,
    pub observation_window_complete: bool,
    pub observer_complete: bool,
    pub control_parse_complete: bool,
    pub observed_late_write: bool,
    pub physical_verdict: &'static str,
    pub observation_errors: Vec<String>,
}

pub async fn run_probe(config: HostileProbeConfig) -> Result<HostileProbeSummary, String> {
    prepare_empty_root(&config.root)?;
    let scenario_id = config
        .scenario
        .file_stem()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "scenario filename must have a UTF-8 stem".to_owned())?
        .to_owned();
    let effective_scenario = write_effective_scenario(&config)?;
    let control_file = config.root.join("control.jsonl");
    let marker_file = config.root.join("marker.jsonl");

    let group = ProcessGroup::new().map_err(|error| format!("create ProcessGroup: {error}"))?;
    let actual_mechanism = group.mechanism().name().to_owned();

    let mut command = tokio::process::Command::new(&config.node);
    command
        .arg(&config.fixture)
        .arg("--root")
        .arg(&config.root)
        .arg("--scenario")
        .arg(&effective_scenario)
        .arg("--control-file")
        .arg(&control_file)
        .arg("--role")
        .arg("parent")
        .arg("--marker")
        .arg(&marker_file)
        .current_dir(&config.root)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = group
        .spawn(command)
        .map_err(|error| format!("spawn hostile fixture: {error}"))?;
    let root_pid = child.id();
    if root_pid.is_none() {
        return Err("spawned hostile fixture did not expose a root pid".to_owned());
    }
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "hostile fixture stdout pipe was not captured".to_owned())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "hostile fixture stderr pipe was not captured".to_owned())?;
    let stdout_task = tokio::spawn(drain_reader(stdout));
    let stderr_task = tokio::spawn(drain_reader(stderr));

    let mut observation_errors = Vec::new();
    let mut teardown_errors = Vec::new();
    let members_before;

    match config.trigger {
        Trigger::Cancel | Trigger::Timeout => {
            time::sleep(Duration::from_millis(config.trigger_ms)).await;
            members_before = read_members(&group, "members_before", &mut observation_errors);
            if let Err(error) = group.kill_all() {
                teardown_errors.push(format!("kill_all: {error}"));
            }
            reap_root(&mut child, &group, &mut teardown_errors).await;
        }
        Trigger::Natural => {
            members_before = read_members(&group, "members_before", &mut observation_errors);
            match time::timeout(Duration::from_millis(config.trigger_ms), child.wait()).await {
                Ok(Ok(_status)) => {}
                Ok(Err(error)) => teardown_errors.push(format!("root wait: {error}")),
                Err(_) => {
                    teardown_errors.push(format!(
                        "natural harness deadline elapsed after {} ms",
                        config.trigger_ms
                    ));
                    if let Err(error) = group.kill_all() {
                        teardown_errors.push(format!("natural cleanup kill_all: {error}"));
                    }
                    reap_root(&mut child, &group, &mut teardown_errors).await;
                }
            }
        }
    }

    let drain_budget = Duration::from_millis(config.post_stop_ms + 1_000);
    let (stdout_bytes, stdout_drained, stdout_error) =
        finish_drain(stdout_task, drain_budget, "stdout").await;
    let (stderr_bytes, stderr_drained, stderr_error) =
        finish_drain(stderr_task, drain_budget, "stderr").await;
    if let Some(error) = stdout_error {
        observation_errors.push(error);
    }
    if let Some(error) = stderr_error {
        observation_errors.push(error);
    }

    let baseline_control = file_len(&control_file, &mut observation_errors);
    let baseline_marker = file_len(&marker_file, &mut observation_errors);
    let (members_after, observed_late_write) = observe_window(
        &group,
        &control_file,
        &marker_file,
        baseline_control,
        baseline_marker,
        Duration::from_millis(config.post_stop_ms),
        Duration::from_millis(config.sample_ms),
        &mut observation_errors,
    )
    .await;

    let (fixture_pids, control_parse_complete) = parse_fixture_pids(&control_file);
    if !control_parse_complete {
        observation_errors.push("control JSONL was missing or not completely parseable".to_owned());
    }

    Ok(HostileProbeSummary {
        schema: "processkit-hostile-probe-v0",
        scenario_id,
        seed: config.seed,
        repetition: config.repetition,
        platform: std::env::consts::OS,
        architecture: std::env::consts::ARCH,
        processkit_version: PROCESSKIT_VERSION,
        actual_mechanism,
        trigger: config.trigger.name(),
        root_pid,
        members_before,
        members_after,
        fixture_pids,
        stdout_bytes,
        stderr_bytes,
        stdout_drained,
        stderr_drained,
        teardown_error: if teardown_errors.is_empty() {
            None
        } else {
            Some(teardown_errors.join("; "))
        },
        observation_window_complete: true,
        observer_complete: false,
        control_parse_complete,
        observed_late_write,
        physical_verdict: PHYSICAL_VERDICT,
        observation_errors,
    })
}

fn required_path(values: &mut BTreeMap<String, OsString>, key: &str) -> Result<PathBuf, String> {
    values
        .remove(key)
        .map(PathBuf::from)
        .ok_or_else(|| format!("--{key} is required"))
}

fn required_string(values: &mut BTreeMap<String, OsString>, key: &str) -> Result<String, String> {
    let value = values
        .remove(key)
        .ok_or_else(|| format!("--{key} is required"))?;
    value
        .into_string()
        .map_err(|_| format!("--{key} must be UTF-8"))
}

fn required_u64(values: &mut BTreeMap<String, OsString>, key: &str) -> Result<u64, String> {
    required_string(values, key)?
        .parse::<u64>()
        .map_err(|_| format!("--{key} must be an unsigned integer"))
}

fn required_u32(values: &mut BTreeMap<String, OsString>, key: &str) -> Result<u32, String> {
    required_string(values, key)?
        .parse::<u32>()
        .map_err(|_| format!("--{key} must be a 32-bit unsigned integer"))
}

fn prepare_empty_root(root: &Path) -> Result<(), String> {
    fs::create_dir_all(root)
        .map_err(|error| format!("create disposable root {}: {error}", root.display()))?;
    let mut entries = fs::read_dir(root)
        .map_err(|error| format!("read disposable root {}: {error}", root.display()))?;
    if entries.next().is_some() {
        return Err(format!(
            "--root must be empty before a hostile probe: {}",
            root.display()
        ));
    }
    Ok(())
}

fn write_effective_scenario(config: &HostileProbeConfig) -> Result<PathBuf, String> {
    let source = fs::read_to_string(&config.scenario)
        .map_err(|error| format!("read scenario {}: {error}", config.scenario.display()))?;
    let mut document: Value =
        serde_json::from_str(&source).map_err(|error| format!("parse scenario JSON: {error}"))?;
    let scenario = document
        .get_mut("hostile_process_v0")
        .and_then(Value::as_object_mut)
        .ok_or_else(|| "scenario must contain hostile_process_v0 object".to_owned())?;
    scenario.insert("seed".to_owned(), json!(config.seed));
    let destination = config.root.join("effective-scenario.json");
    let encoded = serde_json::to_vec_pretty(&document)
        .map_err(|error| format!("serialize effective scenario: {error}"))?;
    fs::write(&destination, encoded)
        .map_err(|error| format!("write effective scenario: {error}"))?;
    Ok(destination)
}

async fn drain_reader<R>(mut reader: R) -> io::Result<u64>
where
    R: AsyncRead + Unpin,
{
    let mut total = 0_u64;
    let mut buffer = [0_u8; 8 * 1024];
    loop {
        let count = reader.read(&mut buffer).await?;
        if count == 0 {
            return Ok(total);
        }
        total += count as u64;
    }
}

async fn finish_drain(
    mut task: JoinHandle<io::Result<u64>>,
    budget: Duration,
    stream: &str,
) -> (u64, bool, Option<String>) {
    match time::timeout(budget, &mut task).await {
        Ok(Ok(Ok(bytes))) => (bytes, true, None),
        Ok(Ok(Err(error))) => (0, false, Some(format!("{stream} drain I/O error: {error}"))),
        Ok(Err(error)) => (
            0,
            false,
            Some(format!("{stream} drain task failed: {error}")),
        ),
        Err(_) => {
            task.abort();
            (
                0,
                false,
                Some(format!("{stream} did not drain within {budget:?}")),
            )
        }
    }
}

fn read_members(group: &ProcessGroup, label: &str, errors: &mut Vec<String>) -> Vec<u32> {
    match group.members() {
        Ok(mut members) => {
            members.sort_unstable();
            members
        }
        Err(error) => {
            errors.push(format!("{label}: {error}"));
            Vec::new()
        }
    }
}

async fn reap_root(child: &mut Child, group: &ProcessGroup, errors: &mut Vec<String>) {
    match time::timeout(Duration::from_secs(5), child.wait()).await {
        Ok(Ok(_status)) => return,
        Ok(Err(error)) => errors.push(format!("root wait after teardown: {error}")),
        Err(_) => errors.push("root did not exit within 5 seconds after teardown".to_owned()),
    }

    if let Err(error) = group.kill_all() {
        errors.push(format!("second kill_all: {error}"));
    }
    if let Err(error) = child.start_kill() {
        errors.push(format!("direct root cleanup start_kill: {error}"));
    }
    match time::timeout(Duration::from_secs(2), child.wait()).await {
        Ok(Ok(_status)) => {}
        Ok(Err(error)) => errors.push(format!("root cleanup wait: {error}")),
        Err(_) => errors.push("root cleanup wait exceeded 2 seconds".to_owned()),
    }
}

fn file_len(path: &Path, errors: &mut Vec<String>) -> u64 {
    match fs::metadata(path) {
        Ok(metadata) => metadata.len(),
        Err(error) if error.kind() == io::ErrorKind::NotFound => 0,
        Err(error) => {
            errors.push(format!("metadata {}: {error}", path.display()));
            0
        }
    }
}

#[allow(clippy::too_many_arguments)]
async fn observe_window(
    group: &ProcessGroup,
    control_file: &Path,
    marker_file: &Path,
    baseline_control: u64,
    baseline_marker: u64,
    duration: Duration,
    sample: Duration,
    errors: &mut Vec<String>,
) -> (Vec<u32>, bool) {
    let deadline = Instant::now() + duration;
    let mut last_members = Vec::new();
    let mut observed_late_write = false;

    while Instant::now() < deadline {
        let remaining = deadline.saturating_duration_since(Instant::now());
        time::sleep(std::cmp::min(sample, remaining)).await;
        last_members = read_members(group, "post-stop members", errors);
        let control_len = file_len(control_file, errors);
        let marker_len = file_len(marker_file, errors);
        if control_len > baseline_control || marker_len > baseline_marker {
            observed_late_write = true;
        }
    }

    (last_members, observed_late_write)
}

fn parse_fixture_pids(control_file: &Path) -> (Vec<u32>, bool) {
    let content = match fs::read_to_string(control_file) {
        Ok(content) => content,
        Err(_) => return (Vec::new(), false),
    };
    let mut pids = BTreeSet::new();
    let mut complete = true;
    for line in content.lines().filter(|line| !line.trim().is_empty()) {
        match serde_json::from_str::<Value>(line) {
            Ok(value) => match value.get("pid").and_then(Value::as_u64) {
                Some(pid) if u32::try_from(pid).is_ok() => {
                    pids.insert(pid as u32);
                }
                _ => complete = false,
            },
            Err(_) => complete = false,
        }
    }
    (pids.into_iter().collect(), complete)
}
