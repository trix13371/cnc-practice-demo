(function(){
  'use strict';
  const config=window.CNCProgressConfig,status={blocked:false,applying:false,message:'',store:null,revision:null};window.CNCProgressRecovery=status;
  function block(message){
    status.blocked=true;status.message=message;window.CNCDemo?.pauseWorkshop();
    if(document.getElementById('progress-recovery-block'))return;
    const box=document.createElement('section');box.id='progress-recovery-block';box.className='progress-recovery-block';box.setAttribute('role','alert');
    const h=document.createElement('h1');h.textContent='Сначала восстановим сохранения';const p=document.createElement('p');p.textContent=message;
    const reload=document.createElement('button');reload.type='button';reload.className='button primary';reload.textContent='Повторить загрузку';reload.onclick=()=>location.reload();box.append(h,p,reload);
    const exp=document.createElement('button');exp.type='button';exp.className='button secondary';exp.textContent='Скачать доступную копию';exp.onclick=()=>{
      if(window.CNCProgressUI&&window.CNCDemo){window.CNCProgressUI.exportArchive();return;}
      try{const raw=Object.fromEntries([...config.keys,config.journalKey].map(k=>[k,localStorage.getItem(k)])),a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify({format:'cnc-recovery-raw',version:1,raw})],{type:'application/json'}));a.href=url;a.download='cnc-recovery.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch{p.textContent='Чтение хранилища тоже недоступно. Исходные данные не очищены; повторите загрузку, когда хранилище станет доступно.';}
    };box.append(exp);document.body.append(box);
  }
  status.block=block;
  try{
    const storage=window.localStorage;status.store=window.CNCProgressStore.create(storage,config);const recovered=status.store.recover();status.revision=storage.getItem(config.revisionKey);
    if(recovered.status!=='none')status.message=recovered.status==='rolledBack'?'Незавершённый перенос отменён. Прежние сохранения восстановлены.':'Перенос завершён, все разделы восстановлены.';
    const prototype=Object.getPrototypeOf(storage),set=prototype.setItem,remove=prototype.removeItem;
    function guard(target,key){if(target!==storage||status.applying||!config.keys.includes(String(key)))return;if(status.blocked||storage.getItem(config.journalKey)!==null||storage.getItem(config.revisionKey)!==status.revision){block('Сохранения перенесены в другой вкладке или перенос ещё не завершён. Перезагрузите страницу перед продолжением.');throw Error('Сохранения изменились. Нужна перезагрузка.');}}
    prototype.setItem=function(key,value){guard(this,key);return set.call(this,key,value);};prototype.removeItem=function(key){guard(this,key);return remove.call(this,key);};
    window.addEventListener('storage',event=>{if(event.storageArea===storage&&event.key===config.revisionKey&&event.newValue!==status.revision)block('Сохранения перенесены в другой вкладке. Перезагрузите страницу, чтобы работать с новым прогрессом.');});
  }catch(error){
    // A pending transaction must recover before any controller can write to its keys.
    let pending=false;try{pending=localStorage.getItem(config.journalKey)!==null;}catch{}
    if(pending)block(error.message);else status.message='Хранилище недоступно. Скачивайте копию прогресса до закрытия страницы.';
  }
})();
