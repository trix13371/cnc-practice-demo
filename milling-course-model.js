(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CNCMillingCourse = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const copy = (x) => JSON.parse(JSON.stringify(x)),
    freeze = (x) => {
      if (x && typeof x === "object") {
        Object.values(x).forEach(freeze);
        Object.freeze(x);
      }
      return x;
    },
    EPS = 1e-8;
  const config = freeze({
    holder: { radius: 12, z0: 8, z1: 28 },
    body: {
      id: "column",
      title: "Колонна корпуса",
      x0: 54,
      x1: 62,
      y0: -18,
      y1: -8,
      z0: -10,
      z1: 35,
    },
    radius: 3,
    cell: 2,
    nx: 30,
    ny: 20,
    maxDepth: 1,
    stock: { x: 60, y: 40, thickness: 10 },
    clamp: { x0: 25, x1: 35, y0: 24, y1: 32, z0: -10, z1: 8 },
    limits: { x: [-20, 80], y: [-20, 60], z: [-12, 40] },
  });
  const lessons = freeze([
    {
      id: "xyz-air",
      title: "Три оси · движения в воздухе",
      level: 1,
      originY: 10,
      points: [
        [10, 10, 20],
        [10, 30, 20],
        [10, 30, 12],
        [50, 30, 12],
      ],
      depth: 0,
      goal: "Пройдите точки по порядку: X10 Y10 Z20 → X10 Y30 Z20 → X10 Y30 Z12 → X50 Y30 Z12. Материал не снимать.",
      learn:
        "На фрезерном станке X и Y задают положение на плите, Z — высоту вершины фрезы. Z0 — верх заготовки, положительный Z над ней. Все размеры здесь линейные, X не диаметр. Вращается инструмент; координаты в рабочей системе G54.",
      hint: "Меняйте сначала X, затем Y, затем Z. Над креплением высотой 8 мм заданная высота 12 мм оставляет запас.",
    },
    {
      id: "clamp-crossing",
      title: "Пересечение с креплением",
      level: 2,
      originY: 28,
      points: [[70, 28, 12]],
      depth: 0,
      required: "FIXTURE",
      goal: "На копии проверьте быстрый ход из X−10 Y28 Z5 в X70 Y28 Z5. Найдите пересечение с зоной крепления. Затем реально проведите инструмент к X70 Y28 Z12 безопасным маршрутом.",
      learn:
        "Безопасные начальная и конечная точки ещё не делают траекторию безопасной. Проверяется весь отрезок, включая диаметр инструмента. Зона крепления: X25…35, Y24…32, верх Z8. Красная линия показывает отвергнутую проверку, деталь при этом не меняется.",
      hint: "Сначала поднимитесь/останетесь на Z12 или выше, затем переносите X над креплением. Для получения нужной ошибки на копии нужен именно указанный низкий диагональный ход.",
    },
    {
      id: "rapid-stock",
      title: "Быстрый ход в материал · первый паз",
      level: 3,
      originY: 10,
      points: [],
      slot: [10, 50, 10],
      depth: 1,
      required: "RAPID_STOCK",
      goal: "На копии обнаружьте опасное заглубление G0: X10 Y10 Z−1. Затем фрезой Ø6 обработайте паз по центру Y10 от X10 до X50 на глубине 1 мм. Выполните отвод, остановку и контроль дна.",
      learn:
        "G0 — быстрый ход: входить им в материал нельзя. G1 — рабочая подача. Используется учебная концевая фреза с разрешённым осевым врезанием. За один проход допускается 1 мм нового съёма. Ширина паза равна диаметру фрезы, концы округлены.",
      hint: "Подойдите в воздухе к X10 Y10 Z5. При включённом шпинделе заглубитесь G1 до Z−1, затем ведите G1 к X50. Для выхода поднимите Z над заготовкой, остановите шпиндель и откройте ограждение.",
    },
    {
      id: "depth-layers",
      title: "Глубокий паз · слои и исправление",
      level: 4,
      originY: 10,
      points: [],
      slot: [10, 50, 10],
      depth: 2,
      required: "DEPTH",
      goal: "Подойдите в воздухе к X10 Y10 Z5. На копии обнаружьте превышение глубины при G1 к X10 Y10 Z−2 на новой заготовке с включённым шпинделем. Затем изготовьте тот же паз глубиной 2 мм слоями не более 1 мм и проконтролируйте дно.",
      learn:
        "Предел действует на новый съём в каждой ячейке материала. Уже пройденный участок не разрешает сразу снимать 2 мм на соседнем. RESET останавливает вращение и сбрасывает ошибку, но не возвращает металл.",
      hint: "Первый слой — весь паз на Z−1. На обработанном конце можно заглубиться до Z−2 и пройти паз обратно. Нельзя сразу заглубляться до Z−2 на необработанном участке.",
    },
    {
      id: "holder-clearance",
      title: "Фреза проходит · державка задевает",
      level: 5,
      originX: -20,
      originY: 43.5,
      originZ: -1,
      points: [[60, 43.5, 12]],
      depth: 0,
      required: "HOLDER_FIXTURE",
      goal: "Проверьте на копии ход X−20 Y43,5 Z−1 → X60 Y43,5 Z−1. Фреза Ø6 проходит снаружи плиты и крепления, но державка Ø24 задевает крепление. Проведите сборку к X60 Y43,5 Z12 безопасным маршрутом.",
      learn:
        "Свободный путь фрезы не гарантирует свободный путь всей сборки. Державка занимает радиус 12 мм и высоты от Z вершины +8 до +28. При Z−1 низ державки находится на Z7, ниже верха крепления Z8. Сначала проверьте высоту и внешний габарит, затем перенос.",
      hint: "На исходном X−20 поднимите вершину к Z12, затем перенесите по X к 60 при Y43,5. В этих координатах фреза проходит мимо плиты, а державка уже выше крепления.",
    },
    {
      id: "machine-column",
      title: "Обход корпуса станка",
      level: 5,
      originX: -20,
      originY: -15,
      originZ: 20,
      points: [[80, -15, 20]],
      depth: 0,
      required: "MACHINE_BODY",
      goal: "Проверьте на копии ход X−20 Y−15 Z20 → X80 Y−15 Z20. По середине пути расположена колонна корпуса. Исправьте маршрут и достигните X80 Y−15 Z20, обойдя колонну.",
      learn:
        "Пределы осей и столкновения — разные проверки. Обе конечные точки могут быть в пределах перемещений и вне препятствия, но сборка пересечёт корпус между ними. Колонна: X54…62, Y−18…−8, Z−10…35. Проверяется фреза и державка; указывается часть, которая первой вошла в запрещённую зону.",
      hint: "На X−20 перейдите к Y12 при Z20, перенесите X к 80, затем вернитесь к Y−15. Учтите радиус державки 12 мм, а не только радиус фрезы 3 мм.",
    },
    {
      id: "setup-datums",
      title: "Наладка XYZ · G54 и длина фрезы",
      level: 2,
      originY: 10,
      points: [
        [10, 10, 20],
        [10, 16, 20],
        [10, 16, 12],
      ],
      depth: 0,
      numerical: true,
      goal: "По паспорту введите G54 и длину фрезы. Проверьте наладку, затем пройдите X10 Y10 Z20 → X10 Y16 Z20 → X10 Y16 Z12 без резания.",
      learn:
        "Референс задаёт машинную систему. G54 переносит рабочий ноль к углу и верху плиты; длина инструмента связывает базовую точку шпинделя с вершиной фрезы. X/Y/Z здесь линейные. После смены установки прежнее подтверждение недействительно.",
      hint: "Паспорт: машинные X120 Y80 и верх Z50 (либо Z52 после смены установки). Измеренная длина фрезы 50 мм, диаметр 6 мм. Запишите значения и проверьте наладку при открытом ограждении, затем закройте его и выполните точки.",
    },
    {
      id: "face-coverage",
      title: "Плоскость · перекрытие проходов",
      level: 3,
      originY: 1,
      points: [],
      depth: 1,
      numerical: true,
      area: { x0: 0, x1: 40, y0: 0, y1: 10 },
      allow: { x0: 0, x1: 44, y0: 0, y1: 14 },
      checks: [
        [5, 1],
        [21, 5],
        [37, 9],
      ],
      goal: "Фрезой Ø6 снимите 1 мм на открытой полосе X0…40, Y0…10. Технологический выход разрешён до X44 и Y14; остальная плита должна сохраниться. Проверьте три участка плоскости.",
      learn:
        "Один проход снимает полосу шириной фрезы. При шаге больше диаметра между ходами останется гребень. Обязательная зона и допустимый выход отмечены отдельно. Приёмка проверяет всю зону, а не только три измерения.",
      hint: "Например, при Z−1 пройдите по X от −4 до 40 на Y1, затем на Y5 и Y9. Шаг 4 мм для Ø6 даёт перекрытие 2 мм. Для смены полосы можно отводиться на Z12. Перед контролем отведите инструмент, остановите шпиндель и откройте ограждение.",
    },
    {
      id: "slot-open",
      title: "Открытый паз · ширина фрезы",
      level: 3,
      originY: 7,
      points: [],
      depth: 1,
      numerical: true,
      area: { x0: 0, x1: 40, y0: 4, y1: 10 },
      allow: { x0: 0, x1: 44, y0: 4, y1: 10 },
      checks: [
        [5, 7],
        [21, 7],
        [37, 7],
      ],
      goal: "Выполните открытый слева паз шириной 6 мм: X0…40, Y4…10, глубина 1 мм. У правого конца разрешён округлый выход до X44. Расширять паз по Y нельзя.",
      learn:
        "Координаты задают ось фрезы, а материал снимается вокруг неё на радиус 3 мм. Для паза Y4…10 ось одного прохода находится на Y7. Это паз с округлым закрытым концом. Проверка дискретная, по сетке 2 мм.",
      hint: "Подойдите снаружи плиты на X−4 Y7 Z5, включите шпиндель, отдельно опустите вершину до Z−1 и ведите G1 к X40. Отведите инструмент и проконтролируйте дно в трёх сечениях.",
    },
    {
      id: "slot-wide-layers",
      title: "Широкий паз · шаг и два слоя",
      level: 4,
      originY: 5,
      points: [],
      depth: 2,
      numerical: true,
      area: { x0: 0, x1: 40, y0: 2, y1: 12 },
      allow: { x0: 0, x1: 44, y0: 2, y1: 12 },
      checks: [
        [5, 3],
        [21, 7],
        [37, 11],
      ],
      goal: "Выполните открытый паз шириной 10 мм: X0…40, Y2…12, глубина 2 мм. Фреза Ø6, новый съём не более 1 мм за проход. Разрешён округлый выход до X44; соседние поверхности сохранить.",
      learn:
        "Широкий паз требует нескольких параллельных ходов. Углубление обработанного участка не разрешает снимать сразу два миллиметра на соседнем. Каждый слой должен покрыть всю ширину. Новый съём отменяет прежние отсчёты.",
      hint: "В каждом слое используйте оси проходов Y5 и Y9: шаг 4 мм, перекрытие 2 мм. Сначала обе полосы на Z−1, затем обе на Z−2. Для смены полосы отводитесь к Z12, возвращайтесь снаружи к X−4 и отдельно заглубляйтесь.",
    },
  ]);
  const faults = freeze({
    HOLDER_FIXTURE: [
      "Державка пересекает крепление",
      "Проверьте весь габарит сборки: поднимите её перед переносом или измените обход.",
    ],
    HOLDER_STOCK: [
      "Державка пересекает заготовку",
      "Проверьте вылет фрезы и глубину; в этом профиле геометрия сборки фиксирована.",
    ],
    MACHINE_BODY: [
      "Сборка пересекает корпус станка",
      "Обойдите колонну с запасом на радиус и высоту всей сборки; допустимые координаты осей сами по себе не гарантируют свободного пути.",
    ],
    SETUP: [
      "Установка не подготовлена",
      "Выполните референс, закрепление, измерение фрезы, подтверждение G54 и закройте ограждение.",
    ],
    ALARM: [
      "Активна ошибка",
      "Прочитайте причину и выполните RESET; снятый материал сохранится.",
    ],
    TRAVEL: [
      "Выход за пределы перемещения",
      "Сопоставьте X/Y/Z с пределами учебной установки.",
    ],
    FIXTURE: [
      "Пересечение с зоной крепления",
      "Поднимите вершину выше Z8 с запасом до осевого переноса или обойдите крепление. Учтён радиус фрезы.",
    ],
    RAPID_STOCK: [
      "Быстрый ход пересекает габарит заготовки",
      "Сделайте подход в воздухе; вход в материал выполняйте рабочей подачей. Внутри габарита допускается только вертикальный выход G0 вверх, без осевого переноса.",
    ],
    SPINDLE: [
      "Резание при выключенном шпинделе",
      "Включите шпиндель после наладки.",
    ],
    DEPTH: [
      "Превышен съём за проход",
      "Разбейте обработку на слои до 1 мм нового съёма в каждой ячейке.",
    ],
    INTERPOLATION: [
      "Неподдерживаемый наклонный вход",
      "В этом профиле отдельно задайте вертикальное врезание и движение X/Y на постоянном Z.",
    ],
    TABLE: [
      "Пересечение с основанием заготовки",
      "Не опускайте фрезу ниже нижней поверхности плиты.",
    ],
  });
  function failure(code, point = null, part = null, obstacle = null) {
    return {
      ok: false,
      code,
      title: faults[code][0],
      advice: faults[code][1],
      point,
      part,
      obstacle,
    };
  }
  function exact(a, keys) {
    if (
      !a ||
      typeof a !== "object" ||
      Array.isArray(a) ||
      Object.keys(a).sort().join(",") !== keys.sort().join(",")
    )
      throw Error("Неверная запись фрезерного задания.");
  }
  function finite(n) {
    return typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 1000;
  }
  function segmentBox(a, b, lo, hi) {
    let t0 = 0,
      t1 = 1;
    for (const k of ["x", "y", "z"]) {
      const d = b[k] - a[k];
      if (Math.abs(d) < EPS) {
        if (a[k] < lo[k] - EPS || a[k] > hi[k] + EPS) return null;
      } else {
        let u = (lo[k] - a[k]) / d,
          v = (hi[k] - a[k]) / d;
        if (u > v) [u, v] = [v, u];
        t0 = Math.max(t0, u);
        t1 = Math.min(t1, v);
        if (t0 > t1 + EPS) return null;
      }
    }
    return {
      x: a.x + (b.x - a.x) * t0,
      y: a.y + (b.y - a.y) * t0,
      z: a.z + (b.z - a.z) * t0,
    };
  }
  function distance(x, y, a, b) {
    const dx = b.x - a.x,
      dy = b.y - a.y,
      den = dx * dx + dy * dy,
      t = den
        ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / den))
        : 0;
    return Math.hypot(x - a.x - dx * t, y - a.y - dy * t);
  }
  function inside(i, box) {
    const x = (i % 30) * 2 + 1,
      y = Math.floor(i / 30) * 2 + 1;
    return x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1;
  }
  function prepared(s) {
    return (
      !lessons[s.current].numerical ||
      (s.verifiedRevision === s.setupRevision &&
        s.setup.reference &&
        s.setup.clamped &&
        s.setup.tool &&
        s.setup.zero)
    );
  }
  function invalidate(s) {
    s.setupRevision++;
    s.verifiedRevision = null;
    s.setup.tool = false;
    s.setup.zero = false;
    s.measurements = {};
  }
  function coordinates(s) {
    if (!lessons[s.current].numerical)
      return { work: copy(s.position), machine: null };
    const v = s.settings;
    return {
      machine: {
        x: s.position.x + 120,
        y: s.position.y + 80,
        z: s.position.z + s.mountTop + 50,
      },
      work: {
        x: s.position.x + 120 - v.zero.x,
        y: s.position.y + 80 - v.zero.y,
        z: s.position.z + s.mountTop + 50 - v.length - v.zero.z,
      },
    };
  }
  function coverage(s) {
    const t = lessons[s.current];
    if (!t.area) return null;
    let total = 0,
      complete = 0,
      remaining = 0,
      overcut = 0;
    for (let i = 0; i < 600; i++) {
      if (inside(i, t.area)) {
        total++;
        if (Math.abs(s.grid[i] + t.depth) < EPS) complete++;
        else if (s.grid[i] > -t.depth + EPS) remaining++;
        else overcut++;
      } else if (s.grid[i] < (inside(i, t.allow) ? -t.depth : 0) - EPS)
        overcut++;
    }
    return {
      total,
      complete,
      remaining,
      overcut,
      percent: Math.floor((complete / total) * 100),
    };
  }
  function initial(i) {
    return {
      ...(lessons[i].numerical
        ? {
            mountTop: 50,
            settings: { zero: { x: 0, y: 0, z: 0 }, length: 0, diameter: 6 },
            setupRevision: 0,
            verifiedRevision: null,
          }
        : {}),
      position: {
        x: lessons[i].originX ?? -10,
        y: lessons[i].originY,
        z: lessons[i].originZ ?? (i === 1 ? 5 : 20),
      },
      setup: {
        reference: false,
        clamped: false,
        tool: false,
        zero: false,
        door: false,
      },
      spindle: false,
      grid: Array(600).fill(0),
      path: [],
      fault: null,
      cuts: 0,
      measurements: {},
      visited: 0,
      probes: [],
    };
  }
  function create(baseline = 3) {
    if (![1, 2, 3].includes(baseline)) throw Error("Неизвестный профиль.");
    return {
      version: baseline,
      baseline,
      profile: baseline,
      events: [],
      current: 0,
      done: [],
      errors: Array(baseline === 1 ? 4 : baseline === 2 ? 6 : 10).fill(0),
      help: [],
      incidents: [],
      feedback: "",
      lastCheck: null,
      ...initial(0),
    };
  }
  function ready(s) {
    return Object.values(s.setup).every(Boolean) && prepared(s);
  }
  function lessonCount(s) {
    return s.profile === 1 ? 4 : s.profile === 2 ? 6 : lessons.length;
  }
  function collision(s, a) {
    const from = s.position,
      to = { x: a.x, y: a.y, z: a.z },
      c = config.clamp,
      b = config.body,
      hits = [],
      parts = [
        { id: "cutter", title: "Фреза", radius: 3, z0: 0, z1: 15 },
        { id: "holder", title: "Державка", ...config.holder },
      ];
    const obstacles = [
      { id: "fixture", title: "Крепление", ...c },
      { ...b },
      {
        id: "stock",
        title: "Заготовка",
        x0: 0,
        x1: 60,
        y0: 0,
        y1: 40,
        z0: -10,
        z1: 0,
      },
    ];
    const retract =
      Math.abs(to.x - from.x) < EPS &&
      Math.abs(to.y - from.y) < EPS &&
      to.z > from.z + EPS;
    for (const part of parts)
      for (const obstacle of obstacles) {
        if (
          obstacle.id === "stock" &&
          part.id === "cutter" &&
          (a.mode !== "G0" || retract)
        )
          continue;
        const point = segmentBox(
          from,
          to,
          {
            x: obstacle.x0 - part.radius,
            y: obstacle.y0 - part.radius,
            z: obstacle.z0 - part.z1,
          },
          {
            x: obstacle.x1 + part.radius,
            y: obstacle.y1 + part.radius,
            z: obstacle.z1 - part.z0,
          },
        );
        if (!point) continue;
        const delta = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z },
          length2 = delta.x ** 2 + delta.y ** 2 + delta.z ** 2,
          fraction = length2
            ? ((point.x - from.x) * delta.x +
                (point.y - from.y) * delta.y +
                (point.z - from.z) * delta.z) /
              length2
            : 0;
        const code =
          obstacle.id === "column"
            ? "MACHINE_BODY"
            : obstacle.id === "stock"
              ? part.id === "holder"
                ? "HOLDER_STOCK"
                : "RAPID_STOCK"
              : part.id === "holder"
                ? "HOLDER_FIXTURE"
                : "FIXTURE";
        hits.push({
          ...failure(code, point, part.title, obstacle.title),
          fraction,
        });
      }
    hits.sort((a, b) => a.fraction - b.fraction);
    return hits[0] || null;
  }
  function plan(s, a) {
    if (!ready(s)) return failure("SETUP");
    if (s.fault) return failure("ALARM");
    const from = s.position,
      to = { x: a.x, y: a.y, z: a.z };
    for (const k of ["x", "y", "z"])
      if (to[k] < config.limits[k][0] || to[k] > config.limits[k][1])
        return failure("TRAVEL", to);
    const c = config.clamp,
      r = config.radius;
    if (s.profile >= 2) {
      const hit = collision(s, a);
      if (hit) return hit;
    } else {
      const hit = segmentBox(
        from,
        to,
        { x: c.x0 - r, y: c.y0 - r, z: c.z0 - 15 },
        { x: c.x1 + r, y: c.y1 + r, z: c.z1 },
      );
      if (hit) return failure("FIXTURE", hit);
    }
    const stockHit = segmentBox(
      from,
      to,
      { x: -r, y: -r, z: -25 },
      { x: 60 + r, y: 40 + r, z: 0 },
    );
    const retract =
      Math.abs(to.x - from.x) < EPS &&
      Math.abs(to.y - from.y) < EPS &&
      to.z > from.z + EPS;
    if (s.profile === 1 && a.mode === "G0" && stockHit && !retract)
      return failure("RAPID_STOCK", stockHit);
    const grid = s.grid.slice();
    let removed = 0;
    if (a.mode === "G1" && stockHit) {
      if (Math.min(from.z, to.z) < -10 - EPS) return failure("TABLE");
      if (!s.spindle) return failure("SPINDLE");
      if (
        Math.abs(from.z - to.z) > EPS &&
        Math.hypot(from.x - to.x, from.y - to.y) > EPS
      )
        return failure("INTERPOLATION");
      const z = Math.min(from.z, to.z);
      for (let iy = 0; iy < 20; iy++)
        for (let ix = 0; ix < 30; ix++) {
          if (distance(ix * 2 + 1, iy * 2 + 1, from, to) > r + EPS) continue;
          const i = iy * 30 + ix;
          if (grid[i] - z > 1 + EPS)
            return failure("DEPTH", { x: ix * 2 + 1, y: iy * 2 + 1, z });
          if (z < grid[i]) {
            removed += grid[i] - z;
            grid[i] = z;
          }
        }
    }
    return { ok: true, grid, from: copy(from), to, removed, mode: a.mode };
  }
  function target(t) {
    if (t.area)
      return Array.from({ length: 600 }, (_, i) =>
        inside(i, t.area) ? -t.depth : 0,
      );
    if (!t.slot) return Array(600).fill(0);
    const a = { x: t.slot[0], y: t.slot[2] },
      b = { x: t.slot[1], y: t.slot[2] };
    return Array.from({ length: 600 }, (_, i) =>
      distance((i % 30) * 2 + 1, Math.floor(i / 30) * 2 + 1, a, b) <= 3 + EPS
        ? -t.depth
        : 0,
    );
  }
  function profileMatches(s, t) {
    const wanted = target(t);
    return s.grid.every((z, i) =>
      t.area
        ? inside(i, t.area)
          ? Math.abs(z + t.depth) < EPS
          : inside(i, t.allow)
            ? z <= EPS && z >= -t.depth - EPS
            : Math.abs(z) < EPS
        : Math.abs(z - wanted[i]) < EPS,
    );
  }
  function inspected(s) {
    if (lessons[s.current].area)
      return lessons[s.current].checks.every(([x, y]) => {
        const r = s.measurements[x + "," + y];
        return (
          r &&
          r.afterCut === s.cuts &&
          r.revision === s.setupRevision &&
          r.value === -lessons[s.current].depth
        );
      });
    return [13, 31, 49].every((x) => {
      const r = s.measurements[x];
      return (
        r && r.afterCut === s.cuts && r.value === -lessons[s.current].depth
      );
    });
  }
  function apply(state, a) {
    if (state.events.length >= (state.profile === 3 ? 480 : 240))
      throw Error("Журнал заполнен; данные сохранены.");
    const fields = {
      mount: ["type", "top"],
      configure: ["type", "zero", "length", "diameter"],
      verifySetup: ["type"],
      surface: ["type", "x", "y"],
      setup: ["type", "key", "value"],
      spindle: ["type", "value"],
      move: ["type", "x", "y", "z", "mode"],
      preview: ["type", "x", "y", "z", "mode"],
      reset: ["type"],
      measure: ["type", "x"],
      confirm: ["type"],
      next: ["type"],
      hint: ["type"],
      upgrade: ["type"],
    };
    if (!a || !Object.hasOwn(fields, a.type))
      throw Error("Неизвестное действие.");
    exact(a, fields[a.type]);
    const s = copy(state),
      t = lessons[s.current],
      accepted = s.done.some((d) => d.id === t.id);
    if (accepted && !["next", "upgrade"].includes(a.type))
      throw Error("Задание принято. Перейдите дальше.");
    if (
      ["mount", "configure", "verifySetup", "surface"].includes(a.type) &&
      !t.numerical
    )
      throw Error("Действие недоступно в прежнем профиле.");
    switch (a.type) {
      case "mount":
        if (
          ![50, 52].includes(a.top) ||
          s.spindle ||
          s.setup.door ||
          s.position.z < 12 ||
          s.position.z + s.mountTop - a.top < 12 ||
          s.cuts
        )
          throw Error(
            "Смена установки: до резания, с отводом Z≥12, при открытом ограждении и остановке.",
          );
        s.position.z += s.mountTop - a.top;
        s.mountTop = a.top;
        s.setup.clamped = false;
        invalidate(s);
        s.feedback =
          "Верх установлен на машинной Z" +
          a.top +
          ". Закрепите плиту и заново проверьте G54 и длину инструмента.";
        break;
      case "configure":
        exact(a.zero, ["x", "y", "z"]);
        if (
          !Object.values(a.zero).every(finite) ||
          !finite(a.length) ||
          a.length <= 0 ||
          a.length > 200 ||
          a.diameter !== 6
        )
          throw Error(
            "Введите числовые G54 и длину больше 0, не более 200 мм. В паспорте установлена фреза Ø6.",
          );
        if (s.spindle || s.setup.door || s.position.z < 12)
          throw Error(
            "Изменять наладку можно после отвода Z≥12, остановки и открытия ограждения.",
          );
        s.settings = {
          zero: copy(a.zero),
          length: a.length,
          diameter: a.diameter,
        };
        invalidate(s);
        s.feedback = "Значения записаны. Выполните проверку текущей наладки.";
        break;
      case "verifySetup":
        if (
          s.spindle ||
          s.setup.door ||
          s.position.z < 12 ||
          s.fault ||
          !s.setup.reference ||
          !s.setup.clamped
        )
          throw Error(
            "Нужны референс, закрепление, отвод, остановка и открытое ограждение без ошибки.",
          );
        if (
          ["x", "y", "z"].every(
            (k) =>
              Math.abs(
                s.settings.zero[k] - { x: 120, y: 80, z: s.mountTop }[k],
              ) < EPS,
          ) &&
          Math.abs(s.settings.length - 50) < EPS
        ) {
          s.verifiedRevision = s.setupRevision;
          s.setup.tool = true;
          s.setup.zero = true;
          s.feedback =
            "G54 и длина фрезы соответствуют паспорту текущей установки. Перед движением закройте ограждение.";
        } else {
          invalidate(s);
          s.feedback =
            "Наладка не подтверждена: G54 или длина не соответствуют паспорту. Сверьте машинный верх и измеренную длину; координаты показаны для введённых величин.";
        }
        break;
      case "surface":
        if (!t.area || !t.checks.some(([x, y]) => x === a.x && y === a.y))
          throw Error("Выберите заданную точку контроля.");
        if (
          s.spindle ||
          s.setup.door ||
          s.position.z < 12 ||
          s.fault ||
          !prepared(s)
        )
          throw Error(
            "Для контроля нужны подтверждённая наладка, Z≥12, остановка и открытое ограждение.",
          );
        {
          const value = s.grid[Math.floor(a.y / 2) * 30 + Math.floor(a.x / 2)];
          s.measurements[a.x + "," + a.y] = {
            x: a.x,
            y: a.y,
            value,
            afterCut: s.cuts,
            revision: s.setupRevision,
          };
          s.feedback =
            "Контроль X" +
            a.x +
            " Y" +
            a.y +
            ": фактическая поверхность Z" +
            value +
            " мм в текущей ячейке.";
        }
        break;
      case "setup":
        if (!Object.hasOwn(s.setup, a.key) || typeof a.value !== "boolean")
          throw Error("Неверное действие наладки.");
        if (s.spindle) throw Error("Сначала остановите шпиндель.");
        if (t.numerical && ["tool", "zero"].includes(a.key))
          throw Error("G54 и длина подтверждаются числовой проверкой наладки.");
        s.setup[a.key] = a.value;
        if (t.numerical && a.key !== "door") invalidate(s);
        s.feedback = "Состояние наладки обновлено.";
        break;
      case "spindle":
        if (typeof a.value !== "boolean") throw Error("Неверное состояние.");
        if (a.value && (!ready(s) || s.fault))
          throw Error("Нужна подготовленная установка без активной ошибки.");
        s.spindle = a.value;
        s.feedback = a.value
          ? "Шпиндель включён в модели."
          : "Шпиндель выключен в модели.";
        break;
      case "preview":
      case "move": {
        if (
          !["G0", "G1"].includes(a.mode) ||
          !["x", "y", "z"].every((k) => finite(a[k]))
        )
          throw Error("Введите конечные X/Y/Z и режим G0/G1.");
        const result = plan(s, a);
        const { grid: unused, ...check } = result;
        s.lastCheck = {
          ...check,
          from: copy(s.position),
          to: { x: a.x, y: a.y, z: a.z },
          preview: a.type === "preview",
        };
        if (!result.ok) {
          if (a.type === "move") s.errors[s.current]++;
          s.incidents.push({
            lesson: t.id,
            code: result.code,
            preview: a.type === "preview",
            from: copy(s.position),
            to: { x: a.x, y: a.y, z: a.z },
            point: result.point,
            part: result.part,
            obstacle: result.obstacle,
          });
          s.feedback =
            result.code +
            ": " +
            result.title +
            (result.part ? " · " + result.part + " / " + result.obstacle : "") +
            ". " +
            result.advice;
          if (a.type === "preview") s.probes.push(result.code);
          else {
            s.fault = result;
            s.spindle = false;
          }
          break;
        }
        if (a.type === "preview") {
          s.feedback =
            "Проверка на копии: путь допустим. Положение и заготовка не изменились.";
          break;
        }
        s.grid = result.grid;
        s.position = result.to;
        s.path.push({
          from: result.from,
          to: result.to,
          mode: a.mode,
          cutting: result.removed > 0,
        });
        if (result.removed > 0) {
          s.cuts++;
          s.measurements = {};
        }
        const point = t.points[s.visited];
        if (
          point &&
          ["x", "y", "z"].every(
            (k, i) => Math.abs(s.position[k] - point[i]) < EPS,
          )
        )
          s.visited++;
        s.feedback =
          result.removed > 0
            ? "Рабочее движение: материал снят в модели сетки."
            : "Движение в воздухе выполнено.";
        break;
      }
      case "reset":
        s.fault = null;
        s.spindle = false;
        s.feedback =
          "RESET: ошибка сброшена, вращение остановлено; материал и положение сохранены.";
        break;
      case "measure":
        if (![13, 31, 49].includes(a.x) || !t.slot)
          throw Error("Выберите предусмотренную точку контроля.");
        if (s.spindle || s.setup.door || s.position.z < 12 || s.fault)
          throw Error(
            "Для контроля остановите вращение, отведите Z≥12 и откройте ограждение.",
          );
        {
          const ix = Math.floor(a.x / 2),
            iy = Math.floor(t.slot[2] / 2),
            value = s.grid[iy * 30 + ix];
          s.measurements[a.x] = {
            x: a.x,
            y: iy * 2 + 1,
            value,
            afterCut: s.cuts,
          };
          s.feedback =
            "Модельный отсчёт поверхности при X" +
            a.x +
            " Y" +
            (iy * 2 + 1) +
            ": Z" +
            value +
            " мм. Это значение ячейки сетки без погрешности прибора.";
          break;
        }
      case "confirm": {
        const valid =
          prepared(s) &&
          s.visited === t.points.length &&
          (!t.required || s.probes.includes(t.required)) &&
          !s.fault &&
          !s.spindle &&
          Object.entries(s.setup).every(([k, v]) => k === "door" || v) &&
          s.position.z >= 12 &&
          profileMatches(s, t) &&
          (!(t.slot || t.area) || inspected(s));
        if (!valid) {
          s.errors[s.current]++;
          s.feedback =
            "Не выполнены все условия: точки маршрута, требуемая диагностика на копии, остановка, отвод, профиль и свежий контроль.";
        } else {
          s.done.push({
            id: t.id,
            errors: s.errors[s.current],
            help: s.help.includes(t.id),
            cuts: s.cuts,
            measurements: copy(s.measurements),
            diagnostics: copy(s.probes),
            incidents: copy(s.incidents.filter((e) => e.lesson === t.id)),
          });
          s.feedback = "Задание принято в учебной модели.";
        }
        break;
      }
      case "next":
        if (!accepted || s.current === lessonCount(s) - 1)
          throw Error("Следующий этап пока недоступен.");
        s.current++;
        Object.assign(s, initial(s.current));
        s.feedback =
          "Новая учебная установка. Предыдущие результаты сохранены.";
        break;
      case "upgrade":
        if (s.profile === 2 && s.current === 5 && accepted) {
          s.profile = 3;
          s.version = 3;
          s.current = 6;
          s.errors.push(0, 0, 0, 0);
          Object.assign(s, initial(6));
          s.feedback =
            "Шесть результатов сохранены. Продолжение: числовая наладка и покрытие.";
          break;
        }
        if (s.profile !== 1 || s.current !== 3 || !accepted)
          throw Error("Переход доступен после четырёх прежних заданий.");
        s.profile = 2;
        s.version = 2;
        s.current = 4;
        s.errors.push(0, 0);
        Object.assign(s, initial(4));
        s.feedback =
          "Прежние результаты сохранены. Продолжение проверяет всю сборку и корпус.";
        break;
      case "hint":
        if (s.help.includes(t.id)) throw Error("Разбор уже открыт.");
        s.help.push(t.id);
        s.feedback = t.hint;
        break;
    }
    s.events.push(copy(a));
    return s;
  }
  function snapshot(s) {
    if (s.profile === 3)
      return { version: 3, baseline: s.baseline, events: copy(s.events) };
    return s.baseline === 1 && s.profile === 1
      ? { version: 1, events: copy(s.events) }
      : { version: 2, baseline: s.baseline, events: copy(s.events) };
  }
  let cacheKey = null,
    cacheValue = null;
  function restore(raw) {
    try {
      const key = JSON.stringify(raw);
      if (key === cacheKey) return copy(cacheValue);
      if (raw?.version === 1) exact(raw, ["version", "events"]);
      else exact(raw, ["version", "baseline", "events"]);
      if (
        ![1, 2, 3].includes(raw.version) ||
        (raw.version === 2 && ![1, 2].includes(raw.baseline)) ||
        (raw.version === 3 && ![1, 2, 3].includes(raw.baseline)) ||
        !Array.isArray(raw.events) ||
        raw.events.length > (raw.version === 3 ? 480 : 240)
      )
        return null;
      let s = create(raw.version === 1 ? 1 : raw.baseline);
      for (const a of raw.events) s = apply(s, a);
      if (s.version !== raw.version) return null;
      cacheKey = key;
      cacheValue = copy(s);
      return s;
    } catch {
      return null;
    }
  }
  function transition(s, a) {
    const r = restore(snapshot(s));
    if (!r) throw Error("Повреждён журнал.");
    return apply(r, a);
  }
  function review(raw, id) {
    const verified = restore(raw);
    if (!verified || !verified.done.some((d) => d.id === id)) return null;
    let s = create(raw.version === 1 ? 1 : raw.baseline);
    for (const action of raw.events) {
      s = apply(s, action);
      if (s.done.some((d) => d.id === id)) return snapshot(s);
    }
    return null;
  }
  return freeze({
    prepared,
    coordinates,
    coverage,
    inside,
    review,
    lessonCount,
    collision,
    config,
    lessons,
    faults,
    create,
    ready,
    plan,
    target,
    profileMatches,
    inspected,
    snapshot,
    restore,
    transition,
    segmentBox,
  });
});
