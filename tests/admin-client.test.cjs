"use strict";
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const { Element } = require("./helpers/dom.cjs");
const progress = require("../progress-model.js"),
  intro = require("../start-session-model.js");
(async () => {
  const archive = progress.empty();
  let state = intro.create();
  for (const action of [
    { type: "inspect", part: "stock" },
    { type: "inspect", part: "chuck" },
    { type: "inspect", part: "tool" },
    { type: "next" },
  ])
    state = intro.transition(state, action);
  archive.sections.coursePath.current.firstSession = intro.snapshot(state);
  const summary = progress.summary(archive);
  const elements = Object.fromEntries(
    ["admin-users", "admin-detail", "admin-status", "admin-refresh"].map(
      (id) => ["#" + id, new Element("div")],
    ),
  );
  const user = {
    id: "local-admin",
    username: "admin",
    role: "admin",
    done: 0,
    total: 51,
  };
  const context = {
    Node: Element,
    setTimeout,
    Blob,
    URL,
    document: {
      querySelector: (id) => elements[id],
      createElement: (tag) => new Element(tag),
    },
    fetch: async (url) => ({
      ok: true,
      json: async () =>
        url === "/api/me"
          ? { user }
          : url === "/api/admin/users"
            ? [user]
            : { summary, archive, updatedAt: null, pilot: null },
    }),
  };
  vm.runInNewContext(
    fs.readFileSync(
      require.resolve("../server/public/admin-client.js"),
      "utf8",
    ),
    context,
  );
  await new Promise(setImmediate);
  const show = elements["#admin-users"]
    .all()
    .find((e) => e.tagName === "button");
  await show.onclick();
  const detail = elements["#admin-detail"];
  const overview = detail.children.find(
    (e) => e.className === "admin-overview",
  );
  assert(
    overview,
    "Current activity must be visible before the detailed tables",
  );
  assert.match(overview.textContent, /2 из 9/);
  assert(
    detail.querySelectorAll("details").length >= 5,
    "Evidence is grouped into collapsed sections",
  );
  for (const table of detail.querySelectorAll("table")) {
    let parent = table.parentNode,
      inFold = false;
    while (parent) {
      if (parent.tagName === "details") inFold = true;
      parent = parent.parentNode;
    }
    assert(inFold, "Detailed tables must not overwhelm the main summary");
    assert(
      table.querySelector("tbody").children.length > 0,
      "Empty evidence tables are omitted",
    );
  }
  assert(
    detail.children.some(
      (e) => e.tagName === "button" && e.textContent === "Скачать учебный JSON",
    ),
    "Archive export remains directly available",
  );
  console.log(
    "Admin: current action visible first, evidence collapsed, empty tables omitted and export available.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
