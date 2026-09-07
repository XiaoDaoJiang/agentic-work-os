use std::process::ExitCode;

use agentic_native_runner::hostile_probe::{HostileProbeConfig, run_probe};

#[tokio::main]
async fn main() -> ExitCode {
    let config = match HostileProbeConfig::parse(std::env::args_os().skip(1)) {
        Ok(config) => config,
        Err(error) => {
            eprintln!("UsageError: {error}");
            return ExitCode::from(2);
        }
    };

    match run_probe(config).await {
        Ok(summary) => match serde_json::to_string(&summary) {
            Ok(document) => {
                println!("{document}");
                ExitCode::SUCCESS
            }
            Err(error) => {
                eprintln!("SerializationError: {error}");
                ExitCode::from(1)
            }
        },
        Err(error) => {
            eprintln!("ProbeError: {error}");
            ExitCode::from(1)
        }
    }
}
