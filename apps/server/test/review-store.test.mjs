import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {Store} from '../dist/store.js';

const input={goal:'Review fixture',definition_of_done:['Evidence remains immutable'],repository_path:process.cwd(),verification_draft:{command:'fixture',timeout_seconds:5}};
function setup(t){const directory=mkdtempSync(join(tmpdir(),'workos-review-store-'));const store=new Store(join(directory,'state.sqlite'));t.after(()=>store.close());return {store,directory};}
function pending(store){
 const task=store.createTask(input);
 const run=store.startRealRun(task.id,'review-request',{review_identity:'fixture'},1,{verify:true,expected_task_revision:1},{requested_command:'fixture'}).run;
 for(const type of ['agent_log','diff','verification_result','change_package'])store.db.prepare('INSERT INTO artifacts VALUES (?,?,?,?,?,?,?)').run(type,run.id,type,`objects/${type}`,'a'.repeat(64),1,'now');
 const pkg={id:'change_package',run_id:run.id,type:'change_package',sha256:'a'.repeat(64),size:1,content_location:'objects/change_package',sealed_at:'now'};
 const verification={outcome:'failed',exit_code:1,version_match:'match',reason:'verification_command_exit'};
 store.enterReview(run.id,pkg,verification,{resource_state:'safe',resource_lock:'releasable'});
 return {task,run,pkg,request:{request_id:'decision-request',decision:'accept',package_id:pkg.id,package_sha256:pkg.sha256,note:''}};
}
test('waiting review preserves business singleton and immutable evidence across restart',t=>{
 const {store}=setup(t);const {task,run}=pending(store);
 assert.equal(store.getRun(run.id).state,'waiting_review');assert.equal(store.getTask(task.id).state,'review');assert.equal(store.resourceLock(),null);
 assert.equal(store.recoverInterrupted(),0);assert.equal(store.getRun(run.id).state,'waiting_review');
 assert.throws(()=>store.startRun(task.id,{execution_mode:'mock',scenario:'success',request_id:'another-request'}),/active|活动/i);
 assert.throws(()=>store.appendOutput(run.id,'agent','stdout','late'),/sealed|immutable/);
 assert.throws(()=>store.recordStage(run.id,'verification',{}),/sealed|immutable/);
 assert.throws(()=>store.db.prepare("UPDATE runs SET state='running' WHERE id=?").run(run.id),/review|immutable/);
});
test('decision is atomic, idempotent and historical acceptance cannot finish a newer task revision',t=>{
 const {store}=setup(t);const {task,run,request}=pending(store);
 store.updateTask(task.id,{...input,goal:'New revision'});
 store.db.exec("CREATE TRIGGER fail_decision BEFORE INSERT ON events WHEN NEW.type='run.terminal' BEGIN SELECT RAISE(ABORT,'fixture fault'); END");
 assert.throws(()=>store.decideReview(run.id,request),/fixture fault/);
 assert.equal(store.getReviewDecision(run.id),null);assert.equal(store.getRun(run.id).state,'waiting_review');assert.equal(store.getTask(task.id).state,'ready');
 store.db.exec('DROP TRIGGER fail_decision');store.decideReview(run.id,request);
 assert.equal(store.getTask(task.id).state,'ready');assert.equal(store.getRun(run.id).state,'completed');
 assert.equal(store.decideReview(run.id,request).replay,true);
 assert.throws(()=>store.decideReview(run.id,{...request,decision:'reject'}),/幂等|决定/);
 assert.equal(store.db.prepare("SELECT COUNT(*) n FROM events WHERE type='run.terminal'").get().n,1);
});
test('accept done resets only on edit or new attempt, rejected unknown resources remain held',t=>{
 const {store}=setup(t);const {task,run,request}=pending(store);store.decideReview(run.id,request);
 assert.equal(store.getTask(task.id).state,'done');store.reservePreparation(task.id,'prepare-fail');store.failPreparation('prepare-fail',true);assert.equal(store.getTask(task.id).state,'done');
 const next=store.startRealRun(task.id,'next-request',{}).run;assert.equal(store.getTask(task.id).state,'ready');store.finishRealRun(next.id,'failed','fixture',{},true);
 assert.equal(store.getReviewDecision(run.id).decision,'accept');
 const another=pendingNew(store);store.reserveResourceCheck(another.run.id,'check-request');store.recordResourceFacts(another.run.id,{resource_state:'unknown'});
 store.decideReview(another.run.id,{...another.request,decision:'reject'});
 assert.equal(store.getTask(another.task.id).state,'blocked');assert.equal(store.resourceLock().run_id,another.run.id);
 assert.throws(()=>store.reservePreparation(another.task.id,'next-held'),/资源/);
});
function pendingNew(store){
 const task=store.createTask(input),run=store.startRealRun(task.id,'second-review',{review_identity:'fixture'}).run;
 for(const type of ['agent_log','diff','verification_result','change_package'])store.db.prepare('INSERT INTO artifacts VALUES (?,?,?,?,?,?,?)').run(`second-${type}`,run.id,type,`objects/second-${type}`,'b'.repeat(64),1,'now');
 const pkg={id:'second-change_package',run_id:run.id,sha256:'b'.repeat(64)};store.enterReview(run.id,pkg,{outcome:'passed',exit_code:0,version_match:'match',reason:'fixture'},{resource_state:'safe'});
 return {task,run,request:{request_id:'second-decision',decision:'reject',package_id:pkg.id,package_sha256:pkg.sha256,note:''}};
}


test('v4 nonempty immutable evidence and foreign key targets survive exact migration',t=>{
 const directory=mkdtempSync(join(tmpdir(),'workos-v4-')),file=join(directory,'state.sqlite'),old=new DatabaseSync(file);
 old.exec(readFileSync(new URL('./fixtures/schema-v4.sql',import.meta.url),'utf8'));
 old.prepare("INSERT INTO tasks VALUES ('task',1,'mock','ready',?,'before','before')").run(JSON.stringify(input));
 old.prepare("INSERT INTO runs VALUES ('run','task','old-request','success','real','succeeded','test',?,'before','after','verified')").run(JSON.stringify({execution_mode:'real',task:input}));
 old.exec(`INSERT INTO run_logs VALUES ('run',1,'real','before','[real] saved'); INSERT INTO stage_output VALUES ('run',1,'verification','stdout','真实输出'); INSERT INTO captured_versions VALUES ('run','after','{"resultTreeHash":"fixture"}'); INSERT INTO stage_observations VALUES ('run','agent','{"resource_state":"safe"}'); INSERT INTO verification_results VALUES ('run','{"outcome":"passed"}'); INSERT INTO execution_facts VALUES ('run','{"resource_state":"safe"}');`);
 const tables=['tasks','runs','run_logs','stage_output','captured_versions','stage_observations','verification_results','execution_facts'];
 const before=Object.fromEntries(tables.map(table=>[table,old.prepare(`SELECT * FROM ${table}`).all().map(row=>({...row}))]));old.close();
 const store=new Store(file);t.after(()=>store.close());
 for(const table of tables)assert.deepEqual(store.db.prepare(`SELECT * FROM ${table}`).all().map(row=>({...row})),before[table]);
 assert.deepEqual(store.db.prepare('PRAGMA foreign_key_check').all(),[]);
 for(const table of tables.filter(x=>!['tasks','runs'].includes(x))) {
  assert.equal(store.db.prepare(`PRAGMA foreign_key_list(${table})`).get().table,'runs');
  assert.throws(()=>store.db.exec(`DELETE FROM ${table}`),/immutable|append-only/);
 }
 assert.throws(()=>store.db.exec("UPDATE runs SET state='running'"),/immutable/);
 assert.throws(()=>store.db.exec("INSERT INTO events(run_id,sequence,type,payload_json) VALUES ('run',1,'agent.output','{}')"),/immutable/);
});

test('stale resource check cannot release another operation lock',t=>{
 const {store}=setup(t);const {run}=pending(store);store.reserveResourceCheck(run.id,'new-operation');
 assert.throws(()=>store.recordResourceCheck(run.id,{operation_id:'old-operation',resource_state:'safe'}),/所有者/);
 assert.equal(store.resourceLock().facts.operation_id,'new-operation');
});

test('old v5 upgrades blocked projection without rewriting accepted or waiting history',t=>{
 const directory=mkdtempSync(join(tmpdir(),'workos-v5-')),file=join(directory,'state.sqlite'),db=new DatabaseSync(file);
 db.exec(readFileSync(new URL('./fixtures/schema-v5.sql',import.meta.url),'utf8'));
 const legacy=Object.create(Store.prototype);legacy.db=db;
 const accepted=pending(legacy);legacy.decideReview(accepted.run.id,accepted.request);
 const waiting=pendingNew(legacy);legacy.reserveResourceCheck(waiting.run.id,'held-operation');
 assert.throws(()=>db.prepare("UPDATE tasks SET state='blocked' WHERE id=?").run(waiting.task.id),/CHECK/);
 const tables=['tasks','runs','artifacts','review_decisions','events','run_logs','execution_facts','verification_results','resource_lock'];
 const before=Object.fromEntries(tables.map(table=>[table,db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all().map(row=>({...row}))]));legacy.close();
 const store=new Store(file);t.after(()=>store.close());
 for(const table of tables)assert.deepEqual(store.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all().map(row=>({...row})),before[table],table);
 assert.equal(store.db.prepare('PRAGMA foreign_keys').get().foreign_keys,1);assert.deepEqual(store.db.prepare('PRAGMA foreign_key_check').all(),[]);
 for(const table of tables)for(const key of store.db.prepare(`PRAGMA foreign_key_list(${table})`).all())assert.ok(['tasks','runs','artifacts'].includes(key.table),`${table} references ${key.table}`);
 for(const table of ['artifacts','review_decisions','events','run_logs','execution_facts','verification_results'])assert.throws(()=>store.db.exec(`DELETE FROM ${table}`),/immutable|append-only/);
 assert.throws(()=>store.db.prepare("UPDATE runs SET state='running' WHERE id=?").run(accepted.run.id),/immutable/);
 assert.throws(()=>store.db.prepare("INSERT INTO events(run_id,sequence,type,payload_json) VALUES (?,999,'agent.output','{}')").run(accepted.run.id),/immutable/);
 store.decideReview(waiting.run.id,waiting.request);
 assert.equal(store.getTask(waiting.task.id).state,'blocked');assert.equal(store.resourceLock().run_id,waiting.run.id);
 assert.equal(store.getTask(accepted.task.id).state,'done');assert.deepEqual({...store.getReviewDecision(accepted.run.id)},before.review_decisions[0]);
 assert.throws(()=>store.reservePreparation(waiting.task.id,'still-blocked'),/资源/);
});
