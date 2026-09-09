import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startTestService } from '../../tools/test-service.mjs';

test('create Task → mock logs → close page → restart service → persisted history; then crash in-flight', async ({ browser }, info) => {
  const directory = mkdtempSync(join(tmpdir(), 'workos-ui-'));
  let service; let context;
  try {
    service = await startTestService(directory);
    context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    let page = await context.newPage();
    const pageErrors = []; context.on('page', p => p.on('pageerror', e => pageErrors.push(e.message)));
    page.on('pageerror', e => pageErrors.push(e.message));
    await page.goto(service.origin);
    await page.getByRole('button', { name: '创建 Task', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('请修正');
    await page.getByLabel('目标', { exact: true }).fill('FMVP-01 browser fixture');
    await page.getByLabel('DoD（每行一条）').fill('Can inspect saved logs\nCan reopen a stable Run');
    await page.getByLabel('仓库绝对路径').fill('/disposable/not-opened');
    await page.getByLabel('Verification 草稿（仅保存）').fill('DO_NOT_EXECUTE');
    await page.getByRole('button', { name: '创建 Task', exact: true }).click();
    await expect(page.getByText('Task 已保存', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: '启动 mock Run', exact: true }).click();
    await expect(page.getByRole('log')).toContainText('[mock]');
    await expect(page.getByRole('log')).toContainText('模拟日志 1/2');
    const historicalURL = page.url();
    const runId = await page.getByTestId('run-id').textContent();
    await page.close(); // Closing a browser must not stop server-side mock progression.
    await expect.poll(async () => (await (await context.request.get(`${service.origin}/api/runs/${runId}`)).json()).state).toBe('succeeded');
    page = await context.newPage(); await page.goto(historicalURL);
    await expect(page.getByTestId('run-state')).toHaveText('模拟成功');
    await expect(page.getByRole('log')).toContainText('mock_success');
    // Compare the same DOM representation before/after restart, row for row.
    const savedLogs = await page.getByRole('log').locator('p').allTextContents();
    const savedRecords = await (await context.request.get(`${service.origin}/api/runs/${runId}/logs`)).json();
    await page.screenshot({ path: info.outputPath('mock-success.png'), fullPage: true });
    await page.close();
    const port = Number(new URL(service.origin).port);
    await service.stop(); service = await startTestService(directory, port);
    page = await context.newPage(); await page.goto(historicalURL);
    await expect(page.getByTestId('run-id')).toHaveText(runId);
    await expect(page.getByRole('log').locator('p')).toHaveText(savedLogs);
    expect(await (await context.request.get(`${service.origin}/api/runs/${runId}/logs`)).json()).toEqual(savedRecords);
    await expect(page.getByTestId('run-state')).toHaveText('模拟成功');
    await expect(page.getByText('ready · 无真实交付', { exact: true })).toBeVisible();
    // Existing Run snapshot must not follow a Task edit from the actual UI.
    await page.getByLabel('目标', { exact: true }).fill('Edited after snapshot');
    await page.getByRole('button', { name: '保存 Task 修改' }).click();
    await expect(page.getByText('v2', { exact: true })).toBeVisible();
    await expect(page.getByTestId('snapshot')).toContainText('FMVP-01 browser fixture');
    await expect(page.getByTestId('snapshot')).not.toContainText('Edited after snapshot');
    await page.getByRole('button', { name: '启动 mock Run', exact: true }).click();
    await expect(page.getByTestId('run-id')).not.toHaveText(runId);
    await expect(page.getByTestId('snapshot')).toContainText('Edited after snapshot');
    await expect(page.getByRole('log')).toContainText('模拟日志 1/2');
    const interruptedURL = page.url();
    await service.stop('SIGKILL');
    service = await startTestService(directory, port);
    await page.goto(interruptedURL);
    await expect(page.getByTestId('run-state')).toHaveText('模拟中断');
    await expect(page.getByRole('log')).toContainText('service_restart_no_resume');
    await expect(page.getByRole('log')).not.toContainText('mock_success');
    await page.screenshot({ path: info.outputPath('mock-recovery.png'), fullPage: true });
    expect(pageErrors).toEqual([]);
  } finally {
    await context?.close(); await service?.stop();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('failure, scenario cancel and explicit Cancel are operable from UI', async ({ page }) => {
  const directory = mkdtempSync(join(tmpdir(), 'workos-ui-cancel-'));
  let service;
  try {
    service = await startTestService(directory); await page.goto(service.origin);
    await page.getByLabel('目标', { exact: true }).fill('Failure and cancel fixture');
    await page.getByLabel('DoD（每行一条）').fill('Observe mock-only terminal');
    await page.getByLabel('仓库绝对路径').fill('C:\\not-opened\\fixture');
    await page.getByLabel('Verification 草稿（仅保存）').fill('NEVER_EXECUTE');
    await page.getByRole('button', { name: '创建 Task', exact: true }).click();
    for (const [scenario, label] of [['failure', '模拟失败'], ['cancel', '模拟取消']]) {
      await page.getByLabel('模拟场景').selectOption(scenario);
      await page.getByRole('button', { name: '启动 mock Run', exact: true }).click();
      await expect(page.getByTestId('run-state')).toHaveText(label);
    }
    await page.getByLabel('模拟场景').selectOption('success');
    await page.getByRole('button', { name: '启动 mock Run', exact: true }).click();
    await page.getByRole('button', { name: '取消 mock Run', exact: true }).click();
    await expect(page.getByTestId('run-state')).toHaveText('模拟取消');
    await expect(page.getByRole('log')).toContainText('mock_user_cancel');
  } finally { await service?.stop(); rmSync(directory, { recursive: true, force: true }); }
});
