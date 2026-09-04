#![cfg(windows)]

use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use serde_json::Value;

const PROBE_EXE: &str = env!("CARGO_BIN_EXE_hostile-probe");

fn resolve_node() -> PathBuf {
    let path = env::var_os("PATH").expect("PATH must exist for the prospective observer test");
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
        "agentic-windows-observer-verdict-{}-{nonce}",
        std::process::id()
    ))
}

#[test]
fn terminated_original_processkit_false_positive_is_mismatch_not_physical_failure() {
    let root = disposable_root();
    fs::create_dir_all(&root).expect("create disposable root");
    let milestone = milestone_root();
    let fixture = milestone.join("fixtures/hostile-process.mjs");
    let scenario = milestone.join("hostile-scenarios/root-exit-detached.json");

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
            "250",
            "--post-stop-ms",
            "750",
            "--sample-ms",
            "50",
            "--seed",
            "1",
            "--repetition",
            "1",
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

    let raw_survivors = summary
        .get("survivor_pids")
        .and_then(Value::as_array)
        .expect("raw ProcessKit survivor facts must remain present");
    assert!(
        !raw_survivors.is_empty(),
        "frozen root-exit-detached case must expose the ProcessKit false-positive fact"
    );

    let executing = summary
        .get("executing_survivor_pids")
        .and_then(Value::as_array)
        .expect("prospective executing survivor classification must be emitted");
    assert!(executing.is_empty());

    let mismatches = summary
        .get("observer_mismatch_pids")
        .and_then(Value::as_array)
        .expect("prospective observer mismatch classification must be emitted");
    assert_eq!(mismatches, raw_survivors);

    let inconclusive = summary
        .get("observer_inconclusive_pids")
        .and_then(Value::as_array)
        .expect("prospective inconclusive classification must be emitted");
    assert!(inconclusive.is_empty());

    assert_eq!(
        summary.get("physical_verdict").and_then(Value::as_str),
        Some("PASS"),
        "terminated-but-still-queryable ProcessKit facts must not remain a physical survivor failure"
    );

    fs::remove_dir_all(&root).expect("remove disposable root");
}
