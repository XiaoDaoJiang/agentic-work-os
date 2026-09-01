use std::process::Command;

use serde_json::Value;

const PROBE_EXE: &str = env!("CARGO_BIN_EXE_provider-probe");

fn run_probe(candidate: &str) -> Value {
    let output = Command::new(PROBE_EXE)
        .args(["--candidate", candidate])
        .output()
        .expect("provider-probe must start");
    assert!(
        output.status.success(),
        "probe {candidate} failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    let stdout = String::from_utf8(output.stdout).expect("probe stdout must be UTF-8");
    let lines: Vec<_> = stdout.lines().filter(|line| !line.trim().is_empty()).collect();
    assert_eq!(lines.len(), 1, "probe must emit exactly one JSON line");
    serde_json::from_str(lines[0]).expect("probe output must be JSON")
}

fn assert_common(value: &Value, candidate: &str) {
    assert_eq!(value["schema"], "containment-provider-probe-v0");
    assert_eq!(value["candidate"], candidate);
    assert!(value["candidate_version"].as_str().is_some());
    assert!(value["platform"].as_str().is_some());
    assert!(value["architecture"].as_str().is_some());
    assert!(value["probe_level"].as_str().is_some());
    assert!(value["mechanism_source"].as_str().is_some());
    assert!(value["mechanism"].as_str().is_some());
    assert!(value["spawn_attempted"].as_bool().is_some());
    assert!(value["spawn_ok"].as_bool().is_some());
    assert!(value["membership_observable"].as_bool().is_some());
    assert!(value["owner_exit_cleanup_scope"].as_str().is_some());
}

#[test]
fn processkit_probe_reports_the_host_mechanism_instead_of_guessing_from_platform() {
    let value = run_probe("processkit");
    assert_common(&value, "processkit");
    assert_eq!(value["candidate_version"], "3.3.4");
    assert_eq!(value["probe_level"], "host_preflight");
    assert_eq!(value["mechanism_source"], "runtime_reported");
    assert!(!value["mechanism"].as_str().unwrap().is_empty());
}

#[test]
fn process_wrap_probe_must_really_spawn_through_the_platform_wrapper() {
    let value = run_probe("process-wrap");
    assert_common(&value, "process-wrap");
    assert_eq!(value["candidate_version"], "10.0.0");
    assert_eq!(value["probe_level"], "configured_wrapper_spawn");
    assert_eq!(value["mechanism_source"], "configured_wrapper");
    assert_eq!(value["spawn_attempted"], true);
    assert_eq!(value["spawn_ok"], true);
    assert_eq!(value["membership_observable"], false);
}

#[test]
fn direct_os_probe_is_explicitly_a_primitive_baseline_not_a_provider() {
    let value = run_probe("direct-os");
    assert_common(&value, "direct-os");
    assert_eq!(value["candidate_version"], "project-owned");
    assert_eq!(value["probe_level"], "primitive_only");
    assert_eq!(value["mechanism_source"], "project_owned_primitive");
    assert_eq!(value["spawn_attempted"], false);
}
