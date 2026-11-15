(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CNCInternalProfile = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const EPS = 1e-8;
  const MAX_SEGMENTS = 256;
  const MAX_DIMENSION = 1000;

  const bounded = (value) => Number.isFinite(value) && Math.abs(value) <= MAX_DIMENSION;
  function exact(value, keys) {
    return value && typeof value === "object" && !Array.isArray(value) &&
      Reflect.ownKeys(value).length === keys.length &&
      keys.every((key) => Object.hasOwn(value, key));
  }

  function ranges(segments, inner) {
    if (!Array.isArray(segments) || segments.length > MAX_SEGMENTS ||
      (!inner && !segments.length)) throw Error("Некорректный список участков профиля.");
    const result = [];
    let start = 0;
    for (const segment of segments) {
      if (!exact(segment, ["length", "diameter", "endDiameter"]))
        throw Error("Укажите длину и два диаметра участка.");
      const { length, diameter, endDiameter } = segment;
      const tip = inner && result.length === segments.length - 1 && endDiameter === 0;
      if (!bounded(length) || length <= EPS || !bounded(diameter) || diameter <= EPS ||
        !bounded(endDiameter) || (!tip && endDiameter <= EPS))
        throw Error("Недопустимая длина или диаметр участка.");
      const end = start + length;
      if (end > MAX_DIMENSION + EPS) throw Error("Длина профиля превышает 1000 мм.");
      result.push({ start, end, diameter, endDiameter });
      start = end;
    }
    return result;
  }

  function diameterAt(segment, depth) {
    const fraction = (depth - segment.start) / (segment.end - segment.start);
    return segment.diameter + fraction * (segment.endDiameter - segment.diameter);
  }

  function volume(segments) {
    return segments.reduce((total, { start, end, diameter, endDiameter }) =>
      total + Math.PI / 12 * (end - start) *
        (diameter ** 2 + diameter * endDiameter + endDiameter ** 2), 0);
  }

  function minimumWall(outer, inner) {
    let minimum = Infinity;
    let outerIndex = 0;
    let innerIndex = 0;
    while (innerIndex < inner.length) {
      const outside = outer[outerIndex];
      const bore = inner[innerIndex];
      const nextOutside = outer[outerIndex + 1];
      const nextBore = inner[innerIndex + 1];
      const start = Math.max(outside.start, bore.start);
      const end = Math.min(outside.end, bore.end);
      const sharedStart = Math.abs(outside.start - bore.start) <= EPS;
      const sharedEnd = Math.abs(outside.end - bore.end) <= EPS &&
        Boolean(nextOutside) === Boolean(nextBore);
      const startGap = sharedStart ? outside.diameter - bore.diameter
        : diameterAt(outside, start) - diameterAt(bore, start);
      const endGap = sharedEnd ? outside.endDiameter - bore.endDiameter
        : diameterAt(outside, end) - diameterAt(bore, end);
      for (const gap of [startGap, endGap]) {
        if (gap <= EPS) throw Error("Отверстие пересекает наружный профиль или оставляет нулевую стенку.");
        minimum = Math.min(minimum, gap / 2);
      }

      // At a shared shoulder, the two rings must still share a band of material.
      if (sharedEnd && nextOutside && nextBore) {
        const outerEdge = Math.min(outside.endDiameter, nextOutside.diameter);
        const innerEdge = Math.max(bore.endDiameter, nextBore.diameter);
        if (outerEdge - innerEdge <= EPS)
          throw Error("Совпадающие ступени разрывают заготовку.");
      }
      if (sharedEnd || outside.end === end) outerIndex++;
      if (sharedEnd || bore.end === end) innerIndex++;
    }
    return minimum;
  }

  function analyze(profile) {
    if (!exact(profile, ["frontZ", "outer", "inner"]) || !bounded(profile.frontZ))
      throw Error("Укажите координату торца и наружный и внутренний профили.");
    const outer = ranges(profile.outer, false);
    const inner = ranges(profile.inner, true);
    const length = outer.at(-1).end;
    const tip = inner.at(-1);
    let kind = "solid";
    if (tip) {
      if (tip.end > length + EPS) throw Error("Отверстие выходит за длину заготовки.");
      kind = Math.abs(tip.end - length) <= EPS ? "through" : "blind";
      if (kind === "through") {
        if (tip.endDiameter === 0) throw Error("Сквозное отверстие должно иметь открытый выход.");
        if (length <= tip.start) throw Error("Конечный участок отверстия должен иметь положительную длину.");
        tip.end = length;
      }
    }
    const wall = tip ? minimumWall(outer, inner) : null;
    const outerVolume = volume(outer);
    const voidVolume = volume(inner);
    return {
      kind,
      length,
      backZ: profile.frontZ - length,
      boreDepth: tip?.end ?? 0,
      boreEndZ: tip ? profile.frontZ - tip.end : null,
      minWall: wall,
      outerVolume,
      voidVolume,
      materialVolume: outerVolume - voidVolume,
    };
  }

  function fromLegacy(profile) {
    if (!profile || !Array.isArray(profile.segments) ||
      !profile.segments.length || profile.segments.length > MAX_SEGMENTS)
      throw Error("Некорректный прежний профиль.");
    const { frontZ = 0, bore = 0 } = profile;
    if (!bounded(bore) || bore < 0) throw Error("Некорректный диаметр прежнего отверстия.");
    const outer = [...profile.segments].reverse().map((segment) => {
      if (!segment || (segment.bore !== undefined && segment.bore !== bore))
        throw Error("Прежний профиль должен иметь постоянный диаметр отверстия.");
      return {
        length: segment.length,
        diameter: segment.endDiameter ?? segment.diameter,
        endDiameter: segment.diameter,
      };
    });
    const length = outer.reduce((total, segment) => total + segment.length, 0);
    const converted = {
      frontZ,
      outer,
      inner: bore === 0 ? [] : [{ length, diameter: bore, endDiameter: bore }],
    };
    analyze(converted);
    return converted;
  }

  function hole(profile) {
    const result = analyze(profile);
    const inner = ranges(profile.inner, true);
    const mouth = inner[0]?.diameter ?? 0;
    let fullDepth = result.boreDepth;
    for (const band of inner) {
      if (band.diameter < mouth - EPS) {
        fullDepth = band.start;
        break;
      }
      if (band.endDiameter < mouth - EPS) {
        const ratio = (band.diameter - mouth) / (band.diameter - band.endDiameter);
        fullDepth = band.start + (band.end - band.start) * Math.max(0, ratio);
        break;
      }
    }
    return { ...result, mouth, fullDepth };
  }

  function insideAt(profile, z) {
    const depth = profile.frontZ - z;
    const inner = ranges(profile.inner, true);
    const index = inner.findIndex((band) => depth >= band.start - EPS && depth <= band.end + EPS);
    if (index < 0) return null;
    const band = inner[index];
    const next = inner[index + 1];
    const atEnd = Math.abs(depth - band.end) <= EPS;
    const through = Math.abs(band.end - profile.outer.reduce((sum, part) => sum + part.length, 0)) <= EPS;
    const boundary = atEnd && (next ? Math.abs(next.diameter - band.endDiameter) > EPS : !through);
    const d = diameterAt(band, Math.max(band.start, Math.min(band.end, depth)));
    return { d, boundary, taper: Math.abs(band.diameter - band.endDiameter) > EPS };
  }

  function enlarge(profile, cutter) {
    const before = analyze(profile);
    const profiles = [ranges(profile.inner, true), ranges(cutter, true)];
    const edges = [...new Set(profiles.flatMap((bands) => bands.map((band) => band.end)).concat(0))].sort((a, b) => a - b);
    const inner = [];
    function append(start, end, diameter, endDiameter) {
      if (end - start <= EPS) return;
      const length = end - start;
      const last = inner.at(-1);
      if (last && Math.abs(last.endDiameter - diameter) <= EPS &&
        Math.abs((last.endDiameter - last.diameter) / last.length - (endDiameter - diameter) / length) <= EPS) {
        last.length += length;
        last.endDiameter = endDiameter;
      } else inner.push({ length, diameter, endDiameter });
    }
    for (let i = 1; i < edges.length; i++) {
      const start = edges[i - 1], end = edges[i];
      if (end - start <= EPS) continue;
      const middle = (start + end) / 2;
      const values = profiles.map((bands) => {
        const band = bands.find((part) => part.start <= middle && middle < part.end);
        return band ? [diameterAt(band, start), diameterAt(band, end)] : [0, 0];
      });
      const [[a, b], [c, d]] = values;
      if ((a - c) * (b - d) < 0) {
        const ratio = (a - c) / ((a - c) - (b - d));
        const crossing = start + (end - start) * ratio;
        const diameter = a + (b - a) * ratio;
        append(start, crossing, Math.max(a, c), diameter);
        append(crossing, end, diameter, Math.max(b, d));
      } else append(start, end, Math.max(a, c), Math.max(b, d));
    }
    const result = { ...profile, inner };
    const after = analyze(result);
    return { profile: result, removed: Math.max(0, after.voidVolume - before.voidVolume), minWall: after.minWall };
  }

  return Object.freeze({ analyze, fromLegacy, hole, insideAt, enlarge, innerRanges: (profile) => ranges(profile.inner, true) });
});
