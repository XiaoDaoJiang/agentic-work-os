use std::time::Duration;

use agentic_native_runner::hostile_probe::{cleanup_survivors, observe_fixture_pids};

#[tokio::test]
async fn observer_samples_current_process_with_identity_aware_liveness() {
    let pid = std::process::id();
    let observation = observe_fixture_pids(
        &[pid],
        Duration::from_millis(100),
        Duration::from_millis(20),
    )
    .await;

    assert!(observation.complete, "observer window must complete");
    assert!(observation.errors.is_empty(), "unexpected observer errors: {:?}", observation.errors);
    assert!(observation.survivor_pids.contains(&pid));
    assert!(observation.samples.len() >= 2, "observer must take repeated samples");

    let identity = observation
        .identities
        .iter()
        .find(|identity| identity.pid == pid)
        .expect("current pid identity must be recorded");
    assert!(identity.initially_alive);
    assert_eq!(
        observation.degraded_identity_pids.contains(&pid),
        identity.start_time.is_none(),
        "missing start-time identity must be surfaced as degraded evidence"
    );
}

#[tokio::test]
async fn cleanup_refuses_zero_and_the_observer_process_before_touching_os() {
    let zero = cleanup_survivors(&[0]).await.expect_err("pid 0 must be rejected");
    assert!(zero.contains("PID 0"));

    let current = std::process::id();
    let own = cleanup_survivors(&[current])
        .await
        .expect_err("the observer process must never clean itself up");
    assert!(own.contains("current process"));
}
