(async function(){
  'use strict';
  const bundles=(document.currentScript.dataset.bundles||'').split(' '),native=window.localStorage,metaKey='cnc-cloud-meta-v1',pilotKey='cnc-pilot-v1',installKey='cnc-cloud-install-v1';
  const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
  const button=(text,run)=>{const b=node('button',text);b.type='button';b.onclick=()=>Promise.resolve().then(run).catch(error=>setStatus(error.message,true));return b;};
  const load=name=>new Promise((resolve,reject)=>{const s=node('script');s.src=name;s.async=false;const timer=setTimeout(()=>reject(Error('Загрузка курса заняла слишком много времени. Проверьте соединение и повторите загрузку.')),20000);s.onload=()=>{clearTimeout(timer);resolve();};s.onerror=()=>{clearTimeout(timer);reject(Error('Не удалось загрузить модуль курса. Повторите загрузку.'));};document.body.append(s);});
  let user,csrf,scoped,prefix,meta,suppress=false,ready=false,pending=null,sending=false,conflicted=false,conflictPanel,bar,status,loginLink,storageFatal=false,changeSequence=0,reloadRequired=false;
  const boot=node('section',undefined,'account-boot'),bootTitle=node('h1','Готовим вашу мастерскую'),bootDetail=node('p','Подключаем аккаунт и сохранения…'),indicator=node('span',undefined,'boot-indicator');indicator.setAttribute('aria-hidden','true');boot.setAttribute('role','status');boot.append(indicator,bootTitle,bootDetail);document.body.append(boot);
  function setStatus(text,error=false){if(status){status.textContent=text;status.className=error?'cloud-error':'';}else bootDetail.textContent=text;}
  async function api(url,options={}){const res=await fetch(url,{credentials:'same-origin',signal:AbortSignal.timeout(20000),...options,headers:{...(options.body?{'Content-Type':'application/json','X-CSRF-Token':csrf}:{}),...options.headers}});const account=res.headers.get('X-CNC-Account');if(user&&account&&account!==user.id){ready=false;setStatus('В другой вкладке открыт другой аккаунт. Сначала сохраните свою копию и перезагрузите страницу.',true);const e=Error('Аккаунт изменился. Перезагрузите страницу.');e.status=401;throw e;}let data;try{data=await res.json();}catch{throw Error('Сервер вернул неизвестный ответ. Локальная работа сохранена.');}if(loginLink)loginLink.hidden=res.status!==401;if(!res.ok){const e=Error(data.error||'Ошибка запроса.');e.status=res.status;throw e;}return data;}
  function readMeta(){const raw=scoped.getItem(metaKey);if(raw===null)return {revision:0,signature:null,dirty:false};const m=JSON.parse(raw);if(!Number.isSafeInteger(m.revision)||m.revision<0||typeof m.dirty!=='boolean'||m.signature!==null&&typeof m.signature!=='string')throw Error('Повреждены сведения синхронизации. Сохраните диагностическую копию.');return m;}
  function writeMeta(value){native.setItem(prefix+metaKey,JSON.stringify(value));meta=value;}
  function before(key){if(suppress||!window.CNCProgressConfig)return;const c=window.CNCProgressConfig;if(![...c.keys,c.journalKey,pilotKey].includes(key))return;const current=readMeta();if(ready&&current.revision!==meta.revision){conflict();throw Error('Сохранения изменены другой вкладкой.');}if(ready&&key===c.revisionKey)reloadRequired=true;changeSequence++;writeMeta({...current,dirty:true});if(ready)setStatus(reloadRequired?'Перенос сохранён на устройстве. После загрузки передадим его в аккаунт.':'Изменения на этом устройстве. Сохраняем…');}
  function raw(){const c=window.CNCProgressConfig;return Object.fromEntries(c.keys.map(k=>[k,scoped.getItem(k)]));}
  function value(){return {archive:window.CNCProgressUI.collect(),pilot:window.CNCPilotUI?.progressSnapshot()||(scoped.getItem(pilotKey)===null?null:window.CNCPilot.parse(scoped.getItem(pilotKey)))};}
  async function signature(v){const bytes=new TextEncoder().encode(window.CNCProgress.canonical({sections:v.archive?.sections||window.CNCProgress.empty().sections,pilot:v.pilot||null})),digest=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');}
  function download(name,data){const url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'})),a=node('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async function install(remote){
    const c=window.CNCProgressConfig,keys=[...c.keys,pilotKey,metaKey],store=window.CNCProgressStore.create(scoped,{keys,journalKey:installKey});
    const archive=remote.archive?window.CNCProgress.validate(remote.archive):window.CNCProgress.empty(),sig=await signature({archive,pilot:remote.pilot}),old={...raw(),[pilotKey]:scoped.getItem(pilotKey),[metaKey]:scoped.getItem(metaKey)},next=window.CNCProgress.toRaw(archive,old);
    next[pilotKey]=remote.pilot?JSON.stringify(window.CNCPilot.validate(remote.pilot)):null;next[c.revisionKey]=crypto.randomUUID();next[metaKey]=JSON.stringify({revision:remote.revision,signature:sig,dirty:false});
    suppress=true;if(window.CNCProgressRecovery)window.CNCProgressRecovery.applying=true;try{store.commit(next);meta=readMeta();}finally{suppress=false;if(window.CNCProgressRecovery)window.CNCProgressRecovery.applying=false;}
  }
  function conflict(){
    if(conflicted)return;conflicted=true;pending=null;setStatus('На сервере другая версия. Ваши изменения не перезаписаны.',true);conflictPanel=node('section',undefined,'cloud-panel');conflictPanel.setAttribute('role','alert');
    conflictPanel.append(node('h2','Изменения с другого устройства'),node('p','Автоматическая запись остановлена. Можно скачать обе версии или сохранить текущую работу отдельной копией на сервере и загрузить актуальную. Отдельные копии доступны по кнопке «Мои резервные копии».'));
    conflictPanel.append(button('Скачать мою учебную копию',()=>download('cnc-local-progress.json',value().archive)),button('Скачать мои наблюдения',()=>download('cnc-local-observations.json',value().pilot||window.CNCPilot.empty())),button('Скачать версию с сервера',async()=>download('cnc-server-progress.json',(await api('/api/progress')).archive||window.CNCProgress.empty())),button('Сохранить мою копию и загрузить серверную',async()=>{window.CNCDemo.pauseWorkshop();const local=value();await api('/api/backups',{method:'POST',body:JSON.stringify(local)});const remote=await api('/api/progress');await install(remote);location.reload();}));bar.after(conflictPanel);
  }
  let savePromise=null;
  function push(){if(savePromise)return savePromise;savePromise=doPush().finally(()=>{savePromise=null;});return savePromise;}
  async function doPush(){
    if(!ready||sending||conflicted||storageFatal||reloadRequired)return false;
    sending=true;
    try{const sequence=changeSequence,current=value(),sig=await signature(current);if(conflicted||reloadRequired)return false;if(!pending&&sig===meta.signature){if(sequence!==changeSequence)return false;if(meta.dirty)writeMeta({...meta,dirty:false});setStatus('Прогресс сохранён в аккаунте');return true;}
      if(!pending)pending={mutationId:crypto.randomUUID(),expectedRevision:meta.revision,...current,signature:sig};setStatus('Сохраняем прогресс на сервере…');
      const request=pending,{signature:sentSignature,...body}=request,result=await api('/api/progress',{method:'PUT',body:JSON.stringify(body)}),changed=reloadRequired||sequence!==changeSequence||await signature(value())!==sentSignature;
      if(readMeta().revision>result.revision){conflict();return false;}writeMeta({revision:result.revision,signature:sentSignature,dirty:changed});pending=null;if(result.currentRevision!==result.revision){conflict();return false;}setStatus(meta.dirty?'Есть новые изменения, сохраняем…':'Прогресс сохранён в аккаунте');return !meta.dirty;}
    catch(error){if(error.status===409)conflict();else setStatus(error.status===401?'Сессия закончилась. Изменения остались на этом устройстве; войдите снова.':'Нет подтверждения сервера. Работа остаётся на устройстве; не очищайте данные браузера.',true);return false;}finally{sending=false;}
  }
  async function backups(){const list=await api('/api/backups'),panel=node('section',undefined,'cloud-panel');panel.append(node('h2','Мои отдельные копии'),node('p','Копии созданы при конфликте устройств. Для объединения скачайте учебный JSON и используйте перенос в результатах курса. Наблюдения восстанавливаются отдельно в журнале.'));if(!list.length)panel.append(node('p','Отдельных копий пока нет.'));for(const item of list){const row=node('div');row.append(node('span',new Date(item.at).toLocaleString('ru-RU')),button('Скачать обучение',async()=>download('cnc-backup-progress.json',(await api('/api/backups/'+item.id)).archive)),button('Скачать наблюдения',async()=>download('cnc-backup-observations.json',(await api('/api/backups/'+item.id)).pilot||window.CNCPilot.empty())));panel.append(row);}panel.append(button('Закрыть список',()=>panel.remove()));bar.after(panel);}
  async function logout(){const exit=async()=>{await api('/api/logout',{method:'POST',body:'{}'});location.assign('/login');};if(await push())return exit();const panel=node('section',undefined,'cloud-panel');panel.append(node('h2','Есть изменения без подтверждения сервера'),node('p','Скачайте учебную копию и наблюдения перед выходом. Доступная локальная работа останется привязана к этому аккаунту в этом браузере. После нового входа синхронизация продолжится.'),button('Скачать учебную копию',()=>download('cnc-before-logout.json',value().archive)),button('Скачать наблюдения',()=>download('cnc-observations-before-logout.json',value().pilot)),button('Выйти без подтверждения сохранения',exit),button('Остаться',()=>panel.remove()));bar.after(panel);}
  try{
    if(bundles.length!==3||!bundles.every((name,i)=>new RegExp('^/assets/js/'+['bootstrap','models','interface'][i]+'\\.[a-f0-9]{16}\\.js$').test(name)))throw Error('Состав курса изменился. Повторите загрузку страницы.');
    const me=await api('/api/me');user=me.user;csrf=me.csrf;
    await load(bundles[0]);
    const made=window.CNCAccountStorage.create(native,user.id,before);scoped=made.storage;prefix=made.prefix;
    // All legacy controllers keep their storage contract, with a separate namespace per account.
    Object.defineProperty(window,'localStorage',{configurable:true,get:()=>scoped});
    suppress=true;window.CNCProgressStore.create(scoped,{keys:[...window.CNCProgressConfig.keys,pilotKey,metaKey],journalKey:installKey}).recover();suppress=false;
    meta=readMeta();
    bootDetail.textContent='Загружаем учебные модели…';await load(bundles[1]);
    const remote=await api('/api/progress');
    const localArchive=window.CNCProgress.fromRaw(raw()),localPilot=scoped.getItem(pilotKey)===null?null:window.CNCPilot.parse(scoped.getItem(pilotKey)),same=remote.archive&&await signature({archive:localArchive,pilot:localPilot})===await signature(remote);
    let startupConflict=false;
    if((meta.dirty&&remote.revision!==meta.revision||remote.revision<meta.revision)&&!same)startupConflict=true;
    else if(meta.dirty&&remote.revision===meta.revision){} // Resume an unsent draft, including after a network failure.
    else if(same)writeMeta({revision:remote.revision,signature:await signature(remote),dirty:false});
    else await install(remote);
    window.CNCAccount={user,save:push};
    // Translate cross-tab storage events back to the scoped contract used by recovery guards.
    window.addEventListener('storage',e=>{if(e.storageArea!==native||!e.key?.startsWith(prefix))return;const key=e.key.slice(prefix.length);if(key===metaKey){if(ready&&JSON.parse(e.newValue||'null')?.revision!==meta.revision)conflict();return;}const translated=new Event('storage');Object.defineProperties(translated,{storageArea:{value:scoped},key:{value:key},newValue:{value:e.newValue},oldValue:{value:e.oldValue}});window.dispatchEvent(translated);});
    bootDetail.textContent='Открываем курс и восстанавливаем ваш прогресс…';await load(bundles[2]);
    boot.remove();bar=node('section',undefined,'account-bar');status=node('span');status.setAttribute('role','status');bar.append(status);
    const menu=node('details',undefined,'account-menu'),summary=node('summary'),avatar=node('span',user.username.slice(0,2).toUpperCase(),'sidebar-avatar'),identity=node('span',undefined,'sidebar-identity');
    avatar.setAttribute('aria-hidden','true');identity.append(node('strong',user.username),node('small',user.role==='admin'?'Администратор':'Участник бета-теста'));summary.append(avatar,identity);menu.append(summary);
    const actions=node('div',undefined,'account-menu-popover');actions.append(button('Сохранить сейчас',push),button('Мои резервные копии',backups));
    if(user.role==='admin'){const link=node('a','Участники бета-теста');link.href='/admin';actions.append(link);}
    actions.append(button('Выйти из аккаунта',logout));menu.append(actions);
    menu.onclick=event=>{if(event.target.closest('button,a'))menu.open=false;};menu.onkeydown=event=>{if(event.key==='Escape'){menu.open=false;summary.focus();}};
    document.addEventListener('click',event=>{if(!menu.contains(event.target))menu.open=false;});
    const accountSlot=document.querySelector('.sidebar-account');if(accountSlot)accountSlot.replaceChildren(menu);else bar.append(menu);
    loginLink=node('a','Войти снова');loginLink.href='/login';loginLink.hidden=true;bar.append(loginLink);document.querySelector('header').after(bar);
    document.body.classList?.remove('cloud-loading');window.dispatchEvent?.(new Event('resize'));
    ready=true;if(startupConflict)conflict();else await push();
    setInterval(()=>push().catch(e=>setStatus('Не удалось собрать прогресс: '+e.message,true)),3000);
    setInterval(async()=>{if(sending||conflicted)return;try{const cloud=await api('/api/progress');if(cloud.revision!==meta.revision)conflict();}catch(error){if(error.status===401)setStatus('Войдите снова. Текущая работа остаётся на этом устройстве.',true);}},20000);
    window.addEventListener('online',()=>push());document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')push();});
    if(Object.values(window.CNCProgressConfig.sections).some(k=>native.getItem(k)!==null)){const note=node('section',undefined,'cloud-panel');note.append(node('p','В браузере есть сохранения прежней автономной версии. Они не перенесены в аккаунт автоматически. Для продолжения экспортируйте старый JSON и импортируйте его в «Результатах».'),button('Открыть перенос прогресса',()=>window.CNCWorkshop.results()),button('Закрыть подсказку',()=>note.remove()));bar.after(note);}
  }catch(error){storageFatal=true;boot.dataset.state='error';bootTitle.textContent='Не удалось открыть мастерскую';setStatus(error.name==='TimeoutError'?'Сервер не ответил вовремя. Проверьте соединение и повторите загрузку.':error.message||'Не удалось подключить аккаунт.',true);boot.append(button('Повторить загрузку',()=>location.reload()));if(scoped)boot.append(button('Скачать диагностическую копию этого аккаунта',()=>{const keys=Array.from({length:scoped.length},(_,i)=>scoped.key(i));download('cnc-account-recovery.json',{format:'cnc-account-recovery',raw:Object.fromEntries(keys.map(k=>[k,scoped.getItem(k)]))});}));if(error.status===401){const a=node('a','Войти в аккаунт');a.href='/login';boot.append(a);}}
})();
