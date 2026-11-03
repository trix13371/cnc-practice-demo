(function(){
  'use strict';
  class PartViewer {
    constructor(host){
      this.host=host;this.yaw=-.65;this.pitch=.35;this.zoom=1;this.section=false;this.profile={segments:[{length:45,diameter:28}],bore:0};
      host.innerHTML='<div class="viewer-toolbar"><span class="viewer-caption">Целевая деталь</span><label class="viewer-preset-label">Ракурс<select aria-label="Ракурс 3D"><option value="iso">Объём</option><option value="front">Сбоку</option><option value="end">С торца</option><option value="section">Продольный разрез</option><option value="custom" disabled>Свободный ракурс</option></select></label></div><canvas tabindex="0" role="img" aria-label="Трёхмерная модель детали. Вращение: перетаскивание или стрелки. Масштаб: колесо или плюс и минус."></canvas><div class="viewer-bottom"><span>Тяните для вращения · Home — исходный вид</span><label class="viewer-zoom-label">Масштаб<input aria-label="Масштаб 3D" type="range" min="55" max="250" step="1" value="100"></label></div>';
      this.canvas=host.querySelector('canvas');this.ctx=this.canvas.getContext('2d');this.preset=host.querySelector('select');this.zoomControl=host.querySelector('input');
      this.preset.addEventListener('change',()=>{const v=this.preset.value;this.section=v==='section';this.yaw=v==='end'?-Math.PI/2:v==='front'||v==='section'?0:-.65;this.pitch=v==='front'||v==='end'||v==='section'?0:.35;this.draw();});
      this.zoomControl.addEventListener('input',()=>{this.zoom=Number(this.zoomControl.value)/100;this.draw();});
      let pointer=null;
      this.canvas.addEventListener('pointerdown',e=>{pointer={id:e.pointerId,x:e.clientX,y:e.clientY};this.canvas.setPointerCapture(e.pointerId);});
      this.canvas.addEventListener('pointermove',e=>{if(!pointer||pointer.id!==e.pointerId)return;this.preset.value='custom';this.yaw+=(e.clientX-pointer.x)*.009;this.pitch=Math.max(-1.5,Math.min(1.5,this.pitch+(e.clientY-pointer.y)*.009));pointer={id:e.pointerId,x:e.clientX,y:e.clientY};this.draw();});
      for(const name of ['pointerup','pointercancel','lostpointercapture'])this.canvas.addEventListener(name,()=>{pointer=null;});
      this.canvas.addEventListener('wheel',e=>{e.preventDefault();this.zoom=Math.max(.55,Math.min(2.5,this.zoom*Math.exp(-e.deltaY*.001)));this.draw();},{passive:false});
      this.canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(e.key))return;e.preventDefault();if(e.key.startsWith('Arrow'))this.preset.value='custom';if(e.key==='ArrowLeft')this.yaw-=.15;if(e.key==='ArrowRight')this.yaw+=.15;if(e.key==='ArrowUp')this.pitch-=.15;if(e.key==='ArrowDown')this.pitch+=.15;if(['+','='].includes(e.key))this.zoom=Math.min(2.5,this.zoom*1.15);if(e.key==='-')this.zoom=Math.max(.55,this.zoom/1.15);if(e.key==='Home'){this.yaw=-.65;this.pitch=.35;this.zoom=1;this.section=false;this.preset.value='iso';}this.draw();});
      this.observer=new ResizeObserver(()=>this.draw());this.observer.observe(host);this.draw();
    }
    set(profile,caption='Целевая деталь'){this.profile=profile;this.host.querySelector('.viewer-caption').textContent=caption;this.canvas.setAttribute('aria-label',`${caption}. Длина ${profile.segments.reduce((s,p)=>s+p.length,0)} мм; диаметры ${profile.segments.map(s=>s.diameter+(s.endDiameter&&s.endDiameter!==s.diameter?'–'+s.endDiameter:'')).join(', ')} мм; отверстие ${profile.bore||0} мм. Вращение стрелками, масштаб плюс и минус.`);this.draw();}
    draw(){
      this.zoomControl.value=String(Math.round(this.zoom*100));const c=this.canvas,ctx=this.ctx,w=c.clientWidth,h=c.clientHeight;if(!w||!h||!ctx)return;
      const dpr=Math.min(window.devicePixelRatio||1,2);c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);ctx.scale(dpr,dpr);
      ctx.fillStyle='#f8fafc';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#e0e7ef';ctx.lineWidth=.5;
      for(let x=0;x<w;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}for(let y=0;y<h;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
      const segments=this.profile.segments,total=segments.reduce((s,p)=>s+p.length,0),bore=(this.profile.bore||0)/2,maxD=Math.max(...segments.map(s=>Math.max(s.diameter,s.endDiameter||s.diameter)),1),size=Math.max(total,maxD),scale=Math.min(w/(size*1.55),h/(size*.95))*this.zoom;
      const cy=Math.cos(this.yaw),sy=Math.sin(this.yaw),cp=Math.cos(this.pitch),sp=Math.sin(this.pitch);
      const rotate=([x,y,z])=>{const a=x*cy+z*sy,b=-x*sy+z*cy;return [a,y*cp-b*sp,y*sp+b*cp];};
      const project=p=>{const k=size*4/(size*4-p[2]);return [w/2+p[0]*scale*k,h/2-p[1]*scale*k];};
      const ring=(x,r,a)=>[x-total/2,r*Math.cos(a),r*Math.sin(a)];
      const faces=[],N=64,start=this.section?N/2:0;
      const add=(points,cut=false)=>{const p=points.map(rotate);faces.push({p,z:p.reduce((s,v)=>s+v[2],0)/p.length,cut});};
      const cap=(x,outer,inner)=>{if(Math.abs(outer-inner)<.00001)return;for(let i=start;i<N;i++){const a=i/N*2*Math.PI,b=(i+1)/N*2*Math.PI;add([ring(x,outer,a),ring(x,outer,b),ring(x,inner,b),ring(x,inner,a)]);}};
      let x=0,prior=segments[0].diameter/2,priorBore=(segments[0].bore??this.profile.bore??0)/2;cap(0,prior,priorBore);
      for(const s of segments){const bore=(s.bore??this.profile.bore??0)/2;cap(x,Math.max(bore,priorBore),Math.min(bore,priorBore));const r=s.diameter/2,r2=(s.endDiameter||s.diameter)/2;cap(x,Math.max(r,prior),Math.min(r,prior));
        for(let i=start;i<N;i++){const a=i/N*2*Math.PI,b=(i+1)/N*2*Math.PI;add([ring(x,r,a),ring(x+s.length,r2,a),ring(x+s.length,r2,b),ring(x,r,b)]);if(bore)add([ring(x,bore,b),ring(x+s.length,bore,b),ring(x+s.length,bore,a),ring(x,bore,a)]);}
        if(this.section)for(const a of [0,Math.PI])add([ring(x,r,a),ring(x+s.length,r2,a),ring(x+s.length,bore,a),ring(x,bore,a)],true);
        x+=s.length;prior=r2;priorBore=bore;
      }cap(x,prior,priorBore);
      faces.sort((a,b)=>a.z-b.z);
      for(const f of faces){const [a,b,c0]=f.p,u=b.map((v,i)=>v-a[i]),v=c0.map((n,i)=>n-a[i]);const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],len=Math.hypot(...n)||1,light=.3+.7*Math.abs((n[0]*-.2+n[1]*.65+n[2]*.73)/len);ctx.fillStyle=f.cut?'#a9c2e8':`rgb(${Math.round(106+90*light)},${Math.round(130+85*light)},${Math.round(142+85*light)})`;ctx.beginPath();f.p.forEach((p,i)=>{const q=project(p);if(i)ctx.lineTo(...q);else ctx.moveTo(...q);});ctx.closePath();ctx.fill();ctx.strokeStyle=f.cut?'#7096ca':'rgba(55,80,108,.18)';ctx.lineWidth=.5;ctx.stroke();}
      if(this.measurement){const m=this.measurement,r=m.actual/2,pts=[ring(m.x,r,0),ring(m.x,r,Math.PI)].map(v=>project(rotate(v)));ctx.strokeStyle='#255beb';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(...pts[0]);ctx.lineTo(...pts[1]);for(const q of pts){ctx.moveTo(q[0]-8,q[1]);ctx.lineTo(q[0]+8,q[1]);}ctx.stroke();ctx.fillStyle='#255beb';ctx.font='bold 14px Segoe UI';ctx.fillText('Место замера',16,24);}
      ctx.fillStyle='#5b7289';ctx.font='13px Segoe UI, sans-serif';ctx.fillText(`L ${Number(total.toFixed(1))} мм${bore?' · отверстие Ø'+Number((bore*2).toFixed(1)):''}`,16,h-17);
    }
  }
  window.PartViewer=PartViewer;
})();
