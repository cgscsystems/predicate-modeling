import test from "node:test";
import assert from "node:assert/strict";

import { groupMenu } from "../app/lib/applicability.js";
import { createCatalogue } from "../app/lib/catalogue.js";
import { mergeExtensions, parseExtensionFile, putCustomGroup, serializeExtensions } from "../app/lib/extensions.js";
import { generateSql } from "../app/lib/sql.js";
import { addGroup, createWorkspace } from "../app/lib/workspace.js";
import { columnNode, exampleWorkspace, loadBundle } from "./helpers.js";

const extensionFile = (overrides = {}) => JSON.stringify({
  format: "predicate-workbench-extension",
  formatVersion: 1,
  groups: [{
    id: "custom:legacy-prefix",
    label: "Legacy prefix / Other prefix",
    definition: "Value starts with the legacy prefix / does not.",
    attachment: "column",
    applicability: { universal: false, semanticTypes: ["Code", "Identifier"], storageClasses: ["T"] },
    members: ["custom:legacy-prefix.1", "custom:legacy-prefix.2"],
    ...overrides,
  }],
  predicates: [
    { id: "custom:legacy-prefix.1", label: "Legacy prefix", output: "partition", sql: "SELECT t.* FROM {{schema_name}}.{{table_name}} t WHERE t.{{column_name}} LIKE {{prefix}} || '%';" },
    { id: "custom:legacy-prefix.2", label: "Other prefix", output: "partition", sql: "SELECT t.* FROM {{schema_name}}.{{table_name}} t WHERE t.{{column_name}} NOT LIKE {{prefix}} || '%';" },
  ],
});

test("acceptance 11: new group added, re-import reports no changes, conflicting version keeps the original", () => {
  const ws = createWorkspace("1.0.0");
  const bundle = loadBundle();
  const first = mergeExtensions(ws, bundle, parseExtensionFile(extensionFile()));
  assert.deepEqual(first.groupsAdded, ["custom:legacy-prefix"]);
  assert.deepEqual(first.predicatesAdded, ["custom:legacy-prefix.1", "custom:legacy-prefix.2"]);
  assert.deepEqual([first.conflicts, first.errors], [[], []]);

  const again = mergeExtensions(ws, bundle, parseExtensionFile(extensionFile()));
  assert.deepEqual([again.groupsAdded, again.predicatesAdded, again.conflicts], [[], [], []]);
  assert.equal(again.unchanged, 3);

  const conflicting = mergeExtensions(ws, bundle, parseExtensionFile(extensionFile({ label: "Renamed" })));
  assert.deepEqual(conflicting.conflicts.map((c) => [c.kind, c.id]), [["group", "custom:legacy-prefix"]]);
  assert.equal(ws.extensions.groups[0].label, "Legacy prefix / Other prefix");
  assert.equal(ws.extensions.groups.length, 1);
});

test("custom groups join the catalogue, menus and SQL generation", () => {
  const { ws } = exampleWorkspace();
  mergeExtensions(ws, loadBundle(), parseExtensionFile(extensionFile()));
  const catalogue = createCatalogue(loadBundle(), ws.extensions);
  const status = columnNode(ws, "SALES.ORDERS.ORDER_STATUS_CDE");
  const menu = groupMenu(ws, catalogue, status);
  const custom = menu.find((entry) => entry.family.id === "family:custom");
  assert.deepEqual(custom.groups.map((item) => item.group.id), ["custom:legacy-prefix"]);
  assert.equal(groupMenu(ws, catalogue, columnNode(ws, "SALES.ORDERS.TOTAL_AMOUNT")).some((e) => e.family.id === "family:custom"), false);
  const [legacy] = addGroup(ws, catalogue, status.id, "custom:legacy-prefix", { prefix: "'L'" }).children;
  assert.equal(generateSql(ws, catalogue, legacy), "SELECT t.* FROM SALES.ORDERS t WHERE t.ORDER_STATUS_CDE LIKE 'L' || '%';");
  assert.deepEqual(catalogue.predicate("custom:legacy-prefix.1").tags, ["column_name", "prefix", "schema_name", "table_name"]);
  const exported = JSON.parse(serializeExtensions(ws));
  assert.equal(exported.format, "predicate-workbench-extension");
  assert.equal(exported.groups.length, 1);
});

test("invalid extension files are rejected whole with reasons", () => {
  const ws = createWorkspace("1.0.0");
  const bundle = loadBundle();
  assert.throws(() => parseExtensionFile("{}"), /format/);
  assert.throws(() => parseExtensionFile(JSON.stringify({ format: "predicate-workbench-extension", formatVersion: 9 })), /newer/);
  const badId = mergeExtensions(ws, bundle, parseExtensionFile(extensionFile({ id: "U01" })));
  assert.match(badId.errors[0], /custom:my-group/);
  const badType = mergeExtensions(ws, bundle, parseExtensionFile(extensionFile({ applicability: { semanticTypes: ["Widget"] } })));
  assert.match(badType.errors.join("\n"), /unknown semantic type Widget/);
  const missingMember = mergeExtensions(ws, bundle, parseExtensionFile(extensionFile({ members: ["custom:legacy-prefix.1", "custom:legacy-prefix.3"] })));
  assert.match(missingMember.errors.join("\n"), /custom:legacy-prefix\.3 is not defined/);
  assert.match(missingMember.errors.join("\n"), /legacy-prefix\.2: its group does not list it/);
  assert.deepEqual(ws.extensions, { groups: [], predicates: [] });
});

test("putCustomGroup creates and edits custom entries", () => {
  const ws = createWorkspace("1.0.0");
  const bundle = loadBundle();
  const group = { id: "custom:flag", label: "Flag", attachment: "table", applicability: { universal: true }, members: ["custom:flag.1"] };
  putCustomGroup(ws, bundle, group, [{ id: "custom:flag.1", label: "Flagged", output: "measure", sql: "SELECT COUNT(*) FROM {{schema_name}}.{{table_name}}" }]);
  putCustomGroup(ws, bundle, { ...group, label: "Flag v2" }, [{ id: "custom:flag.1", label: "Flagged", output: "measure", sql: "SELECT 1 FROM DUAL" }]);
  assert.equal(ws.extensions.groups.length, 1);
  assert.equal(ws.extensions.groups[0].label, "Flag v2");
  assert.equal(ws.extensions.predicates[0].sql, "SELECT 1 FROM DUAL");
  assert.throws(() => putCustomGroup(ws, bundle, { ...group, attachment: "row" }, []), /attachment/);
});
