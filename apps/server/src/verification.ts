import { realpathSync } from 'node:fs';
import { join } from 'node:path';
import { validateVerificationInvocation } from '../../../experiments/milestone-0/src/verification-invocation.mjs';
import { ApiError, type Task, type FrozenVerification, type VerificationSelection } from './contracts.js';
import { sha256File } from './execution-profile.js';
export function verificationShell() { return realpathSync(join(process.env.SystemRoot ?? 'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe')); }
export const verificationEnvironment = ['PATH','SystemRoot','WINDIR','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','PATHEXT','COMSPEC','ProgramFiles','ProgramFiles(x86)','ProgramData','NUMBER_OF_PROCESSORS','PROCESSOR_ARCHITECTURE'];
export function parseVerificationSelection(input: Record<string,unknown>): VerificationSelection {
 if(input.verify !== undefined && typeof input.verify !== 'boolean') throw new ApiError(400,'INVALID_INPUT','verify 必须是布尔值');
 if(input.verify === true) {
  if(!Number.isSafeInteger(input.expected_task_revision) || Number(input.expected_task_revision)<1) throw new ApiError(400,'INVALID_INPUT','执行验证需要当前所见 Task revision');
  return {verify:true,expected_task_revision:Number(input.expected_task_revision)};
 }
 if(input.expected_task_revision !== undefined) throw new ApiError(400,'INVALID_INPUT','仅执行验证时提供 Task revision');
 return {verify:false};
}
export function freezeVerification(task: Task): FrozenVerification {
 const shell=verificationShell(); const command=task.verification_draft.command; const timeout=task.verification_draft.timeout_seconds*1000;
 if(!Number.isSafeInteger(timeout)||timeout<1000||timeout>3600000||!command.trim()||command.includes('\0')||Buffer.byteLength(command)>16000) throw new ApiError(400,'INVALID_INPUT','验证命令或超时超出当前范围');
 const frozen:FrozenVerification={verification_invocation_v0:{execution:{mode:'shell',shell_path:shell,shell_argv_prefix:['-NoLogo','-NoProfile','-NonInteractive','-Command'],command:shellCommand(command),command_encoding:'utf-8'},cwd_binding:'assigned_workspace',env:{inheritance_policy:'allowlist',inherit_names:verificationEnvironment,overrides:{},unset:[]},timeout_ms:timeout,output:{stdout:'separate ordered frames',stderr:'separate ordered frames'},cancel:'runner_owned_process_containment'},shell_sha256:sha256File(shell),requested_command:command};
 validateVerificationInvocation(frozen); return frozen;
}
export function verificationArgv(frozen:FrozenVerification) {
 const x=frozen.verification_invocation_v0.execution;
 return [...x.shell_argv_prefix,x.command];
}
function shellCommand(command:string) {return `$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); [Console]::InputEncoding=[System.Text.UTF8Encoding]::new($false); $OutputEncoding=[Console]::OutputEncoding; $global:LASTEXITCODE=0; & {\n${command}\n}; $commandOk=$?; if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}; if(-not $commandOk){exit 1}; exit 0`;}
