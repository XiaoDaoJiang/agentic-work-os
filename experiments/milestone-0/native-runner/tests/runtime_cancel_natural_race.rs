use std::env;
use std::path::PathBuf;

use agentic_native_runner::r05_cancel_natural_race::{
    R05PhysicalWinner, R05RaceConfig, run_r05_race_once,
};

fn resolve_node() -> PathBuf {
    let path = env::var_os("PATH").expect("PATH must exist for R-05 test");
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
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("native-runner must be below milestone-0")
        .to_path_buf()
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn r05_driver_records_one_real_cancel_vs_natural_exit_race_without_inventing_business_state() {
    let root = milestone_root();
    let record = run_r05_race_once(R05RaceConfig {
        node: resolve_node(),
        fixture: root.join("fixtures/hostile-process.mjs"),
        scenario: root.join("hostile-scenarios/finite-tree-natural-exit.json"),
        seed: 0,
        repetition: 0,
        // Smoke timing only. The 50-run evidence delay/seed rule is frozen only after
        // calibration evidence is recorded; this test must not silently become that matrix.
        cancel_delay_ms: 150,
        post_stop_observation_ms: 750,
        sample_ms: 50,
    })
    .await
    .expect("one R-05 physical smoke race must execute");

    assert_eq!(record.schema, "r05-cancel-natural-race-v0");
    assert_eq!(record.seed, 0);
    assert_eq!(record.repetition, 0);
    assert!(!record.actual_mechanism.is_empty());
    assert!(record.root_pid > 0);
    assert!(record.cancel_requested_at_ms.is_some());
    assert!(matches!(
        record.physical_winner,
        R05PhysicalWinner::Natural | R05PhysicalWinner::Cancel
    ));

    // This driver owns physical race facts only. Business terminal uniqueness is checked
    // separately by feeding its terminal candidate through the existing RunnerEventReducer.
    assert_eq!(record.business_terminal_count, 1);
    assert!(record.stdout_drained);
    assert!(record.stderr_drained);
    assert!(record.observation_window_complete);
    assert!(record.final_members_after_window.is_empty());
    assert!(record.final_survivor_pids.is_empty());
    assert!(!record.observed_late_write);
    assert_eq!(record.post_terminal_output_frames, 0);
}
