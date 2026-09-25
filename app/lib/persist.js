// Workspace files (design §12): export, open and orphan detection.

import { emptyRecord, WORKSPACE_FORMAT, WORKSPACE_FORMAT_VERSION, WorkspaceError } from "./workspace.js";

const NODE_KINDS = ["table", "column", "group", "predicate", "sentence"];

export function serializeWorkspace(ws, now) {
  ws.savedAt = (now || new Date()).toISOString();
  return JSON.stringify(ws, null, 2) + "\n";
}

export function exportFileName(now) {
  const date = now || new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return "workbench-" + date.getFullYear() + pad(date.getMonth() + 1) + pad(date.getDate())
    + "-" + pad(date.getHours()) + pad(date.getMinutes()) + ".json";
}

function fail(message) {
  throw new WorkspaceError("This is not a usable workspace file: " + message);
}

// Parses and checks a workspace file. Returns { workspace, warnings }; throws WorkspaceError.
export function parseWorkspace(text, catalogueVersion) {
  let ws;
  try {
    ws = JSON.parse(text);
  } catch (error) {
    fail("it is not valid JSON.");
  }
  if (!ws || typeof ws !== "object" || ws.format !== WORKSPACE_FORMAT) fail("its format is not " + WORKSPACE_FORMAT + ".");
  if (typeof ws.formatVersion !== "number" || ws.formatVersion > WORKSPACE_FORMAT_VERSION) {
    fail("it was written by a newer version of the workbench (format version " + ws.formatVersion + ").");
  }
  for (const field of ["columns", "nodes"]) {
    if (!ws[field] || typeof ws[field] !== "object" || Array.isArray(ws[field])) fail("\"" + field + "\" is missing.");
  }
  if (!Array.isArray(ws.roots)) fail("\"roots\" is missing.");
  ws.extensions = ws.extensions || {};
  ws.extensions.groups = ws.extensions.groups || [];
  ws.extensions.predicates = ws.extensions.predicates || [];

  for (const [id, node] of Object.entries(ws.nodes)) {
    if (!node || node.id !== id || !NODE_KINDS.includes(node.kind)) fail("node " + id + " is malformed.");
    node.children = Array.isArray(node.children) ? node.children : [];
    node.collapsed = Boolean(node.collapsed);
    if (node.kind === "predicate") node.tagValues = node.tagValues || {};
    if (node.kind === "predicate" || node.kind === "sentence") node.record = { ...emptyRecord(), ...node.record };
    if (node.kind === "column" && !ws.columns[node.columnKey]) fail("node " + id + " refers to unknown column " + node.columnKey + ".");
    for (const childId of node.children) {
      if (!ws.nodes[childId] || ws.nodes[childId].parentId !== id) fail("node " + id + " has a broken child reference.");
    }
    if (node.parentId && !(ws.nodes[node.parentId] && ws.nodes[node.parentId].children.includes(id))) {
      fail("node " + id + " has a broken parent reference.");
    }
    if (!node.parentId && !ws.roots.includes(id)) fail("node " + id + " has no parent and is not a root.");
  }
  for (const id of ws.roots) {
    if (!ws.nodes[id] || ws.nodes[id].kind !== "table" || ws.nodes[id].parentId) fail("root " + id + " is not a root table.");
  }
  const warnings = [];
  if (ws.catalogueVersion !== catalogueVersion) {
    warnings.push("The file was saved with catalogue " + ws.catalogueVersion + "; this workbench has catalogue "
      + catalogueVersion + ". Entries no longer in the catalogue are marked as orphaned.");
  }
  return { workspace: ws, warnings };
}

// Group and predicate nodes whose catalogue IDs are unknown; they are kept, not dropped.
export function findOrphans(ws, catalogue) {
  const orphans = [];
  for (const node of Object.values(ws.nodes)) {
    if (node.kind === "group" && !catalogue.group(node.groupId)) orphans.push(node.id);
    if (node.kind === "predicate" && !node.custom && !catalogue.predicate(node.predicateId)) orphans.push(node.id);
  }
  return orphans;
}
