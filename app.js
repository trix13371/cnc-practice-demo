(function(){
  'use strict';
  const $=id=>document.getElementById(id), model=window.CNCModel;
  let task=model.tasks[0],checked=false,running=false,animation=null,completed=new Set(),lastResult=null;
  const controls=['x','offset','feed','rpm','tool'];
  const fmt=(v,n=1)=>Number.isFinite(v)?v.toLocaleString('ru-RU',{minimumFractionDigits:n,maximumFractionDigits:n}):'—';
  function values(){const p={tool:$('tool').value}; for(const k of controls.slice(0,4))p[k]=$(k).value.trim()===''?NaN:Number($(k).value);return p;}
  function stop(){if(animation!==null)cancelAnimationFrame(animation);animation=null;running=false;controls.forEach(k=>$(k).disabled=false);$('run').disabled=false;$('check').disabled=false;}
  function progress(p){$('progress-value').innerHTML=Math.round(p)+' <small>%</small>';$('progress-fill').style.width=p+'%';document.querySelector('.progress-track').setAttribute('aria-valuenow',String(Math.round(p)));}
  function geometry(result,p=0){
    const actual=result.valid?Math.max(1,Math.min(60,result.actual)):32;
    const r=actual*1.5,y=160-r,start=630,end=260;
    $('trajectory').setAttribute('d',`M${start} 58V${y}H${end}`);
    let tx=start,ty=58;
    if(p>0){if(p<.18)ty=58+(y-58)*(p/.18);else{ty=y;tx=start+(end-start)*((p-.18)/.82);}}
    $('tool-shape').setAttribute('transform',`translate(${tx} ${ty})`);
    const cutFrom=Math.max(end,Math.min(589,tx));
    $('stock').setAttribute('width',String(p>.18&&actual<32?cutFrom-151:438));
    $('cut-profile').setAttribute('d',p>.18&&actual<32?`M${cutFrom} ${y}H589V${160+r}H${cutFrom}Z`:'');
  }
  function program(p){
    if(!model.evaluate(p).valid){$('gcode').textContent='Введите допустимые числовые настройки.';return;}
    $('gcode').textContent=`; Один учебный проход\n; X — по диаметру, подача — мм/об\nT${p.tool==='turning'?'0101':'0202'}\nG21 G18 G90 G95\nG97 S${p.rpm} M03\nG00 X36 Z5\nG01 X${p.x} F${p.feed}\nG01 Z-45\nG00 X36\nM05\n; Коррекция X: ${p.offset} мм`;
  }
  function renderSettings(){
    const p=values(),r=model.evaluate(p);lastResult=r;
    $('actual').innerHTML=fmt(r.actual)+' <small>мм</small>';
    $('depth').innerHTML=fmt(r.depth)+' <small>мм</small>';
    program(p);geometry(r);progress(0);$('machine-status').textContent='Ожидание';$('machine-status').className='machine-status';
    $('run-note').textContent='Можно запустить с ошибками и увидеть результат.';
    checked=false;$('check-result').className='check-result';$('check-result').textContent='Настройки ещё не проверены';
  }
  function feedback(r,finished=false){
    const box=$('check-result');box.className='check-result '+(r.success?'success':'error');box.replaceChildren();
    const title=document.createElement('div');title.className='result-title';title.textContent=r.success?(finished?'✓ Упражнение выполнено':'✓ Настройки соответствуют заданию'):(r.valid?'Есть ошибки в настройках':'Проверьте значения');box.append(title);
    if(r.success){const p=document.createElement('p');p.textContent=finished?'Получен учебный результат Ø'+fmt(r.actual)+' мм. Можно перейти к следующему упражнению.':'Запустите пробный проход, чтобы завершить упражнение.';box.append(p);}
    for(const issue of r.errors){const block=document.createElement('div');block.className='issue';const b=document.createElement('b');b.textContent=issue.title;const p=document.createElement('p');p.textContent=issue.detail;block.append(b,p);box.append(block);}
  }
  function check(){const r=model.evaluate(values());checked=true;lastResult=r;feedback(r);$('mentor-answer').textContent=model.mentor(values(),'Что исправить?',true);return r;}
  function select(id){stop();task=model.tasks.find(t=>t.id===id)||model.tasks[0];checked=false;for(const k of controls)$(k).value=task.defaults[k];$('goal').textContent=task.goal;$('description').textContent=task.description;document.querySelectorAll('[data-task]').forEach(b=>{const active=b.dataset.task===task.id;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});renderSettings();$('mentor-answer').textContent=task.id==='diameter'?'Проверьте конечный диаметр X. Цель задания — Ø28 мм. Настройте проход и посмотрите, какой диаметр получится.':task.id==='offset'?'Сравните заданный X и коррекцию. В этой модели они складываются: ошибка коррекции изменяет итоговый размер.':'Проверьте подачу по условиям упражнения. Настройка диаметра в этом сценарии уже верная.';}
  function run(){
    if(running)return false;
    const p=values(),r=check();
    if(!r.valid||!r.canAnimate){$('machine-status').textContent='Проход заблокирован';$('machine-status').className='machine-status error';$('run-note').textContent='Исправьте числовые поля, инструмент или пересечение оси.';return false;}
    running=true;controls.forEach(k=>$(k).disabled=true);$('run').disabled=true;$('check').disabled=true;$('machine-status').textContent='Выполняется';$('machine-status').className='machine-status running';
    $('run-note').textContent='Учебная анимация ускорена; это не реальное время обработки.';
    let start=null;const duration=window.matchMedia('(prefers-reduced-motion: reduce)').matches?500:3600;
    function tick(t){if(start===null)start=t;const part=Math.min((t-start)/duration,1);progress(part*100);geometry(r,part);if(part<1){animation=requestAnimationFrame(tick);return;}animation=null;stop();$('machine-status').textContent=r.success?'Готово':'Проход с ошибками';$('machine-status').className='machine-status '+(r.success?'running':'error');feedback(r,true);$('run-note').textContent=r.success?'Целевой диаметр достигнут. Настройки остаются доступными.':'Посмотрите результат проверки и исправьте настройки.';if(r.success){completed.add(task.id);document.querySelector(`[data-task="${task.id}"] .lesson-done`).textContent='✓';}$('mentor-answer').textContent=r.success?'Проход завершён: получен Ø'+fmt(r.actual)+' мм. Перейдите к следующему упражнению или измените настройки, чтобы сравнить результат.':model.mentor(p,'Что исправить?',true);}
    animation=requestAnimationFrame(tick);return true;
  }
  document.querySelectorAll('[data-task]').forEach(b=>b.addEventListener('click',()=>select(b.dataset.task)));
  controls.forEach(k=>$(k).addEventListener('input',()=>{if(!running)renderSettings();}));
  $('settings').addEventListener('submit',e=>{e.preventDefault();check();});$('run').addEventListener('click',run);$('reset').addEventListener('click',()=>select(task.id));
  function ask(q){$('mentor-answer').textContent=model.mentor(values(),q,checked);}
  document.querySelectorAll('[data-question]').forEach(b=>b.addEventListener('click',()=>ask(b.dataset.question)));
  $('mentor-form').addEventListener('submit',e=>{e.preventDefault();const q=$('question').value.trim();if(q){ask(q);$('question').value='';}});
  select(task.id);
  window.CNCDemo={readState:()=>({task:task.id,settings:values(),result:lastResult,running,completed:[...completed]}),selectTask:select,checkSettings:check};
  const context=document.modelContext;if(context?.registerTool){const lifecycle=new AbortController();const specs=[
    {name:'read_cnc_training_state',title:'Прочитать настройки тренажёра',description:'Read the active CNC exercise, parameters, and latest validation result.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute(input){if(!input||Object.keys(input).length)throw new Error('Expected an empty object');return window.CNCDemo.readState();}},
    {name:'configure_cnc_training',title:'Настроить учебный проход',description:'Select one exercise and set the same parameters as the visible form. Does not run the pass.',inputSchema:{type:'object',properties:{task:{type:'string',enum:['diameter','offset','feed']},x:{type:'number',minimum:1,maximum:60},offset:{type:'number',minimum:-10,maximum:10},feed:{type:'number',minimum:.01,maximum:1},rpm:{type:'number',minimum:100,maximum:2000},tool:{type:'string',enum:['turning','drill']}},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Expected settings object');const allowed=['task',...controls];if(Object.keys(input).some(k=>!allowed.includes(k)))throw new Error('Unknown parameter');if(input.task!==undefined&&!model.tasks.some(t=>t.id===input.task))throw new Error('Unknown exercise');if(input.tool!==undefined&&!['turning','drill'].includes(input.tool))throw new Error('Unknown tool');const candidate={...values(),...input};if(!model.evaluate(candidate).valid)throw new Error('Invalid numeric settings');if(running)throw new Error('Wait for the pass to finish');if(input.task)select(input.task);for(const k of controls)if(input[k]!==undefined)$(k).value=input[k];renderSettings();return window.CNCDemo.readState();}},
    {name:'check_cnc_training_settings',title:'Проверить учебный проход',description:'Validate current parameters and show the result and mentor feedback. Does not animate the pass.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||Object.keys(input).length)throw new Error('Expected an empty object');if(running)throw new Error('Wait for the pass to finish');return check();}}
  ];for(const spec of specs){try{Promise.resolve(context.registerTool(spec,{signal:lifecycle.signal})).catch(()=>{});}catch{}}window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});}
})();
