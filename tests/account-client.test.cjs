"use strict";
// Run the real bootstrap/synchronizer with controlled network and DOM. No browser internals.
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  crypto = require("node:crypto");
const progress = require("../progress-model.js"),
  pilot = require("../pilot-model.js"),
  config = require("../progress-config.js"),
  store = require("../progress-store.js"),
  scopes = require("../server/public/account-storage.js"),
  f = require("./progress-fixtures.cjs");
class Element {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.dataset = {};
    this.style = {};
  }
  append(...items) {
    this.children.push(...items);
    for (const i of items) if (i instanceof Element) i.parent = this;
    if (this.tag === "body")
      for (const i of items) if (i.tag === "script") this.runScript(i);
  }
  after(item) {
    this.parent?.append(item);
  }
  remove() {
    if (this.parent)
      this.parent.children = this.parent.children.filter((n) => n !== this);
  }
  setAttribute(k, v) {
    this[k] = v;
  }
}
function storage() {
  const map = new Map();
  return {
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}
const user = {
  id: "11111111-1111-4111-a111-111111111111",
  username: "beta01",
  role: "user",
};
async function boot(native, server, options = {}) {
  const window = { localStorage: native, addEventListener() {} },
    body = new Element("body"),
    header = new Element("header"),
    footer = new Element("footer"),
    statusNote = new Element("p"),
    intervals = [],
    trace = [];
  footer.children = [new Element("span"), new Element("span")];
  body.append(header, footer);
  const document = {
    currentScript: {
      dataset: {
        bundles:
          "/assets/js/bootstrap.0000000000000000.js /assets/js/models.0000000000000000.js /assets/js/interface.0000000000000000.js",
      },
    },
    body,
    createElement: (t) => new Element(t),
    querySelector: (s) =>
      s === "header"
        ? header
        : s === "footer"
          ? footer
          : s === "#storage-note"
            ? statusNote
            : null,
    addEventListener() {},
  };
  let current;
  body.runScript = (script) => {
    assert.equal(
      script.async,
      false,
      "Dynamic modules must preserve insertion order",
    );
    const kind = script.src.match(
      /^\/assets\/js\/(bootstrap|models|interface)\.[a-f0-9]{16}\.js$/,
    )?.[1];
    assert(kind, "Only the three release bundles may be loaded");
    trace.push(kind);
    if (kind === options.failPhase) {
      queueMicrotask(() => script.onerror());
      return;
    }
    if (kind === "bootstrap") {
      assert.equal(window.localStorage, native);
      Object.assign(window, {
        CNCProgressConfig: config,
        CNCProgressStore: store,
        CNCAccountStorage: scopes,
      });
    } else {
      assert.notEqual(
        window.localStorage,
        native,
        "Account namespace must be installed before model/UI execution",
      );
    }
    if (kind === "models")
      Object.assign(window, { CNCProgress: progress, CNCPilot: pilot });
    if (kind === "interface") {
      assert(
        trace.includes("remote"),
        "Cloud recovery must finish before UI execution",
      );
      current = progress.fromRaw(
        Object.fromEntries(
          config.keys.map((k) => [k, window.localStorage.getItem(k)]),
        ),
      );
      window.CNCProgressUI = { collect: () => progress.validate(current) };
      window.CNCPilotUI = { progressSnapshot: () => pilot.empty() };
      window.CNCDemo = { pauseWorkshop() {} };
    }
    queueMicrotask(() => script.onload());
  };
  const fetch = async (url, options = {}) => {
    assert(
      options.signal instanceof AbortSignal,
      "Requests must have a finite timeout",
    );
    if (server.timeout)
      throw Object.assign(Error("timeout"), { name: "TimeoutError" });
    if (server.expired)
      return {
        ok: false,
        status: 401,
        headers: { get: () => user.id },
        json: async () => ({ error: "Session expired" }),
      };
    let data;
    if (url === "/api/me") data = { user, csrf: "c".repeat(43) };
    else if (url === "/api/progress" && options.method === "PUT") {
      const b = JSON.parse(options.body);
      assert.equal(b.expectedRevision, server.revision);
      server.archive = b.archive;
      server.pilot = b.pilot;
      server.revision++;
      server.writes++;
      data = { revision: server.revision, currentRevision: server.revision };
    } else if (url === "/api/progress") {
      trace.push("remote");
      data = structuredClone(server);
    } else throw Error("Unexpected URL " + url);
    return {
      ok: true,
      status: 200,
      headers: { get: () => user.id },
      json: async () => data,
    };
  };
  await vm.runInNewContext(
    fs.readFileSync(
      require.resolve("../server/public/account-client.js"),
      "utf8",
    ),
    {
      window,
      document,
      fetch,
      crypto: crypto.webcrypto,
      TextEncoder,
      Uint8Array,
      Event,
      Blob,
      URL,
      AbortSignal,
      setTimeout,
      clearTimeout,
      setInterval: (fn) => intervals.push(fn),
      location: { reload() {}, assign() {} },
    },
  );
  return { window, body, intervals, trace, setCurrent: (a) => (current = a) };
}
(async () => {
  const native = storage(),
    server = { revision: 0, archive: null, pilot: null, writes: 0 },
    first = await boot(native, server);
  assert.equal(server.writes, 1);
  assert.equal(progress.summary(server.archive).progress.done, 0);
  assert.deepEqual(first.trace, ["bootstrap", "models", "remote", "interface"]);
  // Reauthentication is offered only after a real 401, and disappears on recovery.
  const accountBar = (body) =>
    body.children.find((n) => n.className === "account-bar");
  const login = accountBar(first.body).children.find(
    (n) => n.href === "/login",
  );
  assert.equal(login.textContent, "Войти снова");
  assert.equal(login.hidden, true);
  server.expired = true;
  await first.intervals[1]();
  assert.equal(login.hidden, false);
  server.expired = false;
  await first.intervals[1]();
  assert.equal(login.hidden, true);
  // An importer writes a new archive then reloads. Old controllers must never clear its dirty flag.
  const scoped = first.window.localStorage,
    raw = store.create(scoped, config).read(),
    next = progress.toRaw(f.full(), raw);
  next[config.revisionKey] = "import-revision";
  store.create(scoped, config).commit(next);
  const writes = server.writes;
  assert.equal(await first.window.CNCAccount.save(), false);
  await first.intervals[0]();
  assert.equal(server.writes, writes);
  assert.equal(JSON.parse(scoped.getItem("cnc-cloud-meta-v1")).dirty, true);
  assert.equal(
    progress.summary(progress.fromRaw(store.create(scoped, config).read()))
      .progress.done,
    22,
  );
  const second = await boot(native, server);
  assert.equal(progress.summary(server.archive).progress.done, 22);
  assert.equal(
    JSON.parse(second.window.localStorage.getItem("cnc-cloud-meta-v1")).dirty,
    false,
  );
  const beforeRollback = { ...server };
  server.revision = 0;
  server.archive = progress.empty();
  const rolledBack = await boot(native, server);
  assert.equal(
    progress.summary(rolledBack.window.CNCProgressUI.collect()).progress.done,
    22,
  );
  assert.equal(await rolledBack.window.CNCAccount.save(), false);
  assert.equal(progress.summary(server.archive).progress.done, 0);
  Object.assign(server, beforeRollback);
  // A newer revision in another tab cannot be silently adopted as the base of stale controllers.
  const meta = JSON.parse(
    second.window.localStorage.getItem("cnc-cloud-meta-v1"),
  );
  native.setItem(
    "cnc-account:" + user.id + ":cnc-cloud-meta-v1",
    JSON.stringify({ ...meta, revision: meta.revision + 1 }),
  );
  assert.throws(
    () => second.window.localStorage.setItem(config.sections.course, "{}"),
    /другой вкладкой/,
  );
  const failedServer = { revision: 0, archive: null, pilot: null, writes: 0 };
  const failed = await boot(storage(), failedServer, { failPhase: "models" });
  const nodes = (e) => [
    e,
    ...e.children.flatMap((n) => (n instanceof Element ? nodes(n) : [])),
  ];
  assert.equal(failed.window.CNCAccount, undefined);
  assert.equal(failedServer.writes, 0);
  assert.equal(failed.intervals.length, 0);
  assert(
    nodes(failed.body).some((n) => n.textContent === "Повторить загрузку"),
  );
  assert(nodes(failed.body).some((n) => n.dataset.state === "error"));
  for (const failPhase of ["bootstrap", "interface"]) {
    const cloud = { revision: 0, archive: null, pilot: null, writes: 0 };
    const interrupted = await boot(storage(), cloud, { failPhase });
    assert.equal(
      cloud.writes,
      0,
      "A failed phase must not submit a partial archive",
    );
    assert.equal(interrupted.intervals.length, 0);
    assert(nodes(interrupted.body).some((n) => n.dataset.state === "error"));
    if (interrupted.window.CNCAccount)
      assert.equal(await interrupted.window.CNCAccount.save(), false);
  }
  const timedOut = await boot(storage(), { ...failedServer, timeout: true });
  assert(
    nodes(timedOut.body).some((n) =>
      String(n.textContent).includes("Сервер не ответил вовремя"),
    ),
  );
  assert(
    nodes(timedOut.body).some((n) => n.textContent === "Повторить загрузку"),
  );
  console.log(
    "Account client: imported drafts survive reload/sync, stale controllers cannot erase imports or adopt another tab revision.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
