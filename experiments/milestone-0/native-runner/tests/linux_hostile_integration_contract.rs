use agentic_native_runner::hostile_probe::HostileProbeSummary;

#[allow(dead_code)]
fn require_parallel_linux_hostile_evidence(summary: HostileProbeSummary) {
    let HostileProbeSummary {
        // Historical/raw facts remain available and are not silently renamed.
        survivor_pids,
        members_after,

        // Prospective Linux facts must be explicit and parallel.
        members_observed_during_window,
        final_members_after_window,
        linux_truth_samples,
        final_active_original_pids,
        final_zombie_original_pids,
        final_reused_pids,
        linux_observer_inconclusive_pids,
        ..
    } = summary;

    let _ = (
        survivor_pids,
        members_after,
        members_observed_during_window,
        final_members_after_window,
        linux_truth_samples,
        final_active_original_pids,
        final_zombie_original_pids,
        final_reused_pids,
        linux_observer_inconclusive_pids,
    );
}

#[test]
fn hostile_summary_contract_keeps_raw_and_prospective_linux_facts_separate() {
    // The function body above is the compile-time contract: all historical and
    // prospective Linux fields must coexist on HostileProbeSummary. Keep an
    // explicit function reference here so this test remains intentional without
    // relying on a constant assertion that Clippy correctly rejects.
    let _contract: fn(HostileProbeSummary) = require_parallel_linux_hostile_evidence;
}
