'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const cli=require('../server/cli.cjs'),{create}=require('../server/app.cjs'),validation=require('../server/validation.cjs'),progress=require('../progress-model.js');
(async()=>{
  const heavy=progress.empty();heavy.sections.skills.current.events=Array.from({length:10000},()=>({type:'hint'}));
  assert(Buffer.byteLength(JSON.stringify(heavy))<200000,'The CPU attack fits comfortably within the body-size limit.');
  const limited=validation.create({timeoutMs:100,maxPending:1});
  const first=limited.run({archive:heavy}),second=limited.run({archive:heavy});
  await assert.rejects(limited.run({archive:heavy}),e=>e.status===503);
  const rejected=await Promise.allSettled([first,second]);assert(rejected.every(r=>r.status==='rejected'&&r.reason.status===422));limited.close();
  await assert.rejects(limited.run({archive:progress.empty()}),e=>e.status===503);

  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cnc-security-')),credentials=path.join(dir,'access.private.json');
  await cli.init({file:path.join(dir,'beta.sqlite'),credentials});const account=JSON.parse(fs.readFileSync(credentials,'utf8')).accounts[0];
  const app=await create({config:{dataDir:dir,port:0}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;app.config.origin=base;
  async function json(route,options={}){const r=await fetch(base+route,{...options,headers:{Origin:base,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(6000)});return {status:r.status,headers:r.headers,data:await r.json()};}
  try{
    const login=await json('/api/login',{method:'POST',body:JSON.stringify({username:account.username,password:account.password})});assert.equal(login.status,200);
    const headers={Cookie:login.headers.get('set-cookie').split(';')[0],'X-CSRF-Token':login.data.csrf};
    const pending=json('/api/progress',{method:'PUT',headers,body:JSON.stringify({expectedRevision:0,mutationId:crypto.randomUUID(),archive:heavy})});
    // A real costly replay runs while independent requests remain responsive.
    const latencies=[];
    for(let i=0;i<6;i++){
      await new Promise(r=>setTimeout(r,40));const start=performance.now();
      const response=await fetch(base+'/healthz',{signal:AbortSignal.timeout(1000)});assert.equal(response.status,200);latencies.push(performance.now()-start);
    }
    assert.equal((await pending).status,422);assert(Math.max(...latencies)<1000);
    assert.equal((await json('/api/progress',{headers})).data.revision,0,'Timed-out work must not write partial progress.');
    const clean=await json('/api/progress',{method:'PUT',headers,body:JSON.stringify({expectedRevision:0,mutationId:crypto.randomUUID(),archive:progress.empty()})});assert.equal(clean.status,200);
    assert.equal((await json('/api/progress',{headers})).data.revision,1,'The server must accept valid work after terminating a costly worker.');
    const bad=JSON.parse(JSON.stringify(progress.empty()));bad.sections.skills.current.drafts=JSON.parse('{"__proto__":{"polluted":true}}');
    assert.equal((await json('/api/progress',{method:'PUT',headers,body:JSON.stringify({expectedRevision:1,mutationId:crypto.randomUUID(),archive:bad})})).status,400);assert.equal({}.polluted,undefined);
    for(const target of ['/.env','/.git/config','/data/initial-access.private.json','/data/beta.sqlite','/backups/status.json','/server/validation-worker.cjs'])assert.equal((await json(target,{headers})).status,404);
    console.log('Security: costly replay isolated and timed out, health responsive (max '+Math.ceil(Math.max(...latencies))+' ms), bounded worker queue, no partial writes, normal recovery and prototype/path probes passed.');
  }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
