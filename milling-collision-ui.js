(function (root) {
  "use strict";
  const el = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  const number = (n) => Number(n.toFixed(3)).toLocaleString("ru-RU");
  const coordinates = (p) =>
    ["x", "y", "z"].map((k) => k.toUpperCase() + number(p[k])).join(" ");
  const range = (box, k) => number(box[k + "0"]) + "…" + number(box[k + "1"]);
  function projection(report, vertical) {
    const geometry = root.CNCMillingCourse.geometry;
    const obstacles = geometry.obstacles.filter(
      (o) => report.assembly.length > 1 || o.id !== "column",
    );
    const components = report.assembly,
      boxes = [...obstacles, report.keepOut, ...components.map((c) => c.box)];
    const extent = (k) => [
      Math.min(...boxes.map((b) => b[k + "0"]), report.from[k], report.to[k]) -
        8,
      Math.max(...boxes.map((b) => b[k + "1"]), report.from[k], report.to[k]) +
        8,
    ];
    const xb = extent("x"),
      yb = extent(vertical),
      scale = Math.min(450 / (xb[1] - xb[0]), 225 / (yb[1] - yb[0]));
    const left = 65 + (450 - (xb[1] - xb[0]) * scale) / 2,
      top = 50 + (225 - (yb[1] - yb[0]) * scale) / 2;
    const x = (n) => left + (n - xb[0]) * scale,
      y = (n) => top + (yb[1] - n) * scale;
    const rectangle = (b, attrs) =>
      '<rect x="' +
      x(b.x0) +
      '" y="' +
      y(b[vertical + "1"]) +
      '" width="' +
      (b.x1 - b.x0) * scale +
      '" height="' +
      (b[vertical + "1"] - b[vertical + "0"]) * scale +
      '" ' +
      attrs +
      "/>";
    const name = vertical === "y" ? "XY · вид сверху" : "XZ · вид сбоку";
    let svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 355" role="img" aria-label="' +
      name +
      ': исходная позиция A, запрошенная B и вершина P при первом входе в запрещённую зону"><g font-family="Arial,sans-serif" font-size="15" fill="#24465f"><text x="20" y="25">' +
      name +
      " · " +
      vertical.toUpperCase() +
      " ↑" +
      "</text>";
    const ordered = [...obstacles].sort((a, b) => {
      const rank = (o) =>
        o.id === "stock" ? 0 : o.id === report.obstacle.id ? 2 : 1;
      return rank(a) - rank(b);
    });
    for (const o of ordered) {
      svg += rectangle(
        o,
        'data-obstacle="' +
          o.id +
          '" fill="' +
          (o.id === report.obstacle.id ? "#d8a68a" : "#dbe3e9") +
          '" stroke="' +
          (o.id === report.obstacle.id ? "#8d3d25" : "#8495a3") +
          '" stroke-width="2"',
      );
      svg +=
        '<text x="' +
        (x(o.x0) + 4) +
        '" y="' +
        (y(o[vertical + "1"]) + 17) +
        '">' +
        (obstacles.indexOf(o) + 1) +
        "</text>";
    }
    svg += rectangle(
      report.keepOut,
      'fill="#fce7e5" fill-opacity="0.22" stroke="#b6463b" stroke-dasharray="7 4"',
    );
    for (const c of components) {
      const attrs =
        'fill="none" stroke="' +
        (c.id === report.part.id ? "#a26514" : "#466da3") +
        '" stroke-width="3"';
      svg += rectangle(c.box, attrs);
      if (vertical === "y")
        svg +=
          '<circle cx="' +
          x(report.point.x) +
          '" cy="' +
          y(report.point.y) +
          '" r="' +
          c.radius * scale +
          '" fill="none" stroke="#65778a" stroke-width="1"/>';
    }
    svg +=
      '<path d="M ' +
      x(report.from.x) +
      " " +
      y(report.from[vertical]) +
      " L " +
      x(report.to.x) +
      " " +
      y(report.to[vertical]) +
      '" fill="none" stroke="#9b3b39" stroke-width="2" stroke-dasharray="5 5"/>';
    const marks = [];
    for (const [label, p] of [
      ["A", report.from],
      ["B", report.to],
      ["P", report.point],
    ]) {
      let mark = marks.find(
        (v) =>
          Math.abs(v.p.x - p.x) < 1e-8 &&
          Math.abs(v.p[vertical] - p[vertical]) < 1e-8,
      );
      if (!mark) {
        mark = { p, labels: [] };
        marks.push(mark);
      }
      mark.labels.push(label);
    }
    for (const mark of marks) {
      const px = x(mark.p.x),
        py = y(mark.p[vertical]),
        isP = mark.labels.includes("P"),
        color = isP
          ? "#a42e32"
          : mark.labels.includes("A")
            ? "#2456aa"
            : "#516373";
      svg += isP
        ? '<path d="M ' +
          (px - 6) +
          " " +
          (py - 6) +
          ' l 12 12 m -12 0 l 12 -12" stroke="' +
          color +
          '" stroke-width="3"/>'
        : '<circle cx="' +
          px +
          '" cy="' +
          py +
          '" r="5" fill="white" stroke="' +
          color +
          '" stroke-width="2"/>';
      const end = mark.labels.length === 1 && mark.labels[0] === "B",
        start = mark.labels.length === 1 && mark.labels[0] === "A";
      const dx = start ? -14 : 14,
        dy = end ? 23 : -18,
        lx = px + dx,
        ly = py + dy;
      svg +=
        '<path d="M ' +
        px +
        " " +
        py +
        " L " +
        (lx + (start ? 3 : -3)) +
        " " +
        (ly - 5) +
        '" stroke="' +
        color +
        '" stroke-width="1" fill="none"/>';
      svg +=
        '<text data-marker-label="' +
        mark.labels.join("/") +
        '" x="' +
        lx +
        '" y="' +
        ly +
        '" text-anchor="' +
        (start ? "end" : "start") +
        '" fill="' +
        color +
        '" stroke="white" stroke-width="3" paint-order="stroke" font-weight="bold">' +
        mark.labels.join("/") +
        "</text>";
    }
    svg +=
      '<path d="M 65 290 H 515 M 65 290 V 45" fill="none" stroke="#7b8a99"/>';
    svg += '<text x="520" y="294">X →</text>';
    const ticks = (bounds) => {
      const size = bounds[1] - bounds[0],
        step = size > 70 ? 20 : size > 35 ? 10 : size > 18 ? 5 : 2;
      const out = [];
      for (
        let n = Math.ceil(bounds[0] / step) * step;
        n <= bounds[1];
        n += step
      )
        out.push(n);
      return out;
    };
    for (const n of ticks(xb))
      svg +=
        '<text x="' +
        x(n) +
        '" y="310" text-anchor="middle">' +
        number(n) +
        "</text>";
    for (const n of ticks(yb))
      svg +=
        '<text x="57" y="' +
        (y(n) + 5) +
        '" text-anchor="end">' +
        number(n) +
        "</text>";
    svg +=
      '<text x="20" y="342">' +
      (vertical === "y"
        ? "Z скрыта: сравните высоты на виде сбоку."
        : "Y скрыта: одного перекрытия на проекции недостаточно.") +
      "</text></g></svg>";
    return svg;
  }
  function create({ report, headingTag = "h3" } = {}) {
    const host = el("section", undefined, "milling-collision");
    host.append(
      el(
        headingTag,
        report.historical
          ? "Разбор предыдущего отказа"
          : "Почему путь заблокирован",
      ),
      el(
        "p",
        report.part.title + " → " + report.obstacle.title,
        "milling-collision-cause",
      ),
    );
    host.append(
      el(
        "p",
        (report.preview
          ? "Проверка выполнена на копии. "
          : "Команда отклонена. ") +
          "Весь отвергнутый ход не выполнен; A — положение вершины перед этим отказом, B — запрошенный конец.",
      ),
    );
    host.append(
      el(
        "p",
        "P — положение вершины фрезы, когда сборка впервые вошла в запрещённую зону. Это не точка физического контакта державки или фрезы с поверхностью.",
        "start-note",
      ),
    );
    if (report.startInside)
      host.append(
        el(
          "p",
          "Начальная позиция уже в запрещённой зоне: P совпадает с A.",
          "start-hint",
        ),
      );
    host.append(
      el(
        "p",
        report.part.title +
          ": Z" +
          range(report.partBox, "z") +
          " мм. " +
          report.obstacle.title +
          ": Z" +
          range(report.obstacle, "z") +
          " мм.",
      ),
    );
    const figures = el("div", undefined, "milling-collision-projections");
    for (const axis of ["y", "z"]) {
      const figure = el("figure", undefined, "milling-collision-figure");
      figure.innerHTML = projection(report, axis);
      figures.append(figure);
    }
    host.append(figures);
    const legend = el("ul", undefined, "milling-collision-legend");
    for (const text of [
      "Коричневая область — препятствие, вызвавшее отказ. Цифры: 1 — крепление, 2 — колонна, 3 — заготовка.",
      "Красная пунктирная рамка — запрещённая зона для вершины с учётом габарита выбранной части. Это консервативная проверка, включая касание границы.",
      "Контуры при P — габаритные прямоугольники сборки; окружности сверху показывают номинальный диаметр. Красный пунктир A→B — отвергнутый путь, он не был выполнен.",
    ])
      legend.append(el("li", text));
    if (report.assembly.length === 1)
      legend.children[0].textContent =
        "Коричневая область — препятствие. Цифры: 1 — крепление, 2 — заготовка. Прежний профиль проверяет только фрезу.";
    host.append(legend);
    host.append(
      el(
        "p",
        "Охристый контур — " +
          report.part.title.toLowerCase() +
          (report.assembly.length > 1 ? "; синий — другая часть сборки." : "."),
        "start-note",
      ),
    );
    const facts = el("details", undefined, "course-reading");
    facts.append(el("summary", "Координаты и границы пересечения"));
    const dl = el("dl", undefined, "milling-collision-facts");
    for (const [label, value] of [
      ["A · до отказа", coordinates(report.from)],
      ["B · запрошено", coordinates(report.to)],
      ["P · вершина при первом входе", coordinates(report.point)],
      ["Текущее положение", coordinates(report.positionNow)],
    ])
      dl.append(el("dt", label), el("dd", value));
    for (const k of ["x", "y", "z"])
      dl.append(
        el("dt", "Интервалы " + k.toUpperCase()),
        el(
          "dd",
          report.part.title +
            " " +
            range(report.partBox, k) +
            "; " +
            report.obstacle.title +
            " " +
            range(report.obstacle, k) +
            " мм. " +
            (Math.abs(report.overlap[k]) < 1e-8
              ? "Касание границы."
              : "Перекрытие проекций " + number(report.overlap[k]) + " мм."),
        ),
      );
    facts.append(dl);
    host.append(
      facts,
      el("p", report.advice),
      el(
        "p",
        "После исправления снова проверьте весь путь и всю сборку. Этот разбор не назначает универсальный безопасный маршрут.",
        "start-note",
      ),
    );
    return host;
  }
  root.CNCMillingCollisionUI = Object.freeze({ create });
})(window);
