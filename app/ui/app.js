// Application state, actions and rendering. The logic lives in app/lib; this wires it to the page.

import { el, downloadText, formatTime, pickFile, replaceContent } from "./dom.js";
import { confirmDialog, messageDialog, openDialog } from "./dialogs.js";
import { nodeTitle } from "./labels.js";
import { renderOutline } from "./outline.js";
import { renderDetail } from "./detail.js";
import { openAddGroupDialog } from "./addgroup.js";
import { openAddColumnDialog, openCustomGroupsDialog, openCustomPredicateDialog } from "./forms.js";
import { clearAutosave, flushAutosave, readAutosave, scheduleAutosave, storageAvailable } from "./autosave.js";
import { createCatalogue } from "../lib/catalogue.js";
import { parseCsv } from "../lib/csv.js";
import { mergeExtensions, parseExtensionFile, serializeExtensions } from "../lib/extensions.js";
import { mergeMetadata, parseMetadataRows } from "../lib/metadata.js";
import { exportFileName, findOrphans, parseWorkspace, serializeWorkspace } from "../lib/persist.js";
import {
  addBlankPredicate, addColumnToTable, addGroup, addGroupMember, combine, createWorkspace, deleteNode, drillIn,
} from "../lib/workspace.js";
import { rowsFromWorkbook } from "../lib/xlsx.js";

function reportList(title, items) {
  if (!items.length) return null;
  return el("details", { class: "report-list" }, el("summary", { text: title + " (" + items.length + ")" }),
    el("ul", {}, items.map((item) => el("li", { text: item }))));
}

function hasContent(ws) {
  return ws.roots.length > 0 || Object.keys(ws.columns).length > 0 || ws.extensions.groups.length > 0;
}

function renderToolbar(app) {
  const autosave = !app.autosave.available
    ? "Autosave unavailable: browser storage is blocked. Export to keep your work."
    : app.autosave.offerPending ? "Autosave paused until you answer the restore offer."
      : app.autosave.failed ? "Autosave failed (storage full?). Export to keep your work."
        : app.autosave.savedAt ? "Autosaved " + formatTime(app.autosave.savedAt) : "Autosave on";
  const exported = app.lastExportAt
    ? "Last export " + formatTime(app.lastExportAt) + (app.changedSinceExport ? " · changes since" : " · up to date")
    : "Not exported yet";
  replaceContent(document.getElementById("toolbar"),
    el("h1", { class: "app-title", text: "Predicate Workbench" }),
    el("div", { class: "toolbar-actions" },
      el("button", { type: "button", text: "Import metadata…", onclick: () => app.actions.importMetadata() }),
      el("button", { type: "button", text: "Open workspace…", onclick: () => app.actions.openWorkspace() }),
      el("button", { type: "button", class: "primary", text: "Export workspace", onclick: () => app.actions.exportWorkspace() }),
      el("button", { type: "button", text: "Import catalogue extension…", onclick: () => app.actions.importExtension() }),
      el("button", { type: "button", text: "Custom groups…", onclick: () => openCustomGroupsDialog(app) })),
    el("div", { class: "toolbar-status", role: "status" },
      el("span", { class: "status-item" + (app.autosave.available && !app.autosave.failed ? "" : " warn"), id: "autosave-status", text: autosave }),
      el("span", { class: "status-item" + (app.changedSinceExport ? " warn" : ""), id: "export-status", text: exported })));
}

function readFileAs(file, kind) {
  return kind === "text" ? file.text() : file.arrayBuffer();
}

export function startApp(bundle, XLSX) {
  const app = {
    bundle,
    ws: createWorkspace(bundle.catalogueVersion),
    catalogue: null,
    selectedId: null,
    zoomId: null,
    combine: [],
    lastExportAt: null,
    changedSinceExport: false,
    autosave: { available: storageAvailable(), savedAt: null, failed: false, offerPending: false, timer: null },
  };
  app.catalogue = createCatalogue(bundle, app.ws.extensions);

  app.render = () => {
    renderToolbar(app);
    renderOutline(app);
    renderDetail(app);
  };

  // Call after every change to the workspace.
  app.commit = (options) => {
    const { catalogue = false, detail = true, exported = false } = options || {};
    if (catalogue) app.catalogue = createCatalogue(bundle, app.ws.extensions);
    if (app.selectedId && !app.ws.nodes[app.selectedId]) app.selectedId = null;
    if (app.zoomId && !app.ws.nodes[app.zoomId]) app.zoomId = null;
    app.combine = app.combine.filter((id) => app.ws.nodes[id]);
    if (!exported) app.changedSinceExport = true;
    scheduleAutosave(app, () => renderToolbar(app));
    renderToolbar(app);
    renderOutline(app);
    if (detail) renderDetail(app);
  };

  // Expands collapsed ancestors so the node is visible.
  const reveal = (id) => {
    for (let node = app.ws.nodes[app.ws.nodes[id].parentId]; node; node = app.ws.nodes[node.parentId]) node.collapsed = false;
  };

  app.select = (id) => {
    app.selectedId = id;
    if (id) reveal(id);
    renderOutline(app);
    renderDetail(app);
  };

  app.zoom = (id) => {
    app.zoomId = id;
    if (id) {
      app.ws.nodes[id].collapsed = false;
      app.selectedId = id;
    }
    renderOutline(app);
    renderDetail(app);
  };

  app.toggleCollapsed = (id) => {
    app.ws.nodes[id].collapsed = !app.ws.nodes[id].collapsed;
    app.commit({ detail: false });
  };

  app.toggleCombine = (id) => {
    app.combine = app.combine.includes(id) ? app.combine.filter((x) => x !== id) : [...app.combine, id];
    renderOutline(app);
    renderDetail(app);
  };

  app.clearCombine = () => {
    app.combine = [];
    renderOutline(app);
    renderDetail(app);
  };

  const attempt = (title, work) => {
    try {
      return work();
    } catch (problem) {
      messageDialog(title, problem.message);
      return null;
    }
  };

  app.replaceWorkspace = (ws, state) => {
    app.ws = ws;
    app.selectedId = null;
    app.zoomId = null;
    app.combine = [];
    app.lastExportAt = state.lastExportAt || null;
    app.changedSinceExport = Boolean(state.changedSinceExport);
    app.commit({ catalogue: true, exported: !state.changedSinceExport });
  };

  app.actions = {
    addGroup: (nodeId) => openAddGroupDialog(app, nodeId),
    addGroupNow: (parentId, groupId, tagValues) => attempt("Could not add the group", () => {
      const node = addGroup(app.ws, app.catalogue, parentId, groupId, tagValues);
      app.ws.nodes[parentId].collapsed = false;
      app.selectedId = node.id;
      app.commit();
    }),
    addMember: (groupNodeId, predicateId) => attempt("Could not add the predicate", () => {
      const node = addGroupMember(app.ws, app.catalogue, groupNodeId, predicateId, {});
      app.ws.nodes[groupNodeId].collapsed = false;
      app.selectedId = node.id;
      app.commit();
    }),
    addColumn: (tableNodeId) => openAddColumnDialog(app, tableNodeId),
    addColumnNow: (tableNodeId, columnKey) => attempt("Could not add the column", () => {
      const node = addColumnToTable(app.ws, tableNodeId, columnKey);
      app.ws.nodes[tableNodeId].collapsed = false;
      app.selectedId = node.id;
      app.commit();
    }),
    addCustomPredicate: (parentId) => openCustomPredicateDialog(app, parentId),
    addCustomPredicateNow: (parentId, fields) => {
      const node = addBlankPredicate(app.ws, parentId, fields);
      app.ws.nodes[parentId].collapsed = false;
      app.selectedId = node.id;
      app.commit();
    },
    drillIn: (nodeId) => attempt("Could not drill in", () => {
      const table = drillIn(app.ws, app.catalogue, nodeId);
      app.ws.nodes[nodeId].collapsed = false;
      app.selectedId = table.id;
      app.commit();
    }),
    combine: () => attempt("Could not combine", () => {
      const sentence = combine(app.ws, app.catalogue, app.combine);
      app.combine = [];
      app.ws.nodes[sentence.parentId].collapsed = false;
      app.selectedId = sentence.id;
      app.commit();
    }),
    deleteNode: async (nodeId) => {
      const node = app.ws.nodes[nodeId];
      let count = -1;
      for (const stack = [nodeId]; stack.length; count += 1) stack.push(...app.ws.nodes[stack.pop()].children);
      const message = "Delete " + nodeTitle(app, node) + (count ? " and the " + count + " node" + (count > 1 ? "s" : "") + " under it" : "")
        + "? Any records in them are lost. Imported column metadata is kept.";
      if (!(await confirmDialog("Delete", message, "Delete", true))) return;
      const parentId = node.parentId;
      deleteNode(app.ws, nodeId);
      app.selectedId = parentId;
      app.commit();
    },

    importMetadata: async () => {
      const file = await pickFile(".csv,.xlsx,text/csv");
      if (!file) return;
      let rows;
      try {
        rows = /\.csv$/i.test(file.name) ? parseCsv(await readFileAs(file, "text")) : rowsFromWorkbook(XLSX, await readFileAs(file, "buffer"));
      } catch (problem) {
        messageDialog("Import failed", "The file could not be read: " + problem.message);
        return;
      }
      const parsed = parseMetadataRows(rows, bundle.semanticTypes.map((type) => type.id));
      if (!parsed.ok) {
        messageDialog("Import failed", parsed.error);
        return;
      }
      const report = mergeMetadata(app.ws, app.catalogue, parsed);
      // New tables start collapsed so a large import stays quick to render and scan.
      for (const id of app.ws.roots) {
        const table = app.ws.nodes[id];
        if (report.tablesAdded.includes(table.schema + "." + table.table)) table.collapsed = true;
      }
      app.commit();
      openDialog({
        title: "Import report: " + file.name,
        label: "Import report",
        body: el("div", { class: "report" },
          el("p", { text: report.tablesAdded.length + " tables added, " + report.columnsAdded.length + " columns added, "
            + report.columnsUpdated.length + " columns updated, " + report.unchanged + " unchanged." }),
          el("p", { text: parsed.warnings.length + " warnings, " + parsed.skipped.length + " rows skipped." }),
          reportList("Tables added", report.tablesAdded),
          reportList("Columns added", report.columnsAdded),
          reportList("Columns updated", report.columnsUpdated),
          reportList("Warnings", report.warnings.map((w) => "Row " + w.row + ": " + w.message)),
          reportList("Skipped rows", report.skipped.map((s) => "Row " + s.row + ": " + s.reason))),
        actions: [{ label: "OK", kind: "primary" }],
      });
    },

    exportWorkspace: () => {
      const now = new Date();
      downloadText(exportFileName(now), serializeWorkspace(app.ws, now));
      app.lastExportAt = now.toISOString();
      app.changedSinceExport = false;
      app.commit({ exported: true, detail: false });
    },

    openWorkspace: async () => {
      if (hasContent(app.ws) && !(await confirmDialog("Open workspace", "Opening a workspace file replaces the current workspace. Export first if you need to keep it.", "Choose file…"))) return;
      const file = await pickFile(".json,application/json");
      if (!file) return;
      let result;
      try {
        result = parseWorkspace(await readFileAs(file, "text"), bundle.catalogueVersion);
      } catch (problem) {
        messageDialog("Could not open the workspace", problem.message);
        return;
      }
      app.replaceWorkspace(result.workspace, { lastExportAt: result.workspace.savedAt, changedSinceExport: false });
      const orphans = findOrphans(app.ws, app.catalogue).length;
      const notes = [...result.warnings];
      if (orphans) notes.push(orphans + " group or predicate nodes are not in this catalogue and are marked as orphaned.");
      if (notes.length) messageDialog("Workspace opened with warnings", el("div", {}, notes.map((note) => el("p", { text: note }))));
    },

    importExtension: async () => {
      const file = await pickFile(".json,application/json");
      if (!file) return;
      let report;
      try {
        report = mergeExtensions(app.ws, bundle, parseExtensionFile(await readFileAs(file, "text")));
      } catch (problem) {
        messageDialog("Could not import the extension", problem.message);
        return;
      }
      if (report.errors.length) {
        messageDialog("Extension rejected", el("div", {}, el("p", { text: "Nothing was imported:" }), el("ul", {}, report.errors.map((e) => el("li", { text: e })))));
        return;
      }
      const changed = report.groupsAdded.length + report.predicatesAdded.length;
      if (changed) app.commit({ catalogue: true });
      openDialog({
        title: "Extension import report",
        label: "Extension import report",
        body: el("div", { class: "report" },
          el("p", { text: changed
            ? report.groupsAdded.length + " groups and " + report.predicatesAdded.length + " predicates added."
            : "No changes: every entry in the file is already in this workspace or conflicts with it." }),
          el("p", { text: report.unchanged + " entries already present and identical; " + report.conflicts.length + " conflicts." }),
          reportList("Groups added", report.groupsAdded),
          reportList("Predicates added", report.predicatesAdded),
          reportList("Conflicts (existing entries kept)", report.conflicts.map((c) => c.id + ": " + c.reason))),
        actions: [{ label: "OK", kind: "primary" }],
      });
    },

    exportExtensions: () => {
      if (!app.ws.extensions.groups.length) {
        messageDialog("Nothing to export", "There are no custom groups in this workspace.");
        return;
      }
      downloadText("catalogue-extension-" + exportFileName(new Date()).replace(/^workbench-/, ""), serializeExtensions(app.ws));
    },
  };

  window.addEventListener("pagehide", () => flushAutosave(app));

  const saved = app.autosave.available ? readAutosave() : null;
  if (saved && hasContent(saved.workspace)) {
    app.autosave.offerPending = true;
    const banner = document.getElementById("banner");
    const close = () => {
      banner.hidden = true;
      app.autosave.offerPending = false;
    };
    replaceContent(banner,
      el("span", { text: "An autosaved workspace from " + formatTime(saved.savedAt) + " is available." }),
      el("button", {
        type: "button", class: "primary", text: "Restore",
        onclick: () => {
          let result;
          try {
            result = parseWorkspace(JSON.stringify(saved.workspace), bundle.catalogueVersion);
          } catch (problem) {
            close();
            messageDialog("Could not restore the autosave", problem.message);
            app.render();
            return;
          }
          close();
          app.replaceWorkspace(result.workspace, saved);
        },
      }),
      el("button", { type: "button", text: "Discard", onclick: () => { clearAutosave(); close(); app.render(); } }));
    banner.hidden = false;
  }
  app.render();
  return app;
}
