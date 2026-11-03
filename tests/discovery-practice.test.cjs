'use strict';
const assert=require('node:assert/strict'),m=require('../discovery-practice-model.js'),course=require('../course-model.js'),progress=require('../progress-model.js');
const solve=id=>{let s=m.create(id);for(let i=0;i<m.questions[id].length;i++){s=m.transition(s,{type:'answer',choice:m.current(s).answer});if(!s.complete)s=m.transition(s,{type:'next'});}return s;};
assert.equal(m.ids.length,8);assert.equal(Object.values(m.questions).flat().length,24);
for(const id of m.ids){
  let s=m.create(id);assert.equal(s.complete,false);assert.throws(()=>m.transition(s,{type:'next'}));
  const q=m.current(s),wrong=m.scenes[q.scene].choices.find(c=>c.id!==q.answer).id;
  const chosen=m.select(s,wrong);assert.equal(chosen.events.length,0);assert.equal(chosen.complete,false);assert.equal(chosen.selection,wrong);
  s=m.transition(chosen,{type:'answer',choice:wrong});assert.equal(s.errors,1);assert.equal(s.step,0);assert.equal(s.last.correct,false);assert.throws(()=>m.transition(s,{type:'next'}));
  s=m.transition(s,{type:'hint'});assert.equal(s.hints.length,1);assert.throws(()=>m.transition(s,{type:'hint'}));
  assert.deepEqual(m.restore(JSON.parse(JSON.stringify(m.snapshot(s)))),s);
  s=m.transition(s,{type:'answer',choice:q.answer});assert.equal(s.complete,false);assert.throws(()=>m.select(s,wrong));
  s=m.transition(s,{type:'next'});assert.equal(s.step,1);assert.equal(s.selection,null);assert.equal(s.errors,1);assert.equal(s.hints.length,1);
  const finished=solve(id);assert.equal(finished.complete,true);assert.equal(finished.step,2);assert.equal(finished.errors,0);assert.throws(()=>m.transition(finished,{type:'next'}));
  const path=course.restorePath({version:1,selected:id,phases:{[id]:2},explored:[],practice:{[id]:m.snapshot(finished)}});
  assert.equal(course.canCheck(id,path,{}),true);assert.equal(path.phases[id],2);assert.deepEqual(course.restorePath(JSON.parse(JSON.stringify(path))),path);
  assert.equal(Object.keys(course.restore(path).answers).length,0,'Practice cannot forge a quiz answer');
  assert.equal(m.restore({...m.snapshot(finished),id:'unknown'}),null);
}
const fresh=m.snapshot(m.create('machine'));assert.equal(m.restore({...fresh,events:[{type:'next'}]}),null);assert.equal(m.restore({...fresh,events:[{type:'answer',choice:'__proto__'}]}),null);assert.equal(m.restore({...fresh,events:[{type:'hint',extra:1}]}),null);
assert.equal(m.restore({...fresh,events:Array(m.MAX_EVENTS+1).fill({type:'hint'})}),null);assert.equal(m.restore({...fresh,complete:true,step:3}).complete,false,'Cached completion is not evidence');
const pending=m.select(m.create('machine'),'stock'),archive=progress.empty();archive.sections.coursePath.current={...course.restorePath(null),practice:{machine:m.snapshot(pending)}};
const round=progress.parse(progress.stringify(archive));assert.equal(round.sections.coursePath.current.practice.machine.selection,'stock');assert.equal(progress.summary(round).progress.done,0);
const incoming=progress.empty();incoming.sections.coursePath.current={...course.restorePath(null),practice:{axes:m.snapshot(solve('axes'))}};
const merged=progress.merge(round,incoming);assert.equal(merged.sections.coursePath.current.practice.machine.selection,'stock');assert.equal(m.restore(merged.sections.coursePath.current.practice.axes).complete,true);assert.equal(progress.summary(merged).progress.done,0);assert.deepEqual(progress.merge(merged,incoming).sections,merged.sections,'Repeat import is stable');
const invalid=structuredClone(round);invalid.sections.coursePath.current.practice.machine.events=[{type:'next'}];assert.throws(()=>progress.validate(invalid),/практики/);
const old=course.restorePath({version:1,selected:'machine',phases:{machine:2},explored:['machine']});assert.equal(course.canCheck('machine',old,{}),true,'Historical exploration stays valid');assert.equal(old.practice,undefined);
for(const id of m.ids){
  let s=m.create(id);
  for(const q of m.questions[id]){
    assert(m.scenes[q.scene]);assert(q.hint&&q.copy&&q.success);
    if(q.kind==='number'){
      s=m.select(s,'');assert.equal(m.answerable(s),false);assert.throws(()=>m.transition(s,{type:'answer',choice:''}));
      for(const invalid of ['NaN','Infinity','1e1','18 мм','2+2','<script>','1,2.3','9'.repeat(33)])assert.equal(m.parseNumber(invalid),null);
      s=m.select(s,'2+');assert.equal(m.answerable(s),false);assert.deepEqual(m.restore(m.snapshot(s)),s,'Incomplete numeric drafts survive reload');
      const wrong=String(Number(q.answer)+1);s=m.select(s,wrong);s=m.transition(s,{type:'answer',choice:wrong});assert.equal(s.last.correct,false);assert.equal(s.complete,false);assert(m.wrongFeedback(q,wrong));
      const right=q.answer.replace('.',',');s=m.select(s,right);assert.equal(m.answerable(s),true);s=m.transition(s,{type:'answer',choice:right});assert.equal(s.last.correct,true);
      assert.deepEqual(m.restore(JSON.parse(JSON.stringify(m.snapshot(s)))),s);
    }else s=m.transition(s,{type:'answer',choice:q.answer});
    if(!s.complete)s=m.transition(s,{type:'next'});
  }
  assert.equal(s.complete,true);
}
let calculation=m.create('diameter');calculation=m.transition(calculation,{type:'answer',choice:'diameter'});calculation=m.transition(calculation,{type:'next'});calculation=m.select(calculation,'18,');
const calcArchive=progress.empty();calcArchive.sections.coursePath.current.practice={diameter:m.snapshot(calculation)};
const calcRound=progress.parse(progress.stringify(calcArchive));assert.equal(calcRound.sections.coursePath.current.practice.diameter.selection,'18,');assert.equal(progress.summary(calcRound).progress.done,0);
const forgedCalc=structuredClone(calcArchive);forgedCalc.sections.coursePath.current.practice.diameter.events.push({type:'answer',choice:'2+2'});assert.throws(()=>progress.validate(forgedCalc),/практики/);
for(const id of m.ids){const legacy=course.restorePath({version:1,selected:id,phases:{[id]:2},explored:[id]});assert.equal(course.canCheck(id,legacy,{}),true,'Earlier exploration remains valid: '+id);}
console.log('Beginner practice: 8 lessons, 24 actions, numeric drafts/decimal input, wrong choices, replay, limits, progress transfer and legacy gates passed.');
