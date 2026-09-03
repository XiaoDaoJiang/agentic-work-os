use std::error::Error;
use std::fmt;
use std::fs::{self, OpenOptions};
use std::io::{ErrorKind, Write};
use std::path::Path;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::runtime_receipt::{RuntimeReceiptV0, validate_runtime_receipt};
use crate::runtime_receipt_publication::PublishedReceipt;

const PERSISTED_RECEIPT_SCHEMA: &str = "runtime-receipt-store-v0";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
struct PersistedReceiptEnvelope {
    schema: String,
    run_id: String,
    spawn_nonce: String,
    raw_bytes: Vec<u8>,
    sha256: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReloadedRuntimeReceipt {
    pub published: PublishedReceipt,
    pub receipt: RuntimeReceiptV0,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PersistedReceiptErrorKind {
    Io,
    Parse,
    UnsupportedSchema,
    IntegrityMismatch,
    InvalidReceipt,
    MetadataMismatch,
    ConflictingPublication,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PersistedReceiptError {
    kind: PersistedReceiptErrorKind,
    message: String,
}

impl PersistedReceiptError {
    pub fn kind(&self) -> PersistedReceiptErrorKind {
        self.kind
    }
}

impl fmt::Display for PersistedReceiptError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl Error for PersistedReceiptError {}

pub fn persist_published_runtime_receipt(
    path: &Path,
    published: &PublishedReceipt,
) -> Result<(), PersistedReceiptError> {
    validate_published_receipt(published)?;

    let envelope = PersistedReceiptEnvelope {
        schema: PERSISTED_RECEIPT_SCHEMA.to_owned(),
        run_id: published.run_id.clone(),
        spawn_nonce: published.spawn_nonce.clone(),
        raw_bytes: published.raw_bytes.clone(),
        sha256: published.sha256.clone(),
    };
    let bytes = serde_json::to_vec(&envelope).map_err(|error| PersistedReceiptError {
        kind: PersistedReceiptErrorKind::Parse,
        message: format!("serialize persisted RuntimeReceipt envelope: {error}"),
    })?;

    match OpenOptions::new().write(true).create_new(true).open(path) {
        Ok(mut file) => {
            file.write_all(&bytes).map_err(|error| PersistedReceiptError {
                kind: PersistedReceiptErrorKind::Io,
                message: format!("write persisted RuntimeReceipt: {error}"),
            })?;
            file.sync_all().map_err(|error| PersistedReceiptError {
                kind: PersistedReceiptErrorKind::Io,
                message: format!("sync persisted RuntimeReceipt: {error}"),
            })?;
            Ok(())
        }
        Err(error) if error.kind() == ErrorKind::AlreadyExists => {
            let existing = fs::read(path).map_err(|read_error| PersistedReceiptError {
                kind: PersistedReceiptErrorKind::Io,
                message: format!("read existing persisted RuntimeReceipt: {read_error}"),
            })?;
            if existing == bytes {
                Ok(())
            } else {
                Err(PersistedReceiptError {
                    kind: PersistedReceiptErrorKind::ConflictingPublication,
                    message: "persisted RuntimeReceipt path already contains different bytes"
                        .to_owned(),
                })
            }
        }
        Err(error) => Err(PersistedReceiptError {
            kind: PersistedReceiptErrorKind::Io,
            message: format!("create persisted RuntimeReceipt: {error}"),
        }),
    }
}

pub fn load_persisted_runtime_receipt(
    path: &Path,
) -> Result<ReloadedRuntimeReceipt, PersistedReceiptError> {
    let bytes = fs::read(path).map_err(|error| PersistedReceiptError {
        kind: PersistedReceiptErrorKind::Io,
        message: format!("read persisted RuntimeReceipt: {error}"),
    })?;
    let envelope: PersistedReceiptEnvelope =
        serde_json::from_slice(&bytes).map_err(|error| PersistedReceiptError {
            kind: PersistedReceiptErrorKind::Parse,
            message: format!("parse persisted RuntimeReceipt envelope: {error}"),
        })?;

    if envelope.schema != PERSISTED_RECEIPT_SCHEMA {
        return Err(PersistedReceiptError {
            kind: PersistedReceiptErrorKind::UnsupportedSchema,
            message: format!(
                "unsupported persisted RuntimeReceipt schema: {}",
                envelope.schema
            ),
        });
    }

    let published = PublishedReceipt {
        run_id: envelope.run_id,
        spawn_nonce: envelope.spawn_nonce,
        raw_bytes: envelope.raw_bytes,
        sha256: envelope.sha256,
    };
    let receipt = validate_published_receipt(&published)?;

    Ok(ReloadedRuntimeReceipt { published, receipt })
}

fn validate_published_receipt(
    published: &PublishedReceipt,
) -> Result<RuntimeReceiptV0, PersistedReceiptError> {
    let actual_sha256 = sha256_hex(&published.raw_bytes);
    if actual_sha256 != published.sha256 {
        return Err(PersistedReceiptError {
            kind: PersistedReceiptErrorKind::IntegrityMismatch,
            message: "persisted RuntimeReceipt SHA-256 does not match raw bytes".to_owned(),
        });
    }

    let receipt: RuntimeReceiptV0 =
        serde_json::from_slice(&published.raw_bytes).map_err(|error| PersistedReceiptError {
            kind: PersistedReceiptErrorKind::Parse,
            message: format!("parse persisted RuntimeReceipt raw bytes: {error}"),
        })?;
    validate_runtime_receipt(&receipt).map_err(|message| PersistedReceiptError {
        kind: PersistedReceiptErrorKind::InvalidReceipt,
        message,
    })?;

    if receipt.run_id != published.run_id || receipt.spawn_nonce != published.spawn_nonce {
        return Err(PersistedReceiptError {
            kind: PersistedReceiptErrorKind::MetadataMismatch,
            message: "persisted RuntimeReceipt metadata does not match frozen raw bytes".to_owned(),
        });
    }

    Ok(receipt)
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
