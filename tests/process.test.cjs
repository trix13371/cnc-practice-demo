const assert=require('node:assert/strict'),lab=require('../lab-model.js'),processModel=require('../process-model.js'),exam=require('../route-exam-model.js');
function solve(t){return {offset:-t.bias,rpm:t.rpm[0],diagnosis:t.diagnosis?'offset':'none',operations:t.operations.map(o=>({id:o.id,diameter:o.diameter,endDiameter:o.endDiameter||null,length:o.length,tool:o.tool,feed:o.feed[0],passes:Math.ceil(Math.abs((o.kind==='bore'?t.bore:o.parent?t.operations.find(p=>p.id===o.parent).diameter:t.stock)-(o.kind==='bore'?o.diameter:Math.min(o.diameter,o.endDiameter||o.diameter)))/(2*o.maxDepth)-1e-9)}))};}
for(const t of lab.tasks){const p=solve(t),steps=processModel.timeline(t,p);let state=processModel.stock(t);for(const step of steps){const next=processModel.cut(t,p,state,step);for(let x=0;x<t.length;x+=1){const sample=(profile)=>{let z=0;for(const s of profile.segments){if(x<z+s.length)return s.diameter+(s.endDiameter-s.diameter)*(x-z)/s.length;z+=s.length;}};assert.ok(sample(next)<=sample(state)+1e-8,'material cannot grow');}state=next;}
  for(const surface of processModel.surfaces(t))for(const f of [.1,.5,.9])assert.equal(processModel.measure(t,state,surface.id,f,'caliper').verdict,'ok',`${t.id}/${surface.id}/${f}`);
  assert.deepEqual(processModel.stateAt(t,p,steps.length),state);
}
const sleeve=lab.tasks[1],p=solve(sleeve),initial=processModel.stock(sleeve),first=processModel.cut(sleeve,p,initial,processModel.timeline(sleeve,p)[0]);assert.equal(first.segments[0].bore,14);assert.equal(processModel.measure(sleeve,initial,'bore',.5,'caliper').reading,12);assert.throws(()=>processModel.measure(sleeve,initial,'bore',.5,'micrometer'));
const wrong=structuredClone(p);wrong.operations[0].tool='turning';assert.throws(()=>processModel.timeline(sleeve,wrong));wrong.operations[0].tool='boring';wrong.operations[0].diameter=60;assert.throws(()=>processModel.stateAt(sleeve,wrong,wrong.operations[0].passes));
for(const level of ['medium','hard'])for(const seed of [0,1,4,15,4294967295]){let e=exam.create(level,seed);for(let i=0;i<2;i++){const t=exam.taskFor(level,seed,i),answer=solve(t);assert.equal(lab.evaluate(t,answer).success,true);assert.equal(exam.gradeTask(t,answer).score,100);const long=structuredClone(answer);long.operations[0].passes+=2;assert.equal(exam.gradeTask(t,long).score,96);e=exam.submit(e,answer);assert.throws(()=>exam.submit(e,answer));assert.ok(exam.restore(e));if(i===0){assert.throws(()=>exam.grade(e));e=exam.advance(e);}}assert.equal(exam.grade(e).score,100);assert.ok(exam.restore(e));assert.equal(exam.restore({...e,index:0}),null);}
const e=exam.create('medium',1),t=exam.taskFor('medium',1,0);assert.throws(()=>exam.advance(e));assert.equal(exam.restore({...e,seed:-1}),null);assert.notDeepEqual(exam.taskFor('medium',1,0),exam.taskFor('medium',2,0));
// High category totals cannot compensate for an incorrect tool or unsafe depth.
const correct=solve(t),badTool=structuredClone(correct);badTool.operations[0].tool='grooving';
const rejected=exam.gradeTask(t,badTool);assert.equal(rejected.rawScore,97);assert.equal(rejected.score,59);assert.equal(rejected.passed,false);
const tooDeep=structuredClone(correct);tooDeep.operations[0].passes=1;assert.equal(exam.gradeTask(t,tooDeep).passed,false);
const tooLong=structuredClone(correct);tooLong.operations[0].length+=1;assert.equal(exam.gradeTask(t,tooLong).passed,false);
const goodGrade=exam.gradeTask(t,correct);assert.equal(goodGrade.passed,true);assert.equal(goodGrade.score,100);
let failedExam=exam.submit(e,badTool);failedExam=exam.advance(failedExam);failedExam=exam.submit(failedExam,solve(exam.taskFor('medium',1,1)));
assert.equal(exam.grade(failedExam).passed,false);assert.equal(exam.grade(failedExam).score,80,'rounded mean may be 80 but mandatory part still failed');
let passedExam=exam.submit(exam.create('medium',1),correct);passedExam=exam.advance(passedExam);passedExam=exam.submit(passedExam,solve(exam.taskFor('medium',1,1)));assert.equal(exam.grade(passedExam).passed,true);
// The existing route workshop also judges the measurement interval, not hidden geometry.
const gaugeTask=lab.tasks[0],gaugePlan=solve(gaugeTask);gaugePlan.operations[0].diameter+=.06;
const gaugeState=processModel.stateAt(gaugeTask,gaugePlan,processModel.timeline(gaugeTask,gaugePlan).length);
assert.equal(processModel.measure(gaugeTask,gaugeState,'a',.5,'caliper').verdict,'uncertain');
assert.equal(processModel.measure(gaugeTask,gaugeState,'a',.5,'micrometer').verdict,'ok');
console.log('Process and exam checks passed: material removal, all surfaces, bore gauges, variants, scoring, one submission and recovery.');
