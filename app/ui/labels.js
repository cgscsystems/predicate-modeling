// How nodes, statuses and kinds are named in the outline and detail panel.

import { STATUSES, nodeOutput } from "../lib/workspace.js";

// Relative to dist/workbench.html in a checkout of the repository.
export const CONTRACTS_DOC = "../docs/SQL-Implementation-Contracts.md";

export const STATUS_SYMBOLS = { not_tested: "○", confirmed: "✓", empty: "∅", exception: "⚠", rejected: "✕", na: "–" };

export function statusLabel(id) {
  const status = STATUSES.find((entry) => entry.id === id);
  return status ? status.label : id;
}

export function nodeTitle(app, node) {
  const { ws, catalogue } = app;
  if (!node) return "(deleted)";
  if (node.kind === "table") return node.schema + "." + node.table;
  if (node.kind === "column") return ws.columns[node.columnKey].column;
  if (node.kind === "group") {
    const group = catalogue.group(node.groupId);
    return group ? group.label : node.groupId + " (not in catalogue)";
  }
  if (node.kind === "predicate") {
    if (node.custom) return node.custom.label;
    const predicate = catalogue.predicate(node.predicateId);
    return node.predicateId + " " + (predicate ? predicate.label : "(not in catalogue)");
  }
  if (node.kind === "sentence") {
    return node.componentIds.map((id) => nodeTitle(app, ws.nodes[id])).join(" ∩ ");
  }
  return node.id;
}

export function kindLabel(app, node) {
  if (node.kind === "table") return node.parentId ? "Nested table" : "Table";
  if (node.kind === "column") return "Column";
  if (node.kind === "group") return "Group";
  if (node.kind === "sentence") return "Lateral sentence (partition)";
  const output = nodeOutput(app.ws, app.catalogue, node.id);
  const prefix = node.custom ? "Custom predicate" : "Predicate";
  return output ? prefix + " (" + output + ")" : prefix + " (orphaned)";
}

export function kindIcon(app, node) {
  if (node.kind === "table") return node.parentId ? { symbol: "⊟", title: "Nested table" } : { symbol: "▦", title: "Table" };
  if (node.kind === "column") return { symbol: "▥", title: "Column" };
  if (node.kind === "group") return { symbol: "◇", title: "Group" };
  if (node.kind === "sentence") return { symbol: "∩", title: "Lateral sentence" };
  const output = nodeOutput(app.ws, app.catalogue, node.id);
  if (output === "measure") return { symbol: "∑", title: "Measure" };
  if (output === "partition") return { symbol: "◆", title: "Partition" };
  return { symbol: "?", title: "Orphaned predicate" };
}
