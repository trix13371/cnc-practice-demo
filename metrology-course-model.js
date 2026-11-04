(function (root, factory) {
  const api =
    typeof module === "object" && module.exports
      ? factory(
          require("./assignment-model.js"),
          require("./start-session-model.js"),
        )
      : factory(root.CNCAssignment, root.CNCStartSession);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CNCMetrologyCourse = api;
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function (assign, numbers) {
    "use strict";
    const copy = (x) => JSON.parse(JSON.stringify(x)),
      fail = (m) => {
        throw Error(m);
      };
    function freeze(x) {
      if (x && typeof x === "object") {
        Object.values(x).forEach(freeze);
        Object.freeze(x);
      }
      return x;
    }
    const instruments = freeze({
      outside: {
        title: "Штангенциркуль · наружные губки",
        kind: "outer",
        range: [0, 150000],
        resolution: 10,
        error: 30,
        reference: 0,
      },
      inside: {
        title: "Штангенциркуль · внутренние губки",
        kind: "inner",
        range: [5000, 150000],
        resolution: 10,
        error: 30,
        reference: 0,
      },
      micrometer: {
        title: "Микрометр 25–50 мм",
        kind: "outer",
        range: [25000, 50000],
        resolution: 1,
        error: 5,
        reference: 25000,
      },
      bore: {
        title: "Учебный нутромер 10–30 мм",
        kind: "inner",
        range: [10000, 30000],
        resolution: 2,
        error: 8,
        reference: 20000,
      },
    });
    const surface = (id, title, kind, nominal, lower, upper, values) => ({
      id,
      title,
      kind,
      nominal,
      lower,
      upper,
      points: values.map((value, i) => ({
        id: String(i + 1),
        z: nominal === 32000 ? (i ? -45 : -35) : i ? -15 : -5,
        value,
      })),
    });
    const tasks = freeze(
      [
        {
          id: "outer-control",
          title: "Поверхность, прибор и два сечения",
          section: "solid",
          mode: "guided",
          goal: "Проконтролируйте наружную шейку A: Ø28 ±0,20 мм. Базовая поверхность B имеет Ø32 и не заменяет контроль шейки.",
          reading:
            "Выберите размер и поверхность. Проверка нуля выполняется без контакта с деталью. После выбора сечения установите контакт и запишите отсчёт; отдельно рассчитайте пределы размера.",
          hint: "Нужна поверхность A и наружный прибор. Пределы A: 27,80…28,20 мм. Для каждого показания учитывается граница ошибки выбранного учебного прибора.",
          surfaces: [
            surface("A", "Шейка", "outer", 28000, 27800, 28200, [28080, 28090]),
            surface("B", "База", "outer", 32000, 31800, 32200, [32000, 32000]),
          ],
          required: ["A"],
        },
        {
          id: "section-hole",
          title: "Разрез: где находится отверстие",
          section: "blind",
          mode: "guided",
          goal: "Глухое отверстие B глубиной 20 мм: Ø20 ±0,10 мм. Наружная поверхность A имеет Ø32. Определите тип заготовки по разрезу и проконтролируйте именно внутреннюю поверхность.",
          reading:
            "Внешний вид цилиндра не показывает, сплошной ли он. На продольном разрезе светлая полоса заканчивается внутри детали. Наружный микрометр не измеряет отверстие.",
          hint: "Выберите глухое отверстие и поверхность B. Для неё доступны внутренние губки либо нутромер подходящего диапазона. Пределы: 19,90…20,10 мм.",
          surfaces: [
            surface(
              "A",
              "Наружная поверхность",
              "outer",
              32000,
              31800,
              32200,
              [32000, 32000],
            ),
            surface(
              "B",
              "Отверстие",
              "inner",
              20000,
              19900,
              20100,
              [20040, 20050],
            ),
          ],
          required: ["B"],
        },
        {
          id: "two-sections",
          title: "Один замер не подтверждает весь участок",
          section: "solid",
          mode: "practice",
          goal: "Проверьте A Ø30 ±0,10 мм в двух сечениях. Вывод относится ко всей карте контроля: благополучное первое сечение не отменяет результат второго.",
          reading:
            "Сравнивайте каждое сечение с его требованием. Если хотя бы в одном сечении весь интервал измерения вне допуска, соответствие размера не подтверждается.",
          hint: "Измерьте A в обеих точках. При наружном штангенциркуле второе показание 30,14 ±0,03 даёт интервал 30,11…30,17 — полностью выше верхнего предела.",
          surfaces: [
            surface(
              "A",
              "Контролируемый участок",
              "outer",
              30000,
              29900,
              30100,
              [29980, 30140],
            ),
          ],
          required: ["A"],
        },
        {
          id: "refine-border",
          title: "Пограничный замер: уточните контроль",
          section: "solid",
          mode: "practice",
          refine: true,
          goal: "A Ø30 ±0,10 мм. Сначала выполните контроль наружным штангенциркулем. Если его интервал пересекает границу, зафиксируйте неопределённость, затем повторите контроль микрометром.",
          reading:
            "Дискретность дисплея и граница ошибки — разные характеристики. Данные приборов здесь заданы условием. Смена прибора требует своей проверки нуля и нового контакта.",
          hint: "Штангенциркуль показывает 30,08 ±0,03: верх интервала 30,11 пересекает предел 30,10. Нужен вывод «уточнить», затем новые замеры микрометром; его показание 30,082 ±0,005.",
          surfaces: [
            surface(
              "A",
              "Пограничная шейка",
              "outer",
              30000,
              29900,
              30100,
              [30082, 30082],
            ),
          ],
          required: ["A"],
        },
        {
          id: "fresh-revision",
          title: "После доработки нужны новые измерения",
          section: "solid",
          mode: "practice",
          revised: true,
          goal: "A Ø28 ±0,10 мм. Оцените исходную деталь. Затем получите редакцию после доработки и выполните контроль заново. Старая запись не подтверждает новую редакцию.",
          reading:
            "Доработка здесь представлена сменой учебной редакции детали; физическая обработка не моделируется. Записи сохраняются с номером редакции, поверхностью, сечением и прибором.",
          hint: "Первоначальный размер 28,20 выше допуска. После смены редакции прежние записи устаревают. Заново измерьте обе точки A и примите решение по новым значениям.",
          surfaces: [
            surface(
              "A",
              "Доработанная шейка",
              "outer",
              28000,
              27900,
              28100,
              [28200, 28200],
            ),
          ],
          required: ["A"],
        },
        {
          id: "bushing-transfer",
          title: "Самостоятельный контроль втулки",
          section: "through",
          mode: "transfer",
          goal: "По виду и разрезу проконтролируйте втулку: наружная A Ø30 ±0,10 мм; отверстие B Ø20 с отклонениями +0,10/0 мм. Нужны два сечения каждой поверхности и отдельные пределы каждого размера.",
          reading:
            "Используйте схему, паспорта приборов и пустой протокол. Итог относится только к указанным размерам; форму, шероховатость и остальные требования этот контроль не подтверждает.",
          hint: "Нужны обе поверхности A и B. Для A — наружный прибор, для B — внутренний. Пределы A 29,90…30,10; B 20,00…20,10. Соберите четыре свежие записи и сравните каждый интервал отдельно.",
          surfaces: [
            surface(
              "A",
              "Наружный диаметр",
              "outer",
              30000,
              29900,
              30100,
              [30020, 30030],
            ),
            surface(
              "B",
              "Отверстие",
              "inner",
              20000,
              20000,
              20100,
              [20040, 20050],
            ),
          ],
          required: ["A", "B"],
        },
      ].map((t) => ({
        ...t,
        assignment: {
          id: "metrology-" + t.id,
          contentVersion: 1,
          criteriaVersion: 1,
          profileId: "dimensional-control",
          profileVersion: 1,
          seed: "fixed-01",
        },
      })),
    );
    function exact(o, keys) {
      if (
        !o ||
        typeof o !== "object" ||
        Array.isArray(o) ||
        Object.keys(o).sort().join(",") !== [...keys].sort().join(",")
      )
        fail("Повреждена запись контроля.");
    }
    function number(raw) {
      if (typeof raw !== "string" || raw.length > 32)
        fail("Введите размер в мм.");
      const n = numbers.parseNumber(raw);
      if (
        n === null ||
        Math.abs(n) > 1000 ||
        Math.abs(n * 1000 - Math.round(n * 1000)) > 1e-7
      )
        fail("Точность ввода — до 0,001 мм.");
      return Math.round(n * 1000);
    }
    function classify(reading, error, lower, upper) {
      const low = reading - error,
        high = reading + error;
      return {
        low,
        high,
        verdict:
          low >= lower && high <= upper
            ? "accept"
            : high < lower || low > upper
              ? "reject"
              : "uncertain",
      };
    }
    function aggregate(verdicts) {
      if (!verdicts.length) fail("Нет замеров.");
      return verdicts.includes("reject")
        ? "reject"
        : verdicts.includes("uncertain")
          ? "uncertain"
          : "accept";
    }
    const local = () => ({
      surface: null,
      instrument: null,
      contact: null,
      section: null,
      records: [],
      bounds: {},
      revision: 0,
      coarseReviewed: false,
      initialReviewed: false,
      draft: { reading: "", lower: "", upper: "" },
    });
    function initial() {
      return {
        version: 1,
        events: [],
        current: 0,
        done: [],
        help: [],
        errors: Array(6).fill(0),
        zeroed: [],
        feedback: "",
        ...local(),
      };
    }
    function create() {
      return apply(initial(), {
        type: "begin",
        assignment: tasks[0].assignment,
      });
    }
    function recordFor(s, id, point) {
      return s.records.find(
        (r) =>
          r.surface === id && r.point === point && r.revision === s.revision,
      );
    }
    function verdicts(s) {
      const t = tasks[s.current];
      return t.required.flatMap((id) =>
        t.surfaces
          .find((v) => v.id === id)
          .points.map((point) => {
            const r = recordFor(s, id, point.id);
            if (!r || !s.bounds[id])
              fail("Нужны все свежие записи и пределы каждой поверхности.");
            const a = t.surfaces.find((v) => v.id === id);
            return {
              ...classify(
                r.reading,
                instruments[r.instrument].error,
                a.lower,
                a.upper,
              ),
              surface: id,
              point: point.id,
            };
          }),
      );
    }
    function apply(state, a) {
      if (state.events.length >= 360)
        fail("Журнал заполнен. Сохраните работу.");
      const fields = {
        begin: ["type", "assignment"],
        section: ["type", "value"],
        surface: ["type", "id"],
        instrument: ["type", "id"],
        zero: ["type"],
        release: ["type"],
        contact: ["type", "point"],
        record: ["type", "value"],
        limits: ["type", "lower", "upper"],
        verdict: ["type", "value"],
        revision: ["type"],
        hint: ["type"],
        next: ["type", "assignment"],
      };
      if (!a || !Object.hasOwn(fields, a.type)) fail("Неизвестное действие.");
      exact(a, fields[a.type]);
      const s = copy(state),
        t = tasks[s.current],
        bad = (m) => {
          s.errors[s.current]++;
          s.feedback = m;
        };
      if (s.done.some((d) => d.id === t.id) && a.type !== "next")
        fail("Условие принято.");
      switch (a.type) {
        case "begin":
          if (s.events.length || !assign.matches(a.assignment, t.assignment))
            fail("Неизвестная версия контроля.");
          break;
        case "section":
          if (!["solid", "blind", "through"].includes(a.value))
            fail("Неверный вид разреза.");
          s.section = a.value;
          s.contact = null;
          if (a.value !== t.section)
            bad("Сопоставьте светлую область разреза с её выходом к торцам.");
          break;
        case "surface":
          if (!t.surfaces.some((v) => v.id === a.id))
            fail("Неизвестная поверхность.");
          s.surface = a.id;
          s.contact = null;
          s.draft = { reading: "", lower: "", upper: "" };
          break;
        case "instrument":
          if (!Object.hasOwn(instruments, a.id)) fail("Неизвестный прибор.");
          s.instrument = a.id;
          s.contact = null;
          break;
        case "release":
          s.contact = null;
          break;
        case "zero":
          if (!s.instrument || s.contact)
            fail("Проверяйте ноль выбранного прибора без детали.");
          if (!s.zeroed.includes(s.instrument)) s.zeroed.push(s.instrument);
          s.feedback =
            "Установка прибора проверена по учебному эталону без контролируемой детали.";
          break;
        case "contact": {
          const surface = t.surfaces.find((v) => v.id === s.surface),
            g = instruments[s.instrument],
            point = surface?.points.find((p) => p.id === a.point);
          if (
            !surface ||
            !g ||
            !point ||
            s.section !== t.section ||
            !s.zeroed.includes(s.instrument)
          )
            fail("Нужны верный разрез, поверхность, прибор и проверка нуля.");
          const value = t.revised && s.revision ? 28030 : point.value;
          if (
            g.kind !== surface.kind ||
            value < g.range[0] ||
            value > g.range[1]
          ) {
            s.contact = null;
            bad(
              "Этот прибор или диапазон не подходит к выбранной поверхности.",
            );
            break;
          }
          s.contact = {
            surface: surface.id,
            point: point.id,
            reading: Math.round(value / g.resolution) * g.resolution,
            revision: s.revision,
            instrument: s.instrument,
          };
          s.feedback =
            "Контакт установлен. Прочитайте дисплей и запишите отсчёт.";
          break;
        }
        case "record":
          if (!s.contact || s.contact.revision !== s.revision)
            fail("Нет свежего контакта с деталью.");
          if (number(a.value) !== s.contact.reading) {
            bad("Запись отличается от дисплея.");
            break;
          }
          s.records = s.records.filter(
            (r) =>
              !(
                r.surface === s.contact.surface &&
                r.point === s.contact.point &&
                r.revision === s.revision
              ),
          );
          s.records.push(copy(s.contact));
          s.feedback =
            "Запись связана с поверхностью, сечением, прибором и редакцией.";
          break;
        case "limits": {
          const surface = t.surfaces.find((v) => v.id === s.surface);
          if (!surface) fail("Выберите поверхность.");
          if (
            number(a.lower) !== surface.lower ||
            number(a.upper) !== surface.upper
          ) {
            bad("Проверьте номинал и оба отклонения.");
            break;
          }
          s.bounds[surface.id] = { lower: surface.lower, upper: surface.upper };
          s.feedback = "Пределы поверхности записаны.";
          break;
        }
        case "revision":
          if (!t.revised || s.revision || !s.initialReviewed)
            fail("Сначала оцените исходную деталь.");
          s.revision = 1;
          s.contact = null;
          s.feedback =
            "Получена новая учебная редакция. Прежние записи остались в протоколе и устарели.";
          break;
        case "hint":
          if (s.help.includes(t.id)) fail("Разбор уже открыт.");
          s.help.push(t.id);
          s.feedback = t.hint;
          break;
        case "verdict": {
          if (s.section !== t.section) fail("Сначала исправьте тип разреза.");
          if (!["accept", "reject", "uncertain"].includes(a.value))
            fail("Неверный вывод.");
          const results = verdicts(s),
            expected = aggregate(results.map((r) => r.verdict));
          if (a.value !== expected) {
            bad(
              "Сравните каждый интервал со своим допуском. Одно благополучное сечение не отменяет остальные.",
            );
            break;
          }
          if (t.refine && !s.coarseReviewed) {
            if (
              expected !== "uncertain" ||
              !t.required.every((id) =>
                t.surfaces
                  .find((v) => v.id === id)
                  .points.every(
                    (p) => recordFor(s, id, p.id).instrument === "outside",
                  ),
              )
            ) {
              bad(
                "Сначала зафиксируйте пограничный результат штангенциркуля по условию.",
              );
              break;
            }
            s.coarseReviewed = true;
            s.feedback =
              "Результата недостаточно. Выполните новые замеры микрометром.";
            break;
          }
          if (
            t.refine &&
            !t.required.every((id) =>
              t.surfaces
                .find((v) => v.id === id)
                .points.every(
                  (p) => recordFor(s, id, p.id).instrument === "micrometer",
                ),
            )
          ) {
            bad("Уточните оба сечения более точным прибором.");
            break;
          }
          if (t.revised && !s.revision) {
            s.initialReviewed = true;
            s.feedback =
              "Исходная редакция оценена. Получите деталь после доработки.";
            break;
          }
          s.done.push({
            id: t.id,
            assignment: copy(t.assignment),
            independent: !s.help.includes(t.id),
            help: s.help.includes(t.id),
            errors: s.errors[s.current],
            verdict: expected,
            records: copy(s.records),
            bounds: copy(s.bounds),
            revision: s.revision,
            results,
          });
          s.feedback =
            "Контроль и вывод подтверждены только для размеров учебной модели.";
          break;
        }
        case "next":
          if (
            !s.done.some((d) => d.id === t.id) ||
            s.current === tasks.length - 1 ||
            !assign.matches(a.assignment, tasks[s.current + 1].assignment)
          )
            fail("Следующее условие недоступно или его версия неизвестна.");
          s.current++;
          Object.assign(s, local());
          s.feedback = "";
          break;
      }
      s.events.push(copy(a));
      return s;
    }
    function snapshot(s) {
      return { version: 1, events: copy(s.events), draft: copy(s.draft) };
    }
    function validDraft(d) {
      return (
        d &&
        typeof d === "object" &&
        !Array.isArray(d) &&
        Object.keys(d).sort().join(",") === "lower,reading,upper" &&
        Object.values(d).every(
          (v) =>
            typeof v === "string" &&
            v.length <= 32 &&
            !/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/.test(
              v,
            ),
        )
      );
    }
    function restore(raw) {
      try {
        exact(raw, ["version", "events", "draft"]);
        if (
          raw.version !== 1 ||
          !Array.isArray(raw.events) ||
          !raw.events.length ||
          raw.events.length > 360 ||
          raw.events[0].type !== "begin" ||
          !validDraft(raw.draft)
        )
          return null;
        let s = initial();
        for (const a of raw.events) s = apply(s, a);
        s.draft = copy(raw.draft);
        return s;
      } catch {
        return null;
      }
    }
    function transition(s, a) {
      const trusted = restore(snapshot(s));
      if (!trusted) fail("Повреждён журнал контроля.");
      return apply(trusted, a);
    }
    function review(raw, id) {
      const trusted = restore(raw);
      if (!trusted?.done.some((d) => d.id === id)) return null;
      let s = initial();
      for (const a of raw.events) {
        s = apply(s, a);
        if (s.done.some((d) => d.id === id)) return snapshot(s);
      }
      return null;
    }
    return freeze({
      tasks,
      lessons: tasks,
      instruments,
      create,
      snapshot,
      restore,
      transition,
      review,
      aggregate,
      classify,
      recordFor,
    });
  },
);
