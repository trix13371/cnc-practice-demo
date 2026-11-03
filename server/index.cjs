'use strict';
const {create,config}=require('./app.cjs'),{acquire}=require('./lock.cjs');
(async()=>{const cfg=config(),unlock=acquire(cfg.dataDir);let app;
  try{app=await create({config:cfg});app.server.on('error',e=>{console.error('Server start failed:',e.code||e.name);unlock();process.exitCode=1;});app.server.listen(cfg.port,cfg.host,()=>console.log('CNC beta server:',cfg.origin));for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{app.server.close(()=>{app.db.close();unlock();process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();});process.once('exit',unlock);}catch(e){unlock();throw e;}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
