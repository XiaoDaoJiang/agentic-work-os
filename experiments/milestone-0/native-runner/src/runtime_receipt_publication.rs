use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::runtime_receipt::{RuntimeReceiptV0, validate_runtime_receipt};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PublishedReceipt {
    pub run_id: String,
    pub spawn_nonce: String,
    pub raw_bytes: Vec<u8>,
    pub sha256: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct ReceiptPublicationState {
    pub published: Option<PublishedReceipt>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum PublishDisposition {
    Published,
    DuplicateIdempotent,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum PublishErrorKind {
    InvalidReceipt,
    Serialization,
    ConflictingPublication,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PublishError {
    kind: PublishErrorKind,
    preserved_state: ReceiptPublicationState,
    message: String,
}

impl PublishError {
    pub fn kind(&self) -> PublishErrorKind {
        self.kind
    }

    pub fn preserved_state(&self) -> &ReceiptPublicationState {
        &self.preserved_state
    }
}

pub fn publish_runtime_receipt(
    state: ReceiptPublicationState,
    receipt: &RuntimeReceiptV0,
) -> Result<(ReceiptPublicationState, PublishDisposition), PublishError> {
    if let Err(message) = validate_runtime_receipt(receipt) {
        return Err(PublishError {
            kind: PublishErrorKind::InvalidReceipt,
            preserved_state: state,
            message,
        });
    }

    let raw_bytes = match serde_json::to_vec(receipt) {
        Ok(bytes) => bytes,
        Err(error) => {
            return Err(PublishError {
                kind: PublishErrorKind::Serialization,
                preserved_state: state,
                message: format!("serialize RuntimeReceipt: {error}"),
            });
        }
    };
    let sha256 = sha256_hex(&raw_bytes);
    let candidate = PublishedReceipt {
        run_id: receipt.run_id.clone(),
        spawn_nonce: receipt.spawn_nonce.clone(),
        raw_bytes,
        sha256,
    };

    match state.published.as_ref() {
        None => Ok((
            ReceiptPublicationState {
                published: Some(candidate),
            },
            PublishDisposition::Published,
        )),
        Some(existing) if existing == &candidate => {
            Ok((state, PublishDisposition::DuplicateIdempotent))
        }
        Some(_) => Err(PublishError {
            kind: PublishErrorKind::ConflictingPublication,
            preserved_state: state,
            message: "RuntimeReceipt publication slot already contains different bytes".to_owned(),
        }),
    }
}

fn sha256_hex(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    let mut encoded = String::with_capacity(digest.len() * 2);
    for byte in digest {
        use std::fmt::Write as _;
        write!(&mut encoded, "{byte:02x}").expect("writing to String cannot fail");
    }
    encoded
}
