// The catalogue as the app sees it: the frozen bundle plus the workspace's custom extensions.

export const CUSTOM_FAMILY = { id: "family:custom", label: "Custom" };

const TAG_IN_SQL = /\{\{(\w+)\}\}/g;

export function tagsInSql(sql) {
  const tags = new Set();
  for (const match of String(sql || "").matchAll(TAG_IN_SQL)) tags.add(match[1]);
  return [...tags].sort();
}

export function groupIdOfPredicateId(predicateId) {
  return predicateId.slice(0, predicateId.lastIndexOf("."));
}

function customGroupEntry(group) {
  const applicability = group.applicability || {};
  const semanticTypes = (applicability.semanticTypes || []).slice();
  const storageClasses = (applicability.storageClasses || []).slice();
  return {
    id: group.id,
    label: group.label,
    kind: "custom",
    definition: group.definition || "",
    familyId: CUSTOM_FAMILY.id,
    members: (group.members || []).slice(),
    applicability: {
      universal: Boolean(applicability.universal),
      semanticTypes,
      storageClasses,
      semanticText: applicability.universal ? "ALL" : semanticTypes.join(", "),
      storageText: storageClasses.join(", "),
    },
    attachment: group.attachment,
    crossSource: false,
    note: "",
    custom: true,
  };
}

function customPredicateEntry(predicate) {
  return {
    id: predicate.id,
    label: predicate.label,
    definition: predicate.definition || "",
    groupId: groupIdOfPredicateId(predicate.id),
    complements: [],
    templateId: null,
    sql: predicate.sql,
    tags: tagsInSql(predicate.sql),
    output: predicate.output,
    custom: true,
  };
}

export function createCatalogue(bundle, extensions) {
  const groups = new Map();
  const predicates = new Map();
  for (const group of bundle.groups) groups.set(group.id, { ...group, custom: false });
  for (const predicate of bundle.predicates) predicates.set(predicate.id, { ...predicate, custom: false });
  const ext = extensions || { groups: [], predicates: [] };
  for (const group of ext.groups || []) {
    if (!groups.has(group.id)) groups.set(group.id, customGroupEntry(group));
  }
  for (const predicate of ext.predicates || []) {
    if (!predicates.has(predicate.id)) predicates.set(predicate.id, customPredicateEntry(predicate));
  }
  return {
    version: bundle.catalogueVersion,
    bundle,
    groups,
    predicates,
    families: [...bundle.families, CUSTOM_FAMILY],
    semanticTypes: bundle.semanticTypes,
    storageClasses: bundle.storageClasses,
    group: (id) => groups.get(id) || null,
    predicate: (id) => predicates.get(id) || null,
  };
}
