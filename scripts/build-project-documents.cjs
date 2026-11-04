"use strict";
const fs = require("node:fs"),
  path = require("node:path"),
  m = require("../shaft-project-model.js");
const packet = {
  format: "cnc-project-assignments-v1",
  scope:
    "Учебные пакеты; не полный комплект ЕСКД и не допуск к физическому станку",
  projects: m.variants.map((t) => m.forTask(t.id).documents()),
};
fs.writeFileSync(
  path.join(__dirname, "../docs/project-shaft.json"),
  JSON.stringify(packet, null, 2) + "\n",
);
console.log(
  "Generated " +
    packet.projects.length +
    " project document packets from canonical assignments.",
);
