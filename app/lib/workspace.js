// Workspace model and node operations (design §8). Operations mutate the workspace passed in.

import { isRecommendedAt } from "./applicability.js";
import { isBlank, newId } from "./util.js";

export const WORKSPACE_FORMAT = "predicate-workbench-workspace";
export const WORKSPACE_FORMAT_VERSION = 1;

export const STATUSES = [
  { id: "not_tested", label: "Not tested" },
  { id: "confirmed", label: "Confirmed" },
  { id: "empty", label: "Empty" },
  { id: "exception", label: "Exception found" },
  { id: "rejected", label: "Rejected" },
  { id: "na", label: "N/A" },
];

const RECORD_FIELDS = ["status", "rowCount", "appliedSql", "results", "notes"];

export class WorkspaceError extends Error {}

export function createWorkspace(catalogueVersion) {
  return {
    format: WORKSPACE_FORMAT,
    formatVersion: WORKSPACE_FORMAT_VERSION,
    catalogueVersion,
    savedAt: null,
    columns: {},
    nodes: {},
    roots: [],
    extensions: { groups: [], predicates: [] },
  };
}

export function emptyRecord() {
  return { status: "not_tested", rowCount: null, appliedSql: "", results: "", notes: "", updatedAt: null };
}

export function columnKeyOf(schema, table, column) {
  return [schema, table, column].map((part) => String(part).trim().toUpperCase()).join(".");
}

export function getNode(ws, id) {
  const node = ws.nodes[id];
  if (!node) throw new WorkspaceError("No such node: " + id);
  return node;
}

function makeNode(ws, kind, parentId, fields) {
  const node = { id: newId(kind.charAt(0), ws.nodes), kind, parentId, children: [], collapsed: false, ...fields };
  ws.nodes[node.id] = node;
  if (parentId) ws.nodes[parentId].children.push(node.id);
  return node;
}

// The nearest table node at or above a node.
export function enclosingTable(ws, nodeId) {
  let node = getNode(ws, nodeId);
  while (node && node.kind !== "table") node = node.parentId ? ws.nodes[node.parentId] : null;
  return node || null;
}

// The column node a predicate or group hangs from, or null when it hangs from a table.
export function owningColumnNode(ws, nodeId) {
  let node = getNode(ws, nodeId);
  while (node && node.kind !== "column" && node.kind !== "table") node = node.parentId ? ws.nodes[node.parentId] : null;
  return node && node.kind === "column" ? node : null;
}

export function tableColumns(ws, schema, table) {
  return Object.entries(ws.columns)
    .filter(([, col]) => col.schema === schema && col.table === table)
    .sort(([keyA, a], [keyB, b]) => a.order - b.order || (keyA < keyB ? -1 : keyA > keyB ? 1 : 0))
    .map(([key, col]) => ({ key, ...col }));
}

export function findRootTable(ws, schema, table) {
  const id = ws.roots.find((rootId) => ws.nodes[rootId].schema === schema && ws.nodes[rootId].table === table);
  return id ? ws.nodes[id] : null;
}

export function addRootTable(ws, schema, table) {
  const node = makeNode(ws, "table", null, { schema, table });
  ws.roots.push(node.id);
  ws.roots.sort((a, b) => {
    const nameA = ws.nodes[a].schema + "." + ws.nodes[a].table;
    const nameB = ws.nodes[b].schema + "." + ws.nodes[b].table;
    return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
  });
  return node;
}

// Column nodes of a table first, in registry order; other children keep their order after them.
export function sortTableColumns(ws, tableNodeId) {
  const table = getNode(ws, tableNodeId);
  const orderOf = (id) => ws.columns[ws.nodes[id].columnKey].order;
  const columns = table.children.filter((id) => ws.nodes[id].kind === "column").sort((a, b) => orderOf(a) - orderOf(b));
  const others = table.children.filter((id) => ws.nodes[id].kind !== "column");
  table.children = [...columns, ...others];
}

export function addColumnNode(ws, tableNodeId, columnKey) {
  const node = makeNode(ws, "column", tableNodeId, { columnKey });
  sortTableColumns(ws, tableNodeId);
  return node;
}

// Registry columns of a table node's table that it does not show yet.
export function availableColumns(ws, tableNodeId) {
  const table = getNode(ws, tableNodeId);
  const shown = new Set(table.children.map((id) => ws.nodes[id]).filter((n) => n.kind === "column").map((n) => n.columnKey));
  return tableColumns(ws, table.schema, table.table).filter((col) => !shown.has(col.key));
}

export function addColumnToTable(ws, tableNodeId, columnKey) {
  const table = getNode(ws, tableNodeId);
  if (table.kind !== "table") throw new WorkspaceError("Columns can only be added to a table node.");
  if (!availableColumns(ws, tableNodeId).some((col) => col.key === columnKey)) {
    throw new WorkspaceError("Column " + columnKey + " is not available on this table node.");
  }
  return addColumnNode(ws, tableNodeId, columnKey);
}

function tagValuesFor(tags, tagValues) {
  const values = {};
  for (const tag of tags) {
    if (tagValues && !isBlank(tagValues[tag])) values[tag] = String(tagValues[tag]);
  }
  return values;
}

function makePredicateNode(ws, catalogue, groupNodeId, predicateId, tagValues) {
  const predicate = catalogue.predicate(predicateId);
  return makeNode(ws, "predicate", groupNodeId, {
    predicateId,
    tagValues: tagValuesFor(predicate.tags, tagValues),
    record: emptyRecord(),
  });
}

// Adds a group and all its members; tag values from the group form apply to every member.
export function addGroup(ws, catalogue, parentId, groupId, tagValues) {
  const parent = getNode(ws, parentId);
  const group = catalogue.group(groupId);
  if (!group) throw new WorkspaceError("Unknown group: " + groupId);
  if (parent.kind !== group.attachment) {
    throw new WorkspaceError("Group " + groupId + " attaches to a " + group.attachment + ", not a " + parent.kind + ".");
  }
  const node = makeNode(ws, "group", parentId, { groupId, offRecommendation: !isRecommendedAt(ws, group, parent) });
  for (const predicateId of group.members) makePredicateNode(ws, catalogue, node.id, predicateId, tagValues);
  return node;
}

// Adds a member of the group again, e.g. a second M01.1 with another selected_value.
export function addGroupMember(ws, catalogue, groupNodeId, predicateId, tagValues) {
  const groupNode = getNode(ws, groupNodeId);
  const group = groupNode.kind === "group" ? catalogue.group(groupNode.groupId) : null;
  if (!group || !group.members.includes(predicateId)) {
    throw new WorkspaceError(predicateId + " is not a member of this group.");
  }
  return makePredicateNode(ws, catalogue, groupNodeId, predicateId, tagValues);
}

// A one-off predicate with hand-written SQL, directly under a column or table node.
export function addBlankPredicate(ws, parentId, { label, sql, output = "partition" }) {
  const parent = getNode(ws, parentId);
  if (parent.kind !== "column" && parent.kind !== "table") {
    throw new WorkspaceError("A custom predicate is added to a column or table node.");
  }
  if (isBlank(label)) throw new WorkspaceError("A custom predicate needs a label.");
  if (output !== "partition" && output !== "measure") throw new WorkspaceError("Output must be partition or measure.");
  return makeNode(ws, "predicate", parentId, {
    predicateId: null,
    custom: { label: String(label), sql: String(sql || ""), output },
    tagValues: {},
    record: emptyRecord(),
  });
}

// "partition", "measure", or null for an orphaned predicate.
export function nodeOutput(ws, catalogue, nodeId) {
  const node = getNode(ws, nodeId);
  if (node.kind === "sentence") return "partition";
  if (node.kind !== "predicate") return null;
  if (node.custom) return node.custom.output;
  const predicate = catalogue.predicate(node.predicateId);
  return predicate ? predicate.output : null;
}

export function isPartition(ws, catalogue, nodeId) {
  return nodeOutput(ws, catalogue, nodeId) === "partition";
}

// Returns the partition's table child, creating it on first use.
export function drillIn(ws, catalogue, nodeId) {
  const node = getNode(ws, nodeId);
  if (!isPartition(ws, catalogue, nodeId)) throw new WorkspaceError("Only a partition can be drilled into.");
  const existing = node.children.find((id) => ws.nodes[id].kind === "table");
  if (existing) return ws.nodes[existing];
  const table = enclosingTable(ws, nodeId);
  return makeNode(ws, "table", nodeId, { schema: table.schema, table: table.table });
}

// Lateral sentence from two or more partitions under the same enclosing table node.
export function combine(ws, catalogue, nodeIds) {
  const ids = [...new Set(nodeIds)];
  if (ids.length < 2) throw new WorkspaceError("Select at least two partitions to combine.");
  let table = null;
  for (const id of ids) {
    const node = getNode(ws, id);
    if ((node.kind !== "predicate" && node.kind !== "sentence") || !isPartition(ws, catalogue, id)) {
      throw new WorkspaceError("Only partitions can be combined.");
    }
    const enclosing = enclosingTable(ws, id);
    if (table && enclosing.id !== table.id) throw new WorkspaceError("Combined partitions must sit under the same table node.");
    table = enclosing;
  }
  return makeNode(ws, "sentence", table.id, { componentIds: ids, record: emptyRecord() });
}

// Deletes a node and its subtree. Sentences elsewhere that used a deleted node keep the
// reference; their SQL reports the missing component.
export function deleteNode(ws, nodeId) {
  const node = getNode(ws, nodeId);
  const removed = [];
  const stack = [nodeId];
  while (stack.length) {
    const id = stack.pop();
    removed.push(id);
    stack.push(...ws.nodes[id].children);
  }
  if (node.parentId) {
    const parent = ws.nodes[node.parentId];
    parent.children = parent.children.filter((id) => id !== nodeId);
  } else {
    ws.roots = ws.roots.filter((id) => id !== nodeId);
  }
  for (const id of removed) delete ws.nodes[id];
  return removed;
}

export function updateRecord(ws, nodeId, patch, now) {
  const node = getNode(ws, nodeId);
  if (!node.record) throw new WorkspaceError("Only predicates and sentences have records.");
  let changed = false;
  for (const field of RECORD_FIELDS) {
    if (!(field in patch)) continue;
    let value = patch[field];
    if (field === "status" && !STATUSES.some((status) => status.id === value)) {
      throw new WorkspaceError("Unknown status: " + value);
    }
    if (field === "rowCount") {
      value = value === null || value === "" || value === undefined ? null : Number(value);
      if (value !== null && !Number.isFinite(value)) throw new WorkspaceError("Row count must be a number.");
    } else if (field !== "status") {
      value = String(value == null ? "" : value);
    }
    if (node.record[field] !== value) {
      node.record[field] = value;
      changed = true;
    }
  }
  if (changed) node.record.updatedAt = (now || new Date()).toISOString();
  return changed;
}

// An empty value clears the investigator's override.
export function setTagValue(ws, nodeId, tag, value) {
  const node = getNode(ws, nodeId);
  if (node.kind !== "predicate") throw new WorkspaceError("Tags belong to predicates.");
  if (isBlank(value)) delete node.tagValues[tag];
  else node.tagValues[tag] = String(value);
}

export function setCollapsed(ws, nodeId, collapsed) {
  getNode(ws, nodeId).collapsed = Boolean(collapsed);
}

export function columnNodesFor(ws, columnKey) {
  return Object.values(ws.nodes).filter((node) => node.kind === "column" && node.columnKey === columnKey);
}

// Re-evaluates off-recommendation markers of groups on a column after its types change.
// Returns the group nodes whose marker changed.
export function refreshRecommendations(ws, catalogue, columnKey) {
  const changed = [];
  for (const columnNode of columnNodesFor(ws, columnKey)) {
    for (const childId of columnNode.children) {
      const child = ws.nodes[childId];
      const group = child.kind === "group" ? catalogue.group(child.groupId) : null;
      if (!group) continue;
      const off = !isRecommendedAt(ws, group, columnNode);
      if (off !== child.offRecommendation) {
        child.offRecommendation = off;
        changed.push({ nodeId: child.id, groupId: child.groupId, columnKey, offRecommendation: off });
      }
    }
  }
  return changed;
}

// Predicates and sentences in a subtree, and how many have a status other than "Not tested".
export function subtreeStats(ws, nodeId) {
  let total = 0;
  let tested = 0;
  const stack = [nodeId];
  while (stack.length) {
    const node = ws.nodes[stack.pop()];
    if (node.record) {
      total += 1;
      if (node.record.status !== "not_tested") tested += 1;
    }
    stack.push(...node.children);
  }
  return { tested, total };
}
