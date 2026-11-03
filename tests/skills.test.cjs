'use strict';
const assert=require('node:assert/strict'),m=require('../skills-model.js'),course=require('../course-model.js'),library=require('../library-model.js');
assert.equal(m.skills.length,12);assert.equal(new Set(m.skills.map(s=>s.id)).size,12);
let generated=0;
for(const s of m.skills){
  assert.ok(course.lessons.some(l=>l.id===s.lesson));assert.ok(library.articles.some(a=>a.id===s.article));
  const semantics=new Set();
  for(let v=0;v<12;v++){
    const q=m.question(s.id,v);generated++;semantics.add(q.key);assert.ok(q.prompt&&q.hint&&q.explanation);const answer=q.choices?q.answer:q.value;
    assert.deepEqual(m.evaluate(q,answer),{valid:true,correct:true},`${s.id}/${v}`);
    assert.equal(m.evaluate(q,q.choices?(answer+1)%q.choices.length:answer+1).correct,false);
    for(const bad of [null,undefined,{},[],NaN,Infinity,'','  ','1 mm','0x1'])assert.equal(m.evaluate(q,bad).valid,false,s.id+' rejects '+String(bad));
    if(q.choices)assert.equal(m.evaluate(q,String(q.answer)).valid,false);
    else assert.equal(m.evaluate(q,String(q.value).replace('.',',')).correct,true);
  }
  assert.ok(semantics.size>=3,s.id+' has enough distinct problems for mastery');
}
assert.equal(generated,144);assert.throws(()=>m.question('bad'));assert.throws(()=>m.question('depth',12));
// Numerical oracles use the specified physical quantities, not the generated answer as expected value.
for(let v=0;v<12;v++){
  const expectations={
    depth:(2+(v%6)*.8)/2,
    allowance:24+2*(v%4)+[.2,.4,.6][Math.floor(v/4)],
    feed:[.1,.12,.2][v%3]*[600,800,1000,1200][Math.floor(v/3)],
    time:Math.round(60*[24,30,36][v%3]/((v%2?.2:.1)*(v<6?600:900))*10)/10,
    offset:-[-.4,-.2,.2,.4][v%4],coordinates:v%2?-(20+3*v):24+v
  };
  for(const [id,expected] of Object.entries(expectations))assert.ok(Math.abs(m.question(id,v).value-expected)<1e-6,`${id}/${v} independent formula`);
}
// Stable meanings even when choice positions rotate. One repeated story is one evidence key.
for(const id of ['modal','route','setup']){
  const interval=id==='setup'?4:3;
  for(let v=0;v<12-interval;v++){const a=m.question(id,v),b=m.question(id,v+interval);assert.equal(a.key,b.key);assert.equal(a.choices[a.answer],b.choices[b.answer]);}
}
// Independent boundary checks: exact tolerance vs rounded reading cannot share the same verdict.
assert.equal(m.question('tolerance',2).choices[m.question('tolerance',2).answer],'В пределах допуска');
assert.equal(m.question('rounding',1).choices[m.question('rounding',1).answer],'Интервал пересекает границу: уточнить замер');
assert.equal(m.question('rounding',2).choices[m.question('rounding',2).answer],'Весь интервал в допуске');
assert.equal(m.question('rounding',4).choices[m.question('rounding',4).answer],'Определённо больше допуска');
let state=m.create();const step=a=>state=m.transition(state,a),solve=()=>{const p=state.practice[state.selected],q=m.question(state.selected,p.variant);step({type:'answer',input:q.choices?q.answer:q.value});};
assert.equal(m.mastery(state,'depth').status,'new');assert.throws(()=>step({type:'answer',input:''}));assert.equal(state.records.length,0);
for(let i=0;i<3;i++){solve();if(i<2)step({type:'next'});}
assert.equal(m.mastery(state,'depth').status,'mastered');assert.equal(m.mastery(state,'depth').streak,3);
assert.throws(()=>step({type:'answer',input:2}));step({type:'next'});step({type:'answer',input:100});assert.equal(m.mastery(state,'depth').status,'review');solve();assert.equal(state.records.at(-1).clean,false);assert.equal(m.mastery(state,'depth').streak,0);assert.equal(m.recommend(state).id,'depth');
step({type:'next'});step({type:'hint'});solve();assert.equal(state.records.at(-1).clean,false);
step({type:'select',id:'feed'});solve();step({type:'select',id:'depth'});assert.equal(state.practice.depth.variant,4);assert.equal(state.practice.depth.done,true);
const repeated=m.create();repeated.records=Array.from({length:4},()=>({id:'modal',key:'modal:0',correct:true,clean:true}));assert.equal(m.mastery(repeated,'modal').streak,1);assert.equal(m.mastery(repeated,'modal').status,'learning');
// Checkpoint saves raw answers, reveals no result records before the last answer, then grades all skills.
step({type:'exam-start'});assert.throws(()=>step({type:'select',id:'time'}));assert.throws(()=>step({type:'hint'}));const count=state.records.length,questions=m.examQuestions(state.exam.round);
assert.equal(new Set(questions.map(q=>q.id)).size,12);
for(let i=0;i<12;i++){
  const q=questions[i];step({type:'exam-answer',input:i===0?(q.choices?(q.answer+1)%q.choices.length:q.value+1):(q.choices?q.answer:q.value)});
  if(i<11){assert.equal(state.records.length,count);assert.equal(state.exams.length,0);assert.equal(state.exam.answers.length,i+1);const resumed=m.restore(JSON.parse(JSON.stringify(m.snapshot(state))));assert.deepEqual(resumed,state);}
}
assert.equal(state.exam,null);assert.equal(state.exams.length,1);assert.equal(state.records.length,count+12);assert.equal(state.records.slice(-12).filter(r=>r.correct).length,11);assert.throws(()=>step({type:'exam-answer',input:0}));
step({type:'exam-start'});assert.notDeepEqual(m.examQuestions(0),m.examQuestions(1));step({type:'exam-cancel'});assert.equal(state.exam,null);assert.equal(state.exams.length,1);
assert.deepEqual(m.restore(JSON.parse(JSON.stringify(m.snapshot(state)))),state);
assert.deepEqual(m.restore({version:1,events:[],records:[{id:'depth',clean:true}],round:99}),m.create(),'restore recomputes evidence and round');
assert.deepEqual(m.restore({version:99,events:state.events}),m.create());
const prefix=m.snapshot(state);prefix.events=[...prefix.events,{type:'bad'},{type:'select',id:'time'}];assert.deepEqual(m.restore(prefix),state,'invalid transcript stops at last valid action');
console.log('Skills checks passed: 144 cards, evidence, retries, hints, boundary verdicts, 12-question checkpoint and replay.');
