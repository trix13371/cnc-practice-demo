'use strict';
const assert=require('node:assert/strict'),model=require('../progress-store.js');
function fake(){const data=new Map([['a','old-a'],['b','old-b'],['other','untouched']]);return {data,fail:null,getItem(k){return data.get(k)??null;},setItem(k,v){if(this.fail?.('set',k,v))throw Error('injected write failure');data.set(k,String(v));},removeItem(k){if(this.fail?.('remove',k))throw Error('injected remove failure');data.delete(k);}};}
const options={keys:['a','b'],journalKey:'journal'},after={a:'new-a',b:null};
let storage=fake(),store=model.create(storage,options);assert.deepEqual(store.recover(),{status:'none'});assert.deepEqual(store.read(),{a:'old-a',b:'old-b'});store.commit(after);assert.deepEqual(store.read(),after);assert.equal(storage.getItem('other'),'untouched');assert.equal(storage.getItem('journal'),null);
storage=fake();store=model.create(storage,options);
const stale=store.read();storage.setItem('b','concurrent');
assert.throws(()=>store.commit(after,stale),/Сохранения изменились/);
assert.deepEqual(store.read(),{a:'old-a',b:'concurrent'});
assert.equal(storage.getItem('journal'),null);
store.commit(after,store.read());assert.deepEqual(store.read(),after);
storage=fake();store=model.create(storage,options);storage.fail=(op,k)=>k==='journal';assert.throws(()=>store.commit(after));assert.equal(storage.getItem('a'),'old-a');assert.equal(storage.getItem('b'),'old-b');assert.equal(storage.getItem('journal'),null);
storage=fake();store=model.create(storage,options);let calls=0;storage.fail=(op,k)=>k==='b'&&calls++===0;assert.throws(()=>store.commit(after),/Прежние данные восстановлены/);assert.deepEqual(store.read(),{a:'old-a',b:'old-b'});assert.equal(storage.getItem('journal'),null);
storage=fake();store=model.create(storage,options);storage.fail=(op,k)=>k==='b';assert.throws(()=>store.commit(after),/Журнал сохранён/);assert.ok(storage.getItem('journal'));assert.throws(()=>store.read());assert.throws(()=>store.commit(after));storage.fail=null;assert.equal(model.create(storage,options).recover().status,'rolledBack');assert.deepEqual(store.read(),{a:'old-a',b:'old-b'});
storage=fake();store=model.create(storage,options);storage.fail=(op,k)=>op==='remove'&&k==='journal';assert.throws(()=>store.commit(after));assert.equal(storage.getItem('a'),'new-a');storage.fail=null;assert.equal(store.recover().status,'committed');assert.deepEqual(store.read(),after);
for(const journal of ['{bad',JSON.stringify({version:2}),JSON.stringify({version:1,before:{a:'x',b:1},after})]){storage=fake();store=model.create(storage,options);storage.setItem('journal',journal);const before=[...storage.data];assert.throws(()=>store.recover());assert.deepEqual([...storage.data],before);}
storage=fake();store=model.create(storage,options);for(const bad of [{a:'x'}, {a:'x',b:2},{a:'x',b:null,other:'overwrite'}])assert.throws(()=>store.commit(bad));assert.throws(()=>model.create(storage,{keys:['__proto__']}));assert.throws(()=>model.create(storage,{keys:['a','a']}));assert.throws(()=>store.commit({a:'x'.repeat(model.MAX_BYTES),b:null}));assert.equal(storage.getItem('a'),'old-a');
console.log('Progress store: atomic commit, quota before writes, partial rollback, boot recovery, pending/corrupt journal and isolated keys passed.');
// A corrupt startup journal blocks controllers, but the recovery copy remains downloadable.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),config=require('../progress-config.js');
const elements=[],downloads=[];function element(tag){const e={tag,children:[],append(...v){this.children.push(...v);},setAttribute(){},click(){downloads.push(this.download);}};elements.push(e);return e;}
const broken=fake();broken.setItem(config.journalKey,'{broken');const context={document:{body:element('body'),createElement:element,getElementById:id=>elements.find(e=>e.id===id)},localStorage:broken,CNCProgressConfig:config,CNCProgressStore:model,CNCProgressUI:{exportArchive(){throw Error('Controllers have not loaded yet');}},Blob,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},setTimeout:fn=>fn(),location:{reload(){}},TextEncoder};context.window=context;
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../progress-bootstrap.js'),'utf8'),context);assert.equal(context.CNCProgressRecovery.blocked,true);
for(const file of ['app.js','workshop.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context);assert.equal(context.CNCDemo,undefined);assert.equal(context.CNCWorkshop,undefined);assert.equal(broken.getItem(config.journalKey),'{broken');
elements.find(e=>e.textContent==='Скачать доступную копию').onclick();assert.deepEqual(downloads,['cnc-recovery.json']);
console.log('Recovery bootstrap: corrupt journal stops app writes and still exports a diagnostic recovery copy.');
