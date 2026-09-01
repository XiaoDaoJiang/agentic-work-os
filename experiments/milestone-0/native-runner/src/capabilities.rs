use serde::Serialize;

pub const CAPABILITY_VERSION: &str = "runner-capabilities-v0";

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ProviderIdentity {
    pub name: String,
    pub version: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ProviderDetails {
    pub probe_kind: String,
    pub raw_mechanism: String,
    pub raw_soft_stop_scope: String,
    pub raw_parent_death_cleanup: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct RunnerCapabilities {
    pub capability_version: String,
    pub platform: String,
    pub architecture: String,
    pub mechanism: String,
    pub whole_tree_termination: bool,
    pub kill_on_owner_exit: bool,
    pub membership_observable: bool,
    pub soft_stop_scope: String,
    pub escape_resistance: String,
    pub separate_stdout_stderr: bool,
    pub interactive_stdin: bool,
    pub timeout: bool,
    pub provider: ProviderIdentity,
    pub provider_details: ProviderDetails,
}

fn map_platform(platform: &str) -> Result<&str, String> {
    match platform {
        "windows" | "linux" | "macos" | "freebsd" => Ok(platform),
        other => Err(format!("unsupported platform: {other}")),
    }
}

fn map_mechanism(platform: &str, mechanism: &str) -> Result<(&'static str, &'static str), String> {
    match (platform, mechanism) {
        ("windows", "job_object") => Ok(("windows_job_object", "strong")),
        ("linux", "cgroup_v2") => Ok(("linux_cgroup_v2", "strong")),
        ("linux" | "macos" | "freebsd", "process_group") => {
            Ok(("posix_process_group", "process_group"))
        }
        ("freebsd", "process_reaper") => Ok(("process_reaper", "strong")),
        (_, known @ ("job_object" | "cgroup_v2" | "process_group" | "process_reaper")) => {
            Err(format!("mechanism {known} is incompatible with platform {platform}"))
        }
        (_, other) => Err(format!("unsupported containment mechanism: {other}")),
    }
}

fn map_soft_stop_scope(scope: &str) -> Result<&'static str, String> {
    match scope {
        "whole_tree" => Ok("whole_tree"),
        "opt_in_members" => Ok("best_effort"),
        "none" => Ok("unsupported"),
        other => Err(format!("unsupported soft-stop scope: {other}")),
    }
}

fn map_parent_death_cleanup(cleanup: &str) -> Result<bool, String> {
    match cleanup {
        "whole_tree" => Ok(true),
        "direct_child_only" | "none" => Ok(false),
        other => Err(format!("unsupported parent-death cleanup: {other}")),
    }
}

pub fn build_capabilities(
    platform: &str,
    architecture: &str,
    mechanism: &str,
    soft_stop_scope: &str,
    parent_death_cleanup: &str,
    provider_version: &str,
) -> Result<RunnerCapabilities, String> {
    let platform = map_platform(platform)?;
    if architecture.is_empty() {
        return Err("architecture must not be empty".to_owned());
    }
    if provider_version.is_empty() {
        return Err("provider version must not be empty".to_owned());
    }
    let (mechanism_name, escape_resistance) = map_mechanism(platform, mechanism)?;
    let soft_stop_scope_name = map_soft_stop_scope(soft_stop_scope)?;
    let kill_on_owner_exit = map_parent_death_cleanup(parent_death_cleanup)?;

    Ok(RunnerCapabilities {
        capability_version: CAPABILITY_VERSION.to_owned(),
        platform: platform.to_owned(),
        architecture: architecture.to_owned(),
        mechanism: mechanism_name.to_owned(),
        whole_tree_termination: true,
        kill_on_owner_exit,
        membership_observable: true,
        soft_stop_scope: soft_stop_scope_name.to_owned(),
        escape_resistance: escape_resistance.to_owned(),
        separate_stdout_stderr: true,
        interactive_stdin: true,
        timeout: true,
        provider: ProviderIdentity {
            name: "processkit".to_owned(),
            version: provider_version.to_owned(),
        },
        provider_details: ProviderDetails {
            probe_kind: "spawn_free_preflight".to_owned(),
            raw_mechanism: mechanism.to_owned(),
            raw_soft_stop_scope: soft_stop_scope.to_owned(),
            raw_parent_death_cleanup: parent_death_cleanup.to_owned(),
        },
    })
}

pub fn detect_capabilities() -> Result<RunnerCapabilities, String> {
    let host = processkit::host_containment();
    build_capabilities(
        std::env::consts::OS,
        std::env::consts::ARCH,
        host.mechanism().name(),
        host.soft_stop_scope().name(),
        host.parent_death_cleanup().name(),
        host.crate_version(),
    )
}

#[cfg(test)]
mod tests {
    use super::build_capabilities;

    #[test]
    fn maps_windows_job_object_to_a_strong_profile() {
        let capabilities = build_capabilities(
            "windows",
            "x86_64",
            "job_object",
            "opt_in_members",
            "whole_tree",
            "3.3.4",
        )
        .expect("valid Windows profile");

        assert_eq!(capabilities.mechanism, "windows_job_object");
        assert_eq!(capabilities.soft_stop_scope, "best_effort");
        assert_eq!(capabilities.escape_resistance, "strong");
        assert!(capabilities.whole_tree_termination);
        assert!(capabilities.kill_on_owner_exit);
        assert!(capabilities.membership_observable);
    }

    #[test]
    fn maps_linux_cgroup_and_process_group_without_inflating_guarantees() {
        let cgroup = build_capabilities(
            "linux",
            "x86_64",
            "cgroup_v2",
            "whole_tree",
            "direct_child_only",
            "3.3.4",
        )
        .expect("valid cgroup profile");
        assert_eq!(cgroup.mechanism, "linux_cgroup_v2");
        assert_eq!(cgroup.escape_resistance, "strong");
        assert!(!cgroup.kill_on_owner_exit);

        let group = build_capabilities(
            "linux",
            "x86_64",
            "process_group",
            "whole_tree",
            "direct_child_only",
            "3.3.4",
        )
        .expect("valid process-group profile");
        assert_eq!(group.mechanism, "posix_process_group");
        assert_eq!(group.escape_resistance, "process_group");
        assert!(!group.kill_on_owner_exit);
    }

    #[test]
    fn maps_macos_process_group_and_unsupported_owner_cleanup_honestly() {
        let capabilities = build_capabilities(
            "macos",
            "aarch64",
            "process_group",
            "whole_tree",
            "none",
            "3.3.4",
        )
        .expect("valid macOS profile");

        assert_eq!(capabilities.platform, "macos");
        assert_eq!(capabilities.mechanism, "posix_process_group");
        assert_eq!(capabilities.escape_resistance, "process_group");
        assert!(!capabilities.kill_on_owner_exit);
    }

    #[test]
    fn rejects_unknown_or_impossible_host_reports_without_defaulting() {
        assert!(build_capabilities(
            "plan9",
            "x86_64",
            "process_group",
            "whole_tree",
            "none",
            "3.3.4",
        )
        .is_err());
        assert!(build_capabilities(
            "windows",
            "x86_64",
            "cgroup_v2",
            "whole_tree",
            "whole_tree",
            "3.3.4",
        )
        .is_err());
        assert!(build_capabilities(
            "linux",
            "x86_64",
            "future_mechanism",
            "whole_tree",
            "direct_child_only",
            "3.3.4",
        )
        .is_err());
        assert!(build_capabilities(
            "linux",
            "x86_64",
            "cgroup_v2",
            "future_scope",
            "direct_child_only",
            "3.3.4",
        )
        .is_err());
        assert!(build_capabilities(
            "linux",
            "x86_64",
            "cgroup_v2",
            "whole_tree",
            "future_cleanup",
            "3.3.4",
        )
        .is_err());
    }
}
