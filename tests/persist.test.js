import test from "node:test";
import assert from "node:assert/strict";

import { createCatalogue } from "../app/lib/catalogue.js";
import { exportFileName, findOrphans, parseWorkspace, serializeWorkspace } from "../app/lib/persist.js";
import { generateSql } from "../app/lib/sql.js";
import { addBlankPredicate, addGroup, combine, drillIn, updateRecord } from "../app/lib/workspace.js";
import { columnNode, exampleWorkspace, loadBundle } from "./helpers.js";

function investigatedWorkspace() {
  const { ws, catalogue } = exampleWorkspace();
  const status = columnNode(ws, "SALES.ORDERS.ORDER_STATUS_CDE");
  const [equals, differs] = addGroup(ws, catalogue, status.id, "M01", { selected_value: "'NC'" }).children;
  updateRecord(ws, equals, { status: "exception", rowCount: 12, appliedSql: "SELECT 1 FROM DUAL;", results: "12 rows", notes: "QA" });
  drillIn(ws, catalogue, equals);
  combine(ws, catalogue, [equals, differs]);
  addBlankPredicate(ws, status.id, { label: "Mine", sql: "SELECT 1 FROM DUAL" });
  return { ws, catalogue };
}

test("acceptance 10 (logic): export then open gives an identical workspace", () => {
  const { ws, catalogue } = investigatedWorkspace();
  const text = serializeWorkspace(ws, new Date("2026-09-25T12:00:00Z"));
  const { workspace, warnings } = parseWorkspace(text, "1.0.0");
  assert.deepEqual(warnings, []);
  assert.deepEqual(workspace, JSON.parse(text));
  assert.equal(workspace.savedAt, "2026-09-25T12:00:00.000Z");
  assert.equal(serializeWorkspace(workspace, new Date("2026-09-25T12:00:00Z")), text);
  for (const id of Object.keys(ws.nodes)) {
    assert.equal(generateSql(workspace, catalogue, id), generateSql(ws, catalogue, id));
  }
});

test("export file name uses local date and time", () => {
  assert.equal(exportFileName(new Date(2026, 8, 5, 7, 3)), "workbench-20260905-0703.json");
});

test("open rejects the wrong format, newer versions and broken structure", () => {
  const { ws } = investigatedWorkspace();
  const good = JSON.parse(serializeWorkspace(ws));
  const attempt = (change) => {
    const copy = structuredClone(good);
    change(copy);
    return () => parseWorkspace(JSON.stringify(copy), "1.0.0");
  };
  assert.throws(() => parseWorkspace("not json", "1.0.0"), /not valid JSON/);
  assert.throws(attempt((w) => { w.format = "something-else"; }), /format/);
  assert.throws(attempt((w) => { w.formatVersion = 2; }), /newer version/);
  assert.throws(attempt((w) => { w.nodes[w.roots[0]].children.push("missing"); }), /broken child/);
  assert.throws(attempt((w) => { delete w.columns["SALES.ORDERS.NOTES"]; }), /unknown column/);
});

test("a different catalogue version warns and orphans are kept, not dropped", () => {
  const { ws, catalogue } = investigatedWorkspace();
  const saved = JSON.parse(serializeWorkspace(ws));
  saved.catalogueVersion = "0.9.0";
  const group = Object.values(saved.nodes).find((node) => node.kind === "group");
  group.groupId = "M99";
  const predicate = saved.nodes[group.children[0]];
  predicate.predicateId = "M99.1";
  const { workspace, warnings } = parseWorkspace(JSON.stringify(saved), "1.0.0");
  assert.match(warnings[0], /catalogue 0\.9\.0/);
  assert.ok(workspace.nodes[group.id] && workspace.nodes[predicate.id]);
  assert.deepEqual(findOrphans(workspace, catalogue).sort(), [group.id, predicate.id].sort());
  assert.deepEqual(findOrphans(ws, createCatalogue(loadBundle(), ws.extensions)), []);
});
