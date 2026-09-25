import test from "node:test";
import assert from "node:assert/strict";

import { groupMenu, isRecommendedForColumn } from "../app/lib/applicability.js";
import { addGroup } from "../app/lib/workspace.js";
import { columnNode, exampleWorkspace, rootTable } from "./helpers.js";

const menuIds = (menu) => menu.flatMap((entry) => entry.groups.map((item) => item.group.id));

test("acceptance 3a: a Code column on VARCHAR2 offers M01 and Code-specific groups", () => {
  const { ws, catalogue } = exampleWorkspace();
  const ids = menuIds(groupMenu(ws, catalogue, columnNode(ws, "SALES.ORDERS.ORDER_STATUS_CDE")));
  assert.ok(ids.includes("M01"));
  for (const codeSpecific of ["K05", "K06", "K07", "A02"]) {
    const group = catalogue.group(codeSpecific);
    assert.ok(!group.applicability.universal);
    assert.equal(ids.includes(codeSpecific), group.applicability.semanticTypes.includes("Code"), codeSpecific);
  }
  assert.ok(ids.includes("K06"));
});

test("acceptance 3b: an unclassified column offers only universal groups", () => {
  const { ws, catalogue } = exampleWorkspace();
  const menu = groupMenu(ws, catalogue, columnNode(ws, "SALES.CUSTOMERS.LEGACY_REF"));
  const groups = menu.flatMap((entry) => entry.groups.map((item) => item.group));
  assert.ok(groups.length > 0);
  assert.ok(groups.every((group) => group.applicability.universal));
});

test("acceptance 3c: a NUMBER column offers no group whose storage classes are only T", () => {
  const { ws, catalogue } = exampleWorkspace();
  const menu = groupMenu(ws, catalogue, columnNode(ws, "SALES.ORDERS.TOTAL_AMOUNT"));
  const groups = menu.flatMap((entry) => entry.groups.map((item) => item.group));
  assert.ok(groups.some((group) => group.id === "N01"));
  for (const group of groups) {
    const classes = group.applicability.storageClasses;
    assert.ok(!(classes.length && classes.every((cls) => cls === "T")), group.id);
  }
});

test("acceptance 3d: Show all lists more, and choosing from it marks the group off-recommendation", () => {
  const { ws, catalogue } = exampleWorkspace();
  const node = columnNode(ws, "SALES.ORDERS.TOTAL_AMOUNT");
  const recommended = menuIds(groupMenu(ws, catalogue, node));
  const all = groupMenu(ws, catalogue, node, { showAll: true });
  assert.ok(menuIds(all).length > recommended.length);
  const x01 = all.flatMap((entry) => entry.groups).find((item) => item.group.id === "X01");
  assert.equal(x01.recommended, false);
  assert.equal(addGroup(ws, catalogue, node.id, "X01").offRecommendation, true);
  assert.equal(addGroup(ws, catalogue, node.id, "N01").offRecommendation, false);
});

test("menus follow attachment, nest by family and filter by text", () => {
  const { ws, catalogue } = exampleWorkspace();
  const table = rootTable(ws, "SALES.ORDERS");
  const tableMenu = groupMenu(ws, catalogue, table, { showAll: true });
  assert.ok(menuIds(tableMenu).includes("H01"));
  assert.ok(!menuIds(tableMenu).includes("U01"));
  assert.ok(tableMenu.every((entry) => entry.groups.every((item) => item.group.attachment === "table")));
  const column = columnNode(ws, "SALES.ORDERS.ORDER_STATUS_CDE");
  const filtered = groupMenu(ws, catalogue, column, { filter: "Equals SELECTED" });
  assert.deepEqual(menuIds(filtered), ["M01"]);
  assert.equal(filtered[0].family.id, "family:04");
  assert.deepEqual(filtered[0].groups[0].members.map((p) => p.id), ["M01.1", "M01.2"]);
  assert.deepEqual(groupMenu(ws, catalogue, ws.nodes[addGroup(ws, catalogue, column.id, "M01").id]), []);
});

test("storage rule: empty or A means unconstrained", () => {
  const group = (storageClasses) => ({ applicability: { universal: true, semanticTypes: [], storageClasses } });
  const column = { semanticTypes: [], storageClasses: ["B", "A"] };
  assert.equal(isRecommendedForColumn(group([]), column), true);
  assert.equal(isRecommendedForColumn(group(["A"]), column), true);
  assert.equal(isRecommendedForColumn(group(["C"]), column), false);
  assert.equal(isRecommendedForColumn(group(["C", "B"]), column), true);
});
