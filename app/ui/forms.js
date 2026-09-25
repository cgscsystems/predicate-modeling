// Smaller add flows: columns on nested tables, one-off custom predicates, and custom groups.

import { el, replaceContent } from "./dom.js";
import { openDialog } from "./dialogs.js";
import { nodeTitle } from "./labels.js";
import { availableColumns } from "../lib/workspace.js";
import { putCustomGroup } from "../lib/extensions.js";

const SQL_PLACEHOLDER = "SELECT t.*\nFROM {{schema_name}}.{{table_name}} t\nWHERE t.{{column_name}} ...;";

export function openAddColumnDialog(app, tableNodeId) {
  const columns = availableColumns(app.ws, tableNodeId);
  const dialog = openDialog({
    title: "Add a column to " + nodeTitle(app, app.ws.nodes[tableNodeId]),
    body: el("div", {},
      el("p", { text: "Choose a column to split this table's rows on." }),
      el("ul", { class: "choice-list" }, columns.map((column) => el("li", {},
        el("button", {
          type: "button", class: "choice", "data-column": column.key,
          onclick: () => { dialog.close(); app.actions.addColumnNow(tableNodeId, column.key); },
        },
        el("span", { class: "choice-title", text: column.column }),
        el("span", { class: "muted", text: " " + column.dataType + (column.semanticTypes.length ? " · " + column.semanticTypes.join(", ") : "") })))))),
    actions: [{ label: "Cancel" }],
  });
}

export function openCustomPredicateDialog(app, parentId) {
  const label = el("input", { type: "text", name: "label", "aria-label": "Label" });
  const output = el("select", { name: "output", "aria-label": "Output" },
    el("option", { value: "partition", text: "Partition: returns rows" }),
    el("option", { value: "measure", text: "Measure: returns a count or statistic" }));
  const sql = el("textarea", { rows: "8", class: "mono", name: "sql", placeholder: SQL_PLACEHOLDER, spellcheck: "false", "aria-label": "SQL" });
  const error = el("p", { class: "error", role: "alert" });
  openDialog({
    title: "Custom predicate on " + nodeTitle(app, app.ws.nodes[parentId]),
    body: el("div", { class: "form" },
      el("p", { class: "small", text: "A one-off predicate with hand-written SQL. {{tag}} placeholders are filled by the same rules as catalogue SQL." }),
      el("label", { class: "field" }, el("span", { text: "Label" }), label),
      el("label", { class: "field" }, el("span", { text: "Output" }), output),
      el("label", { class: "field" }, el("span", { text: "SQL" }), sql),
      error),
    actions: [
      { label: "Cancel" },
      {
        label: "Add predicate", kind: "primary",
        onClick: () => {
          try {
            app.actions.addCustomPredicateNow(parentId, { label: label.value, output: output.value, sql: sql.value });
            return false;
          } catch (problem) {
            error.textContent = problem.message;
            return true;
          }
        },
      },
    ],
  });
  label.focus();
}

function memberEditor(member, onRemove) {
  const fields = {
    label: el("input", { type: "text", value: member.label || "", "aria-label": "Member label" }),
    definition: el("input", { type: "text", value: member.definition || "", "aria-label": "Member definition" }),
    output: el("select", { "aria-label": "Member output" },
      el("option", { value: "partition", text: "Partition", selected: member.output !== "measure" }),
      el("option", { value: "measure", text: "Measure", selected: member.output === "measure" })),
    sql: el("textarea", { rows: "5", class: "mono", value: member.sql || "", placeholder: SQL_PLACEHOLDER, spellcheck: "false", "aria-label": "Member SQL template" }),
  };
  const block = el("fieldset", { class: "member-editor" },
    el("legend", { text: member.id }),
    el("label", { class: "field" }, el("span", { text: "Label" }), fields.label),
    el("label", { class: "field" }, el("span", { text: "Definition" }), fields.definition),
    el("label", { class: "field" }, el("span", { text: "Output" }), fields.output),
    el("label", { class: "field" }, el("span", { text: "SQL template" }), fields.sql),
    el("button", { type: "button", class: "link", text: "Remove member", onclick: onRemove }));
  return { block, read: () => ({ id: member.id, label: fields.label.value, definition: fields.definition.value, output: fields.output.value, sql: fields.sql.value }) };
}

function groupEditor(app, existing, onSaved) {
  const group = existing || { id: "", label: "", definition: "", attachment: "column", applicability: { universal: true, semanticTypes: [], storageClasses: [] }, members: [] };
  const slug = el("input", { type: "text", value: group.id.replace(/^custom:/, ""), disabled: Boolean(existing), placeholder: "my-group", "aria-label": "Group ID" });
  const label = el("input", { type: "text", value: group.label, "aria-label": "Group label" });
  const definition = el("textarea", { rows: "2", value: group.definition, "aria-label": "Group definition" });
  const attachment = el("select", { "aria-label": "Attachment" },
    el("option", { value: "column", text: "Column", selected: group.attachment === "column" }),
    el("option", { value: "table", text: "Table", selected: group.attachment === "table" }));
  const universal = el("input", { type: "checkbox", checked: group.applicability.universal });
  const typeBoxes = app.bundle.semanticTypes.map((type) => ({ id: type.id, box: el("input", { type: "checkbox", checked: group.applicability.semanticTypes.includes(type.id) }) }));
  const classBoxes = app.bundle.storageClasses.map((cls) => ({ id: cls.id, box: el("input", { type: "checkbox", checked: group.applicability.storageClasses.includes(cls.id) }) }));
  const memberList = el("div", { class: "member-editors" });
  const editors = [];
  const predicates = new Map(app.ws.extensions.predicates.map((p) => [p.id, p]));
  let nextNumber = 1 + Math.max(0, ...group.members.map((id) => Number(id.split(".").pop())));
  const groupId = () => "custom:" + slug.value.trim();
  const addEditor = (member) => {
    const editor = memberEditor(member, () => {
      editors.splice(editors.indexOf(editor), 1);
      editor.block.remove();
    });
    editors.push(editor);
    memberList.append(editor.block);
  };
  group.members.forEach((id) => addEditor(predicates.get(id) || { id }));
  const error = el("p", { class: "error", role: "alert" });

  const body = el("div", { class: "form" },
    el("label", { class: "field" }, el("span", { text: "ID" }), el("span", { class: "prefixed" }, el("code", { text: "custom:" }), slug)),
    el("label", { class: "field" }, el("span", { text: "Label" }), label),
    el("label", { class: "field" }, el("span", { text: "Definition" }), definition),
    el("label", { class: "field" }, el("span", { text: "Attaches to" }), attachment),
    el("fieldset", {}, el("legend", { text: "Applicability" }),
      el("label", { class: "checkbox" }, universal, " Every semantic type (universal)"),
      el("details", {}, el("summary", { text: "Semantic types" }),
        el("div", { class: "checkbox-grid" }, typeBoxes.map(({ id, box }) => el("label", { class: "checkbox" }, box, " " + id)))),
      el("details", {}, el("summary", { text: "Storage classes (none ticked = no storage constraint)" }),
        el("div", { class: "checkbox-grid" }, classBoxes.map(({ id, box }) => el("label", { class: "checkbox" }, box, " " + id))))),
    el("h3", { text: "Members" }),
    memberList,
    el("button", {
      type: "button", text: "+ Add member",
      onclick: () => {
        if (!slug.value.trim()) {
          error.textContent = "Enter the group ID first; member IDs are built from it.";
          return;
        }
        addEditor({ id: groupId() + "." + nextNumber++, output: "partition" });
      },
    }),
    error);

  const save = () => {
    const members = editors.map((editor) => ({ ...editor.read(), id: groupId() + "." + editor.read().id.split(".").pop() }));
    try {
      putCustomGroup(app.ws, app.bundle, {
        id: groupId(), label: label.value, definition: definition.value, attachment: attachment.value,
        applicability: {
          universal: universal.checked,
          semanticTypes: typeBoxes.filter(({ box }) => box.checked).map(({ id }) => id),
          storageClasses: classBoxes.filter(({ box }) => box.checked).map(({ id }) => id),
        },
        members: members.map((member) => member.id),
      }, members);
    } catch (problem) {
      error.textContent = problem.message;
      return true;
    }
    app.commit({ catalogue: true });
    onSaved();
    return false;
  };
  return { body, save };
}

export function openCustomGroupsDialog(app) {
  const list = el("div", {});
  const refresh = () => {
    const groups = app.ws.extensions.groups;
    replaceContent(list, groups.length
      ? el("ul", { class: "choice-list" }, groups.map((group) => el("li", {},
        el("span", { class: "choice-title", text: group.label }), el("span", { class: "muted", text: " " + group.id + " · " + group.attachment + " · " + group.members.length + " members " }),
        el("button", { type: "button", text: "Edit", onclick: () => edit(group) }))))
      : el("p", { class: "muted", text: "No custom groups yet." }));
  };
  const edit = (group) => {
    const editor = groupEditor(app, group, refresh);
    openDialog({
      title: group ? "Edit " + group.id : "New custom group",
      wide: true,
      body: editor.body,
      actions: [{ label: "Cancel" }, { label: "Save group", kind: "primary", onClick: editor.save }],
    });
  };
  refresh();
  openDialog({
    title: "Custom groups",
    wide: true,
    body: el("div", {},
      el("p", { class: "small", text: "Custom groups extend the frozen catalogue. They are saved in the workspace and can be shared as a catalogue extension file." }),
      list),
    actions: [
      { label: "Export catalogue extension", onClick: () => { app.actions.exportExtensions(); return true; } },
      { label: "New custom group", onClick: () => { edit(null); return true; } },
      { label: "Close", kind: "primary" },
    ],
  });
}
