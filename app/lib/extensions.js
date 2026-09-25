// Custom catalogue entries (design §11). They live in ws.extensions and travel in extension files.

import { canonicalJson, isBlank } from "./util.js";
import { groupIdOfPredicateId } from "./catalogue.js";
import { WorkspaceError } from "./workspace.js";

export const EXTENSION_FORMAT = "predicate-workbench-extension";
export const EXTENSION_FORMAT_VERSION = 1;

const GROUP_ID = /^custom:[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PREDICATE_ID = /^(custom:[a-z0-9]+(?:-[a-z0-9]+)*)\.([1-9][0-9]*)$/;

// Stored shape of a custom group, with unknown fields dropped.
function cleanGroup(group) {
  const applicability = group.applicability || {};
  return {
    id: group.id,
    label: group.label,
    definition: group.definition || "",
    attachment: group.attachment,
    applicability: {
      universal: Boolean(applicability.universal),
      semanticTypes: (applicability.semanticTypes || []).slice(),
      storageClasses: (applicability.storageClasses || []).slice(),
    },
    members: (group.members || []).slice(),
  };
}

function cleanPredicate(predicate) {
  return {
    id: predicate.id,
    label: predicate.label,
    definition: predicate.definition || "",
    output: predicate.output,
    sql: predicate.sql,
  };
}

function groupErrors(group, bundle) {
  const errors = [];
  const where = "Group " + (group && group.id);
  if (!group || typeof group.id !== "string" || !GROUP_ID.test(group.id)) {
    return [where + ": ID must look like custom:my-group (lowercase letters, digits and hyphens)."];
  }
  if (isBlank(group.label)) errors.push(where + ": label is required.");
  if (group.attachment !== "column" && group.attachment !== "table") errors.push(where + ": attachment must be column or table.");
  const applicability = group.applicability || {};
  const types = new Set(bundle.semanticTypes.map((type) => type.id));
  const classes = new Set(bundle.storageClasses.map((cls) => cls.id));
  for (const type of applicability.semanticTypes || []) {
    if (!types.has(type)) errors.push(where + ": unknown semantic type " + type + ".");
  }
  for (const cls of applicability.storageClasses || []) {
    if (!classes.has(cls)) errors.push(where + ": unknown storage class " + cls + ".");
  }
  const members = group.members || [];
  if (!Array.isArray(members) || !members.length) errors.push(where + ": at least one member is required.");
  else {
    if (new Set(members).size !== members.length) errors.push(where + ": members repeat.");
    for (const member of members) {
      const match = PREDICATE_ID.exec(member);
      if (!match || match[1] !== group.id) errors.push(where + ": member " + member + " must be " + group.id + ".<n>.");
    }
  }
  return errors;
}

function predicateErrors(predicate) {
  const errors = [];
  const where = "Predicate " + (predicate && predicate.id);
  if (!predicate || typeof predicate.id !== "string" || !PREDICATE_ID.test(predicate.id)) {
    return [where + ": ID must look like custom:my-group.1."];
  }
  if (isBlank(predicate.label)) errors.push(where + ": label is required.");
  if (predicate.output !== "partition" && predicate.output !== "measure") errors.push(where + ": output must be partition or measure.");
  if (isBlank(predicate.sql)) errors.push(where + ": a SQL template is required.");
  return errors;
}

// Checks entries against each other and the existing custom entries they may refer to.
function extensionErrors(groups, predicates, existing, bundle) {
  const errors = [];
  for (const group of groups) errors.push(...groupErrors(group, bundle));
  for (const predicate of predicates) errors.push(...predicateErrors(predicate));
  if (errors.length) return errors;
  const predicateIds = new Set([...existing.predicates, ...predicates].map((p) => p.id));
  const memberOf = new Map();
  for (const group of [...existing.groups, ...groups]) {
    for (const member of group.members) memberOf.set(member, group.id);
  }
  for (const group of groups) {
    for (const member of group.members) {
      if (!predicateIds.has(member)) errors.push("Group " + group.id + ": member " + member + " is not defined.");
    }
  }
  for (const predicate of predicates) {
    if (memberOf.get(predicate.id) !== groupIdOfPredicateId(predicate.id)) {
      errors.push("Predicate " + predicate.id + ": its group does not list it as a member.");
    }
  }
  return errors;
}

export function serializeExtensions(ws) {
  return JSON.stringify({
    format: EXTENSION_FORMAT,
    formatVersion: EXTENSION_FORMAT_VERSION,
    groups: ws.extensions.groups,
    predicates: ws.extensions.predicates,
  }, null, 2) + "\n";
}

export function parseExtensionFile(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new WorkspaceError("This is not a usable catalogue extension file: it is not valid JSON.");
  }
  if (!data || data.format !== EXTENSION_FORMAT) {
    throw new WorkspaceError("This is not a usable catalogue extension file: its format is not " + EXTENSION_FORMAT + ".");
  }
  if (typeof data.formatVersion !== "number" || data.formatVersion > EXTENSION_FORMAT_VERSION) {
    throw new WorkspaceError("This catalogue extension file was written by a newer version of the workbench.");
  }
  return { groups: Array.isArray(data.groups) ? data.groups : [], predicates: Array.isArray(data.predicates) ? data.predicates : [] };
}

// Merges by ID and never overwrites. A differing entry with an existing ID is a conflict and the
// existing entry is kept; predicates of a conflicting group are then not added either.
export function mergeExtensions(ws, bundle, incoming) {
  const report = { groupsAdded: [], predicatesAdded: [], unchanged: 0, conflicts: [], errors: [] };
  const groups = incoming.groups.map(cleanGroup);
  const predicates = incoming.predicates.map(cleanPredicate);
  const existing = ws.extensions;
  const errors = extensionErrors(groups, predicates, existing, bundle);
  if (errors.length) {
    report.errors = errors;
    return report;
  }
  const groupById = new Map(existing.groups.map((group) => [group.id, group]));
  const predicateById = new Map(existing.predicates.map((predicate) => [predicate.id, predicate]));
  const conflictingGroups = new Set();
  for (const group of groups) {
    const current = groupById.get(group.id);
    if (!current) {
      existing.groups.push(group);
      report.groupsAdded.push(group.id);
    } else if (canonicalJson(current) === canonicalJson(group)) {
      report.unchanged += 1;
    } else {
      conflictingGroups.add(group.id);
      report.conflicts.push({ kind: "group", id: group.id, reason: "An existing custom group has this ID with different content; the existing one is kept." });
    }
  }
  for (const predicate of predicates) {
    const current = predicateById.get(predicate.id);
    if (current) {
      if (canonicalJson(current) === canonicalJson(predicate)) report.unchanged += 1;
      else report.conflicts.push({ kind: "predicate", id: predicate.id, reason: "An existing custom predicate has this ID with different content; the existing one is kept." });
    } else if (conflictingGroups.has(groupIdOfPredicateId(predicate.id))) {
      report.conflicts.push({ kind: "predicate", id: predicate.id, reason: "Its group conflicts with an existing group, so it was not added." });
    } else {
      existing.predicates.push(predicate);
      report.predicatesAdded.push(predicate.id);
    }
  }
  return report;
}

// Creates or edits one custom group together with its member predicates. Throws on invalid input.
export function putCustomGroup(ws, bundle, group, predicates) {
  const cleanedGroup = cleanGroup(group);
  const cleanedPredicates = (predicates || []).map(cleanPredicate);
  const others = {
    groups: ws.extensions.groups.filter((g) => g.id !== cleanedGroup.id),
    predicates: ws.extensions.predicates.filter((p) => groupIdOfPredicateId(p.id) !== cleanedGroup.id),
  };
  const errors = extensionErrors([cleanedGroup], cleanedPredicates, others, bundle);
  if (errors.length) throw new WorkspaceError(errors.join("\n"));
  ws.extensions.groups = [...others.groups, cleanedGroup];
  ws.extensions.predicates = [...others.predicates, ...cleanedPredicates];
  return cleanedGroup;
}
