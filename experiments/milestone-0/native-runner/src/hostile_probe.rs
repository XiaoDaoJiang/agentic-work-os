use std::collections::{BTreeMap, BTreeSet};
use std::ffi::OsString;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::{Duration, Instant};

use processkit::{ProcessGroup, process_info, process_is_alive};
use serde::Serialize;
use serde_json::{Value, json};
use tokio::io::{AsyncRead, AsyncReadExt};
use tokio::process::Child;
use tokio::task::JoinHandle;
use tokio::time;

use crate::hostile_evidence::{
    HostileEvidence, HostileVerdict, evaluate_physical_verdict, record_cleanup_outcome,
};

const PROCESSKIT_VERSION: &str = "3.3.4";
const FILE_FINGERPRINT_ALGORITHM: &str = "size+fnv1a64";

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
    pub survivor_pids: Vec<u32>,
    pub stdout_bytes: u64,
    pub stderr_bytes: u64,
    pub stdout_drained: bool,
    pub stderr_drained: bool,
    pub teardown_error: Option<String>,
    pub observation_window_complete: bool,
    pub observer_complete: bool,
    pub control_parse_complete: bool,
    pub file_fingerprint_algorithm: &'static str,
    pub observed_late_write: bool,
    pub physical_verdict: &'static str,
    pub cleanup_succeeded: bool,
    pub observation_errors: Vec<String>,
    pub cleanup_errors: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct PidAnchor {
    pid: u32,
    start_time: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum IdentityState {
    Anchored(PidAnchor),
    Gone,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct FileFingerprint {
    exists: bool,
    size: u64,
    fnv1a64: u64,
}

#[derive(Debug)]
struct ControlSnapshot {
    pids: BTreeSet<u32>,
    complete: bool,
}

struct ObservationOutcome {
    members_after: Vec<u32>,
    survivor_pids: Vec<u32>,
    observed_late_write: bool,
    observer_complete: bool,
    control_parse_complete: bool,
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
    let root_pid_value =
        root_pid.ok_or_else(|| "spawned hostile fixture did not expose a root pid".to_owned())?;
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
    let mut fixture_pids = BTreeSet::from([root_pid_value]);
    let mut identities = BTreeMap::new();
    try_resolve_identity(root_pid_value, false, &mut identities);
    let members_before;

    match config.trigger {
        Trigger::Cancel | Trigger::Timeout => {
            discover_until_deadline(
                &control_file,
                &mut fixture_pids,
                &mut identities,
                Duration::from_millis(config.trigger_ms),
                Duration::from_millis(config.sample_ms),
            )
            .await;
            members_before = read_members(&group, "members_before", &mut observation_errors);
            if let Err(error) = group.kill_all() {
                teardown_errors.push(format!("kill_all: {error}"));
            }
            reap_root(&mut child, &group, &mut teardown_errors).await;
        }
        Trigger::Natural => {
            members_before = read_members(&group, "members_before", &mut observation_errors);
            let exited = wait_for_natural_exit(
                &mut child,
                &control_file,
                &mut fixture_pids,
                &mut identities,
                Duration::from_millis(config.trigger_ms),
                Duration::from_millis(config.sample_ms),
            )
            .await;
            if !exited {
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

    best_effort_discover_control(&control_file, &mut fixture_pids, &mut identities, true);
    let baseline_control = fingerprint_file(&control_file, &mut observation_errors);
    let baseline_marker = fingerprint_file(&marker_file, &mut observation_errors);
    let fingerprint_ready = baseline_control.is_some() && baseline_marker.is_some();

    let observation = observe_window(
        &group,
        &control_file,
        &marker_file,
        baseline_control,
        baseline_marker,
        &mut fixture_pids,
        &mut identities,
        Duration::from_millis(config.post_stop_ms),
        Duration::from_millis(config.sample_ms),
        &mut observation_errors,
    )
    .await;
    let observer_complete = fingerprint_ready && observation.observer_complete;
    let control_parse_complete = observation.control_parse_complete;

    let teardown_error = if teardown_errors.is_empty() {
        None
    } else {
        Some(teardown_errors.join("; "))
    };
    let mut evidence = HostileEvidence {
        scenario_id: scenario_id.clone(),
        seed: config.seed,
        repetition: config.repetition,
        platform: std::env::consts::OS.to_owned(),
        architecture: std::env::consts::ARCH.to_owned(),
        processkit_version: PROCESSKIT_VERSION.to_owned(),
        actual_mechanism: actual_mechanism.clone(),
        trigger: config.trigger.name().to_owned(),
        root_pid,
        members_before: members_before.clone(),
        members_after: observation.members_after.clone(),
        fixture_pids: fixture_pids.iter().copied().collect(),
        survivor_pids: observation.survivor_pids.clone(),
        stdout_bytes,
        stderr_bytes,
        stdout_drained,
        stderr_drained,
        teardown_error: teardown_error.clone(),
        observer_complete,
        observed_late_write: observation.observed_late_write,
        cleanup_succeeded: None,
        verdict_reasons: Vec::new(),
    };

    let physical_verdict = evaluate_physical_verdict(&evidence);
    let physical_verdict_name = verdict_name(physical_verdict);
    let anchors = anchored_identities(&identities);
    let (cleanup_succeeded, cleanup_errors) = cleanup_survivors(
        &observation.survivor_pids,
        &anchors,
        Duration::from_secs(3),
        Duration::from_millis(config.sample_ms),
    )
    .await;
    record_cleanup_outcome(&mut evidence, cleanup_succeeded);

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
        members_after: observation.members_after,
        fixture_pids: fixture_pids.into_iter().collect(),
        survivor_pids: observation.survivor_pids,
        stdout_bytes,
        stderr_bytes,
        stdout_drained,
        stderr_drained,
        teardown_error,
        observation_window_complete: true,
        observer_complete,
        control_parse_complete,
        file_fingerprint_algorithm: FILE_FINGERPRINT_ALGORITHM,
        observed_late_write: observation.observed_late_write,
        physical_verdict: physical_verdict_name,
        cleanup_succeeded,
        observation_errors,
        cleanup_errors,
    })
}

fn verdict_name(verdict: HostileVerdict) -> &'static str {
    match verdict {
        HostileVerdict::Pass => "PASS",
        HostileVerdict::Fail => "FAIL",
        HostileVerdict::Inconclusive => "INCONCLUSIVE",
    }
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

async fn discover_until_deadline(
    control_file: &Path,
    fixture_pids: &mut BTreeSet<u32>,
    identities: &mut BTreeMap<u32, IdentityState>,
    duration: Duration,
    sample: Duration,
) {
    let deadline = Instant::now() + duration;
    loop {
        best_effort_discover_control(control_file, fixture_pids, identities, false);
        if Instant::now() >= deadline {
            return;
        }
        let remaining = deadline.saturating_duration_since(Instant::now());
        time::sleep(std::cmp::min(sample, remaining)).await;
    }
}

async fn wait_for_natural_exit(
    child: &mut Child,
    control_file: &Path,
    fixture_pids: &mut BTreeSet<u32>,
    identities: &mut BTreeMap<u32, IdentityState>,
    duration: Duration,
    sample: Duration,
) -> bool {
    let deadline = Instant::now() + duration;
    loop {
        best_effort_discover_control(control_file, fixture_pids, identities, false);
        match child.try_wait() {
            Ok(Some(_status)) => return true,
            Ok(None) => {}
            Err(_) => return false,
        }
        if Instant::now() >= deadline {
            return false;
        }
        let remaining = deadline.saturating_duration_since(Instant::now());
        time::sleep(std::cmp::min(sample, remaining)).await;
    }
}

fn best_effort_discover_control(
    control_file: &Path,
    fixture_pids: &mut BTreeSet<u32>,
    identities: &mut BTreeMap<u32, IdentityState>,
    allow_gone: bool,
) {
    let Ok(snapshot) = read_control_snapshot(control_file, false) else {
        return;
    };
    for pid in snapshot.pids {
        fixture_pids.insert(pid);
        try_resolve_identity(pid, allow_gone, identities);
    }
}

fn strict_finalize_control(
    control_file: &Path,
    fixture_pids: &mut BTreeSet<u32>,
    identities: &mut BTreeMap<u32, IdentityState>,
    errors: &mut Vec<String>,
) -> bool {
    let snapshot = match read_control_snapshot(control_file, true) {
        Ok(snapshot) => snapshot,
        Err(error) => {
            errors.push(error);
            return false;
        }
    };
    for pid in snapshot.pids {
        fixture_pids.insert(pid);
        if let std::collections::btree_map::Entry::Vacant(entry) = identities.entry(pid) {
            match resolve_identity(pid, true) {
                Ok(Some(state)) => {
                    entry.insert(state);
                }
                Ok(None) => {}
                Err(error) => errors.push(error),
            }
        }
    }
    if !snapshot.complete {
        errors
            .push("final control JSONL is missing, truncated, malformed, or lacks pid".to_owned());
    }
    snapshot.complete && fixture_pids.iter().all(|pid| identities.contains_key(pid))
}

fn read_control_snapshot(path: &Path, strict: bool) -> Result<ControlSnapshot, String> {
    let content = match fs::read_to_string(path) {
        Ok(content) => content,
        Err(error) if error.kind() == io::ErrorKind::NotFound && !strict => {
            return Ok(ControlSnapshot {
                pids: BTreeSet::new(),
                complete: false,
            });
        }
        Err(error) => return Err(format!("read control JSONL {}: {error}", path.display())),
    };

    let has_partial_tail = !content.is_empty() && !content.ends_with('\n');
    let parse_end = if has_partial_tail {
        content.rfind('\n').map_or(0, |index| index + 1)
    } else {
        content.len()
    };
    let mut pids = BTreeSet::new();
    let mut complete = !has_partial_tail;

    for line in content[..parse_end]
        .lines()
        .filter(|line| !line.trim().is_empty())
    {
        let value = match serde_json::from_str::<Value>(line) {
            Ok(value) => value,
            Err(_) => {
                complete = false;
                continue;
            }
        };
        match value.get("pid").and_then(Value::as_u64) {
            Some(pid) if u32::try_from(pid).is_ok() => {
                pids.insert(pid as u32);
            }
            _ => complete = false,
        }
    }

    Ok(ControlSnapshot { pids, complete })
}

fn try_resolve_identity(pid: u32, allow_gone: bool, identities: &mut BTreeMap<u32, IdentityState>) {
    if identities.contains_key(&pid) {
        return;
    }
    if let Ok(Some(state)) = resolve_identity(pid, allow_gone) {
        identities.insert(pid, state);
    }
}

fn resolve_identity(pid: u32, allow_gone: bool) -> Result<Option<IdentityState>, String> {
    match process_info(pid) {
        Ok(Some(info)) => match info.start_time() {
            Some(start_time) => Ok(Some(IdentityState::Anchored(PidAnchor { pid, start_time }))),
            None => Err(format!(
                "process_info({pid}) did not provide a reuse-safe start time"
            )),
        },
        Ok(None) if allow_gone => Ok(Some(IdentityState::Gone)),
        Ok(None) => Ok(None),
        Err(error) => Err(format!("process_info({pid}): {error}")),
    }
}

fn anchored_identities(identities: &BTreeMap<u32, IdentityState>) -> BTreeMap<u32, PidAnchor> {
    identities
        .iter()
        .filter_map(|(pid, state)| match state {
            IdentityState::Anchored(anchor) => Some((*pid, *anchor)),
            IdentityState::Gone => None,
        })
        .collect()
}

fn fingerprint_file(path: &Path, errors: &mut Vec<String>) -> Option<FileFingerprint> {
    match fs::read(path) {
        Ok(bytes) => Some(FileFingerprint {
            exists: true,
            size: bytes.len() as u64,
            fnv1a64: fnv1a64(&bytes),
        }),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Some(FileFingerprint {
            exists: false,
            size: 0,
            fnv1a64: fnv1a64(&[]),
        }),
        Err(error) => {
            errors.push(format!("fingerprint {}: {error}", path.display()));
            None
        }
    }
}

fn fnv1a64(bytes: &[u8]) -> u64 {
    let mut hash = 0xcbf29ce484222325_u64;
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}

#[allow(clippy::too_many_arguments)]
async fn observe_window(
    group: &ProcessGroup,
    control_file: &Path,
    marker_file: &Path,
    baseline_control: Option<FileFingerprint>,
    baseline_marker: Option<FileFingerprint>,
    fixture_pids: &mut BTreeSet<u32>,
    identities: &mut BTreeMap<u32, IdentityState>,
    duration: Duration,
    sample: Duration,
    errors: &mut Vec<String>,
) -> ObservationOutcome {
    let deadline = Instant::now() + duration;
    let mut observed_members = BTreeSet::new();
    let mut survivor_pids = BTreeSet::new();
    let mut observed_late_write = false;
    let mut liveness_complete = true;
    let mut fingerprint_complete = true;

    loop {
        best_effort_discover_control(control_file, fixture_pids, identities, true);
        observed_members.extend(read_members(group, "post-stop members", errors));
        sample_pid_liveness(
            identities,
            &mut survivor_pids,
            errors,
            &mut liveness_complete,
        );
        compare_file_fingerprint(
            control_file,
            baseline_control,
            errors,
            &mut fingerprint_complete,
            &mut observed_late_write,
        );
        compare_file_fingerprint(
            marker_file,
            baseline_marker,
            errors,
            &mut fingerprint_complete,
            &mut observed_late_write,
        );

        if Instant::now() >= deadline {
            break;
        }
        let remaining = deadline.saturating_duration_since(Instant::now());
        time::sleep(std::cmp::min(sample, remaining)).await;
    }

    let control_parse_complete =
        strict_finalize_control(control_file, fixture_pids, identities, errors);
    sample_pid_liveness(
        identities,
        &mut survivor_pids,
        errors,
        &mut liveness_complete,
    );
    let identity_complete = fixture_pids.iter().all(|pid| identities.contains_key(pid));

    ObservationOutcome {
        members_after: observed_members.into_iter().collect(),
        survivor_pids: survivor_pids.into_iter().collect(),
        observed_late_write,
        observer_complete: control_parse_complete
            && identity_complete
            && liveness_complete
            && fingerprint_complete,
        control_parse_complete,
    }
}

fn sample_pid_liveness(
    identities: &BTreeMap<u32, IdentityState>,
    survivors: &mut BTreeSet<u32>,
    errors: &mut Vec<String>,
    complete: &mut bool,
) {
    for state in identities.values() {
        let IdentityState::Anchored(anchor) = state else {
            continue;
        };
        match process_is_alive(anchor.pid, Some(anchor.start_time)) {
            Ok(true) => {
                survivors.insert(anchor.pid);
            }
            Ok(false) => {}
            Err(error) => {
                errors.push(format!(
                    "process_is_alive({}, {}): {error}",
                    anchor.pid, anchor.start_time
                ));
                *complete = false;
            }
        }
    }
}

fn compare_file_fingerprint(
    path: &Path,
    baseline: Option<FileFingerprint>,
    errors: &mut Vec<String>,
    complete: &mut bool,
    observed_late_write: &mut bool,
) {
    let current = fingerprint_file(path, errors);
    match (baseline, current) {
        (Some(expected), Some(actual)) => {
            if actual != expected {
                *observed_late_write = true;
            }
        }
        _ => *complete = false,
    }
}

async fn cleanup_survivors(
    survivor_pids: &[u32],
    anchors: &BTreeMap<u32, PidAnchor>,
    timeout: Duration,
    sample: Duration,
) -> (bool, Vec<String>) {
    if survivor_pids.is_empty() {
        return (true, Vec::new());
    }

    let mut errors = Vec::new();
    let cleanup_group = match ProcessGroup::new() {
        Ok(group) => group,
        Err(error) => {
            return (false, vec![format!("create cleanup ProcessGroup: {error}")]);
        }
    };
    let mut adopted_any = false;

    for pid in survivor_pids {
        let Some(anchor) = anchors.get(pid) else {
            errors.push(format!("survivor {pid} has no reuse-safe identity anchor"));
            continue;
        };
        match process_is_alive(*pid, Some(anchor.start_time)) {
            Ok(false) => {}
            Ok(true) => match cleanup_group.adopt_external(*pid) {
                Ok(()) => adopted_any = true,
                Err(error) => errors.push(format!("cleanup adopt_external({pid}): {error}")),
            },
            Err(error) => errors.push(format!(
                "cleanup liveness check ({pid}, {}): {error}",
                anchor.start_time
            )),
        }
    }

    if adopted_any {
        if let Err(error) = cleanup_group.kill_all() {
            errors.push(format!("cleanup kill_all: {error}"));
        }
    }

    let deadline = Instant::now() + timeout;
    loop {
        let mut any_alive = false;
        for pid in survivor_pids {
            let Some(anchor) = anchors.get(pid) else {
                any_alive = true;
                continue;
            };
            match process_is_alive(*pid, Some(anchor.start_time)) {
                Ok(true) => any_alive = true,
                Ok(false) => {}
                Err(error) => {
                    any_alive = true;
                    errors.push(format!(
                        "cleanup final liveness ({pid}, {}): {error}",
                        anchor.start_time
                    ));
                }
            }
        }
        if !any_alive {
            return (errors.is_empty(), errors);
        }
        if Instant::now() >= deadline {
            errors.push(format!(
                "cleanup survivors remained alive after {} ms",
                timeout.as_millis()
            ));
            return (false, errors);
        }
        time::sleep(sample).await;
    }
}

#[cfg(test)]
mod tests {
    use super::{ControlSnapshot, read_control_snapshot};
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_file(name: &str) -> std::path::PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock after epoch")
            .as_nanos();
        std::env::temp_dir().join(format!(
            "agentic-{name}-{}-{nonce}.jsonl",
            std::process::id()
        ))
    }

    #[test]
    fn discovery_ignores_only_a_partial_trailing_record_but_strict_final_rejects_it() {
        let path = temp_file("control-partial-tail");
        fs::write(&path, b"{\"pid\":11}\n{\"pid\":12").expect("write fixture");

        let ControlSnapshot { pids, complete } =
            read_control_snapshot(&path, false).expect("discovery snapshot");
        assert_eq!(pids.into_iter().collect::<Vec<_>>(), vec![11]);
        assert!(!complete);

        let strict = read_control_snapshot(&path, true).expect("strict snapshot");
        assert_eq!(strict.pids.into_iter().collect::<Vec<_>>(), vec![11]);
        assert!(!strict.complete);

        fs::remove_file(path).expect("remove fixture");
    }

    #[test]
    fn strict_final_accepts_only_complete_pid_bearing_jsonl() {
        let path = temp_file("control-complete");
        fs::write(&path, b"{\"pid\":11}\n{\"pid\":12}\n").expect("write fixture");

        let strict = read_control_snapshot(&path, true).expect("strict snapshot");
        assert_eq!(strict.pids.into_iter().collect::<Vec<_>>(), vec![11, 12]);
        assert!(strict.complete);

        fs::remove_file(path).expect("remove fixture");
    }
}
