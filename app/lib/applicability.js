// Which groups are offered on a node (design §9).

// Semantic: universal, or shares a type. Storage: unconstrained, A, or shares a class.
export function isRecommendedForColumn(group, column) {
  const rule = group.applicability;
  const types = column ? column.semanticTypes : [];
  const classes = column ? column.storageClasses : [];
  const semanticOk = rule.universal || types.some((type) => rule.semanticTypes.includes(type));
  const storage = rule.storageClasses;
  const storageOk = storage.length === 0 || storage.includes("A") || classes.some((cls) => storage.includes(cls));
  return semanticOk && storageOk;
}

export function nodeAttachment(node) {
  return node && (node.kind === "column" || node.kind === "table") ? node.kind : null;
}

// Table nodes carry no types, so every table-level group is recommended there.
export function isRecommendedAt(ws, group, node) {
  if (nodeAttachment(node) !== group.attachment) return false;
  if (node.kind === "table") return true;
  return isRecommendedForColumn(group, ws.columns[node.columnKey]);
}

function menuText(group, catalogue) {
  const members = group.members.map((id) => (catalogue.predicate(id) || {}).label || "");
  return [group.id, group.label, group.definition, ...members].join(" ").toLowerCase();
}

// Groups for the add-group menu, nested by family in catalogue order.
export function groupMenu(ws, catalogue, node, options) {
  const { showAll = false, filter = "" } = options || {};
  const attachment = nodeAttachment(node);
  if (!attachment) return [];
  const needle = String(filter).trim().toLowerCase();
  const byFamily = new Map(catalogue.families.map((family) => [family.id, { family, groups: [] }]));
  for (const group of catalogue.groups.values()) {
    if (group.attachment !== attachment) continue;
    const recommended = isRecommendedAt(ws, group, node);
    if (!recommended && !showAll) continue;
    if (needle && !menuText(group, catalogue).includes(needle)) continue;
    const members = group.members.map((id) => catalogue.predicate(id)).filter(Boolean);
    byFamily.get(group.familyId).groups.push({ group, recommended, members });
  }
  return [...byFamily.values()].filter((entry) => entry.groups.length);
}
