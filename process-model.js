(function(root){
  'use strict';
  const lab=root.CNCLabModel||(typeof require==='function'?require('./lab-model.js'):null);
  const lerp=(a,b,t)=>a+(b-a)*t;
  function surfaces(task){let z=0;const list=[];for(const o of task.operations.filter(o=>!['bore','groove'].includes(o.kind))){list.push({...o,start:z});z+=o.length;}for(const o of task.operations.filter(o=>['bore','groove'].includes(o.kind)))list.push({...o,start:o.kind==='bore'?0:(list.find(s=>s.id===o.parent)?.start||0)+o.position});return list;}
  function stock(t){return {segments:[{length:t.length,diameter:t.stock,endDiameter:t.stock,bore:t.bore}],bore:t.bore};}
  function timeline(t,p){if(!lab.validate(t,p))throw new Error('Заполните допустимыми числами все поля маршрута.');const result=[];for(const o of p.operations){const spec=t.operations.find(s=>s.id===o.id);if(o.tool!==spec.tool)throw new Error(`${spec.title}: неверный инструмент. Исправьте его перед запуском.`);for(let n=1;n<=o.passes;n++)result.push({id:o.id,pass:n,total:o.passes,title:spec.title,tool:o.tool});}return result;}
  function cut(t,p,state,step){
    const spec=surfaces(t).find(o=>o.id===step.id),op=p.operations.find(o=>o.id===step.id),shift=p.offset+t.bias;
    const start=spec.start,end=start+op.length;
    if(end>t.length+1e-6)throw new Error(`${spec.title}: участок выходит за длину заготовки.`);
    const base=spec.kind==='bore'?t.bore:spec.parent?p.operations.find(o=>o.id===spec.parent).diameter+shift:t.stock;
    const ratio=step.pass/step.total,d=lerp(base,op.diameter+shift,ratio),de=lerp(base,(op.endDiameter||op.diameter)+shift,ratio);
    if(Math.min(d,de)<=0)throw new Error('Траектория пересекает ось. Исправьте диаметры или коррекцию.');
    const desired=x=>lerp(d,de,(x-start)/op.length),out=[];let x=0;
    for(const s of state.segments){const x0=x,x1=x+s.length;x=x1;const outer=q=>lerp(s.diameter,s.endDiameter||s.diameter,(q-x0)/s.length);const breaks=[x0,x1];for(const b of [start,end])if(b>x0+1e-8&&b<x1-1e-8)breaks.push(b);
      const lo=Math.max(start,x0),hi=Math.min(end,x1);if(hi>lo&&spec.kind!=='bore'){const va=outer(lo)-desired(lo),vb=outer(hi)-desired(hi);if(va*vb<0)breaks.push(lo+(hi-lo)*va/(va-vb));}
      breaks.sort((a,b)=>a-b);
      for(let i=0;i<breaks.length-1;i++){const a=breaks[i],b=breaks[i+1];if(b-a<1e-8)continue;const inCut=a>=start-1e-8&&b<=end+1e-8;let da=outer(a),db=outer(b),bore=s.bore??state.bore;
        if(inCut){if(spec.kind==='bore')bore=Math.max(bore,d);else{da=Math.min(da,desired(a));db=Math.min(db,desired(b));}}
        if(bore>=Math.min(da,db)-1e-8)throw new Error('Обработка уничтожает стенку детали. Проверьте внутренний и наружный диаметры.');
        out.push({length:b-a,diameter:da,endDiameter:db,bore});
      }
    }
    return {segments:out,bore:out[0]?.bore||0};
  }
  function stateAt(t,p,count){const steps=timeline(t,p);if(!Number.isInteger(count)||count<0||count>steps.length)throw new Error('Недопустимый номер прохода');let state=stock(t);for(const step of steps.slice(0,count))state=cut(t,p,state,step);return state;}
  function measure(t,state,id,fraction,instrument){const s=surfaces(t).find(o=>o.id===id);if(!s||!Number.isFinite(fraction)||fraction<0||fraction>1||!['caliper','micrometer'].includes(instrument))throw new Error('Выберите поверхность, положение и инструмент.');if(s.kind==='bore'&&instrument==='micrometer')throw new Error('Наружный микрометр не измеряет отверстия. Выберите штангенциркуль.');
    const x=s.start+s.length*Math.max(.001,Math.min(.999,fraction));let z=0,seg=state.segments.at(-1),local=1;for(const a of state.segments){if(x<z+a.length+1e-8){seg=a;local=(x-z)/a.length;break;}z+=a.length;}
    const groove=surfaces(t).find(g=>g.kind==='groove'&&g.parent===s.id&&x>=g.start&&x<=g.start+g.length);
    const actual=s.kind==='bore'?(seg.bore??state.bore):lerp(seg.diameter,seg.endDiameter||seg.diameter,local),target=groove?groove.diameter:lerp(s.diameter,s.endDiameter||s.diameter,Math.max(.001,Math.min(.999,fraction))),resolution=instrument==='micrometer'?.01:.1,reading=Math.round(actual/resolution)*resolution;
    return {id,title:groove?groove.title:s.title,x,actual,reading:+reading.toFixed(2),target:+target.toFixed(3),instrument,resolution,kind:s.kind==='bore'?'inside':'outside',verdict:actual<target-.10000001?'small':actual>target+.10000001?'large':'ok'};
  }
  const api={surfaces,stock,timeline,cut,stateAt,measure};root.CNCProcess=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
