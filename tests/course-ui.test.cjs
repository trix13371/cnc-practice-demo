'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const course=require('../course-model.js'),math=require('../training-math.js'),discovery=require('../course-discovery.js');
const {Element}=require('./helpers/dom.cjs');
const entries=new Map(),storage={getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v)};
const window={CNCCourseView:require('../course-view-model.js'),CNCCourse:course,CNCTrainingMath:math,CNCLibrary:{lessonArticles:()=>[]},dispatchEvent(){}};
const context=vm.createContext({window,localStorage:storage,document:{createElement:t=>new Element(t)},Event,FormData:class{constructor(form){this.form=form;}get(){return this.form.rawAnswer;}}});
for(const name of ['discovery-practice-model.js','course-discovery.js','discovery-practice-ui.js','course-route-ui.js','course-ui.js'])vm.runInContext(fs.readFileSync(require.resolve('../'+name),'utf8'),context,{filename:name});
const parent=new Element('main');parent.append(new Element('footer'));const root=window.CNCCourseUI.mount(parent,()=>{});
const button=text=>{const b=root.querySelectorAll('button').find(n=>n.textContent===text);assert(b,'Missing button '+text);return b;};
const answers=()=>JSON.parse(entries.get('cnc-foundations-v1')||'{"answers":{}}').answers;
assert(root.querySelector('h1'),'Every course view needs a native main heading');
window.CNCCourseUI.render(true);
assert(root.querySelector('h1').focused,'Keyboard focus must enter the new course view');
assert(root.querySelector('.lesson-goal'));assert(root.querySelector('.lesson-visual'));assert.equal(Object.keys(answers()).length,0);
button('Теперь попробуем на схеме').click();assert.equal(button('Перейти к самостоятельной проверке').disabled,true);
const hit=name=>{const b=root.querySelectorAll('button').find(n=>n.attributes['aria-label']===name);assert(b,'Missing scene target '+name);return b;};
hit('Область A: левый узел станка').click();button('Проверить выбор').click();assert.equal(button('Перейти к самостоятельной проверке').disabled,true);assert.match(root.querySelector('.scene-feedback').textContent,/патрона/);
hit('Область B: длинный цилиндр в центре').click();button('Проверить выбор').click();assert.equal(button('Перейти к самостоятельной проверке').disabled,true);button('Следующее действие').click();
window.CNCCourseUI.render();assert.equal(root.querySelector('.scene-title').textContent,'Найдите патрон','An incomplete action survives controller rendering');
hit('Область A: левый узел станка').click();button('Проверить выбор').click();button('Следующее действие').click();hit('Область C: инструмент над цилиндром').click();button('Проверить выбор').click();
assert.equal(button('Перейти к самостоятельной проверке').disabled,false);assert.equal(Object.keys(answers()).length,0,'Exploration is not a correct quiz answer');
button('Перейти к самостоятельной проверке').click();root.querySelector('form').submit('1');
assert.equal(Object.keys(answers()).length,0);assert.equal(button('Следующий урок').disabled,true);
let feedback=root.querySelector('.course-feedback');assert.match(feedback.querySelector('p').textContent,/вращается материал/);assert.equal(feedback.querySelector('.lesson-solution').open,false,'A full solution must remain optional');
button('Вернуться к наглядной пробе').click();assert.equal(Object.keys(answers()).length,0);button('Перейти к самостоятельной проверке').click();root.querySelector('form').submit('0');
assert.equal(answers().machine,0);assert.equal(button('Следующий урок').disabled,false);assert(root.querySelector('.lesson-application'));
root.querySelector('form').submit('1');assert.equal(answers().machine,0,'A wrong review answer must preserve historical completion');assert.match(root.querySelector('.course-feedback').textContent,/прежний зачёт сохранён/);
window.CNCCourseUI.openLesson('diameter');button('Теперь попробуем на схеме').click();
hit('Отрезок A: между двумя краями через центр').click();button('Проверить выбор').click();button('Следующее действие').click();
const number=value=>{const input=root.querySelector('.scene-number-form').querySelector('input');input.value=value;input.events.input();};
number('19');button('Проверить расчёт').click();assert.match(root.querySelector('.scene-feedback').textContent,/одну сторону/);assert.equal(button('Перейти к самостоятельной проверке').disabled,true);
number('18');button('Проверить расчёт').click();button('Следующее действие').click();number('2,0');button('Проверить расчёт').click();button('Перейти к самостоятельной проверке').click();
root.querySelector('form').submit('4');assert.equal(answers().diameter,undefined);assert.match(root.querySelector('.course-feedback').querySelector('p').textContent,/разница диаметров/);assert.equal(button('Следующий урок').disabled,true);
root.querySelector('form').submit('2');assert.equal(answers().diameter,2);assert.equal(answers().machine,0);
for(const id of course.discoveryIds){assert(discovery.guidance[id]?.goal);assert(discovery.previewData[id]?.art);assert(discovery.previewData[id].caption.length>20);}
assert.match(discovery.mistake('axes',13).reason,/радиус/);assert.match(discovery.mistake('safety',2).reason,/продолжать вращаться/);assert.match(discovery.mistake('tolerance',0).reason,/нижней границы/);
console.log('Lesson UI: visual goals, exploration gates, targeted feedback, optional solutions, numeric retry, and preserved historical results passed.');

// A route widget reports a scalar introductory answer draft; keep it across reloads.
let captured;
window.CNCStartSessionUI={create:options=>{captured=options;return new Element('section');}};
window.CNCWorkshop={openLesson:id=>window.CNCCourseUI.openLesson(id),home(){}};
const intro=course.startSession,complete=require('./start-session-fixtures.cjs').complete();let draftState=intro.create();
for(const event of complete.events){if(draftState.step===6)break;draftState=intro.transition(draftState,event);}
assert.equal(draftState.step,6);
window.CNCCourseUI.pathSnapshot().firstSession=intro.snapshot(draftState);
window.CNCCourseUI.openRouteStep(require('../learning-path-model.js').get('practice-firstSession'));
captured.onDraft('0,2');
assert.equal(captured.headingTag,'h1','Route widgets retain native heading semantics on their own rerenders');
assert.equal(window.CNCCourseUI.pathSnapshot().firstSessionDraft.value,'0,2');
assert.equal(JSON.parse(entries.get('cnc-course-path-v1')).firstSessionDraft.value,'0,2');
console.log('Course route: introductory scalar draft survives the guided widget storage boundary.');

// Completed foundations must not redirect a restored free practice to lesson one.
window.CNCMillingCourseUI={create:options=>{captured=options;return new Element('section');}};
entries.set('cnc-foundations-v1',JSON.stringify(require('./progress-fixtures.cjs').full().sections.course.current));
const savedPath=window.CNCCourseUI.pathSnapshot();savedPath.selected='verification';savedPath.activePractice='millingCourse';
entries.set('cnc-course-path-v1',JSON.stringify(savedPath));
vm.runInContext(fs.readFileSync(require.resolve('../course-ui.js'),'utf8'),context);
window.CNCCourseUI.mount(parent,()=>{});
assert.equal(window.CNCCourseUI.currentId(),'verification');
captured.onChange(course.millingCourse.snapshot(course.millingCourse.create()));
assert.equal(JSON.parse(entries.get('cnc-course-path-v1')).selected,'verification');
window.CNCCourseUI.openLesson('machine');
assert.equal(window.CNCCourseUI.pathSnapshot().activePractice,'course');
console.log('Course view: completed foundations retain the selected free practice across reload and edits.');

// A new metrology route must return to its own widget after reload.
window.CNCLearningPath=require('../learning-path-model.js');
window.CNCMetrologyCourseUI={create:options=>{captured=options;return new Element('section');}};
let metrology=course.metrologyCourse.transition(course.metrologyCourse.create(),{type:'section',value:'solid'});
const metroPath=course.restorePath(null);metroPath.selected='control';metroPath.activePractice='metrologyCourse';metroPath.metrologyCourse=course.metrologyCourse.snapshot(metrology);
entries.set('cnc-course-path-v1',JSON.stringify(metroPath));
vm.runInContext(fs.readFileSync(require.resolve('../course-ui.js'),'utf8'),context);
window.CNCCourseUI.mount(parent,()=>{});
assert.equal(captured.routeMode,true);
assert.equal(course.metrologyCourse.restore(captured.saved)?.section,'solid');
metrology=course.metrologyCourse.transition(metrology,{type:'surface',id:'A'});
captured.onChange(course.metrologyCourse.snapshot(metrology));
assert.equal(JSON.parse(entries.get('cnc-course-path-v1')).activePractice,'metrologyCourse');
assert.equal(JSON.parse(entries.get('cnc-course-path-v1')).metrologyCourse.events.at(-1).id,'A');
