use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use serde_json::Value;

const PROBE_EXE: &str = env!("CARGO_BIN_EXE_hostile-probe");

fn resolve_node() -> PathBuf {
    let path = env::var_os("PATH").expect("PATH must exist for the smoke test");
    #[cfg(windows)]
    let names = ["node.exe", "node.cmd", "node.bat"];
    #[cfg(not(windows))]
    let names = ["node"];

    for directory in env::split_paths(&path) {
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
        "agentic-processkit-hostile-smoke-{}-{nonce}",
        std::process::id()
    ))
}

#[test]
fn cancel_smoke_uses_independent_pid_observation_before_cleanup() {
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
    let lines: Vec<_> = stdout
        .lines()
        .filter(|line| !line.trim().is_empty())
        .collect();
    assert_eq!(
        lines.len(),
        1,
        "probe must emit exactly one summary JSON line"
    );

    let summary: Value = serde_json::from_str(lines[0]).expect("summary must be JSON");
    assert_eq!(summary["scenario_id"], "late-output-hang");
    assert!(
        summary["actual_mechanism"]
            .as_str()
            .is_some_and(|value| !value.is_empty()),
        "actual ProcessKit group mechanism is required"
    );
    assert!(
        summary["root_pid"].as_u64().is_some(),
        "root pid is required"
    );
    assert_eq!(summary["stdout_drained"], true);
    assert_eq!(summary["stderr_drained"], true);
    assert_eq!(summary["observation_window_complete"], true);
    assert_eq!(summary["observer_complete"], true);
    assert_eq!(summary["survivor_pids"], serde_json::json!([]));
    assert_eq!(summary["cleanup_succeeded"], true);
    assert_eq!(summary["physical_verdict"], "PASS");

    fs::remove_dir_all(&root).expect("remove disposable root");
}
