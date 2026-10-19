import {test,expect} from '@playwright/test';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,renameSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,relative,isAbsolute,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {startTestService} from '../../tools/test-service.mjs';
import {fixtureCheckBudget,fixtureLimits} from '../../tools/verify-verification.mjs';

// Real Agent 180s, two captures, the 60s verification draft, seal replay,
// and the existing watchdog allowance for each of those five native boundaries.
const initialPipelineBudget=180000+2*fixtureLimits.capture+60000+fixtureLimits.check+5*fixtureLimits.boundaryExit+fixtureLimits.persistence;

test('sealed review survives restart, accepts one package and downloads after Workspace deletion',async({browser},info)=>{
 test.skip(!process.env.WORKOS_G1_EVIDENCE||!process.env.WORKOS_G2_EVIDENCE||process.platform!=='win32','Requires current Windows G1 and G2');
 // Initial pipeline + Accept + failed Delivery + recovered Delivery; 120s for setup/restart/UI.
 test.setTimeout(initialPipelineBudget+3*fixtureCheckBudget+120000);
 const directory=mkdtempSync(join(tmpdir(),'workos-ui-review-')),source=join(directory,'source'),data=join(directory,'data');mkdirSync(source);
 const git=args=>execFileSync('git',['-c','core.autocrlf=false','-C',source,...args],{encoding:'utf8',windowsHide:true}).trim();
 git(['init']);writeFileSync(join(source,'README.md'),'review fixture\n');git(['add','.']);git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-m','base']);
 let service,context;const errors=[];
 try {
  service=await startTestService(data);context=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true});const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(service.origin);
  await page.getByLabel('目标',{exact:true}).fill('Create reviewed.txt containing exactly reviewed followed by a newline. Do not run tests, commit or modify the source repository.');
  await page.getByLabel('DoD（每行一条）').fill('The sealed result can be replayed and downloaded');await page.getByLabel('仓库绝对路径').fill(source);
  await page.getByLabel('Verification 草稿（仅保存）').fill(`node -e "require('node:assert/strict').equal(require('node:fs').readFileSync('reviewed.txt','utf8'),'reviewed\\n');console.log('review stdout');console.error('review stderr')"`);
  await page.getByRole('button',{name:'创建 Task',exact:true}).click();await expect(page.getByText('Task 已保存',{exact:true})).toBeVisible();await page.getByLabel('执行方式').selectOption('real');await page.getByRole('checkbox',{name:'本次执行验证'}).check();
  const started=page.waitForResponse(response=>response.request().method()==='POST'&&/\/api\/tasks\/[^/]+\/runs$/.test(new URL(response.url()).pathname),{timeout:60000});await page.getByRole('button',{name:'启动 Codex Run',exact:true}).click();const response=await started;expect([200,201]).toContain(response.status());const runId=(await response.json()).run.id;
  let observedState;
  await expect.poll(async()=>{observedState=(await(await context.request.get(`${service.origin}/api/runs/${runId}`)).json()).state;return observedState;},{timeout:initialPipelineBudget}).not.toBe('running');
  expect(observedState).toBe('waiting_review');await expect(page.getByTestId('run-state')).toHaveText('等待人工审核');const route=page.url();const before=await(await context.request.get(`${service.origin}/api/runs/${runId}/review`)).json();expect(before.blockers).toEqual([]);
  const run=await(await context.request.get(`${service.origin}/api/runs/${runId}`)).json();const port=Number(new URL(service.origin).port);await service.stop();service=await startTestService(data,port);await page.goto(route);await expect(page.getByTestId('run-state')).toHaveText('等待人工审核');
  const review=page.getByRole('region',{name:'交付物审核'});await expect(review).toContainText('The sealed result can be replayed and downloaded');await expect(page.getByTestId('review-diff')).toContainText('reviewed.txt');await expect(page.getByTestId('verification-result')).toContainText('验证前后捕获版本一致');
  for(const name of ['封存验证 stdout','封存验证 stderr'])await review.locator('summary').filter({hasText:name}).click();await expect(review).toContainText('review stdout');await expect(review).toContainText('review stderr');await page.screenshot({path:info.outputPath('waiting-review.png'),fullPage:true});
  const workspace=run.input_snapshot.execution.workspace_path,within=relative(directory,workspace);expect(within.startsWith('..')||isAbsolute(within)).toBe(false);rmSync(workspace,{recursive:true});
  const accepting=page.waitForResponse(response=>response.request().method()==='POST'&&new URL(response.url()).pathname===`/api/runs/${runId}/review`,{timeout:fixtureCheckBudget});
  await page.getByRole('button',{name:'接受交付物',exact:true}).click();expect([200,201]).toContain((await accepting).status());await expect(page.getByTestId('review-decision')).toHaveText('已接受交付物');await expect(page.getByText('done · 已接受可重放交付物',{exact:true})).toBeVisible();
  const offline=join(directory,'source-offline');
  const assertOwned=target=>{const within=relative(resolve(directory),resolve(target));expect(Boolean(within)&&!within.startsWith('..')&&!isAbsolute(within)).toBe(true);};
  assertOwned(source);assertOwned(offline);renameSync(source,offline);
  try{
   const failedCheck=page.waitForResponse(response=>response.request().method()==='POST'&&new URL(response.url()).pathname===`/api/runs/${runId}/delivery`,{timeout:fixtureCheckBudget});
   await page.getByRole('button',{name:'检查并下载交付物',exact:true}).click();expect((await failedCheck).status()).toBe(409);await expect(review.getByRole('alert')).toContainText('本次交付检查未通过');
   await page.reload();await expect(page.getByTestId('delivery-integrity')).toContainText('当前封存对象完整');await expect(page.getByRole('button',{name:'检查并下载交付物',exact:true})).toBeEnabled();await expect(review).toContainText('上次检查存在漂移或无法确认');
  }finally{assertOwned(offline);assertOwned(source);renameSync(offline,source);}
  const downloadPromise=page.waitForEvent('download',{timeout:fixtureCheckBudget});void downloadPromise.catch(()=>{});
  const delivering=page.waitForResponse(response=>response.request().method()==='POST'&&new URL(response.url()).pathname===`/api/runs/${runId}/delivery`,{timeout:fixtureCheckBudget});
  await page.getByRole('button',{name:'检查并下载交付物',exact:true}).click();expect((await delivering).status()).toBe(200);const download=await downloadPromise,downloadPath=await download.path();expect(createHash('sha256').update(readFileSync(downloadPath)).digest('hex')).toBe(before.package.sha256);
  const objectPath=join(data,'runs','artifacts',before.package.content_location),original=readFileSync(objectPath);writeFileSync(objectPath,'fixture damage');await expect(page.getByTestId('delivery-integrity')).toContainText('当前交付物损坏',{timeout:10000});await expect(page.getByTestId('review-decision')).toHaveText('已接受交付物');await expect(page.getByRole('button',{name:'检查并下载交付物',exact:true})).toBeDisabled();writeFileSync(objectPath,original);await expect(page.getByTestId('delivery-integrity')).toContainText('当前封存对象完整',{timeout:10000});
  await page.screenshot({path:info.outputPath('accepted-delivery.png'),fullPage:true});expect(git(['status','--porcelain','--untracked-files=all'])).toBe('');expect(errors).toEqual([]);await info.attach('fixture-location',{body:JSON.stringify({directory,runId}),contentType:'application/json'});
 }finally{await context?.close();await service?.stop();}
});
