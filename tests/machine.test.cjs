'use strict';
const assert=require('node:assert/strict'),machine=require('../machine-model.js'),process=require('../process-model.js'),lab=require('../lab-model.js'),graphics=require('../machine-graphics.js');
const solve=t=>({offset:-t.bias,rpm:t.rpm[0],diagnosis:t.diagnosis?'offset':'none',operations:t.operations.map(o=>({id:o.id,diameter:o.diameter,endDiameter:o.endDiameter||null,length:o.length,tool:o.tool,feed:o.feed[0],passes:Math.ceil(Math.abs((o.kind==='bore'?t.bore:o.parent?t.operations.find(p=>p.id===o.parent).diameter:t.stock)-(o.kind==='bore'?o.diameter:Math.min(o.diameter,o.endDiameter||o.diameter)))/(2*o.maxDepth)-1e-9)}))});
assert.equal(machine.tasks.length,7);
assert.equal(machine.recommend({}).id,'diameter');
assert.equal(machine.recommend({diameter:{controlVersion:0}}).id,'diameter');
assert.equal(machine.recommend({diameter:{controlVersion:1}}).id,'offset');
assert.deepEqual(machine.search({query:'расточка'}).map(t=>t.id),['sleeve']);
assert.equal(machine.search({level:'hard'}).length,2);
assert.deepEqual(machine.search({filter:'passed'},{diameter:{controlVersion:0},offset:{controlVersion:1}}).map(t=>t.id),['offset']);
assert.equal(machine.search({query:'неттакогослова'}).length,0);
assert.deepEqual(machine.restoreStages({version:1,stages:{diameter:3,sleeve:2,taper:4,feed:'1',nope:1}}),{version:1,stages:{diameter:3,sleeve:2}});
assert.deepEqual(machine.restoreStages(null),{version:1,stages:{}});
assert.deepEqual(machine.restoreStages({version:2,stages:{diameter:3}}),machine.restoreStages(null));
assert.equal(machine.sample(machine.target('diameter'),7).diameter,32);
assert.equal(machine.sample(machine.target('diameter'),20).diameter,28);
assert.equal(machine.sample(machine.target('sleeve'),20).bore,22);
assert.ok(machine.sample(machine.target('taper'),50).diameter<32);

// Exact control locations are meaningful: seat control must avoid its groove.
const taper=machine.get('taper'),plan=solve(taper),total=process.timeline(taper,plan).length,final=process.stateAt(taper,plan,total),points=machine.checkpoints(taper.id);
assert.equal(points.length,4);
const seat=points.find(p=>p.surface==='seat');
assert.equal(process.measure(taper,final,'seat',seat.fraction,'micrometer').id,'seat');
assert.equal(process.measure(taper,final,'seat',.5,'micrometer').id,'groove');
assert.deepEqual(points.filter(p=>p.surface==='cone').map(p=>p.fraction),[.05,.95]);
assert.deepEqual(points.filter(p=>p.surface==='cone').map(p=>+p.target.toFixed(2)),[31.4,20.6]);
const logs=points.map(p=>({...process.measure(taper,final,p.surface,p.fraction,'micrometer'),stage:total,answer:'ok',correct:true}));
let snapshot={finished:true,total,cursor:total,reached:total,logs,result:lab.evaluate(taper,plan),controlPassed:true};
assert.equal(machine.progress(taper.id,snapshot).controlled,true);
assert.equal(machine.progress(taper.id,{...snapshot,logs:logs.slice(0,-1)}).controlled,false);
assert.equal(machine.progress(taper.id,{...snapshot,logs:logs.map(m=>({...m,stage:total-1}))}).measured,0);
assert.equal(machine.progress(taper.id,{...snapshot,finished:false}).controlled,false);
assert.equal(machine.progress(taper.id,{...snapshot,controlPassed:false}).controlled,false);
assert.equal(machine.progress('diameter',{finished:true,measurement:{surface:'stock',reading:32},inspection:{passed:true},controlPassed:true}).controlled,false);
assert.equal(machine.progress('diameter',{finished:true,measurement:{surface:'worked',reading:28},inspection:{passed:true},controlPassed:true}).controlled,true);
assert.equal(machine.progress('diameter',{finished:true,measurement:{surface:'worked',reading:28},inspection:{passed:false},controlPassed:false}).controlled,false);

// Restoration checks readings against the manufactured state, not saved flags.
let stored={version:2,cursor:total,reached:total,logs};
let restored=process.restoreSession(taper,plan,JSON.parse(JSON.stringify(stored)));
assert.equal(restored.logs.length,4);
assert.equal(process.control(taper,plan,restored.logs).passed,true);
assert.deepEqual(process.restoreSession(taper,plan,{cursor:2}),{cursor:2,reached:2,logs:[]},'legacy cursor resumes without fabricated measurements');
assert.equal(process.restoreSession(taper,plan,{...stored,cursor:2}).logs.length,4,'reviewing an earlier step keeps evidence of executed later steps');
assert.deepEqual(process.restoreSession(taper,plan,{...stored,reached:total+1}),{cursor:0,reached:0,logs:[]});
assert.deepEqual(process.restoreSession(taper,plan,{...stored,version:9}),{cursor:0,reached:0,logs:[]});
assert.equal(process.restoreSession(taper,plan,{...stored,logs:logs.map(m=>({...m,reading:m.reading+1}))}).logs.length,0);
assert.equal(process.restoreSession(taper,plan,{...stored,logs:logs.map(m=>({...m,resolution:.5}))}).logs.length,0);
assert.equal(process.restoreSession(taper,plan,{...stored,logs:logs.map(m=>({...m,stage:total+1}))}).logs.length,0);
assert.equal(process.restoreSession(taper,plan,{...stored,logs:logs.map(m=>({...m,answer:undefined,correct:true}))}).logs.length,0);
restored=process.restoreSession(taper,plan,{...stored,logs:[{...logs[0],answer:'small',correct:true}]});
assert.equal(restored.logs[0].correct,false,'correctness is recalculated from the recorded answer');
const changed=structuredClone(plan);changed.operations.find(o=>o.id==='cone').endDiameter=21;
assert.ok(process.restoreSession(taper,changed,stored).logs.length<logs.length,'measurements changed by a modified trajectory are rejected');
const invalid=structuredClone(plan);invalid.operations[0].tool='boring';
assert.deepEqual(process.restoreSession(taper,invalid,stored),{cursor:0,reached:0,logs:[]});

// Every illustrated part shares its geometry with the processing model.
for(const t of machine.tasks){assert.ok(machine.target(t.id).segments.length);const svg=graphics.svg(t.id,{profile:machine.stock(t.id),compare:true,selected:machine.surfaces(t.id)[0].id});assert.match(svg,/<svg/);assert.doesNotMatch(svg,/NaN|undefined|Infinity/);}
assert.equal(graphics.svg('unknown'),'');
console.log('Machine workshop checks passed: seven profiles, search, checkpoints, current-attempt evidence and validated session recovery.');