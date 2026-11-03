"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const ROOT = path.resolve(__dirname, "..");
const isModel = (name) =>
  name === "training-math.js" ||
  name === "course-discovery.js" ||
  name === "task-guides.js" ||
  name === "model.js" ||
  name.endsWith("-model.js");

// Build once per server start, from the same ordered sources as the offline page.
// No writes, eval, package manager, or changes to the account recovery boundary.
function create() {
  const index = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const modules = [
    ...index.matchAll(/<script src="([\w-]+\.js)"><\/script>/g),
  ].map((match) => match[1]);
  if (!modules.length || new Set(modules).size !== modules.length)
    throw Error("Invalid client module list");
  const bootstrap = ["progress-config.js", "progress-store.js"];
  if (bootstrap.some((name) => !modules.includes(name)))
    throw Error("Missing storage bootstrap");
  const models = modules.filter(isModel);
  const ui = modules.filter(
    (name) => !isModel(name) && !bootstrap.includes(name),
  );
  const groups = [
    ["bootstrap", [...bootstrap, "server/public/account-storage.js"]],
    ["models", models],
    ["interface", ui],
  ].map(([kind, files]) => {
    const bytes = Buffer.from(
      files
        .map(
          (file) =>
            ";\n/* Source: " +
            file +
            " */\n" +
            fs.readFileSync(path.join(ROOT, file), "utf8"),
        )
        .join("\n"),
    );
    const hash = crypto
      .createHash("sha256")
      .update(bytes)
      .digest("hex")
      .slice(0, 16);
    return {
      kind,
      modules: files,
      bytes,
      url: "/assets/js/" + kind + "." + hash + ".js",
    };
  });
  return { groups };
}
module.exports = { create };
