// Shared fixtures for the node tests: the catalogue bundle (built by build/build.py) and the example sheet.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { createCatalogue } from "../app/lib/catalogue.js";
import { parseCsv } from "../app/lib/csv.js";
import { mergeMetadata, parseMetadataRows } from "../app/lib/metadata.js";
import { createWorkspace } from "../app/lib/workspace.js";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let bundle;
export function loadBundle() {
  if (!bundle) {
    const python = process.env.PYTHON || "python3";
    bundle = JSON.parse(execFileSync(python, [path.join(ROOT, "build", "build.py"), "--bundle", "-"], { encoding: "utf8" }));
  }
  return bundle;
}

export function exampleRows() {
  return parseCsv(readFileSync(path.join(ROOT, "examples", "metadata.example.csv"), "utf8"));
}

export function semanticIds() {
  return loadBundle().semanticTypes.map((type) => type.id);
}

// A workspace with the example sheet imported, and its catalogue.
export function exampleWorkspace() {
  const ws = createWorkspace(loadBundle().catalogueVersion);
  const catalogue = createCatalogue(loadBundle(), ws.extensions);
  const report = mergeMetadata(ws, catalogue, parseMetadataRows(exampleRows(), semanticIds()));
  return { ws, catalogue, report };
}

export function rootTable(ws, name) {
  return ws.nodes[ws.roots.find((id) => ws.nodes[id].schema + "." + ws.nodes[id].table === name)];
}

export function columnNode(ws, key) {
  return Object.values(ws.nodes).find((node) => node.kind === "column" && node.columnKey === key && !ws.nodes[node.parentId].parentId);
}
