// Playwright helpers for the end-to-end checks against dist/workbench.html (run: npm run test:e2e).
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT } from "../helpers.js";

export const PAGE_URL = pathToFileURL(path.join(ROOT, "dist", "workbench.html")).href;
export const EXAMPLE_CSV = path.join(ROOT, "examples", "metadata.example.csv");

// Local playwright if installed, otherwise the global one.
export function loadPlaywright() {
  try {
    return createRequire(import.meta.url)("playwright");
  } catch (error) {
    const root = execSync("npm root -g", { encoding: "utf8" }).trim();
    return createRequire(path.join(root, "noop.js"))("playwright");
  }
}

export function tempFile(name, content) {
  const file = path.join(mkdtempSync(path.join(os.tmpdir(), "workbench-")), name);
  writeFileSync(file, content);
  return file;
}

// Opens the page and fails the test on any script error or network request.
export async function openPage(context) {
  const page = await context.newPage();
  page.errors = [];
  page.requests = [];
  page.on("pageerror", (error) => page.errors.push(error.message));
  page.on("request", (request) => {
    if (!/^(file|data|blob):/.test(request.url())) page.requests.push(request.url());
  });
  await page.goto(PAGE_URL);
  await page.locator("#toolbar h1").waitFor();
  return page;
}

export async function chooseFile(page, trigger, file) {
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), trigger()]);
  await chooser.setFiles(file);
}

export async function importMetadata(page, file) {
  await chooseFile(page, () => page.locator("#toolbar").getByRole("button", { name: "Import metadata…" }).click(), file || EXAMPLE_CSV);
  const report = page.getByRole("dialog", { name: "Import report" });
  const counts = await report.locator(".report-counts").evaluate((list) => {
    const values = {};
    list.querySelectorAll("dt").forEach((dt) => { values[dt.textContent] = Number(dt.nextElementSibling.textContent); });
    return values;
  });
  const summary = await report.locator(".report-summary").textContent();
  const text = await report.locator(".report").textContent();
  await report.getByRole("button", { name: "OK" }).click();
  return { counts, summary, text };
}

export function row(page, name) {
  return page.locator("#outline .row").filter({ has: page.locator(".name").getByText(name, { exact: true }) });
}

export async function expand(page, name) {
  const twisty = row(page, name).first().locator(".twisty");
  if ((await twisty.getAttribute("aria-label")) === "Expand") await twisty.click();
}

export async function select(page, name) {
  await row(page, name).first().locator(".name").click();
}

export function detailButton(page, name) {
  return page.locator("#detail .detail-actions").getByRole("button", { name, exact: true });
}

// Adds a group to the selected node through the menu; tagValues fill the optional tag form.
export async function addGroup(page, groupId, tagValues, options) {
  await detailButton(page, "+ Add group").click();
  const menu = page.getByRole("dialog", { name: /^Add a group to/ });
  if (options && options.showAll) await menu.getByLabel(/Show all/).check();
  await menu.locator(`[data-group-id="${groupId}"]`).click();
  const tagDialog = page.getByRole("dialog", { name: /^Tags for/ });
  if (await tagDialog.isVisible()) {
    for (const [tag, value] of Object.entries(tagValues || {})) await tagDialog.getByLabel(tag, { exact: true }).fill(value);
    await tagDialog.getByRole("button", { name: tagValues ? "Add group" : "Skip", exact: true }).click();
  }
}

export async function menuGroupIds(page, options) {
  await detailButton(page, "+ Add group").click();
  const menu = page.getByRole("dialog", { name: /^Add a group to/ });
  if (options && options.showAll) await menu.getByLabel(/Show all/).check();
  const ids = await menu.locator("[data-group-id]").evaluateAll((nodes) => nodes.map((n) => n.dataset.groupId));
  const notRecommended = await menu.locator(".not-recommended [data-group-id]").evaluateAll((nodes) => nodes.map((n) => n.dataset.groupId));
  await menu.getByRole("button", { name: "Cancel" }).click();
  return { ids, notRecommended };
}

export function generatedSql(page) {
  return page.locator('#detail pre[aria-label="Generated SQL"]').textContent();
}

export async function download(page, trigger) {
  const [file] = await Promise.all([page.waitForEvent("download"), trigger()]);
  return { name: file.suggestedFilename(), text: readFileSync(await file.path(), "utf8") };
}

// A fresh context: its own localStorage, no network. blockStorage makes localStorage throw.
export async function newSession(browser, options) {
  const context = await browser.newContext({ acceptDownloads: true, ...((options && options.contextOptions) || {}) });
  await context.setOffline(true);
  if (options && options.blockStorage) {
    await context.addInitScript(() => {
      Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Storage is disabled", "SecurityError"); } });
    });
  }
  const page = await openPage(context);
  return { context, page };
}

export async function finish({ context, page }) {
  assert.deepEqual(page.errors, [], "no script errors");
  assert.deepEqual(page.requests, [], "no network requests");
  await context.close();
}

export async function withOrdersStatus(page) {
  await importMetadata(page);
  await expand(page, "SALES.ORDERS");
  await select(page, "ORDER_STATUS_CDE");
}
