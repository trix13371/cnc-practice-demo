(function (root, factory) {
  const api = factory(
    () =>
      typeof module === "object" && module.exports
        ? require("./real-machine-model.js")
        : root.CNCRealMachine,
    typeof module === "object" && module.exports
      ? require("./assignment-model.js")
      : root.CNCAssignment,
    typeof module === "object" && module.exports
      ? require("./turning-tasks-model.js")
      : root.CNCTurningTasks,
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CNCOperationCourse = api;
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function (engine, assignment, turning) {
    "use strict";
    const copy = (x) => JSON.parse(JSON.stringify(x)),
      freeze = (x) => {
        if (x && typeof x === "object") {
          Object.values(x).forEach(freeze);
          Object.freeze(x);
        }
        return x;
      };
    const header = "G21 G18 G40 G54 G99\nG50 S1200\nG97 S800 M3\n",
      tail = "\nG0 X40 Z5\nM5\nM30";
    const tasks = freeze(
      [
        {
          id: "face-first",
          title: "Первый торец",
          level: 1,
          tool: 3,
          depth: 1,
          points: [[-10, 32]],
          goal: "Снимите 1 мм с торца Ø32. Получите Z−1, сохраните наружный Ø32.",
          learn:
            "Торцевание выполняется движением по X. X — диаметр. За проход T0303 допускает 1 мм по Z. Подходите к торцу снаружи Ø32; после прохода сначала отведите Z перед торцом, затем X.",
          hint: "Подход X34 Z−1; рабочий ход к X0; отвод сначала к Z2. Это один торцевой проход.",
          starter:
            header +
            "G0 X34 Z-1\n(Добавьте рабочий ход и безопасный отвод)" +
            tail,
          reference: header + "G0 X34 Z-1\nG1 X0 F0.1\nG0 Z2" + tail,
        },
        {
          id: "face-two",
          title: "Торец в два прохода",
          level: 2,
          tool: 3,
          depth: 2,
          points: [[-10, 32]],
          goal: "Снимите 2 мм с торца. Сохраните Ø32. Распределите съём по допустимым проходам.",
          learn:
            "Предельная глубина действует на каждый проход, а не на итоговый размер. Следующий торец отсчитывается от прежнего рабочего нуля: G54 после съёма сам не перемещается.",
          hint: "После первого торца Z−1 следующий — Z−2. Между проходами отведите Z перед торцом, затем X наружу.",
          starter: header + "(Составьте два прохода)" + tail,
          reference:
            header +
            "G0 X34 Z-1\nG1 X0 F0.1\nG0 Z2\nX34\nZ-2\nG1 X0 F0.1\nG0 Z2" +
            tail,
        },
        {
          id: "groove-first",
          title: "Кольцевая канавка",
          level: 2,
          tool: 4,
          depth: 0,
          points: [
            [-11, 28],
            [-5, 32],
          ],
          goal: "Выполните канавку шириной 2 мм и диаметром дна Ø28. Передняя кромка T0404 на Z−10, задняя на Z−12. Остальное Ø32 сохранить.",
          learn:
            "У канавочного резца есть ширина. Перед осевым перемещением выведите всю пластину наружу. Съём на радиус равен половине разности диаметров.",
          hint: "При передней кромке Z−10 пластина занимает Z−12…−10. После рабочего X28 отведите X34, затем перемещайтесь по Z.",
          starter: header + "(Добавьте подход, врезание и отвод)" + tail,
          reference: header + "G0 X34 Z-10\nG1 X28 F0.08\nG0 X34" + tail,
        },
        {
          id: "taper",
          title: "Конус вместо цилиндра",
          level: 3,
          tool: 1,
          depth: 0,
          points: [
            [-5, 31],
            [-15, 29],
            [-30, 32],
          ],
          goal: "Получите прямолинейный конус: Ø32 при Z0, Ø28 при Z−20; дальше сохранить Ø32. Контроль в Z−5 и Z−15.",
          learn:
            "Конус образуется совместным изменением X и Z в одном рабочем кадре. При линейной интерполяции диаметр меняется пропорционально Z. Два отдельных осевых движения конус не создают.",
          hint: "Рабочий кадр должен одновременно вести к X28 и Z−20 от точки X32 Z0. В Z−5 диаметр на четверть пути между 32 и 28.",
          starter:
            header + "(Составьте подход и совместный рабочий ход X/Z)" + tail,
          reference: header + "G0 X32 Z2\nG1 Z0 F0.1\nX28 Z-20\nG0 X34" + tail,
        },
        {
          id: "grooves-project",
          title: "Две канавки · самостоятельный маршрут",
          level: 4,
          tool: 4,
          depth: 0,
          points: [
            [-11, 30],
            [-21, 28],
            [-5, 32],
            [-30, 32],
          ],
          goal: "Первая канавка Z−12…−10: дно Ø30. Вторая Z−22…−20: дно Ø28. Ширина каждой 2 мм, прочие поверхности Ø32. Программу составьте полностью.",
          learn:
            "Сначала определите положение передней кромки, глубину каждого врезания и безопасные отводы. До запуска проверьте весь профиль, затем подтвердите каждую канавку и сохранённые поверхности измерениями.",
          hint: "Первая глубина — (32−30)/2; вторая — (32−28)/2. Осевой перенос допускается после полного выхода пластины из материала.",
          starter: "",
          reference:
            header +
            "G0 X34 Z-10\nG1 X30 F0.08\nG0 X34\nZ-20\nG1 X28 F0.08\nG0 X34" +
            tail,
        },
        ...turning.tasks,
      ].map((task) => ({
        ...task,
        assignment: {
          id: "operation-" + task.id,
          contentVersion: 1,
          criteriaVersion: 1,
          profileId: "lathe-xz",
          profileVersion: 1,
          seed: "fixed-01",
        },
      })),
    );
    function exact(a, keys) {
      if (
        !a ||
        typeof a !== "object" ||
        Array.isArray(a) ||
        Object.keys(a).sort().join(",") !== keys.sort().join(",")
      )
        throw Error("Неверная запись практикума.");
    }
    function text(s) {
      if (
        typeof s !== "string" ||
        s.length > 4000 ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/.test(
          s,
        )
      )
        throw Error(
          "Программа: до 4000 символов без скрытых управляющих знаков.",
        );
      return s;
    }
    function blank(t) {
      const work = engine().newWork(t.title, {
        diameter: 32,
        length: 60,
        grip: 15,
      });
      return {
        work,
        machine: engine().restoreWork(work).state,
        source: t.starter,
        preview: null,
        approval: null,
        executed: false,
        depthReading: null,
        depthRecorded: false,
        selectedSurfaces: [],
        prediction: null,
        predictionInput: "",
      };
    }
    function initial(version) {
      return {
        version,
        originVersion: version,
        currentAssignment: null,
        events: [],
        current: 0,
        done: [],
        help: [],
        errors: tasks.map(() => 0),
        attempt: 1,
        feedback: "",
        draft: tasks[0].starter,
        ...blank(tasks[0]),
      };
    }
    function create() {
      return apply(initial(2), {
        type: "begin",
        assignment: copy(tasks[0].assignment),
      });
    }
    function taskCount(s) {
      return s.version === 1 ? 5 : tasks.length;
    }
    function hasWork(raw) {
      return !!(
        raw &&
        (raw.events?.some((event) => event.type !== "begin") ||
          (typeof raw.draft === "string" && raw.draft !== tasks[0].starter))
      );
    }
    function signature(s) {
      return JSON.stringify(s.work);
    }
    const expectedCache = new Map();
    function expected(t) {
      if (!tasks.includes(t)) throw Error("Неизвестное условие.");
      if (t.targetProfile) return t.targetProfile;
      if (expectedCache.has(t.id)) return expectedCache.get(t.id);
      let w = engine().newWork(t.title, { diameter: 32, length: 60, grip: 15 });
      for (const a of [
        { type: "reference" },
        { type: "clamp", value: true },
        { type: "tool", tool: t.tool },
        { type: "preset" },
        { type: "workOffset", z: 100 },
        { type: "door", value: true },
      ])
        w = engine().execute(w, a).work;
      const p = engine().graphics(w, t.reference);
      if (!p.ok) throw Error(p.message);
      const profile = freeze(copy(p.profile));
      expectedCache.set(t.id, profile);
      return profile;
    }
    function shape(a, b) {
      const norm = (p) =>
        JSON.stringify({
          frontZ: p.frontZ || 0,
          bore: p.bore || 0,
          segments: p.segments.map((s) =>
            [s.length, s.diameter, s.endDiameter ?? s.diameter].map(
              (n) => Math.round(n * 1e6) / 1e6,
            ),
          ),
        });
      return norm(a) === norm(b);
    }
    function inspected(s, t) {
      return (
        t.points.every(([z, d]) =>
          s.machine.readings.some(
            (r) =>
              r.afterCut === s.machine.cuts.length &&
              Math.abs(r.z - z) < 1e-6 &&
              Math.abs(r.reading - d) < 0.011,
          ),
        ) &&
        (!t.depth || s.depthRecorded)
      );
    }
    function planned(s, t) {
      if (!t.surfaces) return true;
      const protectedIds = t.surfaces
        .filter((surface) => surface.role === "preserve")
        .map((surface) => surface.id)
        .sort();
      return (
        JSON.stringify([...s.selectedSurfaces].sort()) ===
          JSON.stringify(protectedIds) && s.prediction !== null
      );
    }
    function assessment(s) {
      const t = tasks[s.current];
      if (s.version === 1) return null;
      const checks = [
        {
          id: "execution",
          title:
            "Реальная обработка модели завершена без аварии, вращение и СОЖ выключены",
          passed: !!(
            s.executed &&
            s.machine.program.status === "done" &&
            !s.machine.spindle &&
            !s.machine.coolant &&
            !s.machine.alarm
          ),
        },
        {
          id: "profile",
          title:
            "Весь профиль соответствует чертежу, сохранённые участки не повреждены",
          passed: shape(s.machine.profile, expected(t)),
        },
        {
          id: "tool",
          title: "Применён инструмент учебного условия",
          passed: s.machine.tool === t.tool,
        },
      ];
      if (t.surfaces) {
        checks.push({
          id: "plan",
          title: "Выбраны сохраняемые поверхности и проверен прогноз",
          passed: planned(s, t),
        });
        for (const surface of t.surfaces)
          checks.push({
            id: "control:" + surface.id,
            title:
              "Свежий контроль поверхности " +
              surface.id +
              " · " +
              surface.title,
            passed: surface.control.every((point) =>
              s.machine.readings.some(
                (r) =>
                  r.instrument === "micrometer" &&
                  r.afterCut === s.machine.cuts.length &&
                  Math.abs(r.z - point.z) < 1e-6 &&
                  Math.abs(r.reading - point.value) < 0.011,
              ),
            ),
          });
      } else
        checks.push({
          id: "control",
          title: "Получены все свежие замеры карты контроля",
          passed: inspected(s, t),
        });
      return assignment.evaluate(
        s.currentAssignment,
        t.assignment,
        checks,
        s.help.includes(t.id),
      );
    }
    function apply(state, a) {
      if (state.events.length >= 500)
        throw Error("Журнал заполнен. Сохранённые действия остаются доступны.");
      const fields = {
        begin: ["type", "assignment"],
        upgrade: ["type", "assignment"],
        surface: ["type", "id"],
        predict: ["type", "value"],
        machine: ["type", "action"],
        preview: ["type", "source"],
        start: ["type", "source"],
        run: ["type"],
        hint: ["type"],
        depth: ["type"],
        recordDepth: ["type", "value"],
        confirm: ["type"],
        next: state.version === 1 ? ["type"] : ["type", "assignment"],
        restart: ["type"],
      };
      if (!a || !Object.hasOwn(fields, a.type))
        throw Error("Неизвестное действие.");
      exact(a, fields[a.type]);
      const s = copy(state),
        t = tasks[s.current],
        bad = (m) => {
          s.errors[s.current]++;
          s.feedback = m;
        },
        act = (e) => {
          const r = engine().execute(s.work, e);
          s.work = r.work;
          s.machine = r.state;
          s.feedback = r.message;
          if (!r.ok) s.errors[s.current]++;
          return r;
        };
      if (
        s.done.some((d) => d.id === t.id) &&
        !["next", "upgrade"].includes(a.type)
      )
        throw Error("Задание принято. Перейдите дальше.");
      switch (a.type) {
        case "begin":
          if (
            s.version !== 2 ||
            s.originVersion !== 2 ||
            s.events.length ||
            !assignment.matches(a.assignment, t.assignment)
          )
            throw Error("Неизвестная версия задания или профиля.");
          s.currentAssignment = copy(t.assignment);
          break;
        case "upgrade":
          if (
            s.version !== 1 ||
            s.current !== 4 ||
            !s.done.some((r) => r.id === t.id) ||
            !assignment.matches(a.assignment, tasks[5].assignment)
          )
            throw Error(
              "Сначала завершите сохранённые операции прежней версии.",
            );
          s.version = 2;
          s.current = 5;
          s.currentAssignment = copy(tasks[5].assignment);
          Object.assign(s, blank(tasks[5]));
          s.attempt = 1;
          s.draft = tasks[5].starter;
          s.feedback =
            "Прежние пять результатов сохранены. Новые условия начаты отдельно.";
          break;
        case "surface":
          if (
            s.version !== 2 ||
            !t.surfaces ||
            s.executed ||
            !t.surfaces.some((surface) => surface.id === a.id)
          )
            throw Error("Поверхность недоступна для планирования.");
          s.selectedSurfaces = s.selectedSurfaces.includes(a.id)
            ? s.selectedSurfaces.filter((id) => id !== a.id)
            : [...s.selectedSurfaces, a.id];
          s.prediction = null;
          s.approval = null;
          break;
        case "predict": {
          if (
            s.version !== 2 ||
            !t.forecast ||
            s.executed ||
            typeof a.value !== "string" ||
            a.value.length > 32 ||
            !/^-?\d+(?:[.,]\d+)?$/.test(a.value.trim())
          )
            throw Error("Введите число для прогноза.");
          s.predictionInput = a.value;
          s.prediction = null;
          s.approval = null;
          const required = t.surfaces
            .filter((surface) => surface.role === "preserve")
            .map((surface) => surface.id)
            .sort();
          if (
            JSON.stringify([...s.selectedSurfaces].sort()) !==
            JSON.stringify(required)
          )
            bad(
              "Проверьте по чертежу, какие поверхности нужно сохранить без съёма.",
            );
          else if (
            Math.abs(Number(a.value.replace(",", ".")) - t.forecast.value) >
            1e-6
          )
            bad(
              "Прогноз не согласуется с размерами и пределом инструмента. Вернитесь к схеме и расчёту.",
            );
          else {
            s.prediction = { value: t.forecast.value };
            s.feedback =
              "Поверхности и прогноз согласованы. Теперь проверьте это программой и обработкой.";
          }
          break;
        }
        case "machine": {
          const e = a.action;
          const allowed = [
            "reference",
            "clamp",
            "tool",
            "preset",
            "workOffset",
            "door",
            "measure",
            "hold",
            "reset",
          ];
          if (!e || !allowed.includes(e.type))
            throw Error("Действие недоступно.");
          if (
            s.executed &&
            !["measure", "door", "reset", "hold"].includes(e.type)
          )
            throw Error("Для повторной наладки нужна новая заготовка.");
          if (!s.executed && e.type === "measure")
            throw Error("Сначала изготовьте деталь.");
          act(e);
          if (!["measure", "hold"].includes(e.type)) s.approval = null;
          break;
        }
        case "preview": {
          if (s.executed) throw Error("Проверка до запуска.");
          if (!planned(s, t)) {
            bad(
              "Сначала выберите сохраняемые поверхности и проверьте прогноз.",
            );
            break;
          }
          s.source = text(a.source);
          const p = engine().graphics(s.work, s.source);
          s.preview = p;
          s.approval = null;
          if (!p.ok) bad(p.message);
          else if (!shape(p.profile, expected(t)))
            bad(
              "Программа исполняется, но не создаёт требуемый полный профиль. Проверьте чертёж и сохранённые поверхности.",
            );
          else if (
            s.machine.tool !== t.tool ||
            s.machine.workOffset.z !== 100 ||
            !s.machine.doorClosed
          )
            bad("Проверьте требуемый инструмент, G54 Z100 и ограждение.");
          else {
            s.approval = { source: s.source, signature: signature(s) };
            s.feedback =
              "Графика подтверждена на копии. Рабочая деталь ещё не обработана.";
          }
          break;
        }
        case "start": {
          const source = text(a.source);
          if (
            !s.approval ||
            s.approval.source !== source ||
            s.approval.signature !== signature(s)
          )
            throw Error("Проверьте текущую программу и наладку заново.");
          if (!act({ type: "load", source }).ok) break;
          act({ type: "mode", value: "AUTO" });
          if (act({ type: "start" }).ok) s.executed = true;
          break;
        }
        case "run":
          if (!s.executed) throw Error("Сначала запустите программу.");
          {
            let n = 0;
            while (s.machine.program.status === "running" && n++ < 80) {
              if (!act({ type: "step" }).ok) break;
            }
            break;
          }
        case "hint":
          if (s.help.includes(t.id)) throw Error("Разбор уже открыт.");
          s.help.push(t.id);
          s.feedback = t.hint;
          break;
        case "depth":
          if (
            !s.executed ||
            s.machine.program.status !== "done" ||
            s.machine.spindle ||
            s.machine.coolant ||
            s.machine.doorClosed ||
            s.machine.position.x < 34
          )
            throw Error(
              "Нужны завершение, остановка, открытое ограждение и отвод X≥34.",
            );
          s.depthReading = -(s.machine.profile.frontZ || 0);
          s.feedback =
            "Модельный осевой отсчёт от прежнего торца: " +
            s.depthReading +
            " мм. Физический глубиномер и погрешность не моделируются.";
          break;
        case "recordDepth":
          if (
            typeof a.value !== "string" ||
            a.value.length > 32 ||
            !/^\d+(?:[.,]\d+)?$/.test(a.value.trim())
          )
            throw Error("Введите положительный осевой размер.");
          if (
            s.depthReading === null ||
            Math.abs(Number(a.value.replace(",", ".")) - s.depthReading) > 1e-6
          )
            bad("Запись не соответствует свежему отсчёту.");
          else {
            s.depthRecorded = true;
            s.feedback = "Осевой отсчёт записан.";
          }
          break;
        case "confirm":
          if (
            (s.version === 2 && !assessment(s).passed) ||
            !s.executed ||
            s.machine.program.status !== "done" ||
            s.machine.spindle ||
            s.machine.coolant ||
            s.machine.alarm ||
            !shape(s.machine.profile, expected(t)) ||
            !inspected(s, t)
          )
            bad(
              "Нужны изготовление нужного профиля и все свежие замеры карты контроля.",
            );
          else {
            s.done.push({
              id: t.id,
              source: s.source,
              attempt: s.attempt,
              help: s.help.includes(t.id),
              errors: s.errors[s.current],
              readings: copy(s.machine.readings),
              depth: s.depthReading,
              ...(s.version === 2
                ? {
                    assignment: copy(t.assignment),
                    independent: assessment(s).independent,
                    criteria: assessment(s).checks,
                  }
                : { legacy: true, independent: null }),
            });
            s.feedback = "Операция и контроль подтверждены в учебной модели.";
          }
          break;
        case "next":
          if (
            !s.done.some((d) => d.id === t.id) ||
            s.current === taskCount(s) - 1
          )
            throw Error("Следующее задание пока недоступно.");
          if (
            s.version === 2 &&
            !assignment.matches(a.assignment, tasks[s.current + 1].assignment)
          )
            throw Error("Неизвестная версия следующего задания.");
          s.current++;
          s.currentAssignment =
            s.version === 2 ? copy(tasks[s.current].assignment) : null;
          Object.assign(s, blank(tasks[s.current]));
          s.attempt = 1;
          s.draft = tasks[s.current].starter;
          s.feedback = "";
          break;
        case "restart":
          if (
            s.machine.spindle ||
            ["running", "hold"].includes(s.machine.program.status)
          )
            throw Error("Сначала RESET для прерывания.");
          Object.assign(s, blank(t));
          s.attempt++;
          s.feedback = "Новая заготовка. Ошибки и открытый разбор сохранены.";
          break;
      }
      s.events.push(copy(a));
      return s;
    }
    function snapshot(s) {
      return {
        version: s.version,
        ...(s.version === 2 ? { originVersion: s.originVersion } : {}),
        events: copy(s.events),
        draft: s.draft,
      };
    }
    let cachedKey = null,
      cachedValue = null;
    function restore(raw) {
      try {
        const key = JSON.stringify(raw);
        if (key === cachedKey) return copy(cachedValue);
        exact(
          raw,
          raw?.version === 2
            ? ["version", "originVersion", "events", "draft"]
            : ["version", "events", "draft"],
        );
        if (
          ![1, 2].includes(raw.version) ||
          (raw.version === 2 && ![1, 2].includes(raw.originVersion)) ||
          !Array.isArray(raw.events) ||
          raw.events.length > 500
        )
          return null;
        text(raw.draft);
        let s = initial(raw.version === 1 ? 1 : raw.originVersion);
        for (const a of raw.events) s = apply(s, a);
        if (
          s.version !== raw.version ||
          (raw.version === 2 && !s.currentAssignment)
        )
          return null;
        s.draft = raw.draft;
        cachedKey = key;
        cachedValue = copy(s);
        return s;
      } catch {
        return null;
      }
    }
    function transition(s, a) {
      const r = restore(snapshot(s));
      if (!r) throw Error("Повреждён практикум.");
      return apply(r, a);
    }
    function review(raw, id) {
      const verified = restore(raw);
      if (!verified || !verified.done.some((d) => d.id === id)) return null;
      let s = initial(raw.version === 1 ? 1 : raw.originVersion);
      for (const action of raw.events) {
        s = apply(s, action);
        if (s.done.some((d) => d.id === id)) return snapshot(s);
      }
      return null;
    }
    return freeze({
      review,
      tasks,
      create,
      snapshot,
      restore,
      transition,
      shape,
      expected,
      inspected,
      assessment,
      taskCount,
      hasWork,
    });
  },
);
