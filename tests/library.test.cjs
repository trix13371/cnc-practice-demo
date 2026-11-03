'use strict';
const assert=require('node:assert/strict'),library=require('../library-model.js'),course=require('../course-model.js');
assert.equal(library.articles.length,35);assert.equal(library.glossary.length,67);assert.equal(course.lessons.length,24);
assert.equal(new Set(library.articles.map(a=>a.id)).size,35);assert.equal(new Set(library.glossary.map(g=>g.term)).size,67);
const categoryIds=new Set(library.categories.map(c=>c[0])),lessonIds=new Set(course.lessons.map(l=>l.id)),articleIds=new Set(library.articles.map(a=>a.id));
for(const a of library.articles){
  assert.ok(categoryIds.has(a.category));assert.ok(a.sections.length>=3);assert.ok(library.text(a).split(/\s+/).length>=100,a.id+' has substantive reading');assert.ok(library.minutes(a)>=1);
  for(const id of a.lessons)assert.ok(lessonIds.has(id),id);
  for(const id of a.sources){const source=library.sources[id];assert.ok(source);const url=new URL(source.url);assert.equal(url.protocol,'https:');assert.match(url.hostname,/(^|\.)(haascnc\.com|sandvik\.coromant\.com|mitutoyo\.com)$/);assert.ok(library.exportText(a).includes(source.url));}
  for(const s of a.sections){assert.equal(typeof s.title,'string');assert.ok(s.paragraphs.every(p=>typeof p==='string'&&p.length>0));assert.ok(Array.isArray(s.bullets));}
  for(const id of a.related||[])assert(articleIds.has(id),'Valid reading continuation: '+id);
  for(const s of a.sections)if(s.table){assert(s.table.caption);assert(s.table.headers.length>=2);assert(s.table.rows.every(row=>row.length===s.table.headers.length));for(const row of s.table.rows)assert(library.exportText(a).includes(row.join(' | ')),'Tables are included in text export');}
  if(a.visual){const figure=library.figures[a.visual];assert(figure?.label&&figure.caption&&figure.legend.length);assert.doesNotMatch(figure.markup,/<script|<foreignObject|<image|\bon\w+\s*=|javascript:|href\s*=/i);for(const item of figure.legend)assert(library.exportText(a).includes(item));}
  for(const check of a.checks||[]){assert(check.prompt&&check.answer&&check.reason);assert(library.exportText(a).includes(check.prompt));assert(library.exportText(a).includes(check.reason));}
}
for(const l of course.lessons)assert.ok(library.lessonArticles(l.id).length>0,'lesson links to reading: '+l.id);
for(const term of library.glossary)assert.ok(articleIds.has(term.article));
const ids=result=>result.map(a=>a.id);
assert.deepEqual(ids(library.search({query:'чертёж'})),ids(library.search({query:'ЧЕРТЕЖ'})));
assert.ok(ids(library.search({query:'коррекция'})).includes('offsets'));
assert.ok(ids(library.search({query:'28,1 микрометр'})).includes('measurement'),'search combines all words');
assert.ok(ids(library.search({query:'Mitutoyo'})).includes('measurement'),'source names are searchable');
assert.equal(library.search({query:'неттакоготермина123'}).length,0);
assert.equal(library.search({category:'unknown'}).length,0);
assert.ok(library.search({category:'cutting'}).every(a=>a.category==='cutting'));
assert.deepEqual(library.search({filter:'bookmarks'}),[]);
let state=library.restore(null);state=library.toggle(state,'passes','read');state=library.toggle(state,'passes','bookmarks');state=library.toggle(state,'measurement','bookmarks');
assert.deepEqual(ids(library.search({filter:'read'},state)),['passes']);assert.deepEqual(ids(library.search({filter:'bookmarks',query:'припуск'},state)).sort(),['passes']);
const before=structuredClone(state),next=library.toggle(state,'passes','read');assert.deepEqual(state,before);assert.equal(next.read.includes('passes'),false);assert.equal(next.bookmarks.includes('passes'),true);
assert.deepEqual(library.restore(JSON.parse(JSON.stringify(state))),state);
assert.deepEqual(library.restore({version:1,selected:'bad',read:['passes','passes','bad',null,0],bookmarks:'bad'}),{version:1,selected:'start',read:['passes'],bookmarks:[]});
assert.equal(library.restore({version:99,read:['passes'],bookmarks:['passes']}).read.length,0);
assert.throws(()=>library.toggle(state,'unknown','read'));assert.throws(()=>library.toggle(state,'passes','score'));
// Expanding the course keeps the eight original lesson answers without granting new ones.
const originalIds=['machine','safety','diameter','axes','tolerance','tool','feed','control'];
const oldAnswers=Object.fromEntries(course.lessons.filter(l=>originalIds.includes(l.id)).map(l=>[l.id,l.choices?l.answer:l.value]));const migrated=course.restore({version:1,answers:oldAnswers});assert.deepEqual(migrated.answers,oldAnswers);assert.equal(Object.keys(migrated.answers).length,8);
assert.equal(library.paths.length,3);for(const path of library.paths){assert(path.description);assert.equal(new Set(path.articles).size,path.articles.length);assert(path.articles.every(id=>articleIds.has(id)));assert.deepEqual(library.pathArticles(path.id).map(a=>a.id),path.articles);for(const [at,id]of path.articles.entries())assert.deepEqual(library.relatedArticles(library.articles.find(a=>a.id===id),path.id).map(a=>a.id),path.articles.slice(at+1,at+3));}
assert.deepEqual(library.pathArticles('missing'),[]);
assert(library.search({query:'одна сотая'}).some(a=>a.id==='number-basics'));
assert(library.search({query:'мм/об S600'}).some(a=>a.id==='program-words'));
assert.equal(library.articles.slice(25).flatMap(a=>a.checks).length,20);
const progress=require('../progress-model.js'),archive=progress.empty();archive.sections.library.current=library.toggle(library.toggle(state,'number-basics','read'),'program-words','bookmarks');
assert.deepEqual(progress.parse(progress.stringify(archive)).sections.library.current,archive.sections.library.current);assert.equal(progress.summary(archive).progress.done,0,'Reading and self-checks do not award course credit');
assert(library.restore(state).read.includes('passes'),'Historical reading marks remain valid');
console.log('Library checks passed: 35 articles, 67 terms, 3 ordered paths, 20 self-checks, diagrams/tables/export, search, reading marks and migration.');
