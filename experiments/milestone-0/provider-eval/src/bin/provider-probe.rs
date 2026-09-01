use std::process::ExitCode;

use serde::Serialize;

#[derive(Debug, Serialize)]
struct ProbeReport {
    schema: &'static str,
    candidate: &'static str,
    candidate_version: String,
    platform: &'static str,
    architecture: &'static str,
    probe_level: &'static str,
    mechanism_source: &'static str,
    mechanism: String,
    spawn_attempted: bool,
    spawn_ok: bool,
    membership_observable: bool,
    owner_exit_cleanup_scope: String,
    primitive_ok: bool,
}

fn processkit_report() -> Result<ProbeReport, String> {
    let host = processkit::host_containment();
    Ok(ProbeReport {
        schema: "containment-provider-probe-v0",
        candidate: "processkit",
        candidate_version: host.crate_version().to_owned(),
        platform: std::env::consts::OS,
        architecture: std::env::consts::ARCH,
        probe_level: "host_preflight",
        mechanism_source: "runtime_reported",
        mechanism: host.mechanism().name().to_owned(),
        spawn_attempted: false,
        spawn_ok: false,
        membership_observable: true,
        owner_exit_cleanup_scope: host.parent_death_cleanup().name().to_owned(),
        primitive_ok: true,
    })
}

#[cfg(windows)]
fn process_wrap_spawn() -> Result<&'static str, String> {
    use process_wrap::std::*;

    let executable = std::env::current_exe().map_err(|error| error.to_string())?;
    let mut child = CommandWrap::with_new(executable, |command| {
        command.arg("--probe-child");
    })
    .wrap(JobObject)
    .spawn()
    .map_err(|error| error.to_string())?;
    let status = child.wait().map_err(|error| error.to_string())?;
    if !status.success() {
        return Err(format!("wrapped child exited with {status}"));
    }
    Ok("job_object")
}

#[cfg(unix)]
fn process_wrap_spawn() -> Result<&'static str, String> {
    use process_wrap::std::*;

    let executable = std::env::current_exe().map_err(|error| error.to_string())?;
    let mut child = CommandWrap::with_new(executable, |command| {
        command.arg("--probe-child");
    })
    .wrap(ProcessGroup::leader())
    .spawn()
    .map_err(|error| error.to_string())?;
    let status = child.wait().map_err(|error| error.to_string())?;
    if !status.success() {
        return Err(format!("wrapped child exited with {status}"));
    }
    Ok("process_group")
}

fn process_wrap_report() -> Result<ProbeReport, String> {
    let mechanism = process_wrap_spawn()?;
    Ok(ProbeReport {
        schema: "containment-provider-probe-v0",
        candidate: "process-wrap",
        candidate_version: "10.0.0".to_owned(),
        platform: std::env::consts::OS,
        architecture: std::env::consts::ARCH,
        probe_level: "configured_wrapper_spawn",
        mechanism_source: "configured_wrapper",
        mechanism: mechanism.to_owned(),
        spawn_attempted: true,
        spawn_ok: true,
        membership_observable: false,
        owner_exit_cleanup_scope: "not_provided_by_std_wrapper".to_owned(),
        primitive_ok: true,
    })
}

#[cfg(windows)]
fn direct_os_primitive() -> Result<&'static str, String> {
    use windows::Win32::{Foundation::CloseHandle, System::JobObjects::CreateJobObjectW};

    let job = unsafe { CreateJobObjectW(None, None) }.map_err(|error| error.to_string())?;
    unsafe { CloseHandle(job) }.map_err(|error| error.to_string())?;
    Ok("job_object_create_close")
}

#[cfg(unix)]
fn direct_os_primitive() -> Result<&'static str, String> {
    let pgid = unsafe { libc::getpgrp() };
    if pgid <= 0 {
        return Err(format!("getpgrp returned invalid pgid {pgid}"));
    }
    Ok("getpgrp")
}

fn direct_os_report() -> Result<ProbeReport, String> {
    let mechanism = direct_os_primitive()?;
    Ok(ProbeReport {
        schema: "containment-provider-probe-v0",
        candidate: "direct-os",
        candidate_version: "project-owned".to_owned(),
        platform: std::env::consts::OS,
        architecture: std::env::consts::ARCH,
        probe_level: "primitive_only",
        mechanism_source: "project_owned_primitive",
        mechanism: mechanism.to_owned(),
        spawn_attempted: false,
        spawn_ok: false,
        membership_observable: false,
        owner_exit_cleanup_scope: "not_proven".to_owned(),
        primitive_ok: true,
    })
}

fn run() -> Result<(), String> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.as_slice() == ["--probe-child"] {
        return Ok(());
    }
    if args.len() != 2 || args[0] != "--candidate" {
        return Err(
            "usage: provider-probe --candidate <processkit|process-wrap|direct-os>".to_owned(),
        );
    }
    let report = match args[1].as_str() {
        "processkit" => processkit_report()?,
        "process-wrap" => process_wrap_report()?,
        "direct-os" => direct_os_report()?,
        other => return Err(format!("unknown candidate: {other}")),
    };
    let json = serde_json::to_string(&report).map_err(|error| error.to_string())?;
    println!("{json}");
    Ok(())
}

fn main() -> ExitCode {
    match run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("ProbeError: {error}");
            ExitCode::from(1)
        }
    }
}
