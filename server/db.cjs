'use strict';
const {DatabaseSync}=require('node:sqlite'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function open(file){
  if(file!==':memory:')fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
  const db=new DatabaseSync(file);db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
  const version=db.prepare('PRAGMA user_version').get().user_version;if(version>1){db.close();throw Error('Database schema is newer than this server.');}
  if(version===0){db.exec(`BEGIN IMMEDIATE;
    CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
    CREATE TABLE users(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE COLLATE NOCASE,role TEXT NOT NULL CHECK(role IN ('admin','user')),password_hash TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,csrf TEXT NOT NULL,expires INTEGER NOT NULL,last_seen INTEGER NOT NULL);
    CREATE INDEX session_user ON sessions(user_id);
    CREATE TABLE limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,start INTEGER NOT NULL,blocked_until INTEGER NOT NULL);
    CREATE TABLE progress(user_id TEXT PRIMARY KEY REFERENCES users(id),revision INTEGER NOT NULL,archive TEXT NOT NULL,pilot TEXT,summary TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE TABLE mutations(user_id TEXT NOT NULL REFERENCES users(id),id TEXT NOT NULL,digest TEXT NOT NULL,revision INTEGER NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(user_id,id));
    CREATE TABLE snapshots(id INTEGER PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),revision INTEGER NOT NULL,archive TEXT NOT NULL,pilot TEXT,at TEXT NOT NULL);
    CREATE TABLE conflict_backups(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),archive TEXT NOT NULL,pilot TEXT,at TEXT NOT NULL,digest TEXT NOT NULL,UNIQUE(user_id,digest));
    CREATE TABLE security_events(id INTEGER PRIMARY KEY,at TEXT NOT NULL,event TEXT NOT NULL,user_id TEXT,ip_hash TEXT);
    PRAGMA user_version=1;`);try{db.prepare('INSERT INTO meta VALUES (?,?)').run('security_salt',crypto.randomBytes(32).toString('hex'));db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');db.close();throw e;}}
  if(file!==':memory:')try{fs.chmodSync(file,0o600);}catch{}
  return db;
}
function transaction(db,run){db.exec('BEGIN IMMEDIATE');try{const result=run();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}
module.exports={open,transaction};
