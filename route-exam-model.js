(function(root){
  'use strict';
  const lab=root.CNCLabModel||(typeof require==='function'?require('./lab-model.js'):null);
  function taskFor(level,seed,index){if(!['medium','hard'].includes(level)||!Number.isInteger(seed)||seed<0||seed>4294967295||![0,1].includes(index))throw new Error('Неверный вариант');const t=JSON.parse(JSON.stringify(lab.tasks.filter(t=>t.level===level)[index]));
    const shift=2*(1+(seed+index)%3),extra=5*(1+((seed>>>3)+index)%2);t.stock+=shift;t.operations.forEach(o=>{o.diameter+=shift;if(o.endDiameter)o.endDiameter+=shift;if(o.kind!=='groove')o.length+=extra;});if(t.bore)t.bore+=shift;
    t.length=t.operations.filter(o=>!['bore','groove'].includes(o.kind)).reduce((sum,o)=>sum+o.length,0);t.hints=[];
    if(t.diagnosis){t.bias=[-.6,-.2,.2,.6][seed%4];t.brief='Контроль при нулевой коррекции: '+t.operations.map(o=>`X ${o.diameter} → замер ${(o.diameter+t.bias).toFixed(1)} мм`).join('; ')+'. Определите причину и общую коррекцию. Программные диаметры оставьте по чертежу.';}
    else t.brief=t.id==='sleeve'?`Заготовка с отверстием Ø${t.bore}. Сначала расточите отверстие, затем наружную поверхность. Стенка не менее ${t.minWall} мм. Размеры и режимы указаны ниже.`:t.id==='taper'?'Обработайте поясок перед канавкой. Рассчитайте проходы для каждой поверхности; соблюдайте размеры чертежа и ограничения режимов.':'Рассчитайте проходы для двух ступеней из исходного диаметра заготовки. Соблюдайте размеры и ограничения режимов.';
    return t;
  }
  function create(level,seed,at=new Date().toISOString()){taskFor(level,seed,0);return {version:1,level,seed,at,index:0,answers:[],draft:null};}
  function submit(e,plan){if(e.answers.length!==e.index||e.index>1)throw new Error('Ответ уже сдан');const t=taskFor(e.level,e.seed,e.index);if(!lab.validate(t,plan))throw new Error('Заполните все поля допустимыми числами.');return {...e,answers:[...e.answers,JSON.parse(JSON.stringify(plan))],draft:null};}
  function advance(e){if(e.index!==0||e.answers.length!==1)throw new Error('Переход недоступен');return {...e,index:1,draft:null};}
  function gradeTask(t,p){
    if(!lab.validate(t,p))throw new Error('Недопустимый ответ');const r=lab.evaluate(t,p),by=Object.fromEntries(p.operations.map(o=>[o.id,o])),near=(a,b)=>Math.abs(a-b)<=.10000001;
    let geometry=0,geometryMax=0,technology=0,technologyMax=2+(t.diagnosis?1:0),extra=0;
    technology+=p.rpm>=t.rpm[0]&&p.rpm<=t.rpm[1]?1:0;technology+=Math.abs(p.offset+t.bias)<1e-6?1:0;if(t.diagnosis)technology+=p.diagnosis==='offset'?1:0;
    for(const s of t.operations){const o=by[s.id],row=r.rows.find(a=>a.id===s.id);geometryMax+=2+(s.endDiameter?1:0);geometry+=near(row.actual,s.diameter)?1:0;geometry+=near(o.length,s.length)?1:0;if(s.endDiameter)geometry+=near(row.end,s.endDiameter)?1:0;
      technologyMax+=3+(t.diagnosis?1:0);technology+=o.tool===s.tool?1:0;technology+=o.feed>=s.feed[0]&&o.feed<=s.feed[1]?1:0;technology+=row.perPass>=0&&row.perPass<=s.maxDepth+1e-9?1:0;if(t.diagnosis)technology+=near(o.diameter,s.diameter)?1:0;
      const start=s.kind==='bore'?t.bore:s.parent?t.operations.find(a=>a.id===s.parent).diameter:t.stock,minimum=Math.ceil(Math.abs(start-(s.kind==='bore'?s.diameter:Math.min(s.diameter,s.endDiameter||s.diameter)))/(2*s.maxDepth)-1e-9);extra+=Math.max(0,o.passes-minimum);
    }
    if(t.minWall){technologyMax++;technology+=(by.outer.diameter-by.bore.diameter)/2>=t.minWall-1e-9?1:0;}
    const order=t.order.every(([a,b])=>p.operations.findIndex(o=>o.id===a)<p.operations.findIndex(o=>o.id===b));
    const parts={accuracy:Math.round(40*geometry/geometryMax),technology:Math.round(25*technology/technologyMax),order:order?15:0,economy:Math.max(0,20-extra*2)};
    return {...r,parts,extra,score:Object.values(parts).reduce((a,b)=>a+b,0),hints:0};
  }
  function grade(e){if(e.answers.length!==2)throw new Error('Завершите оба задания');const answers=e.answers.map((p,i)=>({task:taskFor(e.level,e.seed,i),plan:p,result:gradeTask(taskFor(e.level,e.seed,i),p)}));return {answers,score:Math.round(answers.reduce((s,a)=>s+a.result.score,0)/2)};}
  function restore(e){try{if(!e||e.version!==1||!Number.isFinite(Date.parse(e.at))||![0,1].includes(e.index)||!Array.isArray(e.answers)||e.answers.length<e.index||e.answers.length>e.index+1)return null;taskFor(e.level,e.seed,0);if(e.answers.some((p,i)=>!lab.validate(taskFor(e.level,e.seed,i),p)))return null;return {...create(e.level,e.seed,e.at),index:e.index,answers:e.answers,draft:e.answers.length===e.index&&lab.validate(taskFor(e.level,e.seed,e.index),e.draft)?e.draft:null};}catch{return null;}}
  const api={taskFor,create,submit,advance,gradeTask,grade,restore};root.CNCRouteExam=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
