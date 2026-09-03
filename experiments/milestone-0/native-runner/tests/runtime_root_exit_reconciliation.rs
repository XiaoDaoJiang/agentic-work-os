use std::collections::BTreeSet;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use agentic_native_runner::runtime_reconciliation::{
    ResourceTruth, RunSafety, RunSafetyFacts, evaluate_run_safety,
};
use serde_json::Value;

const PROBE_EXE: &str = env!("CARGO_BIN_EXE_hostile-probe");

fn resolve_node() -> PathBuf {
    let path = env::var_os("PATH").expect("PATH must exist for root-exit reconciliation test");
    for directory in env::split_paths(&path) {
        let names: &[&str] = if cfg!(windows) {
            &["node.exe", "node.cmd", "node.bat"]
        } else {
            &["node"]
        };
        for name in names {
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
        "agentic-runtime-root-exit-{}-{nonce}",
        std::process::id()
    ))
}

#[test]
fn own_03_root_natural_exit_with_live_descendants_requires_reconciliation() {
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
            "natural",
            "--trigger-ms",
            "2000",
            "--post-stop-ms",
            "750",
            "--sample-ms",
            "50",
            "--seed",
            "17",
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

    assert_eq!(summary.get("trigger").and_then(Value::as_str), Some("natural"));
    assert!(
        summary.get("teardown_error").is_some_and(Value::is_null),
        "natural root exit must complete without a harness teardown timeout"
    );

    let root_pid = summary
        .get("root_pid")
        .and_then(Value::as_u64)
        .expect("root pid must be recorded") as u32;
    let survivor_pids = summary
        .get("survivor_pids")
        .and_then(Value::as_array)
        .expect("raw survivor facts must be present")
        .iter()
        .filter_map(Value::as_u64)
        .map(|pid| pid as u32)
        .collect::<BTreeSet<_>>();
    let members_after = summary
        .get("members_after")
        .and_then(Value::as_array)
        .expect("boundary membership facts must be present")
        .iter()
        .filter_map(Value::as_u64)
        .map(|pid| pid as u32)
        .collect::<BTreeSet<_>>();

    assert!(
        !survivor_pids.contains(&root_pid),
        "the natural root must already be gone before reconciliation facts are evaluated"
    );

    let descendant_ids = survivor_pids
        .union(&members_after)
        .copied()
        .filter(|pid| *pid != root_pid)
        .collect::<BTreeSet<_>>();
    assert!(
        !descendant_ids.is_empty(),
        "root exit alone is insufficient evidence: at least one descendant must remain observed"
    );

    let facts = RunSafetyFacts {
        root: ResourceTruth::Gone,
        descendants: descendant_ids
            .iter()
            .map(|_| ResourceTruth::Active)
            .collect(),
        boundary_empty: Some(members_after.is_empty()),
        stdout_drained: summary
            .get("stdout_drained")
            .and_then(Value::as_bool)
            .expect("stdout drain fact"),
        stderr_drained: summary
            .get("stderr_drained")
            .and_then(Value::as_bool)
            .expect("stderr drain fact"),
    };

    assert_eq!(evaluate_run_safety(&facts), RunSafety::ReconciliationRequired);
    assert_ne!(
        summary.get("physical_verdict").and_then(Value::as_str),
        Some("PASS"),
        "a naturally exited root with observed descendants cannot be considered physically safe"
    );

    fs::remove_dir_all(&root).expect("remove disposable root");
}
