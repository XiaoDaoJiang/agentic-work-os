use std::io::{self, Write};
use std::pin::Pin;
use std::sync::{Arc, Mutex};
use std::task::{Context, Poll};
use std::time::{SystemTime, UNIX_EPOCH};

use serde_json::{json, Value};
use tokio::io::AsyncWrite;

use crate::protocol::{encode_base64, RUNNER_PROTOCOL};

struct WriterState {
    output: Box<dyn Write + Send>,
    sequence: u64,
    stdout_sequence: u64,
    stderr_sequence: u64,
}

#[derive(Clone)]
pub struct EventWriter {
    state: Arc<Mutex<WriterState>>,
}

impl EventWriter {
    pub fn new<W>(output: W) -> Self
    where
        W: Write + Send + 'static,
    {
        Self {
            state: Arc::new(Mutex::new(WriterState {
                output: Box::new(output),
                sequence: 0,
                stdout_sequence: 0,
                stderr_sequence: 0,
            })),
        }
    }

    pub fn emit(&self, run_id: &str, event: &str, payload: Value) -> io::Result<u64> {
        let mut state = self
            .state
            .lock()
            .map_err(|_| io::Error::other("event writer mutex is poisoned"))?;
        state.sequence += 1;
        let sequence = state.sequence;
        let envelope = json!({
            "protocol": RUNNER_PROTOCOL,
            "sequence": sequence,
            "at": timestamp_now(),
            "event": event,
            "run_id": run_id,
            "payload": payload
        });
        serde_json::to_writer(&mut state.output, &envelope).map_err(io::Error::other)?;
        state.output.write_all(b"\n")?;
        state.output.flush()?;
        Ok(sequence)
    }

    pub fn stream_tee(&self, run_id: impl Into<String>, stream: StreamName) -> StreamTee {
        StreamTee {
            writer: self.clone(),
            run_id: run_id.into(),
            stream,
        }
    }

    fn emit_stream(&self, run_id: &str, stream: StreamName, bytes: &[u8]) -> io::Result<()> {
        if bytes.is_empty() {
            return Ok(());
        }
        let mut state = self
            .state
            .lock()
            .map_err(|_| io::Error::other("event writer mutex is poisoned"))?;
        let stream_sequence = match stream {
            StreamName::Stdout => {
                state.stdout_sequence += 1;
                state.stdout_sequence
            }
            StreamName::Stderr => {
                state.stderr_sequence += 1;
                state.stderr_sequence
            }
        };
        state.sequence += 1;
        let sequence = state.sequence;
        let envelope = json!({
            "protocol": RUNNER_PROTOCOL,
            "sequence": sequence,
            "at": timestamp_now(),
            "event": stream.event_name(),
            "run_id": run_id,
            "payload": {
                "stream_sequence": stream_sequence,
                "bytes_base64": encode_base64(bytes),
                "byte_length": bytes.len()
            }
        });
        serde_json::to_writer(&mut state.output, &envelope).map_err(io::Error::other)?;
        state.output.write_all(b"\n")?;
        state.output.flush()?;
        Ok(())
    }
}

#[derive(Debug, Clone, Copy)]
pub enum StreamName {
    Stdout,
    Stderr,
}

impl StreamName {
    fn event_name(self) -> &'static str {
        match self {
            Self::Stdout => "stdout.frame",
            Self::Stderr => "stderr.frame",
        }
    }
}

pub struct StreamTee {
    writer: EventWriter,
    run_id: String,
    stream: StreamName,
}

impl AsyncWrite for StreamTee {
    fn poll_write(
        self: Pin<&mut Self>,
        _context: &mut Context<'_>,
        bytes: &[u8],
    ) -> Poll<io::Result<usize>> {
        match self.writer.emit_stream(&self.run_id, self.stream, bytes) {
            Ok(()) => Poll::Ready(Ok(bytes.len())),
            Err(error) => Poll::Ready(Err(error)),
        }
    }

    fn poll_flush(self: Pin<&mut Self>, _context: &mut Context<'_>) -> Poll<io::Result<()>> {
        Poll::Ready(Ok(()))
    }

    fn poll_shutdown(self: Pin<&mut Self>, _context: &mut Context<'_>) -> Poll<io::Result<()>> {
        Poll::Ready(Ok(()))
    }
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
