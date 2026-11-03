(function(root){
  'use strict';
  const MAX_BYTES=12*1024*1024;
  const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
  const bad=k=>typeof k!=='string'||!k||['__proto__','prototype','constructor'].includes(k);
  function create(storage,{keys,journalKey='cnc-progress-transaction-v1'}={}){
    if(!storage||!['getItem','setItem','removeItem'].every(k=>typeof storage[k]==='function'))throw Error('Хранилище недоступно.');
    if(!Array.isArray(keys)||!keys.length||keys.some(bad)||new Set(keys).size!==keys.length||bad(journalKey)||keys.includes(journalKey))throw Error('Неверные ключи хранилища.');
    keys=[...keys];
    const get=k=>storage.getItem(k)??null;
    function validate(map){
      if(!object(map)||Object.keys(map).length!==keys.length||keys.some(k=>!Object.hasOwn(map,k)||map[k]!==null&&typeof map[k]!=='string'))throw Error('Неполный набор данных переноса.');
      return Object.fromEntries(keys.map(k=>[k,map[k]]));
    }
    const current=()=>Object.fromEntries(keys.map(k=>[k,get(k)]));
    const matches=map=>keys.every(k=>get(k)===map[k]);
    function apply(map){for(const k of keys){if(map[k]===null)storage.removeItem(k);else storage.setItem(k,map[k]);}if(!matches(map))throw Error('Запись не подтверждена хранилищем.');}
    function pending(){if(get(journalKey)!==null)throw Error('Сначала нужно восстановить незавершённый перенос.');}
    function read(){pending();return current();}
    function clear(){storage.removeItem(journalKey);if(get(journalKey)!==null)throw Error('Журнал переноса пока не освобождён.');}
    function commit(after){
      pending();after=validate(after);const before=current(),raw=JSON.stringify({version:1,before,after});
      if(new TextEncoder().encode(raw).length>MAX_BYTES)throw Error('Недостаточно места для безопасного переноса: архив слишком большой.');
      storage.setItem(journalKey,raw);if(get(journalKey)!==raw)throw Error('Резервная запись не сохранена. Перенос отменён.');
      try{apply(after);}catch(error){
        try{apply(before);clear();}catch{throw Error('Запись прервалась. Журнал сохранён: перезагрузите страницу для восстановления.');}
        throw Error('Не удалось записать перенос. Прежние данные восстановлены.');
      }
      clear();return {status:'committed'};
    }
    function recover(){
      const raw=get(journalKey);if(raw===null)return {status:'none'};
      let journal;try{if(new TextEncoder().encode(raw).length>MAX_BYTES)throw Error();journal=JSON.parse(raw);if(!object(journal)||journal.version!==1)throw Error();journal={before:validate(journal.before),after:validate(journal.after)};}catch{throw Error('Журнал переноса повреждён. Автоматическая запись остановлена; исходные данные сохранены.');}
      if(matches(journal.after)){clear();return {status:'committed'};}
      apply(journal.before);clear();return {status:'rolledBack'};
    }
    return {read,commit,recover};
  }
  const api={create,MAX_BYTES};root.CNCProgressStore=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
