(function(root){
  'use strict';
  const code=typeof module!=='undefined'&&module.exports?require('./gcode-model.js'):root.CNCGCode;
  const MAX_EVENTS=500,EPS=1e-7;
  const core=['coordinates','motion','modal','feed','spindle','retract'];
  const finals=['transfer-a','transfer-b','transfer-c'];
  const task=id=>code.tasks.find(t=>t.id===id);
  const ids=()=>code.tasks.map(t=>t.id);
  const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
  const source=v=>typeof v==='string'&&v.length<=code.MAX_SOURCE;
  function spec(id){const t=task(id);return t?.prediction?structuredClone(t.prediction):null;}
  // The selector identifies a line in the submitted code, including an erroneous rapid move.
  function target(id,text){
    const t=task(id),s=spec(id);if(!t||!s||!source(text))return {frame:null,message:'Выберите задание и введите программу.'};
    const result=code.simulate(text,{initial:t.initial,stock:t.stock});
    if(result.errors.length)return {frame:null,result,message:'Сначала исправьте запись: '+result.errors[0].message};
    const frames=result.trace.filter(f=>f.move);
    const frame=s.selector==='firstMove'?frames[0]:s.selector==='lastMove'?frames.at(-1):s.selector==='firstStart'?result.trace.find(f=>f.codes.includes('M3')):result.trace.find(f=>f.move&&f.move.from.z>=0&&f.move.to.z<0);
    if(frame&&s.fields.some(k=>frame.after[k]===null||frame.after[k]===undefined))return {frame:null,result,message:'В выбранной строке нужная величина ещё не задана. Сопоставьте команды и подачу F с условием.'};
    return {frame:frame||null,result,message:frame?'':'В текущем коде нет строки для этого прогноза. Сопоставьте фрагмент с условием.'};
  }
  function forecast(id,text,values){
    const found=target(id,text),s=spec(id);
    if(!found.frame)return {valid:false,correct:false,wrong:[],frame:null,message:found.message};
    const wrong=s.fields.filter(k=>!object(values)||(k==='spindle'?typeof values[k]!=='boolean'||values[k]!==found.frame.after[k]:!Number.isFinite(values[k])||Math.abs(values[k]-found.frame.after[k])>=EPS));
    return {valid:true,correct:!wrong.length,wrong,frame:structuredClone(found.frame),message:wrong.length?'Прогноз пока не совпал. Проверьте отмеченные величины.':'Прогноз подтверждён. Теперь проследите выполнение строки.'};
  }
  function create(id){if(!task(id))throw Error('Неизвестное задание G-кода.');return {version:1,id,events:[],prediction:null,helped:false,predictionErrors:0,checkErrors:0,checks:0,passed:null,feedback:''};}
  function normalize(id,a){
    if(!object(a))return null;
    if(a.type==='predict'&&source(a.code)&&object(a.values)){
      const s=spec(id),values={};if(!s)return null;
      for(const k of s.fields){const v=a.values[k];if(k==='spindle'?typeof v!=='boolean':typeof v!=='number'||!Number.isFinite(v))return null;values[k]=v;}
      return {type:'predict',code:a.code,values};
    }
    if(a.type==='check'&&source(a.code))return {type:'check',code:a.code};
    if(a.type==='help'&&['hint','lesson','example','reference'].includes(a.source))return {type:'help',source:a.source};
    if(a.type==='reset')return {type:'reset'};
    return null;
  }
  function transition(s,input){
    if(!s||s.version!==1||!task(s.id)||!Array.isArray(s.events))throw Error('Некорректный журнал задания.');
    const a=normalize(s.id,input);if(!a)throw Error('Заполните величины прогноза или проверьте действие.');
    if(s.events.length>=MAX_EVENTS)throw Error('Журнал этого условия заполнен. Результат сохранён; выберите другое задание.');
    const n=structuredClone(s);n.events.push(a);let ok=true,graded=null,predicted=null;
    if(a.type==='predict'){
      n.prediction=null;predicted=forecast(n.id,a.code,a.values);ok=predicted.valid&&predicted.correct;
      if(ok)n.prediction={code:a.code,values:structuredClone(a.values)};
      else if(predicted.valid)n.predictionErrors++;
      n.feedback=predicted.message;
    }else if(a.type==='check'){
      if(!n.prediction||n.prediction.code!==a.code){ok=false;n.feedback='Сначала подтвердите прогноз для текущего кода.';}
      else{
        n.checks++;graded=code.grade(n.id,a.code);ok=graded.correct;
        if(!ok){n.checkErrors++;n.feedback='Пока не выполнены требования задания.';}
        else{
          const independent=!n.helped&&!n.predictionErrors&&!n.checkErrors;
          if(!n.passed||independent&&!n.passed.independent)n.passed={code:a.code,independent,prediction:structuredClone(n.prediction)};
          n.feedback=independent?'Программа и прогноз подтверждены без помощи.':'Программа подтверждена с разбором или исправлениями.';
        }
      }
    }else if(a.type==='help'){n.helped=true;n.feedback='Объяснение учтено как помощь для этого условия.';}
    else if(a.type==='reset'){n.prediction=null;n.feedback='Черновик восстановлен. Помощь, ошибки и прежний зачёт сохранены.';}
    return {state:n,ok,message:n.feedback,...(graded?{grade:graded}:{}),...(predicted?{forecast:predicted}:{})};
  }
  function snapshot(s){return {version:1,id:s.id,events:structuredClone(s.events)};}
  function restore(raw){
    try{if(!object(raw)||raw.version!==1||!task(raw.id)||!Array.isArray(raw.events)||raw.events.length>MAX_EVENTS)return null;
      let s=create(raw.id);for(const a of raw.events)s=transition(s,a).state;return s;
    }catch{return null;}
  }
  function legacy(raw){
    const normalized=code.restore(raw),allowed=code.tasks.filter(t=>!t.transfer).map(t=>t.id);
    for(const field of ['phases','drafts','passed','helped'])for(const id of Object.keys(normalized[field]))if(!allowed.includes(id))delete normalized[field][id];
    if(!allowed.includes(normalized.selected))normalized.selected=allowed[0];return normalized;
  }
  function restoreBook(raw,legacyRaw=null){
    if(raw!==null&&raw!==undefined&&(!object(raw)||raw.version!==2))return null;
    const old=legacy(raw?.legacy||legacyRaw),all=ids();
    const book={version:2,selected:old.selected,phases:{...old.phases},drafts:{...old.drafts},predictionDrafts:{},sessions:{},legacy:old};
    if(!raw)return book;
    if(all.includes(raw.selected))book.selected=raw.selected;
    for(const field of ['sessions','phases','drafts','predictionDrafts'])if(raw[field]!==undefined&&!object(raw[field]))return null;
    for(const [id,saved]of Object.entries(raw.sessions||{})){const s=restore(saved);if(!all.includes(id)||!s||s.id!==id)return null;book.sessions[id]=s;}
    for(const id of all){
      if(['read','practice'].includes(raw.phases?.[id]))book.phases[id]=raw.phases[id];
      if(source(raw.drafts?.[id]))book.drafts[id]=raw.drafts[id];
      const pd=raw.predictionDrafts?.[id];if(object(pd)){const clean={};for(const k of spec(id).fields)if(typeof pd[k]==='string'&&pd[k].length<=32)clean[k]=pd[k];book.predictionDrafts[id]=clean;}
    }
    return book;
  }
  function snapshotBook(book){return {...structuredClone(book),sessions:Object.fromEntries(Object.entries(book.sessions).map(([id,s])=>[id,snapshot(s)]))};}
  function evidence(book,id){
    const p=book.sessions[id]?.passed;if(p)return {passed:true,independent:p.independent,legacy:false};
    const old=!task(id)?.transfer&&book.legacy.passed[id];return {passed:!!old,independent:false,legacy:!!old};
  }
  function nextFinal(book){return finals.find(id=>evidence(book,id).independent)||finals.find(id=>{const s=book.sessions[id];return !s||!s.helped&&!s.predictionErrors&&!s.checkErrors&&!s.passed;})||null;}
  const api={spec,target,forecast,create,transition,snapshot,restore,ids,coreIds:()=>[...core],finalIds:()=>[...finals],restoreBook,snapshotBook,evidence,nextFinal,MAX_EVENTS};
  root.CNCGCodeLearning=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
