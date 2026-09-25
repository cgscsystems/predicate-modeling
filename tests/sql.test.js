import test from "node:test";
import assert from "node:assert/strict";

import { generateSql, INTERSECT_COMMENT, tableSource, tagReport } from "../app/lib/sql.js";
import {
  addBlankPredicate, addColumnToTable, addGroup, combine, drillIn, setTagValue, updateRecord,
} from "../app/lib/workspace.js";
import { columnNode, exampleWorkspace, rootTable } from "./helpers.js";

const UNFILLED = /\{\{\w+\}\}/;

// Parentheses balance outside string literals and comments.
function balanced(sql) {
  const code = sql.replace(/'(?:[^']|'')*'/g, "''").replace(/--[^\n]*/g, "");
  let depth = 0;
  for (const ch of code) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (depth < 0) return false;
  }
  return depth === 0;
}

const stripEnd = (sql) => sql.replace(/\s*;\s*$/, "");

function memberNodes(ws, groupNode) {
  return groupNode.children.map((id) => ws.nodes[id]);
}

function setup() {
  const fixture = exampleWorkspace();
  const status = columnNode(fixture.ws, "SALES.ORDERS.ORDER_STATUS_CDE");
  return { ...fixture, status };
}

test("acceptance 4: U01 on a root column fills schema, table and column completely", () => {
  const { ws, catalogue, status } = setup();
  const [unique, nonUnique] = memberNodes(ws, addGroup(ws, catalogue, status.id, "U01"));
  const sql = generateSql(ws, catalogue, unique.id);
  assert.equal(sql, "SELECT p.* FROM ( SELECT t.*, COUNT(*) OVER ( PARTITION BY t.ORDER_STATUS_CDE ) AS profile_occurrence_count"
    + " FROM SALES.ORDERS t WHERE 1 = 1 ) p WHERE p.profile_occurrence_count = 1;");
  assert.doesNotMatch(generateSql(ws, catalogue, nonUnique.id), UNFILLED);
  assert.match(generateSql(ws, catalogue, nonUnique.id), /> 1;$/);
});

test("acceptance 5: M01 with selected_value 'NC' filters = and <> with nothing unfilled", () => {
  const { ws, catalogue, status } = setup();
  const [equals, differs] = memberNodes(ws, addGroup(ws, catalogue, status.id, "M01", { selected_value: "'NC'" }));
  assert.deepEqual(equals.tagValues, { selected_value: "'NC'" });
  assert.equal(generateSql(ws, catalogue, equals.id),
    "SELECT t.* FROM SALES.ORDERS t WHERE t.ORDER_STATUS_CDE IS NOT NULL AND t.ORDER_STATUS_CDE = 'NC' ;");
  const other = generateSql(ws, catalogue, differs.id);
  assert.match(other, /t\.ORDER_STATUS_CDE <> 'NC'/);
  assert.doesNotMatch(other, UNFILLED);
});

function nestTwice() {
  const { ws, catalogue, status } = setup();
  const [equals] = memberNodes(ws, addGroup(ws, catalogue, status.id, "M01", { selected_value: "'NC'" }));
  const level1 = drillIn(ws, catalogue, equals.id);
  const customerColumn = addColumnToTable(ws, level1.id, "SALES.ORDERS.CUSTOMER_ID");
  const [unique1] = memberNodes(ws, addGroup(ws, catalogue, customerColumn.id, "U01"));
  const level2 = drillIn(ws, catalogue, unique1.id);
  const dateColumn = addColumnToTable(ws, level2.id, "SALES.ORDERS.ORDER_DATE");
  const [unique2] = memberNodes(ws, addGroup(ws, catalogue, dateColumn.id, "U01"));
  return { ws, catalogue, equals, level1, unique1, level2, unique2 };
}

test("acceptance 6: nested sources project the parent partition's SQL and stay balanced", () => {
  const { ws, catalogue, equals, level1, unique1, level2, unique2 } = nestTwice();
  const columns = "t.ORDER_ID, t.CUSTOMER_ID, t.ORDER_STATUS_CDE, t.ORDER_DATE, t.TOTAL_AMOUNT, t.SHIP_POSTAL_CODE,\n       t.NOTES";
  const parent = stripEnd(generateSql(ws, catalogue, equals.id));
  assert.equal(tableSource(ws, catalogue, level1.id), "(SELECT " + columns + "\nFROM (\n    " + parent + "\n) t)");
  const sql1 = generateSql(ws, catalogue, unique1.id);
  assert.ok(sql1.includes("PARTITION BY t.CUSTOMER_ID"));
  assert.ok(sql1.includes("FROM (SELECT " + columns));
  const sql2 = generateSql(ws, catalogue, unique2.id);
  assert.ok(sql2.includes(tableSource(ws, catalogue, level2.id)));
  assert.ok(sql2.includes(stripEnd(generateSql(ws, catalogue, unique1.id)).split("\n")[0]));
  for (const sql of [sql1, sql2]) {
    assert.ok(balanced(sql), sql);
    assert.doesNotMatch(sql, UNFILLED);
    for (const list of sql.matchAll(/\(SELECT ([\s\S]*?)\nFROM \(/g)) {
      assert.doesNotMatch(list[1], /profile_/, "projection lists only base columns");
    }
  }
  assert.equal((sql2.match(/\(SELECT t\.ORDER_ID/g) || []).length, 2, "two projected levels");
});

test("acceptance 7: the parent's applied SQL replaces its generated SQL in the child's source", () => {
  const { ws, catalogue, equals, unique1 } = nestTwice();
  updateRecord(ws, equals.id, { appliedSql: "SELECT * FROM SALES.ORDERS WHERE ORDER_STATUS_CDE = 'NC';  \n" });
  const sql = generateSql(ws, catalogue, unique1.id);
  assert.ok(sql.includes("FROM (\n    SELECT * FROM SALES.ORDERS WHERE ORDER_STATUS_CDE = 'NC'\n) t)"), sql);
});

test("acceptance 9: combining two sibling partitions gives a lateral sentence with INTERSECT SQL", () => {
  const { ws, catalogue, status } = setup();
  const [equals] = memberNodes(ws, addGroup(ws, catalogue, status.id, "M01", { selected_value: "'NC'" }));
  const dateNode = columnNode(ws, "SALES.ORDERS.ORDER_DATE");
  const [isNull] = memberNodes(ws, addGroup(ws, catalogue, dateNode.id, "P01"));
  const sentence = combine(ws, catalogue, [equals.id, isNull.id]);
  assert.equal(sentence.parentId, rootTable(ws, "SALES.ORDERS").id);
  const strip = (id) => stripEnd(generateSql(ws, catalogue, id));
  const indent = (sql) => sql.split("\n").map((line) => (line ? "    " + line : line)).join("\n");
  assert.equal(generateSql(ws, catalogue, sentence.id),
    INTERSECT_COMMENT + "\nSELECT * FROM (\n" + indent(strip(equals.id)) + "\n)\nINTERSECT\nSELECT * FROM (\n" + indent(strip(isNull.id)) + "\n);");
  const nested = drillIn(ws, catalogue, sentence.id);
  assert.ok(balanced(tableSource(ws, catalogue, nested.id)));
});

test("tag report shows entered, automatic and unfilled tags; overrides win and can be cleared", () => {
  const { ws, catalogue, status } = setup();
  const [equals] = memberNodes(ws, addGroup(ws, catalogue, status.id, "M01"));
  const origins = () => Object.fromEntries(tagReport(ws, catalogue, equals.id).map((row) => [row.tag, [row.origin, row.value]]));
  assert.deepEqual(origins(), {
    column_name: ["automatic", "ORDER_STATUS_CDE"],
    schema_name: ["automatic", "SALES"],
    selected_value: ["unfilled", null],
    table_name: ["automatic", "ORDERS"],
  });
  assert.match(generateSql(ws, catalogue, equals.id), /= \{\{selected_value\}\} ;$/);
  setTagValue(ws, equals.id, "column_name", "UPPER(t.ORDER_STATUS_CDE)");
  assert.deepEqual(origins().column_name, ["entered", "UPPER(t.ORDER_STATUS_CDE)"]);
  assert.match(generateSql(ws, catalogue, equals.id), /t\.UPPER\(t\.ORDER_STATUS_CDE\) IS NOT NULL/);
  setTagValue(ws, equals.id, "column_name", "");
  assert.deepEqual(origins().column_name, ["automatic", "ORDER_STATUS_CDE"]);
  setTagValue(ws, equals.id, "table_name", "ORDERS_ARCHIVE");
  assert.match(generateSql(ws, catalogue, equals.id), /FROM SALES\.ORDERS_ARCHIVE t/);
});

test("scope, non-null and subject_query tags fill automatically; column tags stay unfilled on table groups", () => {
  const { ws, catalogue, status } = setup();
  const table = rootTable(ws, "SALES.ORDERS");
  const [empty] = memberNodes(ws, addGroup(ws, catalogue, table.id, "H01"));
  assert.equal(generateSql(ws, catalogue, empty.id), "SELECT COUNT(*) AS profile_row_count\nFROM SALES.ORDERS t\nWHERE (1 = 1)\nHAVING COUNT(*) = 0;");
  const [composite] = memberNodes(ws, addGroup(ws, catalogue, table.id, "U02"));
  assert.match(generateSql(ws, catalogue, composite.id), /PARTITION BY \{\{key_columns\}\}/);
  const [compliant] = memberNodes(ws, addGroup(ws, catalogue, table.id, "B01"));
  assert.match(generateSql(ws, catalogue, compliant.id), /FROM \(SELECT \* FROM SALES\.ORDERS\) t/);
  const [constant] = memberNodes(ws, addGroup(ws, catalogue, status.id, "U05"));
  const constantSql = generateSql(ws, catalogue, constant.id);
  assert.match(constantSql, /SELECT DISTINCT ORDER_STATUS_CDE FROM SALES\.ORDERS WHERE \(ORDER_STATUS_CDE IS NOT NULL\)/);
  const customer = columnNode(ws, "SALES.ORDERS.CUSTOMER_ID");
  const [inReference] = memberNodes(ws, addGroup(ws, catalogue, customer.id, "K01"));
  const k01 = generateSql(ws, catalogue, inReference.id);
  assert.match(k01, /FROM SALES\.ORDERS t/);
  assert.match(k01, /FROM \{\{reference_schema\}\}\.\{\{reference_table\}\} r/);
  const [negative] = memberNodes(ws, addGroup(ws, catalogue, columnNode(ws, "SALES.ORDERS.TOTAL_AMOUNT").id, "N01"));
  assert.match(generateSql(ws, catalogue, negative.id), /CASE WHEN t\.TOTAL_AMOUNT IS NOT NAN/);
});

test("blank predicates fill tags in hand-written SQL; orphans and deleted components are reported", () => {
  const { ws, catalogue, status } = setup();
  const blank = addBlankPredicate(ws, status.id, { label: "Lowercase codes", sql: "SELECT t.* FROM {{schema_name}}.{{table_name}} t WHERE t.{{column_name}} <> UPPER(t.{{column_name}}) AND {{extra}};" });
  assert.equal(generateSql(ws, catalogue, blank.id),
    "SELECT t.* FROM SALES.ORDERS t WHERE t.ORDER_STATUS_CDE <> UPPER(t.ORDER_STATUS_CDE) AND {{extra}};");
  const [equals] = memberNodes(ws, addGroup(ws, catalogue, status.id, "M01"));
  const sentence = combine(ws, catalogue, [blank.id, equals.id]);
  ws.nodes[equals.id].predicateId = "M99.1";
  assert.match(generateSql(ws, catalogue, equals.id), /^-- Predicate M99\.1 is not in catalogue 1\.0\.0/);
  delete ws.nodes[equals.id];
  assert.match(generateSql(ws, catalogue, sentence.id), new RegExp("-- Component " + equals.id + " was deleted"));
});

test("the group form asks only for tags automatic filling leaves open", async () => {
  const { unfilledGroupTags } = await import("../app/lib/sql.js");
  const { ws, catalogue, status } = setup();
  assert.deepEqual(unfilledGroupTags(ws, catalogue, status.id, "U01"), []);
  assert.deepEqual(unfilledGroupTags(ws, catalogue, status.id, "M01"), ["selected_value"]);
  assert.deepEqual(unfilledGroupTags(ws, catalogue, rootTable(ws, "SALES.ORDERS").id, "U02"), ["key_columns"]);
});
