'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),net=require('node:net');
const database=require('./db.cjs'),authLib=require('./auth.cjs'),validation=require('./validation.cjs');
const {ROUTE_VERSION}=require('../progress-config.js');
const ROOT=path.resolve(__dirname,'..'),MAX_BODY=6*1024*1024+65536;
const fail=(status,message)=>Object.assign(new Error(message),{status});
const userView=s=>({id:s.user_id||s.id,username:s.username,role:s.role});
function config(env=process.env){
  const production=env.NODE_ENV==='production',origin=env.PUBLIC_ORIGIN||'http://127.0.0.1:4180',url=new URL(origin);
  if(!['https:','http:'].includes(url.protocol)||url.origin!==origin||url.username||url.password)throw Error('PUBLIC_ORIGIN must be a single origin without a trailing slash.');
  if(production&&url.protocol!=='https:')throw Error('Production requires an HTTPS PUBLIC_ORIGIN.');
  if(url.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw Error('Plain HTTP is allowed only on loopback.');
  if(env.TRUST_PROXY&&!['0','1'].includes(env.TRUST_PROXY))throw Error('TRUST_PROXY must be 0 or 1.');
  const proxyPeers=(env.TRUST_PROXY_PEERS||'').split(',').filter(Boolean);if(proxyPeers.some(ip=>!net.isIP(ip))||env.TRUST_PROXY==='1'&&!proxyPeers.length)throw Error('TRUST_PROXY requires explicit TRUST_PROXY_PEERS IP addresses.');
  const port=Number(env.PORT||4180);if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid PORT');
  return {origin,production,secure:url.protocol==='https:',trustProxy:env.TRUST_PROXY==='1',proxyPeers,host:env.HOST||(production?'0.0.0.0':'127.0.0.1'),port,dataDir:path.resolve(env.DATA_DIR||path.join(ROOT,'data'))};
}
async function create(options={}){
  const cfg={...config(options.env),...options.config},db=options.db||database.open(path.join(cfg.dataDir,'beta.sqlite')),clock=options.clock||Date.now,auth=authLib.create(db,{clock,secure:cfg.secure});
  if(!db.prepare('SELECT id FROM users LIMIT 1').get()){if(!options.db)db.close();throw Error('No beta accounts. Run npm run beta:init first.');}
  const dummy=await authLib.passwordHash(crypto.randomBytes(32).toString('hex')),validator=validation.create();let hashing=0,reading=0;
  const index=fs.readFileSync(path.join(ROOT,'index.html'),'utf8'),modules=[...index.matchAll(/<script src="([\w-]+\.js)"><\/script>/g)].map(m=>m[1]),client=require('./client-assets.cjs').create();
  const course=index.replace('<body>','<body class="cloud-loading">').replace(/<script src="[\w-]+\.js"><\/script>/g,'').replace(/href="([\w-]+\.css)"/g,'href="/$1"').replace('</body>',`<script src="/account-client.js" data-bundles="${client.groups.map(g=>g.url).join(' ')}"></script></body>`).replace('<link rel="stylesheet" href="/typography.css">','').replace('</head>','<link rel="stylesheet" href="/account.css"><link rel="stylesheet" href="/typography.css"></head>');
  const assets=new Map([...modules.map(n=>['/'+n,[n,'text/javascript']]),['/style.css',['style.css','text/css']],['/workshop-theme.css',['workshop-theme.css','text/css']],['/account.css',['server/public/account.css','text/css']],['/account-client.js',['server/public/account-client.js','text/javascript']],['/account-storage.js',['server/public/account-storage.js','text/javascript']],['/admin-client.js',['server/public/admin-client.js','text/javascript']],['/login.js',['server/public/login.js','text/javascript']]]);
  assets.set('/app.css',['app.css','text/css']);
  assets.set('/light-theme.css',['light-theme.css','text/css']);
  assets.set('/sandbox.css',['sandbox.css','text/css']);
  assets.set('/real-machine.css',['real-machine.css','text/css']);
  assets.set('/assets/lathe-hero.png',['assets/lathe-hero.png','image/png']);
  assets.set('/typography.css',['typography.css','text/css']);
  assets.set('/assets/fonts/golos-text-variable.ttf',['assets/fonts/golos-text-variable.ttf','font/ttf']);
  for(const group of client.groups)assets.set(group.url,[null,'text/javascript',group.bytes]);
  const publicAssets=new Set(['/account.css','/login.js','/typography.css','/assets/fonts/golos-text-variable.ttf']);
  // Release assets are immutable during a process lifetime. Authentication still runs
  // before revalidation, and unversioned URLs must revalidate on every use.
  const assetCache=new Map();
  function staticAsset(req,res,route,asset,method){
    let cached=assetCache.get(route);
    if(!cached){const bytes=asset[2]||fs.readFileSync(path.join(ROOT,asset[0]));cached={bytes,etag:'"'+crypto.createHash('sha256').update(bytes).digest('hex')+'"'};assetCache.set(route,cached);}
    res.setHeader('Cache-Control','private, max-age=0, must-revalidate');res.setHeader('ETag',cached.etag);res.setHeader('Vary','Cookie');
    const matches=String(req.headers['if-none-match']||'').split(',').some(tag=>tag.trim()==='*'||tag.trim().replace(/^W\//,'')===cached.etag);
    if(matches){res.writeHead(304);return res.end();}
    res.writeHead(200,{'Content-Type':asset[1]+(/^(?:image|font)\//.test(asset[1])?'':'; charset=utf-8'),'Content-Length':cached.bytes.length});return res.end(method==='HEAD'?undefined:cached.bytes);
  }
  function security(res){res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");if(cfg.secure)res.setHeader('Strict-Transport-Security','max-age=31536000');}
  function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));}
  function body(req,max=MAX_BODY){return new Promise((resolve,reject)=>{
    if((req.headers['content-type']||'').split(';')[0].trim()!=='application/json'){req.resume();reject(fail(415,'Требуется JSON.'));return;}
    if(reading>=4){req.resume();reject(fail(503,'Сервер занят. Повторите сохранение.'));return;}
    if(Number(req.headers['content-length']||0)>max){req.resume();reject(fail(413,'Файл слишком большой.'));return;}
    reading++;let chunks=[],length=0,settled=false;const done=(error,value)=>{if(settled)return;settled=true;reading--;req.setTimeout(0);if(error)reject(error);else resolve(value);};
    req.setTimeout(15000,()=>{done(fail(408,'Время чтения запроса истекло.'));req.destroy();});req.on('data',chunk=>{length+=chunk.length;if(length>max){chunks=[];done(fail(413,'Файл слишком большой.'));}else if(!settled)chunks.push(chunk);});req.on('end',()=>{if(settled)return;try{done(null,JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{done(fail(400,'Некорректный JSON.'));}});req.on('error',()=>done(fail(400,'Запрос прерван.')));
  });}
  function state(userId){const r=db.prepare('SELECT * FROM progress WHERE user_id=?').get(userId);return r?{revision:r.revision,archive:JSON.parse(r.archive),pilot:r.pilot?JSON.parse(r.pilot):null,summary:JSON.parse(r.summary),updatedAt:r.updated_at}:{revision:0,archive:null,pilot:null,summary:null,updatedAt:null};}
  const server=http.createServer({maxHeaderSize:16384},async(req,res)=>{
    security(res);try{
      const url=new URL(req.url,'http://internal'),route=url.pathname,method=req.method;
      if(route==='/healthz'&&method==='GET'){db.prepare('SELECT 1').get();return json(res,200,{ok:true});}
      if(req.headers.host!==new URL(cfg.origin).host)throw fail(421,'Неверный адрес сервера.');
      const session=auth.read(req),isApi=route.startsWith('/api/');if(session&&isApi)res.setHeader('X-CNC-Account',session.user_id);
      let ip=req.socket.remoteAddress||'unknown';if(cfg.trustProxy){const peer=ip.replace(/^::ffff:/,'');if(!cfg.proxyPeers.includes(peer))throw fail(403,'Соединение не от доверенного прокси.');const header=req.headers['x-cnc-client-ip'];if(typeof header!=='string'||!net.isIP(header))throw fail(400,'Отсутствует адрес доверенного прокси.');ip=header;}
      if(!['GET','HEAD'].includes(method)){
        if(req.headers.origin!==cfg.origin)throw fail(403,'Источник запроса не разрешён.');
        if(route!=='/api/login'){
          if(!session)throw fail(401,'Войдите в аккаунт.');
          const token=req.headers['x-csrf-token'];if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token)||token.length!==session.csrf.length||!crypto.timingSafeEqual(Buffer.from(token),Buffer.from(session.csrf)))throw fail(403,'Защитный токен устарел. Перезагрузите страницу.');
        }
      }
      if(route==='/api/login'&&method==='POST'){
        const b=await body(req,2048),username=typeof b?.username==='string'?b.username.trim().toLowerCase():'';
        if(!/^[a-z0-9_-]{1,32}$/.test(username)||typeof b.password!=='string'||b.password.length<1||b.password.length>128)throw fail(400,'Проверьте логин и пароль.');
        const retry=auth.throttle(ip,username);if(retry){res.setHeader('Retry-After',String(retry));throw fail(429,'Слишком много попыток. Повторите вход позже.');}
        if(hashing>=4){res.setHeader('Retry-After','3');throw fail(503,'Сервер занят. Повторите вход.');}
        const user=db.prepare('SELECT * FROM users WHERE username=?').get(username);let matches;hashing++;try{matches=await authLib.verify(b.password,user?.password_hash||dummy);}finally{hashing--;}
        if(!matches||!user){auth.failure(ip,username);throw fail(401,'Неверный логин или пароль.');}
        auth.success(ip,user);const issued=auth.issue(user,session);res.setHeader('Set-Cookie',issued.cookie);return json(res,200,{user:userView(user),csrf:issued.csrf});
      }
      if(isApi){
        if(!session)throw fail(401,'Войдите в аккаунт.');
        if(!['GET','HEAD'].includes(method)){const key=auth.keyed('write|'+session.user_id),old=db.prepare('SELECT * FROM limits WHERE key=?').get(key),active=old&&old.start+60000>clock();if(active&&old.count>=60){res.setHeader('Retry-After','60');throw fail(429,'Слишком частые запросы. Повторите через минуту.');}db.prepare('INSERT INTO limits VALUES(?,?,?,0) ON CONFLICT(key) DO UPDATE SET count=excluded.count,start=excluded.start').run(key,active?old.count+1:1,active?old.start:clock());}
        if(route==='/api/me'&&method==='GET')return json(res,200,{user:userView(session),csrf:session.csrf});
        if(route==='/api/logout'&&method==='POST'){res.setHeader('Set-Cookie',auth.logout(session));auth.event('logout',session.user_id,ip);return json(res,200,{ok:true});}
        if(route==='/api/progress'&&method==='GET')return json(res,200,state(session.user_id));
        if(route==='/api/progress'&&method==='PUT'){
          const b=await body(req);if(!Number.isSafeInteger(b?.expectedRevision)||b.expectedRevision<0||typeof b.mutationId!=='string'||!/^[a-zA-Z0-9_-]{16,80}$/.test(b.mutationId))throw fail(400,'Неверная версия сохранения.');
          const checked=await validator.run(b),{value,digest}=checked;const reply=database.transaction(db,()=>{
            const oldMutation=db.prepare('SELECT * FROM mutations WHERE user_id=? AND id=?').get(session.user_id,b.mutationId),current=db.prepare('SELECT * FROM progress WHERE user_id=?').get(session.user_id),revision=current?.revision||0;
            if(oldMutation){if(oldMutation.digest!==digest)throw fail(409,'Идентификатор запроса уже использован для другой записи.');return {revision:oldMutation.revision,currentRevision:revision,replayed:true};}
            if(revision!==b.expectedRevision)throw fail(409,'На сервере другая версия прогресса. Текущие данные не перезаписаны.');
            const at=new Date(clock()).toISOString(),next=revision+1,summary=checked.summary;
            if(current)db.prepare('INSERT INTO snapshots(user_id,revision,archive,pilot,at) VALUES(?,?,?,?,?)').run(session.user_id,revision,current.archive,current.pilot,current.updated_at);
            db.prepare('INSERT INTO progress VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET revision=excluded.revision,archive=excluded.archive,pilot=excluded.pilot,summary=excluded.summary,updated_at=excluded.updated_at').run(session.user_id,next,JSON.stringify(value.archive),value.pilot?JSON.stringify(value.pilot):null,JSON.stringify(summary),at);
            db.prepare('INSERT INTO mutations VALUES(?,?,?,?,?)').run(session.user_id,b.mutationId,digest,next,clock());
            db.prepare('DELETE FROM snapshots WHERE user_id=? AND id NOT IN (SELECT id FROM snapshots WHERE user_id=? ORDER BY id DESC LIMIT 5)').run(session.user_id,session.user_id);
            db.prepare('DELETE FROM mutations WHERE user_id=? AND id NOT IN (SELECT id FROM mutations WHERE user_id=? ORDER BY created DESC LIMIT 200)').run(session.user_id,session.user_id);return {revision:next,currentRevision:next,updatedAt:at};
          });return json(res,200,reply);
        }
        if(route==='/api/backups'&&method==='POST'){
          const checked=await validator.run(await body(req),{summary:false}),value=checked.value,digest=checked.backupDigest;let row=db.prepare('SELECT id FROM conflict_backups WHERE user_id=? AND digest=?').get(session.user_id,digest);
          if(!row){if(db.prepare('SELECT count(*) AS n FROM conflict_backups WHERE user_id=?').get(session.user_id).n>=10)throw fail(409,'Лимит отдельных копий: 10. Скачайте текущую работу перед сменой версии.');row={id:crypto.randomUUID()};db.prepare('INSERT INTO conflict_backups VALUES(?,?,?,?,?,?)').run(row.id,session.user_id,JSON.stringify(value.archive),value.pilot?JSON.stringify(value.pilot):null,new Date(clock()).toISOString(),digest);}return json(res,201,row);
        }
        if(route==='/api/backups'&&method==='GET')return json(res,200,db.prepare('SELECT id,at FROM conflict_backups WHERE user_id=? ORDER BY at DESC').all(session.user_id));
        const backupId=route.match(/^\/api\/backups\/([a-f0-9-]{36})$/);if(backupId&&method==='GET'){const row=db.prepare('SELECT archive,pilot,at FROM conflict_backups WHERE user_id=? AND id=?').get(session.user_id,backupId[1]);if(!row)throw fail(404,'Копия не найдена.');return json(res,200,{archive:JSON.parse(row.archive),pilot:row.pilot?JSON.parse(row.pilot):null,at:row.at});}
        if(route.startsWith('/api/admin/')){
          if(session.role!=='admin')throw fail(403,'Доступ только администратору.');
          if(route==='/api/admin/users'&&method==='GET'){const result=[];for(const r of db.prepare('SELECT u.id,u.username,u.role,p.summary,p.archive,p.pilot,p.updated_at FROM users u LEFT JOIN progress p ON p.user_id=u.id ORDER BY u.username').all()){let summary=r.summary?JSON.parse(r.summary):null;if(r.archive&&summary?.routeVersion!==ROUTE_VERSION)summary=(await validator.run({archive:JSON.parse(r.archive),pilot:r.pilot?JSON.parse(r.pilot):null})).summary;result.push({id:r.id,username:r.username,role:r.role,done:summary?.progress.done||0,total:require('../learning-path-model.js').steps.length,updatedAt:r.updated_at});}return json(res,200,result);}
          const id=route.match(/^\/api\/admin\/users\/([a-f0-9-]{36})\/progress$/);if(id&&method==='GET'){const user=db.prepare('SELECT id,username,role FROM users WHERE id=?').get(id[1]);if(!user)throw fail(404,'Участник не найден.');const current=state(user.id);if(current.archive)current.summary=(await validator.run({archive:current.archive,pilot:current.pilot})).summary;return json(res,200,{user,...current,summary:require('./admin-report.cjs').describe(current.summary)});}
        }
        throw fail(404,'API не найден.');
      }
      if(!['GET','HEAD'].includes(method))throw fail(405,'Метод не поддерживается.');
      if(route==='/login'){if(session){res.writeHead(303,{Location:'/'});return res.end();}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(method==='HEAD'?undefined:fs.readFileSync(path.join(__dirname,'public/login.html')));}
      if(!session&&!publicAssets.has(route)){if(route==='/'||route==='/index.html'||route==='/demo/cnc-demo.html'||route==='/admin'){res.writeHead(303,{Location:'/login'});return res.end();}throw fail(401,'Войдите в аккаунт.');}
      if(['/', '/index.html','/demo/cnc-demo.html'].includes(route)){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(method==='HEAD'?undefined:course);}
      if(route==='/admin'){if(session.role!=='admin')throw fail(403,'Доступ только администратору.');res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});return res.end(method==='HEAD'?undefined:fs.readFileSync(path.join(__dirname,'public/admin.html')));}
      const asset=assets.get(route);if(!asset)throw fail(404,'Страница не найдена.');staticAsset(req,res,route,asset,method);
    }catch(e){if(res.destroyed||res.writableEnded)return;const status=e.status||500;if(status===500)console.error('Request failed:',e.code||e.name);json(res,status,{error:status===500?'Ошибка сервера. Сохраните локальную копию и повторите позже.':e.message});}
  });
  server.headersTimeout=15000;server.requestTimeout=30000;server.keepAliveTimeout=5000;server.maxRequestsPerSocket=100;
  return {server,db,config:cfg,close:()=>new Promise((resolve,reject)=>server.close(e=>{validator.close();if(!options.db)db.close();e?reject(e):resolve();}))};
}
module.exports={create,config};
