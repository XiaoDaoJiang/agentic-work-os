param(
  [Parameter(Mandatory=$true)][string]$LaunchSpec,
  [Parameter(Mandatory=$true)][string]$ControlFile,
  [Parameter(Mandatory=$true)][string]$CancelFile,
  [int]$PollIntervalMs = 25
)
$ErrorActionPreference = 'Stop'
if ($PollIntervalMs -le 0) { throw 'PollIntervalMs must be positive' }

$nativeSource = @"
using System;
using System.Text;
using System.Runtime.InteropServices;
using System.Collections.Generic;

namespace M0JobRunner {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct STARTUPINFO {
    public Int32 cb;
    public string lpReserved;
    public string lpDesktop;
    public string lpTitle;
    public Int32 dwX, dwY, dwXSize, dwYSize, dwXCountChars, dwYCountChars, dwFillAttribute, dwFlags;
    public Int16 wShowWindow, cbReserved2;
    public IntPtr lpReserved2, hStdInput, hStdOutput, hStdError;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct PROCESS_INFORMATION {
    public IntPtr hProcess;
    public IntPtr hThread;
    public UInt32 dwProcessId;
    public UInt32 dwThreadId;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct JOBOBJECT_BASIC_LIMIT_INFORMATION {
    public Int64 PerProcessUserTimeLimit;
    public Int64 PerJobUserTimeLimit;
    public UInt32 LimitFlags;
    public UIntPtr MinimumWorkingSetSize;
    public UIntPtr MaximumWorkingSetSize;
    public UInt32 ActiveProcessLimit;
    public UIntPtr Affinity;
    public UInt32 PriorityClass;
    public UInt32 SchedulingClass;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct IO_COUNTERS {
    public UInt64 ReadOperationCount, WriteOperationCount, OtherOperationCount;
    public UInt64 ReadTransferCount, WriteTransferCount, OtherTransferCount;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION {
    public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
    public IO_COUNTERS IoInfo;
    public UIntPtr ProcessMemoryLimit, JobMemoryLimit, PeakProcessMemoryUsed, PeakJobMemoryUsed;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct JOBOBJECT_BASIC_ACCOUNTING_INFORMATION {
    public Int64 TotalUserTime, TotalKernelTime, ThisPeriodTotalUserTime, ThisPeriodTotalKernelTime;
    public UInt32 TotalPageFaultCount, TotalProcesses, ActiveProcesses, TotalTerminatedProcesses;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct FILETIME {
    public UInt32 dwLowDateTime;
    public UInt32 dwHighDateTime;
  }

  public sealed class JobContext {
    public IntPtr Job;
    public IntPtr Process;
    public IntPtr Thread;
    public UInt32 ProcessId;
    public DateTime CreatedAtUtc;
  }

  public static class Native {
    public const UInt32 CREATE_SUSPENDED = 0x00000004;
    public const UInt32 STARTF_USESTDHANDLES = 0x00000100;
    public const UInt32 JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x00002000;
    public const Int32 JobObjectBasicAccountingInformation = 1;
    public const Int32 JobObjectBasicProcessIdList = 3;
    public const Int32 JobObjectExtendedLimitInformation = 9;
    public const UInt32 PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
    public const UInt32 WAIT_OBJECT_0 = 0;
    public const UInt32 WAIT_TIMEOUT = 258;
    public const UInt32 HANDLE_FLAG_INHERIT = 0x00000001;
    public const Int32 STD_INPUT_HANDLE = -10, STD_OUTPUT_HANDLE = -11, STD_ERROR_HANDLE = -12;

    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
    public static extern IntPtr CreateJobObjectW(IntPtr attributes, string name);
    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern bool SetInformationJobObject(IntPtr job, int infoClass, ref JOBOBJECT_EXTENDED_LIMIT_INFORMATION info, uint length);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
    public static extern bool CreateProcessW(string applicationName, StringBuilder commandLine, IntPtr processAttributes, IntPtr threadAttributes, bool inheritHandles, uint creationFlags, IntPtr environment, string currentDirectory, ref STARTUPINFO startupInfo, out PROCESS_INFORMATION processInformation);
    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern uint ResumeThread(IntPtr thread);
    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern bool QueryInformationJobObject(IntPtr job, int infoClass, IntPtr info, uint length, IntPtr returnLength);
    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern bool QueryInformationJobObject(IntPtr job, int infoClass, ref JOBOBJECT_BASIC_ACCOUNTING_INFORMATION info, uint length, IntPtr returnLength);
    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern bool TerminateJobObject(IntPtr job, uint exitCode);
    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern bool TerminateProcess(IntPtr process, uint exitCode);
    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);
    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern bool GetExitCodeProcess(IntPtr process, out uint exitCode);
    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern bool GetProcessTimes(IntPtr process, out FILETIME creation, out FILETIME exit, out FILETIME kernel, out FILETIME user);
    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern IntPtr OpenProcess(uint access, bool inheritHandle, uint processId);
    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern bool CloseHandle(IntPtr handle);
    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern IntPtr GetStdHandle(int stdHandle);
    [DllImport("kernel32.dll", SetLastError=true)]
    public static extern bool SetHandleInformation(IntPtr handle, uint mask, uint flags);

    static Exception Win32(string operation) {
      return new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(), operation);
    }
    static string Quote(string value) {
      if (value.Length == 0) return "\"\"";
      bool needs = value.IndexOfAny(new char[]{' ', '\t', '\n', '\v', '"'}) >= 0;
      if (!needs) return value;
      var b = new StringBuilder("\"");
      int slashes = 0;
      foreach (char c in value) {
        if (c == '\\') { slashes++; continue; }
        if (c == '"') {
          b.Append('\\', slashes * 2 + 1).Append('"'); slashes = 0; continue;
        }
        b.Append('\\', slashes).Append(c); slashes = 0;
      }
      b.Append('\\', slashes * 2).Append('"');
      return b.ToString();
    }
    static DateTime FileTimeUtc(FILETIME value) {
      long ticks = ((long)value.dwHighDateTime << 32) | value.dwLowDateTime;
      return DateTime.FromFileTimeUtc(ticks);
    }
    static DateTime CreationUtc(IntPtr process) {
      FILETIME c,e,k,u;
      if (!GetProcessTimes(process, out c, out e, out k, out u)) throw Win32("GetProcessTimes");
      return FileTimeUtc(c);
    }

    public static JobContext Start(string program, string[] argv, string cwd) {
      IntPtr job = CreateJobObjectW(IntPtr.Zero, null);
      if (job == IntPtr.Zero) throw Win32("CreateJobObjectW");
      PROCESS_INFORMATION pi = new PROCESS_INFORMATION();
      bool processCreated = false;
      try {
        var limits = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
        limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        if (!SetInformationJobObject(job, JobObjectExtendedLimitInformation, ref limits, (uint)Marshal.SizeOf(typeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION)))) throw Win32("SetInformationJobObject");

        var si = new STARTUPINFO();
        si.cb = Marshal.SizeOf(typeof(STARTUPINFO));
        si.dwFlags = (int)STARTF_USESTDHANDLES;
        si.hStdInput = GetStdHandle(STD_INPUT_HANDLE);
        si.hStdOutput = GetStdHandle(STD_OUTPUT_HANDLE);
        si.hStdError = GetStdHandle(STD_ERROR_HANDLE);
        foreach (IntPtr h in new IntPtr[]{si.hStdInput, si.hStdOutput, si.hStdError}) {
          if (h != IntPtr.Zero && h.ToInt64() != -1) SetHandleInformation(h, HANDLE_FLAG_INHERIT, HANDLE_FLAG_INHERIT);
        }

        var command = new StringBuilder();
        command.Append(Quote(program));
        foreach (string arg in argv) command.Append(' ').Append(Quote(arg ?? ""));
        if (!Native.CreateProcessW(program, command, IntPtr.Zero, IntPtr.Zero, true, CREATE_SUSPENDED, IntPtr.Zero, cwd, ref si, out pi)) throw Win32("CreateProcessW");
        processCreated = true;

        if (!Native.AssignProcessToJobObject(job, pi.hProcess)) throw Win32("AssignProcessToJobObject");
        DateTime created = CreationUtc(pi.hProcess);
        if (Native.ResumeThread(pi.hThread) == 0xFFFFFFFF) throw Win32("ResumeThread");

        return new JobContext { Job=job, Process=pi.hProcess, Thread=pi.hThread, ProcessId=pi.dwProcessId, CreatedAtUtc=created };
      } catch {
        if (processCreated && pi.hProcess != IntPtr.Zero) TerminateProcess(pi.hProcess, 197);
        if (pi.hThread != IntPtr.Zero) CloseHandle(pi.hThread);
        if (pi.hProcess != IntPtr.Zero) CloseHandle(pi.hProcess);
        CloseHandle(job);
        throw;
      }
    }

    public static uint QueryActive(IntPtr job) {
      var info = new JOBOBJECT_BASIC_ACCOUNTING_INFORMATION();
      if (!QueryInformationJobObject(job, JobObjectBasicAccountingInformation, ref info, (uint)Marshal.SizeOf(typeof(JOBOBJECT_BASIC_ACCOUNTING_INFORMATION)), IntPtr.Zero)) throw Win32("QueryInformationJobObject accounting");
      return info.ActiveProcesses;
    }

    public static uint[] QueryProcessIds(IntPtr job) {
      const int capacity = 1024;
      int bytes = 8 + IntPtr.Size * capacity;
      IntPtr buffer = Marshal.AllocHGlobal(bytes);
      try {
        for (int i=0;i<bytes;i++) Marshal.WriteByte(buffer,i,0);
        if (!QueryInformationJobObject(job, JobObjectBasicProcessIdList, buffer, (uint)bytes, IntPtr.Zero)) throw Win32("QueryInformationJobObject process list");
        uint count = (uint)Marshal.ReadInt32(buffer, 4);
        if (count > capacity) throw new InvalidOperationException("Job process list exceeded fixed experiment capacity");
        var ids = new List<uint>();
        int offset = 8;
        for (uint i=0;i<count;i++) {
          ulong raw = IntPtr.Size == 8 ? (ulong)Marshal.ReadInt64(buffer, offset + (int)i*IntPtr.Size) : (uint)Marshal.ReadInt32(buffer, offset + (int)i*IntPtr.Size);
          ids.Add((uint)raw);
        }
        return ids.ToArray();
      } finally { Marshal.FreeHGlobal(buffer); }
    }

    public static DateTime GetProcessCreationUtc(uint pid) {
      IntPtr process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
      if (process == IntPtr.Zero) throw Win32("OpenProcess");
      try { return CreationUtc(process); } finally { CloseHandle(process); }
    }

    public static bool IsRootExited(JobContext ctx) {
      uint result = WaitForSingleObject(ctx.Process, 0);
      if (result == WAIT_OBJECT_0) return true;
      if (result == WAIT_TIMEOUT) return false;
      throw Win32("WaitForSingleObject");
    }

    public static int RootExitCode(JobContext ctx) {
      uint code;
      if (!GetExitCodeProcess(ctx.Process, out code)) throw Win32("GetExitCodeProcess");
      return unchecked((int)code);
    }

    public static void Terminate(JobContext ctx, uint exitCode) {
      if (!TerminateJobObject(ctx.Job, exitCode)) throw Win32("TerminateJobObject");
    }

    public static void Close(JobContext ctx) {
      if (ctx == null) return;
      if (ctx.Thread != IntPtr.Zero) CloseHandle(ctx.Thread);
      if (ctx.Process != IntPtr.Zero) CloseHandle(ctx.Process);
      if (ctx.Job != IntPtr.Zero) CloseHandle(ctx.Job);
      ctx.Thread=ctx.Process=ctx.Job=IntPtr.Zero;
    }
  }
}
"@
Add-Type -TypeDefinition $nativeSource -Language CSharp

function Decode-LaunchSpec([string]$value) {
  $base64 = $value.Replace('-','+').Replace('_','/')
  switch ($base64.Length % 4) { 2 {$base64 += '=='} 3 {$base64 += '='} 1 {throw 'invalid launch spec padding'} }
  $json = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($base64))
  $spec = $json | ConvertFrom-Json
  if (-not $spec.program -or -not $spec.cwd -or $null -eq $spec.argv) { throw 'launch spec is incomplete' }
  return $spec
}

$controlDir = [IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($ControlFile))
if ($controlDir) { [IO.Directory]::CreateDirectory($controlDir) | Out-Null }
$utf8 = New-Object Text.UTF8Encoding($false)
$writer = New-Object IO.StreamWriter([IO.Path]::GetFullPath($ControlFile), $false, $utf8)
$writer.AutoFlush = $true
$sequence = 0
function Write-Frame([string]$kind, $payload) {
  $script:sequence += 1
  $frame = [ordered]@{ sequence=$script:sequence; at=[DateTime]::UtcNow.ToString('o'); kind=$kind; payload=$payload }
  $script:writer.WriteLine(($frame | ConvertTo-Json -Compress -Depth 8))
}

$ctx = $null
$helperExit = 0
try {
  $spec = Decode-LaunchSpec $LaunchSpec
  $argv = @($spec.argv | ForEach-Object { [string]$_ })
  $ctx = [M0JobRunner.Native]::Start([string]$spec.program, $argv, [string]$spec.cwd)
  $boundaryId = 'job-' + [Guid]::NewGuid().ToString('N')
  $rootCreated = $ctx.CreatedAtUtc.ToString('o')
  Write-Frame 'boundary.created' ([ordered]@{boundaryId=$boundaryId;rootPid=[int]$ctx.ProcessId;rootCreatedAt=$rootCreated})
  Write-Frame 'process.assigned' ([ordered]@{pid=[int]$ctx.ProcessId;createdAt=$rootCreated;role='root'})

  $known = @{}
  $known[[string]$ctx.ProcessId] = $true
  $exited = @{}
  $cancelHandled = $false
  $lastActive = -1

  while ($true) {
    $ids = @([M0JobRunner.Native]::QueryProcessIds($ctx.Job))
    foreach ($pidValue in $ids) {
      $key = [string]$pidValue
      if (-not $known.ContainsKey($key)) {
        $created = [M0JobRunner.Native]::GetProcessCreationUtc([uint32]$pidValue).ToString('o')
        Write-Frame 'process.assigned' ([ordered]@{pid=[int]$pidValue;createdAt=$created;role='job-member'})
        $known[$key] = $true
      }
    }

    $activeSet = @{}
    foreach ($pidValue in $ids) { $activeSet[[string]$pidValue] = $true }
    foreach ($key in @($known.Keys)) {
      if (-not $activeSet.ContainsKey($key) -and -not $exited.ContainsKey($key)) {
        $pidValue = [uint32]$key
        $exitCode = $null
        if ($pidValue -eq $ctx.ProcessId -and [M0JobRunner.Native]::IsRootExited($ctx)) { $exitCode = [M0JobRunner.Native]::RootExitCode($ctx) }
        Write-Frame 'process.exited' ([ordered]@{pid=[int]$pidValue;exitCode=$exitCode;signal=$null})
        $exited[$key] = $true
      }
    }

    $active = [int][M0JobRunner.Native]::QueryActive($ctx.Job)
    if ($active -ne $lastActive) {
      Write-Frame 'boundary.snapshot' ([ordered]@{activeProcesses=$active})
      $lastActive = $active
    }

    if (-not $cancelHandled -and [IO.File]::Exists($CancelFile)) {
      $requestId = 'cancel'
      try {
        $cancelDoc = [IO.File]::ReadAllText($CancelFile) | ConvertFrom-Json
        if ($cancelDoc.requestId) { $requestId = [string]$cancelDoc.requestId }
      } catch {}
      Write-Frame 'cancel.requested' ([ordered]@{requestId=$requestId})
      Write-Frame 'boundary.terminate.started' ([ordered]@{reason='cancel'})
      [M0JobRunner.Native]::Terminate($ctx, 197)
      Write-Frame 'boundary.terminate.completed' ([ordered]@{reason='cancel'})
      $cancelHandled = $true
    }

    if ($active -eq 0) { break }
    Start-Sleep -Milliseconds $PollIntervalMs
  }

  foreach ($key in @($known.Keys)) {
    if (-not $exited.ContainsKey($key)) {
      $pidValue = [uint32]$key
      $exitCode = $null
      if ($pidValue -eq $ctx.ProcessId -and [M0JobRunner.Native]::IsRootExited($ctx)) { $exitCode = [M0JobRunner.Native]::RootExitCode($ctx) }
      Write-Frame 'process.exited' ([ordered]@{pid=[int]$pidValue;exitCode=$exitCode;signal=$null})
      $exited[$key] = $true
    }
  }
  Write-Frame 'helper.exited' ([ordered]@{exitCode=0})
} catch {
  $helperExit = 1
  [Console]::Error.WriteLine($_.Exception.ToString())
  if ($ctx -ne $null) { try { [M0JobRunner.Native]::Terminate($ctx, 198) } catch {} }
} finally {
  if ($ctx -ne $null) { [M0JobRunner.Native]::Close($ctx) }
  $writer.Dispose()
}
exit $helperExit
