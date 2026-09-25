// Keyboard control and the outline filter bar (design §13).

import { el } from "./dom.js";
import { openDialog } from "./dialogs.js";
import { STATUS_SYMBOLS } from "./labels.js";
import { STATUSES, isPartition } from "../lib/workspace.js";

export const SHORTCUTS = [
  ["↑ / ↓", "Previous / next row"],
  ["← / →", "Collapse, or go to the parent / expand, or go to the first child"],
  ["Home / End", "First / last row"],
  ["Enter", "Move to the detail panel"],
  ["Esc", "Back to the outline; clears the combine selection"],
  ["]", "Zoom into the selected row"],
  ["[", "Zoom out one level"],
  ["/", "Search the outline"],
  ["Space", "Select or deselect a partition to combine"],
  ["a", "Add a group to the selected column or table"],
  ["Delete", "Delete the selected row (asks first)"],
  ["?", "Show these shortcuts"],
];

export function showShortcuts() {
  openDialog({
    title: "Keyboard shortcuts",
    body: el("table", { class: "shortcuts" }, el("tbody", {}, SHORTCUTS.map(([keys, action]) =>
      el("tr", {}, el("th", { scope: "row" }, el("kbd", { text: keys })), el("td", { text: action }))))),
    actions: [{ label: "Close", kind: "primary" }],
  });
}

function typingIn(target) {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

function focusDetail() {
  const heading = document.querySelector("#detail h2");
  if (!heading) return;
  heading.tabIndex = -1;
  heading.focus();
  heading.scrollIntoView({ block: "nearest" });
}

function moveTo(app, id) {
  if (id) app.select(id);
}

function outlineKey(app, event) {
  if (event.altKey || event.ctrlKey || event.metaKey) return false;
  const { ws } = app;
  const ids = app.visibleRowIds || [];
  const index = ids.indexOf(app.selectedId);
  const node = app.selectedId ? ws.nodes[app.selectedId] : null;
  const filtering = Boolean(app.filter.text.trim() || app.filter.status);
  switch (event.key) {
    case "ArrowDown":
      moveTo(app, ids[index < 0 ? 0 : Math.min(index + 1, ids.length - 1)]);
      return true;
    case "ArrowUp":
      moveTo(app, ids[index < 0 ? 0 : Math.max(index - 1, 0)]);
      return true;
    case "Home":
      moveTo(app, ids[0]);
      return true;
    case "End":
      moveTo(app, ids[ids.length - 1]);
      return true;
    case "ArrowRight":
      if (!node || !node.children.length) return true;
      if (node.collapsed && !filtering) app.toggleCollapsed(node.id);
      else moveTo(app, node.children.find((id) => ids.includes(id)));
      return true;
    case "ArrowLeft":
      if (!node) return true;
      if (node.children.length && !node.collapsed && !filtering) app.toggleCollapsed(node.id);
      else if (node.parentId && ids.includes(node.parentId)) moveTo(app, node.parentId);
      return true;
    case "Enter":
      if (node) focusDetail();
      return true;
    case "]":
      if (node) app.zoom(node.id);
      return true;
    case "[":
      if (app.zoomId) app.zoom(ws.nodes[app.zoomId].parentId || null);
      return true;
    case " ":
      if (node && (node.kind === "predicate" || node.kind === "sentence") && isPartition(ws, app.catalogue, node.id)) app.toggleCombine(node.id);
      return true;
    case "a":
      if (node && (node.kind === "column" || node.kind === "table")) app.actions.addGroup(node.id);
      return true;
    case "Delete":
      if (node) app.actions.deleteNode(node.id);
      return true;
    case "Escape":
      if (app.combine.length) app.clearCombine();
      return true;
    default:
      return false;
  }
}

export function installKeyboard(app) {
  const outline = document.getElementById("outline");
  outline.tabIndex = 0;
  outline.addEventListener("keydown", (event) => {
    if (event.target !== outline) return;
    if (outlineKey(app, event)) event.preventDefault();
  });
  document.addEventListener("keydown", (event) => {
    if (document.querySelector("dialog[open]") || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "Escape" && event.target instanceof Node && document.getElementById("detail").contains(event.target)) {
      event.preventDefault();
      outline.focus();
      return;
    }
    if (typingIn(event.target)) return;
    if (event.key === "/") {
      event.preventDefault();
      document.getElementById("filter-text").focus();
    } else if (event.key === "?") {
      event.preventDefault();
      showShortcuts();
    }
  });
}

// Built once so typing in it never loses focus to a re-render.
export function installFilterBar(app) {
  const text = el("input", {
    type: "search", id: "filter-text", placeholder: "Search names (press / )", "aria-label": "Search the outline by name",
    oninput: () => { app.filter.text = text.value; app.refreshOutline(); },
    onkeydown: (event) => {
      if (event.key === "Escape" && text.value) {
        event.preventDefault();
        event.stopPropagation();
        app.clearFilter();
      } else if (event.key === "Enter" || event.key === "ArrowDown") {
        event.preventDefault();
        if (app.matchedRowIds.length) {
          app.select(app.matchedRowIds[0]);
          document.getElementById("outline").focus();
        }
      }
    },
  });
  const status = el("select", {
    id: "filter-status", "aria-label": "Filter by status",
    onchange: () => { app.filter.status = status.value; app.refreshOutline(); },
  },
  el("option", { value: "", text: "Any status" }),
  el("option", { value: "tested", text: "Tested (any result)" }),
  STATUSES.map((entry) => el("option", { value: entry.id, text: STATUS_SYMBOLS[entry.id] + " " + entry.label })));
  const bar = document.getElementById("filter-bar");
  bar.append(text, status,
    el("span", { id: "filter-count", class: "muted small", role: "status" }),
    el("button", { type: "button", class: "link", text: "Clear", onclick: () => app.clearFilter() }));
  app.clearFilter = () => {
    text.value = "";
    status.value = "";
    app.filter = { text: "", status: "" };
    app.refreshOutline();
  };
}
