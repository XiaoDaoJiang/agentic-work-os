import {test,expect} from '@playwright/test';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startTestService} from '../../tools/test-service.mjs';

// UI fault injection and real local restart checks; no Run or CLI is started.
async function fillTask(page,directory){
 await page.getByLabel('目标',{exact:true}).fill('Session readiness fixture');
 await page.getByLabel('DoD（每行一条）').fill('Task is persisted exactly once');
 await page.getByLabel('仓库绝对路径').fill(directory);
 await page.getByLabel('Verification 草稿（仅保存）').fill('node --version');
}
test('first save shares initialization session and fast reads do not repeat capability checks',async({page})=>{
 const directory=mkdtempSync(join(tmpdir(),'workos-session-ui-')),service=await startTestService(directory);
 let release;const held=new Promise(resolve=>release=resolve);let sessions=0,capabilities=0,taskReads=0,writes=0;
 await page.route('**/api/session',async route=>{sessions++;await held;await route.continue();});
 page.on('request',request=>{const path=new URL(request.url()).pathname;if(path==='/api/capabilities')capabilities++;if(path==='/api/tasks'){if(request.method()==='GET')taskReads++;else writes++;}});
 try{
  await page.goto(service.origin);await fillTask(page,directory);
  await expect.poll(()=>sessions).toBe(1);
  await page.getByRole('button',{name:'创建 Task',exact:true}).click();
  await expect(page.getByRole('button',{name:'保存中…'})).toBeDisabled();
  expect(sessions).toBe(1);expect(writes).toBe(0);release();
  await expect(page.getByText('Task 已保存',{exact:true})).toBeVisible();
  await expect.poll(()=>taskReads).toBeGreaterThanOrEqual(4);
  expect(sessions).toBe(1);expect(capabilities).toBe(0);expect(writes).toBe(1);
  const tasks=await(await page.request.get(`${service.origin}/api/tasks`)).json();expect(tasks).toHaveLength(1);expect(tasks[0].goal).toBe('Session readiness fixture');
 }finally{release();await page.close();await service.stop();}
});
test('a rejected session is cleared so the next explicit save obtains a fresh session',async({page})=>{
 const directory=mkdtempSync(join(tmpdir(),'workos-session-ui-')),service=await startTestService(directory);let sessions=0,writes=0;
 page.on('request',request=>{if(new URL(request.url()).pathname==='/api/session')sessions++;});
 await page.route('**/api/tasks',async route=>{if(route.request().method()==='POST'&&++writes===1)await route.fulfill({status:403,json:{code:'LOCAL_SESSION_REQUIRED',message:'会话已更换，请再次保存'}});else await route.continue();});
 try{
  await page.goto(service.origin);await fillTask(page,directory);await expect.poll(()=>sessions).toBe(1);
  await page.getByRole('button',{name:'创建 Task',exact:true}).click();await expect(page.getByRole('alert')).toContainText('会话已更换');expect(writes).toBe(1);
  await page.getByRole('button',{name:'创建 Task',exact:true}).click();await expect(page.getByText('Task 已保存',{exact:true})).toBeVisible();
  expect(sessions).toBe(2);expect(writes).toBe(2);expect(await(await page.request.get(`${service.origin}/api/tasks`)).json()).toHaveLength(1);
 }finally{await page.close();await service.stop();}
});
test('slow capability refresh closes unavailable capabilities and recovers on a later read',async({page})=>{
 const directory=mkdtempSync(join(tmpdir(),'workos-session-ui-')),service=await startTestService(directory);let checks=0;
 await page.route('**/api/session',async route=>{const response=await route.fetch();await route.fulfill({json:{...await response.json(),real_execution:true,accept:true,codex_profile:{reason:'UI capability fixture'}}});});
 await page.route('**/api/capabilities',async route=>{checks++;await route.fulfill(checks===1?{status:503,json:{message:'UI injected capability failure'}}:{json:{real_execution:true,accept:true,codex_profile:{reason:'UI capability recovered'}}});});
 try{
  await page.clock.install();await page.goto(service.origin);await expect(page.getByText('当前 Windows Codex profile 可用',{exact:true})).toBeVisible();
  expect(checks).toBe(0);await page.clock.fastForward(30001);await expect(page.locator('.mode-banner')).toContainText('当前能力暂不可用');await expect(page.locator('.mode-banner')).toContainText('MOCK ONLY');
  expect(checks).toBe(1);await page.clock.fastForward(30001);await expect(page.locator('.mode-banner')).toContainText('UI capability recovered');expect(checks).toBe(2);
 }finally{await page.close();await service.stop();}
});

test('same-route navigation retains the old session; real restart rejects then explicit retry saves once',async({page},info)=>{
 const directory=mkdtempSync(join(tmpdir(),'workos-session-restart-'));let service=await startTestService(directory),sessions=0;
 page.on('request',request=>{if(new URL(request.url()).pathname==='/api/session')sessions++;});
 try{
  await page.goto(service.origin);await fillTask(page,directory);await page.getByRole('button',{name:'创建 Task',exact:true}).click();
  await expect(page.getByText('Task 已保存',{exact:true})).toBeVisible();expect(sessions).toBe(1);
  const route=page.url(),port=Number(new URL(service.origin).port);
  await page.evaluate(()=>{window.__restartSentinel='original document';});
  await service.stop();service=await startTestService(directory,port);await page.goto(route);
  expect(await page.evaluate(()=>window.__restartSentinel)).toBe('original document');expect(sessions).toBe(1);
  await page.getByLabel('目标',{exact:true}).fill('Saved after explicit session retry');
  const rejected=page.waitForResponse(response=>response.request().method()==='PATCH'&&new URL(response.url()).pathname.startsWith('/api/tasks/'));
  await page.getByRole('button',{name:'保存 Task 修改',exact:true}).click();expect((await rejected).status()).toBe(403);
  await expect(page.locator('form').getByRole('alert')).toContainText('需要同源 Origin 与当前本地会话令牌');
  const unchanged=await(await page.request.get(`${service.origin}/api/tasks`)).json();expect(unchanged).toHaveLength(1);expect(unchanged[0].revision).toBe(1);expect(unchanged[0].goal).toBe('Session readiness fixture');expect(sessions).toBe(1);
  const retried=page.waitForResponse(response=>response.request().method()==='PATCH'&&new URL(response.url()).pathname.startsWith('/api/tasks/'));
  await page.getByRole('button',{name:'保存 Task 修改',exact:true}).click();expect((await retried).status()).toBe(200);expect(sessions).toBe(2);
  const saved=await(await page.request.get(`${service.origin}/api/tasks`)).json();expect(saved).toHaveLength(1);expect(saved[0].revision).toBe(2);expect(saved[0].goal).toBe('Saved after explicit session retry');
  await page.reload();expect(await page.evaluate(()=>window.__restartSentinel)).toBeUndefined();await expect.poll(()=>sessions).toBe(3);
  await info.attach('restart-observations',{body:JSON.stringify({sameRoutePreservedDocument:true,firstWriteStatus:403,retryStatus:200,persistedTaskCount:saved.length,persistedRevision:saved[0].revision,reloadClearedDocument:true}),contentType:'application/json'});
 }finally{await page.close();await service.stop();}
});
