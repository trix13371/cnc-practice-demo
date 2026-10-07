(function(root){
  'use strict';
  const tools={turning:'Проходной резец',boring:'Расточной резец',grooving:'Канавочный резец'};
  const row=(id,title,diameter,length,extra={})=>({id,title,diameter,length,tool:'turning',maxDepth:2,feed:[.1,.25],...extra});
  const tasks=[
    {id:'shoulder',level:'medium',title:'Ступенчатый вал',stock:40,length:60,bore:0,bias:0,rpm:[600,900],
      brief:'Из прутка Ø40 изготовьте вал с двумя ступенями. Распределите припуск на проходы: съём на радиус за один проход не должен превышать 2 мм.',
      operations:[row('a','Ступень A',32,25),row('b','Ступень B',24,35)],order:[],
      hints:['Съём на радиус — половина разницы исходного и конечного диаметров. Каждая ступень обрабатывается из исходного Ø40.','Разделите съём на допустимую глубину 2 мм и округлите число проходов вверх.','Для A нужны минимум 2 прохода, для B — 4. Длины: 25 и 35 мм; инструмент — проходной резец.']},
    {id:'sleeve',level:'medium',title:'Полая втулка',stock:38,length:45,bore:12,bias:0,rpm:[500,800],
      brief:'Заготовка Ø38 с готовым сквозным отверстием Ø12. Сначала расточите отверстие до Ø22, затем обработайте наружный Ø30. Допустимый съём: внутри 1 мм на радиус, снаружи 2 мм. Толщина стенки не менее 4 мм.',minWall:4,
      operations:[row('bore','Сквозное отверстие',22,45,{tool:'boring',maxDepth:1,feed:[.08,.16],kind:'bore'}),row('outer','Наружная поверхность',30,45)],order:[['bore','outer']],
      hints:['Пока стенка толстая, обработайте отверстие. Для него нужен расточной, а не проходной резец.','Внутренний припуск: (22 − 12) / 2. Стенка: (наружный диаметр − внутренний) / 2.','Расточка: 5 проходов, подача 0,08–0,16. Наружная обработка: 2 прохода. Сначала отверстие, затем наружная поверхность.']},
    {id:'taper',level:'hard',title:'Конус и канавка',stock:40,length:65,bore:0,bias:0,rpm:[500,750],
      brief:'Изготовьте посадочный поясок, конический участок и канавку на пояске. Сначала обработайте поясок, затем канавку. Для канавки разрешён съём 1 мм на радиус и подача 0,04–0,08 мм/об. Для остальных поверхностей — 1,5 мм и 0,10–0,25 мм/об.',
      operations:[row('seat','Поясок',32,30,{maxDepth:1.5}),row('cone','Конус',32,35,{endDiameter:20,maxDepth:1.5}),row('groove','Канавка на пояске',26,5,{tool:'grooving',kind:'groove',position:12,parent:'seat',maxDepth:1,feed:[.04,.08]})],order:[['seat','groove']],
      hints:['Конус задаётся двумя диаметрами. Число проходов определяет наибольший припуск — у малого диаметра.','Канавка расположена на пояске: её припуск считайте от Ø32 после обработки пояска.','Поясок: 3 прохода. Конус Ø32 → Ø20: 7. Канавка Ø26 шириной 5 мм: 3; канавочный резец.']},
    {id:'calibration',level:'hard',title:'Вал по контрольным замерам',stock:42,length:75,bore:0,bias:.4,rpm:[600,900],diagnosis:true,
      brief:'На пробной детали при нулевой коррекции получили: программа Ø36 → замер Ø36,4; Ø30 → Ø30,4; Ø24 → Ø24,4. Определите причину, задайте общую коррекцию и составьте обработку новой заготовки. Программные диаметры должны соответствовать чертежу. Максимальный съём — 1,5 мм на радиус.',
      operations:[row('a','Ступень A',36,20,{maxDepth:1.5}),row('b','Ступень B',30,25,{maxDepth:1.5}),row('c','Ступень C',24,30,{maxDepth:1.5})],order:[],
      hints:['Отклонение одинаково на трёх разных диаметрах. Это признак постоянного смещения, а не ошибки отдельного размера.','В этой учебной модели измеренный диаметр = программный X + коррекция + систематическое смещение.','Выберите постоянное смещение X и коррекцию −0,4 мм. Проходы для ступеней: 2, 4 и 6. Диаметры в программе: 36, 30 и 24.']}
  ];
  function defaults(t){return {offset:0,rpm:800,diagnosis:'none',operations:t.operations.map(o=>({id:o.id,diameter:o.diameter+2,endDiameter:o.endDiameter?o.endDiameter+2:null,length:o.length,passes:1,feed:.2,tool:'turning'})).reverse()};}
  function validate(t,p){
    return !!p&&Number.isFinite(p.offset)&&Math.abs(p.offset)<=5&&Number.isFinite(p.rpm)&&p.rpm>=100&&p.rpm<=2000&&['none','offset','feed','program'].includes(p.diagnosis)&&Array.isArray(p.operations)&&p.operations.length===t.operations.length&&new Set(p.operations.map(o=>o?.id)).size===t.operations.length&&p.operations.every(o=>o&&t.operations.some(r=>r.id===o.id)&&['diameter','length','passes','feed'].every(k=>Number.isFinite(o[k]))&&o.diameter>=1&&o.diameter<=60&&o.length>=1&&o.length<=100&&Number.isInteger(o.passes)&&o.passes>=1&&o.passes<=20&&o.feed>=.01&&o.feed<=1&&Object.hasOwn(tools,o.tool)&&(t.operations.find(r=>r.id===o.id).endDiameter?Number.isFinite(o.endDiameter)&&o.endDiameter>=1&&o.endDiameter<=60:o.endDiameter===null));
  }
  function evaluate(t,p){
    if(!validate(t,p))return {valid:false,success:false,errors:['Заполните все поля допустимыми числами. Проходы — целое число от 1 до 20.'],rows:[]};
    const errors=[],rows=[],byId=Object.fromEntries(p.operations.map(o=>[o.id,o])),shift=p.offset+t.bias;
    const near=(a,b)=>Math.abs(a-b)<=.10000001;
    if(p.rpm<t.rpm[0]||p.rpm>t.rpm[1])errors.push(`Обороты: по условию ${t.rpm[0]}–${t.rpm[1]} об/мин.`);
    if(t.diagnosis&&p.diagnosis!=='offset')errors.push('Диагноз не подтверждается замерами: сравните величины отклонений на трёх диаметрах.');
    if(Math.abs(shift)>.000001)errors.push(t.diagnosis?'Общая коррекция не компенсирует постоянное отклонение замеров.':'Калибровка выполнена: общая коррекция должна быть 0 мм.');
    for(const [before,after] of t.order){if(p.operations.findIndex(o=>o.id===before)>p.operations.findIndex(o=>o.id===after))errors.push(`Порядок: «${t.operations.find(o=>o.id===before).title}» должна быть раньше «${t.operations.find(o=>o.id===after).title}».`);}
    for(const spec of t.operations){const o=byId[spec.id],actual=o.diameter+shift,end=spec.endDiameter?o.endDiameter+shift:actual;
      const start=spec.kind==='bore'?t.bore:spec.parent?byId[spec.parent].diameter+shift:t.stock;
      const removal=spec.kind==='bore'?(actual-start)/2:(start-Math.min(actual,end))/2;
      const perPass=removal/o.passes,issues=[];
      if(o.tool!==spec.tool)issues.push(`нужен ${tools[spec.tool].toLowerCase()}`);
      if(!near(actual,spec.diameter)||(spec.endDiameter&&!near(end,spec.endDiameter)))issues.push('итоговые диаметры вне допуска ±0,1 мм');
      if(t.diagnosis&&!near(o.diameter,spec.diameter))issues.push('не подменяйте коррекцию изменением программного размера');
      if(Math.abs(o.length-spec.length)>.10000001)issues.push('длина / ширина вне допуска ±0,1 мм');
      if(removal<0||actual<=0||end<=0)issues.push('траектория не соответствует снятию материала');
      if(perPass>spec.maxDepth+1e-9)issues.push(`съём ${perPass.toFixed(2)} мм на радиус за проход превышает ${spec.maxDepth} мм`);
      if(o.feed<spec.feed[0]||o.feed>spec.feed[1])issues.push(`подача должна быть ${spec.feed[0]}–${spec.feed[1]} мм/об`);
      errors.push(...issues.map(e=>`${spec.title}: ${e}.`));rows.push({id:o.id,actual,end,perPass,success:!issues.length});
    }
    if(t.minWall){const wall=(byId.outer.diameter-byId.bore.diameter)/2;if(wall<t.minWall-1e-9)errors.push(`Стенка ${wall.toFixed(2)} мм: требуется не менее ${t.minWall} мм.`);}
    return {valid:true,success:!errors.length,errors,rows};
  }
  // Geometry is a nominal envelope of the programmed dimensions; process validity is evaluated separately.
  function profile(t,p=null){
    const valid=p&&validate(t,p),shift=valid?p.offset+t.bias:0,rows=t.operations.map(s=>({...s,...(valid?p.operations.find(o=>o.id===s.id):{})}));
    let bore=t.bore;const inner=rows.find(o=>o.kind==='bore');if(inner)bore=valid?Math.max(t.bore,inner.diameter+shift):inner.diameter;
    const segments=[];
    for(const o of rows.filter(o=>!['bore','groove'].includes(o.kind))){const d=valid?Math.min(t.stock,Math.max(.2,o.diameter+shift)):o.diameter,e=o.endDiameter?(valid?Math.min(t.stock,Math.max(.2,o.endDiameter+shift)):o.endDiameter):d;
      const groove=rows.find(g=>g.parent===o.id);
      if(groove){const start=Math.min(groove.position,o.length),width=Math.min(groove.length,Math.max(0,o.length-start)),gd=valid?Math.min(d,Math.max(.2,groove.diameter+shift)):groove.diameter;
        segments.push({length:start,diameter:d},{length:width,diameter:gd},{length:Math.max(0,o.length-start-width),diameter:d});
      }else segments.push({length:o.length,diameter:d,endDiameter:e});
    }
    return {segments:segments.filter(s=>s.length>0),bore:Math.max(0,Math.min(bore,...segments.map(s=>Math.min(s.diameter,s.endDiameter||s.diameter)-.1)))};
  }
  const api={tasks,tools,defaults,validate,evaluate,profile};root.CNCLabModel=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
