'use strict';
const {Worker}=require('node:worker_threads'),path=require('node:path');
const failure=(status,message)=>Object.assign(new Error(message),{status});
function create({timeoutMs=2000,maxPending=2}={}){
  let running=false,closed=false;const queue=[];
  function next(){
    if(running||!queue.length||closed)return;
    running=true;const job=queue.shift();let settled=false,timer,worker;
    async function finish(error,result){
      if(settled)return;settled=true;clearTimeout(timer);
      if(worker)await worker.terminate().catch(()=>{});
      running=false;if(error)job.reject(error);else job.resolve(result);next();
    }
    try{
      worker=new Worker(path.join(__dirname,'validation-worker.cjs'),{workerData:{payload:job.payload,summary:job.summary},resourceLimits:{maxOldGenerationSizeMb:64,maxYoungGenerationSizeMb:16,stackSizeMb:4}});
      timer=setTimeout(()=>finish(failure(422,'Сохранение слишком сложное для обработки. Скачайте локальную копию и обратитесь к администратору.')),timeoutMs);
      worker.once('message',r=>finish(r.ok?null:failure(400,r.error),r));
      worker.once('error',()=>finish(failure(422,'Превышен лимит ресурсов проверки. Локальная работа не удалена.')));
      worker.once('exit',()=>{if(!settled)finish(failure(503,'Проверка сохранения прервана. Повторите попытку.'));});
    }catch{finish(failure(503,'Не удалось запустить проверку сохранения. Повторите попытку.'));}
  }
  function run(payload,{summary=true}={}){
    if(closed)return Promise.reject(failure(503,'Сервер останавливается. Повторите сохранение.'));
    if(running&&queue.length>=maxPending)return Promise.reject(failure(503,'Сервер проверяет другие сохранения. Повторите попытку.'));
    return new Promise((resolve,reject)=>{queue.push({payload,summary,resolve,reject});next();});
  }
  function close(){closed=true;for(const job of queue.splice(0))job.reject(failure(503,'Сервер останавливается.'));}
  return {run,close};
}
module.exports={create};
