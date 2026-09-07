use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum MechanismObservability {
    RuntimeReported,
    ConfiguredOnly,
    ImplementationDefined,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum RuntimeCoupling {
    Tokio,
    SelectableStdOrTokio,
    ProjectOwned,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum MaintenanceRisk {
    EmergingDependency,
    EstablishedNicheDependency,
    HighProjectOwnedFfi,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderDisposition {
    UnderEvaluation,
    FallbackBaseline,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct ProviderCandidate {
    pub name: &'static str,
    pub version: &'static str,
    pub license: &'static str,
    pub mechanism_observability: MechanismObservability,
    pub windows_job_object: bool,
    pub linux_cgroup_v2: bool,
    pub posix_process_group: bool,
    pub membership_observable: bool,
    pub abrupt_owner_exit_cleanup_cross_platform: bool,
    pub integrated_streaming: bool,
    pub integrated_timeout_cancel: bool,
    pub runtime_coupling: RuntimeCoupling,
    pub maintenance_risk: MaintenanceRisk,
    pub disposition: ProviderDisposition,
}

const PROCESSKIT: ProviderCandidate = ProviderCandidate {
    name: "processkit",
    version: "3.3.4",
    license: "MIT",
    mechanism_observability: MechanismObservability::RuntimeReported,
    windows_job_object: true,
    linux_cgroup_v2: true,
    posix_process_group: true,
    membership_observable: true,
    abrupt_owner_exit_cleanup_cross_platform: false,
    integrated_streaming: true,
    integrated_timeout_cancel: true,
    runtime_coupling: RuntimeCoupling::Tokio,
    maintenance_risk: MaintenanceRisk::EmergingDependency,
    disposition: ProviderDisposition::UnderEvaluation,
};

const PROCESS_WRAP: ProviderCandidate = ProviderCandidate {
    name: "process-wrap",
    version: "10.0.0",
    license: "Apache-2.0 OR MIT",
    mechanism_observability: MechanismObservability::ConfiguredOnly,
    windows_job_object: true,
    linux_cgroup_v2: false,
    posix_process_group: true,
    membership_observable: false,
    abrupt_owner_exit_cleanup_cross_platform: false,
    integrated_streaming: false,
    integrated_timeout_cancel: false,
    runtime_coupling: RuntimeCoupling::SelectableStdOrTokio,
    maintenance_risk: MaintenanceRisk::EstablishedNicheDependency,
    disposition: ProviderDisposition::UnderEvaluation,
};

const DIRECT_OS: ProviderCandidate = ProviderCandidate {
    name: "direct-os",
    version: "project-owned",
    license: "project-owned",
    mechanism_observability: MechanismObservability::ImplementationDefined,
    windows_job_object: true,
    linux_cgroup_v2: true,
    posix_process_group: true,
    membership_observable: true,
    abrupt_owner_exit_cleanup_cross_platform: false,
    integrated_streaming: false,
    integrated_timeout_cancel: false,
    runtime_coupling: RuntimeCoupling::ProjectOwned,
    maintenance_risk: MaintenanceRisk::HighProjectOwnedFfi,
    disposition: ProviderDisposition::FallbackBaseline,
};

pub fn candidate_by_name(name: &str) -> Option<ProviderCandidate> {
    match name {
        "processkit" => Some(PROCESSKIT),
        "process-wrap" => Some(PROCESS_WRAP),
        "direct-os" => Some(DIRECT_OS),
        _ => None,
    }
}

pub fn candidates() -> [ProviderCandidate; 3] {
    [PROCESSKIT, PROCESS_WRAP, DIRECT_OS]
}
