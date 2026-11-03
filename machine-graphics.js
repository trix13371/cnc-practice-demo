(function(root){
  'use strict';
  const model=root.CNCMachine||(typeof require==='function'?require('./machine-model.js'):null);
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=n=>Number(n.toFixed(2)).toLocaleString('ru-RU');
  function svg(id,{profile=null,compare=false,selected=null,thumbnail=false,marker=null}={}){
    const t=model.get(id);if(!t)return '';const goal=model.target(id),length=t.length+(t.advanced?0:15),sx=640/length,cy=145,sy=3.1,x=n=>40+n*sx,y=d=>cy-d*sy/2;
    function contour(p,inner=false){let z=0;const top=[];for(const s of p.segments){const a=inner?(s.bore??p.bore??0):s.diameter,b=inner?a:(s.endDiameter??s.diameter);top.push([x(z),y(a)],[x(z+s.length),y(b)]);z+=s.length;}return 'M'+top.map(p=>p.join(',')).join('L')+'L'+top.slice().reverse().map(p=>p[0]+','+(2*cy-p[1])).join('L')+'Z';}
    function shape(p,fill,stroke,dash=''){return `<path d="${contour(p)}" fill="${fill}" stroke="${stroke}" stroke-width="2" ${dash}/>${p.segments.some(s=>(s.bore??p.bore??0)>0)?`<path d="${contour(p,true)}" fill="${fill==='none'?'none':'#ffffff'}" stroke="${stroke}" stroke-width="1.4" ${dash}/>`:''}`;}
    let result=`<svg viewBox="0 0 720 290" role="img" aria-label="${escape(t.title)}: ${compare?'сравнение цели с текущей заготовкой':'целевая деталь с размерами'}. Исходный диаметр ${t.stock} миллиметров."><path d="M24 ${cy}H696" stroke="#7f94a9" stroke-dasharray="5 5" opacity=".6"/><rect x="40" y="${y(t.stock)}" width="640" height="${t.stock*sy}" rx="2" fill="none" stroke="#9aabb9" stroke-dasharray="4 6" opacity=".45"/>`;
    if(compare&&profile){result+=shape(profile,'#8fb6ec30','#6893c9');result+=shape(goal,'none','#255beb','stroke-dasharray="7 5"');}
    else result+=shape(goal,'#d6e0e8','#8ca2b8');
    const surface=model.surfaces(id).find(s=>s.id===selected)||model.surfaces(id)[0];
    if(surface&&!thumbnail){const start=surface.start,end=start+surface.length,at=x((start+end)/2),d=surface.diameter,ed=surface.endDiameter??d;
      result+=`<path d="M${x(start)} ${y(d)}L${x(end)} ${y(ed)}" stroke="#255beb" stroke-width="4"/><path d="M${x(start)} 250H${x(end)}M${x(start)} 242V258M${x(end)} 242V258" stroke="#255beb" stroke-width="1.5"/><text x="${at}" y="276" text-anchor="middle" fill="#255beb" font-size="15">${surface.kind==='groove'?'Ширина':'Длина'} ${num(surface.length)} мм</text><text x="40" y="30" fill="#334e69" font-size="15">${escape(surface.title)} · ${surface.kind==='bore'?'отверстие ':''}Ø${num(d)}${ed!==d?' → Ø'+num(ed):''} мм</text><text x="680" y="53" text-anchor="end" fill="#647b91" font-size="12">Допуск ±0,1 мм</text>`;
      if(surface.kind==='bore')result+=`<path d="M${x(start)} ${y(d)}H${x(end)}M${x(start)} ${2*cy-y(d)}H${x(end)}" stroke="#255beb" stroke-width="3"/>`;
    }
    if(marker&&Number.isFinite(marker.x)&&Number.isFinite(marker.diameter))result+=`<circle cx="${x(marker.x)}" cy="${y(marker.diameter)}" r="6" fill="#fff" stroke="#255beb" stroke-width="2"/><circle cx="${x(marker.x)}" cy="${y(marker.diameter)}" r="11" fill="none" stroke="#fff" stroke-dasharray="3 3"><title>Место последнего замера</title></circle>`;
    return result+'</svg>';
  }
  const api={svg};root.CNCMachineGraphics=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
