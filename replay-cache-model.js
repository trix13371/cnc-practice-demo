(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CNCReplayCache = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // Only successful, fully replayed states belong here. It is an optimisation,
  // never a source of evidence received from a client. Each worker has its own
  // bounded cache; model changes/reloads start with an empty cache.
  function json(value) {
    const ancestors = new Set();
    function check(item) {
      if (
        item === null ||
        typeof item === "string" ||
        typeof item === "boolean" ||
        (typeof item === "number" && Number.isFinite(item))
      )
        return;
      if (typeof item !== "object" || ancestors.has(item))
        throw Error("Not a JSON journal");
      const prototype = Object.getPrototypeOf(item);
      if (
        !Array.isArray(item) &&
        prototype !== Object.prototype &&
        prototype !== null
      ) {
        throw Error("Not a plain journal");
      }
      ancestors.add(item);
      for (const descriptor of Object.values(
        Object.getOwnPropertyDescriptors(item),
      )) {
        if (!Object.hasOwn(descriptor, "value"))
          throw Error("Journal accessor");
        check(descriptor.value);
      }
      ancestors.delete(item);
    }
    check(value);
    return JSON.stringify(value);
  }

  function create({ maxEntries = 16, maxBytes = 2 * 1024 * 1024 } = {}) {
    if (
      !Number.isInteger(maxEntries) ||
      maxEntries < 1 ||
      !Number.isInteger(maxBytes) ||
      maxBytes < 1
    ) {
      throw Error("Invalid replay cache limits");
    }
    const entries = new Map();
    let bytes = 0;
    function get(raw) {
      try {
        const key = json(raw),
          entry = entries.get(key);
        if (!entry) return null;
        entries.delete(key);
        entries.set(key, entry);
        return JSON.parse(entry.value);
      } catch {
        return null;
      }
    }
    function remember(raw, state) {
      if (!state) return state;
      try {
        const key = json(raw),
          value = json(state),
          size = 2 * (key.length + value.length);
        if (size > maxBytes) return state;
        const previous = entries.get(key);
        if (previous) {
          bytes -= previous.size;
          entries.delete(key);
        }
        while (
          entries.size &&
          (entries.size >= maxEntries || bytes + size > maxBytes)
        ) {
          const oldest = entries.keys().next().value;
          bytes -= entries.get(oldest).size;
          entries.delete(oldest);
        }
        entries.set(key, { value, size });
        bytes += size;
      } catch {
        /* Non-JSON input remains subject to the model's full replay. */
      }
      return state;
    }
    return Object.freeze({ get, remember });
  }
  return Object.freeze({ create });
});
