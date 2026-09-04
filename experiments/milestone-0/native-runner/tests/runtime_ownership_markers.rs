use std::collections::BTreeSet;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use agentic_native_runner::runtime_receipt::{
    ContainmentReceipt, RuntimeReceiptV0, WorkspaceReceipt, ownership_markers,
};
use serde_json::Value;

const PROBE_EXE: &str = env!("CARGO_BIN_EXE_hostile-probe");

fn resolve_node() -> PathBuf {
    let path = env::var_os("PATH").expect("PATH must exist for the ownership marker test");
    for directory in env::split_paths(&path) {
        for name in if cfg!(windows) {
            vec!["node.exe", "node.cmd", "node.bat"]
        } else {
            vec!["node"]
        } {
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
        "agentic-runtime-ownership-markers-{}-{nonce}",
        std::process::id()
    ))
}

fn sample_receipt(root: &Path) -> RuntimeReceiptV0 {
    RuntimeReceiptV0 {
        schema: "runtime-receipt-v0".to_owned(),
        runtime_instance_id: "runtime-own-02".to_owned(),
        run_id: "run-own-02".to_owned(),
        spawn_nonce: "nonce-own-02".to_owned(),
        root_pid: 1,
        process_identity: "fixture-root-placeholder".to_owned(),
        containment: ContainmentReceipt {
            mechanism: "runtime-test-boundary".to_owned(),
            boundary_id: "boundary-own-02".to_owned(),
        },
        workspace: WorkspaceReceipt {
            workspace_id: "workspace-own-02".to_owned(),
            repository_identity: "repo-marker-v1:own-02".to_owned(),
            canonical_path: root.to_string_lossy().into_owned(),
        },
        started_at: "2026-09-03T00:00:00Z".to_owned(),
        helper_revision: "own-02-test".to_owned(),
    }
}

#[test]
fn own_02_root_child_and_grandchild_inherit_receipt_markers() {
    let root = disposable_root();
    fs::create_dir_all(&root).expect("create disposable root");
    let milestone = milestone_root();
    let fixture = milestone.join("fixtures/hostile-process.mjs");
    let scenario = milestone.join("hostile-scenarios/tree-hang.json");
    let control_file = root.join("control.jsonl");
    let receipt = sample_receipt(&root);
    let markers = ownership_markers(&receipt);

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
            "300",
            "--post-stop-ms",
            "750",
            "--sample-ms",
            "50",
            "--seed",
            "7",
            "--repetition",
            "0",
            "--runtime-instance-id",
            markers.runtime_instance_id.as_str(),
            "--run-id",
            markers.run_id.as_str(),
            "--spawn-nonce",
            markers.spawn_nonce.as_str(),
        ])
        .output()
        .expect("hostile-probe must start");

    assert!(
        output.status.success(),
        "hostile-probe failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );

    let control = fs::read_to_string(&control_file).expect("control JSONL must remain available");
    let mut started_roles = BTreeSet::new();
    for line in control.lines().filter(|line| !line.trim().is_empty()) {
        let record: Value = serde_json::from_str(line).expect("control line must be JSON");
        if record.get("event").and_then(Value::as_str) != Some("fixture.started") {
            continue;
        }

        let role = record
            .get("role")
            .and_then(Value::as_str)
            .expect("fixture.started must include role");
        let ownership = record
            .get("ownership")
            .and_then(Value::as_object)
            .expect("fixture.started must expose non-secret ownership markers");

        assert_eq!(
            ownership.get("runtime_instance_id").and_then(Value::as_str),
            Some(markers.runtime_instance_id.as_str())
        );
        assert_eq!(
            ownership.get("run_id").and_then(Value::as_str),
            Some(markers.run_id.as_str())
        );
        assert_eq!(
            ownership.get("spawn_nonce").and_then(Value::as_str),
            Some(markers.spawn_nonce.as_str())
        );
        started_roles.insert(role.to_owned());
    }

    assert_eq!(
        started_roles,
        ["parent", "child", "grandchild"]
            .into_iter()
            .map(str::to_owned)
            .collect()
    );

    fs::remove_dir_all(&root).expect("remove disposable root");
}
