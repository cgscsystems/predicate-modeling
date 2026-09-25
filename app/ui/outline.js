// The outline (design §13): one indented tree, collapsible, with any node openable as the view root.

import { el, replaceContent } from "./dom.js";
import { STATUS_SYMBOLS, kindIcon, nodeTitle, statusLabel } from "./labels.js";
import { isPartition, subtreeStats } from "../lib/workspace.js";
import { findOrphans } from "../lib/persist.js";

const TAG_PREVIEW_LENGTH = 40;

function statusBadge(status) {
  return el("span", { class: "status status-" + status, title: "Status: " + statusLabel(status) },
    el("span", { class: "status-symbol", "aria-hidden": "true", text: STATUS_SYMBOLS[status] }), statusLabel(status));
}

function marker(text, kind, title) {
  return el("span", { class: "marker marker-" + kind, title: title || text, text });
}

function tagPreview(node) {
  const values = Object.entries(node.tagValues || {}).map(([tag, value]) => tag + " = " + value);
  const text = values.join(", ");
  return text.length > TAG_PREVIEW_LENGTH ? text.slice(0, TAG_PREVIEW_LENGTH - 1) + "…" : text;
}

function rowMeta(app, node, orphans) {
  const { ws, catalogue } = app;
  if (node.kind === "table") {
    const stats = subtreeStats(ws, node.id);
    return [el("span", { class: "meta", text: stats.tested + "/" + stats.total + " tested" })];
  }
  if (node.kind === "column") {
    const column = ws.columns[node.columnKey];
    return [
      el("span", { class: "meta", text: column.dataType || "no data type" }),
      el("span", { class: "meta" + (column.semanticTypes.length ? "" : " muted"), text: column.semanticTypes.join(", ") || "unclassified" }),
    ];
  }
  const parts = [];
  if (node.kind === "group") {
    const group = catalogue.group(node.groupId);
    if (group && group.crossSource) parts.push(marker("⇄ cross-source", "cross", "Needs another relation, supplied through tags"));
    if (node.offRecommendation) parts.push(marker("⚑ off-recommendation", "off", "Not recommended for this column's types"));
  }
  if (node.kind === "predicate" || node.kind === "sentence") {
    const preview = node.kind === "predicate" ? tagPreview(node) : "";
    if (preview) parts.push(el("span", { class: "meta tags", text: preview }));
    parts.push(statusBadge(node.record.status));
    if (node.record.rowCount !== null) parts.push(el("span", { class: "meta", text: node.record.rowCount + " rows" }));
  }
  if (orphans.has(node.id)) parts.push(marker("orphaned", "orphan", "Not in this catalogue version"));
  return parts;
}

function outlineRow(app, node, depth, orphans) {
  const selected = app.selectedId === node.id;
  const icon = kindIcon(app, node);
  const expandable = node.children.length > 0;
  const classes = ["row", "kind-" + node.kind];
  if (icon.title === "Measure") classes.push("measure");
  if (selected) classes.push("selected");
  if (app.combine.includes(node.id)) classes.push("combining");
  const row = el("div", {
    class: classes.join(" "),
    role: "treeitem",
    "aria-level": String(depth + 1),
    "aria-selected": selected ? "true" : "false",
    "aria-expanded": expandable ? String(!node.collapsed) : null,
    dataset: { id: node.id },
    style: "--depth: " + depth,
    onclick: (event) => {
      if ((event.ctrlKey || event.metaKey) && (node.kind === "predicate" || node.kind === "sentence")) app.toggleCombine(node.id);
      else app.select(node.id);
    },
    ondblclick: () => app.zoom(node.id),
  },
  expandable
    ? el("button", {
      type: "button", class: "twisty", "aria-label": node.collapsed ? "Expand" : "Collapse", text: node.collapsed ? "▸" : "▾",
      onclick: (event) => { event.stopPropagation(); app.toggleCollapsed(node.id); },
    })
    : el("span", { class: "twisty-spacer" }),
  el("span", { class: "icon", title: icon.title, "aria-label": icon.title, text: icon.symbol }));
  // Name, metadata and actions wrap together, aligned after the icon.
  const body = el("span", { class: "row-body" }, el("span", { class: "name", text: nodeTitle(app, node) }), rowMeta(app, node, orphans));
  row.append(body);
  if (selected) {
    const actions = el("span", { class: "row-actions" });
    if (node.kind === "column" || node.kind === "table") actions.append(el("button", { type: "button", text: "+ Group", onclick: (e) => { e.stopPropagation(); app.actions.addGroup(node.id); } }));
    if ((node.kind === "predicate" || node.kind === "sentence") && isPartition(app.ws, app.catalogue, node.id)) {
      actions.append(el("button", { type: "button", text: "Drill in", onclick: (e) => { e.stopPropagation(); app.actions.drillIn(node.id); } }));
    }
    actions.append(el("button", { type: "button", text: "Zoom", title: "Open as the root of the view", onclick: (e) => { e.stopPropagation(); app.zoom(node.id); } }));
    body.append(actions);
  }
  return row;
}

function appendSubtree(app, rows, nodeId, depth, orphans) {
  const node = app.ws.nodes[nodeId];
  rows.push(outlineRow(app, node, depth, orphans));
  if (node.collapsed) return;
  for (const childId of node.children) appendSubtree(app, rows, childId, depth + 1, orphans);
}

function renderBreadcrumb(app) {
  const crumbs = [el("button", { type: "button", class: "crumb", text: "All tables", disabled: !app.zoomId, onclick: () => app.zoom(null) })];
  const path = [];
  for (let id = app.zoomId; id; id = app.ws.nodes[id].parentId) path.unshift(id);
  path.forEach((id, index) => {
    crumbs.push(el("span", { class: "crumb-separator", "aria-hidden": "true", text: "›" }));
    const last = index === path.length - 1;
    crumbs.push(el("button", {
      type: "button", class: "crumb", text: nodeTitle(app, app.ws.nodes[id]), disabled: last, "aria-current": last ? "page" : null,
      onclick: () => app.zoom(id),
    }));
  });
  replaceContent(document.getElementById("breadcrumb"), crumbs);
}

function renderSelectionBar(app) {
  const bar = document.getElementById("selection-bar");
  bar.hidden = app.combine.length === 0;
  if (bar.hidden) return;
  replaceContent(bar,
    el("span", { text: app.combine.length + " selected to combine: " + app.combine.map((id) => nodeTitle(app, app.ws.nodes[id])).join(" ∩ ") }),
    el("button", { type: "button", class: "primary", text: "Combine", disabled: app.combine.length < 2, onclick: () => app.actions.combine() }),
    el("button", { type: "button", text: "Clear", onclick: () => app.clearCombine() }));
}

export function renderOutline(app) {
  const container = document.getElementById("outline");
  const orphans = new Set(findOrphans(app.ws, app.catalogue));
  const rows = [];
  const top = app.zoomId ? [app.zoomId] : app.ws.roots;
  for (const id of top) appendSubtree(app, rows, id, 0, orphans);
  if (!rows.length) {
    rows.push(el("div", { class: "empty-state" },
      el("p", { text: "No tables yet." }),
      el("p", { text: "Import a metadata sheet (CSV or XLSX, one row per column) to build the outline." }),
      el("button", { type: "button", class: "primary", text: "Import metadata…", onclick: () => app.actions.importMetadata() })));
  }
  replaceContent(container, rows);
  renderBreadcrumb(app);
  renderSelectionBar(app);
  const selected = container.querySelector(".row.selected");
  if (selected && selected.scrollIntoView) selected.scrollIntoView({ block: "nearest" });
}
