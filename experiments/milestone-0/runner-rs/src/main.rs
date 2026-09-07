use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::io::{self, BufRead};

const PROTOCOL_VERSION: &str = "local-runner-protocol-v1";
const CAPABILITY_VERSION: &str = "local-runner-capabilities-v1";

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct Request {
    version: String,
    id: String,
    method: String,
    params: Value,
}

#[derive(Debug, Serialize)]
struct Capabilities {
    version: &'static str,
    platform: &'static str,
    architecture: &'static str,
    mechanism: &'static str,
    whole_tree_termination: bool,
    owner_exit_cleanup: bool,
    membership_observable: bool,
    escape_resistance: &'static str,
    stdin: bool,
    separate_output_streams: bool,
    timeout: bool,
}

fn platform() -> &'static str {
    if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "linux") {
        "linux"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else {
        "unknown"
    }
}

fn capabilities() -> Capabilities {
    Capabilities {
        version: CAPABILITY_VERSION,
        platform: platform(),
        architecture: std::env::consts::ARCH,
        mechanism: "unproven",
        whole_tree_termination: false,
        owner_exit_cleanup: false,
        membership_observable: false,
        escape_resistance: "best_effort",
        stdin: false,
        separate_output_streams: false,
        timeout: false,
    }
}

fn error_response(id: &str, code: &str, message: impl Into<String>) -> Value {
    json!({
        "version": PROTOCOL_VERSION,
        "id": id,
        "ok": false,
        "error": { "code": code, "message": message.into() }
    })
}

fn handle_line(line: &str) -> Value {
    let loose: Value = match serde_json::from_str(line) {
        Ok(value) => value,
        Err(error) => return error_response("unbound", "INVALID_JSON", error.to_string()),
    };
    let id = loose
        .get("id")
        .and_then(Value::as_str)
        .unwrap_or("unbound")
        .to_owned();
    let request: Request = match serde_json::from_value(loose) {
        Ok(value) => value,
        Err(error) => return error_response(&id, "INVALID_REQUEST", error.to_string()),
    };
    if request.version != PROTOCOL_VERSION {
        return error_response(
            &request.id,
            "UNSUPPORTED_VERSION",
            format!("expected {PROTOCOL_VERSION}"),
        );
    }
    if !request.params.as_object().is_some_and(|params| params.is_empty()) {
        return error_response(
            &request.id,
            "INVALID_PARAMS",
            "capability request params must be an empty object",
        );
    }
    match request.method.as_str() {
        "capabilities" => json!({
            "version": PROTOCOL_VERSION,
            "id": request.id,
            "ok": true,
            "result": capabilities()
        }),
        _ => error_response(
            &request.id,
            "UNKNOWN_METHOD",
            format!("unsupported method: {}", request.method),
        ),
    }
}

fn main() {
    let stdin = io::stdin();
    for line in stdin.lock().lines() {
        match line {
            Ok(line) if !line.is_empty() => println!("{}", handle_line(&line)),
            Ok(_) => println!(
                "{}",
                error_response("unbound", "INVALID_REQUEST", "empty request line")
            ),
            Err(error) => {
                eprintln!("stdin read failed: {error}");
                std::process::exit(2);
            }
        }
    }
}
