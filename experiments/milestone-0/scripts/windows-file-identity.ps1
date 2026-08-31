param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('file-id', 'short-path')]
    [string]$Operation,

    [Parameter(Mandatory = $true)]
    [string]$Path
)

$ErrorActionPreference = 'Stop'

$nativeSource = @"
using System;
using System.ComponentModel;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Win32.SafeHandles;

public static class M0WindowsFileIdentity
{
    private const uint OPEN_EXISTING = 3;
    private const uint FILE_FLAG_BACKUP_SEMANTICS = 0x02000000;
    private const uint FILE_SHARE_READ = 0x00000001;
    private const uint FILE_SHARE_WRITE = 0x00000002;
    private const uint FILE_SHARE_DELETE = 0x00000004;
    private const int FILE_ID_INFO_CLASS = 18;
    private const int MAX_PATH_BUFFER = 32768;

    [StructLayout(LayoutKind.Sequential)]
    private struct FILE_ID_INFO
    {
        public ulong VolumeSerialNumber;

        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 16)]
        public byte[] FileId;
    }

    public sealed class IdentityResult
    {
        public string FinalPath { get; set; }
        public string VolumeSerialHex { get; set; }
        public string FileIdHex { get; set; }
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern SafeFileHandle CreateFileW(
        string lpFileName,
        uint dwDesiredAccess,
        uint dwShareMode,
        IntPtr lpSecurityAttributes,
        uint dwCreationDisposition,
        uint dwFlagsAndAttributes,
        IntPtr hTemplateFile);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetFileInformationByHandleEx(
        SafeFileHandle hFile,
        int fileInformationClass,
        ref FILE_ID_INFO lpFileInformation,
        uint dwBufferSize);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern uint GetFinalPathNameByHandleW(
        SafeFileHandle hFile,
        StringBuilder lpszFilePath,
        uint cchFilePath,
        uint dwFlags);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern uint GetShortPathNameW(
        string lpszLongPath,
        StringBuilder lpszShortPath,
        uint cchBuffer);

    private static string NormalizeFinalPath(string value)
    {
        const string uncPrefix = @"\\?\UNC\";
        const string extendedPrefix = @"\\?\";
        if (value.StartsWith(uncPrefix, StringComparison.OrdinalIgnoreCase))
        {
            return @"\\" + value.Substring(uncPrefix.Length);
        }
        if (value.StartsWith(extendedPrefix, StringComparison.OrdinalIgnoreCase))
        {
            return value.Substring(extendedPrefix.Length);
        }
        return value;
    }

    public static IdentityResult GetIdentity(string path)
    {
        using (SafeFileHandle handle = CreateFileW(
            path,
            0,
            FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            IntPtr.Zero,
            OPEN_EXISTING,
            FILE_FLAG_BACKUP_SEMANTICS,
            IntPtr.Zero))
        {
            if (handle.IsInvalid)
            {
                throw new Win32Exception(Marshal.GetLastWin32Error(), "CreateFileW failed");
            }

            FILE_ID_INFO info = new FILE_ID_INFO { FileId = new byte[16] };
            uint infoSize = (uint)Marshal.SizeOf(typeof(FILE_ID_INFO));
            if (!GetFileInformationByHandleEx(handle, FILE_ID_INFO_CLASS, ref info, infoSize))
            {
                throw new Win32Exception(Marshal.GetLastWin32Error(), "GetFileInformationByHandleEx(FileIdInfo) failed");
            }

            StringBuilder finalPath = new StringBuilder(MAX_PATH_BUFFER);
            uint finalLength = GetFinalPathNameByHandleW(handle, finalPath, (uint)finalPath.Capacity, 0);
            if (finalLength == 0)
            {
                throw new Win32Exception(Marshal.GetLastWin32Error(), "GetFinalPathNameByHandleW failed");
            }
            if (finalLength >= finalPath.Capacity)
            {
                throw new InvalidOperationException("Final path exceeded the frozen helper buffer");
            }

            StringBuilder fileId = new StringBuilder(32);
            foreach (byte value in info.FileId)
            {
                fileId.Append(value.ToString("x2", CultureInfo.InvariantCulture));
            }

            return new IdentityResult
            {
                FinalPath = NormalizeFinalPath(finalPath.ToString()),
                VolumeSerialHex = info.VolumeSerialNumber.ToString("x16", CultureInfo.InvariantCulture),
                FileIdHex = fileId.ToString()
            };
        }
    }

    public static string TryGetShortPath(string path)
    {
        StringBuilder buffer = new StringBuilder(MAX_PATH_BUFFER);
        uint length = GetShortPathNameW(path, buffer, (uint)buffer.Capacity);
        if (length == 0 || length >= buffer.Capacity)
        {
            return null;
        }
        string result = buffer.ToString();
        if (String.Equals(result, path, StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }
        return result;
    }
}
"@

if (-not ('M0WindowsFileIdentity' -as [type])) {
    Add-Type -TypeDefinition $nativeSource -Language CSharp
}

$absolutePath = [System.IO.Path]::GetFullPath($Path)

if ($Operation -eq 'file-id') {
    $result = [M0WindowsFileIdentity]::GetIdentity($absolutePath)
    [ordered]@{
        finalPath = $result.FinalPath
        volumeSerialHex = $result.VolumeSerialHex
        fileIdHex = $result.FileIdHex
    } | ConvertTo-Json -Compress
    exit 0
}

$shortPath = [M0WindowsFileIdentity]::TryGetShortPath($absolutePath)
[ordered]@{
    available = $null -ne $shortPath
    shortPath = $shortPath
} | ConvertTo-Json -Compress
