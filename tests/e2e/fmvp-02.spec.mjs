import { test, expect } from '@playwright/test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { startTestService } from '../../tools/test-service.mjs';

test('accepted Windows profile: real output, reopen, cancel and owner-loss remain honest in UI', async ({ browser }, info) => {
  test.skip(!process.env.WORKOS_G1_EVIDENCE || process.platform !== 'win32', 'Requires an actual, matching Windows G1 manifest');
  test.setTimeout(420000);
  const directory = mkdtempSync(join(tmpdir(), 'workos-ui-real-'));
  const source = join(directory, 'source');
  mkdirSync(source);
  const git = args => execFileSync('git', ['-C', source, ...args], { encoding: 'utf8', windowsHide: true }).trim();
  git(['init']);
  writeFileSync(join(source, 'README.md'), 'Disposable real browser fixture.\n');
  writeFileSync(join(source, 'long-task.cjs'), `const fs = require('node:fs');
fs.writeFileSync('tool-started.json', JSON.stringify({ pid: process.pid }));
setInterval(() => {}, 1000);
`);
  git(['add', '.']);
  git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'browser fixture']);
  const base = git(['rev-parse', 'HEAD']);
  let service;
  let context;
  const pageErrors = [];
  try {
    service = await startTestService(join(directory, 'data'));
    context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    context.on('page', page => page.on('pageerror', error => pageErrors.push(error.message)));
    let page = await context.newPage();
    await page.goto(service.origin);
    await expect(page.getByText('当前 Windows Codex profile 可用', { exact: true })).toBeVisible();
    async function createAndStart(goal) {
      await page.getByLabel('目标', { exact: true }).fill(goal);
      await page.getByLabel('DoD（每行一条）').fill('The fixture result can be inspected; no delivery is accepted');
      await page.getByLabel('仓库绝对路径').fill(source);
      await page.getByLabel('Verification 草稿（仅保存）').fill('DO_NOT_EXECUTE');
      await page.getByRole('button', { name: '创建 Task', exact: true }).click();
      await expect(page.getByText('Task 已保存', { exact: true })).toBeVisible();
      await page.getByLabel('执行方式').selectOption('real');
      const startedResponse = page.waitForResponse(response => response.request().method() === 'POST'
        && /\/api\/tasks\/[^/]+\/runs$/.test(new URL(response.url()).pathname), { timeout: 60000 });
      await page.getByRole('button', { name: '启动 Codex Run', exact: true }).click();
      const response = await startedResponse;
      expect([200, 201]).toContain(response.status());
      expect((await response.json()).run.execution_mode).toBe('real');
      await expect(page.getByTestId('run-id')).toBeVisible();
      const id = await page.getByTestId('run-id').textContent();
      const run = await (await context.request.get(`${service.origin}/api/runs/${id}`)).json();
      expect(run.execution_mode).toBe('real');
      return run;
    }
    const normal = await createAndStart('Create browser-marker.txt containing exactly browser-ok followed by a newline. Do not commit or access other directories.');
    const normalURL = page.url();
    await page.close();
    await expect.poll(async () => (await (await context.request.get(`${service.origin}/api/runs/${normal.id}`)).json()).state,
      { timeout: 210000 }).toBe('succeeded');
    expect(readFileSync(join(normal.input_snapshot.execution.workspace_path, 'browser-marker.txt'), 'utf8')).toBe('browser-ok\n');
    page = await context.newPage();
    await page.goto(normalURL);
    await expect(page.getByTestId('run-state')).toHaveText('Agent 已退出 · 尚未验证');
    await expect(page.getByRole('log')).toContainText('turn.completed');
    await expect(page.getByTestId('snapshot')).toContainText(base);
    await expect(page.getByText('ready · 无真实交付', { exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath('codex-unverified.png'), fullPage: true });
    const port = Number(new URL(service.origin).port);
    const saved = await (await context.request.get(`${service.origin}/api/runs/${normal.id}/logs`)).json();
    await service.stop();
    service = await startTestService(join(directory, 'data'), port);
    await page.goto(normalURL);
    await page.reload();
    await expect(page.getByTestId('run-state')).toHaveText('Agent 已退出 · 尚未验证');
    expect(await (await context.request.get(`${service.origin}/api/runs/${normal.id}/logs`)).json()).toEqual(saved);

    await page.getByRole('button', { name: '＋ 新建 Task', exact: true }).click();
    const cancelled = await createAndStart('Run node long-task.cjs using the shell tool in this repository and wait for it. Do not access other directories.');
    await expect.poll(() => existsSync(join(cancelled.input_snapshot.execution.workspace_path, 'tool-started.json')),
      { timeout: 90000 }).toBe(true);
    await page.getByRole('button', { name: '请求取消 Codex', exact: true }).click();
    await expect(page.getByTestId('run-state')).toHaveText('已确认取消', { timeout: 30000 });
    expect(await (await context.request.get(`${service.origin}/api/resource-lock`)).json()).toBeNull();
    await page.screenshot({ path: info.outputPath('codex-cancelled.png'), fullPage: true });

    await page.getByRole('button', { name: '＋ 新建 Task', exact: true }).click();
    const interrupted = await createAndStart('Run node long-task.cjs using the shell tool in this repository and wait for it. Do not access other directories.');
    await expect.poll(() => existsSync(join(interrupted.input_snapshot.execution.workspace_path, 'tool-started.json')),
      { timeout: 90000 }).toBe(true);
    const interruptedURL = page.url();
    await service.stop('SIGKILL');
    service = await startTestService(join(directory, 'data'), port);
    await page.goto(interruptedURL);
    await page.reload();
    await expect(page.getByTestId('run-state')).toHaveText('停止状态未知 · 资源保持锁定');
    await expect(page.getByRole('alert')).toContainText('已阻止新运行');
    await page.getByLabel('执行方式').selectOption('mock');
    await expect(page.getByRole('button', { name: '启动 mock Run', exact: true })).toBeDisabled();
    await page.getByLabel('执行方式').selectOption('real');
    await expect(page.getByRole('button', { name: '启动 Codex Run', exact: true })).toBeDisabled();
    await page.screenshot({ path: info.outputPath('codex-owner-loss-held.png'), fullPage: true });
    expect(git(['rev-parse', 'HEAD'])).toBe(base);
    expect(git(['status', '--porcelain', '--untracked-files=all'])).toBe('');
    expect(pageErrors).toEqual([]);
    await info.attach('fixture-location', { body: JSON.stringify({ directory }), contentType: 'application/json' });
  } finally {
    await context?.close();
    await service?.stop();
  }
});
