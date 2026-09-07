use std::collections::{BTreeMap, HashSet};
use std::error::Error;
use std::fmt::{Display, Formatter};

use serde::Deserialize;

pub const RUNNER_PROTOCOL: &str = "local-runner-jsonl-v0";
pub const STAGE_B_MAX_STDIN_BYTES: usize = 1024 * 1024;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProtocolError {
    Json(String),
    Validation(String),
}

impl Display for ProtocolError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Json(message) => write!(formatter, "JSON protocol error: {message}"),
            Self::Validation(message) => write!(formatter, "protocol validation error: {message}"),
        }
    }
}

impl Error for ProtocolError {}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct EnvironmentSpec {
    pub inheritance_policy: String,
    #[serde(default)]
    pub inherit_names: Vec<String>,
    #[serde(default)]
    pub overrides: BTreeMap<String, String>,
    #[serde(default)]
    pub unset: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct StartRequest {
    pub protocol: String,
    pub request_id: String,
    pub run_id: String,
    pub program: String,
    #[serde(default)]
    pub argv: Vec<String>,
    pub cwd: String,
    pub env: EnvironmentSpec,
    pub timeout_ms: u64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
struct InputWireRequest {
    protocol: String,
    request_id: String,
    run_id: String,
    bytes_base64: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
struct FinishInputRequest {
    protocol: String,
    request_id: String,
    run_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
struct CancelRequest {
    protocol: String,
    request_id: String,
    run_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind")]
enum WireRequest {
    #[serde(rename = "start")]
    Start(StartRequest),
    #[serde(rename = "input")]
    Input(InputWireRequest),
    #[serde(rename = "finish_input")]
    FinishInput(FinishInputRequest),
    #[serde(rename = "cancel")]
    Cancel(CancelRequest),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InputReceipt {
    pub request_id: String,
    pub byte_length: usize,
}

#[derive(Debug, Clone)]
pub struct StageBRun {
    pub start: StartRequest,
    pub inputs: Vec<InputReceipt>,
    pub stdin_bytes: Vec<u8>,
}

fn validation(message: impl Into<String>) -> ProtocolError {
    ProtocolError::Validation(message.into())
}

fn is_safe_id(value: &str) -> bool {
    !value.is_empty()
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-'))
}

fn validate_common(protocol: &str, request_id: &str, run_id: &str) -> Result<(), ProtocolError> {
    if protocol != RUNNER_PROTOCOL {
        return Err(validation(format!("protocol must be {RUNNER_PROTOCOL}")));
    }
    if !is_safe_id(request_id) {
        return Err(validation(
            "request_id must use letters, digits, dot, underscore, or hyphen",
        ));
    }
    if !is_safe_id(run_id) {
        return Err(validation(
            "run_id must use letters, digits, dot, underscore, or hyphen",
        ));
    }
    Ok(())
}

fn validate_nul_free(value: &str, label: &str) -> Result<(), ProtocolError> {
    if value.is_empty() {
        return Err(validation(format!("{label} must be non-empty")));
    }
    if value.contains('\0') {
        return Err(validation(format!("{label} must be NUL-free")));
    }
    Ok(())
}

fn validate_environment(environment: &EnvironmentSpec) -> Result<(), ProtocolError> {
    if !matches!(
        environment.inheritance_policy.as_str(),
        "none" | "allowlist"
    ) {
        return Err(validation(
            "env.inheritance_policy must be none or allowlist",
        ));
    }
    if environment.inheritance_policy == "none" && !environment.inherit_names.is_empty() {
        return Err(validation(
            "env.inherit_names must be empty when inheritance_policy is none",
        ));
    }

    let mut names = HashSet::new();
    for name in &environment.inherit_names {
        validate_nul_free(name, "env.inherit_names entry")?;
        if !names.insert(name) {
            return Err(validation("env.inherit_names entries must be unique"));
        }
    }
    for (name, value) in &environment.overrides {
        validate_nul_free(name, "env.overrides key")?;
        if value.contains('\0') {
            return Err(validation("env.overrides values must be NUL-free"));
        }
    }
    let mut unset_names = HashSet::new();
    for name in &environment.unset {
        validate_nul_free(name, "env.unset entry")?;
        if !unset_names.insert(name) {
            return Err(validation("env.unset entries must be unique"));
        }
    }
    Ok(())
}

fn validate_start(start: &StartRequest) -> Result<(), ProtocolError> {
    validate_common(&start.protocol, &start.request_id, &start.run_id)?;
    validate_nul_free(&start.program, "program")?;
    validate_nul_free(&start.cwd, "cwd")?;
    for argument in &start.argv {
        if argument.contains('\0') {
            return Err(validation("argv entries must be NUL-free"));
        }
    }
    validate_environment(&start.env)?;
    if start.timeout_ms == 0 {
        return Err(validation("timeout_ms must be a positive integer"));
    }
    Ok(())
}

const BASE64_TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

pub fn encode_base64(bytes: &[u8]) -> String {
    let mut output = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let first = chunk[0];
        let second = *chunk.get(1).unwrap_or(&0);
        let third = *chunk.get(2).unwrap_or(&0);
        output.push(BASE64_TABLE[(first >> 2) as usize] as char);
        output.push(BASE64_TABLE[(((first & 0x03) << 4) | (second >> 4)) as usize] as char);
        if chunk.len() >= 2 {
            output.push(BASE64_TABLE[(((second & 0x0f) << 2) | (third >> 6)) as usize] as char);
        } else {
            output.push('=');
        }
        if chunk.len() == 3 {
            output.push(BASE64_TABLE[(third & 0x3f) as usize] as char);
        } else {
            output.push('=');
        }
    }
    output
}

fn base64_value(byte: u8) -> Option<u8> {
    match byte {
        b'A'..=b'Z' => Some(byte - b'A'),
        b'a'..=b'z' => Some(byte - b'a' + 26),
        b'0'..=b'9' => Some(byte - b'0' + 52),
        b'+' => Some(62),
        b'/' => Some(63),
        _ => None,
    }
}

pub fn decode_base64(value: &str) -> Result<Vec<u8>, ProtocolError> {
    if value.is_empty() {
        return Ok(Vec::new());
    }
    let bytes = value.as_bytes();
    if bytes.len() % 4 != 0 {
        return Err(validation("bytes_base64 must be canonical standard Base64"));
    }

    let mut output = Vec::with_capacity(bytes.len() / 4 * 3);
    for (index, chunk) in bytes.chunks_exact(4).enumerate() {
        let final_chunk = index == bytes.len() / 4 - 1;
        let padding = usize::from(chunk[3] == b'=') + usize::from(chunk[2] == b'=');
        if padding > 0 && !final_chunk {
            return Err(validation(
                "bytes_base64 padding is only allowed in the final quartet",
            ));
        }
        if chunk[2] == b'=' && chunk[3] != b'=' {
            return Err(validation("bytes_base64 has invalid padding"));
        }
        if padding > 2 {
            return Err(validation("bytes_base64 has invalid padding"));
        }

        let a = base64_value(chunk[0])
            .ok_or_else(|| validation("bytes_base64 contains invalid characters"))?;
        let b = base64_value(chunk[1])
            .ok_or_else(|| validation("bytes_base64 contains invalid characters"))?;
        let c = if chunk[2] == b'=' {
            0
        } else {
            base64_value(chunk[2])
                .ok_or_else(|| validation("bytes_base64 contains invalid characters"))?
        };
        let d = if chunk[3] == b'=' {
            0
        } else {
            base64_value(chunk[3])
                .ok_or_else(|| validation("bytes_base64 contains invalid characters"))?
        };

        output.push((a << 2) | (b >> 4));
        if padding < 2 {
            output.push((b << 4) | (c >> 2));
        }
        if padding == 0 {
            output.push((c << 6) | d);
        }
    }

    if encode_base64(&output) != value {
        return Err(validation("bytes_base64 must be canonical standard Base64"));
    }
    Ok(output)
}

pub fn parse_stage_b_batch(input: &str) -> Result<StageBRun, ProtocolError> {
    let mut requests = Vec::new();
    for (index, line) in input.lines().enumerate() {
        if line.trim().is_empty() {
            continue;
        }
        let request = serde_json::from_str::<WireRequest>(line)
            .map_err(|error| ProtocolError::Json(format!("line {}: {error}", index + 1)))?;
        requests.push(request);
    }
    if requests.is_empty() {
        return Err(validation("Stage B request batch must not be empty"));
    }

    let mut iterator = requests.into_iter();
    let start = match iterator.next() {
        Some(WireRequest::Start(start)) => start,
        _ => return Err(validation("first request must be start")),
    };
    validate_start(&start)?;

    let mut seen_request_ids = HashSet::new();
    seen_request_ids.insert(start.request_id.clone());
    let mut stdin_bytes = Vec::new();
    let mut inputs = Vec::new();
    let mut finished = false;

    for request in iterator {
        if finished {
            return match request {
                WireRequest::FinishInput(_) => {
                    Err(validation("finish_input may occur exactly once"))
                }
                _ => Err(validation("request arrived after finish_input")),
            };
        }

        match request {
            WireRequest::Start(_) => return Err(validation("start may occur exactly once")),
            WireRequest::Cancel(cancel) => {
                validate_common(&cancel.protocol, &cancel.request_id, &cancel.run_id)?;
                return Err(validation("cancel is not supported in Stage B"));
            }
            WireRequest::Input(request) => {
                validate_common(&request.protocol, &request.request_id, &request.run_id)?;
                if request.run_id != start.run_id {
                    return Err(validation(
                        "every request run_id must match the start request",
                    ));
                }
                if !seen_request_ids.insert(request.request_id.clone()) {
                    return Err(validation("request_id must be unique"));
                }
                let bytes = decode_base64(&request.bytes_base64)?;
                if stdin_bytes.len() + bytes.len() > STAGE_B_MAX_STDIN_BYTES {
                    return Err(validation(format!(
                        "Stage B stdin exceeds {STAGE_B_MAX_STDIN_BYTES} bytes"
                    )));
                }
                inputs.push(InputReceipt {
                    request_id: request.request_id,
                    byte_length: bytes.len(),
                });
                stdin_bytes.extend_from_slice(&bytes);
            }
            WireRequest::FinishInput(request) => {
                validate_common(&request.protocol, &request.request_id, &request.run_id)?;
                if request.run_id != start.run_id {
                    return Err(validation(
                        "every request run_id must match the start request",
                    ));
                }
                if !seen_request_ids.insert(request.request_id) {
                    return Err(validation("request_id must be unique"));
                }
                finished = true;
            }
        }
    }

    if !finished {
        return Err(validation("finish_input is required exactly once"));
    }

    Ok(StageBRun {
        start,
        inputs,
        stdin_bytes,
    })
}
