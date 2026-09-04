#[cfg(not(target_os = "linux"))]
fn main() {
    eprintln!("linux-cgroup-active-state-diagnostic is supported only on Linux");
    std::process::exit(2);
}

#[cfg(target_os = "linux")]
mod linux {
    use std::collections::{BTreeMap, BTreeSet};
    use std::env;
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::process::Stdio;
    use std::time::{Duration, Instant};

    use agentic_native_runner::linux_process_truth::{
        LinuxProcessTruth, LinuxTruthVerdict, classify_linux_process_truth,
        observe_linux_process_truth,
    };
    use processkit::{ProcessGroup, process_info, process_is_alive};
    use serde::Serialize;
    use serde_json::{Value, json};
    use tokio::process::{Child, Command};
    use tokio::time;

    const REQUIRED_REPETITIONS: u32 = 50;
    const REQUIRED_TRIGGER_MS: u64 = 250;
    const REQUIRED_POST_STOP_MS: u64 = 750;
    const REQUIRED_SAMPLE_MS: u64 = 50;
    const READY_TIMEOUT_MS: u64 = 5_000;

    #[derive(Debug)]
    struct Config {
        node: PathBuf,
        fixture: PathBuf,
        scenario: PathBuf,
        output_dir: PathBuf,
        repetitions: u32,
        trigger_ms: u64,
        post_stop_ms: u64,
        sample_ms: u64,
    }

    #[derive(Debug, Clone, Serialize)]
    struct LinuxTruthSample {
        sample_index: u32,
        elapsed_after_kill_ms: u128,
        pid: u32,
        expected_start_time: u64,
        processkit_alive: Option<bool>,
        cgroup_member: bool,
        truth: LinuxProcessTruth,
        verdict: LinuxTruthVerdict,
    }

    #[derive(Debug, Clone, Serialize)]
    struct FinalPidTruth {
        pid: u32,
        expected_start_time: u64,
        processkit_alive: Option<bool>,
        cgroup_member: bool,
        truth: LinuxProcessTruth,
        verdict: LinuxTruthVerdict,
    }

    #[derive(Debug, Serialize)]
    struct RunRecord {
        schema: &'static str,
        repetition: u32,
        seed: u32,
        actual_mechanism: String,
        root_pid: u32,
        members_before_kill: Vec<u32>,
        kill_all_error: Option<String>,
        samples: Vec<LinuxTruthSample>,
        final_members_after_window: Vec<u32>,
        final_pid_truth: Vec<FinalPidTruth>,
        any_active_original_observed_after_kill: bool,
        any_zombie_original_observed_after_kill: bool,
        final_active_original_pids: Vec<u32>,
        final_zombie_original_pids: Vec<u32>,
        final_reused_pids: Vec<u32>,
        final_inconclusive_pids: Vec<u32>,
        cleanup_members_after: Vec<u32>,
        cleanup_complete: bool,
    }

    #[derive(Debug, Serialize)]
    struct DiagnosticSummary {
        schema: &'static str,
        repetitions: u32,
        seeds: &'static str,
        trigger_ms: u64,
        post_stop_ms: u64,
        sample_ms: u64,
        actual_mechanisms: Vec<String>,
        run_count_with_active_original_at_final_sample: usize,
        run_count_with_zombie_original_at_final_sample: usize,
        run_count_with_reused_pid_at_final_sample: usize,
        run_count_with_inconclusive_truth_at_final_sample: usize,
        run_count_with_nonempty_final_cgroup_membership: usize,
        run_count_with_any_active_original_observed_after_kill: usize,
        run_count_with_any_zombie_original_observed_after_kill: usize,
        run_count_with_cleanup_incomplete: usize,
        runs: Vec<RunRecord>,
    }

    pub async fn run() -> Result<(), String> {
        let config = parse_config()?;
        validate_config(&config)?;
        fs::create_dir_all(&config.output_dir)
            .map_err(|error| format!("create output directory: {error}"))?;

        let mut records = Vec::new();
        let mut mechanisms = BTreeSet::new();
        for repetition in 0..config.repetitions {
            let record = run_one(&config, repetition).await?;
            mechanisms.insert(record.actual_mechanism.clone());
            let run_path = config
                .output_dir
                .join("runs")
                .join(format!("r{repetition:03}"))
                .join("diagnostic.json");
            fs::write(
                &run_path,
                serde_json::to_vec_pretty(&record)
                    .map_err(|error| format!("serialize run record: {error}"))?,
            )
            .map_err(|error| format!("write {}: {error}", run_path.display()))?;
            records.push(record);
        }

        let summary = DiagnosticSummary {
            schema: "linux-cgroup-active-state-diagnostic-v0",
            repetitions: config.repetitions,
            seeds: "0..49",
            trigger_ms: config.trigger_ms,
            post_stop_ms: config.post_stop_ms,
            sample_ms: config.sample_ms,
            actual_mechanisms: mechanisms.into_iter().collect(),
            run_count_with_active_original_at_final_sample: records
                .iter()
                .filter(|record| !record.final_active_original_pids.is_empty())
                .count(),
            run_count_with_zombie_original_at_final_sample: records
                .iter()
                .filter(|record| !record.final_zombie_original_pids.is_empty())
                .count(),
            run_count_with_reused_pid_at_final_sample: records
                .iter()
                .filter(|record| !record.final_reused_pids.is_empty())
                .count(),
            run_count_with_inconclusive_truth_at_final_sample: records
                .iter()
                .filter(|record| !record.final_inconclusive_pids.is_empty())
                .count(),
            run_count_with_nonempty_final_cgroup_membership: records
                .iter()
                .filter(|record| !record.final_members_after_window.is_empty())
                .count(),
            run_count_with_any_active_original_observed_after_kill: records
                .iter()
                .filter(|record| record.any_active_original_observed_after_kill)
                .count(),
            run_count_with_any_zombie_original_observed_after_kill: records
                .iter()
                .filter(|record| record.any_zombie_original_observed_after_kill)
                .count(),
            run_count_with_cleanup_incomplete: records
                .iter()
                .filter(|record| !record.cleanup_complete)
                .count(),
            runs: records,
        };

        let summary_path = config.output_dir.join("summary.json");
        fs::write(
            &summary_path,
            serde_json::to_vec_pretty(&summary)
                .map_err(|error| format!("serialize summary: {error}"))?,
        )
        .map_err(|error| format!("write {}: {error}", summary_path.display()))?;

        println!(
            "{}",
            serde_json::to_string(&summary)
                .map_err(|error| format!("serialize stdout summary: {error}"))?
        );
        Ok(())
    }

    async fn run_one(config: &Config, repetition: u32) -> Result<RunRecord, String> {
        let run_dir = config
            .output_dir
            .join("runs")
            .join(format!("r{repetition:03}"));
        if run_dir.exists() {
            fs::remove_dir_all(&run_dir)
                .map_err(|error| format!("remove {}: {error}", run_dir.display()))?;
        }
        fs::create_dir_all(&run_dir)
            .map_err(|error| format!("create {}: {error}", run_dir.display()))?;

        let effective_scenario = write_effective_scenario(&config.scenario, &run_dir, repetition)?;
        let control_file = run_dir.join("control.jsonl");
        let marker_file = run_dir.join("marker.jsonl");

        let group = ProcessGroup::new().map_err(|error| format!("create ProcessGroup: {error}"))?;
        let mechanism = group.mechanism().name().to_owned();
        if mechanism != "cgroup_v2" {
            return Err(format!(
                "CgroupV2PreconditionError: expected cgroup_v2, got {mechanism}"
            ));
        }

        let mut command = Command::new(&config.node);
        command
            .arg(&config.fixture)
            .arg("--root")
            .arg(&run_dir)
            .arg("--scenario")
            .arg(&effective_scenario)
            .arg("--control-file")
            .arg(&control_file)
            .arg("--role")
            .arg("parent")
            .arg("--marker")
            .arg(&marker_file)
            .current_dir(&run_dir)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        let mut child = group
            .spawn(command)
            .map_err(|error| format!("spawn hostile fixture: {error}"))?;
        let root_pid = child
            .id()
            .ok_or_else(|| "spawned fixture did not expose root pid".to_owned())?;

        wait_for_root_started(&control_file, root_pid, Duration::from_millis(READY_TIMEOUT_MS)).await?;
        time::sleep(Duration::from_millis(config.trigger_ms)).await;

        let mut members_before = group
            .members()
            .map_err(|error| format!("members before kill: {error}"))?;
        members_before.sort_unstable();
        if members_before.is_empty() {
            return Err(format!(
                "diagnostic repetition {repetition} observed no cgroup members at trigger boundary"
            ));
        }

        let mut anchors = BTreeMap::<u32, u64>::new();
        anchor_pid(root_pid, &mut anchors);
        for pid in &members_before {
            anchor_pid(*pid, &mut anchors);
        }

        let kill_all_error = group.kill_all().err().map(|error| error.to_string());
        let _ = time::timeout(Duration::from_secs(2), child.wait()).await;
        let killed_at = Instant::now();
        let deadline = killed_at + Duration::from_millis(config.post_stop_ms);
        let mut samples = Vec::new();
        let mut sample_index = 0_u32;

        loop {
            let current_members = group
                .members()
                .map_err(|error| format!("sample cgroup members: {error}"))?;
            for pid in &current_members {
                anchor_pid(*pid, &mut anchors);
            }
            for (pid, start_time) in &anchors {
                let raw_alive = process_is_alive(*pid, Some(*start_time)).ok();
                let member = current_members.contains(pid);
                let truth = observe_linux_process_truth(
                    *pid,
                    Some(*start_time),
                    raw_alive,
                    Some(member),
                );
                let verdict = classify_linux_process_truth(&truth);
                samples.push(LinuxTruthSample {
                    sample_index,
                    elapsed_after_kill_ms: killed_at.elapsed().as_millis(),
                    pid: *pid,
                    expected_start_time: *start_time,
                    processkit_alive: raw_alive,
                    cgroup_member: member,
                    truth,
                    verdict,
                });
            }
            sample_index = sample_index.saturating_add(1);
            if Instant::now() >= deadline {
                break;
            }
            let remaining = deadline.saturating_duration_since(Instant::now());
            time::sleep(std::cmp::min(
                Duration::from_millis(config.sample_ms),
                remaining,
            ))
            .await;
        }

        let mut final_members = group
            .members()
            .map_err(|error| format!("final cgroup members: {error}"))?;
        final_members.sort_unstable();
        for pid in &final_members {
            anchor_pid(*pid, &mut anchors);
        }
        let final_member_set = final_members.iter().copied().collect::<BTreeSet<_>>();
        let mut final_pid_truth = Vec::new();
        for (pid, start_time) in &anchors {
            let raw_alive = process_is_alive(*pid, Some(*start_time)).ok();
            let member = final_member_set.contains(pid);
            let truth = observe_linux_process_truth(
                *pid,
                Some(*start_time),
                raw_alive,
                Some(member),
            );
            let verdict = classify_linux_process_truth(&truth);
            final_pid_truth.push(FinalPidTruth {
                pid: *pid,
                expected_start_time: *start_time,
                processkit_alive: raw_alive,
                cgroup_member: member,
                truth,
                verdict,
            });
        }

        let final_active_original_pids = final_pids(&final_pid_truth, LinuxTruthVerdict::ActiveOriginal);
        let final_zombie_original_pids = final_pids(&final_pid_truth, LinuxTruthVerdict::ZombieOriginal);
        let final_reused_pids = final_pids(&final_pid_truth, LinuxTruthVerdict::ReusedPid);
        let final_inconclusive_pids = final_pids(&final_pid_truth, LinuxTruthVerdict::Inconclusive);
        let any_active_original_observed_after_kill = samples
            .iter()
            .any(|sample| sample.verdict == LinuxTruthVerdict::ActiveOriginal);
        let any_zombie_original_observed_after_kill = samples
            .iter()
            .any(|sample| sample.verdict == LinuxTruthVerdict::ZombieOriginal);

        let _ = group.kill_all();
        let cleanup_deadline = Instant::now() + Duration::from_secs(3);
        let cleanup_members_after = loop {
            let mut members = group
                .members()
                .map_err(|error| format!("cleanup cgroup members: {error}"))?;
            members.sort_unstable();
            if members.is_empty() || Instant::now() >= cleanup_deadline {
                break members;
            }
            time::sleep(Duration::from_millis(config.sample_ms)).await;
        };
        let cleanup_complete = cleanup_members_after.is_empty();

        Ok(RunRecord {
            schema: "linux-cgroup-active-state-diagnostic-run-v0",
            repetition,
            seed: repetition,
            actual_mechanism: mechanism,
            root_pid,
            members_before_kill: members_before,
            kill_all_error,
            samples,
            final_members_after_window: final_members,
            final_pid_truth,
            any_active_original_observed_after_kill,
            any_zombie_original_observed_after_kill,
            final_active_original_pids,
            final_zombie_original_pids,
            final_reused_pids,
            final_inconclusive_pids,
            cleanup_members_after,
            cleanup_complete,
        })
    }

    fn final_pids(values: &[FinalPidTruth], verdict: LinuxTruthVerdict) -> Vec<u32> {
        values
            .iter()
            .filter(|value| value.verdict == verdict)
            .map(|value| value.pid)
            .collect()
    }

    fn anchor_pid(pid: u32, anchors: &mut BTreeMap<u32, u64>) {
        if anchors.contains_key(&pid) {
            return;
        }
        if let Ok(Some(info)) = process_info(pid) {
            if let Some(start_time) = info.start_time() {
                anchors.insert(pid, start_time);
            }
        }
    }

    fn write_effective_scenario(
        scenario_path: &Path,
        run_dir: &Path,
        seed: u32,
    ) -> Result<PathBuf, String> {
        let source = fs::read_to_string(scenario_path)
            .map_err(|error| format!("read scenario {}: {error}", scenario_path.display()))?;
        let mut document: Value = serde_json::from_str(&source)
            .map_err(|error| format!("parse scenario JSON: {error}"))?;
        let scenario = document
            .get_mut("hostile_process_v0")
            .and_then(Value::as_object_mut)
            .ok_or_else(|| "scenario must contain hostile_process_v0 object".to_owned())?;
        scenario.insert("seed".to_owned(), json!(seed));
        let destination = run_dir.join("effective-scenario.json");
        fs::write(
            &destination,
            serde_json::to_vec_pretty(&document)
                .map_err(|error| format!("serialize effective scenario: {error}"))?,
        )
        .map_err(|error| format!("write effective scenario: {error}"))?;
        Ok(destination)
    }

    async fn wait_for_root_started(
        control_file: &Path,
        root_pid: u32,
        timeout: Duration,
    ) -> Result<(), String> {
        let deadline = Instant::now() + timeout;
        loop {
            if control_contains_root_started(control_file, root_pid)? {
                return Ok(());
            }
            if Instant::now() >= deadline {
                return Err(format!(
                    "fixture.started for root pid {root_pid} was not observed within {} ms",
                    timeout.as_millis()
                ));
            }
            time::sleep(Duration::from_millis(25)).await;
        }
    }

    fn control_contains_root_started(path: &Path, root_pid: u32) -> Result<bool, String> {
        let content = match fs::read_to_string(path) {
            Ok(content) => content,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(false),
            Err(error) => return Err(format!("read {}: {error}", path.display())),
        };
        for line in content.lines().filter(|line| !line.trim().is_empty()) {
            let Ok(value) = serde_json::from_str::<Value>(line) else {
                continue;
            };
            if value.get("event").and_then(Value::as_str) == Some("fixture.started")
                && value.get("role").and_then(Value::as_str) == Some("parent")
                && value.get("pid").and_then(Value::as_u64) == Some(u64::from(root_pid))
            {
                return Ok(true);
            }
        }
        Ok(false)
    }

    fn parse_config() -> Result<Config, String> {
        let mut args = env::args_os().skip(1);
        let mut values = BTreeMap::<String, String>::new();
        while let Some(key) = args.next() {
            let key = key
                .into_string()
                .map_err(|_| "argument name must be UTF-8".to_owned())?;
            let value = args
                .next()
                .ok_or_else(|| format!("{key} requires a value"))?
                .into_string()
                .map_err(|_| format!("{key} value must be UTF-8"))?;
            if !key.starts_with("--") {
                return Err(format!("expected --name, got {key}"));
            }
            if values.insert(key, value).is_some() {
                return Err("duplicate diagnostic argument".to_owned());
            }
        }

        let take = |values: &mut BTreeMap<String, String>, key: &str| {
            values
                .remove(key)
                .ok_or_else(|| format!("{key} is required"))
        };
        let node = PathBuf::from(take(&mut values, "--node")?);
        let fixture = PathBuf::from(take(&mut values, "--fixture")?);
        let scenario = PathBuf::from(take(&mut values, "--scenario")?);
        let output_dir = PathBuf::from(take(&mut values, "--output-dir")?);
        let repetitions = take(&mut values, "--repetitions")?
            .parse::<u32>()
            .map_err(|_| "--repetitions must be u32".to_owned())?;
        let trigger_ms = take(&mut values, "--trigger-ms")?
            .parse::<u64>()
            .map_err(|_| "--trigger-ms must be u64".to_owned())?;
        let post_stop_ms = take(&mut values, "--post-stop-ms")?
            .parse::<u64>()
            .map_err(|_| "--post-stop-ms must be u64".to_owned())?;
        let sample_ms = take(&mut values, "--sample-ms")?
            .parse::<u64>()
            .map_err(|_| "--sample-ms must be u64".to_owned())?;
        if !values.is_empty() {
            return Err(format!("unknown arguments: {:?}", values.keys()));
        }
        Ok(Config {
            node,
            fixture,
            scenario,
            output_dir,
            repetitions,
            trigger_ms,
            post_stop_ms,
            sample_ms,
        })
    }

    fn validate_config(config: &Config) -> Result<(), String> {
        if config.repetitions != REQUIRED_REPETITIONS {
            return Err(format!(
                "--repetitions is frozen at {REQUIRED_REPETITIONS}"
            ));
        }
        if config.trigger_ms != REQUIRED_TRIGGER_MS {
            return Err(format!("--trigger-ms is frozen at {REQUIRED_TRIGGER_MS}"));
        }
        if config.post_stop_ms != REQUIRED_POST_STOP_MS {
            return Err(format!(
                "--post-stop-ms is frozen at {REQUIRED_POST_STOP_MS}"
            ));
        }
        if config.sample_ms != REQUIRED_SAMPLE_MS {
            return Err(format!("--sample-ms is frozen at {REQUIRED_SAMPLE_MS}"));
        }
        for (label, path) in [
            ("node", &config.node),
            ("fixture", &config.fixture),
            ("scenario", &config.scenario),
        ] {
            if !path.is_absolute() || !path.is_file() {
                return Err(format!("{label} must be an existing absolute file path"));
            }
        }
        if !config.output_dir.is_absolute() {
            return Err("--output-dir must be absolute".to_owned());
        }
        Ok(())
    }

    pub async fn main_linux() {
        if let Err(error) = run().await {
            eprintln!("LinuxCgroupActiveStateDiagnosticError: {error}");
            std::process::exit(1);
        }
    }
}

#[cfg(target_os = "linux")]
#[tokio::main(flavor = "multi_thread", worker_threads = 2)]
async fn main() {
    linux::main_linux().await;
}
