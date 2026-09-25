import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { ROOT } from "./helpers.js";

// build/build.py joins the app's modules into one inline script, which needs unique top-level
// names and plain relative named imports.
test("app modules can be concatenated into one script", () => {
  const files = ["main.js", ...["lib", "ui"].flatMap((dir) => readdirSync(path.join(ROOT, "app", dir))
    .filter((name) => name.endsWith(".js")).map((name) => dir + "/" + name))];
  const owner = new Map();
  for (const file of files) {
    const source = readFileSync(path.join(ROOT, "app", file), "utf8");
    for (const [statement] of source.matchAll(/^import[^;]*;/gm)) {
      assert.match(statement, /^import \{[\w,\s]+\} from "\.{1,2}\/(?:[\w-]+\/)?[\w-]+\.js";$/, file + ": " + statement);
    }
    for (const match of source.matchAll(/^(?:export )?(?:function|const|let|class) (\w+)/gm)) {
      assert.ok(!owner.has(match[1]), match[1] + " is declared in both " + owner.get(match[1]) + " and " + file);
      owner.set(match[1], file);
    }
  }
});
