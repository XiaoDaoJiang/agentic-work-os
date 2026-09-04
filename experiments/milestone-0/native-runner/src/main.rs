mod capabilities;

use std::process::ExitCode;

fn usage_error(message: &str) -> ExitCode {
    eprintln!("UsageError: {message}");
    ExitCode::from(2)
}

fn doctor() -> ExitCode {
    match capabilities::detect_capabilities() {
        Ok(capabilities) => match serde_json::to_string(&capabilities) {
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
            eprintln!("CapabilityError: {error}");
            ExitCode::from(1)
        }
    }
}

fn main() -> ExitCode {
    let mut args = std::env::args().skip(1);
    match (args.next().as_deref(), args.next()) {
        (Some("doctor"), None) => doctor(),
        (None, None) => usage_error("expected command: doctor"),
        (Some(command), None) => usage_error(&format!("unknown command: {command}")),
        _ => usage_error("doctor does not accept additional arguments"),
    }
}
