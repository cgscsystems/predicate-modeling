"""Check catalogue/app-classification.json and render its Markdown review table.

Usage:
    python build/classification.py            # check, then write catalogue/app-classification.md
    python build/classification.py --check    # check only

Standard library only. The check fails (exit 1) unless every template and group is
classified exactly once with valid values and every predicate override names a real
predicate.
"""
import collections
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GRAPH = ROOT / "graph" / "Predicate-Catalogue-Graph-v1.0.0-sql-enriched.json"
LIBRARY = ROOT / "sql" / "Oracle-SQL-Library.json"
MAPPING = ROOT / "sql" / "Predicate-SQL-Mapping.json"
CLASSIFICATION = ROOT / "catalogue" / "app-classification.json"
REPORT = ROOT / "catalogue" / "app-classification.md"

OUTPUTS = ("partition", "measure")
ATTACHMENTS = ("column", "table")

# First-pass heuristic from §6 of docs/APPLICATION-DESIGN.md, shown beside each decision.
COLUMN_TAGS = {
    "column_name", "value_expression", "text_column", "value_column", "document_column",
    "raw_column", "lob_column", "geometry_column", "value_columns", "key_columns",
    "category_columns", "entity_columns",
}
CROSS_PREFIXES = ("reference_", "source_", "left_", "right_", "baseline_", "target_")


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def load_catalogue():
    graph = read(GRAPH)
    nodes = {node["id"]: node for node in graph["nodes"]}
    members = collections.defaultdict(list)
    families = {}
    for edge in graph["edges"]:
        if edge["type"] == "GROUP_HAS_MEMBER":
            members[edge["source"]].append((edge["attributes"]["ordinal"], edge["target"]))
        elif edge["type"] == "IN_FAMILY":
            families[edge["source"]] = edge["target"]
    mapping = {row["predicate_id"]: row["implementation"] for row in read(MAPPING)["predicates"]}
    groups = []
    for node in graph["nodes"]:
        if node["type"] != "PredicateGroup":
            continue
        ids = [target for _, target in sorted(members[node["id"]])]
        groups.append({
            "axis": node["attributes"]["catalogueAxis"],
            "label": node["label"].split(" — ", 1)[-1],
            "kind": node["attributes"]["kind"],
            "family": nodes[families[ids[0]]]["label"],
            "members": [
                {"id": nodes[pid]["attributes"]["catalogueRef"], "label": nodes[pid]["label"],
                 "template": mapping[nodes[pid]["attributes"]["catalogueRef"]]["template_id"],
                 "tags": mapping[nodes[pid]["attributes"]["catalogueRef"]]["parameters"]}
                for pid in ids
            ],
        })
    templates = [item["id"] for item in read(LIBRARY)["templates"]]
    return groups, templates, mapping


def heuristic(group):
    tags = {tag for member in group["members"] for tag in member["tags"]}
    if any(tag.startswith(CROSS_PREFIXES) or tag == "node_query" for tag in tags):
        return "cross-source"
    return "column" if tags & COLUMN_TAGS else "table"


def check(classification, groups, templates, mapping):
    errors = []
    template_entries = classification.get("templates", {})
    for template_id in templates:
        entry = template_entries.get(template_id)
        if entry is None:
            errors.append("Template not classified: " + template_id)
        elif entry.get("output") not in OUTPUTS:
            errors.append("Bad output for template " + template_id)
    for template_id in set(template_entries) - set(templates):
        errors.append("Unknown template: " + template_id)
    for predicate_id, entry in classification.get("predicateOverrides", {}).items():
        if predicate_id not in mapping:
            errors.append("Unknown predicate override: " + predicate_id)
        elif entry.get("output") not in OUTPUTS:
            errors.append("Bad output for predicate override " + predicate_id)
    group_entries = classification.get("groups", {})
    axes = [group["axis"] for group in groups]
    for axis in axes:
        entry = group_entries.get(axis)
        if entry is None:
            errors.append("Group not classified: " + axis)
            continue
        if entry.get("attachment") not in ATTACHMENTS:
            errors.append("Bad attachment for group " + axis)
        if not isinstance(entry.get("crossSource"), bool):
            errors.append("crossSource must be true or false for group " + axis)
    for axis in set(group_entries) - set(axes):
        errors.append("Unknown group: " + axis)
    return errors


def output_of(predicate_id, template_id, classification):
    override = classification["predicateOverrides"].get(predicate_id)
    return (override or classification["templates"][template_id])["output"]


def cell(text):
    return re.sub(r"\s+", " ", text or "").replace("|", "\\|").strip()


def render(classification, groups, templates, mapping):
    uses = collections.Counter(implementation["template_id"] for implementation in mapping.values())
    outputs = collections.Counter(
        output_of(pid, implementation["template_id"], classification) for pid, implementation in mapping.items())
    template_outputs = collections.Counter(entry["output"] for entry in classification["templates"].values())
    group_entries = classification["groups"]
    shape = collections.Counter(
        (group_entries[g["axis"]]["attachment"], group_entries[g["axis"]]["crossSource"]) for g in groups)

    def decision(axis):
        entry = group_entries[axis]
        return "cross-source" if entry["crossSource"] else entry["attachment"]

    differs = [g["axis"] for g in groups if heuristic(g) != decision(g["axis"])]

    lines = [
        "# App classification — review table",
        "",
        "Generated from `catalogue/app-classification.json` by `python build/classification.py`. Do not edit by hand; edit the JSON and regenerate.",
        "",
        "Phase 0 of `docs/APPLICATION-DESIGN.md` (§6): each predicate's **output** (`partition` returns rows of the source and can be drilled into; `measure` returns a count, statistic or summary) and each group's **attachment** (`column` or `table`) and **cross-source** flag (the SQL also reads another relation supplied by tags).",
        "",
        "## Conventions used",
        "",
        "- **Output** is decided per template from its final top-level `SELECT`. Where that `SELECT` is itself a mapping slot, each predicate's slot value decides, and differences are recorded as predicate overrides.",
        "- A template counts as `partition` when it returns the rows of its subject relation (`t.*` or `p.*` built from `t.*`), with or without extra `profile_*` columns.",
        "- **Attachment** is to the relation whose rows the SQL returns or summarizes (the subject). The group is `column` when it is about one column's values, including a column tested against a companion column on the same row (start/end, value/deadline, x/y). Anchoring such pairs on a column keeps semantic-type and storage filtering (§9) useful. It is `table` when the group is about the record or several fields together.",
        "- **Cross-source** is true only when the SQL reads a second relation of records (reference, mapping, baseline, extract, event, edge or evidence tables and queries). Tags that supply a literal (`reference_value`), a same-row expression (`source_value`), entity column lists (`left_entity_columns`) or a declared value list (`*_set_query`) do not count.",
        "",
        "## Summary",
        "",
        "| | Count |",
        "|---|---|",
        "| Templates: partition / measure | {} / {} |".format(template_outputs["partition"], template_outputs["measure"]),
        "| Predicates: partition / measure (after overrides) | {} / {} |".format(outputs["partition"], outputs["measure"]),
        "| Groups: column, same source | {} |".format(shape[("column", False)]),
        "| Groups: column, cross-source | {} |".format(shape[("column", True)]),
        "| Groups: table, same source | {} |".format(shape[("table", False)]),
        "| Groups: table, cross-source | {} |".format(shape[("table", True)]),
        "| Groups where the decision differs from the tag heuristic | {} |".format(len(differs)),
        "",
        "## Templates",
        "",
        "| Template | Predicates | Output | Note |",
        "|---|---|---|---|",
    ]
    for template_id in templates:
        entry = classification["templates"][template_id]
        lines.append("| `{}` | {} | {} | {} |".format(template_id, uses[template_id], entry["output"], cell(entry.get("note"))))
    lines += [
        "",
        "## Predicate overrides",
        "",
        "| Predicate | Output | Note |",
        "|---|---|---|",
    ]
    for predicate_id, entry in classification["predicateOverrides"].items():
        lines.append("| {} | {} | {} |".format(predicate_id, entry["output"], cell(entry.get("note"))))
    lines += [
        "",
        "## Groups",
        "",
        "`Heuristic` is the tag-based first pass; **bold** marks a group where the decision differs from it.",
    ]
    family = None
    for group in groups:
        if group["family"] != family:
            family = group["family"]
            lines += [
                "",
                "### " + family,
                "",
                "| Axis | Group | Members | Output | Attachment | Cross-source | Heuristic | Note |",
                "|---|---|---|---|---|---|---|---|",
            ]
        entry = group_entries[group["axis"]]
        member_outputs = [output_of(m["id"], m["template"], classification) for m in group["members"]]
        output = member_outputs[0] if len(set(member_outputs)) == 1 else ", ".join(member_outputs)
        axis = group["axis"] if group["axis"] not in differs else "**{}**".format(group["axis"])
        lines.append("| {} | {} | {} | {} | {} | {} | {} | {} |".format(
            axis, cell(group["label"]), len(group["members"]), output, entry["attachment"],
            "yes" if entry["crossSource"] else "no", heuristic(group), cell(entry.get("note"))))
    return "\n".join(lines) + "\n"


def main():
    groups, templates, mapping = load_catalogue()
    classification = read(CLASSIFICATION)
    errors = check(classification, groups, templates, mapping)
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    if "--check" not in sys.argv[1:]:
        REPORT.write_text(render(classification, groups, templates, mapping), encoding="utf-8", newline="\n")
        print("Wrote " + str(REPORT.relative_to(ROOT)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
