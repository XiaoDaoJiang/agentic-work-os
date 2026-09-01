use std::io::{self, Write};
use std::sync::{Arc, Mutex};

use agentic_native_runner::event_writer::EventWriter;
use agentic_native_runner::protocol::{encode_base64, parse_stage_b_batch, ProtocolError};
use serde_json::{json, Value};

const START: &str = r#"{"protocol":"local-runner-jsonl-v0","kind":"start","request_id":"start-1","run_id":"run-1","program":"/absolute/program","argv":["arg"],"cwd":"/absolute/cwd","env":{"inheritance_policy":"none","inherit_names":[],"overrides":{},"unset":[]},"timeout_ms":1000}"#;
const FINISH: &str = r#"{"protocol":"local-runner-jsonl-v0","kind":"finish_input","request_id":"finish-1","run_id":"run-1"}"#;

#[derive(Clone, Default)]
struct SharedBuffer(Arc<Mutex<Vec<u8>>>);

impl SharedBuffer {
    fn text(&self) -> String {
        String::from_utf8(self.0.lock().expect("buffer mutex").clone()).expect("UTF-8 JSONL")
    }
}

impl Write for SharedBuffer {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        self.0.lock().expect("buffer mutex").extend_from_slice(bytes);
        Ok(bytes.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

#[test]
fn parses_empty_and_non_empty_finite_batches() {
    let empty = parse_stage_b_batch(&format!("{START}\n{FINISH}\n")).expect("empty batch");
    assert_eq!(empty.start.run_id, "run-1");
    assert!(empty.stdin_bytes.is_empty());
    assert!(empty.inputs.is_empty());

    let input = r#"{"protocol":"local-runner-jsonl-v0","kind":"input","request_id":"input-1","run_id":"run-1","bytes_base64":"aGVsbG8="}"#;
    let populated = parse_stage_b_batch(&format!("{START}\n{input}\n{FINISH}\n")).expect("input batch");
    assert_eq!(populated.stdin_bytes, b"hello");
    assert_eq!(populated.inputs[0].request_id, "input-1");
    assert_eq!(populated.inputs[0].byte_length, 5);
}

#[test]
fn rejects_cancel_bad_order_environment_and_oversized_input() {
    let cancel = r#"{"protocol":"local-runner-jsonl-v0","kind":"cancel","request_id":"cancel-1","run_id":"run-1"}"#;
    assert!(matches!(
        parse_stage_b_batch(&format!("{START}\n{cancel}\n{FINISH}\n")),
        Err(ProtocolError::Validation(message)) if message.contains("cancel")
    ));
    assert!(parse_stage_b_batch(&format!("{FINISH}\n{START}\n")).is_err());

    let invalid_env = START.replace(
        r#""inheritance_policy":"none","inherit_names":[]"#,
        r#""inheritance_policy":"none","inherit_names":["PATH"]"#,
    );
    assert!(parse_stage_b_batch(&format!("{invalid_env}\n{FINISH}\n")).is_err());

    let oversized = vec![b'x'; 1024 * 1024 + 1];
    let input = json!({
        "protocol": "local-runner-jsonl-v0",
        "kind": "input",
        "request_id": "large-1",
        "run_id": "run-1",
        "bytes_base64": encode_base64(&oversized)
    });
    assert!(matches!(
        parse_stage_b_batch(&format!("{START}\n{input}\n{FINISH}\n")),
        Err(ProtocolError::Validation(message)) if message.contains("1048576")
    ));
}

#[test]
fn base64_encoder_uses_standard_canonical_padding() {
    assert_eq!(encode_base64(b""), "");
    assert_eq!(encode_base64(b"f"), "Zg==");
    assert_eq!(encode_base64(b"fo"), "Zm8=");
    assert_eq!(encode_base64(b"foo"), "Zm9v");
}

#[test]
fn event_writer_serializes_atomic_monotonic_json_lines() {
    let buffer = SharedBuffer::default();
    let writer = EventWriter::new(buffer.clone());
    writer.emit("run-1", "runner.ready", json!({})).expect("first event");
    writer.emit("run-1", "capabilities.reported", json!({"mechanism":"test"})).expect("second event");

    let lines: Vec<Value> = buffer
        .text()
        .lines()
        .map(|line| serde_json::from_str(line).expect("valid JSON line"))
        .collect();
    assert_eq!(lines.len(), 2);
    assert_eq!(lines[0]["sequence"], 1);
    assert_eq!(lines[1]["sequence"], 2);
    assert_eq!(lines[0]["protocol"], "local-runner-jsonl-v0");
    assert!(lines.iter().all(|line| line["at"].as_str().is_some_and(|at| at.ends_with('Z'))));
}
