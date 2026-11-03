/*
 * real-machine-model.js — учебная детерминированная модель двухосевого токарного
 * станка с ЧПУ (Fanuc-подобное подмножество G-кода).
 *
 * ЭТО НЕ КОНТРОЛЛЕР РЕАЛЬНОГО СТАНКА. Модель предназначена для обучения:
 * никакие вызовы не управляют оборудованием, вся физика — аналитическая
 * и воспроизводимая (чистые функции, без ввода-вывода и зависимостей).
 *
 * Ключевые принципы:
 *  - Персистентная работа (work) хранит только {version:2,name,stock,events,cursor}.
 *    Всё производное состояние восстанавливается проигрыванием журнала.
 *  - Кадры атомарны: ошибка в кадре откатывает его целиком, предыдущие кадры сохранены.
 *  - Координаты: машина Z=100 — торец заготовки (true blank front).
 *      фактическая вершина = оси + trueGeometry(инструмента) - (0, 100)
 *      рабочая (WORK)      = оси + storedGeometry + wear - G54
 *      команда WORK P     => оси = P + G54 - storedGeometry - wear
 *  - X везде в ДИАМЕТРАХ (принятая в этой учебной установке настройка).
 *  - Показания измерений квантуются в целые микрометры, половина — вверх (для положительных).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CNCRealMachine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';
const stockShapes=typeof module==='object'&&module.exports?require('./stock-shape-model.js'):CNCStockShape;

/* ===== Константы ===== */
const radialOps=typeof module==='object'&&module.exports?require('./radial-ops-model.js'):CNCRadialOps;
const MAX_EVENTS = 240;
const MAX_SOURCE = 4000;
const MAX_LINES = 80;
const MAX_WORK_BYTES = 65536;
const MAX_SEGMENTS = 256;
const MAX_PATH = 200;
const EPS = 1e-9;

const TOOLS = [
  { id: 1, code: 'T0101', title: 'T0101 · Проходной',
    trueGeometry: { x: 1.2, z: 2 }, radius: 0.8, maxDepth: 2, feedRange: [0.05, 0.3] },
  { id: 2, code: 'T0202', title: 'T0202 · Чистовой',
    trueGeometry: { x: -0.8, z: 1 }, radius: 0.4, maxDepth: 0.5, feedRange: [0.03, 0.15] },
  {id:3,code:'T0303',title:'T0303 · Торцевой',trueGeometry:{x:.4,z:1.5},radius:.4,maxDepth:1,feedRange:[.03,.2]},
  {id:4,code:'T0404',title:'T0404 · Канавочный 2 мм',trueGeometry:{x:-.4,z:.5},radius:.1,width:2,maxDepth:2,feedRange:[.02,.12]}
];

const LIMITS = {
  stockDiameter: { min: 5, max: 80 },
  stockLength: { min: 10, max: 150 },
  grip: { min: 10, max: 50 },
  rpmMax: 2500,
  g96SpeedMax: 500,
  rapidRate: 3000,            // мм/мин, учебная константа холостых ходов
  axisX: { min: 1, max: 120 },// фактическая вершина, диаметры
  travelZmargin: 5,
  frontZMax: 30,
  jogDelta: { min: 0.001, max: 20 },
  offset: { min: -10, max: 10 },
  wear: { min: -1, max: 1 },
  workOffsetZ: { min: 90, max: 110 },
  overrides: { feed: { min: 10, max: 150 }, rapid: { min: 5, max: 100 }, spindle: { min: 50, max: 120 } },
  manualRpm: { min: 100, max: 2500 },
  clearance: 0.2,             // зазор по диаметру при обходе по воздуху
  chuckClearance: 30,         // консервативная зона патрона: X >= D+30 при Z <= -L+1
  maxSegments: MAX_SEGMENTS,
  pathPoints: MAX_PATH
};

const DIALECT = {
  title: 'Учебный токарный станок с ЧПУ · 2 оси · Fanuc-подобное подмножество',
  note: 'Учебная модель, не контроллер станка. Все вычисления детерминированы.',
  supported: {
    G: [0, 1, 18, 21, 40, 50, 54, 96, 97, 98, 99],
    M: [0, 3, 5, 8, 9, 30],
    T: ['T0101 — проходной','T0202 — чистовой','T0303 — торцевой, до 1 мм по Z за проход','T0404 — канавочный, ширина 2 мм, до 2 мм на радиус за проход'],
    axes: ['X — в диаметрах', 'Z — вдоль оси, ноль G54 по умолчанию на торце (машина Z=100)'],
    coords: 'Только абсолютные координаты; кадр — строка; комментарии в (...) и один ; в конце строки'
  },
  unsupported: [
    'G2/G3 (дуги), циклы G7x/G8x, G20 (дюймы), G90/G91, G17, G55–G59, G94',
    'G41/G42 — коррекция на радиус резца НЕ моделируется и НЕ поддерживается: ' +
      'радиус инструмента носит информационный характер, контур рассчитывается по вершине резца',
    'Переменные, макросы, выражения (#, =, *), U/W/Y, резьба',
    'Отрезка, внутренние и торцевые канавки, боковое/диагональное резание канавочным инструментом не поддерживаются',
    'Расточка и сверление не поддерживаются: отверстие трубы задано исходной формой и не изменяется; минимальная стенка 1 мм — учебное ограничение.'
  ],
  formulas: {
    volume: 'Объём участка (конус/цилиндр): V = pi/12 · l · (D1² + D1·D2 + D2²); ' +
            'срез = V(профиля до) − V(после), мм³',
    time: 't = hypot(dZ, dX/2) / скорость · 60; G99: F(мм/об)·об/мин; G98: F(мм/мин); ' +
          'G00: rapidRate · перекрытие',
    rpmG96: 'n = min(cap, 1000·S/(pi·max(D,1))) · перекрытие шпинделя, не выше cap и 2500; ' +
            'G96 требует явного лимита G50 S',
    rpmG97: 'n = S · перекрытие, не выше speedLimit и 2500',
    reading: 'Квантование в целые микрометры, округление половины вверх (положительные значения)'
  },
  limitations: [
    'Референс устанавливает учебный признак готовности осей; движение к аппаратным датчикам нуля не рассчитывается.',
    'Ручная привязка требует касания с допуском 0.005 мм и записи обеих осей X/Z; координата плоскости касания Z должна быть заранее известна.',
    'При заполнении журнала работа автоматически останавливается с JOURNAL_FULL; для продолжения создайте другую работу.',
    'Кадр атомарен: ошибка откатывает кадр целиком; успешно выполненные кадры остаются.',
    'HOLD останавливает оси на границе кадра; шпиндель и охлаждение продолжают работать.',
    'Время резания при G96 считается по среднему диаметру участка (midpoint X) — ' +
      'точное интегрирование оборотов не выполняется и не обещается.',
    'Положительный износ (wearX>0) уменьшает фактический вылет в этой модели; знак условен.',
    'Столкновения проверяются аналитически на линейном профиле; силы, упругие деформации ' +
      'и поломка инструмента не моделируются.',
    'Зазор при обходе по воздуху вдоль поверхности — 0.2 мм на диаметр; строго радиальный ' +
      'выход с поверхности разрешён, выход из утопленного положения — нет.',
    'Парсер отклоняет целый кадр; синтаксические ошибки при load не включают аварию станка.',
    'Повторный прогон не восстанавливает материал: уже срезанное остаётся срезанным.'
  ]
};

/* ===== Утилиты ===== */
function r3(v) { return Number(v.toFixed(3)); }
const sourceControls=/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/;
function isNum(v) { return typeof v === 'number' && isFinite(v); }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function umm(v) { return Math.floor(v * 1000 + 0.5); } // целые мкм, половина вверх (положительные)
function err(code, message, latch) { return { code: code, message: message, latch: !!latch }; }

function utf8Len(str) {
  let n = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c >= 0xD800 && c <= 0xDBFF && i + 1 < str.length) {
      const d = str.charCodeAt(i + 1);
      if (d >= 0xDC00 && d <= 0xDFFF) { n += 4; i++; continue; }
    }
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : 3;
  }
  return n;
}

function validName(name) {
  if (typeof name !== 'string') return null;
  const s = name.replace(/^[\s\u00A0\u3000]+|[\s\u00A0\u3000]+$/g, '');
  if (!s.length) return null;
  const cps = Array.from(s);
  if (cps.length > 60) return null;
  for (const ch of cps) {
    const c = ch.codePointAt(0);
    if(c<0x20||(c>=0x7f&&c<=0x9f)||(c>=0x200b&&c<=0x200f)||c===0xfeff)return null;               // управляющие
    if (c === 0x200E || c === 0x200F || c === 0x061C) return null; // bidi
    if (c >= 0x202A && c <= 0x202E) return null;
    if (c >= 0x2066 && c <= 0x2069) return null;
  }
  return s;
}

/* stock: точный набор {diameter,length,grip}; при create — недостающие берутся из умолчаний */
function create(stock, strict) {
  const def = { diameter: 32, length: 60, grip: 15 };
  if (stock === undefined || stock === null) return strict?null:clone(def);
  if (typeof stock !== 'object' || Array.isArray(stock)) return null;
  const keys = Object.keys(stock);
  if (strict) {
    for (const k of ['diameter', 'length', 'grip']) if (!Object.hasOwn(stock,k)) return null;
  } else {
    for (const k of keys) if (['diameter', 'length', 'grip','shape','stepDiameter','stepLength','bore'].indexOf(k) < 0) return null;
  }
  if(keys.some(k=>!['diameter','length','grip','shape','stepDiameter','stepLength','bore'].includes(k)))return null;
  const out = {};
  const ranges = { diameter: LIMITS.stockDiameter, length: LIMITS.stockLength, grip: LIMITS.grip };
  for (const k of ['diameter', 'length', 'grip']) {
    let v = stock[k] === undefined ? def[k] : stock[k];
    if (!isNum(v)) return null;
    v = r3(v);
    if (v < ranges[k].min - EPS || v > ranges[k].max + EPS) return null;
    out[k] = v;
  }
  const shape=stockShapes.normalizeShape(stock,out.diameter,out.length);return shape?Object.assign(out,shape):null;
}

/* ===== Начальное состояние ===== */
function initState(stock) {
  const s = clone(stock);
  return {
    stock: s,
    referenced: false, clamped: false, doorClosed: false, estop: false, alarm: null,
    mode: 'JOG', tool: 0,
    offsets: {
      '1': { x: 0, z: 0, wearX: 0, wearZ: 0, calibrated: false, measuredX:false, measuredZ:false },
      '2': { x: 0, z: 0, wearX: 0, wearZ: 0, calibrated: false, measuredX:false, measuredZ:false },
      '3':{x:0,z:0,wearX:0,wearZ:0,calibrated:false,measuredX:false,measuredZ:false},
      '4':{x:0,z:0,wearX:0,wearZ:0,calibrated:false,measuredX:false,measuredZ:false}
    },
    workOffset: { x: 0, z: 100, confirmed: false },
    axes: { x: r3(s.diameter + 12), z: 112 },      // координаты салазок
    position: { x: r3(s.diameter + 12), z: 12 },   // фактическая вершина (без инструмента geo=0)
    motion: 0, feed: null, feedMode: 99, speedMode: 97,
    speed: 0, speedLimit: 1200, explicitSpeedLimit: false,
    coolant: false, spindle: false,
    overrides: { feed: 100, rapid: 100, spindle: 100 },
    program: { source: '', blocks: [], index: 0, status: 'empty' },
    profile: stockShapes.profile(s),
    cuts: [], readings: [], journal: [], path: []
  };
}

function hydrate(st) {
  if (!st || typeof st !== 'object') return st;
  const base = initState(st.stock || { diameter: 32, length: 60, grip: 15 });
  for (const k of Object.keys(base)) if (st[k] === undefined) st[k] = base[k];
  if (!st.journal) st.journal = [];
  return st;
}

/* ===== Геометрия профиля =====
   Профиль хранится от патрона к торцу (u=L+Z), как в общем просмотрщике.
   segRanges возвращает обратный порядок, от Z0 к отрицательным Z, для проверки пути. */
function segRanges(profile) {
  const out=[];let z=profile.frontZ??0;
  for(const s of [...profile.segments].reverse()){
    out.push({z0:z,z1:z-s.length,d0:s.endDiameter??s.diameter,d1:s.diameter});z-=s.length;
  }return out;
}

function dAt(r, z) {
  const span = r.z0 - r.z1;
  if (span < 1e-12) return r.d0;
  const t = (r.z0 - z) / span;
  return r.d0 + (r.d1 - r.d0) * t;
}
function profileDiameter(profile, z) {
  const rs = segRanges(profile);
  for (const r of rs) if (z <= r.z0 + 1e-6 && z >= r.z1 - 1e-6) return dAt(r, z);
  if (z > (profile.frontZ??0)) return 0;
  return dAt(rs[rs.length - 1], rs[rs.length - 1].z1);
}
function profileVolume(profile) {
  let v = 0;
  for (const s of profile.segments)
    v += Math.PI / 12 * s.length * (s.diameter * s.diameter + s.diameter * s.endDiameter + s.endDiameter * s.endDiameter - 3*(s.bore??profile.bore??0)**2);
  return v;
}

/* ===== Координаты ===== */
function toolById(id) { for (const t of TOOLS) if (t.id === id) return t; return null; }
function toolGeo(id) { const t = id ? toolById(id) : null; return t ? t.trueGeometry : { x: 0, z: 0 }; }
function actualPos(st) {
  const g = toolGeo(st.tool);
  return { x: st.axes.x + g.x, z: st.axes.z + g.z - 100 };
}
function workPos(st) {
  const off = st.tool ? st.offsets[String(st.tool)] : { x: 0, z: 0, wearX: 0, wearZ: 0 };
  return {
    x: st.axes.x + off.x + off.wearX - st.workOffset.x,
    z: st.axes.z + off.z + off.wearZ - st.workOffset.z
  };
}
function syncPosition(st) { const p = actualPos(st); st.position = { x: r3(p.x), z: r3(p.z) }; }
function parked(st) {
  const p = actualPos(st);
  return p.x >= st.stock.diameter + 6 - 1e-9 && p.z >= 5 - 1e-9;
}
function effectiveRpm(st, atX) {
  if (!st.spindle) return 0;
  const ov = (st.overrides && st.overrides.spindle ? st.overrides.spindle : 100) / 100;
  let rpm;
  if (st.speedMode === 97) rpm = st.speed * ov;
  else {
    const d = Math.max(isNum(atX) ? atX : actualPos(st).x, 1);
    rpm = Math.min(st.speedLimit, 1000 * st.speed / (Math.PI * d)) * ov;
  }
  if (!isFinite(rpm) || rpm < 0) rpm = 0;
  return Math.min(rpm, st.speedLimit, LIMITS.rpmMax);
}
function moveTime(st, p0, p1, rapid) {
  const dist = Math.hypot(p1.z - p0.z, (p1.x - p0.x) / 2);
  let speed;
  if (rapid) speed = LIMITS.rapidRate * st.overrides.rapid / 100;
  else {
    const f = st.feed * st.overrides.feed / 100;
    if (st.feedMode === 99) speed = f * effectiveRpm(st, (p0.x + p1.x) / 2); // G96: средний диаметр — упрощение
    else speed = f;
  }
  if (!(speed > 0)) return 0;
  return dist / speed * 60;
}
function activeCycle(st) {
  return !!st.program && (st.program.status === 'running' || st.program.status === 'hold');
}

/* ===== Парсер программы ===== */
function gUnsupported(v) {
  if (v === 2 || v === 3) return 'дуги G2/G3 не поддерживаются — только линейные перемещения';
  if (v === 20) return 'дюймовый режим G20 не поддерживается — используйте G21 (мм)';
  if (v === 90) return 'G90 не поддерживается — координаты всегда абсолютные';
  if (v === 91) return 'инкрементальный режим G91 не поддерживается — только абсолютные координаты';
  if (v === 41 || v === 42) return 'коррекция на радиус резца G41/G42 не моделируется';
  if (v === 17) return 'плоскость G17 не поддерживается — токарная плоскость G18';
  if (v >= 80 && v <= 89) return 'циклы G8x не поддерживаются';
  if (v >= 55 && v <= 59) return 'смещения G55–G59 не поддерживаются — только G54';
  return 'код G' + v + ' не поддерживается';
}

function compileBlock(words,row,raw){
  const fail=message=>({ok:false,message:'Строка '+row+': '+message}),groups={},values={},gs=[];let m=null;
  const group={0:'motion',1:'motion',18:'plane',21:'units',40:'compensation',54:'work',96:'speed',97:'speed',98:'feed',99:'feed',50:'cap'};
  for(const {L,v}of words){
    if(!Number.isFinite(v))return fail('Числа должны быть конечными.');
    if(L==='G'){if(!Number.isInteger(v)||!Object.hasOwn(group,v))return fail(gUnsupported(v));const key=group[v];if(groups[key]!==undefined)return fail('В одной модальной группе допускается одна G-команда.');groups[key]=v;gs.push(v);}
    else if(L==='M'){if(m!==null||![0,3,5,8,9,30].includes(v))return fail('Одна поддерживаемая M-команда на блок.');m=v;}
    else if(['X','Z','F','S','T'].includes(L)){if(Object.hasOwn(values,L))return fail('Повтор адреса '+L);values[L]=v;}
    else return fail('Адрес '+L+' не поддерживается.');
  }
  if(values.T!==undefined){if(words.length!==1||![101,202,303,404].includes(values.T))return fail('T0101…T0404 задаются отдельным блоком.');return {ok:true,block:{row,raw,ops:[{k:'tool',v:values.T/101}]}};}
  if(values.F!==undefined&&(!(values.F>0)||values.F>1500))return fail('Подача F: 0 < F ≤ 1500.');
  if(values.S!==undefined&&(!(values.S>0)||values.S>2500))return fail('Положительное S не больше 2500; в G96 действуют единицы скорости резания.');
  if(m===30&&(values.X!==undefined||values.Z!==undefined))return fail('M30 и перемещение задаются разными блоками.');
  if(groups.cap!==undefined){if(words.length!==2||values.S===undefined)return fail('G50 поддерживается в отдельном блоке G50 S<предел>.');return {ok:true,block:{row,raw,ops:[{k:'g50',v:values.S}]}};}
  const ops=[];
  for(const g of gs)ops.push({k:group[g]==='motion'?'gmotion':group[g]==='feed'?'feedmode':group[g]==='speed'?'speedmode':'decl',v:g});
  if(values.F!==undefined)ops.push({k:'f',v:r3(values.F)});
  if(values.S!==undefined)ops.push({k:'s',v:r3(values.S)});
  if(m===3||m===5)ops.push({k:'m',v:m});
  if(values.X!==undefined||values.Z!==undefined)ops.push({k:'move',x:values.X===undefined?null:r3(values.X),z:values.Z===undefined?null:r3(values.Z)});
  if(m!==null&&m!==3&&m!==5)ops.push({k:'m',v:m});
  return {ok:true,block:{row,raw,ops}};
}
function parseProgram(source){
  const fail=(row,message)=>({ok:false,message:'Строка '+row+': '+message});
  if(typeof source!=='string'||source.length>MAX_SOURCE)return {ok:false,message:'Программа должна содержать не больше '+MAX_SOURCE+' символов.'};
  if(sourceControls.test(source))return {ok:false,message:'Удалите скрытые управляющие символы из программы.'};
  const lines=source.split(/\r\n|\n|\r/);if(lines.length>MAX_LINES)return {ok:false,message:'Не больше '+MAX_LINES+' строк.'};
  const blocks=[];let seenProgram=false,ended=false;
  for(let i=0;i<lines.length;i++){
    let out='',comment=false;
    for(const c of lines[i]){if(c==='('){if(comment)return fail(i+1,'Вложенный комментарий не поддерживается.');comment=true;}else if(c===')'){if(!comment)return fail(i+1,'Закрывающая скобка без начала комментария.');comment=false;}else if(!comment)out+=c;}
    if(comment)return fail(i+1,'Закройте комментарий.');
    let clean=out.trim().replace(/;\s*$/,'').trim().toUpperCase();if(!clean||clean==='%')continue;
    const words=[],pattern=/([A-Z])\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))/y;let pos=0;
    while(pos<clean.length){if(/\s/.test(clean[pos])){pos++;continue;}pattern.lastIndex=pos;const match=pattern.exec(clean);if(!match)return fail(i+1,'Не удалось прочитать слово. Используйте латиницу и десятичную точку.');const value=Number(match[2]);if(!Number.isFinite(value))return fail(i+1,'Число вне диапазона.');words.push({L:match[1],v:value});pos=pattern.lastIndex;}
    if(words[0]?.L==='O'){if(words.length!==1||blocks.length||seenProgram||!Number.isInteger(words[0].v)||words[0].v<1||words[0].v>99999)return fail(i+1,'Один отдельный O1…99999 перед исполняемыми блоками.');seenProgram=true;continue;}
    if(words[0]?.L==='N'){const n=words.shift().v;if(!Number.isInteger(n)||n<0||n>99999)return fail(i+1,'Номер N0…99999 должен быть целым.');}
    if(!words.length)continue;if(ended)return fail(i+1,'Исполняемые блоки после M30 запрещены.');
    const result=compileBlock(words,i+1,lines[i].trim());if(!result.ok)return result;blocks.push(result.block);if(words.some(w=>w.L==='M'&&w.v===30))ended=true;
  }return {ok:true,blocks};
}

/* ===== Физика движения ===== */
function checkChuck(st, p0, p1) {
  const L = st.stock.length, zLim = -L + 1, thr = st.stock.diameter + LIMITS.chuckClearance;
  const zmin = Math.min(p0.z, p1.z);
  if (zmin > zLim + EPS) return;
  const zOther = p0.z <= p1.z ? p1.z : p0.z;
  const zc = Math.min(zOther, zLim);
  let xs;
  if (Math.abs(p1.z - p0.z) < 1e-12) xs = [p0.x,p1.x];
  else {
    const xAt = z => p0.x + (p1.x - p0.x) * (z - p0.z) / (p1.z - p0.z);
    xs = [xAt(zmin), xAt(zc)];
  }
  const minX = Math.min.apply(null, xs);
  if (minX < thr - EPS)
    throw err('CHUCK', 'Столкновение с патроном: при Z <= ' + r3(zLim) + ' держите X >= ' + r3(thr) +
      ' (фактически X' + r3(minX) + ')', true);
}

function checkTubeAir(st,p0,p1,jog){
  const bore=st.profile.bore,dz=p1.z-p0.z,clear=jog?0:LIMITS.clearance;
  if(Math.abs(dz)<EPS){if(p0.z>(st.profile.frontZ??0)+EPS||p0.z<-st.stock.length-EPS)return;const d=profileDiameter(st.profile,p0.z);if(Math.max(p0.x,p1.x)<=bore-clear+EPS)return;if(p1.x>p0.x&&p0.x>=d-EPS)return;if(Math.min(p0.x,p1.x)>=d+clear-EPS)return;throw err('COLLISION','Перемещение пересекает стенку трубы. Выйдите через свободный торец.',true);}
  const min=Math.min(p0.z,p1.z),max=Math.max(p0.z,p1.z),xAt=z=>p0.x+(p1.x-p0.x)*(z-p0.z)/dz;
  for(const r of segRanges(st.profile)){const lo=Math.max(min,r.z1),hi=Math.min(max,r.z0);if(hi<lo-EPS)continue;const a=xAt(lo),b=xAt(hi);if(Math.max(a,b)<=bore-LIMITS.clearance+EPS)continue;if(a>=dAt(r,lo)+LIMITS.clearance-EPS&&b>=dAt(r,hi)+LIMITS.clearance-EPS)continue;throw err('COLLISION','Траектория пересекает стенку трубы. В отверстии и снаружи нужен зазор; переходите через торец.',true);}
}
function checkBladeAir(st,p0,p1,jog){
  const width=toolById(st.tool).width,dz=p1.z-p0.z,dx=p1.x-p0.x,clear=Math.abs(dz)<EPS&&(dx>0||jog)?0:LIMITS.clearance;
  for(const r of segRanges(st.profile)){
    let lo=0,hi=1;if(Math.abs(dz)<EPS){if(p0.z<r.z1-EPS||p0.z-width>r.z0+EPS)continue;}else{const t1=(r.z1-p0.z)/dz,t2=(r.z0+width-p0.z)/dz;lo=Math.max(0,Math.min(t1,t2));hi=Math.min(1,Math.max(t1,t2));if(hi<lo-EPS)continue;}
    const ts=[lo,hi];if(Math.abs(dz)>EPS)for(const z of [r.z0,r.z1,r.z0+width,r.z1+width]){const t=(z-p0.z)/dz;if(t>lo&&t<hi)ts.push(t);}
    for(const t of ts){const z=p0.z+dz*t,x=p0.x+dx*t,a=Math.max(r.z1,z-width),b=Math.min(r.z0,z);if(b<a-EPS||(Math.abs(dz)<EPS&&b-a<EPS))continue;const d=Math.max(dAt(r,a),dAt(r,b));if(x<d+clear-EPS)throw err('BLADE_COLLISION','Пластина канавочного резца пересекает материал по ширине.',true);}
  }
}
function checkNonCutting(st,p0,p1,jog){
  const L=st.stock.length,dz=p1.z-p0.z,dx=p1.x-p0.x,front=st.profile.frontZ??0;
  if(st.tool===4)return checkBladeAir(st,p0,p1,jog);
  // Contact at the front is allowed only in JOG; withdrawing from it enters free space.
  if(Math.abs(p0.z-front)<EPS&&p1.z>front+EPS)return;
  if(jog&&p0.z>front+EPS&&Math.abs(p1.z-front)<EPS)return;
  if(st.profile.bore)return checkTubeAir(st,p0,p1,jog);
  if(Math.abs(dz)<EPS){
    if(p0.z<-L-EPS||p0.z>front+EPS)return;
    const d=profileDiameter(st.profile,p0.z);
    if(dx>EPS){if(p0.x<d-EPS)throw err('COLLISION','Инструмент находится внутри материала: безопасный быстрый выход не подтверждён.',true);return;}
    if(p1.x<d+(jog?0:LIMITS.clearance)-EPS)throw err('COLLISION','Радиальное перемещение входит в материал или не оставляет зазор.',true);
    return;
  }
  const zmin=Math.min(p0.z,p1.z),zmax=Math.max(p0.z,p1.z),xAt=z=>p0.x+(p1.x-p0.x)*(z-p0.z)/dz;
  for(const r of segRanges(st.profile)){
    const lo=Math.max(zmin,r.z1),hi=Math.min(zmax,r.z0);if(hi<lo-EPS)continue;
    for(const z of [lo,hi])if(xAt(z)<dAt(r,z)+LIMITS.clearance-EPS)throw err('COLLISION','Траектория пересекает материал: сначала отведите X, затем перемещайтесь вдоль Z.',true);
  }
}
function cutProfile(profile,zA,zB,pathFn){
  const out=[];let depthMax=0;
  for(const r of segRanges(profile)){
    const points=[r.z0,r.z1];for(const z of [zA,zB])if(z<r.z0-EPS&&z>r.z1+EPS)points.push(z);
    points.sort((a,b)=>b-a);
    for(let i=0;i<points.length-1;i++){
      const hi=points[i],lo=points[i+1],inside=(hi+lo)/2<=zA+EPS&&(hi+lo)/2>=zB-EPS;
      const breaks=[hi,lo];
      if(inside){const a=dAt(r,hi)-pathFn(hi),b=dAt(r,lo)-pathFn(lo);if(a*b<0)breaks.splice(1,0,hi+(lo-hi)*a/(a-b));}
      for(let j=0;j<breaks.length-1;j++){
        const a=breaks[j],b=breaks[j+1];if(a-b<EPS)continue;const cut=inside&&pathFn((a+b)/2)<dAt(r,(a+b)/2),da=cut?pathFn(a):dAt(r,a),db=cut?pathFn(b):dAt(r,b);
        if(cut)depthMax=Math.max(depthMax,(dAt(r,a)-da)/2,(dAt(r,b)-db)/2);
        out.push({length:a-b,diameter:da,endDiameter:db,bore:profile.bore||0});
      }
    }
  }
  const front=[];for(const p of out){const last=front.at(-1);if(last&&Math.abs(last.endDiameter-p.diameter)<1e-8&&Math.abs((last.endDiameter-last.diameter)/last.length-(p.endDiameter-p.diameter)/p.length)<1e-9){last.length+=p.length;last.endDiameter=p.endDiameter;}else front.push({...p});}
  const segments=front.reverse().map(p=>({length:p.length,diameter:p.endDiameter,endDiameter:p.diameter,bore:profile.bore||0}));
  if(segments.length>MAX_SEGMENTS)throw err('PROFILE','Превышено 256 участков профиля.',true);
  return {segments,depth:depthMax};
}

function performRadial(st,p0,p1){
  const tool=toolById(st.tool),front=st.profile.frontZ??0,L=st.stock.length,dz=p1.z-p0.z,dx=p1.x-p0.x;
  if(Math.abs(dz)>EPS){checkNonCutting(st,p0,p1,false);return {removed:0,seconds:0,z0:Math.max(p0.z,p1.z),z1:Math.min(p0.z,p1.z),depth:0,dry:false};}
  if(p1.z>front+EPS){
    // The reference edge may be in front of the part while the rear of the blade
    // still overlaps it. This is not a supported groove, so require clear air.
    if(st.tool===4)checkBladeAir(st,p0,p1,false);
    return {removed:0,seconds:0,z0:p1.z,z1:p1.z,depth:0,dry:false};
  }
  if(dx>=-EPS){if(st.tool===4)checkBladeAir(st,p0,p1,true);return {removed:0,seconds:0,z0:p1.z,z1:p1.z,depth:0,dry:false};}
  if(!st.spindle||!(effectiveRpm(st)>0))throw err('SPINDLE','Шпиндель остановлен.',true);
  const f=st.feedMode===99?st.feed:st.feed/effectiveRpm(st,(p0.x+p1.x)/2),actual=f*st.overrides.feed/100;
  if(actual<tool.feedRange[0]-EPS||actual>tool.feedRange[1]+EPS)throw err('FEED','Подача вне диапазона выбранного резца.',false);
  let result;try{result=st.tool===3?radialOps.face(st.profile,L,p1.z,Math.max(st.profile.bore||0,p1.x),tool.maxDepth):radialOps.groove(st.profile,L,p1.z,tool.width,p1.x,tool.maxDepth);}catch(error){throw err('RADIAL',error.message,true);}
  st.profile=result.profile;return {removed:result.removed,seconds:0,z0:st.tool===3?front:p1.z,z1:st.tool===3?p1.z:p1.z-tool.width,depth:result.depth,dry:!st.coolant};
}
function performCut(st, p0, p1) {
  if(st.feedMode===99&&effectiveRpm(st)<=0)
    throw err('SPINDLE', 'Для резания нужно вращение шпинделя: задайте S и включите M03', true);
  if (!st.tool) throw err('TOOL', 'Для резания выберите инструмент (T0101/T0202)', false);
  const tool = toolById(st.tool);
  const off = st.offsets[String(st.tool)];
  if (!off.calibrated) throw err('OFFSET', 'Инструмент ' + tool.code + ' не привязан: выполните preset', false);
  if (st.feed === null || !(st.feed > 0)) throw err('FEED', 'Для G01 задайте подачу F', false);
  if(st.tool===3||st.tool===4)return performRadial(st,p0,p1);
  const front=st.profile.frontZ??0;
  const L = st.stock.length;
  const hi = Math.max(-L, Math.min(Math.max(p0.z, p1.z), front));
  const lo = Math.min(front, Math.max(Math.min(p0.z, p1.z), -L));
  const dz = p1.z - p0.z;
  let removed = 0, depth = 0;
  if(st.profile.bore&&Math.min(p0.z,p1.z)<=front+EPS&&Math.max(p0.z,p1.z)>=-L-EPS){const bore=st.profile.bore,xAt=z=>Math.abs(dz)<EPS?p1.x:p0.x+(p1.x-p0.x)*(z-p0.z)/dz,a=xAt(lo),b=xAt(hi);
    if(Math.max(a,b)<=bore-LIMITS.clearance+EPS)return {removed:0,seconds:0,z0:hi,z1:lo,depth:0,dry:false};
    if(Math.min(a,b)<bore+2-EPS)throw err('WALL','Стенка стала бы тоньше 1 мм либо выполняется неподдерживаемая расточка. Отверстие фиксировано.',true);
  }
  if (hi - lo > 1e-12 && Math.abs(dz) > 1e-12) {
    const pathFn = z => p0.x + (p1.x - p0.x) * (z - p0.z) / dz;
    const built = cutProfile(st.profile, hi, lo, pathFn);
    if (built.depth > tool.maxDepth + 1e-6)
      throw err('DEPTH', 'Глубина за проход ' + r3(built.depth) + ' мм больше допустимой ' +
        tool.maxDepth + ' мм у ' + tool.code + ' — уменьшите съём', true);
    if(built.depth>EPS){
      if(effectiveRpm(st)<=0)throw err('SPINDLE','Для съёма материала включите шпиндель.',true);
      const fr = tool.feedRange;
      const actualFeed=st.feedMode===99?st.feed:st.feed/effectiveRpm(st,(p0.x+p1.x)/2);
      if (actualFeed*st.overrides.feed/100 < fr[0] - EPS || actualFeed*st.overrides.feed/100 > fr[1] + EPS)
        throw err('FEED', 'Подача F' + st.feed + ' вне диапазона ' + fr[0] + '–' + fr[1] +
          ' мм/об для ' + tool.code, false);
    }
    const volBefore = profileVolume(st.profile);
    const newProfile = { segments: built.segments, bore: st.profile.bore||0,...(st.profile.frontZ!==undefined?{frontZ:st.profile.frontZ}:{}) };
    removed = volBefore - profileVolume(newProfile);
    if (removed < 1e-9) removed = 0;
    depth = built.depth;
    if (removed > 0) st.profile = newProfile; // атомарность: профиль меняем только после всех проверок
  } else if (Math.abs(dz) <= 1e-12) {
    if(st.profile.bore&&p0.z>=-L-EPS&&p0.z<=front+EPS&&p1.x>p0.x+EPS&&p0.x<profileDiameter(st.profile,p0.z)-EPS)throw err('BORING','Расточка не поддерживается: инструмент не может пройти сквозь стенку из отверстия.',true);
    if (p1.x < p0.x - EPS && p0.z >= -L - EPS && p0.z <= EPS) {
      const D = profileDiameter(st.profile, p0.z);
      if (p1.x < D - EPS)
        throw err('FACE', 'Радиальное врезание (подрезка торца/канавка) не поддерживается — только точение вдоль Z', true);
    }
  }
  return { removed: removed, seconds: 0, z0: hi, z1: lo, depth: depth, dry: !st.coolant };
}

function doMove(st, wx, wz, rapid, opts) {
  const jog = !!(opts && opts.jog);
  const row = (opts && opts.row !== undefined && opts.row !== null) ? opts.row : null;
  if (!st.referenced) throw err('REF', 'Сначала выполните привязку осей (reference)', false);
  if (!jog) {
    if (!st.clamped) throw err('CLAMP', 'Зажмите заготовку в патроне (clamp)', false);
    if (!st.doorClosed) throw err('DOOR', 'Закройте дверь перед программным перемещением', false);
    if(!st.tool||!st.offsets[String(st.tool)].calibrated||!st.workOffset.confirmed)throw err('SETUP','Выберите привязанный инструмент и подтвердите G54.',false);
  }
  const geo = toolGeo(st.tool);
  const off = st.tool ? st.offsets[String(st.tool)] : { x: 0, z: 0, wearX: 0, wearZ: 0 };
  const cur = workPos(st);
  const twx = isNum(wx) ? wx : cur.x;
  const twz = isNum(wz) ? wz : cur.z;
  const ax = r3(twx + st.workOffset.x - off.x - off.wearX);
  const az = r3(twz + st.workOffset.z - off.z - off.wearZ);
  const p0 = actualPos(st);
  const p1 = { x: r3(ax + geo.x), z: r3(az + geo.z - 100) };
  if (Math.abs(p1.x - p0.x) < 1e-9 && Math.abs(p1.z - p0.z) < 1e-9) {
    st.axes = { x: ax, z: az };
    st.position = { x: p1.x, z: p1.z };
    return { removed: 0, seconds: 0, z0: p1.z, z1: p1.z, depth: 0, dry: false };
  }
  const L = st.stock.length;
  if (p1.x < (st.tool===3?0:LIMITS.axisX.min) - EPS || p1.x > LIMITS.axisX.max + EPS)
    throw err('DOMAIN', 'Предел хода X: ' + LIMITS.axisX.min + '..' + LIMITS.axisX.max + ' мм (цель X' + p1.x + ')', true);
  if (p1.z < -L - LIMITS.travelZmargin - EPS || p1.z > LIMITS.frontZMax + EPS)
    throw err('DOMAIN', 'Предел хода Z: ' + r3(-L - LIMITS.travelZmargin) + '..' + LIMITS.frontZMax + ' мм (цель Z' + p1.z + ')', true);
  checkChuck(st, p0, p1);if(st.tool===4){const w=toolById(st.tool).width;checkChuck(st,{x:p0.x,z:p0.z-w},{x:p1.x,z:p1.z-w});}
  let cut = null;
  if (rapid || jog) checkNonCutting(st, p0, p1,jog);
  else cut = performCut(st, p0, p1);
  const seconds = r3(moveTime(st, p0, p1, rapid));
  st.axes = { x: ax, z: az };
  st.position = { x: p1.x, z: p1.z };
  st.motion = rapid ? 0 : 1;
  const removed = cut ? cut.removed : 0;
  st.path.push({
    from: { x: r3(p0.x), z: r3(p0.z) },
    to: { x: p1.x, z: p1.z },
    motion: rapid ? 0 : 1,
    cutting: removed > 0,
    row: row
  });
  if (st.path.length > MAX_PATH) st.path.splice(0, st.path.length - MAX_PATH);
  if (cut) { cut.seconds = seconds; return cut; }
  return { removed: 0, seconds: seconds, z0: Math.min(p0.z, p1.z), z1: Math.max(p0.z, p1.z), depth: 0, dry: false };
}

/* ===== Исполнение кадра ===== */
function guardedToolChange(st, id, inProgram) {
  if(st.tool===id)return "Уже выбран "+toolById(id).code;
  if (activeCycle(st)&&!inProgram) throw err('STATE', 'Смена инструмента в активном цикле запрещена', false);
  if (st.spindle || st.coolant) throw err('TOOL', 'Остановите шпиндель и охлаждение перед сменой инструмента', false);
  if (!st.referenced) throw err('REF', 'Сначала выполните привязку осей (reference)', false);
  const p = actualPos(st);
  if (!(p.x >= st.stock.diameter + 6 - EPS) || !(p.z >= 5 - EPS))
    throw err('TOOL', 'Отведите инструмент в точку смены: фактический X >= ' + r3(st.stock.diameter + 6) +
      ' и Z >= 5 (сейчас X' + r3(p.x) + ', Z' + r3(p.z) + ')', false);
  st.tool = id;
  syncPosition(st);
  return 'Установлен инструмент ' + toolById(id).code;
}

function doM(st, v, isAuto) {
  switch (v) {
    case 3:
      if (!(st.speed > 0)) throw err('SPINDLE', 'Задайте S перед пуском шпинделя (M03)', false);
      if (!st.referenced || !st.clamped || !st.doorClosed || !st.tool || !st.offsets[String(st.tool)].calibrated || !st.workOffset.confirmed)
        throw err('SETUP', 'Для пуска нужны референс, зажим, привязанный инструмент, подтверждённый G54 и закрытая дверь', false);
      st.spindle = true;
      return 'Шпиндель включен';
    case 5: st.spindle = false; return 'Шпиндель остановлен';
    case 8:
      if (!st.doorClosed || !st.clamped)
        throw err('COOLANT', 'Для охлаждения закройте дверь и зажмите деталь', false);
      st.coolant = true;
      return 'Охлаждение включено';
    case 9: st.coolant = false; return 'Охлаждение выключено';
    case 0:
      if (isAuto && st.program.status === 'running') { st.program.status = 'hold'; return 'M00: пауза цикла'; }
      return 'M00';
    case 30:
      st.spindle = false; st.coolant = false;
      if (isAuto) st.program.status = 'done';
      return 'M30: программа завершена, шпиндель и охлаждение остановлены';
  }
  return null;
}

function runOpsUnsafe(st, blk, isAuto) {
  let message = null, cutData = null;
  for (const op of blk.ops) {
    switch (op.k) {
      case 'decl': break; // G18/G21/G40/G54 — декларации, приняты без действий
      case 'gmotion': st.motion = op.v; break;
      case 'feedmode': st.feedMode = op.v; break;
      case 'speedmode': st.speedMode = op.v; break;
      case 'g50':
        st.speedLimit = r3(op.v); st.explicitSpeedLimit = true;
        message = 'Лимит оборотов G50 S' + r3(op.v);
        break;
      case 'f':
        if (!(op.v > 0)) throw err('FEED', 'Подача F должна быть положительной', false);
        st.feed = op.v; break;
      case 's':
        if (st.speedMode === 97) {
          if (op.v < 0 || op.v > LIMITS.rpmMax)
            throw err('SPINDLE', 'S для G97 в диапазоне 0..' + LIMITS.rpmMax + ' об/мин', false);
          st.speed = op.v;
        } else {
          if (!(op.v > 0) || op.v > LIMITS.g96SpeedMax)
            throw err('SPINDLE', 'S для G96 — скорость резания 0..' + LIMITS.g96SpeedMax + ' м/мин', false);
          if (!st.explicitSpeedLimit)
            throw err('CAP', 'G96 требует явного лимита оборотов: кадр G50 S<лимит>', true);
          st.speed = op.v;
        }
        break;
      case 'tool': message = guardedToolChange(st, op.v,isAuto); break;
      case 'm': { const m = doM(st, op.v, isAuto); if (m) message = m; break; }
      case 'move': {
        const rapid = st.motion === 0;
        const ci = doMove(st, op.x, op.z, rapid, { jog: false, row: blk.row });
        if (ci.removed > 0) {
          st.cuts.push({
            volume: ci.removed, seconds: r3(ci.seconds),
            z0: r3(ci.z0), z1: r3(ci.z1), tool: st.tool, row: blk.row
          });
          message = 'Срез ' + r3(ci.removed) + ' мм³ за ' + r3(ci.seconds) + ' с' +
            (ci.dry ? ' (внимание: резание без охлаждения)' : '');
          cutData = { volume: ci.removed, seconds: r3(ci.seconds) };
        }
        break;
      }
    }
  }
  if(st.speedMode===96){
    if(!st.explicitSpeedLimit)throw err('CAP','Перед G96 задайте предел оборотов G50 S…',true);
    if(!(st.speed>0)||st.speed>LIMITS.g96SpeedMax)throw err('SPINDLE','Для G96 задайте допустимую скорость резания S в м/мин.',false);
  }
  return { ok: true, message: message, cut: cutData };
}

function runOps(st,blk,isAuto){
  const candidate=clone(st),result=runOpsUnsafe(candidate,blk,isAuto);Object.assign(st,candidate);return result;
}
function stepOnce(st){
  if(st.program.status!=='running')return {ok:false,message:'Цикл не запущен.'};
  const index=st.program.index,block=st.program.blocks[index];
  if(!block){st.spindle=false;st.coolant=false;st.alarm={code:'NO_M30',message:'Программа закончилась без M30. Выполнение остановлено.'};st.program.status='alarm';return {ok:false,message:st.alarm.message};}
  try{const result=runOps(st,block,true);st.program.index=index+1;return {ok:true,message:result.message||'Выполнен блок '+block.row,data:{row:block.row,...(result.cut||{})}};}
  catch(error){st.alarm={code:error.code||'PROGRAM',message:'Блок '+block.row+': '+error.message};st.program.status='alarm';return {ok:false,message:st.alarm.message,data:{row:block.row}};}
}

/* ===== Нормализация действий ===== */
const ALLOWED = {
  reference: [], clamp: ['value'], door: ['value'], mode: ['value'], tool: ['tool'], preset: [],touch:['axis','value'],
  offset: ['tool', 'x', 'z', 'wearX', 'wearZ'], workOffset: ['z'], jog: ['axis', 'delta'],
  spindle: ['value', 'rpm'], coolant: ['value'], override: ['kind', 'value'],
  load: ['source'], mdi: ['source'], start: [], step: [], hold: [], reset: [],
  estop: ['value'], measure: ['z', 'instrument']
};
const OVR_RANGE = { feed: LIMITS.overrides.feed, rapid: LIMITS.overrides.rapid, spindle: LIMITS.overrides.spindle };

function normalize(action) {
  if (!action || typeof action !== 'object' || Array.isArray(action)) return null;
  const type = action.type;
  if (typeof type !== 'string' || !Object.hasOwn(ALLOWED,type)) return null;
  const allowed = ALLOWED[type];
  for (const k of Object.keys(action)) if (k !== 'type' && allowed.indexOf(k) < 0) return null;
  const bool = v => typeof v === 'boolean';
  switch (type) {
    case 'reference': case 'preset': case 'start': case 'step': case 'hold': case 'reset':
      return { type: type };
    case 'clamp': case 'door': case 'coolant': case 'estop':
      return bool(action.value) ? { type: type, value: action.value } : null;
    case 'mode':
      return ['JOG', 'MDI', 'AUTO', 'EDIT'].indexOf(action.value) >= 0 ? { type: type, value: action.value } : null;
    case 'tool':
      return [1,2,3,4].includes(action.tool) ? { type: type, tool: action.tool } : null;
    case 'offset': {
      if (![1,2,3,4].includes(action.tool)) return null;
      const out = { type: type, tool: action.tool };
      let any = false;
      for (const k of ['x', 'z']) {
        if (action[k] !== undefined) {
          if (!isNum(action[k])) return null;
          const v = r3(action[k]);
          if (v < LIMITS.offset.min - EPS || v > LIMITS.offset.max + EPS) return null;
          out[k] = v; any = true;
        }
      }
      for (const k of ['wearX', 'wearZ']) {
        if (action[k] !== undefined) {
          if (!isNum(action[k])) return null;
          const v = r3(action[k]);
          if (v < LIMITS.wear.min - EPS || v > LIMITS.wear.max + EPS) return null;
          out[k] = v; any = true;
        }
      }
      return any ? out : null;
    }
    case 'touch':{
      if(!['X','Z'].includes(action.axis)||!isNum(action.value))return null;
      const value=r3(action.value);if(action.axis==='X'?(value<1||value>120):(value<90||value>110))return null;
      return {type,axis:action.axis,value};
    }
    case 'workOffset': {
      if (!isNum(action.z)) return null;
      const z = r3(action.z);
      if (z < LIMITS.workOffsetZ.min - EPS || z > LIMITS.workOffsetZ.max + EPS) return null;
      return { type: type, z: z };
    }
    case 'jog': {
      if (action.axis !== 'X' && action.axis !== 'Z') return null;
      if (!isNum(action.delta)) return null;
      const d = r3(action.delta);
      if (!(Math.abs(d) >= LIMITS.jogDelta.min - EPS && Math.abs(d) <= LIMITS.jogDelta.max + EPS)) return null;
      return { type: type, axis: action.axis, delta: d };
    }
    case 'spindle': {
      if (!bool(action.value)) return null;
      if (action.value) {
        if (!('rpm' in action) || !isNum(action.rpm)) return null;
        const rpm = r3(action.rpm);
        if (rpm < LIMITS.manualRpm.min - EPS || rpm > LIMITS.manualRpm.max + EPS) return null;
        return { type: type, value: true, rpm: rpm };
      }
      if ('rpm' in action) return null;
      return { type: type, value: false };
    }
    case 'override': {
      const r = Object.hasOwn(OVR_RANGE,action.kind)?OVR_RANGE[action.kind]:null;
      if (!r || !Number.isInteger(action.value)) return null;
      if (action.value < r.min || action.value > r.max) return null;
      return { type: type, kind: action.kind, value: action.value };
    }
    case 'load': case 'mdi':
      return (typeof action.source === 'string' && action.source.length <= MAX_SOURCE&&!sourceControls.test(action.source))
        ? { type: type, source: action.source } : null;
    case 'measure': {
      if (!isNum(action.z)) return null;
      if (!['caliper','micrometer','inside-caliper','bore-gauge'].includes(action.instrument)) return null;
      return { type: type, z: r3(action.z), instrument: action.instrument };
    }
  }
  return null;
}

function sameShape(a, b) {
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (!(k in b)) return false;
    if (a[k] !== b[k]) return false; // значения действий — примитивы
  }
  return true;
}

/* Строгая проверка канонической формы (для журнала при restore — fail closed) */
function validateNormalized(a) {
  const c = normalize(a);
  if (!c) return 'действие не соответствует канонической форме';
  if (!sameShape(c, a)) return 'лишние, отсутствующие или неканоничные поля действия';
  return null;
}

/* ===== Переход ===== */
function gate(st, type, action) {
  if (st.estop && type !== 'estop'&&!(['spindle','coolant'].includes(type)&&action.value===false))
    return 'Аварийный стоп нажат: отпустите кнопку E-STOP и выполните сброс (reset)';
  if (st.alarm) {
    if (type === 'reset' || type === 'estop' || type === 'door') return null;
    if ((type === 'spindle' || type === 'coolant') && action.value === false) return null;
    return 'Авария [' + st.alarm.code + ']: ' + st.alarm.message + ' — выполните сброс (reset)';
  }
  return null;
}

function transition(state, action) {
  if (!state || typeof state !== 'object') return { ok: false, message: 'Нет состояния станка', state: null, data: null };
  let st;
  try { st = hydrate(clone(state)); }
  catch (e) { return { ok: false, message: 'Состояние не клонируется', state: null, data: null }; }
  const num = st.journal.length + 1;
  let ok = false, message = '', data = null;
  const no = m => ({ ok: false, message: m });
  const yes = (m, d) => ({ ok: true, message: m, data: d === undefined ? null : d });
  const phys = e => {
    if (e && e.latch) {
      st.alarm = { code: e.code, message: e.message };
      if (activeCycle(st)) st.program.status = 'alarm';
    }
    return { ok: false, message: e && e.message ? e.message : 'Физическая ошибка' };
  };

  const bad = validateNormalized(action);
  if (bad) {
    message = 'Некорректное действие: ' + bad;
  } else {
    const g = gate(st, action.type, action);
    if (g) message = g;
    else {
      const status = st.program.status;
      if (status === 'running') {
        if (['step', 'hold', 'override', 'estop', 'spindle', 'coolant', 'reset'].indexOf(action.type) < 0)
          message = 'Идёт цикл: доступны step, hold, override, сброс или остановка шпинделя/охлаждения';
      } else if (status === 'hold') {
        if (['start', 'override', 'estop', 'spindle', 'coolant', 'reset'].indexOf(action.type) < 0)
          message = 'Цикл на паузе: доступны start (продолжить), override, сброс или остановка шпинделя/охлаждения';
      }
      if (!message) {
        switch (action.type) {
          case 'reference':
            if (st.referenced) message = 'Привязка уже выполнена — повторная привязка не требуется и не перемещает оси';
            else if (st.spindle) message = 'Остановите шпиндель перед привязкой';
            else { st.referenced = true; ok = true; message = 'Привязка осей выполнена — машинные координаты известны'; }
            break;
          case 'clamp':
            if (st.doorClosed) message = 'Откройте дверь для работы с патроном';
            else if (action.value) { st.clamped = true; ok = true; message = 'Деталь зажата в патроне'; }
            else {
              if (st.spindle) message = 'Остановите шпиндель перед разжимом';
              else {
                st.clamped = false; st.workOffset.confirmed = false; ok = true;
                message = 'Деталь откреплена; подтверждение G54 сброшено — подтвердите заново после нового зажима';
              }
            }
            break;
          case 'door':
            if (!action.value) {
              if (st.spindle) message = 'Нельзя открыть дверь со вращающимся шпинделем — сначала остановите его';
              else if (st.coolant) message = 'Нельзя открыть дверь с включённым охлаждением';
              else { st.doorClosed = false; ok = true; message = 'Дверь открыта'; }
            } else { st.doorClosed = true; ok = true; message = 'Дверь закрыта'; }
            break;
          case 'mode':
            st.mode = action.value; ok = true; message = 'Режим: ' + action.value;
            break;
          case 'tool':
            try { message = guardedToolChange(st, action.tool); ok = true; }
            catch (e) { message = e.message; }
            break;
          case 'preset': {
            if (!st.tool) message = 'Сначала выберите инструмент (tool)';
            else if (!st.referenced) message = 'Нужна привязка осей (reference)';
            else if (!st.clamped) message = 'Зажмите деталь (clamp)';
            else if (st.spindle || st.coolant) message = 'Остановите шпиндель и охлаждение перед щупом';
            else if (!parked(st)) {
              const p = actualPos(st);
              message = 'Отведите инструмент: фактический X >= ' + r3(st.stock.diameter + 6) + ' и Z >= 5 (сейчас X' +
                r3(p.x) + ', Z' + r3(p.z) + ')';
            } else {
              const geo = toolGeo(st.tool);
              st.offsets[String(st.tool)] = { x: geo.x, z: geo.z, wearX: 0, wearZ: 0, calibrated: true,measuredX:true,measuredZ:true };
              ok = true;
              message = 'Виртуальный щуп измерил ' + toolById(st.tool).code + ': X' + geo.x + ' Z' + geo.z +
                ' (износ 0). Никакого физического датчика — учебное измерение';
            }
            break;
          }
          case 'offset': {
            if (activeCycle(st)) message = 'Правка коррекций в активном цикле запрещена';
            else if (st.spindle || st.coolant) message = 'Остановите шпиндель и охлаждение перед правкой коррекций';
            else if (!parked(st)) message = 'Отведите инструмент перед правкой коррекций (X >= D+6, Z >= 5)';
            else {
              const o = st.offsets[String(action.tool)];
              if (action.x !== undefined) o.x = action.x;
              if (action.z !== undefined) o.z = action.z;
              if (action.wearX !== undefined) o.wearX = action.wearX;
              if (action.wearZ !== undefined) o.wearZ = action.wearZ;
              o.calibrated = true;o.measuredX=true;o.measuredZ=true; ok = true;
              message = 'Коррекции ' + toolById(action.tool).code + ' обновлены вручную. ' +
                'Учтите: запись смещений не восстанавливает уже срезанный материал';
            }
            break;
          }
          case 'touch':{
            if(st.mode!=='JOG'||!st.referenced||!st.clamped||!st.tool)message='Для ручной привязки нужны JOG, референс, зажим и выбранный инструмент.';
            else if(st.spindle||st.coolant)message='Остановите шпиндель и СОЖ перед касанием.';
            else{
              const p=actualPos(st),o=st.offsets[String(st.tool)];let value=null;
              if(action.axis==='X'){
                if(p.z>=(st.profile.frontZ??0)-EPS||p.z<=-st.stock.length+1||Math.abs(p.x-profileDiameter(st.profile,p.z))>.005||measureAt(st.profile,p.z).boundary)message='Подведите вершину к наружной поверхности внутри ровного участка. Сначала перемещайтесь по Z при отведённом X, затем малыми шагами уменьшайте X до касания.';
                else value=r3(action.value+st.workOffset.x-st.axes.x-o.wearX);
              }else{
                if(Math.abs(p.z-(st.profile.frontZ??0))>.005||p.x<Math.max(1,(st.profile.bore||0)+.1)||p.x>profileDiameter(st.profile,st.profile.frontZ??0)-.1)message='Подведите инструмент к фактическому торцу Z0: подходите со стороны положительного Z, шпиндель остановлен.';
                else value=r3(action.value-st.axes.z-o.wearZ);
              }
              if(value!==null){if(Math.abs(value)>10)message='Расчётная геометрия вне ±10 мм. Проверьте известный размер и положение касания.';else{if(action.axis==='X'){o.x=value;o.measuredX=true;}else{o.z=value;o.measuredZ=true;}o.calibrated=!!(o.measuredX&&o.measuredZ);ok=true;message='Привязка по касанию '+action.axis+' записана: '+value+' мм. '+(o.calibrated?'Обе оси инструмента привязаны.':'Теперь выполните привязку второй оси.');}}
            }break;
          }
          case 'workOffset':
            if (!st.referenced) message = 'Нужна привязка осей (reference)';
            else if (!st.tool) message = 'Выберите инструмент';
            else if (!st.offsets[String(st.tool)].calibrated)
              message = 'Сначала выполните preset для активного инструмента';
            else if (st.spindle || st.coolant) message = 'Остановите шпиндель и охлаждение';
            else if (!st.clamped) message = 'Зажмите деталь (clamp)';
            else {
              st.workOffset.z = action.z; st.workOffset.confirmed = true; ok = true;
              message = 'G54 Z=' + action.z + ' подтверждена (X в этом подмножестве не редактируется)';
            }
            break;
          case 'jog': {
            if (st.mode !== 'JOG') message = 'Ручное перемещение — только в режиме JOG';
            else if (st.spindle || st.coolant) message = 'Для ручного перемещения остановите шпиндель и охлаждение';
            else if (!st.referenced) message = 'Сначала выполните привязку осей';
            else {
              try {
                const cur = workPos(st);
                const tx = action.axis === 'X' ? r3(cur.x + action.delta) : null;
                const tz = action.axis === 'Z' ? r3(cur.z + action.delta) : null;
                doMove(st, tx, tz, true, { jog: true, row: null });
                ok = true;
                message = 'Ручное перемещение ' + action.axis + ' на ' + action.delta + ' мм выполнено';
              } catch (e) { const r = phys(e); message = r.message; }
            }
            break;
          }
          case 'spindle':
            if (action.value) {
              if (st.mode !== 'JOG' && st.mode !== 'MDI')
                message = 'Ручной пуск шпинделя — только в режимах JOG/MDI (в программе используйте M03)';
              else if (!st.referenced || !st.clamped || !st.doorClosed || !st.tool || !st.offsets[String(st.tool)].calibrated || !st.workOffset.confirmed)
                message = 'Для пуска нужны референс, зажим, привязанный инструмент, подтверждённый G54 и закрытая дверь';
              else { st.spindle = true; st.speedMode=97; st.speed = action.rpm; ok = true; message = 'Шпиндель запущен: задано ' + action.rpm + ' об/мин'; }
            } else { st.spindle = false;if(st.program.status==='running')st.program.status='hold'; ok = true; message = 'Шпиндель остановлен'; }
            break;
          case 'coolant':
            if (action.value) {
              if (!st.doorClosed || !st.clamped) message = 'Для охлаждения закройте дверь и зажмите деталь';
              else { st.coolant = true; ok = true; message = 'Охлаждение включено'; }
            } else { st.coolant = false; ok = true; message = 'Охлаждение выключено'; }
            break;
          case 'override':
            st.overrides[action.kind] = action.value; ok = true;
            message = 'Перекрытие ' + action.kind + ' = ' + action.value + '%';
            break;
          case 'load': {
            const parsed = parseProgram(action.source);
            if (!parsed.ok) message = parsed.message; // синтаксическая ошибка не включает аварию станка
            else {
              st.program = { source: action.source, blocks: parsed.blocks, index: 0, status: parsed.blocks.length ? 'ready' : 'empty' };
              ok = true;
              message = parsed.blocks.length
                ? 'Программа загружена: исполняемых кадров ' + parsed.blocks.length
                : 'Загружена пустая программа';
              data = { blocks: parsed.blocks.length };
            }
            break;
          }
          case 'mdi': {
            if (st.mode !== 'MDI') message = 'MDI доступен только в режиме MDI';
            else {
              const parsed = parseProgram(action.source);
              if (!parsed.ok) message = parsed.message;
              else if (parsed.blocks.length !== 1)
                message = 'MDI выполняет ровно один исполняемый кадр (после фильтра комментариев/пустых/N распознано: ' + parsed.blocks.length + ')';
              else {
                try {
                  const r = runOps(st, parsed.blocks[0], false);
                  ok = true; message = r.message || 'MDI-кадр выполнен';
                  data = r.cut ? Object.assign({ row: parsed.blocks[0].row }, r.cut) : { row: parsed.blocks[0].row };
                } catch (e) { const rr = phys(e); message = rr.message; }
              }
            }
            break;
          }
          case 'start':
            if (st.mode !== 'AUTO') message = 'Пуск цикла — только в режиме AUTO';
            else if (st.program.status === 'done')
              message = 'Программа уже выполнена: сделайте reset (материал не восстановится) или загрузите новую';
            else if (st.program.status !== 'ready' && st.program.status !== 'hold')
              message = 'Нет готовой программы: загрузите программу (load)';
            else if (!st.referenced || !st.clamped || !st.doorClosed || !st.tool || !st.offsets[String(st.tool)].calibrated || !st.workOffset.confirmed)
              message = 'Для пуска нужны референс, зажим, привязанный инструмент, подтверждённый G54 и закрытая дверь';
            else {
              const resumed = st.program.status === 'hold';
              st.program.status = 'running'; ok = true;
              message = resumed ? 'Цикл продолжен с кадра ' + (st.program.index + 1) : 'Цикл запущен';
            }
            break;
          case 'step': {
            if (st.mode !== 'AUTO' || st.program.status !== 'running')
              message = 'Шаг (step) — только во время идущего цикла AUTO';
            else {
              const r = stepOnce(st);
              ok = r.ok; message = r.message; data = r.data || null;
            }
            break;
          }
          case 'hold':
            if(st.program.status!=='running'){message='Нет выполняемого цикла для паузы.';break;}
            st.program.status = 'hold'; ok = true;
            message = 'Пауза на границе кадра: шпиндель и охлаждение остаются включёнными';
            break;
          case 'reset':
            if (st.estop) message = 'Сброс невозможен при нажатом E-STOP — сначала отпустите кнопку';
            else {
              st.alarm = null; st.spindle = false; st.coolant = false;
              st.program.status = st.program.blocks.length ? 'ready' : 'empty';
              st.program.index = 0; ok = true;
              message = 'Сброс выполнен. Геометрия, оси и коррекции сохранены; материал не восстанавливается — ' +
                'повторный прогон снимет меньший слой или пройдёт по воздуху';
            }
            break;
          case 'estop':
            if (action.value) {
              st.estop = true; st.spindle = false; st.coolant = false;
              st.program.status = 'alarm';
              if (!st.alarm || st.alarm.code !== 'E_STOP')
                st.alarm = { code: 'E_STOP', message: 'Нажат аварийный стоп (E-STOP)' };
              ok = true;
              message = 'АВАРИЙНЫЙ СТОП: шпиндель и охлаждение остановлены. Отпустите кнопку и выполните reset';
            } else {
              st.estop = false; ok = true;
              message = 'Кнопка E-STOP отпущена. Авария остаётся активной — выполните reset';
            }
            break;
          case 'measure': {
            const L = st.stock.length;
            if (st.spindle || st.coolant) message = 'Остановите шпиндель и охлаждение для измерения';
            else if (st.doorClosed) message = 'Откройте дверь для измерения';
            else if (st.position.x < st.stock.diameter + 2 - EPS) {
              message = 'Отведите инструмент от поверхности для доступа: фактический X >= ' +
                r3(st.stock.diameter + 2) + ' (сейчас X' + r3(st.position.x) + ')';
            } else if (action.z < -L - EPS || action.z > (st.profile.frontZ??0)+EPS) {
              message = 'Зона измерения — открытая часть заготовки: Z от ' + r3(-L) + ' до 0';
            } else if(['inside-caliper','bore-gauge'].includes(action.instrument)&&!st.profile.bore){message='В заготовке нет отверстия. Выберите наружный замер.';} else {
              const inner=['inside-caliper','bore-gauge'].includes(action.instrument),m = inner?{d:st.profile.bore,boundary:false,taper:false}:measureAt(st.profile, action.z);
              if (m.boundary) message = 'Точка измерения на кромке ступени неоднозначна — сдвиньте Z';
              else {
                const res = ['caliper','inside-caliper'].includes(action.instrument) ? 0.1 : 0.01;
                const reading = quantizeReading(m.d, res);
                const entry = {
                  z: action.z, u: r3(st.stock.length + action.z), actual: r3(m.d),
                  resolution: res, reading: reading, instrument: action.instrument, afterCut: st.cuts.length
                };
                st.readings.push(entry); ok = true;
                message = ({caliper:'Штангенциркуль',micrometer:'Микрометр','inside-caliper':'Внутренние губки','bore-gauge':'Нутромер'})[action.instrument]+': Ø'+reading.toFixed(res===.1?1:2).replace('.',',')+' мм в сечении Z'+action.z+' мм' +
                  (m.taper ? ' — конус: касание упрощено, точность условная' : '');
                data = entry;
              }
            }
            break;
          }
        }
      }
    }
  }
  if (ok) syncPosition(st);
  st.journal.push({ number: num, action: clone(action), ok: ok, message: message });
  return { state: st, ok: ok, message: message, data: data };
}

function measureAt(profile, z) {
  const rs = segRanges(profile);
  for (let i = 0; i < rs.length; i++) {
    const r = rs[i];
    if (z <= r.z0 + 1e-6 && z >= r.z1 - 1e-6) {
      const d = dAt(r, z);
      let boundary = false;
      if (Math.abs(z - r.z1) < 1e-6 && i < rs.length - 1) {
        const nx = rs[i + 1];
        if (Math.abs(dAt(r, r.z1) - dAt(nx, nx.z0)) > 1e-6) boundary = true;
      }
      if (Math.abs(z - r.z0) < 1e-6 && i > 0) {
        const pv = rs[i - 1];
        if (Math.abs(dAt(pv, pv.z1) - dAt(r, r.z0)) > 1e-6) boundary = true;
      }
      return { d: d, taper: Math.abs(r.d0 - r.d1) > 1e-9, boundary: boundary };
    }
  }
  const r = z > 0 ? rs[0] : rs[rs.length - 1];
  return { d: z > 0 ? r.d0 : r.d1, taper: false, boundary: false };
}

function quantizeReading(d, res) {
  const du = umm(d);                    // точный диаметр в целых мкм
  const step = Math.round(res * 1000);  // шаг прибора в мкм
  const units = Math.floor(du / step + 0.5); // половина — вверх
  return r3(units * res);
}

/* ===== Журнал работ ===== */
function newWork(name='Стойка ЧПУ',stock){
  const normalized=validName(name),cfg=create(stock,false);if(!normalized||!cfg)throw Error('Название или параметры заготовки недопустимы.');return {version:2,name:normalized,stock:cfg,events:[],cursor:0};
}
function seek(work,cursor){const restored=restoreWork(work);if(!restored||!Number.isInteger(cursor)||cursor<0||cursor>work.events.length)throw Error('Позиция журнала недопустима.');return {...restored.work,cursor};}

function applyBudgetStop(state,work){
  const prefix=work.cursor===work.events.length?work:{...work,events:work.events.slice(0,work.cursor)};
  if((work.cursor>=MAX_EVENTS||utf8Len(JSON.stringify(prefix))>=MAX_WORK_BYTES-256)&&(activeCycle(state)||state.spindle||state.coolant)){
    state.spindle=false;state.coolant=false;state.program.status='alarm';
    state.alarm={code:'JOURNAL_FULL',message:'Достигнут предел истории работы. Выполнение остановлено. Скачайте работу и создайте новую заготовку.'};
    const last=state.journal.at(-1);if(last)last.message+=' '+state.alarm.message;
  }return state;
}

function restoreWork(work) {
  if (!work || typeof work !== 'object' || Array.isArray(work)) return null;
  const keys = Object.keys(work).slice().sort().join(',');
  if (keys !== 'cursor,events,name,stock,version') return null;
  if (work.version !== 2) return null;
  const name = validName(work.name);
  if (!name) return null;
  const stock = create(work.stock, true);
  if (!stock) return null;
  if (!Array.isArray(work.events) || work.events.length > MAX_EVENTS) return null;
  for (const ev of work.events) if (validateNormalized(ev)) return null;
  if (!Number.isInteger(work.cursor) || work.cursor < 0 || work.cursor > work.events.length) return null;
  const w = { version: 2, name: name, stock: stock, events: clone(work.events), cursor: work.cursor };
  if (utf8Len(JSON.stringify(w)) > MAX_WORK_BYTES) return null;
  let st = initState(stock);
  for (let i = 0; i < w.cursor; i++) {
    const res = transition(st, w.events[i]);
    st = res.state;
  }
  return { work: w, state: applyBudgetStop(st,w) };
}

function execute(work, action) {
  const norm = normalize(action);
  const r = restoreWork(work);
  if (!r) return { ok: false, message: 'Работа не проходит проверку целостности журнала', work: work || null, state: null, data: null };
  if(!norm)throw Error('Действие не распознано или содержит неверные значения.');
  const base = r.work;
  if (base.cursor >= MAX_EVENTS)
    return { work: base, state: r.state, ok: false, message: 'Журнал полон: максимум ' + MAX_EVENTS + ' событий. Начните новую работу', data: null };
  const events = base.events.slice(0, base.cursor).concat([norm]); // хвост redo стирается
  const nw = { version: 2, name: base.name, stock: base.stock, events: events, cursor: events.length };
  if (utf8Len(JSON.stringify(nw)) > MAX_WORK_BYTES)
    return { work: base, state: r.state, ok: false, message: 'Событие не помещается в лимит журнала ' + MAX_WORK_BYTES + ' байт', data: null };
  const res = transition(r.state, norm); // отклонённые попытки тоже попадают в журнал
  applyBudgetStop(res.state,nw);
  if(res.state.alarm?.code==='JOURNAL_FULL')res.message=res.state.alarm.message;
  return { work: nw, state: res.state, ok: res.ok, message: res.message, data: res.data };
}

/* ===== Отображение ===== */
function display(state) {
  if (!state || typeof state !== 'object' || !state.axes)
    return { machine: { x: 0, z: 0 }, work: { x: 0, z: 0 }, actual: { x: 0, z: 0 }, rpm: 0, phase: 'unknown', ready: false };
  const p = actualPos(state), w = workPos(state);
  return {
    machine: { x: r3(state.axes.x), z: r3(state.axes.z) },
    work: { x: r3(w.x), z: r3(w.z) },
    actual: { x: r3(p.x), z: r3(p.z) },
    rpm: r3(effectiveRpm(state)),
    phase: state.program && state.program.status ? state.program.status : 'empty',
    ready: !!(state.referenced && state.clamped && state.doorClosed && state.tool && state.offsets[String(state.tool)].calibrated && state.workOffset.confirmed && !state.estop && !state.alarm)
  };
}

/* ===== Предпросмотр программы (без мутаций работы и реального состояния) ===== */
function graphics(work, source) {
  const empty = { path: [], profile: null, alarm: null, position: null, steps: 0 };
  const r = restoreWork(work);
  if (!r) return Object.assign({ ok: false, message: 'Работа не проходит проверку целостности журнала' }, empty);
  const st = r.state; // свежие объекты — оригинал не затрагивается
  const need = [];
  if (st.estop) need.push('отпустите E-STOP и выполните reset');
  else if (st.alarm) need.push('сбросьте аварию (reset)');
  if (!st.referenced) need.push('привязка осей (reference)');
  if (!st.clamped) need.push('зажим детали (clamp)');
  if (!st.doorClosed) need.push('закройте дверь');
  if (!st.tool) need.push('выберите инструмент');
  else if (!st.offsets[String(st.tool)].calibrated) need.push('привяжите инструмент (preset)');
  if (need.length)
    return Object.assign({ ok: false, message: 'Эмуляция невозможна — настройка не завершена: ' + need.join('; ') },
      { path: [], profile: st.profile, alarm: null, position: clone(st.position), steps: 0 });
  const parsed = parseProgram(typeof source === 'string' ? source : '');
  if (!parsed.ok)
    return Object.assign({ ok: false, message: parsed.message },
      { path: [], profile: st.profile, alarm: null, position: clone(st.position), steps: 0 });
  st.mode = 'AUTO';st.path=[]; // только в клоне; показываем путь новой проверки
  st.program = { source: typeof source === 'string' ? source : '', blocks: parsed.blocks, index: 0, status: 'ready' };
  if (!parsed.blocks.length)
    return Object.assign({ ok: true, message: 'Программа не содержит исполняемых кадров' },
      { path: [], profile: st.profile, alarm: null, position: clone(st.position), steps: 0 });
  st.program.status = 'running';
  let guard = 0;
  while (guard < MAX_LINES+1) {
    if (st.program.status === 'done') break;
    if (st.program.status === 'hold') st.program.status = 'running'; // только графика продолжает после M00
    if (st.program.status !== 'running') break;
    stepOnce(st);guard++;
  }
  const alarm = st.alarm;
  return {
    ok: !alarm&&st.program.status==='done',
    message: alarm
      ? 'Эмуляция прервана аварией [' + alarm.code + ']: ' + alarm.message
      : st.program.status==='done'?'Эмуляция завершена успешно':'Графика прервана: выполнение не завершено.',
    path: clone(st.path),
    profile: clone(st.profile),
    alarm: alarm ? clone(alarm) : null,
    position: clone(st.position),
    tool: st.tool,
    steps: guard
  };
}

function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
freeze(TOOLS);freeze(LIMITS);freeze(DIALECT);
/* ===== Экспорт ===== */
return {
  tools: TOOLS,
  limits: LIMITS,
  dialect: DIALECT,
  MAX_EVENTS: MAX_EVENTS,
  MAX_SOURCE: MAX_SOURCE,
  MAX_LINES: MAX_LINES,
  MAX_WORK_BYTES: MAX_WORK_BYTES,
  create: function(stock){const cfg=create(stock,false);if(!cfg)throw Error('Недопустимая заготовка.');return initState(cfg);},
  newWork: newWork,
  normalize: normalize,
  transition: transition,
  restoreWork: restoreWork,
  execute: execute,
  seek: seek,
  display: display,
  graphics: graphics
};
});
