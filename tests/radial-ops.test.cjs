'use strict';
const assert=require('node:assert/strict'),g=require('../radial-ops-model.js'),shapes=require('../stock-shape-model.js'),m=require('../real-machine-model.js'),s=require('../sandbox-model.js'),p=require('../progress-model.js');
const near=(a,b,e=1e-7)=>assert(Math.abs(a-b)<e,`${a} != ${b}`),cyl=shapes.profile({diameter:32,length:60});
let part=g.face(cyl,60,-1,16);near(part.removed,Math.PI/4*(32**2-16**2));assert.deepEqual(cyl,shapes.profile({diameter:32,length:60}));near(g.front(part.profile),0);part=g.face(part.profile,60,-1,0);near(g.front(part.profile),-1);near(part.profile.segments.reduce((a,b)=>a+b.length,0),59);near(g.volume(cyl)-g.volume(part.profile),Math.PI/4*32**2);
assert.throws(()=>g.face(cyl,60,-1.001,0));assert.throws(()=>g.face(cyl,60,-59.5,0));assert.throws(()=>g.face(cyl,60,-1,NaN));
let groove=g.groove(cyl,60,-10,2,28);near(groove.removed,Math.PI/4*(32**2-28**2)*2);assert.deepEqual(groove.profile.segments.map(x=>[x.length,x.diameter]),[[48,32],[2,28],[10,32]]);assert.throws(()=>g.groove(cyl,60,-10,2,27.9));groove=g.groove(groove.profile,60,-10,2,24);near(groove.depth,2);assert.throws(()=>g.groove(cyl,60,-.05,2,28));assert.throws(()=>g.groove(cyl,60,-58,2,28));
const tube=shapes.profile({diameter:32,length:60,shape:'tube',bore:16});let ft=g.face(tube,60,-1,16);near(ft.removed,Math.PI/4*(32**2-16**2));near(g.front(ft.profile),-1);assert.equal(ft.profile.bore,16);assert.throws(()=>g.groove(tube,60,-10,2,17));
function act(w,e){const r=m.execute(w,e);assert(r.ok,r.message);return r.work;}
function ready(tool=3,stock){let w=m.newWork('Радиальная обработка',stock);for(const e of [{type:'reference'},{type:'clamp',value:true},{type:'tool',tool},{type:'preset'},{type:'workOffset',z:100},{type:'door',value:true},{type:'mode',value:'MDI'},{type:'mdi',source:'G97S800M3'}])w=act(w,e);return w;}
let w=ready();w=act(w,{type:'mdi',source:'G0X34Z-1'});w=act(w,{type:'mdi',source:'G1X0F.1'});let st=m.restoreWork(w).state;near(g.front(st.profile),-1);near(st.cuts[0].volume,Math.PI/4*32**2);near(st.position.z,-1);near(st.workOffset.z,100);near(st.position.x,0);w=act(w,{type:'mdi',source:'G0Z2'});w=act(w,{type:'mdi',source:'G0X40Z5'});w=act(w,{type:'mdi',source:'M5'});w=act(w,{type:'door',value:false});assert.equal(m.execute(w,{type:'measure',z:-.5,instrument:'caliper'}).ok,false);w=act(w,{type:'measure',z:-10,instrument:'caliper'});near(m.restoreWork(w).state.readings.at(-1).reading,32);
let gw=ready(4);gw=act(gw,{type:'mdi',source:'G0X34Z-10'});gw=act(gw,{type:'mdi',source:'G1X28F.08'});let gs=m.restoreWork(gw).state;near(gs.cuts[0].volume,Math.PI/4*(32**2-28**2)*2);const bad=m.execute(gw,{type:'mdi',source:'G0Z-9'});assert.equal(bad.ok,false);assert.equal(bad.state.alarm.code,'BLADE_COLLISION');assert.deepEqual(bad.state.profile,gs.profile);gw=act(gw,{type:'mdi',source:'G0X34'});gw=act(gw,{type:'mdi',source:'G0X40Z5'});gw=act(gw,{type:'mdi',source:'M5'});gw=act(gw,{type:'door',value:false});gw=act(gw,{type:'measure',z:-11,instrument:'micrometer'});near(m.restoreWork(gw).state.readings.at(-1).reading,28);
// The blade's rear edge reaches the chuck before its reference point.
const rear=m.execute(ready(4),{type:'mdi',source:'G0X34Z-58'});assert.equal(rear.ok,false);assert.equal(rear.state.alarm.code,'CHUCK');
// A front reference edge in air does not make the whole 2 mm blade clear.
for(const z of [.1,1,1.9]){
  let edge=act(ready(4),{type:'mdi',source:`G0X34Z${z}`});
  const before=m.restoreWork(edge).state;
  const blocked=m.execute(edge,{type:'mdi',source:'G1X28F.08'});
  assert.equal(blocked.ok,false);assert.equal(blocked.state.alarm.code,'BLADE_COLLISION');
  assert.deepEqual(blocked.state.profile,before.profile);assert.deepEqual(blocked.state.position,before.position);
}
let clear=act(ready(4),{type:'mdi',source:'G0X34Z2.1'});
clear=act(clear,{type:'mdi',source:'G1X28F.08'});
near(m.restoreWork(clear).state.position.x,28);
assert.deepEqual(m.restoreWork(clear).state.profile,cyl);
// Ordinary longitudinal tools still cannot perform radial facing.
let old=ready(1);old=act(old,{type:'mdi',source:'G0X34Z-1'});assert.equal(m.execute(old,{type:'mdi',source:'G1X0F.1'}).ok,false);
// Facing a tube through its bore does not become longitudinal thinning or boring.
let tw=ready(3,{diameter:32,length:60,grip:15,shape:'tube',bore:16});tw=act(tw,{type:'mdi',source:'G0X34Z-1'});tw=act(tw,{type:'mdi',source:'G1X0F.1'});near(m.restoreWork(tw).state.profile.bore,16);near(g.front(m.restoreWork(tw).state.profile),-1);
let deeper=ready(3);deeper=act(deeper,{type:'mdi',source:'G0X34Z-2'});const denied=m.execute(deeper,{type:'mdi',source:'G1X0F.1'});assert.equal(denied.ok,false);assert.deepEqual(denied.state.profile,m.restoreWork(deeper).state.profile);
let longitudinal=w;for(const e of [{type:'tool',tool:1},{type:'preset'},{type:'door',value:true},{type:'mdi',source:'G97S800M3'},{type:'mdi',source:'G0X30Z2'},{type:'mdi',source:'G1Z-20F.15'}])longitudinal=act(longitudinal,e);const ls=m.restoreWork(longitudinal).state;near(ls.profile.frontZ,-1);near(ls.profile.segments.reduce((n,s)=>n+s.length,0),59);near(ls.cuts.at(-1).volume,Math.PI/4*(32**2-30**2)*19);
// AUTO accepts the new tool calls and preserves cropped geometry during graphics preview.
let auto=ready(3);const preview=m.graphics(auto,'T0303\nG0X34Z-1\nG1X0F.1\nM30');assert(preview.ok,preview.message);near(preview.profile.frontZ,-1);assert.equal(m.restoreWork(auto).state.profile.frontZ,undefined);
for(const saved of [w,gw,tw]){const b=s.createMachineBook();b.works[0]={id:'work-1',...saved};assert.deepEqual(s.parseBook(s.exportBook(b)),b);const archive=p.empty();archive.sections.sandbox.current=b;assert.deepEqual(p.fromRaw(p.toRaw(archive,{})).sections.sandbox.current,b);assert.equal(p.summary(archive).progress.done,0);assert.deepEqual(s.stateOf(s.restartWork(b)).profile,shapes.profile(saved.stock));}
console.log('Facing/grooves: partial/full sweep, physical front/length, annular volume, fixed G54, blade width/shoulders/chuck, feed/depth guards, old tools, metrology, atomic failures, replay/import/cloud and reset passed.');
