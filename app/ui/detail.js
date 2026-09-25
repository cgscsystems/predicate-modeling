// Detail panel for the selected node (design §13): definition, record, generated SQL and tags.

import { copyText, el, formatTime, replaceContent } from "./dom.js";
import { CONTRACTS_DOC, STATUS_SYMBOLS, kindLabel, nodeTitle } from "./labels.js";
import { generateSql, tableSource, tagReport } from "../lib/sql.js";
import { STATUSES, availableColumns, enclosingTable, isPartition, setTagValue, subtreeStats, updateRecord } from "../lib/workspace.js";
import { findOrphans } from "../lib/persist.js";

const ORIGIN_TEXT = { automatic: "automatic", entered: "entered", unfilled: "unfilled" };

function section(title, ...children) {
  return el("section", { class: "detail-section" }, title ? el("h3", { text: title }) : null, children);
}

function fieldRow(label, value) {
  return [el("dt", { text: label }), el("dd", { text: value == null || value === "" ? "—" : String(value) })];
}

function sqlBlock(sql, label) {
  const status = el("span", { class: "copy-status", role: "status" });
  return el("div", { class: "sql-block" },
    el("div", { class: "sql-toolbar" },
      el("span", { class: "sql-label", text: label }),
      status,
      el("button", {
        type: "button", text: "Copy", "aria-label": "Copy " + label,
        onclick: async () => { status.textContent = (await copyText(sql)) ? "Copied" : "Copy failed; select the text instead"; },
      })),
    el("pre", { class: "sql", tabindex: "0", "aria-label": label, text: sql }));
}

function actionBar(app, node) {
  const { ws, catalogue } = app;
  const buttons = [];
  const button = (text, onclick, kind) => buttons.push(el("button", { type: "button", class: kind || "", text, onclick }));
  if (node.kind === "table" || node.kind === "column") {
    button("+ Add group", () => app.actions.addGroup(node.id), "primary");
    if (node.kind === "table" && availableColumns(ws, node.id).length) button("+ Add column", () => app.actions.addColumn(node.id));
    button("+ Custom predicate", () => app.actions.addCustomPredicate(node.id));
  }
  if ((node.kind === "predicate" || node.kind === "sentence") && isPartition(ws, catalogue, node.id)) {
    button("Drill in", () => app.actions.drillIn(node.id), "primary");
    button(app.combine.includes(node.id) ? "Remove from combine selection" : "Select to combine", () => app.toggleCombine(node.id));
  }
  button(app.zoomId === node.id ? "Zoom out" : "Zoom in", () => app.zoom(app.zoomId === node.id ? (node.parentId || null) : node.id));
  button("Delete…", () => app.actions.deleteNode(node.id), "danger");
  return el("div", { class: "detail-actions" }, buttons);
}

function recordEditor(app, node) {
  const record = node.record;
  const save = (patch) => {
    if (updateRecord(app.ws, node.id, patch)) {
      updated.textContent = "Updated " + formatTime(node.record.updatedAt);
      app.commit({ detail: false });
    }
  };
  const updated = el("p", { class: "muted small", text: record.updatedAt ? "Updated " + formatTime(record.updatedAt) : "Not yet recorded" });
  const textArea = (field, label, rows, mono) => el("label", { class: "field" }, el("span", { text: label }),
    el("textarea", { rows: String(rows), class: mono ? "mono" : "", value: record[field], spellcheck: mono ? "false" : null, oninput: (event) => save({ [field]: event.target.value }) }));
  return section("Record",
    el("div", { class: "field-row" },
      el("label", { class: "field" }, el("span", { text: "Status" }),
        el("select", { onchange: (event) => save({ status: event.target.value }) },
          STATUSES.map((status) => el("option", { value: status.id, selected: status.id === record.status, text: STATUS_SYMBOLS[status.id] + " " + status.label })))),
      el("label", { class: "field" }, el("span", { text: "Row count" }),
        el("input", {
          type: "number", min: "0", step: "1", value: record.rowCount === null ? "" : String(record.rowCount),
          onchange: (event) => save({ rowCount: event.target.value === "" ? null : event.target.value }),
        }))),
    textArea("appliedSql", "SQL actually run", 6, true),
    textArea("results", "Results (summary, sample rows, counts)", 4, false),
    textArea("notes", "Notes (conclusions and reasoning)", 4, false),
    updated);
}

function tagEditor(app, node) {
  const rows = tagReport(app.ws, app.catalogue, node.id);
  if (!rows.length) return null;
  const body = rows.map((row) => {
    const input = el("input", {
      type: "text", class: "mono", value: row.origin === "entered" ? row.value : "", "aria-label": "Value for " + row.tag,
      placeholder: row.origin === "automatic" ? row.value : "unfilled",
      onchange: (event) => { setTagValue(app.ws, node.id, row.tag, event.target.value); app.commit(); },
    });
    return el("tr", { class: "tag-" + row.origin },
      el("th", { scope: "row" }, el("code", { text: row.tag })),
      el("td", {}, input),
      el("td", {}, el("span", { class: "origin origin-" + row.origin, text: ORIGIN_TEXT[row.origin] })),
      el("td", {}, row.origin === "entered" && row.automatic !== null
        ? el("button", { type: "button", class: "link", text: "Use automatic", onclick: () => { setTagValue(app.ws, node.id, row.tag, ""); app.commit(); } })
        : null));
  });
  const unfilled = rows.filter((row) => row.origin === "unfilled").length;
  return section("Tags",
    el("p", { class: "small" }, unfilled ? unfilled + " tag" + (unfilled > 1 ? "s" : "") + " left for you to fill. " : "All tags are filled. ",
      "Tag meanings: ", el("a", { href: CONTRACTS_DOC, target: "_blank", rel: "noopener", text: "SQL implementation contracts" }), "."),
    el("table", { class: "tags-table" },
      el("thead", {}, el("tr", {}, el("th", { text: "Tag" }), el("th", { text: "Value" }), el("th", { text: "Source" }), el("th", {}))),
      el("tbody", {}, body)));
}

function tableDetail(app, node) {
  const { ws, catalogue } = app;
  const stats = subtreeStats(ws, node.id);
  const parts = [el("dl", { class: "facts" },
    fieldRow("Table", node.schema + "." + node.table),
    fieldRow("Predicates tested", stats.tested + " of " + stats.total))];
  if (node.parentId) {
    parts.push(el("p", {}, "Rows of the partition ",
      el("button", { type: "button", class: "link", text: nodeTitle(app, ws.nodes[node.parentId]), onclick: () => app.select(node.parentId) }), "."));
    if (!node.children.some((id) => ws.nodes[id].kind === "column")) {
      parts.push(el("p", { class: "hint", text: "Add the columns you want to split these rows on." }));
    }
    parts.push(sqlBlock(tableSource(ws, catalogue, node.id), "Source of this nested table"));
  }
  return section(null, parts);
}

function columnDetail(app, node) {
  const column = app.ws.columns[node.columnKey];
  const notes = Object.entries(column.notes);
  return [
    section(null, el("dl", { class: "facts" },
      fieldRow("Column", node.columnKey),
      fieldRow("Data type", column.dataType),
      fieldRow("Storage classes", column.storageClasses.join(", ")),
      fieldRow("Semantic types", column.semanticTypes.join(", ") || "Unclassified (only universal groups are recommended)"))),
    section("Notes from the metadata sheet", notes.length
      ? el("dl", { class: "facts notes" }, notes.map(([key, value]) => fieldRow(key, value)))
      : el("p", { class: "muted", text: "No notes." })),
  ];
}

function groupDetail(app, node) {
  const group = app.catalogue.group(node.groupId);
  if (!group) return section(null, el("p", { class: "warning", text: "Group " + node.groupId + " is not in this catalogue version. Its predicates are kept as they were recorded." }));
  const family = app.catalogue.families.find((f) => f.id === group.familyId);
  const markers = [];
  if (node.offRecommendation) markers.push(el("p", { class: "marker-line marker-off", text: "⚑ Off-recommendation: this group is not recommended for the column's current types." }));
  if (group.crossSource) markers.push(el("p", { class: "marker-line marker-cross", text: "⇄ Cross-source: the SQL also reads another relation that you supply through tags." }));
  return [
    section(null, markers, el("p", { text: group.definition }),
      el("dl", { class: "facts" },
        fieldRow("Kind", group.kind === "complementary_pair" ? "Complementary pair" : group.kind === "multiway_group" ? "Multiway group" : "Custom group"),
        fieldRow("Family", family ? family.label : ""),
        fieldRow("Semantic applicability", group.applicability.semanticText),
        fieldRow("Storage applicability", group.applicability.storageText),
        group.note ? fieldRow("Workbench note", group.note) : null)),
    section("Members", el("ul", { class: "member-list" }, group.members.map((predicateId) => {
      const predicate = app.catalogue.predicate(predicateId);
      return el("li", {},
        el("span", { text: predicateId + " " + (predicate ? predicate.label : "") + (predicate && predicate.output === "measure" ? " (measure)" : "") }),
        el("button", { type: "button", text: "Add again", title: "Add another " + predicateId + " to this group", onclick: () => app.actions.addMember(node.id, predicateId) }));
    }))),
  ];
}

function predicateDetail(app, node) {
  const { ws, catalogue } = app;
  const parts = [];
  if (node.custom) {
    parts.push(section(null, el("p", { class: "muted", text: "One-off custom predicate with hand-written SQL." })));
  } else {
    const predicate = catalogue.predicate(node.predicateId);
    if (!predicate) {
      parts.push(section(null, el("p", { class: "warning", text: "Predicate " + node.predicateId + " is not in this catalogue version. Its record is kept." })));
    } else {
      const group = catalogue.group(predicate.groupId);
      parts.push(section(null,
        el("p", { text: predicate.definition }),
        el("dl", { class: "facts" },
          fieldRow("Group", group ? group.label : predicate.groupId),
          fieldRow("Output", predicate.output === "measure" ? "Measure: records a fact; cannot be drilled into" : "Partition: returns rows; can be drilled into"),
          predicate.complements.length ? fieldRow("Complement", predicate.complements.join(", ")) : null)));
    }
  }
  parts.push(section("Generated SQL", sqlBlock(generateSql(ws, catalogue, node.id), "Generated SQL"),
    el("p", { class: "muted small", text: "Read-only and recomputed from the outline. Paste what you actually ran into “SQL actually run”." })));
  parts.push(tagEditor(app, node));
  if (node.custom) parts.push(section("Hand-written SQL", el("pre", { class: "sql", text: node.custom.sql || "(empty)" })));
  parts.push(recordEditor(app, node));
  return parts;
}

function sentenceDetail(app, node) {
  const { ws, catalogue } = app;
  return [
    section("Components", el("p", { class: "small", text: "Rows returned by every component (INTERSECT), evaluated over " + nodeTitle(app, enclosingTable(ws, node.id)) + "." }),
      el("ul", { class: "member-list" }, node.componentIds.map((id) => el("li", {}, ws.nodes[id]
        ? el("button", { type: "button", class: "link", text: nodeTitle(app, ws.nodes[id]), onclick: () => app.select(id) })
        : el("span", { class: "warning", text: "Deleted component " + id }))))),
    section("Generated SQL", sqlBlock(generateSql(ws, catalogue, node.id), "Generated SQL")),
    recordEditor(app, node),
  ];
}

const DETAIL_BY_KIND = { table: tableDetail, column: columnDetail, group: groupDetail, predicate: predicateDetail, sentence: sentenceDetail };

export function renderDetail(app) {
  const panel = document.getElementById("detail");
  const node = app.selectedId ? app.ws.nodes[app.selectedId] : null;
  if (!node) {
    replaceContent(panel, el("div", { class: "detail-empty" },
      el("h2", { text: "Nothing selected" }),
      el("p", { text: "Select a table, column, group or predicate in the outline to see its details and record results." })));
    return;
  }
  const orphaned = findOrphans(app.ws, app.catalogue).includes(node.id);
  replaceContent(panel,
    el("header", { class: "detail-header" },
      el("p", { class: "detail-kind", text: kindLabel(app, node) + (orphaned ? " — orphaned" : "") }),
      el("h2", { text: nodeTitle(app, node) })),
    actionBar(app, node),
    DETAIL_BY_KIND[node.kind](app, node));
}
