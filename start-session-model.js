(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.CNCStartSession=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const MAX_EVENTS=320;
  const steps=Object.freeze([
    ['parts-learn','Знакомимся с тремя узлами'],['parts-try','Что вращается и что перемещается'],['parts-check','Узнайте резец на другой схеме'],
    ['stop-learn','Команда остановки и полная остановка'],['stop-check','Подготовьте сцену к ручному контролю'],
    ['scale-learn','Чтение шкалы'],['scale-check','Чтение шкалы · проверка'],['diameter-learn','Диаметр меняется с двух сторон'],['diameter-check','Найдите слой на другой детали']
  ].map(([id,title])=>Object.freeze({id,title})));
  const copy=value=>JSON.parse(JSON.stringify(value));
  const fail=message=>{throw Error(message);};
  function plain(value){if(!value||typeof value!=='object'||Array.isArray(value))return false;const p=Object.getPrototypeOf(value);return p===Object.prototype||p===null;}
  function exact(value,keys){if(!plain(value)||Reflect.ownKeys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k)))fail('Повреждена запись вводного занятия.');}
  // GLM parser, reviewed: reject controls and bound the raw input before trimming.
  function parseNumber(input){
    if(typeof input!=='string'||input.length>32||/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/.test(input))return null;
    const s=input.trim();if(s.length<1||s.length>32)return null;
    if(!/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(s))return null;
    const value=Number(s.replace(',','.'));return Number.isFinite(value)?value:null;
  }
  function local(step){return {seen:[],motion:step===3?'running':step===4?'coasting':'stopped',tool:0,rotated:false,moved:false,measured:false,scale:step===6?50:0,diameter:32,correct:false,feedback:''};}
  function create(step=0){return {version:1,step,complete:false,...local(step),attempts:Array(9).fill(0),hints:[],assisted:false,events:[]};}
  function apply(state,action,lastStep=8){
    if(state.complete)fail('Вводное знакомство уже завершено.');
    if(state.events.length>=MAX_EVENTS)fail('Журнал заполнен. Ваши выполненные действия сохранены; продолжение в этой попытке недоступно.');
    if(!plain(action)||typeof action.type!=='string')fail('Недопустимое действие.');
    const s=copy(state),i=s.step;
    const keys={inspect:['type','part'],move:['type','delta'],scale:['type','value'],diameter:['type','value'],answer:['type','value'],rotate:['type'],stop:['type'],wait:['type'],measure:['type'],hint:['type'],next:['type']};
    if(!Object.hasOwn(keys,action.type))fail('Неизвестное действие.');exact(action,keys[action.type]);
    switch(action.type){
      case 'inspect':if(i!==0||!['stock','chuck','tool'].includes(action.part))fail('Сейчас нужно выполнить действие текущего шага.');if(!s.seen.includes(action.part))s.seen.push(action.part);s.feedback={stock:'Заготовка — исходный материал будущей детали. При обычном точении она вращается.',chuck:'Патрон удерживает заготовку и передаёт ей вращение.',tool:'Резец — отдельный инструмент. Его кромка снимает слой с поверхности заготовки.'}[action.part];break;
      case 'rotate':if(i!==1||s.motion!=='stopped')fail('Включение вращения сейчас недоступно.');s.motion='running';s.rotated=true;s.feedback='Метка вращается вместе с заготовкой. Перемещение резца — другое движение.';break;
      case 'stop':if(![1,3].includes(i)||s.motion!=='running')fail('Команду остановки сейчас подать нельзя.');s.motion='coasting';s.feedback='Команда подана, но вращение ещё продолжается. Дождитесь полной остановки.';break;
      case 'wait':if(![1,3,4].includes(i)||s.motion!=='coasting')fail('В этой сцене нет ожидающей остановки.');s.motion='stopped';s.feedback='Вращение полностью остановлено. На реальном оборудовании доступ определяется также инструкцией и другими условиями.';break;
      case 'move':if(i!==1||![1,-1].includes(action.delta)||s.tool+action.delta<0||s.tool+action.delta>3)fail('Резец вышел бы за пределы схемы.');s.tool+=action.delta;s.moved=true;s.feedback='Резец перемещается вдоль заготовки. Вращение и перемещение — разные движения.';break;
      case 'measure':if(![3,4].includes(i))fail('Ручной контроль здесь недоступен.');if(i===4)s.attempts[i]++;s.measured=s.motion==='stopped';if(i===4)s.correct=s.measured;s.feedback=s.measured?'Контроль выполнен в подготовленной сцене после полной остановки.':'Вращение продолжается. Ручной прибор пока не подносят; дождитесь остановки.';break;
      case 'scale':if(![5,6].includes(i)||!Number.isInteger(action.value)||action.value<0||action.value>100||i===6&&s.correct)fail('Положение должно быть целым числом сотых от 0 до 100.');s.scale=action.value;if(i===5){s.correct=s.correct||s.scale===12;s.feedback=s.scale===12?'12 сотых — это 0,12 мм: одна десятая и две сотых.':'Длинное деление даёт десятую миллиметра, короткое — сотую.';}else s.feedback='Положение изменено. Прочитайте число и запишите его десятичной дробью.';break;
      case 'diameter':if(i!==7||!Number.isInteger(action.value)||action.value<28||action.value>32)fail('На этой схеме доступны диаметры от 28 до 32 мм.');s.diameter=action.value;s.correct=s.correct||s.diameter===30;s.feedback=s.diameter===30?'Диаметр уменьшился на 2 мм; слой с одной стороны — 1 мм.':'Сравните разницу всего диаметра с толщиной слоя на одной стороне.';break;
      case 'answer':{
        if(![2,6,8].includes(i)||s.correct)fail('Ответ сейчас недоступен.');
        let right=false;if(i===2){if(!['A','B','C'].includes(action.value))fail('Выберите область A, B или C.');right=action.value==='A';}
        else{const value=parseNumber(action.value);if(value===null)fail('Введите одно число с запятой или точкой, без единиц и выражений.');right=i===6?s.scale===24&&Math.abs(value-.24)<1e-9:Math.abs(value-2)<1e-9;}
        s.attempts[i]++;s.correct=right;s.feedback=right?'Верно. Можно продолжить.':i===2?'Выбрана другая часть. Ищите отдельную кромку инструмента на новой схеме.':i===6?'Сопоставьте сотые на шкале с десятичной записью и условием.':'Вы нашли величину для всего диаметра или для одной стороны? Сначала определите разницу диаметров, затем слой.';break;
      }
      case 'hint':if(![2,4,6,8].includes(i)||s.correct||s.hints.includes(i))fail('Подсказка сейчас недоступна.');s.hints.push(i);s.assisted=true;s.feedback='Подсказка открыта. Можно продолжить без штрафа.';break;
      case 'next':{
        const ready=i===0?s.seen.length===3:i===1?s.rotated&&s.moved&&s.motion==='stopped':i===3?s.measured&&s.motion==='stopped':s.correct;
        if(!ready)fail('Сначала выполните действие текущего шага.');
        if(i===lastStep)s.complete=true;else{Object.assign(s,local(i+1));s.step=i+1;}break;
      }
    }
    s.events.push(copy(action));return s;
  }
  function replay(raw,step=0,lastStep=8){exact(raw,['version','events']);if(raw.version!==1||!Array.isArray(raw.events)||raw.events.length>MAX_EVENTS)fail('Недопустимая версия или длина журнала.');let s=create(step);for(const action of raw.events)s=apply(s,action,lastStep);return s;}
  function snapshot(state){if(!state||state.version!==1||!Array.isArray(state.events))fail('Повреждено состояние занятия.');return {version:1,events:copy(state.events)};}
  function transition(state,action){return apply(replay(snapshot(state)),action);}
  function restore(raw){try{return replay(raw);}catch{return null;}}
  function exercise(step){
    return {
      create:()=>create(step),
      restore(raw){try{return replay(raw,step,step);}catch{return null;}},
      transition:(state,action)=>apply(state,action,step),
    };
  }
  return Object.freeze({MAX_EVENTS,steps,parseNumber,create,transition,snapshot,restore,exercise});
});
