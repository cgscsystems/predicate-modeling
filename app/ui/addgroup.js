// Add-group flow (design §9, §10.3): recommended groups by family, Show all, text filter,
// then an optional form for the tags automatic filling leaves open.

import { el, replaceContent } from "./dom.js";
import { openDialog } from "./dialogs.js";
import { CONTRACTS_DOC, nodeTitle } from "./labels.js";
import { groupMenu } from "../lib/applicability.js";
import { unfilledGroupTags } from "../lib/sql.js";

function groupCard(entry, choose) {
  const { group, recommended, members } = entry;
  return el("li", { class: "group-card" + (recommended ? "" : " not-recommended") },
    el("button", { type: "button", class: "group-choose", "data-group-id": group.id, onclick: () => choose(group.id) },
      el("span", { class: "group-title", text: group.label }),
      group.crossSource ? el("span", { class: "marker marker-cross", text: "⇄ needs another relation" }) : null,
      recommended ? null : el("span", { class: "marker marker-off", text: "⚑ not recommended" })),
    el("p", { class: "small", text: group.definition }),
    el("p", { class: "small muted", text: "Members: " + members.map((p) => p.id + " " + p.label + (p.output === "measure" ? " (measure)" : "")).join("; ") }));
}

function tagForm(tags) {
  const inputs = tags.map((tag) => ({ tag, input: el("input", { type: "text", class: "mono", "aria-label": tag, name: tag }) }));
  return {
    body: el("div", {},
      el("p", { text: "These tags are not filled automatically. Values entered here apply to every member of the group. You can skip this and fill them later." }),
      el("div", { class: "tag-form" }, inputs.map(({ tag, input }) => el("label", { class: "field" }, el("code", { text: tag }), input))),
      el("p", { class: "small" }, "Tag meanings: ", el("a", { href: CONTRACTS_DOC, target: "_blank", rel: "noopener", text: "SQL implementation contracts" }), ".")),
    values: () => Object.fromEntries(inputs.map(({ tag, input }) => [tag, input.value])),
  };
}

export function openAddGroupDialog(app, parentId) {
  const parent = app.ws.nodes[parentId];
  let showAll = false;
  const list = el("div", { class: "group-menu" });
  const filter = el("input", { type: "search", placeholder: "Filter by ID, name, definition or member", "aria-label": "Filter groups", oninput: () => refresh() });
  const showAllBox = el("input", { type: "checkbox", onchange: (event) => { showAll = event.target.checked; refresh(); } });
  let dialog;

  const add = (groupId, tagValues) => {
    app.actions.addGroupNow(parentId, groupId, tagValues);
    dialog.close();
  };
  const choose = (groupId) => {
    const tags = unfilledGroupTags(app.ws, app.catalogue, parentId, groupId);
    if (!tags.length) {
      add(groupId, {});
      return;
    }
    const form = tagForm(tags);
    dialog.close();
    openDialog({
      title: "Tags for " + app.catalogue.group(groupId).label,
      body: form.body,
      actions: [
        { label: "Skip", onClick: () => { app.actions.addGroupNow(parentId, groupId, {}); } },
        { label: "Add group", kind: "primary", onClick: () => { app.actions.addGroupNow(parentId, groupId, form.values()); } },
      ],
    });
  };

  function refresh() {
    const menu = groupMenu(app.ws, app.catalogue, parent, { showAll, filter: filter.value });
    if (!menu.length) {
      replaceContent(list, el("p", { class: "muted", text: showAll ? "No group matches the filter." : "No recommended group matches. Try Show all." }));
      return;
    }
    replaceContent(list, menu.map((entry) => el("details", { class: "family", open: true },
      el("summary", { text: entry.family.label + " (" + entry.groups.length + ")" }),
      el("ul", { class: "group-list" }, entry.groups.map((item) => groupCard(item, choose))))));
  }

  refresh();
  dialog = openDialog({
    title: "Add a group to " + nodeTitle(app, parent),
    wide: true,
    body: el("div", {},
      el("div", { class: "menu-controls" }, filter,
        el("label", { class: "checkbox" }, showAllBox, " Show all " + parent.kind + "-level groups")),
      list),
    actions: [{ label: "Cancel" }],
  });
  filter.focus();
}
