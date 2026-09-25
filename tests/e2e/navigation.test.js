// Phase 3: keyboard, search and status filter, import reports, empty and error states.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  EXAMPLE_CSV, addGroup, chooseFile, detailButton, expand, finish, importMetadata, loadPlaywright, newSession, row, select,
  tempFile, withOrdersStatus,
} from "./browser.js";

let browser;

before(async () => {
  browser = await loadPlaywright().chromium.launch();
});

after(async () => {
  await browser.close();
});

const selectedName = (page) => page.locator("#outline .row.selected .name").textContent();

test("keyboard: move, expand, collapse, add, combine, zoom, detail and back, search, help", async () => {
  const session = await newSession(browser);
  const { page } = session;
  await importMetadata(page);
  await select(page, "SALES.CUSTOMERS");
  const press = (key) => page.keyboard.press(key);
  assert.equal(await page.evaluate(() => document.activeElement.id), "outline");
  await press("ArrowRight");
  assert.equal(await row(page, "CUSTOMER_NAME").count(), 1, "expanded");
  await press("ArrowRight");
  assert.equal(await selectedName(page), "CUSTOMER_ID");
  await press("ArrowDown");
  assert.equal(await selectedName(page), "CUSTOMER_NAME");
  await press("ArrowLeft");
  assert.equal(await selectedName(page), "SALES.CUSTOMERS");
  await press("ArrowLeft");
  assert.equal(await row(page, "CUSTOMER_NAME").count(), 0, "collapsed");
  await press("End");
  assert.equal(await selectedName(page), "SALES.ORDERS");
  await press("ArrowRight");
  await press("ArrowRight");
  await press("ArrowDown");
  await press("ArrowDown");
  assert.equal(await selectedName(page), "ORDER_STATUS_CDE");

  await press("a");
  await page.getByRole("dialog", { name: /^Add a group to/ }).locator('[data-group-id="M01"]').click();
  await page.getByRole("dialog", { name: /^Tags for/ }).getByRole("button", { name: "Skip" }).click();
  await page.locator("#outline").focus();
  await press("ArrowRight");
  assert.equal(await selectedName(page), "M01.1 Equals selected value");
  await press(" ");
  await press("ArrowDown");
  await press(" ");
  assert.match(await page.locator("#selection-bar").textContent(), /2 selected to combine/);
  await press("Escape");
  assert.equal(await page.locator("#selection-bar").isHidden(), true);

  await press("]");
  assert.equal(await page.locator("#outline .row").count(), 1);
  await press("[");
  assert.ok((await page.locator("#outline .row").count()) > 1);
  assert.equal(await page.locator("#breadcrumb .crumb").last().textContent(), "M01 — Equals selected value / Differs from selected value");
  await press("[");
  await press("[");
  await press("[");
  assert.equal(await page.locator("#breadcrumb .crumb").count(), 1, "back to all tables");

  await press("Enter");
  assert.equal(await page.evaluate(() => document.activeElement.closest("#detail") !== null), true);
  await press("Escape");
  assert.equal(await page.evaluate(() => document.activeElement.id), "outline");
  await press("/");
  assert.equal(await page.evaluate(() => document.activeElement.id), "filter-text");
  await page.locator("#outline").focus();
  await press("?");
  await page.getByRole("dialog", { name: "Keyboard shortcuts" }).getByRole("button", { name: "Close" }).last().click();
  await finish(session);
});

test("search by name and filter by status show matches with their ancestors", async () => {
  const session = await newSession(browser);
  const { page } = session;
  await withOrdersStatus(page);
  await addGroup(page, "M01", { selected_value: "'NC'" });
  await select(page, "M01.1 Equals selected value");
  await page.locator("#detail select").selectOption("exception");

  await page.locator("#filter-text").fill("status");
  assert.equal(await page.locator("#filter-count").textContent(), "1 match");
  assert.deepEqual(await page.locator("#outline .row.match .name").allTextContents(), ["ORDER_STATUS_CDE"]);
  assert.deepEqual(await page.locator("#outline .row.context .name").allTextContents(), ["SALES.ORDERS"]);

  await page.locator("#filter-text").fill("");
  await page.locator("#filter-status").selectOption("exception");
  assert.deepEqual(await page.locator("#outline .row.match .name").allTextContents(), ["M01.1 Equals selected value"]);
  assert.equal(await page.locator("#outline .row").count(), 4, "table, column, group and the match");
  await page.locator("#filter-status").selectOption("confirmed");
  assert.match(await page.locator("#outline .empty-state").textContent(), /Nothing matches the filter/);
  await page.locator("#outline .empty-state").getByRole("button", { name: "Clear filter" }).click();
  assert.equal(await page.locator("#filter-status").inputValue(), "");
  assert.ok((await page.locator("#outline .row").count()) > 4);

  await page.locator("#filter-text").fill("m01.2");
  await page.locator("#filter-text").press("Enter");
  assert.equal(await selectedName(page), "M01.2 Differs from selected value");
  assert.equal(await page.evaluate(() => document.activeElement.id), "outline");
  await finish(session);
});

test("import reports warnings, skipped rows, per-column changes and recommendation changes", async () => {
  const session = await newSession(browser);
  const { page } = session;
  await withOrdersStatus(page);
  await addGroup(page, "X01", { letter_members: "'A-Z'" });
  const lines = readFileSync(EXAMPLE_CSV, "utf8").trimEnd().split("\n");
  const changed = lines.map((line) => line.replace("ORDER_STATUS_CDE,VARCHAR2(2)", "ORDER_STATUS_CDE,NUMBER(2)"));
  changed.push("SALES,ORDERS,9,WIDGET_CDE,VARCHAR2(3),Y,,,,,,,Widget", "SALES,,10,NO_TABLE,DATE,Y,,,,,,,Date");
  const report = await importMetadata(page, tempFile("changed.csv", changed.join("\n") + "\n"));
  assert.deepEqual([report.counts["Columns added"], report.counts["Columns updated"], report.counts.Warnings, report.counts["Rows skipped"]], [1, 1, 1, 1]);
  assert.match(report.text, /Row 14: Unrecognized semantic type "Widget"; ignored\./);
  assert.match(report.text, /Row 15: Missing TABLE_NAME/);
  assert.match(report.text, /SALES\.ORDERS\.ORDER_STATUS_CDE: X01 is now off-recommendation/);
  assert.match(report.text, /SALES\.ORDERS\.ORDER_STATUS_CDE: data type VARCHAR2\(2\) → NUMBER\(2\)/);
  assert.equal(await row(page, "X01 — Alphabetic-only / Not alphabetic-only").locator(".marker-off").count(), 1);
  await finish(session);
});

test("error states: bad sheets, empty sheets and wrong workspace files explain themselves", async () => {
  const session = await newSession(browser);
  const { page } = session;
  const failure = async (trigger, file, title) => {
    await chooseFile(page, trigger, file);
    const dialog = page.getByRole("dialog", { name: title });
    const text = await dialog.locator(".dialog-body").textContent();
    await dialog.getByRole("button", { name: "OK" }).click();
    return text;
  };
  const importButton = () => page.locator("#toolbar").getByRole("button", { name: "Import metadata…" }).click();
  assert.match(await failure(importButton, tempFile("bad.csv", "SCHEMA_OWNER,TABLE_NAME,COLUMN_NAME\nA,B,C\n"), "Import failed"),
    /missing required columns: DATA_TYPE, SEMANTIC_TYPE/);
  assert.match(await failure(importButton, tempFile("empty.csv", "SCHEMA_OWNER,TABLE_NAME,COLUMN_NAME,DATA_TYPE,SEMANTIC_TYPE\n"), "Import failed"),
    /has no data rows/);
  const openButton = () => page.locator("#toolbar").getByRole("button", { name: "Open workspace…" }).click();
  assert.match(await failure(openButton, tempFile("x.json", "{\"format\":\"something\"}"), "Could not open the workspace"),
    /not a usable workspace file/);
  assert.match(await page.locator("#outline .empty-state").textContent(), /No tables yet/);
  await finish(session);
});

test("empty states guide the next step", async () => {
  const session = await newSession(browser);
  const { page } = session;
  await withOrdersStatus(page);
  assert.match(await page.locator("#detail .hint").textContent(), /No groups yet/);
  await addGroup(page, "M01");
  await select(page, "M01.1 Equals selected value");
  await detailButton(page, "Drill in").click();
  const placeholder = page.locator("#outline .row.placeholder");
  assert.match(await placeholder.textContent(), /No columns yet/);
  await placeholder.getByRole("button", { name: "+ Add column" }).click();
  await page.getByRole("dialog").locator('[data-column="SALES.ORDERS.ORDER_DATE"]').click();
  assert.equal(await placeholder.count(), 0);
  await expand(page, "SALES.CUSTOMERS");
  assert.equal(await row(page, "ORDER_DATE").count(), 2);
  await finish(session);
});
