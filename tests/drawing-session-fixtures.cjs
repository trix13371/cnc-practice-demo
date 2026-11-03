const assert=require('node:assert/strict'),m=require('../drawing-session-model.js');
function complete(){let s=m.create();const run=a=>s=m.transition(s,a),next=()=>run({type:'next'});
assert.throws(next);for(const surface of ['large','small','face'])run({type:'inspect',surface});next();
for(const value of ['length','diameter'])run({type:'dimension',value});next();
run({type:'dimension',value:'length'});run({type:'answer',value:'B'});assert(!s.correct);run({type:'dimension',value:'diameter'});run({type:'answer',value:'B'});next();
assert.throws(()=>run({type:'zero'}));run({type:'close'});assert.equal(s.reading,120);run({type:'zero'});assert.equal(s.reading,0);next();
run({type:'record',value:'28,08'});assert(!s.correct,'Reading alone cannot bypass physical setup');
assert.throws(()=>run({type:'zero'}));run({type:'inspect',surface:'small'});run({type:'mode',value:'inside'});run({type:'close'});assert(!s.contact);
run({type:'mode',value:'outside'});run({type:'close'});assert.equal(s.reading,28080);run({type:'record',value:'28.08'});next();
run({type:'bounds',lower:'27,80',upper:'28,20'});run({type:'verdict',value:'accept'});next();
run({type:'hint'});run({type:'inspect',surface:'large'});run({type:'mode',value:'outside'});run({type:'close'});run({type:'record',value:'36'});assert(!s.correct);
run({type:'inspect',surface:'small'});run({type:'close'});run({type:'record',value:'30,08'});next();
const draftState=m.snapshot(s);run({type:'bounds',lower:'29.90',upper:'30.20'});run({type:'verdict',value:'accept'});assert(!s.correct);run({type:'verdict',value:'uncertain'});next();
run({type:'bounds',lower:'29.90',upper:'30.20'});run({type:'verdict',value:'reject'});next();assert(s.complete&&s.assisted);assert.deepEqual(m.restore(m.snapshot(s)),s);
return s;}
module.exports={complete};
