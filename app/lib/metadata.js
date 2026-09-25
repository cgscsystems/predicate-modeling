// Metadata sheet import and merge (design §7). Input is rows of cell text, header first,
// from parseCsv or rowsFromWorkbook.

import { canonicalJson, isBlank, normalizeKey } from "./util.js";
import { storageClassesFor } from "./storage.js";
import {
  addColumnNode, addRootTable, columnKeyOf, findRootTable, refreshRecommendations, sortTableColumns, tableColumns,
} from "./workspace.js";

export const REQUIRED_HEADERS = ["SCHEMA_OWNER", "TABLE_NAME", "COLUMN_NAME", "DATA_TYPE", "SEMANTIC_TYPE"];

// Returns { ok: true, records, hasColumnId, warnings, skipped } or { ok: false, error }.
// Row numbers count the header as row 1, as a spreadsheet does.
export function parseMetadataRows(rows, semanticTypeIds) {
  const header = (rows[0] || []).map((cell) => String(cell == null ? "" : cell).trim());
  const position = {};
  header.forEach((name, index) => {
    const key = normalizeKey(name);
    if (key && !(key in position)) position[key] = index;
  });
  const missing = REQUIRED_HEADERS.filter((name) => !(normalizeKey(name) in position));
  if (missing.length) {
    return { ok: false, error: "The file is missing required column" + (missing.length > 1 ? "s" : "") + ": " + missing.join(", ") + "." };
  }
  const known = new Set(REQUIRED_HEADERS.map(normalizeKey));
  const noteColumns = header.map((name, index) => ({ name, index }))
    .filter(({ name, index }) => name && !known.has(normalizeKey(name)) && position[normalizeKey(name)] === index);
  const hasColumnId = normalizeKey("COLUMN_ID") in position;
  const typeByKey = new Map(semanticTypeIds.map((id) => [normalizeKey(id), id]));
  const cell = (row, name) => String(row[position[normalizeKey(name)]] == null ? "" : row[position[normalizeKey(name)]]).trim();

  const warnings = [];
  const skipped = [];
  const byKey = new Map();
  rows.slice(1).forEach((row, index) => {
    const rowNumber = index + 2;
    if (row.every((value) => isBlank(value))) return;
    const schema = cell(row, "SCHEMA_OWNER");
    const table = cell(row, "TABLE_NAME");
    const column = cell(row, "COLUMN_NAME");
    const absent = [["SCHEMA_OWNER", schema], ["TABLE_NAME", table], ["COLUMN_NAME", column]].filter(([, value]) => !value).map(([name]) => name);
    if (absent.length) {
      skipped.push({ row: rowNumber, reason: "Missing " + absent.join(", ") });
      return;
    }
    const semanticTypes = [];
    for (const value of cell(row, "SEMANTIC_TYPE").split(";").map((part) => part.trim()).filter(Boolean)) {
      const id = typeByKey.get(normalizeKey(value));
      if (!id) warnings.push({ row: rowNumber, message: "Unrecognized semantic type \"" + value + "\"; ignored." });
      else if (!semanticTypes.includes(id)) semanticTypes.push(id);
    }
    const notes = {};
    for (const { name, index: at } of noteColumns) {
      const value = String(row[at] == null ? "" : row[at]).trim();
      if (value) notes[name] = value;
    }
    const columnIdText = hasColumnId ? cell(row, "COLUMN_ID") : "";
    const key = columnKeyOf(schema, table, column);
    if (byKey.has(key)) warnings.push({ row: rowNumber, message: "Duplicate column " + key + "; this later row is used." });
    byKey.set(key, {
      row: rowNumber,
      key,
      schema: schema.toUpperCase(),
      table: table.toUpperCase(),
      column: column.toUpperCase(),
      dataType: cell(row, "DATA_TYPE"),
      semanticTypes,
      notes,
      columnId: columnIdText !== "" && Number.isFinite(Number(columnIdText)) ? Number(columnIdText) : null,
    });
  });
  return { ok: true, records: [...byKey.values()], hasColumnId, warnings, skipped };
}

// Merges parsed records into the workspace. Nothing is deleted and records are never touched.
export function mergeMetadata(ws, catalogue, parsed) {
  const report = {
    tablesAdded: [], columnsAdded: [], columnsUpdated: [], unchanged: 0,
    warnings: parsed.warnings.slice(), skipped: parsed.skipped.slice(),
  };
  const nextOrder = new Map();
  const orderFor = (record, existing) => {
    if (record.columnId !== null) return record.columnId;
    if (existing) return existing.order;
    const tableKey = record.schema + "." + record.table;
    if (!nextOrder.has(tableKey)) {
      const orders = tableColumns(ws, record.schema, record.table).map((col) => col.order);
      nextOrder.set(tableKey, orders.length ? Math.max(...orders) + 1 : 1);
    }
    const order = nextOrder.get(tableKey);
    nextOrder.set(tableKey, order + 1);
    return order;
  };
  const reorder = new Set();

  for (const record of parsed.records) {
    const existing = ws.columns[record.key];
    const entry = {
      schema: record.schema,
      table: record.table,
      column: record.column,
      dataType: record.dataType,
      storageClasses: storageClassesFor(record.dataType),
      semanticTypes: record.semanticTypes,
      notes: record.notes,
      order: orderFor(record, existing),
    };
    if (!existing) {
      ws.columns[record.key] = entry;
      let root = findRootTable(ws, record.schema, record.table);
      if (!root) {
        root = addRootTable(ws, record.schema, record.table);
        report.tablesAdded.push(record.schema + "." + record.table);
      }
      addColumnNode(ws, root.id, record.key);
      report.columnsAdded.push(record.key);
      continue;
    }
    if (canonicalJson(existing) === canonicalJson(entry)) {
      report.unchanged += 1;
      continue;
    }
    const typesChanged = canonicalJson(existing.storageClasses) !== canonicalJson(entry.storageClasses)
      || canonicalJson(existing.semanticTypes) !== canonicalJson(entry.semanticTypes);
    if (existing.order !== entry.order) reorder.add(record.key);
    ws.columns[record.key] = entry;
    report.columnsUpdated.push(record.key);
    if (typesChanged) refreshRecommendations(ws, catalogue, record.key);
  }
  for (const key of reorder) {
    for (const node of Object.values(ws.nodes)) {
      if (node.kind === "column" && node.columnKey === key) sortTableColumns(ws, node.parentId);
    }
  }
  return report;
}
