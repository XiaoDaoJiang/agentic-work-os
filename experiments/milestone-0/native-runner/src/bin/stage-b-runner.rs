use std::collections::{BTreeMap, HashSet};
use std::env;
use std::error::Error;
use std::fmt::{Display, Formatter};
use std::io::{self, Read, Write};
use std::path::Path;
use std::process::{Child, Command, ExitStatus, Stdio};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use serde::Deserialize;
use serde_json::{json, Value};

const PROTOCOL: &str = "local-runner-jsonl-v0";
const MAX_STDIN_BYTES: usize = 1024 * 1024;
const READ_BUFFER_BYTES: usize = 8192;
const POLL_INTERVAL: Duration = Duration::from_millis(10);

#[derive(Debug)]
enum RunnerError {
    Protocol(String),
    Io(String),
    Execution(String),
}

impl Display for RunnerError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Protocol(message) => write!(formatter, "protocol error: {message}"),
            Self::Io(message) => write!(formatter, "I/O error: {message}"),
            Self::Execution(message) => write!(formatter, "execution error: {message}"),
        }
    }
}

impl Error for RunnerError {}

impl From<io::Error> for RunnerError {
    fn from(error: io::Error) -> Self {
        Self::Io(error.to_string())
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
struct EnvironmentSpec {
    inheritance_policy: String,
    #[serde(default)]
    inherit_names: Vec<String>,
    #[serde(default)]
    overrides: BTreeMap<String, String>,
    #[serde(default)]
    unset: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
struct StartRequest {
    protocol: String,
    request_id: String,
    run_id: String,
    program: String,
    #[serde(default)]
    argv: Vec<String>,
    cwd: String,
    env: EnvironmentSpec,
    timeout_ms: u64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
struct InputRequest {
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
enum Request {
    #[serde(rename = "start")]
    Start(StartRequest),
    #[serde(rename = "input")]
    Input(InputRequest),
    #[serde(rename = "finish_input")]
    FinishInput(FinishInputRequest),
    #[serde(rename = "cancel")]
    Cancel(CancelRequest),
}

#[derive(Debug, Clone)]
struct InputReceipt {
    request_id: String,
    byte_length: usize,
}

#[derive(Debug, Clone)]
struct StageBRun {
    start: StartRequest,
    inputs: Vec<InputReceipt>,
    stdin_bytes: Vec<u8>,
}

#[derive(Debug, Clone, Copy)]
enum StreamKind {
    Stdout,
    Stderr,
}

impl StreamKind {
    fn frame_event(self) -> &'static str {
        match self {
            Self::Stdout => "stdout.frame",
            Self::Stderr => "stderr.frame",
        }
    }
}

enum StreamMessage {
    Bytes(StreamKind, Vec<u8>),
    End(StreamKind),
    Error(StreamKind, String),
}

struct EventWriter<W: Write> {
    output: W,
    sequence: u64,
    stdout_sequence: u64,
    stderr_sequence: u64,
}

impl<W: Write> EventWriter<W> {
    fn new(output: W) -> Self {
        Self {
            output,
            sequence: 0,
            stdout_sequence: 0,
            stderr_sequence: 0,
        }
    }

    fn emit(&mut self, run_id: &str, event: &str, payload: Value) -> Result<(), RunnerError> {
        self.sequence += 1;
        let envelope = json!({
            "protocol": PROTOCOL,
            "sequence": self.sequence,
            "at": timestamp_now(),
            "event": event,
            "run_id": run_id,
            "payload": payload
        });
        serde_json::to_writer(&mut self.output, &envelope)
            .map_err(|error| RunnerError::Io(error.to_string()))?;
        self.output.write_all(b"\n")?;
        self.output.flush()?;
        Ok(())
    }

    fn emit_stream(
        &mut self,
        run_id: &str,
        stream: StreamKind,
        bytes: &[u8],
    ) -> Result<(), RunnerError> {
        if bytes.is_empty() {
            return Ok(());
        }
        let stream_sequence = match stream {
            StreamKind::Stdout => {
                self.stdout_sequence += 1;
                self.stdout_sequence
            }
            StreamKind::Stderr => {
                self.stderr_sequence += 1;
                self.stderr_sequence
            }
        };
        self.emit(
            run_id,
            stream.frame_event(),
            json!({
                "stream_sequence": stream_sequence,
                "byte_length": bytes.len(),
                "bytes_base64": encode_base64(bytes)
            }),
        )
    }

    fn stream_sequence(&self, stream: StreamKind) -> u64 {
        match stream {
            StreamKind::Stdout => self.stdout_sequence,
            StreamKind::Stderr => self.stderr_sequence,
        }
    }
}

fn protocol_error(message: impl Into<String>) -> RunnerError {
    RunnerError::Protocol(message.into())
}

fn safe_id(value: &str) -> bool {
    !value.is_empty()
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-'))
}

fn validate_common(protocol: &str, request_id: &str, run_id: &str) -> Result<(), RunnerError> {
    if protocol != PROTOCOL {
        return Err(protocol_error(format!("protocol must be {PROTOCOL}")));
    }
    if !safe_id(request_id) {
        return Err(protocol_error("request_id is not path-safe"));
    }
    if !safe_id(run_id) {
        return Err(protocol_error("run_id is not path-safe"));
    }
    Ok(())
}

fn validate_nul_free(value: &str, label: &str, allow_empty: bool) -> Result<(), RunnerError> {
    if !allow_empty && value.is_empty() {
        return Err(protocol_error(format!("{label} must not be empty")));
    }
    if value.contains('\0') {
        return Err(protocol_error(format!("{label} must be NUL-free")));
    }
    Ok(())
}

fn validate_environment(environment: &EnvironmentSpec) -> Result<(), RunnerError> {
    if !matches!(environment.inheritance_policy.as_str(), "none" | "allowlist") {
        return Err(protocol_error(
            "environment inheritance_policy must be none or allowlist",
        ));
    }
    if environment.inheritance_policy == "none" && !environment.inherit_names.is_empty() {
        return Err(protocol_error(
            "inherit_names must be empty when inheritance_policy is none",
        ));
    }
    let mut inherited = HashSet::new();
    for name in &environment.inherit_names {
        validate_nul_free(name, "inherit_names entry", false)?;
        if !inherited.insert(name) {
            return Err(protocol_error("inherit_names entries must be unique"));
        }
    }
    for (name, value) in &environment.overrides {
        validate_nul_free(name, "override name", false)?;
        validate_nul_free(value, "override value", true)?;
    }
    let mut unset = HashSet::new();
    for name in &environment.unset {
        validate_nul_free(name, "unset entry", false)?;
        if !unset.insert(name) {
            return Err(protocol_error("unset entries must be unique"));
        }
    }
    Ok(())
}

fn validate_start(start: &StartRequest) -> Result<(), RunnerError> {
    validate_common(&start.protocol, &start.request_id, &start.run_id)?;
    validate_nul_free(&start.program, "program", false)?;
    validate_nul_free(&start.cwd, "cwd", false)?;
    if !Path::new(&start.program).is_absolute() {
        return Err(protocol_error("program must be an absolute path"));
    }
    if !Path::new(&start.cwd).is_absolute() {
        return Err(protocol_error("cwd must be an absolute path"));
    }
    if !Path::new(&start.cwd).is_dir() {
        return Err(protocol_error("cwd must be an existing directory"));
    }
    for argument in &start.argv {
        validate_nul_free(argument, "argv entry", true)?;
    }
    validate_environment(&start.env)?;
    if start.timeout_ms == 0 {
        return Err(protocol_error("timeout_ms must be positive"));
    }
    Ok(())
}

fn parse_batch(input: &str) -> Result<StageBRun, RunnerError> {
    let mut requests = Vec::new();
    for (index, line) in input.lines().enumerate() {
        if line.trim().is_empty() {
            continue;
        }
        requests.push(
            serde_json::from_str::<Request>(line).map_err(|error| {
                protocol_error(format!("line {} is invalid JSON: {error}", index + 1))
            })?,
        );
    }
    if requests.is_empty() {
        return Err(protocol_error("request batch is empty"));
    }

    let mut iterator = requests.into_iter();
    let start = match iterator.next() {
        Some(Request::Start(start)) => start,
        _ => return Err(protocol_error("first request must be start")),
    };
    validate_start(&start)?;

    let mut seen_ids = HashSet::new();
    seen_ids.insert(start.request_id.clone());
    let mut inputs = Vec::new();
    let mut stdin_bytes = Vec::new();
    let mut finished = false;

    for request in iterator {
        if finished {
            return Err(protocol_error("request arrived after finish_input"));
        }
        match request {
            Request::Start(_) => return Err(protocol_error("start may occur exactly once")),
            Request::Cancel(cancel) => {
                validate_common(&cancel.protocol, &cancel.request_id, &cancel.run_id)?;
                return Err(protocol_error("cancel is not supported in Stage B"));
            }
            Request::Input(request) => {
                validate_common(&request.protocol, &request.request_id, &request.run_id)?;
                if request.run_id != start.run_id {
                    return Err(protocol_error("request run_id must match start run_id"));
                }
                if !seen_ids.insert(request.request_id.clone()) {
                    return Err(protocol_error("request_id must be unique"));
                }
                let bytes = decode_base64(&request.bytes_base64)?;
                if stdin_bytes.len() + bytes.len() > MAX_STDIN_BYTES {
                    return Err(protocol_error(format!(
                        "Stage B stdin exceeds {MAX_STDIN_BYTES} bytes"
                    )));
                }
                inputs.push(InputReceipt {
                    request_id: request.request_id,
                    byte_length: bytes.len(),
                });
                stdin_bytes.extend_from_slice(&bytes);
            }
            Request::FinishInput(request) => {
                validate_common(&request.protocol, &request.request_id, &request.run_id)?;
                if request.run_id != start.run_id {
                    return Err(protocol_error("request run_id must match start run_id"));
                }
                if !seen_ids.insert(request.request_id) {
                    return Err(protocol_error("request_id must be unique"));
                }
                finished = true;
            }
        }
    }

    if !finished {
        return Err(protocol_error("finish_input is required"));
    }
    Ok(StageBRun {
        start,
        inputs,
        stdin_bytes,
    })
}

fn configure_command(start: &StartRequest) -> Command {
    let mut command = Command::new(&start.program);
    command
        .args(&start.argv)
        .current_dir(&start.cwd)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env_clear();
    if start.env.inheritance_policy == "allowlist" {
        for name in &start.env.inherit_names {
            if let Some(value) = env::var_os(name) {
                command.env(name, value);
            }
        }
    }
    for (name, value) in &start.env.overrides {
        command.env(name, value);
    }
    for name in &start.env.unset {
        command.env_remove(name);
    }
    command
}

fn spawn_reader<R>(
    mut reader: R,
    stream: StreamKind,
    sender: Sender<StreamMessage>,
) -> JoinHandle<()>
where
    R: Read + Send + 'static,
{
    thread::spawn(move || {
        let mut buffer = vec![0_u8; READ_BUFFER_BYTES];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => {
                    let _ = sender.send(StreamMessage::End(stream));
                    return;
                }
                Ok(count) => {
                    if sender
                        .send(StreamMessage::Bytes(stream, buffer[..count].to_vec()))
                        .is_err()
                    {
                        return;
                    }
                }
                Err(error) => {
                    let _ = sender.send(StreamMessage::Error(stream, error.to_string()));
                    return;
                }
            }
        }
    })
}

#[derive(Default)]
struct StreamState {
    stdout_done: bool,
    stderr_done: bool,
}

impl StreamState {
    fn complete(&self) -> bool {
        self.stdout_done && self.stderr_done
    }

    fn consume(
        &mut self,
        message: StreamMessage,
        writer: &mut EventWriter<impl Write>,
        run_id: &str,
    ) -> Result<(), RunnerError> {
        match message {
            StreamMessage::Bytes(stream, bytes) => writer.emit_stream(run_id, stream, &bytes),
            StreamMessage::End(StreamKind::Stdout) => {
                self.stdout_done = true;
                Ok(())
            }
            StreamMessage::End(StreamKind::Stderr) => {
                self.stderr_done = true;
                Ok(())
            }
            StreamMessage::Error(stream, message) => Err(RunnerError::Execution(format!(
                "{} reader failed: {message}",
                match stream {
                    StreamKind::Stdout => "stdout",
                    StreamKind::Stderr => "stderr",
                }
            ))),
        }
    }
}

fn wait_for_exit(
    child: &mut Child,
    receiver: &Receiver<StreamMessage>,
    writer: &mut EventWriter<impl Write>,
    run_id: &str,
    timeout: Duration,
) -> Result<(Option<i32>, bool, StreamState), RunnerError> {
    let started = Instant::now();
    let mut exit_status: Option<ExitStatus> = None;
    let mut timed_out = false;
    let mut streams = StreamState::default();

    while exit_status.is_none() || !streams.complete() {
        match receiver.recv_timeout(POLL_INTERVAL) {
            Ok(message) => streams.consume(message, writer, run_id)?,
            Err(RecvTimeoutError::Timeout) => {}
            Err(RecvTimeoutError::Disconnected) if !streams.complete() => {
                return Err(RunnerError::Execution(
                    "stream readers disconnected before drain".to_string(),
                ));
            }
            Err(RecvTimeoutError::Disconnected) => {}
        }

        if exit_status.is_none() {
            if let Some(status) = child.try_wait().map_err(|error| {
                RunnerError::Execution(format!("child status probe failed: {error}"))
            })? {
                exit_status = Some(status);
            } else if started.elapsed() >= timeout {
                timed_out = true;
                child
                    .kill()
                    .map_err(|error| RunnerError::Execution(format!("root kill failed: {error}")))?;
                exit_status = Some(child.wait().map_err(|error| {
                    RunnerError::Execution(format!("wait after timeout failed: {error}"))
                })?);
            }
        }
    }

    let exit_code = if timed_out {
        None
    } else {
        exit_status.and_then(|status| status.code())
    };
    Ok((exit_code, timed_out, streams))
}

fn execute(run: StageBRun) -> Result<(), RunnerError> {
    let stdout = io::stdout();
    let mut writer = EventWriter::new(stdout.lock());
    let run_id = run.start.run_id.clone();
    writer.emit(
        &run_id,
        "runner.ready",
        json!({"runner_version": env!("CARGO_PKG_VERSION")}),
    )?;
    writer.emit(
        &run_id,
        "capabilities.reported",
        json!({
            "platform": env::consts::OS,
            "architecture": env::consts::ARCH,
            "transport": "rust_std_process",
            "execution_mechanism": "root_process_only",
            "containment_applied": false,
            "whole_tree_termination": false,
            "kill_on_owner_exit": false,
            "membership_observable": false,
            "escape_resistance": "none"
        }),
    )?;

    let mut child = configure_command(&run.start)
        .spawn()
        .map_err(|error| RunnerError::Execution(format!("child start failed: {error}")))?;
    let pid = child.id();
    let boundary_id = format!("root-only-{pid}");
    writer.emit(
        &run_id,
        "boundary.created",
        json!({
            "boundary_id": boundary_id,
            "root_pid": pid,
            "mechanism": "root_process_only",
            "containment_applied": false
        }),
    )?;
    writer.emit(
        &run_id,
        "process.started",
        json!({"pid": pid, "cwd": run.start.cwd, "program": run.start.program}),
    )?;

    let mut child_stdin = child
        .stdin
        .take()
        .ok_or_else(|| RunnerError::Execution("child stdin pipe is unavailable".to_string()))?;
    child_stdin.write_all(&run.stdin_bytes)?;
    child_stdin.flush()?;
    drop(child_stdin);
    for receipt in &run.inputs {
        writer.emit(
            &run_id,
            "input.accepted",
            json!({"request_id": receipt.request_id, "byte_length": receipt.byte_length}),
        )?;
    }

    let child_stdout = child
        .stdout
        .take()
        .ok_or_else(|| RunnerError::Execution("child stdout pipe is unavailable".to_string()))?;
    let child_stderr = child
        .stderr
        .take()
        .ok_or_else(|| RunnerError::Execution("child stderr pipe is unavailable".to_string()))?;
    let (sender, receiver) = mpsc::channel();
    let stdout_thread = spawn_reader(child_stdout, StreamKind::Stdout, sender.clone());
    let stderr_thread = spawn_reader(child_stderr, StreamKind::Stderr, sender);

    let (exit_code, timed_out, streams) = wait_for_exit(
        &mut child,
        &receiver,
        &mut writer,
        &run_id,
        Duration::from_millis(run.start.timeout_ms),
    )?;
    stdout_thread
        .join()
        .map_err(|_| RunnerError::Execution("stdout reader panicked".to_string()))?;
    stderr_thread
        .join()
        .map_err(|_| RunnerError::Execution("stderr reader panicked".to_string()))?;

    let (status, termination_reason) = if timed_out {
        ("timed_out", "timeout_root_kill")
    } else if exit_code == Some(0) {
        ("succeeded", "exit_zero")
    } else {
        ("failed", "exit_nonzero")
    };
    writer.emit(
        &run_id,
        "process.exited",
        json!({
            "pid": pid,
            "exit_code": exit_code,
            "termination_reason": termination_reason,
            "timed_out": timed_out
        }),
    )?;
    let stdout_final_sequence = writer.stream_sequence(StreamKind::Stdout);
    let stderr_final_sequence = writer.stream_sequence(StreamKind::Stderr);
    writer.emit(
        &run_id,
        "stdout.drained",
        json!({"final_sequence": stdout_final_sequence}),
    )?;
    writer.emit(
        &run_id,
        "stderr.drained",
        json!({"final_sequence": stderr_final_sequence}),
    )?;
    writer.emit(
        &run_id,
        "boundary.snapshot",
        json!({
            "boundary_id": boundary_id,
            "active_processes": 0,
            "containment_applied": false,
            "observation_scope": "root_only",
            "stdout_drained": streams.stdout_done,
            "stderr_drained": streams.stderr_done
        }),
    )?;
    writer.emit(
        &run_id,
        "run.completed",
        json!({
            "status": status,
            "exit_code": exit_code,
            "termination_reason": termination_reason,
            "containment_applied": false,
            "observation_scope": "root_only"
        }),
    )?;
    Ok(())
}

const BASE64_TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

fn encode_base64(bytes: &[u8]) -> String {
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

fn decode_base64(value: &str) -> Result<Vec<u8>, RunnerError> {
    if value.is_empty() {
        return Ok(Vec::new());
    }
    let encoded = value.as_bytes();
    if encoded.len() % 4 != 0 {
        return Err(protocol_error("bytes_base64 must be canonical standard Base64"));
    }
    let mut output = Vec::with_capacity(encoded.len() / 4 * 3);
    let chunk_count = encoded.len() / 4;
    for (index, chunk) in encoded.chunks_exact(4).enumerate() {
        let is_last = index + 1 == chunk_count;
        let padding = usize::from(chunk[3] == b'=') + usize::from(chunk[2] == b'=');
        if padding > 0 && !is_last {
            return Err(protocol_error("Base64 padding is only allowed at the end"));
        }
        if chunk[2] == b'=' && chunk[3] != b'=' {
            return Err(protocol_error("bytes_base64 padding is invalid"));
        }
        let first = base64_value(chunk[0])
            .ok_or_else(|| protocol_error("bytes_base64 character is invalid"))?;
        let second = base64_value(chunk[1])
            .ok_or_else(|| protocol_error("bytes_base64 character is invalid"))?;
        let third = if chunk[2] == b'=' {
            0
        } else {
            base64_value(chunk[2])
                .ok_or_else(|| protocol_error("bytes_base64 character is invalid"))?
        };
        let fourth = if chunk[3] == b'=' {
            0
        } else {
            base64_value(chunk[3])
                .ok_or_else(|| protocol_error("bytes_base64 character is invalid"))?
        };
        output.push((first << 2) | (second >> 4));
        if padding < 2 {
            output.push((second << 4) | (third >> 2));
        }
        if padding == 0 {
            output.push((third << 6) | fourth);
        }
    }
    if encode_base64(&output) != value {
        return Err(protocol_error("bytes_base64 must be canonical standard Base64"));
    }
    Ok(output)
}

fn timestamp_now() -> String {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let total_seconds = duration.as_secs() as i64;
    let days = total_seconds.div_euclid(86_400);
    let seconds_of_day = total_seconds.rem_euclid(86_400);
    let (year, month, day) = civil_from_days(days);
    let hour = seconds_of_day / 3_600;
    let minute = seconds_of_day % 3_600 / 60;
    let second = seconds_of_day % 60;
    format!(
        "{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}.{:03}Z",
        duration.subsec_millis()
    )
}

fn civil_from_days(days_since_epoch: i64) -> (i64, i64, i64) {
    let shifted = days_since_epoch + 719_468;
    let era = if shifted >= 0 {
        shifted
    } else {
        shifted - 146_096
    } / 146_097;
    let day_of_era = shifted - era * 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096)
            / 365;
    let mut year = year_of_era + era * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_prime = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_prime + 2) / 5 + 1;
    let month = month_prime + if month_prime < 10 { 3 } else { -9 };
    year += i64::from(month <= 2);
    (year, month, day)
}

fn main() {
    let mut input = String::new();
    let result = io::stdin()
        .read_to_string(&mut input)
        .map_err(RunnerError::from)
        .and_then(|_| parse_batch(&input))
        .and_then(execute);
    if let Err(error) = result {
        eprintln!("{error}");
        std::process::exit(1);
    }
}

#[cfg(test)]
mod tests {
    use super::{decode_base64, encode_base64};

    #[test]
    fn standard_base64_round_trips() {
        for bytes in [b"".as_slice(), b"f", b"fo", b"foo", "世界".as_bytes()] {
            let encoded = encode_base64(bytes);
            assert_eq!(decode_base64(&encoded).expect("decode"), bytes);
        }
    }

    #[test]
    fn noncanonical_base64_is_rejected() {
        assert!(decode_base64("***=").is_err());
        assert!(decode_base64("Zg").is_err());
        assert!(decode_base64("Zh==").is_err());
    }
}
