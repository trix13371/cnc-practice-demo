(function(root){
  'use strict';
  const basic=root.CNCModel||(typeof require==='function'?require('./model.js'):null),lab=root.CNCLabModel||(typeof require==='function'?require('./lab-model.js'):null),process=root.CNCProcess||(typeof require==='function'?require('./process-model.js'):null),guides=root.CNCTaskGuides||(typeof require==='function'?require('./task-guides.js'):null);
  const tasks=[...basic.tasks.map(t=>({...t,advanced:false,level:'easy'})),...lab.tasks.map(t=>({...t,advanced:true}))];
  const get=id=>tasks.find(t=>t.id===id);
  function target(id){const t=get(id);if(!t)return null;return t.advanced?lab.profile(t):{segments:[{length:15,diameter:t.stock},{length:t.length,diameter:t.target}],bore:0};}
  function stock(id){const t=get(id);return t?{segments:[{length:t.length+(t.advanced?0:15),diameter:t.stock,bore:t.bore||0}],bore:t.bore||0}:null;}
  function surfaces(id){const t=get(id);if(!t)return [];return t.advanced?process.surfaces(t):[{id:'worked',title:'Обработанный участок',diameter:t.target,length:t.length,start:15,kind:'outer'}];}
  function checkpoints(id){const all=surfaces(id);return all.flatMap(s=>{
    if(s.endDiameter&&s.endDiameter!==s.diameter)return [{key:s.id+':start',surface:s.id,title:s.title+' · у начала',fraction:.05,zone:'start',target:s.diameter+(s.endDiameter-s.diameter)*.05},{key:s.id+':end',surface:s.id,title:s.title+' · у конца',fraction:.95,zone:'end',target:s.diameter+(s.endDiameter-s.diameter)*.95}];
    const grooves=all.filter(g=>g.kind==='groove'&&g.parent===s.id),fraction=[.5,.25,.75,.1,.9].find(f=>grooves.every(g=>s.start+s.length*f<g.start||s.start+s.length*f>g.start+g.length))??.5;
    return [{key:s.id+':middle',surface:s.id,title:s.title+(grooves.length?' · вне канавки':''),fraction,zone:'middle',target:s.diameter}];
  });}
  function inZone(m,point,surface){if(point.zone==='start')return m.x<=surface.start+surface.length*.1+1e-8;if(point.zone==='end')return m.x>=surface.start+surface.length*.9-1e-8;return true;}
  function controlRows(id,snapshot={}){
    const t=get(id);if(!t)return [];
    return checkpoints(id).map(point=>{
      const surface=surfaces(id).find(s=>s.id===point.surface);
      if(!t.advanced){const m=snapshot.measurement,observed=snapshot.finished&&m?.surface==='worked'?m:null;return {...point,kind:'outside',observed,done:!!observed&&snapshot.inspection?.passed===true};}
      const logs=Array.isArray(snapshot.logs)?snapshot.logs:[],fresh=logs.filter(m=>m.id===point.surface&&m.stage===snapshot.total&&inZone(m,point,surface)),confirmed=fresh.find(m=>m.correct&&m.verdict==='ok');
      return {...point,kind:surface.kind==='bore'?'inside':'outside',observed:confirmed||fresh[0]||null,done:!!confirmed&&snapshot.finished===true};
    });
  }
  function progress(id,snapshot={}){
    const t=get(id);if(!t)return null;
    const rows=controlRows(id,snapshot),measured=rows.filter(r=>r.done).length,finished=snapshot.finished===true;
    const controlled=finished&&rows.length>0&&measured===rows.length&&snapshot.controlPassed===true;
    const executed=finished||snapshot.total>0&&snapshot.reached===snapshot.total,reviewing=executed&&!finished;
    const setup=snapshot.checked===true||executed&&snapshot.result?.success===true;
    return {rows,measured,required:rows.length,finished,executed,controlled,setup,stages:[setup||snapshot.started===true,setup,executed,controlled],status:reviewing?'Осмотр ранее выполненного прохода':controlled?'Контроль подтверждён':finished?'Проходы закончены · нужен контроль':snapshot.started?'Обработка в процессе':'Подготовка к обработке'};
  }
  function search({query='',level='all',filter='all'}={},completed={}){
    const terms=String(query).toLowerCase().replace(/ё/g,'е').trim().split(/\s+/).filter(Boolean);
    return tasks.filter(t=>{const g=guides.get(t.id),confirmed=completed[t.id]?.controlVersion===1,tags={diameter:'диаметр радиус припуск',offset:'коррекция ошибка смещение',feed:'подача обороты режим'}[t.id]||'';const text=[t.title,t.id,t.brief||t.description,g.learn,g.level,g.before,tags,...surfaces(t.id).map(s=>s.title+' '+(s.kind==='bore'?'расточка отверстие':s.kind==='groove'?'канавка':'точение'))].join(' ').toLowerCase().replace(/ё/g,'е');return(level==='all'||level===t.level)&&(filter!=='pending'||!confirmed)&&(filter!=='passed'||confirmed)&&terms.every(q=>text.includes(q));});
  }
  function recommend(completed={}){return tasks.find(t=>completed[t.id]?.controlVersion!==1)||tasks[0];}
  function restoreStages(value){const result={version:1,stages:{}};if(value?.version!==1)return result;for(const t of tasks){const n=value.stages?.[t.id];if(Number.isInteger(n)&&n>=0&&n<=3)result.stages[t.id]=n;}return result;}
  function sample(profile,x){if(!profile?.segments?.length)return null;let start=0;for(const [i,s] of profile.segments.entries()){if(x<=start+s.length+1e-8||i===profile.segments.length-1){const f=Math.max(0,Math.min(1,(x-start)/s.length));return {diameter:s.diameter+((s.endDiameter??s.diameter)-s.diameter)*f,bore:s.bore??profile.bore??0};}start+=s.length;}return null;}
  const api={tasks,get,target,stock,surfaces,checkpoints,controlRows,progress,search,recommend,restoreStages,sample};root.CNCMachine=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
