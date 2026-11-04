(function(root) {
  'use strict';

  const GROUPS = {
    independentProject:{id:'independentProject',name:'Самостоятельное итоговое изделие'},
    metrology:{id:'metrology',name:'Чертёж, прибор и решение'},
    turningDeep: { id: 'turningDeep', name: 'Наружное точение · план и контроль' },
    meet: { id: 'meet', name: 'Знакомство со станком' },
    size: { id: 'size', name: 'Размер и координаты' },
    cut: { id: 'cut', name: 'Первый проход' },
    measure: { id: 'measure', name: 'Контроль детали' },
    cycle: { id: 'cycle', name: 'Полный цикл' },
    transfer: { id: 'transfer', name: 'Самостоятельная работа' },
    gcode: { id: 'gcode', name: 'Читаем G-код' },
    codeFinal: { id: 'codeFinal', name: 'Программа самостоятельно' },
    operations:{id:'operations',name:'Токарные операции'},projects:{id:'projects',name:'Изделия по чертежам'},milling:{id:'milling',name:'Фрезерный станок XYZ'},diagnostics:{id:'diagnostics',name:'Диагностика и исправление'}
  };

  const STEPS = [
    { id: 'machine', target: 'machine', group: 'meet', title: 'Что делает станок' },
    { id: 'safety', target: 'safety', group: 'meet', title: 'Когда можно измерять' },
    { id: 'tool', target: 'tool', group: 'meet', title: 'Выбираем резец' },
    { id: 'diameter', target: 'diameter', group: 'size', title: 'Что означает диаметр' },
    { id: 'axes', target: 'axes', group: 'size', title: 'Как задать X и Z' },
    { id: 'first-cut', target: 'diameter', stage: 0, group: 'cut', title: 'Выполняем первый проход' },
    { id: 'control', target: 'control', group: 'measure', title: 'Зачем нужен замер' },
    { id: 'tolerance', target: 'tolerance', group: 'measure', title: 'Сравниваем с допуском' },
    { id: 'first-control', target: 'diameter', stage: 3, group: 'measure', title: 'Измеряем и подтверждаем' },
    { id: 'setup', target: 'setup', group: 'cycle', title: 'Подготовка станка' },
    { id: 'rough-finish', target: 'rough-finish', group: 'cycle', title: 'Черновой и чистовой проходы' },
    { id: 'feed', target: 'feed', group: 'cycle', title: 'Подача и обороты' },
    { id: 'pass-count', target: 'pass-count', group: 'cycle', title: 'Распределяем припуск' },
    { id: 'full-cycle', target: 'cycle-0', kind: 'training', group: 'cycle', title: 'Полный цикл с разбором' },
    { id: 'self-cycle', target: 'cycle-3', kind: 'training', group: 'transfer', title: 'Другой чертёж без помощи' },
    { id: 'code-coordinates', target: 'coordinates', kind: 'gcode', group: 'gcode', title: 'Координаты в строке программы' },
    { id: 'code-motion', target: 'motion', kind: 'gcode', group: 'gcode', title: 'Подход и рабочий ход' },
    { id: 'code-modal', target: 'modal', kind: 'gcode', group: 'gcode', title: 'Что сохраняется между строками' },
    { id: 'code-feed', target: 'feed', kind: 'gcode', group: 'gcode', title: 'Подача в программе' },
    { id: 'code-spindle', target: 'spindle', kind: 'gcode', group: 'gcode', title: 'Команды запуска и остановки' },
    { id: 'code-retract', target: 'retract', kind: 'gcode', group: 'gcode', title: 'Отвод по X, затем по Z' },
    { id: 'self-code', target: 'transfer-a', kind: 'gcode', group: 'codeFinal', title: 'Программа для другого чертежа' }
  ].map(step => ({ ...step, kind: step.kind || (step.stage === undefined ? 'lesson' : 'practice') }));

  const before=(id,step)=>STEPS.splice(STEPS.findIndex(s=>s.id===id),0,step);
  STEPS.unshift({"id":"practice-firstSession","target":"firstSession","title":"Первое знакомство · действия с нуля","group":"meet","kind":"coursePractice"});
  const metrologyTasks=typeof module==='object'&&module.exports?require('./metrology-course-model.js'):root.CNCMetrologyCourse;
  for(const task of metrologyTasks.tasks)before('setup',{id:'metrology-'+task.id,target:'metrologyCourse',title:task.title,group:'metrology',kind:'coursePractice',subtask:task.id});
  before('control',{"id":"practice-drawingSession","target":"drawingSession","title":"Деталь, прибор и измерение","group":"measure","kind":"coursePractice"});
  before('first-cut',{"id":"practice-firstProcess","target":"firstProcess","title":"Координаты и первый процесс","group":"cut","kind":"coursePractice"});
  before('self-code',{"id":"practice-programSetup","target":"programSetup","title":"Программа и наладка · полный цикл","group":"gcode","kind":"coursePractice"});
  STEPS.push({"id":"operation-face-first","target":"operationCourse","title":"Первый торец","group":"operations","kind":"coursePractice","subtask":"face-first"});
  STEPS.push({"id":"operation-face-two","target":"operationCourse","title":"Торец в два прохода","group":"operations","kind":"coursePractice","subtask":"face-two"});
  STEPS.push({"id":"operation-groove-first","target":"operationCourse","title":"Кольцевая канавка","group":"operations","kind":"coursePractice","subtask":"groove-first"});
  STEPS.push({"id":"operation-taper","target":"operationCourse","title":"Конус вместо цилиндра","group":"operations","kind":"coursePractice","subtask":"taper"});
  STEPS.push({"id":"operation-grooves-project","target":"operationCourse","title":"Две канавки · самостоятельный маршрут","group":"operations","kind":"coursePractice","subtask":"grooves-project"});
  const turningTasks = typeof module === 'object' && module.exports ? require('./turning-tasks-model.js') : root.CNCTurningTasks;
  for (const task of turningTasks.tasks) STEPS.push({id:'operation-'+task.id,target:'operationCourse',title:task.title,group:'turningDeep',kind:'coursePractice',subtask:task.id});
  STEPS.push({"id":"project-RF5-SHAFT-01","target":"shaftProject","title":"Ступенчатый валик · базовый","group":"projects","kind":"coursePractice","subtask":"RF5-SHAFT-01"});
  STEPS.push({"id":"project-RF5-SHAFT-02","target":"shaftProject","title":"Короткий валик","group":"projects","kind":"coursePractice","subtask":"RF5-SHAFT-02"});
  STEPS.push({"id":"project-RF5-SHAFT-03","target":"shaftProject","title":"Валик с длинной шейкой","group":"projects","kind":"coursePractice","subtask":"RF5-SHAFT-03"});
  STEPS.push({"id":"project-RF5-SHAFT-04","target":"shaftProject","title":"Валик с другим припуском","group":"projects","kind":"coursePractice","subtask":"RF5-SHAFT-04"});
  STEPS.push({"id":"milling-xyz-air","target":"millingCourse","title":"Три оси · движения в воздухе","group":"milling","kind":"coursePractice","subtask":"xyz-air"});
  STEPS.push({"id":"milling-clamp-crossing","target":"millingCourse","title":"Пересечение с креплением","group":"milling","kind":"coursePractice","subtask":"clamp-crossing"});
  STEPS.push({"id":"milling-rapid-stock","target":"millingCourse","title":"Быстрый ход в материал · первый паз","group":"milling","kind":"coursePractice","subtask":"rapid-stock"});
  STEPS.push({"id":"milling-depth-layers","target":"millingCourse","title":"Глубокий паз · слои и исправление","group":"milling","kind":"coursePractice","subtask":"depth-layers"});
  STEPS.push({"id":"milling-holder-clearance","target":"millingCourse","title":"Фреза проходит · державка задевает","group":"milling","kind":"coursePractice","subtask":"holder-clearance"});
  STEPS.push({"id":"milling-machine-column","target":"millingCourse","title":"Обход корпуса станка","group":"milling","kind":"coursePractice","subtask":"machine-column"});
  STEPS.push({"id":"diagnostic-diag-rapid","target":"diagnosticCourse","title":"Почему быстрый ход опасен","group":"diagnostics","kind":"coursePractice","subtask":"diag-rapid"});
  STEPS.push({"id":"diagnostic-diag-tool","target":"diagnosticCourse","title":"Верная программа · неверный резец","group":"diagnostics","kind":"coursePractice","subtask":"diag-tool"});
  STEPS.push({"id":"diagnostic-diag-blade","target":"diagnosticCourse","title":"Канавка: пластина остаётся в металле","group":"diagnostics","kind":"coursePractice","subtask":"diag-blade"});
  STEPS.push({"id":"diagnostic-diag-face-depth","target":"diagnosticCourse","title":"Почему нельзя снять торец сразу","group":"diagnostics","kind":"coursePractice","subtask":"diag-face-depth"});
  STEPS.push({"id":"diagnostic-diag-zero","target":"diagnosticCourse","title":"Причина глубже сообщения об ошибке","group":"diagnostics","kind":"coursePractice","subtask":"diag-zero"});
  STEPS.push({"id":"diagnostic-diag-fixture","target":"diagnosticCourse","title":"Безопасные концы · опасная середина","group":"diagnostics","kind":"coursePractice","subtask":"diag-fixture"});
  STEPS.push({"id":"diagnostic-diag-holder","target":"diagnosticCourse","title":"Фреза свободна · проверяем державку","group":"diagnostics","kind":"coursePractice","subtask":"diag-holder"});
  STEPS.push({"id":"diagnostic-diag-body","target":"diagnosticCourse","title":"Пределы осей не заменяют проверку корпуса","group":"diagnostics","kind":"coursePractice","subtask":"diag-body"});
  STEPS.push({"id":"diagnostic-diag-travel","target":"diagnosticCourse","title":"Опечатка в конечной координате","group":"diagnostics","kind":"coursePractice","subtask":"diag-travel"});
  STEPS.push({"id":"diagnostic-diag-spindle","target":"diagnosticCourse","title":"Рабочая подача без вращения","group":"diagnostics","kind":"coursePractice","subtask":"diag-spindle"});
  STEPS.push({id:'project-RF5-SHAFT-05',target:'shaftProject',title:'Самостоятельное изделие · без шаблона',group:'independentProject',kind:'coursePractice',subtask:'RF5-SHAFT-05'});

  const STEP_BY_ID = Object.fromEntries(STEPS.map(s => [s.id, s]));

  function isISODate(str) {
    if (typeof str !== 'string') return false;
    const t = Date.parse(str);
    return Number.isFinite(t);
  }

  function restore(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.version !== 1) {
      return { version: 1, active: false, selected: 'machine' };
    }
    const active = raw.active === true;
    const selected = (typeof raw.selected === 'string' && Object.hasOwn(STEP_BY_ID, raw.selected)) ? raw.selected : 'machine';
    return { version: 1, active, selected };
  }

  function get(id) {
    return typeof id === 'string' && Object.hasOwn(STEP_BY_ID, id) ? STEP_BY_ID[id] : null;
  }

  function status(evidence) {
    const ev = evidence || {};
    const lessons = Array.isArray(ev.lessons) ? [...new Set(ev.lessons.filter(id => typeof id === 'string'))] : [];
    const basic = ev.basic || {};
    const records = ev.records || {};
    const diameterRec = records.diameter || {};

    const lessonSet = new Set(lessons);

    // Determine practice completions
    let firstCutDone = false;
    let firstControlDone = false;

    // Historical record check
    if (
      diameterRec.controlVersion === 1 &&
      typeof diameterRec.assisted === 'boolean' &&
      isISODate(diameterRec.at)
    ) {
      firstCutDone = true;
      firstControlDone = true;
    } else {
      // Current session check
      if (basic.task === 'diameter' && basic.finished === true) {
        firstCutDone = true;
        if (basic.controlled === true) {
          firstControlDone = true;
        }
      }
    }

    const doneSteps = new Set();
    // Lessons
    for (const step of STEPS) {
      if (step.kind === 'lesson' && lessonSet.has(step.target)) {
        doneSteps.add(step.id);
      }
    }
    // Practices
    if (firstCutDone) doneSteps.add('first-cut');
    if (firstControlDone) doneSteps.add('first-control');
    if(ev.training?.guidedPassed===true)doneSteps.add('full-cycle');
    if(ev.training?.transferPassed===true)doneSteps.add('self-cycle');
    const codes=Array.isArray(ev.gcode?.core)?ev.gcode.core:[];
    for(const step of STEPS)if(step.kind==='gcode'&&step.id!=='self-code'&&codes.includes(step.target))doneSteps.add(step.id);
    if(ev.gcode?.final===true)doneSteps.add('self-code');

    for(const step of STEPS)if(step.kind==='coursePractice'&&(Array.isArray(ev.courseSteps)?ev.courseSteps:[]).includes(step.id))doneSteps.add(step.id);
    const items = STEPS.map(s => ({ ...s, done: doneSteps.has(s.id) }));
    const doneCount = items.filter(i => i.done).length;
    const total = STEPS.length;
    const nextStep = items.find(i => !i.done) || null;
    const complete = doneCount === total;

    // Group stats
    const groups = Object.values(GROUPS).map(g => {
      const groupSteps = STEPS.filter(s => s.group === g.id);
      const groupDone = groupSteps.filter(s => doneSteps.has(s.id)).length;
      return {
        ...g,
        done: groupDone,
        total: groupSteps.length,
        complete: groupDone === groupSteps.length
      };
    });

    return {
      items,
      done: doneCount,
      total,
      next: nextStep,
      complete,
      introComplete: items.filter(i=>['meet','size','cut','measure'].includes(i.group)).every(item=>item.done),
      cycleComplete: items.filter(i=>['meet','size','cut','measure','cycle','transfer'].includes(i.group)).every(item=>item.done),
      groups
    };
  }

  function next(evidence) {
    return status(evidence).next;
  }

  function following(id) {
    const idx = STEPS.findIndex(s => s.id === id);
    if (idx === -1 || idx >= STEPS.length - 1) return null;
    return STEPS[idx + 1];
  }

  function resume(saved, evidence) {
    const s = restore(saved);
    const st = status(evidence);
    if (st.complete) return null;
    if (!s.active) return st.next;

    const selectedStep = get(s.selected);
    if (!selectedStep) return null;

    // Check if selected step is incomplete and all previous are complete
    const idx = STEPS.findIndex(step => step.id === s.selected);
    if (idx === -1) return null;

    const prevSteps = STEPS.slice(0, idx);
    const prevDone = prevSteps.every(step => st.items.find(i => i.id === step.id)?.done);

    if (prevDone && !st.items.find(i => i.id === s.selected)?.done) {
      return selectedStep;
    }

    // Otherwise return first incomplete
    return st.next;
  }

  const CNCLearningPath = {
    steps: STEPS,
    groups: Object.values(GROUPS),
    get,
    restore,
    status,
    next,
    following,
    resume
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CNCLearningPath;
  } else {
    root.CNCLearningPath = CNCLearningPath;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
