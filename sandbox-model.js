(function(root){
  'use strict';
  const real=typeof module!=='undefined'&&module.exports?require('./real-machine-model.js'):root.CNCRealMachine;
  const stockShapes=typeof module!=='undefined'&&module.exports?require('./stock-shape-model.js'):root.CNCStockShape;
  const EPS=1e-8,MAX_EVENTS=160,MAX_WORKS=5,MAX_SEGMENTS=256,MAX_FILE_BYTES=512*1024;
  const limits=Object.freeze({diameter:Object.freeze([5,80]),length:Object.freeze([10,150]),x:Object.freeze([1,80]),feed:Object.freeze([.05,.3]),rpm:Object.freeze([200,1200]),maxDepth:2});
  const clone=v=>JSON.parse(JSON.stringify(v)),round=v=>+v.toFixed(3),object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),finite=v=>typeof v==='number'&&Number.isFinite(v),between=(v,r)=>finite(v)&&v>=r[0]&&v<=r[1];
  const hidden=/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/;
  function demand(ok,message='Работа песочницы повреждена.'){if(!ok)throw Error(message);}
  function keys(v,allowed,required=allowed){return object(v)&&Object.keys(v).every(k=>allowed.includes(k))&&required.every(k=>Object.hasOwn(v,k));}
  function name(value){demand(typeof value==='string'&&value.trim().length>0&&value.trim().length<=60&&!hidden.test(value),'Название: от 1 до 60 видимых символов без управляющих знаков.');return value.trim();}
  function stock(value){demand(keys(value,['diameter','length','shape','stepDiameter','stepLength','bore'],['diameter','length'])&&between(value.diameter,limits.diameter)&&between(value.length,limits.length),'Заготовка: Ø5–80 мм, длина 10–150 мм.');const cfg={diameter:round(value.diameter),length:round(value.length)},shape=stockShapes.normalizeShape(value,cfg.diameter,cfg.length);demand(shape,'Труба: отверстие от 1 мм, стенка минимум 1 мм. Ступень: диаметр от 5 мм и меньше основного; длина от 1 мм и меньше общей минимум на 1 мм.');return {...cfg,...shape};}
  function create(config={diameter:32,length:60}){const cfg=stock(config);return {stock:cfg,spindle:false,profile:stockShapes.profile(cfg),cuts:[],readings:[],journal:[]};}
  function normalize(action){
    demand(object(action),'Выберите действие.');
    if(action.type==='spindle'){demand(keys(action,['type','value'])&&typeof action.value==='boolean');return {type:'spindle',value:action.value};}
    if(action.type==='cut'){demand(keys(action,['type','start','end','x','feed','rpm'])&&[action.start,action.end].every(finite)&&between(action.x,limits.x)&&between(action.feed,limits.feed)&&between(action.rpm,limits.rpm),'Проход: X 1–80 мм, подача 0,05–0,30 мм/об, обороты 200–1200 об/мин.');return {type:'cut',start:round(action.start),end:round(action.end),x:round(action.x),feed:round(action.feed),rpm:round(action.rpm)};}
    if(action.type==='measure'){demand(keys(action,['type','z','instrument'])&&finite(action.z)&&['caliper','micrometer','inside-caliper','bore-gauge'].includes(action.instrument));return {type:'measure',z:round(action.z),instrument:action.instrument};}
    throw Error('Действие не поддерживается в свободной мастерской.');
  }
  function sample(profile,u){let start=0;for(const seg of profile.segments){if(u<=start+seg.length+EPS){const ratio=Math.max(0,Math.min(1,(u-start)/seg.length));return seg.diameter+((seg.endDiameter??seg.diameter)-seg.diameter)*ratio;}start+=seg.length;}const last=profile.segments.at(-1);return last.endDiameter??last.diameter;}
  function shoulder(profile,u){let start=0;for(let i=0;i<profile.segments.length-1;i++){start+=profile.segments[i].length;if(Math.abs(start-u)<.00001&&Math.abs(profile.segments[i].diameter-profile.segments[i+1].diameter)>EPS)return true;}return false;}
  function remove(profile,from,to,x){const out=[];let start=0,volume=0,maxDepth=0,alreadySmaller=false;function append(length,diameter){if(length<EPS)return;const last=out.at(-1);if(last&&Math.abs(last.diameter-diameter)<EPS)last.length=round(last.length+length);else out.push({length:round(length),diameter,endDiameter:diameter,bore:profile.bore||0});}
    for(const seg of profile.segments){const end=round(start+seg.length),a=Math.max(start,from),b=Math.min(end,to);if(b-a>EPS){append(a-start,seg.diameter);const d=Math.min(seg.diameter,x);if(seg.diameter<x-EPS)alreadySmaller=true;append(b-a,d);append(end-b,seg.diameter);volume+=Math.PI/4*(seg.diameter**2-d**2)*(b-a);maxDepth=Math.max(maxDepth,(seg.diameter-d)/2);}else append(seg.length,seg.diameter);start=end;}
    return {profile:{segments:out,bore:profile.bore||0},volume,maxDepth,alreadySmaller};
  }
  function transition(state,input){const action=normalize(input),s=clone(state);let ok=true,message='',data=null;
    const reject=text=>{ok=false;message=text;};
    if(action.type==='spindle'){s.spindle=action.value;message=action.value?'Вращение включено. Выберите участок и диаметр прохода.':'Вращение остановлено. Можно измерить деталь.';}
    if(action.type==='cut'){
      if(!s.spindle)reject('Сначала включите вращение. Учебная наладка уже подготовлена.');
      else if(Math.min(action.start,action.end)<-s.stock.length-EPS||Math.max(action.start,action.end)>EPS)reject(`Участок должен находиться между Z−${s.stock.length} и Z0.`);
      else if(Math.abs(action.start-action.end)<.1-EPS)reject('Задайте участок длиной не меньше 0,1 мм.');
      else{const from=s.stock.length+Math.min(action.start,action.end),to=s.stock.length+Math.max(action.start,action.end),r=remove(s.profile,from,to,action.x);
        if(s.profile.bore&&action.x<s.profile.bore+2-EPS)reject('Стенка стала бы тоньше 1 мм на сторону. Увеличьте наружный X. Внутреннее отверстие здесь не обрабатывается.');
        else if(r.maxDepth>limits.maxDepth+EPS)reject(`За проход разрешено до ${limits.maxDepth} мм на радиус. Здесь ${round(r.maxDepth)} мм: сначала задайте больший X или разделите съём на проходы.`);
        else if(r.volume<EPS)reject('Материал не снимается: X находится на текущей поверхности или снаружи. Увеличением X снятый материал не вернуть.');
        else if(r.profile.segments.length>MAX_SEGMENTS)reject('Профиль слишком сложный. Продолжите обработку существующих участков или создайте новую работу.');
        else{s.profile=r.profile;data={...action,index:s.cuts.length+1,maxDepth:round(r.maxDepth),volume:r.volume,seconds:60*Math.abs(action.end-action.start)/(action.feed*action.rpm)};s.cuts.push(data);message=`Проход выполнен на участке Z${action.start}…Z${action.end}, команда X${action.x} по диаметру. ${r.alreadySmaller?'На части участка диаметр уже меньше заданного X: там материал не снимался и размер не увеличился. ':''}Остановите вращение для измерения.`;}
      }
    }
    if(action.type==='measure'){
      if(s.spindle)reject('Ручной замер при вращении недоступен. Сначала остановите шпиндель.');
      else if(action.z<-s.stock.length-EPS||action.z>EPS)reject(`Место замера: от Z−${s.stock.length} до Z0.`);
      else if(['inside-caliper','bore-gauge'].includes(action.instrument)&&!s.profile.bore)reject('В сплошной заготовке отверстия нет. Выберите наружный замер.');
      else{const u=round(s.stock.length+action.z);if(!['inside-caliper','bore-gauge'].includes(action.instrument)&&shoulder(s.profile,u))reject('Это граница двух ступеней. Выберите место внутри одного участка.');
        else{const actual=['inside-caliper','bore-gauge'].includes(action.instrument)?s.profile.bore:sample(s.profile,u),resolution=['micrometer','bore-gauge'].includes(action.instrument)?.01:.1,reading=+(Math.round(Math.round(actual*1000)/(resolution*1000))*resolution).toFixed(2);data={z:action.z,u,actual,resolution,reading,instrument:action.instrument,afterCut:s.cuts.length};s.readings.push(data);message=`Замер: Ø${reading.toFixed(resolution===.01?2:1)} мм в сечении Z${action.z}. Свободная практика не выдаёт зачёт курса.`;}
      }
    }
    s.journal.push({number:s.journal.length+1,action,ok,message});return {state:s,ok,message,data};
  }
  function newWork(title='Моя деталь',config={diameter:32,length:60}){return {version:1,name:name(title),stock:stock(config),events:[],cursor:0};}
  function createMachineBook(){return {version:1,selected:'work-1',works:[{id:'work-1',...real.newWork('Стойка ЧПУ')}],drafts:{},view:'2d'};}
  function addMachineWork(book,title,config){const cfg={diameter:32,length:60,grip:15,...config},saved=real.newWork(title,cfg),next=addWork(book,title,{diameter:saved.stock.diameter,length:saved.stock.length});next.works[next.works.length-1]={id:next.selected,...saved};return next;}
  function restoreWork(raw){if(raw?.version===2)return real.restoreWork(raw);try{demand(keys(raw,['version','name','stock','events','cursor'])&&raw.version===1&&Array.isArray(raw.events)&&raw.events.length<=MAX_EVENTS&&Number.isInteger(raw.cursor)&&raw.cursor>=0&&raw.cursor<=raw.events.length);const work={version:1,name:name(raw.name),stock:stock(raw.stock),events:[],cursor:raw.cursor};let state=create(work.stock),current=state;for(let i=0;i<raw.events.length;i++){const action=normalize(raw.events[i]);state=transition(state,action).state;work.events.push(action);if(i+1===raw.cursor)current=state;}return {work,state:current};}catch{return null;}}
  function execute(work,action){if(work?.version===2)return real.execute(work,action);const restored=restoreWork(work);demand(restored);demand(restored.work.cursor<MAX_EVENTS,'Журнал заполнен (160 действий). Отмените последнее действие для новой ветки или скачайте работу и создайте новую заготовку.');const event=normalize(action),result=transition(restored.state,event);return {...result,work:{...restored.work,events:[...restored.work.events.slice(0,restored.work.cursor),event],cursor:restored.work.cursor+1}};}
  function seek(work,cursor){if(work?.version===2)return real.seek(work,cursor);const restored=restoreWork(work);demand(restored&&Number.isInteger(cursor)&&cursor>=0&&cursor<=work.events.length);return {...restored.work,cursor};}
  function createBook(){return {version:1,selected:'work-1',works:[{id:'work-1',...newWork()}],drafts:{},view:'2d'};}
  const basicDraftKeys=['operation','start','end','x','feed','rpm','z','instrument'],draftKeys=[...basicDraftKeys,'panel','program','mdi','jogStep','measureZ','offsetX','offsetZ','wearX','wearZ','workZ','touchXValue','touchZValue','radialX','radialZ','radialFeed'];
  function restoreBook(raw){try{if(raw===null||raw===undefined)return createBook();demand(keys(raw,['version','selected','works','drafts','view'])&&raw.version===1&&Array.isArray(raw.works)&&raw.works.length>=1&&raw.works.length<=MAX_WORKS&&object(raw.drafts)&&['2d','3d'].includes(raw.view));const seen=new Set(),works=[];for(const w of raw.works){demand(object(w)&&typeof w.id==='string'&&/^work-[1-5]$/.test(w.id)&&!seen.has(w.id));const {id,...saved}=w,r=restoreWork(saved);demand(r);seen.add(id);works.push({id,...r.work});}demand(seen.has(raw.selected)&&Object.keys(raw.drafts).every(id=>seen.has(id)));const drafts={};for(const [id,d]of Object.entries(raw.drafts)){const allowed=works.find(w=>w.id===id).version===2?draftKeys:basicDraftKeys;demand(keys(d,allowed,[])&&Object.entries(d).every(([k,v])=>typeof v==='string'&&v.length<=(['program','mdi'].includes(k)?4000:32)&&!hidden.test(['program','mdi'].includes(k)?v.replace(/[\r\n\t]/g,''):v)));if(d.panel!==undefined)demand(['setup','jog','mdi','auto'].includes(d.panel));if(d.operation!==undefined)demand(['cut','measure','start','stop'].includes(d.operation));if(d.instrument!==undefined)demand(['caliper','micrometer','inside-caliper','bore-gauge'].includes(d.instrument));drafts[id]=Object.fromEntries(draftKeys.filter(k=>Object.hasOwn(d,k)).map(k=>[k,d[k]]));}return {version:1,selected:raw.selected,works,drafts,view:raw.view};}catch{return null;}}
  function addWork(book,title,config){const b=restoreBook(book);demand(b);demand(b.works.length<MAX_WORKS,'Можно хранить до пяти работ. Скачайте и удалите ненужную работу, чтобы освободить место.');const id=[1,2,3,4,5].map(n=>'work-'+n).find(id=>!b.works.some(w=>w.id===id));b.works.push({id,...newWork(title,config)});b.selected=id;return b;}
  function restartWork(book){
    const b=restoreBook(book);demand(b);
    const old=b.works.find(w=>w.id===b.selected),title=old.name.slice(0,48)+' · заново';
    const next=old.version===2?addMachineWork(b,title,old.stock):addWork(b,title,old.stock),d=b.drafts[old.id]||{};
    if(old.version===2){const {id,...saved}=old,program=d.program??real.restoreWork(saved).state.program.source;next.drafts[next.selected]={panel:'setup',...(program||d.program!==undefined?{program}:{})};}
    else next.drafts[next.selected]={...d};
    return next;
  }
  function removeWork(book,id){const b=restoreBook(book);demand(b&&b.works.some(w=>w.id===id));const wasMachine=b.works.find(w=>w.id===id).version===2;b.works=b.works.filter(w=>w.id!==id);delete b.drafts[id];if(!b.works.length)return wasMachine?createMachineBook():createBook();if(b.selected===id)b.selected=b.works[0].id;return b;}
  function isActive(book){const b=restoreBook(book);demand(b);return b.works.length>1||b.works.some(w=>w.events.length||w.stock.diameter!==32||w.stock.length!==60||w.stock.shape!==undefined||w.name!==(w.version===2?'Стойка ЧПУ':'Моя деталь')||(w.version===2&&w.stock.grip!==15))||Object.keys(b.drafts).length>0;}
  function stateOf(book){demand(object(book)&&Array.isArray(book.works),'Не удалось открыть список работ.');const w=book.works.find(w=>w?.id===book.selected);demand(w,'Выбранная работа не найдена.');const {id,...saved}=w,restored=restoreWork(saved);demand(restored);return restored.state;}
  function exportBook(book){const b=restoreBook(book);demand(b);const text=JSON.stringify({format:'cnc-free-workshop',version:1,book:b},null,2);demand(new TextEncoder().encode(text).length<=MAX_FILE_BYTES,'Файл превышает 512 КБ.');return text;}
  function parseBook(text){demand(typeof text==='string'&&new TextEncoder().encode(text).length<=MAX_FILE_BYTES,'Выберите файл песочницы до 512 КБ.');let raw;try{raw=JSON.parse(text.replace(/^\uFEFF/,''));}catch{throw Error('Некорректный JSON песочницы.');}demand(keys(raw,['format','version','book'])&&raw.format==='cnc-free-workshop'&&raw.version===1,'Это не файл свободной мастерской.');const b=restoreBook(raw.book);demand(b);return b;}
  function workSignature(w,draft){const {id,...saved}=w;return JSON.stringify([saved,draftKeys.filter(k=>draft&&Object.hasOwn(draft,k)).map(k=>[k,draft[k]])]);}
  function importBook(local,incoming){let b=restoreBook(local);const other=restoreBook(incoming);demand(b&&other);for(const w of other.works){const {id,...work}=w,signature=workSignature(w,other.drafts[id]);if(b.works.some(own=>workSignature(own,b.drafts[own.id])===signature))continue;const next=addWork(b,w.name,{diameter:w.stock.diameter,length:w.stock.length}),newId=next.selected;next.works[next.works.length-1]={id:newId,...clone(work)};if(other.drafts[id])next.drafts[newId]=clone(other.drafts[id]);b=next;}return b;}
  const api={EPS,MAX_EVENTS,MAX_WORKS,MAX_SEGMENTS,MAX_FILE_BYTES,limits,create,normalize,transition,remove,sample,newWork,createMachineBook,addMachineWork,restoreWork,execute,seek,createBook,restoreBook,addWork,restartWork,removeWork,isActive,stateOf,exportBook,parseBook,importBook};root.CNCSandbox=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
