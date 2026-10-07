const assert=require('node:assert/strict'),m=require('../lab-model.js');
function solution(t){return {offset:-t.bias,rpm:t.rpm[0],diagnosis:t.diagnosis?'offset':'none',operations:t.operations.map(o=>({id:o.id,diameter:o.diameter,endDiameter:o.endDiameter||null,length:o.length,tool:o.tool,feed:o.feed[0],passes:Math.ceil((o.kind==='bore'?(o.diameter-t.bore):(o.parent?t.operations.find(p=>p.id===o.parent).diameter:t.stock)-Math.min(o.diameter,o.endDiameter||o.diameter))/(2*o.maxDepth))}))};}
for(const t of m.tasks){
  const p=solution(t);assert.equal(m.evaluate(t,p).success,true,t.id);assert.equal(m.evaluate(t,m.defaults(t)).success,false);
  const q=structuredClone(p);q.operations[q.operations.length-1].passes=1;assert.equal(m.evaluate(t,q).success,false,'insufficient passes');
  const bad=structuredClone(p);bad.operations[0].length+=2;assert.equal(m.evaluate(t,bad).success,false,'wrong dimension');
  for(const value of [null,{}, {...p,offset:NaN}, {...p,rpm:Infinity}, {...p,operations:[p.operations[0],p.operations[0]]}])assert.equal(m.validate(t,value),false);
  assert.deepEqual(m.profile(t,p),m.profile(t),'correct geometry matches target');
}
const sleeve=m.tasks.find(t=>t.id==='sleeve'),s=solution(sleeve);
s.operations.reverse();assert.match(m.evaluate(sleeve,s).errors.join(' '),/Порядок/);
s.operations.find(o=>o.id==='bore').diameter=24;assert.match(m.evaluate(sleeve,s).errors.join(' '),/Стенка/);
const taper=m.tasks.find(t=>t.id==='taper'),t=solution(taper);
t.operations.find(o=>o.id==='groove').tool='turning';assert.match(m.evaluate(taper,t).errors.join(' '),/канавочный/);
const profile=m.profile(taper);assert.equal(profile.segments.reduce((s,p)=>s+p.length,0),65);assert.equal(profile.segments[1].diameter,26);assert.equal(profile.segments.at(-1).endDiameter,20);
const calibration=m.tasks.find(t=>t.id==='calibration'),c=solution(calibration);
c.offset=0;c.operations.forEach(o=>o.diameter-=.4);assert.equal(m.evaluate(calibration,c).success,false,'must diagnose and correct offset, not program');
c.operations[0].passes=1.5;assert.equal(m.validate(calibration,c),false);
console.log('Lab checks passed: four parts, depth per pass, order, tools, wall, taper, diagnosis and validation.');
