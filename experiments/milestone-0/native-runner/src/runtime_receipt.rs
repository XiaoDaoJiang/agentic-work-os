use serde::{Deserialize, Serialize};

pub const RUNTIME_RECEIPT_SCHEMA: &str = "runtime-receipt-v0";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ContainmentReceipt {
    pub mechanism: String,
    pub boundary_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct WorkspaceReceipt {
    pub workspace_id: String,
    pub repository_identity: String,
    pub canonical_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RuntimeReceiptV0 {
    pub schema: String,
    pub runtime_instance_id: String,
    pub run_id: String,
    pub spawn_nonce: String,
    pub root_pid: u32,
    pub process_identity: String,
    pub containment: ContainmentReceipt,
    pub workspace: WorkspaceReceipt,
    pub started_at: String,
    pub helper_revision: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct OwnershipMarkers {
    pub runtime_instance_id: String,
    pub run_id: String,
    pub spawn_nonce: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct OwnershipObservation {
    pub pid: u32,
    pub process_identity: Option<String>,
    pub markers: Option<OwnershipMarkers>,
    pub boundary_member: Option<bool>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum OwnershipVerdict {
    Owned,
    ReusedPid,
    MarkerMissing,
    MarkerConflict,
    BoundaryMismatch,
    Inconclusive,
}

pub fn validate_runtime_receipt(receipt: &RuntimeReceiptV0) -> Result<(), String> {
    if receipt.schema != RUNTIME_RECEIPT_SCHEMA {
        return Err(format!(
            "unsupported RuntimeReceipt schema: {}",
            receipt.schema
        ));
    }
    if receipt.root_pid == 0 {
        return Err("root_pid must be positive".to_owned());
    }

    for (name, value) in [
        ("runtime_instance_id", receipt.runtime_instance_id.as_str()),
        ("run_id", receipt.run_id.as_str()),
        ("spawn_nonce", receipt.spawn_nonce.as_str()),
        ("process_identity", receipt.process_identity.as_str()),
        (
            "containment.mechanism",
            receipt.containment.mechanism.as_str(),
        ),
        (
            "containment.boundary_id",
            receipt.containment.boundary_id.as_str(),
        ),
        (
            "workspace.workspace_id",
            receipt.workspace.workspace_id.as_str(),
        ),
        (
            "workspace.repository_identity",
            receipt.workspace.repository_identity.as_str(),
        ),
        (
            "workspace.canonical_path",
            receipt.workspace.canonical_path.as_str(),
        ),
        ("started_at", receipt.started_at.as_str()),
        ("helper_revision", receipt.helper_revision.as_str()),
    ] {
        if value.trim().is_empty() {
            return Err(format!("{name} must not be empty"));
        }
    }

    Ok(())
}

pub fn ownership_markers(receipt: &RuntimeReceiptV0) -> OwnershipMarkers {
    OwnershipMarkers {
        runtime_instance_id: receipt.runtime_instance_id.clone(),
        run_id: receipt.run_id.clone(),
        spawn_nonce: receipt.spawn_nonce.clone(),
    }
}

pub fn classify_ownership(
    receipt: &RuntimeReceiptV0,
    observation: &OwnershipObservation,
) -> OwnershipVerdict {
    if observation.pid != receipt.root_pid {
        return OwnershipVerdict::Inconclusive;
    }

    let Some(process_identity) = observation.process_identity.as_deref() else {
        return OwnershipVerdict::Inconclusive;
    };
    if process_identity != receipt.process_identity {
        return OwnershipVerdict::ReusedPid;
    }

    let expected_markers = ownership_markers(receipt);
    match observation.markers.as_ref() {
        None => return OwnershipVerdict::MarkerMissing,
        Some(markers) if markers != &expected_markers => {
            return OwnershipVerdict::MarkerConflict;
        }
        Some(_) => {}
    }

    match observation.boundary_member {
        Some(true) => OwnershipVerdict::Owned,
        Some(false) => OwnershipVerdict::BoundaryMismatch,
        None => OwnershipVerdict::Inconclusive,
    }
}
