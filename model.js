(function (root) {
  'use strict';
  const base = { stock: 32, target: 28, length: 45, tolerance: .1, maxDepth: 2, correction: 0 };
  const defaults = { x: 28, offset: 0, feed: .2, rpm: 800, tool: 'turning' };
  const tasks = [
    { ...base, id: 'diameter', title: 'Первый проход', goal: 'Получите диаметр 28 мм',
      description: 'Обточите заготовку Ø32 мм на участке длиной 45 мм до Ø28 мм за один учебный проход.',
      defaults: { ...defaults, x: 30 },
      hints: ['Сравните целевой размер с конечным X. Здесь X задаётся по диаметру.', 'Чтобы из Ø32 получить Ø28, снимите 2 мм на радиус. Коррекция в этом задании нулевая.', 'Установите X = 28 мм, коррекцию = 0 мм и запустите проход.'] },
    { ...base, id: 'offset', title: 'Коррекция инструмента', goal: 'Исправьте коррекцию X',
      description: 'В программе указан Ø28 мм. В таблице коррекций есть ошибка: восстановите нулевую коррекцию после калибровки.',
      defaults: { ...defaults, offset: -4 },
      hints: ['Сравните X в программе и диаметр траектории: что изменяет размер?', 'В модели диаметр траектории = X + коррекция. Отрицательная коррекция уменьшает размер.', 'Верните коррекцию X к 0 мм. Оставьте X = 28 мм.'] },
    { ...base, id: 'feed', title: 'Режим обработки', goal: 'Подберите учебный режим',
      description: 'Размер задан правильно. Установите подачу и обороты по условиям упражнения.',
      defaults: { ...defaults, feed: .45 },
      hints: ['Откройте условия упражнения и сравните допустимую подачу с текущей.', 'Подача измеряется в мм/об. Для этого задания допустимо 0,10–0,25 мм/об.', 'Попробуйте подачу 0,20 мм/об при 800 об/мин.'] }
  ];
  function evaluate(p, task = tasks[0]) {
    const errors = [];
    const invalid = detail => ({ valid: false, success: false, canAnimate: false,
      errors: [{ key: 'input', title: 'Проверьте поля', detail }], warnings: [], actual: null, finalDiameter: null, depth: null });
    if (!p || ['x', 'offset', 'feed', 'rpm'].some(k => typeof p[k] !== 'number' || !Number.isFinite(p[k])))
      return invalid('Введите числовые значения во все поля настройки.');
    if (p.x < 1 || p.x > 60 || p.offset < -10 || p.offset > 10 || p.feed < .01 || p.feed > 1 || p.rpm < 100 || p.rpm > 2000)
      return invalid('X: 1–60 мм; коррекция: −10…10 мм; подача: 0,01–1 мм/об; обороты: 100–2000 об/мин.');
    if (!['turning', 'drill'].includes(p.tool)) return invalid('Выберите инструмент из списка.');
    const actual = +(p.x + p.offset).toFixed(3);
    const depth = +Math.max(0, (task.stock - actual) / 2).toFixed(3);
    const finalDiameter = actual > 0 ? Math.min(task.stock, actual) : null;
    const add = (key, title, detail) => errors.push({ key, title, detail });
    if (p.tool !== 'turning') add('tool', 'Не подходит инструмент', 'Для наружного продольного точения нужен проходной резец.');
    if (actual <= 0) add('collision', 'Траектория пересекает ось', 'Проверьте сумму X и коррекции. Такая траектория блокирует учебную анимацию.');
    else if (actual < task.target - task.tolerance - 1e-9)
      add('diameter', 'Снято слишком много материала', `Диаметр траектории ${actual} мм меньше целевого Ø${task.target} ±${task.tolerance}. Увеличьте сумму X и коррекции.`);
    else if (actual > task.target + task.tolerance + 1e-9)
      add('diameter', actual >= task.stock ? 'Материал не снимается' : 'Остался припуск', `Нужен Ø${task.target} ±${task.tolerance} мм. При траектории вне заготовки её диаметр остаётся Ø${task.stock} мм.`);
    if (depth > task.maxDepth + 1e-9) add('depth', 'Превышена глубина прохода', `Разрешён съём до ${task.maxDepth} мм на радиус. Сейчас: ${depth} мм.`);
    if (p.feed < .1 || p.feed > .25) add('feed', 'Подача вне учебного диапазона', 'По условиям задания установите 0,10–0,25 мм/об.');
    if (p.rpm < 600 || p.rpm > 1000) add('rpm', 'Обороты вне учебного диапазона', 'По условиям задания установите 600–1000 об/мин.');
    if (p.offset !== task.correction) add('offset', 'Ошибка коррекции X', `По условию калибровка завершена: коррекция должна быть ${task.correction} мм. Не компенсируйте её изменением X.`);
    return { valid: true, success: errors.length === 0, errors, warnings: [], actual, finalDiameter,
      depth, minutes: task.length / (p.feed * p.rpm), canAnimate: actual > 0 && actual <= 60 && p.tool === 'turning' };
  }
  function mentor(p, question, checked, task = tasks[0]) {
    const q = String(question || '').toLowerCase(), r = evaluate(p, task);
    if (!r.valid) return r.errors[0].detail;
    if (/коррек|смещ|нул/.test(q)) return `Диаметр траектории = X + коррекция: ${p.x} + (${p.offset}) = ${r.actual} мм. Цель — Ø${task.target} мм. По условию калибровки коррекция должна быть ${task.correction} мм.`;
    if (/подач/.test(q)) return `Подача — перемещение за оборот шпинделя. Учебный диапазон: 0,10–0,25 мм/об. Сейчас: ${p.feed} мм/об. Расчёт времени резания: ${task.length} / (${p.feed} × ${p.rpm}), без учёта подхода и отвода.`;
    if (/оборот|скорост|шпиндел/.test(q)) return `Для упражнения допустимо 600–1000 об/мин; сейчас ${p.rpm}. Реальные режимы выбирают по технологической документации.`;
    if (/резец|инструмент/.test(q)) return 'Для наружного продольного точения выберите проходной резец. Сверло предназначено для другой операции.';
    if (/код|программ|g01|g00/.test(q)) return 'Четыре этапа: подход на безопасном расстоянии, установка диаметра, продольный проход и отвод. Подсветка связывает строку программы с движением резца. Код в демке иллюстративный.';
    if (/диаметр|размер|припуск|глубин/.test(q)) return `Цель — Ø${task.target} из Ø${task.stock} мм. Нужный съём на радиус: ${(task.stock-task.target)/2} мм. Диаметр траектории сейчас ${r.actual} мм; расчётный результат после прохода — ${r.finalDiameter === null ? 'пересечение оси' : 'Ø'+r.finalDiameter+' мм'}.`;
    if (/что|ошиб|помо|подсказ|почему|провер/.test(q) || !q.trim())
      return r.success ? 'Настройки соответствуют заданию. Выполните проход целиком или по шагам, чтобы закрепить результат.' : `${checked ? 'Обнаружено' : 'Проверьте'}: ${r.errors[0].title.toLowerCase()}. ${r.errors[0].detail}`;
    return 'Могу объяснить диаметр, коррекцию, подачу, обороты, инструмент и этапы программы. Для последовательной помощи нажмите «Подсказка по шагам».';
  }
  const phases = [
    { end: .15, title: 'Подход', detail: 'Резец подходит к началу обработки снаружи заготовки.', code: 4 },
    { end: .30, title: 'Установка X', detail: 'Резец занимает заданный диаметр перед торцом заготовки.', code: 5 },
    { end: .90, title: 'Продольный проход', detail: 'Инструмент движется вдоль оси Z и снимает припуск.', code: 6 },
    { end: 1, title: 'Отвод', detail: 'Инструмент отходит от обработанной поверхности.', code: 7 }
  ];
  function phaseAt(progress) { const i = phases.findIndex(p => progress < p.end - 1e-9); return i < 0 ? 3 : i; }
  function createExam(variant = 0, startedAt = new Date().toISOString()) {
    if (!Number.isInteger(variant) || variant < 0 || variant > 2) throw new Error('Invalid variant');
    return { version: 1, variant, startedAt, answers: [], index: 0, awaitingNext: false };
  }
  function examTask(exam, index = exam.index) {
    if (!Number.isInteger(index) || index < 0 || index > 2) throw new Error('Invalid task index');
    const original = tasks[index], target = [26, 30, 24][(index + exam.variant) % 3];
    const length = [30, 40, 50][(index + exam.variant) % 3];
    return { ...original, stock: target + 4, target, length,
      goal: `Задание ${index + 1}: получите Ø${target} мм`,
      description: `Обработайте Ø${target + 4} до Ø${target} ±0,1 мм на длине ${length} мм. Калибровка завершена: коррекция должна быть 0 мм. Соблюдайте учебные диапазоны подачи и оборотов.`,
      defaults: { ...original.defaults, x: target + (index === 0 ? 2 : 0) }, hints: [] };
  }
  function submitExam(exam, settings) {
    if (!exam || exam.awaitingNext || exam.answers.length >= 3) throw new Error('Ответ уже принят');
    const task = examTask(exam), result = evaluate(settings, task);
    if (!result.valid) throw new Error(result.errors[0].detail);
    return { ...exam, awaitingNext: true, answers: [...exam.answers, { index: exam.index, settings: { ...settings } }] };
  }
  function advanceExam(exam) {
    if (!exam.awaitingNext || exam.index >= 2) throw new Error('Следующее задание недоступно');
    return { ...exam, index: exam.index + 1, awaitingNext: false };
  }
  function gradeExam(exam) {
    if (exam.answers.length !== 3) throw new Error('Экзамен ещё не завершён');
    const answers = exam.answers.map((a, index) => ({ task: examTask(exam,index), settings: a.settings, result: evaluate(a.settings,examTask(exam,index)) }));
    const correct = answers.filter(a=>a.result.success).length;
    return { correct, total: 3, percent: Math.round(correct/3*100), answers };
  }
  function restoreExam(value) {
    if (!value || value.version !== 1 || !Number.isInteger(value.variant) || value.variant < 0 || value.variant > 2 ||
      typeof value.startedAt !== 'string' || !Number.isFinite(Date.parse(value.startedAt)) || !Array.isArray(value.answers) || value.answers.length > 3 ||
      !Number.isInteger(value.index) || value.index < 0 || value.index > 2 || typeof value.awaitingNext !== 'boolean') return null;
    if (value.answers.length !== value.index + (value.awaitingNext ? 1 : 0)) return null;
    if (value.answers.some((a,i)=>!a || a.index!==i || !evaluate(a.settings,examTask(value,i)).valid)) return null;
    return { version:1, variant:value.variant, startedAt:value.startedAt, answers:value.answers.map(a=>({index:a.index,settings:{...a.settings}})),index:value.index,awaitingNext:value.awaitingNext };
  }
  root.CNCModel = { tasks, evaluate, mentor, phases, phaseAt, createExam, examTask, submitExam, advanceExam, gradeExam, restoreExam };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.CNCModel;
})(typeof window !== 'undefined' ? window : globalThis);
