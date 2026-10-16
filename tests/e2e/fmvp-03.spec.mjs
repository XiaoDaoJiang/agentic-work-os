import { test, expect } from '@playwright/test';
import { mkdtempSync,mkdirSync,writeFileSync,readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { startTestService } from '../../tools/test-service.mjs';

test('explicit verification shows real streams, captured versions and read-only restart history',async({browser},info)=>{
 test.skip(!process.env.WORKOS_G1_EVIDENCE||process.platform!=='win32','Requires actual matching Windows G1 manifest');test.setTimeout(300000);
 const directory=mkdtempSync(join(tmpdir(),'workos-ui-verification-'));const source=join(directory,'source');mkdirSync(source);const git=args=>execFileSync('git',['-C',source,...args],{encoding:'utf8',windowsHide:true}).trim();
 git(['init']);writeFileSync(join(source,'README.md'),'disposable browser verification fixture\n');git(['add','.']);git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','base']);
 let service,context;const errors=[];
 try {
  service=await startTestService(join(directory,'data'));context=await browser.newContext({viewport:{width:1440,height:1100}});context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));let page=await context.newPage();await page.goto(service.origin);
  await expect(page.getByText('当前 Windows Codex profile 可用',{exact:true})).toBeVisible();
  await page.getByLabel('目标',{exact:true}).fill('Create verified-browser.txt containing exactly browser-verified followed by a newline. Do not commit or run tests.');await page.getByLabel('DoD（每行一条）').fill('Result is inspectable, no delivery accepted');await page.getByLabel('仓库绝对路径').fill(source);
  await page.getByLabel('Verification 草稿（仅保存）').fill(`node -e "require('node:assert/strict').equal(require('node:fs').readFileSync('verified-browser.txt','utf8'),'browser-verified\\n');console.log('验证标准输出');console.error('验证标准错误')"`);
  await page.getByRole('button',{name:'创建 Task',exact:true}).click();await expect(page.getByText('Task 已保存',{exact:true})).toBeVisible();await page.getByLabel('执行方式').selectOption('real');
  await expect(page.getByRole('checkbox',{name:'本次执行验证'})).not.toBeChecked();await page.getByRole('checkbox',{name:'本次执行验证'}).check();
  const startedResponse=page.waitForResponse(response=>response.request().method()==='POST'&&/\/api\/tasks\/[^/]+\/runs$/.test(new URL(response.url()).pathname),{timeout:60000});
  await page.getByRole('button',{name:'启动 Codex Run',exact:true}).click();const response=await startedResponse;expect([200,201]).toContain(response.status());expect((await response.json()).run.execution_mode).toBe('real');await expect(page.getByTestId('run-id')).toBeVisible();
  const id=await page.getByTestId('run-id').textContent();const historicalURL=page.url();await page.close();await expect.poll(async()=>(await(await context.request.get(`${service.origin}/api/runs/${id}`)).json()).state,{timeout:240000}).toBe('succeeded');
  const run=await(await context.request.get(`${service.origin}/api/runs/${id}`)).json();const proof=await(await context.request.get(`${service.origin}/api/runs/${id}/evidence`)).json();expect(run.input_snapshot.verification_selection).toEqual({verify:true,expected_task_revision:1});expect(proof.stages.map(x=>x.stage)).toEqual(['agent','capture-before','verification','capture-after']);expect(proof.verification.version_match).toBe('match');expect(readFileSync(join(run.input_snapshot.execution.workspace_path,'verified-browser.txt'),'utf8')).toBe('browser-verified\n');
  page=await context.newPage();await page.goto(historicalURL);await expect(page.getByTestId('run-state')).toHaveText('验证命令通过 · 捕获版本一致');await expect(page.getByTestId('verification-result')).toContainText('验证前后捕获版本一致');
  for(const name of ['验证前 Diff','验证后 Diff','验证 stdout','验证 stderr'])await page.locator('summary').filter({hasText:name}).click();
  const proofPanel=page.getByRole('region',{name:'验证证据'});await expect(proofPanel).toContainText('verified-browser.txt');await expect(proofPanel).toContainText('验证标准输出');await expect(proofPanel).toContainText('验证标准错误');await expect(proofPanel).toContainText('当前 Workspace 未重新检查');await expect(page.getByText('ready · 无真实交付',{exact:true})).toBeVisible();await page.screenshot({path:info.outputPath('verification-result.png'),fullPage:true});
  const port=Number(new URL(service.origin).port);await service.stop();writeFileSync(join(run.input_snapshot.execution.workspace_path,'post-capture.txt'),'later');service=await startTestService(join(directory,'data'),port);await page.goto(historicalURL);await page.reload();await expect(page.getByTestId('verification-result')).toContainText('验证前后捕获版本一致');expect(await(await context.request.get(`${service.origin}/api/runs/${id}/evidence`)).json()).toEqual(proof);
  const caps=await(await context.request.get(service.origin+'/api/capabilities')).json();expect(caps.accept).toBe(false);expect(caps.accepted_delivery).toBe(false);expect(git(['status','--porcelain','--untracked-files=all'])).toBe('');expect(errors).toEqual([]);await info.attach('fixture-location',{body:JSON.stringify({directory}),contentType:'application/json'});
 }finally{await context?.close();await service?.stop();}
});
