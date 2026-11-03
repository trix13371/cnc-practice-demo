'use strict';
const assert=require('node:assert/strict'),spec=require('../model-spec-model.js'),training=require('../training-model.js'),code=require('../gcode-model.js'),math=require('../training-math.js'),base=require('../model.js'),process=require('../process-model.js'),lab=require('../lab-model.js');
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`),act=(s,a)=>{const r=training.transition(s,a);assert(r.ok,r.message);return r.state;};
const ready=s=>[{type:'clamp',value:true},{type:'zero',value:true},{type:'door',value:true},{type:'spindle',value:true}].reduce(act,s);
const cut=(x,stage='rough',offset=0)=>({type:'cut',x,offset,stage,tool:'turning',feed:stage==='rough'?.2:.12,rpm:800,prediction:x});
const document=spec.manifest();assert.equal(document.schemaVersion,1);assert.equal(document.components.length,5);assert.equal(document.cycle.transitions.length,9);assert.equal(document.invariants.length,8);
assert.deepEqual(document.gcode.dialect,JSON.parse(JSON.stringify(code.dialect)));assert(Object.isFrozen(code.dialect.initial));assert.throws(()=>{code.dialect.bounds.x[1]=999;});assert.throws(()=>{code.dialect.gGroups[2]='motion';});
assert.deepEqual(Object.keys(code.dialect.gGroups).map(Number),[0,1,18,21,97,98,99]);assert.deepEqual([...code.dialect.mCodes],[3,5,30]);
// Independent numerical expectations for F01/F02/F03/F04; no UI calculation is used as an oracle.
let evaluated=base.evaluate({x:28,offset:0,feed:.2,rpm:800,tool:'turning'});near(evaluated.actual,28);near(evaluated.depth,2);near(evaluated.minutes,.28125);
const metrics=math.metrics(28,45,.2,800);near(metrics.feedPerMinute,160);near(metrics.seconds,16.875);near(metrics.surfaceSpeed,70.37167544041137);
// interval-boundary (I07).
assert.equal(math.classify(28.1,.1,28,.1),'uncertain');assert.equal(math.classify(28,.01,28,.1),'ok');assert.equal(math.classify(28.2,.01,28,.1),'large');assert.equal(math.classify(27.8,.01,28,.1),'small');
// rejected-physical-state / fresh-measurement / replay.
let initial=training.create(),s=initial;assert.equal(spec.phase(s),'unprepared');
for(const a of [{type:'spindle',value:true},{type:'zero',value:true},{type:'inspect',verdict:'ok',diagnosis:'none'},cut(28.4)]){
  const before=structuredClone(s),r=training.transition(s,a);assert.equal(r.ok,false);assert.deepEqual(spec.physical(r.state),spec.physical(s));assert.equal(r.state.actions.length,s.actions.length+1);assert.deepEqual(s,before);s=r.state;
}
assert.throws(()=>training.transition(s,{type:'unknown'}));assert.deepEqual(spec.physical(s),spec.physical(initial));
s=ready(training.create());assert.equal(spec.phase(s),'running');
for(const a of [{type:'door',value:false},{type:'clamp',value:false},{type:'measure',instrument:'micrometer'},{type:'blank'}]){const r=training.transition(s,a);assert.equal(r.ok,false);assert.deepEqual(spec.physical(r.state),spec.physical(s));}
s=act(s,cut(28.4));near(s.diameter,28.4);near(s.passes.at(-1).depth,1.8);s=act(s,{type:'spindle',value:false});s=act(s,{type:'measure',instrument:'micrometer'});assert.equal(spec.phase(s),'measured');s=act(s,{type:'spindle',value:true});s=act(s,cut(28,'finish'));assert.equal(s.inspection,null);s=act(s,{type:'spindle',value:false});
const stale=training.transition(s,{type:'inspect',verdict:'ok',diagnosis:'none'});assert.equal(stale.ok,false);assert.equal(stale.state.diameter,28);assert.equal(training.grade(stale.state).passed,false);
const persisted=training.snapshot(s);assert.deepEqual(training.restore({...persisted,diameter:1,achievements:{passed:true}}),s,'Replay ignores cached geometry and grades');assert.deepEqual(training.restore(JSON.parse(JSON.stringify(persisted))),s);
for(const e of document.examples){const trace=spec.example(e.id);assert(trace.steps.length);assert(trace.steps.every(t=>t.invariantErrors.length===0));const restored=training.restore(trace.snapshot);assert.deepEqual(spec.observe(restored),trace.final);}
assert.equal(spec.example('blocked-start').steps[0].ok,false);assert.equal(spec.example('cycle').final.passed,true);assert.equal(spec.example('cycle').final.independent,true);assert.equal(spec.example('stale').steps.at(-1).ok,false);assert.equal(spec.example('scrap').final.phase,'scrap');near(spec.example('scrap').final.diameter,27.8);assert.equal(spec.example('scrap').steps.at(-1).ok,false);
// reachable-machine / monotone-removal: bounded deterministic exploration includes reversals,
// wrong tools, out-of-condition speeds, fresh/stale readings, resets and blocked actions.
for(const family of training.families)for(const variant of training.variants(family.id)){
  let current=training.create(family.id,variant),seed=119+variant;const task=training.task(family.id,variant);
  const actions=[{type:'clamp',value:true},{type:'clamp',value:false},{type:'zero',value:true},{type:'door',value:true},{type:'door',value:false},{type:'spindle',value:true},{type:'spindle',value:false},{type:'measure',instrument:'micrometer'},{type:'inspect',verdict:'ok',diagnosis:'none'},{type:'blank'},{type:'hint'},cut(task.target+task.allowance),cut(task.target,'finish'),{...cut(task.target),tool:'drill'},cut(task.stock+1),{...cut(task.target),rpm:100}];
  current=ready(current);
  for(let i=0;i<65;i++){seed=(seed*1664525+1013904223)>>>0;const a=actions[seed%actions.length],r=training.transition(current,a);assert.deepEqual(spec.invariantErrors(r.state),[],'reachable-machine');if(!r.ok)assert.deepEqual(spec.physical(r.state),spec.physical(current),'rejected-physical-state');if(r.state.blank===current.blank)assert(r.state.diameter<=current.diameter+1e-8,'monotone-removal');current=r.state;}
  assert.deepEqual(training.restore(training.snapshot(current)),current,'replay after mixed accepted and blocked inputs');
}
// atomic-block / modal values / supported and rejected language forms.
let result=code.simulate('G00 X36 Z3\nG01 X28 Z-10 F0\nG00 Z5');assert.equal(result.errors[0].line,2);assert.equal(result.trace.length,1);assert.deepEqual([result.state.x,result.state.z,result.state.motion,result.state.feed],[36,3,0,null]);
result=code.simulate('G98\nG01 Z-5 F60\nG99\nZ-6');assert.equal(result.errors.length,0);assert.equal(result.moves.at(-1).feed,60);assert.equal(result.moves.at(-1).feedMode,99,'Changing units does not convert F');
assert.equal(code.simulate('N001.0 O001.0\nG0 X36 Z3').errors.length,0,'N/O use integer values, not digits-only lexical tokens');
for(const [word,min,max]of [['X',0,60],['Z',-60,10],['S',1,5000]]){for(const value of [min,max])assert.equal(code.simulate('G0 '+word+value).errors.length,0);for(const value of [min-.01,max+.01])assert(code.simulate('G0 '+word+value).errors.length);}
assert.equal(code.simulate('G1 Z-1 F1000').errors.length,0);assert(code.simulate('G1 Z-1 F0').errors.length);assert(code.simulate('G1 Z-1 F1000.01').errors.length);
for(const source of ['G02 X20','G03 X20','G20','G96','G90','G91','G71','G76','T0101','M06','G0 U1','G0 W1','G0 Y1','G0 X28,5','G0 X1e2','G0 G0 X30','M3 M5','G0 X1 X2','M30 X30','M30\nG0 X30'])assert(code.simulate(source).errors.length,source);
assert.equal(code.simulate('M30\n(comment)\n%').errors.length,0);assert(code.simulate(' '.repeat(code.dialect.maxSource+1)).errors.length);assert(code.simulate(Array(code.MAX_LINES+1).fill('(x)').join('\n')).errors.length);
// profile-removal: a bore increases while outside material is only removed.
const task=lab.tasks.find(t=>t.id==='sleeve'),plan={offset:0,rpm:800,diagnosis:'none',operations:[{id:'bore',diameter:22,endDiameter:null,length:45,passes:6,feed:.12,tool:'boring'},{id:'outer',diameter:30,endDiameter:null,length:45,passes:3,feed:.2,tool:'turning'}]};
// F06: Ø12→Ø22 at 1 mm/radius requires 5 passes; Ø38→Ø30 at 2 mm/radius requires 2.
const minimumPlan=structuredClone(plan);minimumPlan.operations[0].passes=5;minimumPlan.operations[1].passes=2;assert.equal(lab.evaluate(task,minimumPlan).success,true);minimumPlan.operations[0].passes=4;assert.equal(lab.evaluate(task,minimumPlan).success,false);
const timeline=process.timeline(task,plan);let profile=process.stock(task);for(const step of timeline){const next=process.cut(task,plan,profile,step);for(const u of [1,15,30,44]){const sample=p=>{let start=0;for(const seg of p.segments){if(u<=start+seg.length){const f=(u-start)/seg.length;return {d:seg.diameter+((seg.endDiameter??seg.diameter)-seg.diameter)*f,b:seg.bore??p.bore};}start+=seg.length;}};const before=sample(profile),after=sample(next);assert(after.d<=before.d+1e-8);assert(after.b>=before.b-1e-8);}profile=next;}
near(profile.segments[0].diameter,30);near(profile.segments[0].bore,22);
assert(spec.markdown().includes('δ(S,a)'));assert(spec.markdown().includes('12000'));assert.equal(JSON.stringify(spec.manifest()),JSON.stringify(document),'Rendering/example evaluation cannot mutate the formal contract');
console.log('Model specification: numerical examples, dialect bounds, 8 invariants, reachable states, guard outcomes, replay, atomic blocks and profile monotonicity passed.');
