use serde_json::Value;
use std::io::Write;
use std::process::{Command, Stdio};

fn run(input: &str) -> (i32, String, String) {
    let mut child = Command::new(env!("CARGO_BIN_EXE_agentic-runner-spike"))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    child.stdin.as_mut().unwrap().write_all(input.as_bytes()).unwrap();
    drop(child.stdin.take());
    let output = child.wait_with_output().unwrap();
    (
        output.status.code().unwrap_or(-1),
        String::from_utf8(output.stdout).unwrap(),
        String::from_utf8(output.stderr).unwrap(),
    )
}

#[test]
fn capabilities_are_correlated_and_explicitly_unproven() {
    let (code, stdout, stderr) = run(
        "{\"version\":\"local-runner-protocol-v1\",\"id\":\"r1\",\"method\":\"capabilities\",\"params\":{}}\n",
    );
    assert_eq!(code, 0);
    assert!(stderr.is_empty());
    let value: Value = serde_json::from_str(stdout.trim()).unwrap();
    assert_eq!(value["id"], "r1");
    assert_eq!(value["ok"], true);
    assert_eq!(value["result"]["mechanism"], "unproven");
    assert_eq!(value["result"]["whole_tree_termination"], false);
}

#[test]
fn unknown_method_and_malformed_request_return_structured_errors() {
    let (_, stdout, _) = run(
        "{\"version\":\"local-runner-protocol-v1\",\"id\":\"r2\",\"method\":\"start\",\"params\":{}}\nnot-json\n",
    );
    let lines: Vec<Value> = stdout
        .lines()
        .map(|line| serde_json::from_str(line).unwrap())
        .collect();
    assert_eq!(lines.len(), 2);
    assert_eq!(lines[0]["error"]["code"], "UNKNOWN_METHOD");
    assert_eq!(lines[1]["error"]["code"], "INVALID_JSON");
}

#[test]
fn eof_without_requests_is_clean() {
    let (code, stdout, stderr) = run("");
    assert_eq!(code, 0);
    assert!(stdout.is_empty());
    assert!(stderr.is_empty());
}
