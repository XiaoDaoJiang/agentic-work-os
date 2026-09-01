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
