'use strict';
const crypto=require('node:crypto'),{promisify}=require('node:util');
const scrypt=promisify(crypto.scrypt),N=32768,r=8,p=3,MAX_AGE=12*60*60*1000,IDLE=2*60*60*1000;
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
async function passwordHash(password){const salt=crypto.randomBytes(16).toString('hex'),key=await scrypt(password,salt,32,{N,r,p,maxmem:64*1024*1024});return `scrypt$${N}$${r}$${p}$${salt}$${key.toString('hex')}`;}
async function verify(password,encoded){const parts=encoded.split('$');if(parts.length!==6||parts[0]!=='scrypt'||+parts[1]!==N||+parts[2]!==r||+parts[3]!==p||!/^[a-f0-9]{32}$/.test(parts[4])||!/^[a-f0-9]{64}$/.test(parts[5]))return false;const key=await scrypt(password,parts[4],32,{N,r,p,maxmem:64*1024*1024});return crypto.timingSafeEqual(key,Buffer.from(parts[5],'hex'));}
function create(db,{clock=Date.now,secure=false}={}){
  const cookieName=secure?'__Host-cnc_session':'cnc_session',salt=db.prepare('SELECT value FROM meta WHERE key=?').get('security_salt').value;
  const keyed=value=>hash(salt+'|'+value);
  const cookie=(value,age)=>`${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure?'; Secure':''}`;
  function event(name,user,ip){db.prepare('INSERT INTO security_events(at,event,user_id,ip_hash) VALUES(?,?,?,?)').run(new Date(clock()).toISOString(),name,user||null,keyed(ip));db.exec('DELETE FROM security_events WHERE id NOT IN (SELECT id FROM security_events ORDER BY id DESC LIMIT 1000)');}
  function read(req){const entry=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='));const token=entry?.slice(cookieName.length+1);if(!token||!/^[A-Za-z0-9_-]{43}$/.test(token))return null;const s=db.prepare('SELECT s.*,u.username,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=?').get(hash(token));if(!s)return null;if(s.expires<=clock()||s.last_seen+IDLE<=clock()){db.prepare('DELETE FROM sessions WHERE token_hash=?').run(s.token_hash);return null;}if(s.last_seen+60000<clock())db.prepare('UPDATE sessions SET last_seen=? WHERE token_hash=?').run(clock(),s.token_hash);return s;}
  function issue(user,previous){if(previous)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(previous.token_hash);db.prepare('DELETE FROM sessions WHERE expires<? OR last_seen<?').run(clock(),clock()-IDLE);db.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash NOT IN (SELECT token_hash FROM sessions WHERE user_id=? ORDER BY last_seen DESC,rowid DESC LIMIT 4)').run(user.id,user.id);const token=crypto.randomBytes(32).toString('base64url'),csrf=crypto.randomBytes(32).toString('base64url');db.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run(hash(token),user.id,csrf,clock()+MAX_AGE,clock());return {cookie:cookie(token,MAX_AGE/1000),csrf};}
  function logout(s){db.prepare('DELETE FROM sessions WHERE token_hash=?').run(s.token_hash);return cookie('',0);}
  function limit(key){const row=db.prepare('SELECT * FROM limits WHERE key=?').get(key);return row&&row.start+900000>clock()?row:null;}
  function record(key,count,start,blocked=0){db.prepare('INSERT INTO limits VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET count=excluded.count,start=excluded.start,blocked_until=excluded.blocked_until').run(key,count,start,blocked);}
  function throttle(ip,username){
    db.prepare('DELETE FROM limits WHERE start<?').run(clock()-900000);if(db.prepare('SELECT count(*) AS n FROM limits').get().n>=10000) return 900;
    const ik=keyed('ip|'+ip),ak=keyed('account|'+username),i=limit(ik),a=limit(ak);
    if((i?.count||0)>=120)return Math.max(1,Math.ceil((i.start+900000-clock())/1000));
    record(ik,(i?.count||0)+1,i?.start||clock());if(a&&a.blocked_until>clock())return Math.ceil((a.blocked_until-clock())/1000);return 0;
  }
  function failure(ip,username){const key=keyed('account|'+username),a=limit(key),count=(a?.count||0)+1;record(key,count,a?.start||clock(),count>=5?clock()+Math.min(900000,60000*2**Math.min(count-5,4)):0);event('login_failed',null,ip);}
  function success(ip,user){db.prepare('DELETE FROM limits WHERE key=?').run(keyed('account|'+user.username.toLowerCase()));event('login_ok',user.id,ip);}
  return {read,issue,logout,throttle,failure,success,event,cookieName,keyed};
}
module.exports={passwordHash,verify,hash,create,MAX_AGE,IDLE};
