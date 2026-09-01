use containment_provider_eval::{candidate_by_name, MechanismObservability, ProviderDisposition};

#[test]
fn freezes_the_three_candidate_set_and_required_versions() {
    let processkit = candidate_by_name("processkit").expect("processkit candidate");
    assert_eq!(processkit.version, "3.3.4");
    assert_eq!(processkit.license, "MIT");
    assert_eq!(processkit.mechanism_observability, MechanismObservability::RuntimeReported);

    let process_wrap = candidate_by_name("process-wrap").expect("process-wrap candidate");
    assert_eq!(process_wrap.version, "10.0.0");
    assert_eq!(process_wrap.license, "Apache-2.0 OR MIT");
    assert_eq!(process_wrap.mechanism_observability, MechanismObservability::ConfiguredOnly);

    let direct = candidate_by_name("direct-os").expect("direct OS baseline");
    assert_eq!(direct.disposition, ProviderDisposition::FallbackBaseline);
}

#[test]
fn process_wrap_must_not_claim_linux_cgroup_or_abrupt_owner_cleanup() {
    let process_wrap = candidate_by_name("process-wrap").expect("process-wrap candidate");
    assert!(!process_wrap.linux_cgroup_v2);
    assert!(!process_wrap.abrupt_owner_exit_cleanup_cross_platform);
}

#[test]
fn selection_report_shape_is_machine_readable() {
    let processkit = candidate_by_name("processkit").expect("processkit candidate");
    let value = serde_json::to_value(processkit).expect("serialize candidate");
    for key in [
        "name",
        "version",
        "license",
        "mechanism_observability",
        "windows_job_object",
        "linux_cgroup_v2",
        "posix_process_group",
        "membership_observable",
        "integrated_streaming",
        "integrated_timeout_cancel",
        "runtime_coupling",
        "maintenance_risk",
        "disposition"
    ] {
        assert!(value.get(key).is_some(), "missing key {key}");
    }
}
