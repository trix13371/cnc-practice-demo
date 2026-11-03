'use strict';
const assert=require('node:assert/strict'),g=require('../gcode-model.js');
const bad=s=>assert.ok(g.simulate(s).errors.length,s);
const good=s=>{const r=g.simulate(s);assert.deepEqual(r.errors,[],s);return r;};

// Independently specified endpoint states: coordinates are absolute and modal.
let r=good('G99\nG01 X30 Z-10 F0.12\nZ-20\nX28');
assert.deepEqual(r.moves.map(m=>[m.to.x,m.to.z,m.mode,m.feed,m.feedMode]),[[30,-10,1,.12,99],[30,-20,1,.12,99],[28,-20,1,.12,99]]);
assert.deepEqual([r.initial.x,r.initial.z],[40,5]);
assert.deepEqual([r.state.x,r.state.z],[28,-20]);
assert.deepEqual([r.trace[1].before.x,r.trace[1].after.x],[40,30]);
assert.equal(r.moves[1].from.z,-10);
r=good('%\no1234\nN10 g21 g18 g99;\nN20 g97 s600 m03\nN30 g0 x36 z3 (a comment)\nN40 m05\nN50 m30\n%');
assert.equal(r.state.spindle,false);assert.equal(r.state.ended,true);assert.equal(r.moves.length,1);
assert.equal(r.moves[0].spindle,true);assert.equal(r.moves[0].rpm,600);assert.equal(r.trace[0].line,2);
assert.equal(good('F0.1\nG01 Z-1').moves[0].feed,.1,'F can be declared before a move');
assert.equal(good('S600\nM03').state.spindle,true,'S and M may be separate blocks');
assert.equal(good('G98\nG01 Z-10 F60').moves[0].feedMode,98);
assert.equal(good('G01 Z-2 F.1\nG00 Z5\nZ7').moves[2].mode,0);

// Strict subset: never discard unknown syntax or apply half an invalid block.
for(const text of ['X30','G01 Z-5','G00 X1 X2','G00 G01 X30','G98 G99','M03 M05','M03','G02 X20','G90 X20','G91 Z1','G20','G96','G00 U2','G00 Y2','T0101','G00 X-1','G00 X61','G00 Z-61','G00 Z11','G01 Z-5 F0','S0','S5001','G00 XInfinity','G00 X1e2','G00 X28,5','G00 X28 junk','G00 X28 (unclosed','G00 X28 )','G00 X28 ((nested))','M30\nG00 X40','M30 X40','G00 X30; G00 Z3','N1.5 G00 X30','O1.5'])bad(text);
r=g.simulate('G00 X36 Z3\nG01 X28 Z-10 F0\nG00 Z5');
assert.equal(r.errors[0].line,2);assert.equal(r.trace.length,1);assert.equal(r.moves.length,1);assert.deepEqual([r.state.x,r.state.z],[36,3]);
assert.ok(g.simulate('x'.repeat(g.MAX_SOURCE+1)).errors.length);
assert.ok(g.simulate(Array(122).fill('(line)').join('\n')).errors.length);
assert.ok(g.simulate(null).errors.length);
assert.equal(good('(G00 X1)\nG00 X36 Z3').moves.length,1,'comments never execute');

// Conservative rapid warning: the return must first leave the original diameter.
assert.equal(g.simulate('G00 Z5',{initial:{x:28,z:-20}}).warnings.length,1);
assert.equal(g.simulate('G00 X34 Z5',{initial:{x:28,z:-20}}).warnings.length,1,'simultaneous axes not assumed straight or safe');
assert.equal(g.simulate('G00 X28',{initial:{x:34,z:0}}).warnings.length,1,'contact with stock face is flagged');
assert.equal(g.simulate('G00 X34\nZ5',{initial:{x:28,z:-20}}).warnings.length,0);
assert.equal(g.simulate('G00 X28 Z2').warnings.length,0,'position in front of the stock');
assert.equal(g.simulate('G01 Z-20 F.1',{initial:{x:28,z:0}}).warnings.length,0,'feed is a distinct movement');

// Every task is solvable, its initial draft is not already the answer.
assert.equal(g.tasks.length,11);
for(const t of g.tasks){
 assert.equal(g.grade(t.id,t.answer).correct,true,t.id+' solution');
 assert.equal(g.grade(t.id,t.starter).correct,false,t.id+' initial draft');
 assert.equal(g.grade(t.id,'').correct,false,t.id+' blank');
 assert.equal(g.simulate(t.demo,{initial:t.initial}).errors.length,0,t.id+' demonstration');
 const equivalent=t.answer.toLowerCase().split('\n').map((line,i)=>`N${i+1} ${line} (note)`).join('\n');
 assert.equal(g.grade(t.id,equivalent).correct,true,t.id+' semantic formatting');
}
assert.equal(g.grade('coordinates','G00 X36 Z2\nG00 Z3').correct,false,'extra reverse/route changes not an endpoint shortcut');
assert.equal(g.grade('motion','G01 Z-8 F.1\nG1 Z-15').correct,true,'collinear work blocks may be split');
assert.equal(g.grade('modal','G01 Z-10 F.1\nG01 X28').correct,true,'explicit repeat accepted');
assert.equal(g.grade('modal','G01 Z-10 F.1\nG00 X28').correct,false);
assert.equal(g.grade('feed','G01 Z-12 F.12').correct,false,'explicit unit selection required');
assert.equal(g.grade('feed','G98\nG01 Z-12 F.12').correct,false);
assert.equal(g.grade('spindle','S600 M03\nM05\nM30').correct,false,'explicit G97 required');
assert.equal(g.grade('spindle','G97 S600 M03\nM30').correct,false,'M30 cannot replace explicit stop required by exercise');
assert.equal(g.grade('spindle','G97 S600 M03\nM05\nS500 M03\nM05\nM30').correct,false,'unexpected extra spindle cycle');
const full=g.tasks.find(t=>t.id==='program').answer;
assert.equal(g.grade('program',full.replace('G01 Z-20 F0.1','G01 Z-8 F.1\nZ-20')).correct,true);
assert.equal(g.grade('program',full.replace('G21 G18 G99\n','')).correct,false,'must explicitly declare full program context');
assert.equal(g.grade('program',full.replace('G97 S600 M03','G97 S600')).correct,false,'working move requires spindle');
assert.equal(g.grade('program',full.replace('G01 Z-20','G00 Z-20')).correct,false);
assert.equal(g.grade('program',full.replace('F0.1','F0.2')).correct,false);
assert.equal(g.grade('program',full.replace('M05\n','')).correct,false);
assert.equal(g.grade('no-task',full).correct,false);

// Restored completion is re-graded from evidence, while incomplete drafts are preserved.
const stored={version:1,selected:'motion',phases:{motion:'practice',nope:'practice'},drafts:{motion:'G00 Z-15 F0.1',nope:'bad'},passed:{motion:{code:'G01 Z-15 F.1',assisted:true},retract:{code:'G00 Z5\nX34'},nope:{code:'bad'}},helped:{motion:true,feed:'true',nope:true}};
const restored=g.restore(stored);assert.equal(restored.selected,'motion');assert.equal(restored.drafts.motion,stored.drafts.motion);assert.deepEqual(Object.keys(restored.passed),['motion']);assert.equal(restored.passed.motion.assisted,true);assert.deepEqual(restored.helped,{motion:true});assert.deepEqual(restored.phases,{motion:'practice'});
assert.deepEqual(g.restore(JSON.parse(JSON.stringify(restored))),restored);
assert.equal(Object.keys(g.restore({version:2,passed:stored.passed}).passed).length,0);
assert.equal(g.restore({version:1,selected:'unknown',drafts:{motion:'x'.repeat(12001)}}).selected,'coordinates');
console.log('G-code checks passed: strict parser, modal state, rapid risks, 11 semantic tasks, alternate solutions, validated recovery.');
assert.match(g.grade('motion','G00 Z-15 F.1').pathHint,/G00.*G01/);
assert.match(g.grade('coordinates','G00 X36 Z2').pathHint,/X36 Z2.*X36 Z3/);
assert.equal(g.grade('coordinates','G0 X38 Z4\nG0 X36 Z3 F.2').correct,true,'F does not change rapid motion or equivalent collinear path');
const noCut=g.grade('program',full.replace('G01 Z-20','G00 Z-20'));
assert.equal(noCut.criteria.find(c=>c.text.startsWith('Есть рабочий')).ok,false,'no vacuous success without a working move');
for(const t of g.tasks)assert.ok(require('../library-model.js').articles.some(a=>a.id===t.reading),t.id+' reference exists');for(const text of ['O1\nO2','G00 X36 Z3\nO1'])bad(text);
assert.equal(g.grade('coordinates','G0\nX36 Z3').correct,true,'motion mode may be declared in a separate block');