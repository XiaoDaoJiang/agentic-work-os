use serde::{Deserialize, Serialize};

pub const STILL_ACTIVE_EXIT_CODE: u32 = 259;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Win32OpenState {
    Opened,
    NotFound,
    AccessDenied,
    Failed,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Win32WaitState {
    Signaled,
    Timeout,
    Failed,
    Unavailable,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct WindowsProcessTruth {
    pub pid: u32,
    pub expected_creation_time: Option<u64>,
    pub observed_creation_time: Option<u64>,
    pub open_state: Win32OpenState,
    pub exit_code: Option<u32>,
    pub wait_state: Win32WaitState,
    pub processkit_alive: Option<bool>,
    pub job_member: Option<bool>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum WindowsTruthVerdict {
    ActiveOriginal,
    TerminatedOriginal,
    ReusedPid,
    Gone,
    Inconclusive,
}

pub fn classify_windows_process_truth(truth: &WindowsProcessTruth) -> WindowsTruthVerdict {
    match truth.open_state {
        Win32OpenState::NotFound => {
            if truth.processkit_alive == Some(true) || truth.job_member == Some(true) {
                return WindowsTruthVerdict::Inconclusive;
            }
            return WindowsTruthVerdict::Gone;
        }
        Win32OpenState::AccessDenied | Win32OpenState::Failed => {
            return WindowsTruthVerdict::Inconclusive;
        }
        Win32OpenState::Opened => {}
    }

    let (Some(expected_creation_time), Some(observed_creation_time)) =
        (truth.expected_creation_time, truth.observed_creation_time)
    else {
        return WindowsTruthVerdict::Inconclusive;
    };

    if expected_creation_time != observed_creation_time {
        return WindowsTruthVerdict::ReusedPid;
    }

    match (truth.exit_code, truth.wait_state) {
        (Some(STILL_ACTIVE_EXIT_CODE), Win32WaitState::Timeout) => {
            WindowsTruthVerdict::ActiveOriginal
        }
        (Some(exit_code), Win32WaitState::Signaled) if exit_code != STILL_ACTIVE_EXIT_CODE => {
            WindowsTruthVerdict::TerminatedOriginal
        }
        _ => WindowsTruthVerdict::Inconclusive,
    }
}

#[cfg(windows)]
pub fn observe_windows_process_truth(
    pid: u32,
    expected_creation_time: Option<u64>,
    processkit_alive: Option<bool>,
    job_member: Option<bool>,
) -> WindowsProcessTruth {
    use win32::{
        CloseHandle, ERROR_ACCESS_DENIED, ERROR_INVALID_PARAMETER, GetExitCodeProcess,
        GetLastError, GetProcessTimes, OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION,
        WAIT_FAILED, WAIT_OBJECT_0, WAIT_TIMEOUT, WaitForSingleObject,
    };

    // SAFETY: query-only access to the process identified by `pid`; a null handle
    // is classified below and no ownership is inferred from a successful open.
    let handle = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid) };
    if handle.is_null() {
        // SAFETY: GetLastError has no preconditions and is read immediately after
        // the failed OpenProcess call.
        let error = unsafe { GetLastError() };
        let open_state = match error {
            ERROR_INVALID_PARAMETER => Win32OpenState::NotFound,
            ERROR_ACCESS_DENIED => Win32OpenState::AccessDenied,
            _ => Win32OpenState::Failed,
        };
        return WindowsProcessTruth {
            pid,
            expected_creation_time,
            observed_creation_time: None,
            open_state,
            exit_code: None,
            wait_state: Win32WaitState::Unavailable,
            processkit_alive,
            job_member,
        };
    }

    let mut creation = win32::FileTime::default();
    let mut exit = win32::FileTime::default();
    let mut kernel = win32::FileTime::default();
    let mut user = win32::FileTime::default();
    // SAFETY: `handle` is a valid query handle and all FILETIME pointers are valid.
    let times_ok = unsafe {
        GetProcessTimes(
            handle,
            &mut creation,
            &mut exit,
            &mut kernel,
            &mut user,
        )
    } != 0;
    let observed_creation_time = times_ok.then(|| filetime_units(creation));

    let mut code = 0_u32;
    // SAFETY: `handle` is a valid query handle and `code` is writable.
    let code_ok = unsafe { GetExitCodeProcess(handle, &mut code) } != 0;
    let exit_code = code_ok.then_some(code);

    // SAFETY: zero-timeout observation of a valid process handle; this does not
    // mutate or terminate the process.
    let wait_state = match unsafe { WaitForSingleObject(handle, 0) } {
        WAIT_OBJECT_0 => Win32WaitState::Signaled,
        WAIT_TIMEOUT => Win32WaitState::Timeout,
        WAIT_FAILED => Win32WaitState::Failed,
        _ => Win32WaitState::Failed,
    };

    // SAFETY: this function owns the handle returned by OpenProcess and closes it
    // exactly once after all observations are complete.
    unsafe { CloseHandle(handle) };

    WindowsProcessTruth {
        pid,
        expected_creation_time,
        observed_creation_time,
        open_state: Win32OpenState::Opened,
        exit_code,
        wait_state,
        processkit_alive,
        job_member,
    }
}

#[cfg(windows)]
fn filetime_units(filetime: win32::FileTime) -> u64 {
    ((filetime.high as u64) << 32) | filetime.low as u64
}

#[cfg(windows)]
mod win32 {
    use std::ffi::c_void;

    pub type Handle = *mut c_void;
    pub const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;
    pub const ERROR_ACCESS_DENIED: u32 = 5;
    pub const ERROR_INVALID_PARAMETER: u32 = 87;
    pub const WAIT_OBJECT_0: u32 = 0;
    pub const WAIT_TIMEOUT: u32 = 258;
    pub const WAIT_FAILED: u32 = 0xffff_ffff;

    #[repr(C)]
    #[derive(Debug, Clone, Copy, Default)]
    pub struct FileTime {
        pub low: u32,
        pub high: u32,
    }

    #[link(name = "kernel32")]
    unsafe extern "system" {
        pub fn OpenProcess(desired_access: u32, inherit_handle: i32, process_id: u32) -> Handle;
        pub fn GetProcessTimes(
            process: Handle,
            creation_time: *mut FileTime,
            exit_time: *mut FileTime,
            kernel_time: *mut FileTime,
            user_time: *mut FileTime,
        ) -> i32;
        pub fn GetExitCodeProcess(process: Handle, exit_code: *mut u32) -> i32;
        pub fn WaitForSingleObject(handle: Handle, milliseconds: u32) -> u32;
        pub fn CloseHandle(object: Handle) -> i32;
        pub fn GetLastError() -> u32;
    }
}
