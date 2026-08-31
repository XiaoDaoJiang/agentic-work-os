export function expectedTrustedLocalAck(experimentRunId) {
  return `ACK-TRUSTED-LOCAL:${experimentRunId}`;
}

export function verifyTrustedLocalAck(experimentRunId, response) {
  return String(response).trim() === expectedTrustedLocalAck(experimentRunId);
}

export function renderTrustedLocalPrompt({ sourceRepository, assignedWorkspace, experimentRunId }) {
  return `[trusted-local execution / 非 Sandbox]\n\n` +
    `本实验将以当前用户权限运行后续真实 Agent 或 VerificationInvocation。\n` +
    `Workspace 只提供 Git working-copy isolation，不是宿主机安全隔离。\n` +
    `不得据此推断 Agent 无法访问 Workspace 外的文件、网络、凭据或进程。\n\n` +
    `Source repository: ${sourceRepository}\n` +
    `Assigned Workspace: ${assignedWorkspace}\n` +
    `Experiment: ${experimentRunId}\n\n` +
    `只允许对已确认的 disposable fixture 继续。\n` +
    `输入 ${expectedTrustedLocalAck(experimentRunId)} 启动；其他输入必须终止且不启动进程。`;
}
