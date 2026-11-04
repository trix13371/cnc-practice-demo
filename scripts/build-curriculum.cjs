"use strict";
const fs = require("node:fs"),
  path = require("node:path");
const curriculum = require("../curriculum-model.js");
fs.writeFileSync(
  path.join(__dirname, "../docs/curriculum-map.json"),
  JSON.stringify(curriculum.manifest(), null, 2) + "\n",
);
console.log(
  "Curriculum map exported: " +
    curriculum.coverage().routeSteps +
    " route steps.",
);
