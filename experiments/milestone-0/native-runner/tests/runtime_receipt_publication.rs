use agentic_native_runner::runtime_receipt::{
    ContainmentReceipt, RuntimeReceiptV0, WorkspaceReceipt,
};
use agentic_native_runner::runtime_receipt_publication::{
    PublishDisposition, PublishError, ReceiptPublicationState, publish_runtime_receipt,
};

fn sample_receipt() -> RuntimeReceiptV0 {
    RuntimeReceiptV0 {
        schema: "runtime-receipt-v0".to_owned(),
        runtime_instance_id: "runtime-local-01".to_owned(),
        run_id: "run-01".to_owned(),
        spawn_nonce: "nonce-01".to_owned(),
        root_pid: 4242,
        process_identity: "proc-01".to_owned(),
        containment: ContainmentReceipt {
            mechanism: "job_object".to_owned(),
            boundary_id: "boundary-01".to_owned(),
        },
        workspace: WorkspaceReceipt {
            workspace_id: "workspace-01".to_owned(),
            repository_identity: "repo-marker-v1:11111111-1111-4111-8111-111111111111".to_owned(),
            canonical_path: "C:/tmp/workspace-01".to_owned(),
        },
        started_at: "2026-09-03T00:00:00Z".to_owned(),
        helper_revision: "deadbeef".to_owned(),
    }
}

#[test]
fn first_publication_freezes_exact_bytes_and_sha256() {
    let state = ReceiptPublicationState::default();
    let receipt = sample_receipt();

    let (published, disposition) =
        publish_runtime_receipt(state, &receipt).expect("first publication must succeed");

    assert_eq!(disposition, PublishDisposition::Published);
    let envelope = published
        .published
        .as_ref()
        .expect("publication state must contain one receipt");

    let expected_raw = br#"{"schema":"runtime-receipt-v0","runtime_instance_id":"runtime-local-01","run_id":"run-01","spawn_nonce":"nonce-01","root_pid":4242,"process_identity":"proc-01","containment":{"mechanism":"job_object","boundary_id":"boundary-01"},"workspace":{"workspace_id":"workspace-01","repository_identity":"repo-marker-v1:11111111-1111-4111-8111-111111111111","canonical_path":"C:/tmp/workspace-01"},"started_at":"2026-09-03T00:00:00Z","helper_revision":"deadbeef"}"#;
    assert_eq!(envelope.raw_bytes, expected_raw);
    assert_eq!(
        envelope.sha256,
        "98017f2987f24c2a980c39d3e5e8f788b0d72df1039598b9d7b72d699ada47aa"
    );
    assert_eq!(envelope.run_id, "run-01");
    assert_eq!(envelope.spawn_nonce, "nonce-01");
}

#[test]
fn byte_identical_duplicate_publication_is_idempotent() {
    let receipt = sample_receipt();
    let (state, first) = publish_runtime_receipt(ReceiptPublicationState::default(), &receipt)
        .expect("first publication must succeed");
    assert_eq!(first, PublishDisposition::Published);
    let frozen = state.clone();

    let (after_duplicate, duplicate) =
        publish_runtime_receipt(state, &receipt).expect("identical duplicate must be idempotent");

    assert_eq!(duplicate, PublishDisposition::DuplicateIdempotent);
    assert_eq!(after_duplicate, frozen);
}

#[test]
fn conflicting_duplicate_publication_fails_closed_and_preserves_original() {
    let receipt = sample_receipt();
    let (state, _) = publish_runtime_receipt(ReceiptPublicationState::default(), &receipt)
        .expect("first publication must succeed");
    let frozen = state.clone();

    let mut conflicting = receipt;
    conflicting.process_identity = "proc-CONFLICT".to_owned();

    let error = publish_runtime_receipt(state, &conflicting)
        .expect_err("conflicting receipt bytes must fail closed");
    assert_eq!(error, PublishError::ConflictingPublication);
    assert_eq!(error.preserved_state(), &frozen);
}

#[test]
fn same_run_with_different_spawn_nonce_is_conflicting_not_a_second_receipt() {
    let receipt = sample_receipt();
    let (state, _) = publish_runtime_receipt(ReceiptPublicationState::default(), &receipt)
        .expect("first publication must succeed");
    let frozen = state.clone();

    let mut second_spawn = receipt;
    second_spawn.spawn_nonce = "nonce-02".to_owned();

    let error = publish_runtime_receipt(state, &second_spawn)
        .expect_err("one publication slot cannot accept a second spawn receipt");
    assert_eq!(error, PublishError::ConflictingPublication);
    assert_eq!(error.preserved_state(), &frozen);
}
