// Acceptance scenarios (design §16) through the built page. Run with: npm run test:e2e
import test, { after, before } from "node:test";
import assert from "node:assert/strict";

import {
  addGroup, chooseFile, detailButton, download, expand, finish, generatedSql, importMetadata, loadPlaywright, menuGroupIds,
  newSession, row, select, tempFile, withOrdersStatus,
} from "./browser.js";

let browser;

before(async () => {
  browser = await loadPlaywright().chromium.launch();
});

after(async () => {
  await browser.close();
});

const freshPage = (options) => newSession(browser, options);

test("1: import builds one table per SCHEMA.TABLE with columns in COLUMN_ID order and notes", async () => {
  const session = await freshPage();
  const { page } = session;
  const report = await importMetadata(page);
  assert.equal(report.summary, "Imported metadata.example.csv.");
  assert.deepEqual(report.counts, {
    "Tables added": 2, "Columns added": 12, "Columns updated": 0, "Columns unchanged": 0, "Warnings": 0, "Rows skipped": 0,
  });
  assert.deepEqual(await page.locator("#outline .row.kind-table .name").allTextContents(), ["SALES.CUSTOMERS", "SALES.ORDERS"]);
  await expand(page, "SALES.ORDERS");
  const names = await page.locator("#outline .row.kind-column .name").allTextContents();
  assert.deepEqual(names, ["ORDER_ID", "CUSTOMER_ID", "ORDER_STATUS_CDE", "ORDER_DATE", "TOTAL_AMOUNT", "SHIP_POSTAL_CODE", "NOTES"]);
  await select(page, "ORDER_STATUS_CDE");
  const notes = await page.locator("#detail .notes").textContent();
  assert.match(notes, /COLUMN_COMMENT.*Order status \(OP open/);
  assert.match(notes, /PARENT_TABLE\s*ORDER_STATUS/);
  await finish(session);
});

test("2: re-importing the same file changes nothing; one extra column adds only that column", async () => {
  const session = await freshPage();
  const { page } = session;
  await importMetadata(page);
  const again = await importMetadata(page);
  assert.match(again.summary, /^Nothing changed/);
  assert.equal(again.counts["Columns unchanged"], 12);
  const csv = (await import("node:fs")).readFileSync((await import("./browser.js")).EXAMPLE_CSV, "utf8")
    + "SALES,ORDERS,8,CHANNEL_CDE,VARCHAR2(3),Y,,Sales channel,,,,,Code\n";
  const extra = await importMetadata(page, tempFile("extra.csv", csv));
  assert.deepEqual([extra.counts["Tables added"], extra.counts["Columns added"], extra.counts["Columns updated"], extra.counts["Columns unchanged"]], [0, 1, 0, 12]);
  await expand(page, "SALES.ORDERS");
  assert.equal(await page.locator("#outline .row.kind-column").last().locator(".name").textContent(), "CHANNEL_CDE");
  await finish(session);
});

test("3: menus offer recommended groups; Show all marks the choice off-recommendation", async () => {
  const session = await freshPage();
  const { page } = session;
  await withOrdersStatus(page);
  const code = await menuGroupIds(page);
  assert.ok(code.ids.includes("M01") && code.ids.includes("K06"));
  await expand(page, "SALES.CUSTOMERS");
  await select(page, "LEGACY_REF");
  const unclassified = await menuGroupIds(page);
  assert.ok(unclassified.ids.includes("U01") && !unclassified.ids.includes("X01") && !unclassified.ids.includes("K06"));
  await select(page, "TOTAL_AMOUNT");
  const number = await menuGroupIds(page);
  assert.ok(number.ids.includes("N01") && !number.ids.includes("X01") && !number.ids.includes("F01"));
  const all = await menuGroupIds(page, { showAll: true });
  assert.ok(all.ids.length > number.ids.length);
  assert.ok(all.notRecommended.includes("X01"));
  await addGroup(page, "X01", null, { showAll: true });
  await assert.doesNotReject(row(page, "X01 — Alphabetic-only / Not alphabetic-only").locator(".marker-off").waitFor());
  await finish(session);
});

test("4: U01 on a root column has schema, table and column filled and nothing left", async () => {
  const session = await freshPage();
  const { page } = session;
  await withOrdersStatus(page);
  await addGroup(page, "U01");
  for (const name of ["U01.1 Uniqueness", "U01.2 Non-uniqueness"]) {
    await select(page, name);
    const sql = await generatedSql(page);
    assert.match(sql, /FROM SALES\.ORDERS t/);
    assert.match(sql, /PARTITION BY t\.ORDER_STATUS_CDE/);
    assert.doesNotMatch(sql, /\{\{/);
  }
  assert.match(await page.locator("#detail .tags-table").textContent(), /All tags are filled|automatic/);
  await finish(session);
});

test("5: M01 with selected_value 'NC' filters = and <> with nothing unfilled", async () => {
  const session = await freshPage();
  const { page } = session;
  await withOrdersStatus(page);
  await addGroup(page, "M01", { selected_value: "'NC'" });
  await select(page, "M01.1 Equals selected value");
  assert.match(await generatedSql(page), /t\.ORDER_STATUS_CDE = 'NC'/);
  assert.doesNotMatch(await generatedSql(page), /\{\{/);
  await select(page, "M01.2 Differs from selected value");
  assert.match(await generatedSql(page), /t\.ORDER_STATUS_CDE <> 'NC'/);
  assert.doesNotMatch(await generatedSql(page), /\{\{/);
  assert.match(await row(page, "M01.2 Differs from selected value").textContent(), /selected_value = 'NC'/);
  await finish(session);
});

test("6-8: drilling in nests SQL, applied SQL feeds the child, measures cannot be drilled into", async () => {
  const session = await freshPage();
  const { page } = session;
  await withOrdersStatus(page);
  await addGroup(page, "M01", { selected_value: "'NC'" });
  await select(page, "M01.1 Equals selected value");
  const parentSql = (await generatedSql(page)).replace(/\s*;\s*$/, "");
  await detailButton(page, "Drill in").click();
  assert.match(await page.locator("#detail .detail-kind").textContent(), /Nested table/);
  await detailButton(page, "+ Add column").click();
  await page.getByRole("dialog").locator('[data-column="SALES.ORDERS.CUSTOMER_ID"]').click();
  await addGroup(page, "U01");
  await select(page, "U01.1 Uniqueness");
  const child = await generatedSql(page);
  assert.ok(child.includes("FROM (SELECT t.ORDER_ID, t.CUSTOMER_ID"), child);
  assert.ok(child.includes(parentSql), "source is the parent's SQL");
  assert.ok(child.includes("PARTITION BY t.CUSTOMER_ID"));

  await select(page, "M01.1 Equals selected value");
  await page.getByLabel("SQL actually run").fill("SELECT * FROM SALES.ORDERS WHERE ORDER_STATUS_CDE = 'NC';");
  await select(page, "U01.1 Uniqueness");
  assert.ok((await generatedSql(page)).includes("    SELECT * FROM SALES.ORDERS WHERE ORDER_STATUS_CDE = 'NC'\n) t)"));

  await select(page, "ORDER_STATUS_CDE");
  await addGroup(page, "U04");
  await select(page, "U04.1 Unique column or key");
  assert.match(await page.locator("#detail .detail-kind").textContent(), /measure/);
  assert.equal(await detailButton(page, "Drill in").count(), 0);
  assert.equal(await row(page, "U04.1 Unique column or key").locator(".icon").textContent(), "∑");
  await finish(session);
});

test("9: combining two sibling partitions creates a lateral sentence with INTERSECT SQL", async () => {
  const session = await freshPage();
  const { page } = session;
  await withOrdersStatus(page);
  await addGroup(page, "M01", { selected_value: "'NC'" });
  await select(page, "ORDER_DATE");
  await addGroup(page, "P01");
  await row(page, "M01.1 Equals selected value").locator(".name").click({ modifiers: ["Control"] });
  await row(page, "P01.1 Null").locator(".name").click({ modifiers: ["Control"] });
  await page.locator("#selection-bar").getByRole("button", { name: "Combine" }).click();
  assert.match(await page.locator("#detail .detail-kind").textContent(), /Lateral sentence/);
  const sql = await generatedSql(page);
  assert.match(sql, /^-- INTERSECT removes duplicate rows/);
  assert.match(sql, /\)\nINTERSECT\nSELECT \* FROM \(/);
  assert.equal(await page.locator("#outline .row.kind-sentence").count(), 1);
  await finish(session);
});

test("10: export, reload and open gives the same workspace; autosave restores; storage can be disabled", async () => {
  const session = await freshPage();
  const { page } = session;
  await withOrdersStatus(page);
  await addGroup(page, "M01", { selected_value: "'NC'" });
  await select(page, "M01.1 Equals selected value");
  await page.locator("#detail select").selectOption("exception");
  await page.getByLabel("Notes (conclusions and reasoning)").fill("Unexpected code NC");
  assert.match(await row(page, "M01.1 Equals selected value").textContent(), /Exception found/);
  const first = await download(page, () => page.locator("#toolbar").getByRole("button", { name: "Export workspace" }).click());
  assert.match(first.name, /^workbench-\d{8}-\d{4}\.json$/);
  assert.match(await page.locator("#export-status").textContent(), /up to date/);
  const exported = JSON.parse(first.text);

  await page.reload();
  await page.locator("#banner").getByRole("button", { name: "Discard" }).click();
  assert.equal(await page.locator("#outline .row").count(), 0);
  await chooseFile(page, () => page.locator("#toolbar").getByRole("button", { name: "Open workspace…" }).click(), tempFile("saved.json", first.text));
  const second = await download(page, () => page.locator("#toolbar").getByRole("button", { name: "Export workspace" }).click());
  const reopened = JSON.parse(second.text);
  assert.deepEqual({ ...reopened, savedAt: null }, { ...exported, savedAt: null });

  await page.waitForTimeout(1000);
  await page.reload();
  await page.locator("#banner").getByRole("button", { name: "Restore" }).click();
  await expand(page, "SALES.ORDERS");
  assert.match(await row(page, "M01.1 Equals selected value").textContent(), /Exception found/);
  await finish(session);

  const blocked = await freshPage({ blockStorage: true });
  assert.match(await blocked.page.locator("#autosave-status").textContent(), /Autosave unavailable/);
  await withOrdersStatus(blocked.page);
  await addGroup(blocked.page, "U01");
  assert.equal(await row(blocked.page, "U01.1 Uniqueness").count(), 1);
  await finish(blocked);
});

test("11: extension import adds, reports no changes on repeat, and keeps the original on conflict", async () => {
  const extension = (label) => JSON.stringify({
    format: "predicate-workbench-extension",
    formatVersion: 1,
    groups: [{
      id: "custom:legacy-prefix", label, definition: "", attachment: "column",
      applicability: { universal: true, semanticTypes: [], storageClasses: [] }, members: ["custom:legacy-prefix.1"],
    }],
    predicates: [{ id: "custom:legacy-prefix.1", label: "Legacy prefix", output: "partition", sql: "SELECT t.* FROM {{schema_name}}.{{table_name}} t WHERE t.{{column_name}} LIKE 'L%';" }],
  });
  const session = await freshPage();
  const { page } = session;
  const importExtension = async (text) => {
    await chooseFile(page, () => page.locator("#toolbar").getByRole("button", { name: "Import catalogue extension…" }).click(), tempFile("ext.json", text));
    const report = page.getByRole("dialog", { name: "Extension import report" });
    const summary = await report.locator(".report").textContent();
    await report.getByRole("button", { name: "OK" }).click();
    return summary;
  };
  assert.match(await importExtension(extension("Legacy prefix")), /1 groups and 1 predicates added/);
  assert.match(await importExtension(extension("Legacy prefix")), /No changes/);
  assert.match(await importExtension(extension("Renamed")), /1 conflicts/);
  await withOrdersStatus(page);
  await addGroup(page, "custom:legacy-prefix");
  assert.equal(await row(page, "custom:legacy-prefix.1 Legacy prefix").count(), 1);
  await select(page, "custom:legacy-prefix.1 Legacy prefix");
  assert.match(await generatedSql(page), /FROM SALES\.ORDERS t WHERE t\.ORDER_STATUS_CDE LIKE 'L%'/);
  await finish(session);
});

test("12: the page works from file:// with the network disabled", async () => {
  const session = await freshPage();
  const { page } = session;
  assert.ok(page.url().startsWith("file://"));
  await withOrdersStatus(page);
  await addGroup(page, "P01");
  await select(page, "P01.1 Null");
  assert.match(await generatedSql(page), /t\.ORDER_STATUS_CDE IS NULL/);
  await finish(session);
});

test("outline flows: zoom, tag editor, add again, custom predicate, delete, custom groups", async () => {
  const session = await freshPage();
  const { page } = session;
  await withOrdersStatus(page);
  await addGroup(page, "M01");
  await select(page, "M01.1 Equals selected value");
  const input = page.getByLabel("Value for selected_value");
  await input.fill("'OP'");
  await input.press("Enter");
  assert.match(await generatedSql(page), /= 'OP'/);
  await page.getByLabel("Value for column_name").fill("TRIM(t.ORDER_STATUS_CDE)");
  await page.getByLabel("Value for column_name").press("Enter");
  assert.match(await generatedSql(page), /t\.TRIM\(t\.ORDER_STATUS_CDE\)/);
  await page.locator("#detail .tags-table").getByRole("button", { name: "Use automatic" }).click();
  assert.match(await generatedSql(page), /t\.ORDER_STATUS_CDE = 'OP'/);

  await detailButton(page, "Zoom in").click();
  assert.equal(await page.locator("#outline .row").count(), 1);
  assert.deepEqual(await page.locator("#breadcrumb .crumb").allTextContents(),
    ["All tables", "SALES.ORDERS", "ORDER_STATUS_CDE", "M01 — Equals selected value / Differs from selected value", "M01.1 Equals selected value"]);
  await page.locator("#breadcrumb").getByRole("button", { name: "ORDER_STATUS_CDE" }).click();
  assert.equal(await page.locator("#outline .row").first().locator(".name").textContent(), "ORDER_STATUS_CDE");
  await page.locator("#breadcrumb").getByRole("button", { name: "All tables" }).click();

  await select(page, "M01 — Equals selected value / Differs from selected value");
  await page.locator("#detail .member-list li").first().getByRole("button", { name: "Add again" }).click();
  assert.equal(await row(page, "M01.1 Equals selected value").count(), 2);

  await select(page, "ORDER_STATUS_CDE");
  await detailButton(page, "+ Custom predicate").click();
  const custom = page.getByRole("dialog", { name: /^Custom predicate/ });
  await custom.getByLabel("Label").fill("Lowercase codes");
  await custom.getByLabel("SQL").fill("SELECT t.* FROM {{schema_name}}.{{table_name}} t WHERE t.{{column_name}} <> UPPER(t.{{column_name}});");
  await custom.getByRole("button", { name: "Add predicate" }).click();
  assert.match(await generatedSql(page), /WHERE t\.ORDER_STATUS_CDE <> UPPER\(t\.ORDER_STATUS_CDE\)/);

  await select(page, "M01 — Equals selected value / Differs from selected value");
  await detailButton(page, "Delete…").click();
  await page.getByRole("dialog", { name: "Delete" }).getByRole("button", { name: "Delete" }).click();
  await row(page, "M01.1 Equals selected value").first().waitFor({ state: "detached" });
  assert.match(await page.locator("#detail h2").textContent(), /ORDER_STATUS_CDE/);

  await page.locator("#toolbar").getByRole("button", { name: "Custom groups…" }).click();
  await page.getByRole("dialog", { name: "Custom groups" }).getByRole("button", { name: "New custom group" }).click();
  const editor = page.getByRole("dialog", { name: "New custom group" });
  await editor.getByLabel("Group ID").fill("flagged");
  await editor.getByLabel("Group label").fill("Flagged / Not flagged");
  await editor.getByRole("button", { name: "+ Add member" }).click();
  await editor.getByLabel("Member label").fill("Flagged");
  await editor.getByLabel("Member SQL template").fill("SELECT t.* FROM {{schema_name}}.{{table_name}} t WHERE t.{{column_name}} = {{flag_value}};");
  await editor.getByRole("button", { name: "Save group" }).click();
  const list = page.getByRole("dialog", { name: "Custom groups" });
  assert.match(await list.textContent(), /custom:flagged · column · 1 members/);
  const exported = await download(page, () => list.getByRole("button", { name: "Export catalogue extension" }).click());
  assert.deepEqual(JSON.parse(exported.text).predicates.map((p) => p.id), ["custom:flagged.1"]);
  await list.getByRole("button", { name: "Close" }).last().click();
  await addGroup(page, "custom:flagged", { flag_value: "'Y'" });
  await select(page, "custom:flagged.1 Flagged");
  assert.match(await generatedSql(page), /WHERE t\.ORDER_STATUS_CDE = 'Y';/);
  await finish(session);
});
