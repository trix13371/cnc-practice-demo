'use strict';
const assert=require('node:assert/strict'),p=require('../progress-model.js'),pilot=require('../pilot-model.js'),f=require('./progress-fixtures.cjs');
const time=(day=0,minutes=0)=>new Date(Date.UTC(2026,9,26+day,9,minutes)).toISOString();
const archive=(a,day=0,minutes=0)=>({...structuredClone(a),createdAt:time(day,minutes)});
function main(mode='self'){
  let s=pilot.add(pilot.empty(),'P01',mode);s=pilot.capture(s,'P01','main','before',archive(p.empty()),time());s=pilot.start(s,'P01','main',time(0,1));s=pilot.observe(s,'P01','main','navigation','all','нашёл путь',time(0,2));s=pilot.capture(s,'P01','main','after',archive(f.full(),0,30),time(0,31));return pilot.finish(s,'P01','main',time(0,32));
}
const self=main();assert.equal(pilot.metrics(self).ended,0);assert.equal(pilot.metrics(self).self,1);assert.equal(pilot.outcome(self.participants[0],'main').training,true);
const route=require('../learning-path-model.js');
for(const size of [22,51,57,63,64]){
  const prior=structuredClone(self);
  for(const participant of prior.participants)for(const phase of ['main','followup'])for(const slot of ['before','after']){
    const shot=participant[phase][slot];if(!shot)continue;
    shot.rows=shot.rows.filter(r=>!["milling-setup-datums","milling-face-coverage","milling-slot-open","milling-slot-wide-layers"].includes(r.id)).filter(r=>size===64?true:size===22?route.get(r.id).kind!=='coursePractice':route.get(r.id).group!=='independentProject'&&(size===63||route.get(r.id).group!=='metrology')&&(size!==51||route.get(r.id).group!=='turningDeep'));
    assert.equal(shot.rows.length,size);shot.done=shot.rows.filter(r=>r.done).length;
  }
  assert.deepEqual(pilot.validate(prior),prior,'Historic '+size+'-step observations remain readable');
  const invalid=structuredClone(prior);invalid.participants[0].main.before.rows[0].id='operation-shoulder-control';
  assert.throws(()=>pilot.validate(invalid),'New units cannot be injected into an old route schema');
}
let s=main('novice');assert.deepEqual(pilot.metrics(s),{novices:1,self:0,started:1,ended:1,pending:0,navigation:1,firstCut:1,training:1,gcode:1,followup:0,delayed:0});
s=pilot.assign(s,'P01');const a=s.participants[0].assignment;assert.equal(a.training,'cycle-4');assert.equal(a.gcode,'transfer-a');assert.equal(a.from,time(3,32));assert.throws(()=>pilot.assign(s,'P01'),/уже/);
// An opened condition, including a no-action session, draft or archived branch, is familiar.
for(const variant of ['selected','draft','emptySession','history']){
  const raw=archive(f.full(),0,30);if(variant==='selected')raw.sections.training.current.selected='cycle-4';if(variant==='draft')raw.sections.training.current.drafts['cycle-4']={x:34.2,offset:0,feed:.2,rpm:800,tool:'turning',prediction:34.2,stage:'rough'};
  if(variant==='emptySession')raw.sections.training.current.sessions['cycle-4']=require('../training-model.js').snapshot(require('../training-model.js').create('cycle',4));
  if(variant==='history'){const b=structuredClone(raw.sections.gcode.current);b.selected='transfer-a';raw.sections.gcode.history.push(b);}
  const shot=pilot.snapshot(raw,time(0,31));assert(variant==='history'?shot.seen.gcode.includes('transfer-a'):shot.seen.training.includes('cycle-4'));
}
const before=archive(f.full(),4,0);s=pilot.capture(s,'P01','followup','before',before,time(4,1));s=pilot.start(s,'P01','followup',time(4,2));const after=archive(f.full(),4,30);after.sections.training.current.sessions['cycle-4']=require('../training-model.js').snapshot(f.cycle(4));after.sections.gcode.current.sessions['transfer-a']=require('../gcode-learning-model.js').snapshot(f.program('transfer-a'));
s=pilot.capture(s,'P01','followup','after',after,time(4,31));s=pilot.finish(s,'P01','followup',time(4,32));assert(pilot.outcome(s.participants[0],'followup').delayed);assert.equal(pilot.metrics(s).delayed,1);assert.equal(pilot.parse(JSON.stringify(s)).participants.length,1);
// External assistance must override an otherwise clean model proof, independently by target.
let helped=main('novice');helped.participants[0].main.end=null;helped=pilot.observe(helped,'P01','main','solutionHelp','training','подсказал X',time(0,31));helped=pilot.finish(helped,'P01','main',time(0,32));assert.equal(pilot.outcome(helped.participants[0],'main').training,false);assert.equal(pilot.outcome(helped.participants[0],'main').gcode,true);
// Early follow-up is retained honestly, never counted as delayed success.
const early=structuredClone(s);early.participants[0].followup.start=time(1,2);early.participants[0].followup.before=pilot.snapshot(archive(f.full(),1),time(1,1));assert.equal(pilot.metrics(early).delayed,0);
assert.throws(()=>pilot.capture(s,'P01','main','after',before,time(4,50)),/нельзя переписать/);
let unfinished=pilot.add(pilot.empty(),'NEW','novice');assert.equal(pilot.metrics(unfinished).navigation,0);assert.throws(()=>pilot.start(unfinished,'NEW','main',time()),/исходный/);assert.throws(()=>pilot.assign(unfinished,'NEW'),/завершите/);
unfinished=pilot.capture(unfinished,'NEW','main','before',archive(p.empty()),time());assert.throws(()=>pilot.start(unfinished,'NEW','main',time(0,31)),/свежий/);assert.throws(()=>pilot.start(unfinished,'NEW','main',time(-1)),/свежий/);
unfinished=pilot.start(unfinished,'NEW','main',time(0,1));assert.throws(()=>pilot.capture(unfinished,'NEW','main','after',archive(f.full(),0,0),time(0,20)),/новый JSON/);assert.throws(()=>pilot.finish(unfinished,'NEW','main',time(0,30)),/итоговый/);assert.throws(()=>pilot.observe(unfinished,'NEW','main','solutionHelp','all','',time(0,2)),/Укажите/);
const stale=main();stale.participants[0].main.end=null;assert.throws(()=>pilot.capture(stale,'P01','main','after',archive(p.empty(),0,40),time(0,41)),/шаги отсутствуют/);
const used=archive(f.full(),4);used.sections.gcode.current.selected=a.gcode;const replaced=pilot.capture(pilot.assign(main(),'P01'),'P01','followup','before',used,time(4,1));assert.equal(replaced.participants[0].assignment.gcode,'transfer-c');assert.equal(replaced.participants[0].assignment.previous.length,1);
const exhausted=main();exhausted.participants[0].main.after.seen.training=[...pilot.practical];assert.throws(()=>pilot.assign(exhausted,'P01'),/Не осталось/);
const bad=structuredClone(s);bad.participants[0].assignment.training='cycle-99';assert.throws(()=>pilot.parse(JSON.stringify(bad)));assert.throws(()=>pilot.parse('{"format":"cnc-pilot","__proto__":{}}'));assert.throws(()=>pilot.parse('x'.repeat(pilot.MAX_BYTES+1)));assert.throws(()=>pilot.add(pilot.add(pilot.empty(),'Self','self'),'SELF','novice'),/уже/);
const report=pilot.report(s);assert.match(report,/Самопроверок: 0/);assert.match(report,/цикл подтверждён/);assert.doesNotMatch(JSON.stringify(pilot.snapshot(f.full())),/G99|G01|actions|events|answers/);
console.log('Pilot: self-review isolation, observations, fresh snapshots, unseen conditions, assistance, follow-up window and corruption passed.');
