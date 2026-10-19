import {test,expect} from '@playwright/test';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startTestService} from '../../tools/test-service.mjs';

const task={id:'task-ui',revision:2,state:'ready',goal:'下一次目标',definition_of_done:['下一次标准'],repository_path:'C:/fixture/'+'long-path/'.repeat(30),verification_draft:{command:'DO_NOT_EXECUTE',timeout_seconds:60}};
const run=(id,goal)=>({id,task_id:task.id,state:'succeeded',phase:'complete',execution_mode:'mock',scenario:'success',created_at:'2026-10-19T00:00:00Z',terminal_reason:'mock_success',input_snapshot:{task:{...task,revision:1,goal,definition_of_done:[`${goal}标准`]},schema_version:1}});
const runs=[run('run-first','第一次冻结目标'),run('run-second','第二次冻结目标')];
const emptyEvidence={stages:[],captures:[],output:[],verification:null};
async function fixture(page){
 const service=await startTestService(mkdtempSync(join(tmpdir(),'workos-05-ui-')));
 const state={hold:null,offline:false,reviewOffline:false,lock:null,writes:0,facts:{resource_state:'safe'},delayedFacts:null,runs,review:null};
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(route.request().method()!=='GET'){state.writes++;await route.fulfill({json:task});return;}
  if(path==='/api/session'){await route.fulfill({json:{session_token:'ui-only',real_execution:false,accept:false,codex_profile:{reason:'UI fixture，不是真实执行'}}});return;}
  if(state.hold&&['/api/tasks','/api/runs','/api/resource-lock'].includes(path))await state.hold;
  if(state.offline){await route.abort('failed');return;}
  if(path.endsWith('/review')&&state.reviewOffline){await route.abort('failed');return;}
  if(path.endsWith('/facts')&&state.delayedFacts)await state.delayedFacts;
  const value=path==='/api/tasks'?[task]:path==='/api/runs'?state.runs:path==='/api/resource-lock'?state.lock:path.endsWith('/review')?state.review:path.endsWith('/facts')?state.facts:path.endsWith('/logs')?[]:emptyEvidence;
  await route.fulfill({json:value});
 });
 return {service,state};
}

test('UI injection: loading, stale history and current lock recover without writes',async({page},info)=>{
 const {service,state}=await fixture(page);let release;state.hold=new Promise(resolve=>release=resolve);
 try{
  await page.goto(`${service.origin}/#task=${task.id}&run=run-first`);
  await expect(page.getByTestId('history-loading')).toBeVisible();
  await expect(page.getByText('还没有 Task。',{exact:false})).toHaveCount(0);
  release();state.hold=null;
  await expect(page.getByTestId('frozen-goal')).toContainText('第一次冻结目标');
  await expect(page.getByTestId('historical-resource')).toContainText('mock 没有 OS 资源证据');
  await expect(page.getByRole('button',{name:'启动 mock Run',exact:true})).toBeEnabled();
  state.offline=true;
  await expect(page.getByTestId('current-resource')).toContainText('无法确认');
  await expect(page.getByRole('button',{name:'启动 mock Run',exact:true})).toBeDisabled();
  await expect(page.getByTestId('frozen-goal')).toContainText('第一次冻结目标');
  state.lock={run_id:'run-second',task_id:null,facts:{resource_state:'unknown'}};state.offline=false;
  await expect(page.getByTestId('current-resource')).toContainText('当前全局持锁');
  await expect(page.getByRole('alert').filter({hasText:'暂时无法连接'})).toHaveCount(0);
  await page.getByRole('button',{name:'查看阻塞 Run'}).click();
  await expect(page.getByTestId('run-id')).toHaveText('run-second');
  state.lock={run_id:null,task_id:task.id,facts:{reason:'before_git_preflight'}};
  await expect(page.getByRole('button',{name:'查看准备中的 Task'})).toBeVisible();
  await page.screenshot({path:info.outputPath('preparing-lock.png'),fullPage:true});
  expect(state.writes).toBe(0);
 }finally{release();await page.close();await service.stop();}
});

test('UI injection: review read failure closes stale actions and recovery clears the read error',async({page},info)=>{
 const {service,state}=await fixture(page);
 state.runs=[{...run('review-run','审核冻结目标'),execution_mode:'real',state:'waiting_review',phase:'review'}];
 state.review={package:{id:'package-ui',sha256:'a'.repeat(64)},decision:null,artifacts:[{artifact:{type:'change_package'},status:'healthy'}],blockers:[],diff:'diff --git a/long b/long\n+'+'long'.repeat(500),last_check:{drift:'clear'},delivery_integrity:null};
 try{
  await page.goto(`${service.origin}/#task=${task.id}&run=review-run`);
  const accept=page.getByRole('button',{name:'接受交付物',exact:true});
  await expect(accept).toBeEnabled();
  await expect(page.getByTestId('historical-resource')).toContainText('当时已确认安全');
  state.lock={run_id:'other-run',task_id:null,facts:{resource_state:'unknown'}};
  await expect(page.getByTestId('current-resource')).toContainText('当前全局持锁');await expect(accept).toBeDisabled();state.lock=null;
  await expect(accept).toBeEnabled();state.reviewOffline=true;
  await expect(page.getByTestId('review-read-status')).toContainText('无法确认');await expect(accept).toBeDisabled();
  await expect(page.getByTestId('review-diff')).toContainText('long');
  state.reviewOffline=false;await expect(accept).toBeEnabled();await expect(page.getByTestId('review-read-status')).toHaveCount(0);
  state.runs=[{...state.runs[0],state:'completed',phase:'complete'}];
  state.review={...state.review,decision:{decision:'accept',decided_at:'2026-10-19T00:00:00Z'},delivery_integrity:{value:'healthy'},blockers:['上次检查存在漂移或无法确认'],last_check:{drift:'unavailable',replay:null}};
  const download=page.getByRole('button',{name:'检查并下载交付物',exact:true});
  await expect(download).toBeEnabled();await expect(page.getByTestId('delivery-integrity')).toContainText('当前封存对象完整');
  state.offline=true;await expect(page.getByTestId('current-resource')).toContainText('无法确认');await expect(download).toBeDisabled();state.offline=false;
  await expect(download).toBeEnabled();
  for(const [value,text] of [['missing','当前交付物缺失'],['corrupt','当前交付物损坏']]){
   state.review={...state.review,delivery_integrity:{value}};
   await expect(page.getByTestId('delivery-integrity')).toContainText(text);await expect(download).toBeDisabled();await expect(page.getByTestId('review-decision')).toHaveText('已接受交付物');
  }
  await page.screenshot({path:info.outputPath('accepted-corrupt.png'),fullPage:true});
  await page.setViewportSize({width:375,height:812});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await page.getByTestId('review-diff').evaluate(node=>node.scrollWidth>node.clientWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('narrow-corrupt.png'),fullPage:true});expect(state.writes).toBe(0);
 }finally{await page.close();await service.stop();}
});

test('UI injection: frozen input, hash selection and keyboard editing stay stable',async({page},info)=>{
 const {service,state}=await fixture(page);
 try{
  await page.goto(`${service.origin}/#task=${task.id}&run=run-first`);
  const frozen=page.getByRole('region',{name:'本次冻结目标'});
  await expect(frozen).toContainText('第一次冻结目标标准');
  await expect(page.getByTestId('frozen-goal')).toHaveCount(1);
  const summary=page.getByText('编辑下一次运行的任务输入',{exact:true});await summary.focus();await page.keyboard.press('Enter');
  await page.getByLabel('目标',{exact:true}).fill('未保存的编辑');
  await expect.poll(()=>page.getByLabel('目标',{exact:true}).inputValue()).toBe('未保存的编辑');
  await expect(frozen).not.toContainText('未保存的编辑');
  const save=page.getByRole('button',{name:'保存 Task 修改',exact:true});await save.focus();await page.keyboard.press('Enter');
  await expect(page.getByText('Task 已保存',{exact:true})).toBeVisible();expect(state.writes).toBe(1);
  await page.evaluate(()=>{location.hash='task=task-ui&run=run-second';});
  await expect(frozen).toContainText('第二次冻结目标标准');
  await page.reload();await expect(page.getByTestId('run-id')).toHaveText('run-second');
  await page.evaluate(()=>{location.hash='task=task-ui&run=does-not-exist';});
  await expect(page.getByText('所选 Run 不存在。请从运行历史选择已有记录。',{exact:true})).toBeVisible();
  await page.setViewportSize({width:375,height:812});
  await page.evaluate(()=>{location.hash='task=task-ui&run=run-first';});await expect(frozen).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('narrow-history.png'),fullPage:true});
 }finally{await page.close();await service.stop();}
});
