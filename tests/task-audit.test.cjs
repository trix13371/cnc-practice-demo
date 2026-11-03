'use strict';
const assert=require('node:assert/strict'),basic=require('../model.js'),lab=require('../lab-model.js'),process=require('../process-model.js'),training=require('../training-model.js'),skills=require('../skills-model.js'),guides=require('../task-guides.js');
const good={x:28,offset:0,feed:.2,rpm:800,tool:'turning'},measurement={surface:'worked',reading:28,resolution:.1,verdict:'ok'};
assert.equal(basic.inspect(good,basic.tasks[0],measurement).passed,true);
for(const change of [{surface:'stock'},{reading:32},{verdict:'large'},{resolution:1}])assert.equal(basic.inspect(good,basic.tasks[0],{...measurement,...change}).passed,false);
assert.equal(basic.inspect({...good,x:28.1},basic.tasks[0],{...measurement,reading:28.1}).passed,false,'rounded tolerance boundary cannot certify');
assert.equal(basic.inspect({...good,feed:.8},basic.tasks[0],measurement).passed,false);
assert.equal(basic.tasks[2].defaults.rpm<600,true,'feed task exercises both rate quantities');
function solve(t){return {offset:-t.bias,rpm:t.rpm[0],diagnosis:t.diagnosis?'offset':'none',operations:t.operations.map(o=>({id:o.id,diameter:o.diameter,endDiameter:o.endDiameter||null,length:o.length,tool:o.tool,feed:o.feed[0],passes:Math.ceil(Math.abs((o.kind==='bore'?t.bore:o.parent?t.operations.find(p=>p.id===o.parent).diameter:t.stock)-(o.kind==='bore'?o.diameter:Math.min(o.diameter,o.endDiameter||o.diameter)))/(2*o.maxDepth)-1e-9)}))};}
for(const t of lab.tasks){
 const p=solve(t),stage=process.timeline(t,p).length,state=process.stateAt(t,p,stage),logs=[];
 assert.equal(lab.evaluate(t,p).success,true);assert.equal(process.control(t,p,logs).passed,false,'animation alone cannot certify '+t.id);
 for(const s of process.surfaces(t))for(const f of s.endDiameter&&s.endDiameter!==s.diameter?[.05,.95]:[.05]){const m=process.measure(t,state,s.id,f,s.kind==='bore'?'caliper':'micrometer');logs.push({...m,stage,correct:true});}
 assert.equal(process.control(t,p,logs).passed,true,t.id+' all required controls');
 assert.equal(process.control(t,p,logs.map(m=>({...m,stage:stage-1}))).passed,false,'old measurements');
 assert.equal(process.control(t,p,logs.map(m=>({...m,correct:false}))).passed,false,'wrong conclusion');
 for(const s of process.surfaces(t))assert.equal(process.control(t,p,logs.filter(m=>m.id!==s.id)).passed,false,'missing '+s.id);
 assert.ok(guides.get(t.id));
}
const taper=lab.tasks.find(t=>t.id==='taper'),p=solve(taper),stage=process.timeline(taper,p).length,state=process.stateAt(taper,p,stage);
const viaSeat=process.measure(taper,state,'seat',.5,'micrometer');assert.equal(viaSeat.id,'groove','a seat measurement on the groove certifies the groove, not the seat');
let logs=process.surfaces(taper).map(s=>({...process.measure(taper,state,s.id,.05,'micrometer'),stage,correct:true}));assert.equal(process.control(taper,p,logs).passed,false,'one cone end is insufficient');
const tooLong=solve(lab.tasks[0]);tooLong.operations[1].length+=.05;assert.equal(lab.evaluate(lab.tasks[0],tooLong).success,false,'a dimension inside tolerance still cannot extend past the blank');
for(const t of basic.tasks)assert.ok(guides.get(t.id));
for(const f of training.families)for(const v of training.variants(f.id)){const t=training.task(f.id,v);assert.ok(guides.get(f.id==='offset'?'offsetPractice':f.id));assert.equal(Math.ceil((t.stock-t.target-t.allowance)/(2*t.maxDepth)-1e-8),f.id==='passes'?4:f.id==='cycle'&&[3,5].includes(v)?2:1);}
// A corrected false conclusion can pass the exercise, but cannot become independent work.
let session=training.create();const action=a=>{const r=training.transition(session,a);assert.equal(r.ok,true,r.message);session=r.state;};
for(const type of ['clamp','zero','door','spindle'])action({type,value:true});
for(const [stage,x,feed] of [['rough',28.4,.2],['finish',28,.12]])action({type:'cut',stage,x,feed,rpm:800,tool:'turning',offset:0,prediction:x});
action({type:'spindle',value:false});action({type:'measure',instrument:'micrometer'});
action({type:'inspect',verdict:'large',diagnosis:'none'});assert.equal(training.grade(session).inspectionErrors,1);
action({type:'inspect',verdict:'ok',diagnosis:'none'});assert.equal(training.grade(session).passed,true);assert.equal(training.grade(session).independent,false);
assert.deepEqual(training.restore(training.snapshot(session)),session,'inspection quality replays from original actions');
for(const s of skills.skills)for(let v=0;v<12;v++){const q=skills.question(s.id,v);assert.equal(skills.evaluate(q,q.choices?q.answer:q.value).correct,true);}
console.log('Task audit passed: seven exercises, twelve practice variants, 144 cards, mandatory fresh control and cone coverage.');
