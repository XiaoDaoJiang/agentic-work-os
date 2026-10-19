import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('importing verifier modules with owner-like argv has no CLI side effects',()=>{
 const result=spawnSync(process.execPath,['--input-type=module','-e',"process.argv[1]='import-fixture.mjs';process.argv[2]='--owner';await import('./tools/verify-verification.mjs');process.argv[2]='--review-owner';await import('./tools/verify-g2.mjs');console.log('imports-only');"],{encoding:'utf8',windowsHide:true,timeout:5000});
 assert.equal(result.status,0,result.stderr);assert.equal(result.stdout.trim(),'imports-only');
});
