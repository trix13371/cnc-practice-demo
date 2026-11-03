'use strict';
const assert=require('node:assert/strict');
const m=require('../training-model.js');
const run=(s,a)=>{const r=m.transition(s,a);assert.equal(r.ok,true,r.message);return r.state;};
function ready(s){for(const a of [{type:'clamp',value:true},{type:'zero',value:true},{type:'door',value:true},{type:'spindle',value:true}])s=run(s,a);return s;}
function cut(s,x,stage='rough',extra={}){const t=m.task(s.kind,s.variant);return run(s,{type:'cut',stage,tool:'turning',x,offset:-t.bias,feed:stage==='rough'?.2:.12,rpm:800,prediction:x,...extra});}
function finish(s){const t=m.task(s.kind,s.variant);s=cut(s,t.target,'finish');s=run(s,{type:'spindle',value:false});s=run(s,{type:'measure',instrument:'micrometer'});return run(s,{type:'inspect',verdict:'ok',diagnosis:s.kind==='offset'?'offset':'none'});}
function rough(s){const t=m.task(s.kind,s.variant);while(s.diameter>t.target+t.allowance+1e-8)s=cut(s,+Math.max(t.target+t.allowance,s.diameter-2*t.maxDepth).toFixed(6));return s;}
// All nine tasks are solvable; correct independent work survives event replay.
for(const family of m.families)for(const v of m.variants(family.id)){
  const initial=m.create(family.id,v),original=structuredClone(initial);
  const s=finish(rough(ready(initial))),g=m.grade(s);
  assert.equal(g.passed,true,`${family.id}/${v}`);assert.equal(g.independent,true);
  assert.deepEqual(initial,original,'transitions do not mutate their inputs');
  assert.deepEqual(m.restore(JSON.parse(JSON.stringify(m.snapshot(s)))),s);
  assert.ok(g.seconds>0);assert.equal(g.predictions,g.totalPredictions);
  for(const p of s.passes){assert.ok(p.after<p.before);assert.ok(p.depth<=m.task(s.kind,v)[p.stage==='finish'?'finishDepth':'maxDepth']+1e-8);}
}
let s=m.create();
for(const a of [{type:'spindle',value:true},{type:'zero',value:true}]){const r=m.transition(s,a);assert.equal(r.ok,false);assert.equal(r.state.diameter,32);s=r.state;}
assert.equal(s.machine.spindle,false);assert.equal(s.machine.zeroed,false);
assert.deepEqual(m.restore(m.snapshot(s)),s,'blocked actions replay deterministically');
s=ready(s);
for(const a of [{type:'door',value:false},{type:'clamp',value:false},{type:'measure',instrument:'micrometer'}]){const r=m.transition(s,a);assert.equal(r.ok,false);assert.equal(r.state.machine.spindle,true);assert.equal(r.state.machine.doorClosed,true);assert.equal(r.state.machine.clamped,true);s=r.state;}
const baseCut={type:'cut',stage:'rough',tool:'turning',x:28.4,offset:0,feed:.2,rpm:800,prediction:28.4};
for(const change of [{x:26},{tool:'drill'},{feed:.8},{rpm:1100}]){const r=m.transition(s,{...baseCut,...change});assert.equal(r.ok,false);assert.equal(r.state.diameter,32);assert.equal(r.state.passes.length,0);}
s=run(s,baseCut);assert.equal(s.diameter,28.4);
let r=m.transition(s,{...baseCut,x:30});assert.equal(r.ok,false);assert.equal(r.state.diameter,28.4,'larger commanded X cannot restore material');
s=cut(s,27.8,'finish');assert.equal(m.grade(s).scrap,true);
r=m.transition(s,{...baseCut,x:28,stage:'finish',feed:.12,prediction:28});assert.equal(r.ok,false);assert.equal(r.state.diameter,27.8);
assert.equal(m.transition(s,{type:'blank'}).ok,false,'replacement needs stopped spindle');
s=run(s,{type:'spindle',value:false});s=run(s,{type:'blank'});assert.equal(s.diameter,32);assert.equal(s.blank,2);assert.equal(s.previous[0].scrap,true);assert.equal(s.passes.length,0);assert.deepEqual(m.restore(m.snapshot(s)),s);
// Fresh measurements, a fine gauge and the student's own conclusion are mandatory.
s=rough(ready(m.create()));s=run(s,{type:'spindle',value:false});s=run(s,{type:'measure',instrument:'micrometer'});s=run(s,{type:'spindle',value:true});s=cut(s,28,'finish');s=run(s,{type:'spindle',value:false});
assert.equal(m.transition(s,{type:'inspect',verdict:'ok',diagnosis:'none'}).ok,false,'old measurement cannot certify new surface');
s=run(s,{type:'measure',instrument:'caliper'});s=run(s,{type:'inspect',verdict:'ok',diagnosis:'none'});assert.equal(m.grade(s).passed,false,'coarse gauge alone does not satisfy this task');
s=run(s,{type:'measure',instrument:'micrometer'});s=run(s,{type:'inspect',verdict:'large',diagnosis:'none'});assert.equal(m.grade(s).passed,false);
s=run(s,{type:'inspect',verdict:'ok',diagnosis:'none'});assert.equal(m.grade(s).passed,true);
// Interval around a rounded boundary reading requires refinement.
s=rough(ready(m.create()));s=cut(s,28.06,'finish');s=run(s,{type:'spindle',value:false});s=run(s,{type:'measure',instrument:'caliper'});assert.equal(s.measurements.at(-1).verdict,'uncertain');
s=run(s,{type:'inspect',verdict:'uncertain',diagnosis:'none'});assert.equal(m.grade(s).passed,false);
s=run(s,{type:'measure',instrument:'micrometer'});s=run(s,{type:'inspect',verdict:'ok',diagnosis:'none'});assert.equal(m.grade(s).passed,true);
// A tiny first rough cut does not excuse removal of the finishing allowance later.
s=ready(m.create());s=cut(s,31.9);s=cut(s,28.2);s=cut(s,28,'finish');s=run(s,{type:'spindle',value:false});s=run(s,{type:'measure',instrument:'micrometer'});s=run(s,{type:'inspect',verdict:'ok',diagnosis:'none'});assert.equal(m.grade(s).passed,false);assert.equal(m.grade(s).criteria.find(c=>c.id==='rough').ok,false);
// Prediction errors and hints retain a completed result but cannot be called independent.
s=rough(ready(m.create()));s=run(s,{type:'hint'});s=finish(s);assert.equal(m.grade(s).passed,true);assert.equal(m.grade(s).independent,false);
s=ready(m.create());s=cut(s,28.4,'rough',{prediction:30});s=finish(s);assert.equal(m.grade(s).passed,true);assert.equal(m.grade(s).independent,false);
let blocked=m.transition(m.create(),{type:'spindle',value:true}).state;blocked=finish(rough(ready(blocked)));assert.equal(m.grade(blocked).passed,true);assert.equal(m.grade(blocked).independent,false);assert.equal(m.grade(blocked).blockedActions,1);
// Offset task needs the diagnosis in addition to a correct final size.
s=rough(ready(m.create('offset',2)));s=finish(s);s=run(s,{type:'inspect',verdict:'ok',diagnosis:'feed'});assert.equal(m.grade(s).passed,false);
// Reject malformed actions and corrupted histories; don't trust cached scores or geometry.
for(const a of [null,{},[],{...baseCut,x:NaN},{...baseCut,offset:Infinity},{...baseCut,prediction:null},{type:'measure',instrument:'laser'}])assert.throws(()=>m.transition(m.create(),a));
for(const bad of [null,{}, {version:1,kind:'unknown',variant:0,actions:[]},{version:1,kind:'cycle',variant:6,actions:[]},{version:1,kind:'cycle',variant:0,actions:[{}]},{version:1,kind:'cycle',variant:0,actions:Array(501).fill({type:'hint'})}])assert.equal(m.restore(bad),null);
const spoof=m.restore({...m.snapshot(m.create()),diameter:28,passed:true,inspection:{verdict:'ok'}});assert.equal(spoof.diameter,32);assert.equal(m.grade(spoof).passed,false);
// Transfer progress transactionally: keep passed variants and reject a whole corrupt import.
const solved=finish(rough(ready(m.create()))),local={version:1,selected:'cycle-0',tab:'control',sessions:{'cycle-0':m.snapshot(solved)},drafts:{'cycle-0':{x:'28'}}};
const incoming={version:1,selected:'passes-1',tab:'review',sessions:{'cycle-0':m.snapshot(m.create()),'passes-1':m.snapshot(ready(m.create('passes',1)))},drafts:{'passes-1':{x:'bad',tool:'drill',prediction:'x'.repeat(100),unknown:'ignored'}}};
const localCopy=structuredClone(local),merged=m.mergeBooks(local,incoming);assert.equal(m.grade(merged.sessions['cycle-0']).passed,true);assert.equal(merged.sessions['passes-1'].machine.spindle,true);assert.equal(merged.selected,'passes-1');assert.equal(merged.tab,'review');assert.equal(merged.drafts['passes-1'].prediction,undefined);assert.equal(merged.drafts['passes-1'].unknown,undefined);assert.deepEqual(local,localCopy);
const corrupt=structuredClone(incoming);corrupt.sessions['passes-1'].actions.push({type:'invalid'});assert.throws(()=>m.mergeBooks(local,corrupt));assert.deepEqual(local,localCopy);
assert.throws(()=>m.restoreBook({...local,sessions:{'cycle-0':m.snapshot(m.create('offset',0))}}));assert.throws(()=>m.restoreBook({...local,selected:'unknown'}));assert.throws(()=>m.restoreBook({...local,sessions:{unknown:m.snapshot(m.create())}}));
console.log('Deep training checks passed: twelve tasks, machine gates, predictions, persistent cuts, scrap, metrology, diagnosis and replay.');

// Help and earlier errors belong to the condition, not only the latest blank.
for(const earlier of ['hint','prediction','blocked','inspection']){
  let state=m.create();
  if(earlier==='hint')state=run(state,{type:'hint'});
  if(earlier==='blocked')state=m.transition(state,{type:'spindle',value:true}).state;
  if(earlier==='prediction'){state=ready(state);state=cut(state,28.4,'rough',{prediction:29});state=run(state,{type:'spindle',value:false});}
  if(earlier==='inspection'){state=finish(rough(ready(state)));state=run(state,{type:'inspect',verdict:'large',diagnosis:'none'});}
  state=run(state,{type:'blank'});state=finish(rough(ready(state)));
  assert.equal(m.grade(state).passed,true,earlier);assert.equal(m.grade(state).independent,false,earlier+' survives replacement');
  assert.deepEqual(m.restore(m.snapshot(state)),state);
}
const pack=(state,draft={})=>({version:2,selected:'cycle-0',tab:'control',sessions:{'cycle-0':m.snapshot(state)},archive:{},drafts:{'cycle-0':draft}});
const assisted=finish(rough(ready(run(m.create(),{type:'hint'})))),independent=finish(rough(ready(m.create())));
const combined=m.mergeBooks(pack(assisted,{x:'29'}),pack(independent,{x:'28'}));
assert.equal(combined.archive['cycle-0'].length,2);assert.equal(m.grade(combined.sessions['cycle-0']).independent,true);assert.equal(combined.drafts['cycle-0'].x,'28');
assert.deepEqual(m.evidence(combined.sessions['cycle-0'],combined.archive['cycle-0']),{passed:true,independent:true});
assert.equal(m.mergeBooks(combined,pack(independent,{x:'28'})).archive['cycle-0'].length,2,'repeated import does not duplicate history');
assert.deepEqual(m.mergeBooks(combined,pack(independent)).archive['cycle-0'].map(m.snapshot),combined.archive['cycle-0'].map(m.snapshot),'repeat import preserves journal order');
assert.equal(m.mergeBooks(pack(independent,{x:'28'}),pack(assisted,{x:'29'})).drafts['cycle-0'].x,'28','incoming weaker history does not replace the active draft');
const archived={...pack(m.create()),archive:{'cycle-0':[m.snapshot(independent)]}};
const fresh=m.mergeBooks(archived,pack(ready(m.create()),{prediction:'29'}));
assert.equal(m.grade(fresh.sessions['cycle-0']).passed,false,'current work stays separate from past achievement');
assert.equal(m.evidence(fresh.sessions['cycle-0'],fresh.archive['cycle-0']).independent,true);
const malformed=structuredClone(archived);malformed.archive['cycle-0'][0].actions.push({type:'bad'});
assert.throws(()=>m.mergeBooks(archived,malformed));assert.equal(archived.archive['cycle-0'][0].actions.at(-1).type,'inspect');
assert.equal(m.restoreBook({...pack(m.create()),version:1}).version,2);
// Distinct transfer conditions change allowance and the minimum rough-pass count.
assert.deepEqual([3,4,5].map(v=>{const t=m.task('cycle',v);return [t.allowance,Math.ceil((t.stock-t.target-t.allowance)/(2*t.maxDepth)-1e-8)];}),[[.6,2],[.2,1],[.4,2]]);
console.log('Full-cycle checks passed: 12 conditions, persistent help/errors, separate histories and transactional merge.');
const used={};assert.equal(m.nextTransfer(used),'cycle-3');
used['cycle-3']=run(m.create('cycle',3),{type:'hint'});assert.equal(m.nextTransfer(used),'cycle-4');
used['cycle-4']=run(m.create('cycle',4),{type:'hint'});assert.equal(m.nextTransfer(used),'cycle-5');
used['cycle-5']=run(m.create('cycle',5),{type:'hint'});assert.equal(m.nextTransfer(used),null,'known conditions with help are not new independent work');
const success=finish(rough(ready(m.create('cycle',5))));assert.equal(m.nextTransfer(used,{'cycle-5':[success]}),'cycle-5','earned independent evidence remains available');
let repeat=run(success,{type:'blank'});assert.equal(m.grade(repeat).passed,false);assert.equal(m.evidence(m.restore(m.snapshot(repeat))).independent,true,'historical success is replayed, not taken from imported flags');
repeat=finish(rough(ready(repeat)));assert.equal(m.grade(repeat).independent,false,'a repeat is not new independent evidence');
assert.equal(m.restore({version:1,actions:[]}),null,'missing condition identity is not inferred');
assert.deepEqual(m.evidence(m.restore({...m.snapshot(m.create()),achievements:{passed:true,independent:true}})),{passed:false,independent:false});
