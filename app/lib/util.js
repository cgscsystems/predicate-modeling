// Small helpers shared by the logic modules. No DOM access.
//
// Build constraint: every module in app/ is concatenated into one script by build/build.py,
// so top-level names must be unique across modules and imports must be plain named imports.

let idCounter = 0;

// Counter plus random suffix; crypto.randomUUID is unavailable in some file:// contexts.
export function newId(prefix, taken) {
  let id;
  do {
    idCounter += 1;
    id = prefix + idCounter.toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  } while (taken && Object.prototype.hasOwnProperty.call(taken, id));
  return id;
}

// Header and semantic-type matching ignores case, spaces and underscores.
export function normalizeKey(text) {
  return String(text == null ? "" : text).replace(/[\s_]+/g, "").toLowerCase();
}

export function isBlank(value) {
  return value == null || String(value).trim() === "";
}

// JSON with object keys sorted, for content comparison.
export function canonicalJson(value) {
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => JSON.stringify(key) + ":" + canonicalJson(value[key])).join(",") + "}";
  }
  return JSON.stringify(value);
}

export function indentLines(text, spaces) {
  const pad = " ".repeat(spaces);
  return text.split("\n").map((line) => (line ? pad + line : line)).join("\n");
}

// Trailing whitespace and one final ";" removed, so SQL can be nested.
export function stripStatementEnd(sql) {
  return sql.replace(/\s+$/, "").replace(/;$/, "").replace(/\s+$/, "");
}

export function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}
