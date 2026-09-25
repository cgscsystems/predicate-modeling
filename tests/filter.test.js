import test from "node:test";
import assert from "node:assert/strict";

import { filterOutline, outlineMatcher } from "../app/lib/filter.js";
import { addGroup, updateRecord } from "../app/lib/workspace.js";
import { columnNode, exampleWorkspace, rootTable } from "./helpers.js";

function setup() {
  const { ws, catalogue } = exampleWorkspace();
  const status = columnNode(ws, "SALES.ORDERS.ORDER_STATUS_CDE");
  const [equals, differs] = addGroup(ws, catalogue, status.id, "M01").children;
  updateRecord(ws, equals, { status: "exception" });
  updateRecord(ws, differs, { status: "empty" });
  const title = (node) => (node.kind === "column" ? ws.columns[node.columnKey].column : node.kind === "predicate" ? node.predicateId : node.kind === "table" ? node.schema + "." + node.table : node.groupId);
  return { ws, status, equals, differs, title };
}

test("no criteria means no filter", () => {
  assert.equal(outlineMatcher({ text: " ", status: "" }, () => ""), null);
});

test("status filter keeps matches and their ancestors only", () => {
  const { ws, status, equals, title } = setup();
  const { visible, matched } = filterOutline(ws, ws.roots, outlineMatcher({ status: "exception" }, title));
  assert.deepEqual([...matched], [equals]);
  const orders = rootTable(ws, "SALES.ORDERS");
  assert.deepEqual(new Set(visible), new Set([orders.id, status.id, ws.nodes[equals].parentId, equals]));
});

test("'tested' matches any recorded status; text and status combine", () => {
  const { ws, equals, differs, title } = setup();
  assert.deepEqual([...filterOutline(ws, ws.roots, outlineMatcher({ status: "tested" }, title)).matched].sort(), [equals, differs].sort());
  assert.deepEqual([...filterOutline(ws, ws.roots, outlineMatcher({ text: "m01.2", status: "tested" }, title)).matched], [differs]);
  const byName = filterOutline(ws, ws.roots, outlineMatcher({ text: "customer_id" }, title)).matched;
  assert.equal(byName.size, 2, "the column in both tables");
});

test("filtering respects the zoomed view root", () => {
  const { ws, status, title } = setup();
  const { matched } = filterOutline(ws, [status.id], outlineMatcher({ text: "customer" }, title));
  assert.equal(matched.size, 0);
});
