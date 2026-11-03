'use strict';
const assert=require('node:assert/strict'),g=require('../gcode-model.js'),m=require('../gcode-learning-model.js');
const values={coordinates:{x:36,z:3},motion:{z:-15,motion:1},modal:{x:28,z:-10},feed:{feed:.12,feedMode:99},spindle:{rpm:600,spindle:true},retract:{x:34,z:-20},contour:{x:26,z:-20},program:{x:28,z:-20,motion:1},'transfer-a':{x:24,z:-35,motion:1},'transfer-b':{x:34,z:-30,motion:1},'transfer-c':{x:22,z:-50,motion:1}};
const run=(s,a)=>m.transition(s,a).state;
const solve=id=>{const code=g.tasks.find(t=>t.id===id).answer;return run(run(m.create(id),{type:'predict',code,values:values[id]}),{type:'check',code});};
for(const t of g.tasks){
 const f=m.forecast(t.id,t.answer,values[t.id]);assert.equal(f.valid,true,t.id);assert.equal(f.correct,true,t.id);
 const s=solve(t.id);assert.equal(s.passed.independent,true,t.id);assert.deepEqual(m.restore(m.snapshot(s)),s);
 const denied=m.transition(m.create(t.id),{type:'check',code:t.answer});assert.equal(denied.ok,false);assert.equal(denied.grade,undefined);assert.equal(denied.state.passed,null);
}
const task=g.tasks.find(t=>t.id==='transfer-a'),code=task.answer;
let s=m.create(task.id);s=run(s,{type:'predict',code,values:{x:24,z:-30,motion:1}});assert.equal(s.predictionErrors,1);
s=run(s,{type:'reset'});s=run(s,{type:'predict',code,values:values[task.id]});s=run(s,{type:'check',code});assert.equal(s.passed.independent,false,'reset retains earlier prediction error');
assert.equal(m.forecast(task.id,code,{x:1,z:2,motion:0}).message.includes('24'),false,'wrong forecast does not print numeric answer');
let changed=run(m.create(task.id),{type:'predict',code,values:values[task.id]});assert.equal(m.transition(changed,{type:'check',code:code+'\n(comment)'}).grade,undefined,'code change requires a new forecast');
// A forecast follows the actual erroneous draft, not the desired endpoint or movement.
const starter=g.tasks.find(t=>t.id==='transfer-c').starter;
assert.equal(m.forecast('transfer-c',starter,{x:22,z:-45,motion:1}).correct,true);
assert.equal(m.forecast('transfer-a',task.starter,{x:24,z:-35,motion:0}).correct,true);
// Equivalent subdivision is accepted; the forecast is for the selected actual line.
const split=code.replace('G01 Z-35 F0.12','G01 Z-10 F.12\nZ-35');
let equivalent=run(m.create(task.id),{type:'predict',code:split,values:{x:24,z:-10,motion:1}});equivalent=run(equivalent,{type:'check',code:split});assert.equal(equivalent.passed.independent,true);
assert.equal(g.grade(task.id,code.replace('G00 X32\nZ5\nM05','M05\nG00 X32\nZ5')).correct,false,'new final requires stop after withdrawal');
// Historical independent evidence survives subsequent help and invalid attempts.
let best=run(solve(task.id),{type:'help',source:'lesson'});best=run(best,{type:'reset'});best=run(best,{type:'predict',code,values:values[task.id]});best=run(best,{type:'check',code});assert.equal(best.passed.independent,true);
const forged=m.restore({...m.snapshot(m.create(task.id)),passed:{code,independent:true},prediction:{code,values:values[task.id]}});assert.equal(forged.passed,null);
for(const bad of [null,[],{}, {version:1,events:[]}, {version:1,id:task.id,events:[{type:'predict',code,values:[]}]}, {version:1,id:task.id,events:[{type:'predict',code,values:{x:NaN,z:0,motion:1}}]}, {version:1,id:task.id,events:[{type:'help',source:'unknown'}]}])assert.equal(m.restore(bad),null);
const old={version:1,selected:'program',phases:{program:'practice'},drafts:{program:'draft'},passed:{program:{code:g.tasks.find(t=>t.id==='program').answer,assisted:false},[task.id]:{code,assisted:false}},helped:{}};
let book=m.restoreBook(null,old);assert.equal(book.selected,'program');assert.equal(book.drafts.program,'draft');assert.equal(m.evidence(book,'program').legacy,true);assert.equal(m.evidence(book,task.id).passed,false,'legacy cannot forge a new final');
book.sessions[task.id]=best;book.predictionDrafts[task.id]={x:'24',z:'-35',motion:'1'};
assert.deepEqual(m.restoreBook(m.snapshotBook(book)),book,'reload retains legacy, prediction drafts and verified best result');
assert.equal(m.restoreBook({...m.snapshotBook(book),sessions:{coordinates:m.snapshot(best)}}),null,'session key must match identity');
assert.equal(m.restoreBook({...m.snapshotBook(book),sessions:{bad:m.snapshot(best)}}),null);
assert.equal(m.restoreBook({...m.snapshotBook(book),sessions:{[task.id]:{...m.snapshot(best),events:[{type:'invalid'}]}}}),null);
assert.equal(m.nextFinal(book),task.id,'earned independent result remains reviewable');
book=m.restoreBook(null);assert.equal(m.nextFinal(book),'transfer-a');
for(const [id,next]of [['transfer-a','transfer-b'],['transfer-b','transfer-c'],['transfer-c',null]]){book.sessions[id]=run(m.create(id),{type:'help',source:'hint'});assert.equal(m.nextFinal(book),next);}
assert.equal(m.target('feed','G00 X30 Z-12').frame,null,'a missing F produces a useful incomplete-code state');
console.log('G-code learning: forecasts for 11 tasks, current-code gate, persistent help/errors, independent final, legacy migration and replay passed.');
