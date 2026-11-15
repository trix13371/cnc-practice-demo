'use strict';
const {parentPort,workerData}=require('node:worker_threads'),crypto=require('node:crypto');
const progress=require('../progress-model.js'),pilot=require('../pilot-model.js');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
try{
  const b=workerData.payload;
  if(!b||!b.archive||Buffer.byteLength(JSON.stringify(b.archive))>progress.MAX_BYTES)throw Error('Нужен общий архив до 4 МБ.');
  const checked=workerData.summary?progress.validateWithSummary(b.archive):{archive:progress.validate(b.archive),summary:null};
  const value={archive:checked.archive,pilot:b.pilot===null||b.pilot===undefined?null:pilot.parse(JSON.stringify(b.pilot))};
  parentPort.postMessage({ok:true,value,digest:hash(progress.canonical(value)),backupDigest:hash(progress.canonical({sections:value.archive.sections,pilot:value.pilot})),summary:checked.summary});
}catch(e){parentPort.postMessage({ok:false,error:'Сохранение отклонено: '+e.message});}
