'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const n=require('../normative-model.js'),l=require('../library-model.js'),c=require('../course-model.js'),code=require('../gcode-model.js'),machine=require('../real-machine-model.js');
assert.equal(n.sources.length,18);assert.equal(n.rules.length,11);
assert.equal(new Set(n.sources.map(s=>s.id)).size,n.sources.length);
assert.equal(new Set(n.rules.map(r=>r.id)).size,n.rules.length);
const articleIds=new Set(l.articles.map(a=>a.id)),lessonIds=new Set(c.lessons.map(a=>a.id));
for(const s of n.sources){const u=new URL(s.url);assert.equal(u.protocol,'https:');assert.match(u.hostname,/(^|\.)(gost\.ru|gov\.ru|eaeunion\.org|haascnc\.com)$/);assert(s.note&&s.reviewLabel&&s.checkedOn);assert(Object.isFrozen(s));if(s.transition){assert.equal(s.transition.effectiveOn,'2027-10-01');assert.match(s.transition.url,/^https:\/\//);}}
for(const r of n.rules){assert(r.scope&&r.statement&&r.reviewLabel);for(const ref of r.sources){assert(n.source(ref.id));assert.equal(ref.clause,null,'No invented clause references');}for(const id of r.articles)assert(articleIds.has(id),id);for(const id of r.lessons)assert(lessonIds.has(id),id);if(r.kind==='normative')assert.equal(r.reviewStatus,'pending','Metadata does not approve normative rules');}
for(const a of l.articles){const rules=n.rulesForArticle(a.id);assert(rules.length,a.id);const text=l.exportText(a);for(const ref of n.sourcesForRules(rules))assert(text.includes(ref.url));assert(text.includes('Автоматическое отслеживание изменений не включено'));}
for(const lesson of c.lessons)assert(n.rulesForLesson(lesson.id).length,lesson.id);
assert.equal(n.source('__proto__'),undefined);assert.deepEqual(n.rulesForArticle('__proto__'),[]);assert.deepEqual(n.rulesForLesson(null),[]);assert.equal(n.textForArticle('missing'),'');
assert.equal(n.source('WORK-SAFETY').verification,'pending');assert.match(n.source('WORK-SAFETY').note,/первоначальную редакцию/);
assert(Object.isFrozen(n)&&Object.isFrozen(n.profiles[0].gCodes));assert.throws(()=>n.sources[0].title='certificate');
// The public profile must stay consistent with the actual parsers, not a generic CNC code list.
assert.deepEqual(n.profiles[0].gCodes,Object.keys(code.dialect.gGroups).map(Number));assert.deepEqual(n.profiles[0].mCodes,code.dialect.mCodes);
assert.deepEqual(n.profiles[1].gCodes,machine.dialect.supported.G);assert.deepEqual(n.profiles[1].mCodes,machine.dialect.supported.M);
assert(n.profiles[0].limits.some(t=>t.includes('G96')));assert(n.profiles[1].conventions.some(t=>t.includes('G96')));
const oldBook=l.toggle(l.restore(null),'safety','read');assert.deepEqual(l.restore(JSON.parse(JSON.stringify(oldBook))),oldBook);
assert.equal(require('../progress-model.js').summary(require('../progress-model.js').empty()).progress.done,0);

// UI presents source uncertainty, future dates, literal text and valid links without a network or storage API.
class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.className='';this.open=false;this._text='';this.classList={add:cls=>{this.className+=' '+cls;}};}
  set textContent(s){this._text=String(s);this.children=[];}get textContent(){return this._text+this.children.map(x=>x.textContent).join(' ');}
  set innerHTML(s){throw Error('Raw HTML is forbidden');}append(...nodes){this.children.push(...nodes);}all(){return [this,...this.children.flatMap(c=>c.all())];}
}
const window={CNCNormative:n},ctx=vm.createContext({window,document:{createElement:t=>new Element(t)},URL});
vm.runInContext(fs.readFileSync(require.resolve('../normative-ui.js'),'utf8'),ctx);
const host=new Element('main'),ui=window.CNCNormativeUI;ui.mountCatalog(host);ui.mountCatalog(host);assert.equal(host.children.length,1);
assert(host.textContent.includes('Автоматическое отслеживание изменений пока не включено'));assert(host.textContent.includes('2027-10-01'));assert(host.textContent.includes('Актуальная редакция требует подтверждения'));
const reader=new Element('article');ui.appendArticle(reader,'safety');ui.appendArticle(reader,'safety');assert.equal(reader.children.length,1);assert.equal(reader.children[0].open,false);assert(reader.textContent.includes('Постатейная сверка'));
for(const a of [...host.all(),...reader.all()].filter(e=>e.tagName==='a')){assert.equal(new URL(a.href).protocol,'https:');assert.equal(a.rel,'noopener noreferrer');}
const empty=new Element('article');ui.appendLesson(empty,'missing');assert.equal(empty.children.length,0);
for(const lesson of c.lessons){const p=new Element('article');ui.appendLesson(p,lesson.id);assert.equal(p.children.length,1);}
window.CNCNormative={...n,source:()=>null,profiles:[],sources:[{id:'unsafe',designation:'<script>literal</script>',title:'data',url:'javascript:alert(1)',note:'note',reviewLabel:'pending',checkedOn:n.checkedOn}]};
const unsafe=new Element('main');ui.mountCatalog(unsafe);assert.equal(unsafe.all().filter(e=>e.tagName==='a').length,0);assert(unsafe.textContent.includes('<script>literal</script>'));
console.log('Normative foundations: 18 sources, honest review states, 35 articles / 24 lessons, parser profiles, export / legacy progress, accessible folds and safe links passed.');
