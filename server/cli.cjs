'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{DatabaseSync,backup}=require('node:sqlite'),{open,transaction}=require('./db.cjs'),{passwordHash}=require('./auth.cjs');
const ROOT=path.resolve(__dirname,'..');
async function init({file,credentials}){
  const db=open(file);try{if(db.prepare('SELECT count(*) AS n FROM users').get().n)throw Error('Accounts already exist. Initialization does not reset passwords.');if(fs.existsSync(credentials))throw Error('Credentials file already exists.');
    const users=[];for(let i=0;i<7;i++){const password=crypto.randomBytes(18).toString('base64url');users.push({id:crypto.randomUUID(),username:i===0?'admin':`beta0${i}`,role:i===0?'admin':'user',password,hash:await passwordHash(password)});}
    fs.mkdirSync(path.dirname(credentials),{recursive:true,mode:0o700});fs.writeFileSync(credentials,JSON.stringify({notice:'Private beta accounts. Share each participant only their own credentials. Do not upload this file to GitHub or public hosting.',createdAt:new Date().toISOString(),accounts:users.map(({username,role,password})=>({username,role,password}))},null,2),{flag:'wx',mode:0o600});
    transaction(db,()=>{const stmt=db.prepare('INSERT INTO users VALUES(?,?,?,?,?)');for(const u of users)stmt.run(u.id,u.username,u.role,u.hash,new Date().toISOString());});return {count:7,credentials};
  }finally{db.close();}
}
function inspect(file){const db=new DatabaseSync(file,{readOnly:true});try{if(db.prepare('PRAGMA quick_check').get().quick_check!=='ok'||db.prepare('PRAGMA user_version').get().user_version!==1||db.prepare('SELECT count(*) AS n FROM users').get().n!==7)throw Error('Invalid beta database backup.');}finally{db.close();}}
async function backupTo(file,to){if(fs.existsSync(to))throw Error('Backup destination already exists.');fs.mkdirSync(path.dirname(to),{recursive:true,mode:0o700});const db=new DatabaseSync(file,{readOnly:true});try{await backup(db,to);}finally{db.close();}fs.chmodSync(to,0o600);inspect(to);return to;}
async function restore(file,from){
  const dir=path.dirname(file);if(fs.existsSync(path.join(dir,'server.lock')))throw Error('Stop the beta server before restore. A server.lock file is present.');if(path.resolve(file)===path.resolve(from))throw Error('Source and destination must differ.');inspect(from);const release=require('./lock.cjs').acquire(dir,'restore');try{
  const old=fs.existsSync(file)?file+'.before-restore-'+crypto.randomUUID()+'.sqlite':null;if(old)await backupTo(file,old);
  fs.mkdirSync(dir,{recursive:true,mode:0o700});const temp=path.join(dir,'restore-'+crypto.randomUUID()+'.sqlite');await backupTo(from,temp);
  // Checkpoint and close the old database before replacing its main file. No directory deletion.
  if(fs.existsSync(file)){const db=new DatabaseSync(file);try{db.exec('PRAGMA wal_checkpoint(TRUNCATE)');}finally{db.close();}}
  for(const suffix of ['-wal','-shm']){const sidecar=file+suffix;if(fs.existsSync(sidecar))fs.unlinkSync(sidecar);}fs.renameSync(temp,file);
  const db=open(file);try{db.exec('DELETE FROM sessions');}finally{db.close();}if(process.platform!=='win32'){const fd=fs.openSync(dir,'r');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}return {restored:true,previous:old};
  }finally{release();}
}
async function main(args=process.argv.slice(2)){
  const dir=path.resolve(process.env.DATA_DIR||path.join(ROOT,'data')),file=path.join(dir,'beta.sqlite'),option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
  if(args[0]==='init'){const credentials=path.resolve(option('--credentials',path.join(dir,'initial-access.private.json'))),result=await init({file,credentials});console.log(`Created ${result.count} accounts. Private credentials: ${credentials}`);}
  else if(args[0]==='reset-password'){
    const username=args[1];if(!/^[a-z0-9_-]{1,32}$/.test(username||''))throw Error('Specify username.');const to=path.resolve(option('--credentials',path.join(dir,username+'-reset-'+Date.now()+'.private.json')));if(fs.existsSync(to))throw Error('Credentials destination already exists.');const db=open(file);try{const user=db.prepare('SELECT id FROM users WHERE username=?').get(username);if(!user)throw Error('Unknown username');const password=crypto.randomBytes(18).toString('base64url'),hash=await passwordHash(password);fs.mkdirSync(path.dirname(to),{recursive:true,mode:0o700});fs.writeFileSync(to,JSON.stringify({username,password},null,2),{flag:'wx',mode:0o600});transaction(db,()=>{db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash,user.id);db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);db.exec('DELETE FROM limits');});console.log('Password reset; sessions revoked. Private credentials: '+to);}finally{db.close();}
  }else if(args[0]==='backup'){const to=option('--to');if(!to)throw Error('Specify --to backup path');console.log('Backup verified: '+await backupTo(file,path.resolve(to)));}
  else if(args[0]==='restore'){const from=option('--from');if(!from)throw Error('Specify --from backup path');const result=await restore(file,path.resolve(from));console.log('Restored. Previous database: '+(result.previous||'none'));}
  else throw Error('Use init, reset-password USER, backup --to PATH, restore --from PATH.');
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});module.exports={init,inspect,backupTo,restore,main};
