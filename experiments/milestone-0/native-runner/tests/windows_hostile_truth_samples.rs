#![cfg(windows)]

use std::collections::BTreeSet;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use serde_json::Value;

const PROBE_EXE: &str = env!("CARGO_BIN_EXE_hostile-probe");

fn resolve_node() -> PathBuf {
    let path = env::var_os("PATH").expect("PATH must exist for the diagnostic smoke test");
    for directory in env::split_paths(&path) {
        for name in ["node.exe", "node.cmd", "node.bat"] {
            let candidate = directory.join(name);
            if candidate.is_file() {
                return candidate
                    .canonicalize()
                    .expect("Node executable path must canonicalize");
            }
        }
    }
    panic!("Node executable was not found on PATH");
}

fn milestone_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("native-runner must live below milestone-0")
        .to_path_buf()
}

fn disposable_root() -> PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock after epoch")
        .as_nanos();
    env::temp_dir().join(format!(
        "agentic-windows-truth-smoke-{}-{nonce}",
        std::process::id()
    ))
}

#[test]
fn hostile_probe_reports_parallel_win32_truth_without_rewriting_physical_verdict() {
    let root = disposable_root();
    fs::create_dir_all(&root).expect("create disposable root");
    let milestone = milestone_root();
    let fixture = milestone.join("fixtures/hostile-process.mjs");
    let scenario = milestone.join("hostile-scenarios/late-output-hang.json");

    let output = Command::new(PROBE_EXE)
        .arg("--node")
        .arg(resolve_node())
        .arg("--fixture")
        .arg(&fixture)
        .arg("--scenario")
        .arg(&scenario)
        .arg("--root")
        .arg(&root)
        .args([
            "--trigger",
            "cancel",
            "--trigger-ms",
            "150",
            "--post-stop-ms",
            "750",
            "--sample-ms",
            "50",
            "--seed",
            "29",
            "--repetition",
            "0",
        ])
        .output()
        .expect("hostile-probe must start");

    assert!(
        output.status.success(),
        "hostile-probe failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    let stdout = String::from_utf8(output.stdout).expect("summary stdout must be UTF-8");
    let line = stdout
        .lines()
        .find(|line| !line.trim().is_empty())
        .expect("probe summary line");
    let summary: Value = serde_json::from_str(line).expect("summary must be JSON");

    assert!(
        summary
            .get("physical_verdict")
            .and_then(Value::as_str)
            .is_some(),
        "historical physical verdict must remain present"
    );
    assert!(
        summary
            .get("survivor_pids")
            .and_then(Value::as_array)
            .is_some(),
        "historical ProcessKit survivor facts must remain present"
    );

    let samples = summary
        .get("windows_truth_samples")
        .and_then(Value::as_array)
        .expect("Windows diagnostic samples must be emitted in parallel");
    assert!(
        !samples.is_empty(),
        "at least one anchored PID must be diagnosed"
    );

    let mut observation_sample_indices = BTreeSet::new();
    for sample in samples {
        assert!(sample.get("pid").and_then(Value::as_u64).is_some());
        assert!(
            sample
                .get("expected_creation_time")
                .and_then(Value::as_u64)
                .is_some()
        );
        assert!(
            sample
                .get("processkit_alive")
                .and_then(Value::as_bool)
                .is_some()
        );
        assert!(sample.get("job_member").and_then(Value::as_bool).is_some());
        assert!(
            sample.get("win32_truth_before_processkit").is_some(),
            "each tick must capture independent Win32 truth before ProcessKit liveness"
        );
        assert!(
            sample
                .get("truth_verdict_before_processkit")
                .and_then(Value::as_str)
                .is_some(),
            "each pre-ProcessKit Win32 observation must be classified"
        );
        assert!(sample.get("win32_truth").is_some());
        assert!(
            sample
                .get("truth_verdict")
                .and_then(Value::as_str)
                .is_some()
        );
        observation_sample_indices.insert(
            sample
                .get("observation_sample_index")
                .and_then(Value::as_u64)
                .expect("each Windows truth sample must identify its observation tick"),
        );
    }
    assert!(
        observation_sample_indices.len() >= 2,
        "Windows truth must be sampled on multiple ticks inside the observation window"
    );

    fs::remove_dir_all(&root).expect("remove disposable root");
}
