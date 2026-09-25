// SQL generation (design §10). Generated SQL is recomputed from the workspace on demand.

import { indentLines, isBlank, stripStatementEnd } from "./util.js";
import { enclosingTable, getNode, owningColumnNode, tableColumns } from "./workspace.js";
import { tagsInSql } from "./catalogue.js";

const COLUMN_NAME_TAGS = ["column_name", "text_column", "value_column", "document_column", "raw_column", "lob_column", "geometry_column"];
const COLUMN_LIST_TAGS = ["value_columns", "key_columns", "category_columns", "entity_columns"];
const SCOPE_TAGS = ["population_condition", "population_scope_condition", "row_scope_condition", "chain_scope_condition", "subject_scope_condition"];
const NONNULL_TAGS = ["values_nonnull_condition", "category_nonnull_condition"];
const TAG_OR_SOURCE = /\{\{schema_name\}\}\.\{\{table_name\}\}|\{\{(\w+)\}\}/g;
const PROJECTION_WIDTH = 100;

export const INTERSECT_COMMENT = "-- INTERSECT removes duplicate rows and requires identical column lists; adjust as needed.";

function projection(columns) {
  if (!columns.length) return "t.*";
  const lines = [];
  let line = "";
  for (const column of columns.map((col) => "t." + col.column)) {
    if (line && line.length + column.length + 2 > PROJECTION_WIDTH) {
      lines.push(line + ",");
      line = "       " + column;
    } else {
      line = line ? line + ", " + column : column;
    }
  }
  lines.push(line);
  return lines.join("\n");
}

// SQL a nested table reads from: the parent partition's applied SQL if any, else its generated SQL.
function parentSql(ws, catalogue, partitionId) {
  const partition = ws.nodes[partitionId];
  const applied = partition.record && partition.record.appliedSql;
  return stripStatementEnd(isBlank(applied) ? generateSql(ws, catalogue, partitionId) : applied);
}

// The relation a table node's predicates select from (design §10.1).
export function tableSource(ws, catalogue, tableNodeId) {
  const table = getNode(ws, tableNodeId);
  if (!table.parentId) return table.schema + "." + table.table;
  const columns = tableColumns(ws, table.schema, table.table);
  return "(SELECT " + projection(columns) + "\nFROM (\n" + indentLines(parentSql(ws, catalogue, table.parentId), 4) + "\n) t)";
}

// The template text and tag list of a predicate node, or null when it is orphaned.
function predicateTemplate(catalogue, node) {
  if (node.custom) return { sql: node.custom.sql, tags: tagsInSql(node.custom.sql) };
  const predicate = catalogue.predicate(node.predicateId);
  return predicate ? { sql: predicate.sql, tags: predicate.tags } : null;
}

// Automatic tag values for a predicate node (design §10.2), excluding the source pair.
function automaticValues(ws, catalogue, node, source) {
  const values = { subject_query: "SELECT * FROM " + source };
  for (const tag of SCOPE_TAGS) values[tag] = "1 = 1";
  const parent = ws.nodes[node.parentId];
  const group = parent.kind === "group" ? catalogue.group(parent.groupId) : null;
  const columnNode = owningColumnNode(ws, node.id);
  const columnAttached = columnNode && (node.custom || (group && group.attachment === "column"));
  if (columnAttached) {
    const column = ws.columns[columnNode.columnKey].column;
    for (const tag of COLUMN_NAME_TAGS) values[tag] = column;
    for (const tag of COLUMN_LIST_TAGS) values[tag] = column;
    values.value_expression = "t." + column;
    for (const tag of NONNULL_TAGS) values[tag] = column + " IS NOT NULL";
  }
  return values;
}

function fillContext(ws, catalogue, node) {
  const table = enclosingTable(ws, node.id);
  const source = tableSource(ws, catalogue, table.id);
  const entered = (tag) => (isBlank(node.tagValues[tag]) ? undefined : node.tagValues[tag]);
  const automatic = automaticValues(ws, catalogue, node, source);
  automatic.schema_name = table.schema;
  automatic.table_name = table.table;
  const valueOf = (tag) => (entered(tag) !== undefined ? entered(tag) : automatic[tag]);
  const pair = entered("schema_name") !== undefined || entered("table_name") !== undefined
    ? valueOf("schema_name") + "." + valueOf("table_name")
    : source;
  return { table, source, entered, automatic, valueOf, pair };
}

// Every tag of a predicate with its current value and origin: entered, automatic or unfilled.
export function tagReport(ws, catalogue, nodeId) {
  const node = getNode(ws, nodeId);
  const template = node.kind === "predicate" ? predicateTemplate(catalogue, node) : null;
  if (!template) return [];
  const context = fillContext(ws, catalogue, node);
  return template.tags.map((tag) => {
    const entered = context.entered(tag);
    if (entered !== undefined) return { tag, value: entered, origin: "entered", automatic: context.automatic[tag] ?? null };
    let value = context.automatic[tag];
    if ((tag === "schema_name" || tag === "table_name") && context.table.parentId) value = "(parent partition rows)";
    if (value !== undefined) return { tag, value, origin: "automatic", automatic: value };
    return { tag, value: null, origin: "unfilled", automatic: null };
  });
}

function predicateSql(ws, catalogue, node) {
  const template = predicateTemplate(catalogue, node);
  if (!template) return "-- Predicate " + node.predicateId + " is not in catalogue " + catalogue.version + "; no SQL can be generated.";
  const context = fillContext(ws, catalogue, node);
  // One pass, so SQL inserted from a parent partition is never filled again.
  return template.sql.replace(TAG_OR_SOURCE, (match, tag) => {
    if (!tag) return context.pair;
    const value = context.valueOf(tag);
    return value === undefined ? match : value;
  });
}

function sentenceSql(ws, catalogue, node) {
  const parts = [];
  const missing = [];
  for (const id of node.componentIds) {
    if (!ws.nodes[id]) missing.push(id);
    else parts.push("SELECT * FROM (\n" + indentLines(stripStatementEnd(generateSql(ws, catalogue, id)), 4) + "\n)");
  }
  const lines = [INTERSECT_COMMENT, ...missing.map((id) => "-- Component " + id + " was deleted and is left out.")];
  return lines.join("\n") + "\n" + parts.join("\nINTERSECT\n") + ";";
}

export function generateSql(ws, catalogue, nodeId) {
  const node = getNode(ws, nodeId);
  if (node.kind === "predicate") return predicateSql(ws, catalogue, node);
  if (node.kind === "sentence") return sentenceSql(ws, catalogue, node);
  return "";
}
