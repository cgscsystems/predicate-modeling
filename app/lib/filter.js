// Outline search and status filter (design §13): matches plus their ancestors stay visible.

// "tested" matches any status other than Not tested.
export function outlineMatcher(criteria, titleOf) {
  const text = String(criteria.text || "").trim().toLowerCase();
  const status = criteria.status || "";
  if (!text && !status) return null;
  return (node) => {
    if (status) {
      if (!node.record) return false;
      if (status === "tested" ? node.record.status === "not_tested" : node.record.status !== status) return false;
    }
    return !text || titleOf(node).toLowerCase().includes(text);
  };
}

// Visible and matched node IDs under the given view roots.
export function filterOutline(ws, rootIds, matches) {
  const visible = new Set();
  const matched = new Set();
  const visit = (id, ancestors) => {
    const node = ws.nodes[id];
    if (matches(node)) {
      matched.add(id);
      visible.add(id);
      for (const ancestor of ancestors) visible.add(ancestor);
    }
    ancestors.push(id);
    for (const childId of node.children) visit(childId, ancestors);
    ancestors.pop();
  };
  for (const id of rootIds) visit(id, []);
  return { visible, matched };
}
