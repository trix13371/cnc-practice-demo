const assert = require('node:assert/strict');
const m = require('../model.js');
const good = task => ({x:task.target,offset:0,feed:.2,rpm:800,tool:'turning'});
for(let variant=0;variant<3;variant++) {
  let exam=m.createExam(variant,'2026-10-08T10:00:00.000Z');
  assert.throws(()=>m.gradeExam(exam));
  assert.throws(()=>m.advanceExam(exam));
  for(let i=0;i<3;i++) {
    const task=m.examTask(exam);
    assert.equal(m.evaluate(good(task),task).success,true);
    assert.equal(m.evaluate(task.defaults,task).success,false);
    assert.throws(()=>m.submitExam(exam,{...good(task),x:NaN}));
    assert.equal(exam.answers.length,i);
    exam=m.submitExam(exam,good(task));
    assert.throws(()=>m.submitExam(exam,good(task)));
    assert.deepEqual(m.restoreExam(JSON.parse(JSON.stringify(exam))),exam);
    if(i<2) exam=m.advanceExam(exam);
  }
  assert.equal(m.gradeExam(exam).percent,100);
  assert.throws(()=>m.advanceExam(exam));
}
let mixed=m.createExam(0);
for(let i=0;i<3;i++) {
  const task=m.examTask(mixed);
  mixed=m.submitExam(mixed,i===1?task.defaults:good(task));
  if(i<2)mixed=m.advanceExam(mixed);
}
assert.equal(m.gradeExam(mixed).correct,2);
assert.equal(m.gradeExam(mixed).percent,67);
assert.equal(m.restoreExam({...mixed,index:0}),null);
assert.equal(m.restoreExam({...mixed,variant:99}),null);
assert.equal(m.restoreExam({...mixed,answers:[null]}),null);
assert.equal(m.restoreExam({...mixed,answers:[...mixed.answers,{index:3,settings:{}}]}),null);
const task=m.tasks[0];
const noCut=m.evaluate({...good(task),x:40},task);
assert.equal(noCut.finalDiameter,32);assert.equal(noCut.depth,0);
assert.equal(m.evaluate({...good(task),x:26,offset:2},task).success,false);
assert.deepEqual([0,.16,.31,.91,1].map(m.phaseAt),[0,1,2,3,3]);
console.log('Exam checks passed: 3 variants, one submission, score, resume validation, non-cutting trajectory.');
