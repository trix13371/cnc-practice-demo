// Чистый геометрический помощник токарного песочника (без зависимостей).
// Профиль: {segments:[{length,diameter,endDiameter,bore}], bore:0|константа, frontZ?:отрицательное}
// Ось Z отсчитывается от ИСХОДНОГО переднего торца Z0; патрон в Z = -stockLength;
// локальная координата от патрона: u = stockLength + Z (не меняется при подрезке).
// Помощник только вычисляет профиль из валидных событий: обороты/инструмент/границы
// осей/столкновение с патроном/атомарная фиксация — ответственность контроллера.

(function (global, factory) {
  'use strict';
  if (typeof module === 'object' && module !== null && typeof module.exports === 'object') {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define(function () { return factory(); });
  } else if (global) {
    global.CNCRadialOps = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  var EPS = 1e-9;        // допуск сравнений
  var SLIVER = 1e-12;    // порог отбрасывания нулевых кусков
  var MAX_SEGMENTS = 256;
  var SUM_TOL = 1e-6;    // допуск проверки суммарной длины

  function fail(message) {
    throw new Error(message);
  }

  function isNum(x) {
    return typeof x === 'number' && isFinite(x);
  }

  // Текущий передний торец в исходных координатах Z.
  function front(profile) {
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
      fail('Профиль должен быть объектом');
    }
    var fz = profile.frontZ;
    if (fz === undefined || fz === null) {
      return 0;
    }
    if (!isNum(fz)) {
      fail('Некорректное значение frontZ');
    }
    if (fz > EPS) {
      fail('frontZ должен быть неположительным числом');
    }
    return fz;
  }

  // Валидация профиля; возвращает нормализованную копию сегментов (вход не изменяется).
  function validateProfile(profile, stockLength) {
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
      fail('Профиль должен быть объектом');
    }
    if (!isNum(profile.bore) || profile.bore < 0) {
      fail('Некорректный диаметр отверстия профиля');
    }
    if (!Array.isArray(profile.segments) || profile.segments.length < 1) {
      fail('Профиль должен содержать хотя бы один сегмент');
    }
    if (profile.segments.length > MAX_SEGMENTS) {
      fail('Слишком много сегментов профиля (максимум 256)');
    }
    var segs = [];
    for (var i = 0; i < profile.segments.length; i++) {
      var s = profile.segments[i];
      if (!s || typeof s !== 'object') {
        fail('Некорректный сегмент профиля');
      }
      if (!isNum(s.length) || s.length <= 0) {
        fail('Некорректная длина сегмента профиля');
      }
      if (!isNum(s.diameter) || s.diameter <= 0) {
        fail('Некорректный диаметр сегмента профиля');
      }
      if (!isNum(s.endDiameter) || s.endDiameter <= 0) {
        fail('Некорректный конечный диаметр сегмента профиля');
      }
      var b = (s.bore === undefined || s.bore === null) ? profile.bore : s.bore;
      if (!isNum(b) || b < 0) {
        fail('Некорректный диаметр отверстия сегмента профиля');
      }
      if (Math.abs(b - profile.bore) > EPS) {
        fail('Отверстие сегмента не совпадает с общим отверстием профиля');
      }
      if (s.diameter < profile.bore - EPS || s.endDiameter < profile.bore - EPS) {
        fail('Диаметр сегмента меньше диаметра отверстия');
      }
      segs.push({ length: s.length, diameter: s.diameter, endDiameter: s.endDiameter, bore: b });
    }
    var frontZ = front(profile);
    var total = 0;
    for (i = 0; i < segs.length; i++) {
      total += segs[i].length;
    }
    if (stockLength !== null && stockLength !== undefined) {
      if (!isNum(stockLength) || stockLength < 10 - EPS || stockLength > 150 + EPS) {
        fail('Некорректная длина заготовки (ожидается от 10 до 150 мм)');
      }
      if (Math.abs(total - (stockLength + frontZ)) > SUM_TOL) {
        fail('Суммарная длина сегментов не соответствует длине заготовки и переднему торцу');
      }
    }
    return { segs: segs, bore: profile.bore, front: frontZ, total: total };
  }

  // Куски материала в координате u от патрона: {u1,u2,D1,D2} — линейный конус между торцами куска.
  function toPieces(segs) {
    var pieces = [];
    var acc = 0;
    for (var i = 0; i < segs.length; i++) {
      var s = segs[i];
      pieces.push({ u1: acc, u2: acc + s.length, D1: s.diameter, D2: s.endDiameter });
      acc += s.length;
    }
    return pieces;
  }

  function dAt(p, u) {
    var span = p.u2 - p.u1;
    if (span <= 0) {
      return p.D1;
    }
    return p.D1 + (p.D2 - p.D1) * ((u - p.u1) / span);
  }

  function pushPiece(out, u1, u2, d1, d2, bore) {
    if (!(u2 - u1 > SLIVER)) {
      return; // нулевые и фантомные куски не добавляем
    }
    out.push({ u1: u1, u2: u2, D1: d1, D2: d2, bore: bore });
  }

  // min(старый наружный, t) на куске [u1,u2] с точным (без округления) делением
  // в точке пересечения конуса с постоянным диаметром t.
  function emitClamped(out, u1, u2, d1, d2, t, bore) {
    if (!(u2 - u1 > SLIVER)) {
      return;
    }
    var lo = Math.min(d1, d2);
    var hi = Math.max(d1, d2);
    if (d1 !== d2 && t > lo && t < hi) {
      var uStar = u1 + (t - d1) * (u2 - u1) / (d2 - d1);
      pushPiece(out, u1, uStar, Math.min(d1, t), t, bore);
      pushPiece(out, uStar, u2, t, Math.min(d2, t), bore);
    } else {
      pushPiece(out, u1, u2, Math.min(d1, t), Math.min(d2, t), bore);
    }
  }

  // Общая обрезка: наружный := min(старый, t) на интервале [a,b] (в u).
  function clampPieces(pieces, a, b, t, bore) {
    var out = [];
    for (var i = 0; i < pieces.length; i++) {
      var p = pieces[i];
      var ov = Math.min(p.u2, b) - Math.max(p.u1, a);
      if (b <= p.u1 || a >= p.u2 || ov <= EPS) {
        pushPiece(out, p.u1, p.u2, p.D1, p.D2, bore);
        continue;
      }
      var c1 = Math.max(a, p.u1);
      var c2 = Math.min(b, p.u2);
      if (c1 > p.u1) {
        pushPiece(out, p.u1, c1, p.D1, dAt(p, c1), bore);
      }
      emitClamped(out, c1, c2, dAt(p, c1), dAt(p, c2), t, bore);
      if (c2 < p.u2) {
        pushPiece(out, c2, p.u2, dAt(p, c2), p.D2, bore);
      }
    }
    return out;
  }

  // Обрезка всего впереди точки a (уход переднего торца): материал на (a, ...] снят целиком.
  function cropPieces(pieces, a, bore) {
    var out = [];
    for (var i = 0; i < pieces.length; i++) {
      var p = pieces[i];
      if (p.u1 >= a) {
        continue;
      }
      var u2 = Math.min(p.u2, a);
      pushPiece(out, p.u1, u2, p.D1, u2 < p.u2 ? dAt(p, u2) : p.D2, bore);
    }
    return out;
  }

  function piecesToSegments(pieces) {
    var segs = [];
    for (var i = 0; i < pieces.length; i++) {
      var p = pieces[i];
      segs.push({ length: p.u2 - p.u1, diameter: p.D1, endDiameter: p.D2, bore: p.bore });
    }
    return segs;
  }

  // Слияние соседних коллинеарных участков (одинаковая линия наружного диаметра).
  function mergeSegments(segs) {
    var out = [];
    for (var i = 0; i < segs.length; i++) {
      var s = segs[i];
      if (!(s.length > SLIVER)) {
        continue;
      }
      var last = out.length > 0 ? out[out.length - 1] : null;
      if (last !== null &&
          Math.abs(last.bore - s.bore) <= EPS &&
          Math.abs(last.endDiameter - s.diameter) <= EPS) {
        var slopeA = (last.endDiameter - last.diameter) / last.length;
        var slopeB = (s.endDiameter - s.diameter) / s.length;
        var tol = 1e-9 * (1 + Math.abs(slopeA) + Math.abs(slopeB));
        if (Math.abs(slopeA - slopeB) <= tol) {
          last.length += s.length;
          last.endDiameter = s.endDiameter;
          continue;
        }
      }
      out.push({ length: s.length, diameter: s.diameter, endDiameter: s.endDiameter, bore: s.bore });
    }
    return out;
  }

  function piecesVolume(pieces, bore) {
    var v = 0;
    var b2 = bore * bore;
    for (var i = 0; i < pieces.length; i++) {
      var p = pieces[i];
      var l = p.u2 - p.u1;
      v += Math.PI * l / 12 * (p.D1 * p.D1 + p.D1 * p.D2 + p.D2 * p.D2 - 3 * b2);
    }
    return v;
  }

  // Новый профиль содержит только поля схемы: segments, bore и (при наличии) frontZ.
  function buildProfile(segs, bore, oldProfile, newFrontZ) {
    if (segs.length < 1) {
      fail('В результате операции получен пустой профиль');
    }
    if (segs.length > MAX_SEGMENTS) {
      fail('Слишком много сегментов профиля (максимум 256)');
    }
    var np = { segments: segs, bore: bore };
    if (newFrontZ !== undefined) {
      np.frontZ = newFrontZ;
    } else if (oldProfile.frontZ !== undefined && oldProfile.frontZ !== null) {
      np.frontZ = oldProfile.frontZ;
    }
    return np;
  }

  function sanitizedRemoved(diff) {
    if (diff < 0 && diff > -1e-6) {
      return 0; // погрешность плавающей точки при нулевом съеме
    }
    if(diff < -1e-6)fail('Операция добавляет материал');
    return Math.max(0,diff);
  }

  // Подрезка торца: радиальный ход на фиксированной Z = targetZ;
  // снимает кольцо на всём интервале [targetZ, currentFront] до диаметра min(старый, targetX).
  function face(profile, stockLength, targetZ, targetX, maxAxialDepth) {
    if (maxAxialDepth === undefined || maxAxialDepth === null) {
      maxAxialDepth = 1;
    }
    if (!isNum(maxAxialDepth) || maxAxialDepth <= 0) {
      fail('Некорректный лимит осевой глубины подрезки');
    }
    if (!isNum(targetZ) || !isNum(targetX)) {
      fail('Некорректные числовые параметры подрезки торца');
    }
    var st = validateProfile(profile, stockLength);
    var depth = st.front - targetZ;
    if (depth < -EPS) {
      fail('Точка подрезки находится впереди текущего переднего торца');
    }
    if (depth > maxAxialDepth + EPS) {
      fail('Осевая глубина подрезки за один проход превышает лимит');
    }
    if (targetZ <= -stockLength + 1 + EPS) {
      fail('Подрезка слишком близко к патрону: должен оставаться уступ не менее 1 мм');
    }
    if (targetX < st.bore - EPS) {
      fail('Диаметр подрезки меньше диаметра отверстия');
    }
    if (depth < 0) {
      depth = 0;
    }
    var tx = Math.max(targetX, st.bore);
    var a = stockLength + targetZ; // u точки подрезки, не меняется при подрезках
    var oldPieces = toPieces(st.segs);
    var trimmed = tx <= st.bore + EPS; // рез до отверстия: безматериальный передний участок срезается
    var newPieces;
    var newFrontZ;
    if (trimmed) {
      newPieces = cropPieces(oldPieces, a, st.bore);
      newFrontZ = targetZ; // торец уходит в targetZ; участок у патрона не трогается
    } else {
      // Частичный проход: временная утончённая «шейка», frontZ остаётся старым.
      newPieces = clampPieces(oldPieces, a, st.total, tx, st.bore);
      newFrontZ = undefined;
    }
    var segs = mergeSegments(piecesToSegments(newPieces));
    var np = buildProfile(segs, st.bore, profile, trimmed ? newFrontZ : undefined);
    var removed = sanitizedRemoved(piecesVolume(oldPieces, st.bore) - piecesVolume(newPieces, st.bore));
    return { profile: np, removed: removed, depth: depth };
  }

  // Канавка: прямое радиальное врезание, след резца [zFront - width, zFront].
  function groove(profile, stockLength, zFront, width, targetX, maxRadialDepth) {
    if (maxRadialDepth === undefined || maxRadialDepth === null) {
      maxRadialDepth = 2;
    }
    if (!isNum(maxRadialDepth) || maxRadialDepth <= 0) {
      fail('Некорректный лимит радиальной глубины канавки');
    }
    if (!isNum(zFront) || !isNum(width) || !isNum(targetX)) {
      fail('Некорректные числовые параметры канавки');
    }
    if (width <= 0) {
      fail('Некорректная ширина канавки');
    }
    var st = validateProfile(profile, stockLength);
    if (zFront > st.front - 0.1 + EPS) {
      fail('Передняя кромка резца должна отстоять от переднего торца не менее чем на 0.1 мм');
    }
    var rear = zFront - width;
    if (rear < -stockLength + 1 - EPS) {
      fail('Канавка слишком близко к патрону: должен оставаться уступ не менее 1 мм');
    }
    var isTube = st.bore > EPS;
    var minDiameter = isTube ? st.bore + 2 : 1; // минимальная стенка 1 мм
    if (targetX < minDiameter - EPS) {
      fail(isTube
        ? 'Канавка: не соблюдена минимальная стенка 1 мм над отверстием'
        : 'Канавка: на сплошной заготовке диаметр канавки не может быть меньше 1 мм');
    }
    var tx = Math.max(targetX, st.bore);
    var a = stockLength + rear;    // задняя кромка (сторона патрона)
    var b = stockLength + zFront;  // передняя кромка
    var oldPieces = toPieces(st.segs);
    // Максимальный наружный диаметр на затрагиваемом интервале (куски, пересекающие след по длине).
    var oldOuter = 0;
    for (var i = 0; i < oldPieces.length; i++) {
      var p = oldPieces[i];
      var ov = Math.min(p.u2, b) - Math.max(p.u1, a);
      if (ov > EPS) {
        oldOuter = Math.max(oldOuter, dAt(p, Math.max(a, p.u1)), dAt(p, Math.min(b, p.u2)));
      }
    }
    var depth = Math.max((oldOuter - tx) / 2, 0);
    if (depth > maxRadialDepth + EPS) {
      fail('Радиальная глубина канавки за один проход превышает лимит');
    }
    var newPieces = clampPieces(oldPieces, a, b, tx, st.bore);
    var segs = mergeSegments(piecesToSegments(newPieces));
    var np = buildProfile(segs, st.bore, profile, undefined); // frontZ и длина не меняются
    var removed = sanitizedRemoved(piecesVolume(oldPieces, st.bore) - piecesVolume(newPieces, st.bore));
    return { profile: np, removed: removed, depth: depth };
  }

  // Объём материала профиля: сумма pi*l/12*(D1^2+D1*D2+D2^2-3*bore^2).
  function volume(profile) {
    var st = validateProfile(profile, null);
    return piecesVolume(toPieces(st.segs), st.bore);
  }

  return Object.freeze({
    volume: volume,
    face: face,
    groove: groove,
    front: front
  });
});