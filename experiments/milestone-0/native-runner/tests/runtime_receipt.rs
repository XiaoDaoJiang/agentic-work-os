use agentic_native_runner::runtime_receipt::{
    ContainmentReceipt, OwnershipMarkers, OwnershipObservation, OwnershipVerdict, RuntimeReceiptV0,
    WorkspaceReceipt, classify_ownership, ownership_markers, validate_runtime_receipt,
};

fn sample_receipt() -> RuntimeReceiptV0 {
    RuntimeReceiptV0 {
        schema: "runtime-receipt-v0".to_owned(),
        runtime_instance_id: "runtime-local-01".to_owned(),
        run_id: "run-01".to_owned(),
        spawn_nonce: "6e54d93a4b7b4bc4991878c7".to_owned(),
        root_pid: 4242,
        process_identity: "opaque-process-token-01".to_owned(),
        containment: ContainmentReceipt {
            mechanism: "job_object".to_owned(),
            boundary_id: "boundary-01".to_owned(),
        },
        workspace: WorkspaceReceipt {
            workspace_id: "workspace-01".to_owned(),
            repository_identity: "repo-marker-v1:11111111-1111-4111-8111-111111111111".to_owned(),
            canonical_path: "C:/tmp/agentic/workspace-01".to_owned(),
        },
        started_at: "2026-09-02T00:00:00Z".to_owned(),
        helper_revision: "deadbeef".to_owned(),
    }
}

#[test]
fn own_01_valid_receipt_binds_run_workspace_boundary_and_markers() {
    let receipt = sample_receipt();
    validate_runtime_receipt(&receipt).expect("candidate receipt must validate");

    assert_eq!(
        ownership_markers(&receipt),
        OwnershipMarkers {
            runtime_instance_id: "runtime-local-01".to_owned(),
            run_id: "run-01".to_owned(),
            spawn_nonce: "6e54d93a4b7b4bc4991878c7".to_owned(),
        }
    );
}

#[test]
fn own_07_pid_reuse_never_becomes_owned_by_marker_match() {
    let receipt = sample_receipt();
    let observation = OwnershipObservation {
        pid: receipt.root_pid,
        process_identity: Some("opaque-process-token-NEW".to_owned()),
        markers: Some(ownership_markers(&receipt)),
        boundary_member: Some(false),
    };

    assert_eq!(
        classify_ownership(&receipt, &observation),
        OwnershipVerdict::ReusedPid
    );
}

#[test]
fn own_08_missing_or_conflicting_markers_fail_closed() {
    let receipt = sample_receipt();

    let missing = OwnershipObservation {
        pid: receipt.root_pid,
        process_identity: Some(receipt.process_identity.clone()),
        markers: None,
        boundary_member: Some(true),
    };
    assert_eq!(
        classify_ownership(&receipt, &missing),
        OwnershipVerdict::MarkerMissing
    );

    let conflicting = OwnershipObservation {
        pid: receipt.root_pid,
        process_identity: Some(receipt.process_identity.clone()),
        markers: Some(OwnershipMarkers {
            runtime_instance_id: receipt.runtime_instance_id.clone(),
            run_id: "different-run".to_owned(),
            spawn_nonce: receipt.spawn_nonce.clone(),
        }),
        boundary_member: Some(true),
    };
    assert_eq!(
        classify_ownership(&receipt, &conflicting),
        OwnershipVerdict::MarkerConflict
    );
}

#[test]
fn marker_match_without_process_identity_never_proves_ownership() {
    let receipt = sample_receipt();
    let observation = OwnershipObservation {
        pid: receipt.root_pid,
        process_identity: None,
        markers: Some(ownership_markers(&receipt)),
        boundary_member: Some(true),
    };

    assert_eq!(
        classify_ownership(&receipt, &observation),
        OwnershipVerdict::Inconclusive
    );
}
