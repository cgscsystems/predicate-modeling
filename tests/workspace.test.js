import test from "node:test";
import assert from "node:assert/strict";

import {
  addBlankPredicate, addColumnToTable, addGroup, addGroupMember, availableColumns, combine, deleteNode, drillIn,
  setCollapsed, subtreeStats, updateRecord, WorkspaceError,
} from "../app/lib/workspace.js";
import { columnNode, exampleWorkspace, rootTable } from "./helpers.js";

test("adding a group creates its members in ordinal order with empty records", () => {
  const { ws, catalogue } = exampleWorkspace();
  const status = columnNode(ws, "SALES.ORDERS.ORDER_STATUS_CDE");
  const group = addGroup(ws, catalogue, status.id, "X07", { uppercase_members: "'A-Z'", selected_value: "ignored" });
  assert.deepEqual(group.children.map((id) => ws.nodes[id].predicateId), ["X07.1", "X07.2", "X07.3", "X07.4"]);
  const first = ws.nodes[group.children[0]];
  assert.deepEqual(first.tagValues, { uppercase_members: "'A-Z'" });
  assert.equal(first.record.status, "not_tested");
  assert.equal(status.children.at(-1), group.id);
  const again = addGroupMember(ws, catalogue, group.id, "X07.1", {});
  assert.equal(group.children.length, 5);
  assert.equal(again.predicateId, "X07.1");
  assert.throws(() => addGroupMember(ws, catalogue, group.id, "M01.1"), WorkspaceError);
  addGroup(ws, catalogue, status.id, "M01");
  addGroup(ws, catalogue, status.id, "M01");
  assert.equal(status.children.filter((id) => ws.nodes[id].groupId === "M01").length, 2, "same group twice");
});

test("groups only attach to their kind of node", () => {
  const { ws, catalogue } = exampleWorkspace();
  const table = rootTable(ws, "SALES.ORDERS");
  assert.throws(() => addGroup(ws, catalogue, table.id, "U01"), /attaches to a column/);
  assert.throws(() => addGroup(ws, catalogue, table.id, "NOPE"), /Unknown group/);
});

test("acceptance 8: a measure cannot be drilled into; a partition drills into one reused table", () => {
  const { ws, catalogue } = exampleWorkspace();
  const status = columnNode(ws, "SALES.ORDERS.ORDER_STATUS_CDE");
  const [uniqueColumn] = addGroup(ws, catalogue, status.id, "U04").children;
  assert.throws(() => drillIn(ws, catalogue, uniqueColumn), /Only a partition/);
  const [equals] = addGroup(ws, catalogue, status.id, "M01").children;
  const nested = drillIn(ws, catalogue, equals);
  assert.equal(drillIn(ws, catalogue, equals).id, nested.id);
  assert.deepEqual([nested.schema, nested.table, nested.children], ["SALES", "ORDERS", []]);
  assert.equal(availableColumns(ws, nested.id).length, 7);
  addColumnToTable(ws, nested.id, "SALES.ORDERS.NOTES");
  addColumnToTable(ws, nested.id, "SALES.ORDERS.ORDER_ID");
  assert.deepEqual(nested.children.map((id) => ws.nodes[id].columnKey), ["SALES.ORDERS.ORDER_ID", "SALES.ORDERS.NOTES"]);
  assert.throws(() => addColumnToTable(ws, nested.id, "SALES.ORDERS.NOTES"), /not available/);
  assert.throws(() => addColumnToTable(ws, nested.id, "SALES.CUSTOMERS.CUSTOMER_ID"), /not available/);
  const measure = addBlankPredicate(ws, status.id, { label: "Count", sql: "SELECT COUNT(*) FROM x", output: "measure" });
  assert.throws(() => drillIn(ws, catalogue, measure.id), /Only a partition/);
});

test("combine needs two or more partitions under one table node", () => {
  const { ws, catalogue } = exampleWorkspace();
  const status = columnNode(ws, "SALES.ORDERS.ORDER_STATUS_CDE");
  const [equals, differs] = addGroup(ws, catalogue, status.id, "M01").children;
  const [measure] = addGroup(ws, catalogue, status.id, "U05").children;
  const [customerNull] = addGroup(ws, catalogue, columnNode(ws, "SALES.CUSTOMERS.CUSTOMER_ID").id, "P01").children;
  assert.throws(() => combine(ws, catalogue, [equals]), /at least two/);
  assert.throws(() => combine(ws, catalogue, [equals, measure]), /Only partitions/);
  assert.throws(() => combine(ws, catalogue, [equals, customerNull]), /same table node/);
  const nested = drillIn(ws, catalogue, equals);
  const inner = addColumnToTable(ws, nested.id, "SALES.ORDERS.ORDER_DATE");
  const [innerNull] = addGroup(ws, catalogue, inner.id, "P01").children;
  assert.throws(() => combine(ws, catalogue, [differs, innerNull]), /same table node/);
  const sentence = combine(ws, catalogue, [equals, differs]);
  assert.deepEqual(sentence.componentIds, [equals, differs]);
  const bigger = combine(ws, catalogue, [sentence.id, equals]);
  assert.equal(bigger.parentId, rootTable(ws, "SALES.ORDERS").id);
});

test("delete removes the subtree only; records update with a timestamp; stats count tested nodes", () => {
  const { ws, catalogue } = exampleWorkspace();
  const status = columnNode(ws, "SALES.ORDERS.ORDER_STATUS_CDE");
  const group = addGroup(ws, catalogue, status.id, "M01");
  const [equals, differs] = group.children;
  const nested = drillIn(ws, catalogue, equals);
  const now = new Date("2026-09-25T12:00:00Z");
  assert.equal(updateRecord(ws, differs, { status: "empty", rowCount: "0", notes: "none" }, now), true);
  assert.deepEqual(ws.nodes[differs].record, { status: "empty", rowCount: 0, appliedSql: "", results: "", notes: "none", updatedAt: now.toISOString() });
  assert.equal(updateRecord(ws, differs, { status: "empty" }, new Date()), false);
  assert.throws(() => updateRecord(ws, differs, { status: "maybe" }), /Unknown status/);
  assert.deepEqual(subtreeStats(ws, rootTable(ws, "SALES.ORDERS").id), { tested: 1, total: 2 });
  setCollapsed(ws, group.id, true);
  assert.equal(group.collapsed, true);
  const removed = deleteNode(ws, equals);
  assert.deepEqual(removed.sort(), [equals, nested.id].sort());
  assert.deepEqual(group.children, [differs]);
  const root = rootTable(ws, "SALES.CUSTOMERS");
  deleteNode(ws, root.id);
  assert.equal(ws.roots.length, 1);
  assert.ok(ws.columns["SALES.CUSTOMERS.CUSTOMER_ID"], "registry is never deleted");
});
