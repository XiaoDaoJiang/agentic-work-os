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
 const state={hold:null,offline:false,lock:null,writes:0,facts:{resource_state:'safe'},delayedFacts:null};
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(route.request().method()!=='GET'){state.writes++;await route.fulfill({json:task});return;}
  if(path==='/api/session'){await route.fulfill({json:{session_token:'ui-only',real_execution:false,accept:false,codex_profile:{reason:'UI fixture，不是真实执行'}}});return;}
  if(state.hold&&['/api/tasks','/api/runs','/api/resource-lock'].includes(path))await state.hold;
  if(state.offline){await route.abort('failed');return;}
  if(path.endsWith('/facts')&&state.delayedFacts)await state.delayedFacts;
  const value=path==='/api/tasks'?[task]:path==='/api/runs'?runs:path==='/api/resource-lock'?state.lock:path.endsWith('/facts')?state.facts:path.endsWith('/logs')?[]:emptyEvidence;
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
