import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { createCatalogue } from "../app/lib/catalogue.js";
import { mergeMetadata, parseMetadataRows } from "../app/lib/metadata.js";
import { serializeWorkspace } from "../app/lib/persist.js";
import { addGroup, createWorkspace } from "../app/lib/workspace.js";
import { rowsFromWorkbook } from "../app/lib/xlsx.js";
import { ROOT, columnNode, exampleRows, exampleWorkspace, loadBundle, rootTable, semanticIds } from "./helpers.js";

const snapshot = (ws) => serializeWorkspace(ws, new Date(0));

test("acceptance 1: one root table per SCHEMA.TABLE with all columns in COLUMN_ID order and extra columns as notes", () => {
  const { ws, report } = exampleWorkspace();
  assert.deepEqual(ws.roots.map((id) => ws.nodes[id].schema + "." + ws.nodes[id].table), ["SALES.CUSTOMERS", "SALES.ORDERS"]);
  assert.deepEqual(report.tablesAdded.sort(), ["SALES.CUSTOMERS", "SALES.ORDERS"]);
  assert.equal(report.columnsAdded.length, 12);
  const orders = rootTable(ws, "SALES.ORDERS");
  assert.deepEqual(orders.children.map((id) => ws.columns[ws.nodes[id].columnKey].column),
    ["ORDER_ID", "CUSTOMER_ID", "ORDER_STATUS_CDE", "ORDER_DATE", "TOTAL_AMOUNT", "SHIP_POSTAL_CODE", "NOTES"]);
  const status = ws.columns["SALES.ORDERS.ORDER_STATUS_CDE"];
  assert.equal(status.dataType, "VARCHAR2(2)");
  assert.deepEqual(status.storageClasses, ["T", "C", "O", "A"]);
  assert.deepEqual(status.semanticTypes, ["Code"]);
  assert.equal(status.notes.COLUMN_COMMENT, "Order status (OP open, SH shipped, CL closed, XX cancelled)");
  assert.equal(status.notes.DEFAULT_VALUE, "OP");
  assert.equal(status.notes.PARENT_TABLE, "ORDER_STATUS");
  assert.equal(status.notes.COLUMN_ID, "3");
  assert.ok(!("SCHEMA_OWNER" in status.notes) && !("Semantic Type" in status.notes));
  assert.deepEqual(ws.columns["SALES.ORDERS.SHIP_POSTAL_CODE"].semanticTypes, ["PostalCode"]);
  assert.deepEqual(ws.columns["SALES.ORDERS.NOTES"].semanticTypes, ["FreeText"]);
  assert.deepEqual(ws.columns["SALES.CUSTOMERS.LEGACY_REF"].semanticTypes, []);
});

test("acceptance 2: re-importing changes nothing; one extra column adds only that column", () => {
  const { ws, catalogue } = exampleWorkspace();
  const before = snapshot(ws);
  const again = mergeMetadata(ws, catalogue, parseMetadataRows(exampleRows(), semanticIds()));
  assert.equal(snapshot(ws), before);
  assert.deepEqual([again.tablesAdded, again.columnsAdded, again.columnsUpdated], [[], [], []]);
  assert.equal(again.unchanged, 12);

  const rows = exampleRows();
  rows.push(["SALES", "ORDERS", "8", "CHANNEL_CDE", "VARCHAR2(3)", "Y", "", "Sales channel", "", "", "", "", "Code"]);
  const report = mergeMetadata(ws, catalogue, parseMetadataRows(rows, semanticIds()));
  assert.deepEqual(report.columnsAdded, ["SALES.ORDERS.CHANNEL_CDE"]);
  assert.deepEqual([report.tablesAdded, report.columnsUpdated], [[], []]);
  const orders = rootTable(ws, "SALES.ORDERS");
  assert.equal(ws.nodes[orders.children[7]].columnKey, "SALES.ORDERS.CHANNEL_CDE");
  assert.equal(Object.keys(ws.columns).length, 13);
});

test("headers and semantic types match ignoring case, spaces and underscores", () => {
  const rows = [
    ["schema owner", "Table_Name", "column name", "Data Type", "SEMANTIC TYPE", "Comment"],
    ["hr", "emp", "zip", "varchar2(10)", "postal code; free_text", "x"],
  ];
  const parsed = parseMetadataRows(rows, semanticIds());
  assert.equal(parsed.ok, true);
  const [record] = parsed.records;
  assert.equal(record.key, "HR.EMP.ZIP");
  assert.deepEqual(record.semanticTypes, ["PostalCode", "FreeText"]);
  assert.deepEqual(record.notes, { Comment: "x" });
  assert.equal(parsed.hasColumnId, false);
});

test("missing required header rejects the file", () => {
  const parsed = parseMetadataRows([["SCHEMA_OWNER", "TABLE_NAME", "COLUMN_NAME", "DATA_TYPE"]], semanticIds());
  assert.equal(parsed.ok, false);
  assert.match(parsed.error, /SEMANTIC_TYPE/);
});

test("unrecognized semantic values warn and are dropped; incomplete rows are skipped with row numbers", () => {
  const rows = [
    ["SCHEMA_OWNER", "TABLE_NAME", "COLUMN_NAME", "DATA_TYPE", "SEMANTIC_TYPE"],
    ["S", "T", "A", "NUMBER", "Code;Widget"],
    ["S", "", "B", "NUMBER", ""],
    ["", "", "", "", ""],
    ["S", "T", "", "DATE", "Date"],
  ];
  const parsed = parseMetadataRows(rows, semanticIds());
  assert.deepEqual(parsed.records.map((r) => [r.key, r.semanticTypes]), [["S.T.A", ["Code"]]]);
  assert.deepEqual(parsed.warnings, [{ row: 2, message: "Unrecognized semantic type \"Widget\"; ignored." }]);
  assert.deepEqual(parsed.skipped, [{ row: 3, reason: "Missing TABLE_NAME" }, { row: 5, reason: "Missing COLUMN_NAME" }]);
});

test("without COLUMN_ID, file order is kept and new columns go last", () => {
  const ws = createWorkspace("1.0.0");
  const catalogue = createCatalogue(loadBundle(), ws.extensions);
  const header = ["SCHEMA_OWNER", "TABLE_NAME", "COLUMN_NAME", "DATA_TYPE", "SEMANTIC_TYPE"];
  mergeMetadata(ws, catalogue, parseMetadataRows([header, ["S", "T", "Z", "DATE", ""], ["S", "T", "A", "DATE", ""]], semanticIds()));
  mergeMetadata(ws, catalogue, parseMetadataRows([header, ["S", "T", "M", "DATE", ""], ["S", "T", "Z", "DATE", ""]], semanticIds()));
  const table = rootTable(ws, "S.T");
  assert.deepEqual(table.children.map((id) => ws.nodes[id].columnKey), ["S.T.Z", "S.T.A", "S.T.M"]);
});

test("refreshing types keeps groups and marks those that no longer match", () => {
  const { ws, catalogue } = exampleWorkspace();
  const status = columnNode(ws, "SALES.ORDERS.ORDER_STATUS_CDE");
  const x01 = addGroup(ws, catalogue, status.id, "X01");
  const m01 = addGroup(ws, catalogue, status.id, "M01");
  assert.equal(x01.offRecommendation, false);
  const rows = exampleRows().map((row) => (row[3] === "ORDER_STATUS_CDE" ? [...row.slice(0, 4), "NUMBER(2)", ...row.slice(5)] : row));
  const report = mergeMetadata(ws, catalogue, parseMetadataRows(rows, semanticIds()));
  assert.deepEqual(report.columnsUpdated, ["SALES.ORDERS.ORDER_STATUS_CDE"]);
  assert.ok(ws.nodes[x01.id], "group kept");
  assert.equal(ws.nodes[x01.id].offRecommendation, true);
  assert.equal(ws.nodes[m01.id].offRecommendation, false);
  assert.equal(ws.nodes[x01.id].children.length, 2, "records untouched");
});

test("XLSX: first sheet read through the vendored SheetJS", () => {
  // Loaded as a classic script, as the browser does, so it defines the XLSX global.
  const context = {};
  vm.runInNewContext(readFileSync(path.join(ROOT, "app", "vendor", "xlsx.full.min.js"), "utf8"), context);
  const { XLSX } = context;
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(exampleRows()), "Columns");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["ignored"]]), "Other");
  const data = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  const rows = JSON.parse(JSON.stringify(rowsFromWorkbook(XLSX, data))); // arrays from the vm realm
  assert.deepEqual(rows, exampleRows());
});
