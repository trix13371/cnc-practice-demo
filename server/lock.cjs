'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
function started(pid){try{return fs.readFileSync('/proc/'+pid+'/stat','utf8').split(') ')[1].split(' ')[19];}catch{return null;}}
function alive(lock){if(lock.host!==os.hostname())return true;try{process.kill(lock.pid,0);}catch(e){return e.code!=='ESRCH';}return !lock.started||started(lock.pid)===lock.started;}
function acquire(dir,kind='server'){
  fs.mkdirSync(dir,{recursive:true,mode:0o700});const file=path.join(dir,'server.lock'),value=JSON.stringify({pid:process.pid,host:os.hostname(),started:started(process.pid),kind,token:crypto.randomUUID()});
  try{fs.writeFileSync(file,value,{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST')throw e;let old;try{old=JSON.parse(fs.readFileSync(file,'utf8'));if(!old||!Number.isInteger(old.pid)||typeof old.host!=='string')throw Error();}catch{throw Error('Stop the beta server; inspect the existing server.lock before removing it.');}if(alive(old))throw Error('Stop the beta server before restore or starting a second instance.');fs.unlinkSync(file);fs.writeFileSync(file,value,{flag:'wx',mode:0o600});}
  return ()=>{try{if(fs.readFileSync(file,'utf8')===value)fs.unlinkSync(file);}catch{}};
}
module.exports={acquire};
