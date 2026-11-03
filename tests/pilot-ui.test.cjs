'use strict';
// Exercise the real UI handlers with a small DOM/storage double: no learner data may be written.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),pilot=require('../pilot-model.js');
class Element{
  constructor(tag,text){this.tag=tag;this.textContent=text||'';this.children=[];this.attrs={};this.value='';}
  append(...nodes){this.children.push(...nodes);for(const n of nodes)if(n&&typeof n==='object')n.parent=this;}
  replaceChildren(...nodes){this.children=[];this.append(...nodes);}
  insertBefore(node){this.append(node);}
  setAttribute(k,v){this.attrs[k]=v;}
  get lastChild(){return this.children.at(-1);}
  all(){return [this,...this.children.flatMap(c=>c instanceof Element?c.all():[])];}
  querySelector(selector){return this.all().find(e=>selector==='footer'?e.tag==='footer':selector==='[role="status"]'?e.attrs.role==='status':selector.startsWith('.')?(e.className||'').split(' ').includes(selector.slice(1)):e.tag===selector)||null;}
  focus(){}
  click(){}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);}
}
function ui(initial=null){
  const entries=new Map([['cnc-practice-v2','LEARNER-KEEP']]),writes=[],downloads=[];if(initial!==null)entries.set(pilot.KEY,initial);
  let quota=false;const storage={getItem:k=>entries.get(k)??null,setItem(k,v){writes.push(k);if(quota)throw Error('Quota exceeded');entries.set(k,v);}};
  const window={CNCPilot:pilot,CNCProgress:require('../progress-model.js')};vm.runInNewContext(fs.readFileSync(require.resolve('../pilot-ui.js'),'utf8'),{window,localStorage:storage,document:{createElement:t=>new Element(t)},Blob,URL:{createObjectURL:b=>{downloads.push(b);return 'blob:test';},revokeObjectURL(){}},setTimeout:fn=>fn()});const parent=new Element('main');parent.append(new Element('footer'));const root=window.CNCPilotUI.mount(parent);window.CNCPilotUI.render();
  const button=text=>{const b=root.all().find(e=>e.tag==='button'&&e.textContent===text);assert(b,`Button: ${text}`);return b;};
  function add(id){const input=root.all().find(e=>e.tag==='input'&&e.placeholder);assert(input);input.value=id;root.all().find(e=>e.tag==='form').onsubmit({preventDefault(){}});}
  return {root,entries,writes,downloads,button,add,quota(v){quota=v;}};
}
(async()=>{
  const q=ui();q.quota(true);q.add('UNSAVED');assert(!q.entries.has(pilot.KEY));assert.match(q.root.querySelector('[role="status"]').textContent,/не закрывайте/);q.button('Скачать наблюдения · JSON').onclick();assert.equal(pilot.parse(await q.downloads[0].text()).participants[0].id,'UNSAVED');assert(q.writes.every(k=>k===pilot.KEY));assert.equal(q.entries.get('cnc-practice-v2'),'LEARNER-KEEP');
  const first=pilot.add(pilot.empty(),'A','self'),second=pilot.add(first,'B','self'),stale=ui(JSON.stringify(first));stale.entries.set(pilot.KEY,JSON.stringify(second));stale.add('C');assert.equal(stale.entries.get(pilot.KEY),JSON.stringify(second));assert.match(stale.root.querySelector('[role="status"]').textContent,/другой вкладке/);assert.equal(stale.writes.length,0);
  const broken='{"broken":true}',recover=ui(broken);assert.equal(recover.entries.get(pilot.KEY),broken);assert.equal(recover.writes.length,0);
  const reader=recover.root.all().find(e=>e.tag==='input'&&e.type==='file');assert(reader);reader.files=[{size:JSON.stringify(first).length,text:async()=>JSON.stringify(first)}];await reader.onchange();recover.button('Скачать текущий и восстановить журнал').onclick();assert.equal(pilot.parse(recover.entries.get(pilot.KEY)).participants[0].id,'A');assert.equal(await recover.downloads[0].text(),broken);assert.equal(recover.entries.get('cnc-practice-v2'),'LEARNER-KEEP');assert(recover.writes.every(k=>k===pilot.KEY));
  console.log('Pilot UI: quota preserves exportable live work, stale-tab writes blocked, corrupt journal recoverable, learner storage untouched.');
})().catch(e=>{console.error(e);process.exitCode=1;});
