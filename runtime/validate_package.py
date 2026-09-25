"""Standard-library validation for the application handoff package."""
import argparse
import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INTERNAL = re.compile(r"\[\[(\w+)\]\]")
OPERATIONAL = re.compile(r"\{\{(\w+)\}\}")


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def digest_bytes(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate():
    errors = []
    def require(condition, message):
        if not condition:
            errors.append(message)

    manifest = read(ROOT / "MANIFEST.json")
    for item in manifest["files"]:
        path = ROOT / item["path"]
        require(path.is_file(), "Missing manifest file: " + item["path"])
        if path.is_file():
            require(path.stat().st_size == item["bytes"], "Size mismatch: " + item["path"])
            require(digest_bytes(path) == item["sha256"], "Hash mismatch: " + item["path"])

    graph = read(ROOT / "graph" / "Predicate-Catalogue-Graph-v1.0.0-sql-enriched.json")
    library = read(ROOT / "sql" / "Oracle-SQL-Library.json")
    mapping = read(ROOT / "sql" / "Predicate-SQL-Mapping.json")
    frozen = read(ROOT / "sql" / "Frozen-Predicate-Inventory.json")
    tag_contract = read(ROOT / "sql" / "SQL-Tag-Contract.json")
    for schema_name in ("predicate-catalogue-graph.schema.json", "oracle-sql-library.schema.json", "predicate-sql-mapping.schema.json", "runtime-bindings.schema.json"):
        schema = read(ROOT / "schemas" / schema_name)
        require(schema.get("$schema") == "https://json-schema.org/draft/2020-12/schema", "Unexpected schema dialect: " + schema_name)

    require(graph["schemaVersion"] == "1.1.0" and graph["revision"] == 2, "Graph revision mismatch")
    require(graph["catalogueVersion"] == library["catalogue_version"] == mapping["catalogue_version"] == "1.0.0", "Catalogue version mismatch")
    require(graph["graphStatus"] == "sql_enriched_for_application_handoff", "Graph is not handoff-enriched")
    require(library["library_revision"] == 6 and mapping["mapping_revision"] == 6, "SQL revision mismatch")

    templates = {item["id"]: item for item in library["templates"]}
    rows = {item["predicate_id"]: item for item in mapping["predicates"]}
    predicates = {item["attributes"]["catalogueRef"]: item for item in graph["nodes"] if item["type"] == "PredicateDefinition"}
    frozen_rows = {item["predicate_id"]: item for item in frozen["predicates"]}
    require(len(templates) == len(library["templates"]) == 46, "Template count/identity mismatch")
    require(len(rows) == len(mapping["predicates"]) == 364, "Mapping count/identity mismatch")
    require(len(predicates) == 364, "Graph predicate count mismatch")
    require(set(rows) == set(predicates) == set(frozen_rows) == set(mapping["catalogue_inventory"]), "Predicate inventory mismatch")

    graph_index = {node["id"]: node for node in graph["nodes"]}
    require(len(graph_index) == len(graph["nodes"]), "Duplicate graph node IDs")
    edge_ids = [edge["id"] for edge in graph["edges"]]
    require(len(edge_ids) == len(set(edge_ids)), "Duplicate graph edge IDs")
    for edge in graph["edges"]:
        require(edge["source"] in graph_index and edge["target"] in graph_index, "Dangling graph edge: " + edge["id"])
    planned = {}
    for edge in graph["edges"]:
        if edge["type"] == "USES_QUERY_PATTERN":
            planned[edge["source"].split(":", 1)[1]] = edge["target"].split(":", 1)[1]

    used = set()
    for predicate_id, row in rows.items():
        implementation = row["implementation"]
        require(implementation is not None, "Unmapped predicate: " + predicate_id)
        if implementation is None:
            continue
        require(row["label"] == predicates[predicate_id]["label"] == frozen_rows[predicate_id]["label"], "Label mismatch: " + predicate_id)
        require(planned.get(predicate_id) == row["planned_pattern_id"], "Planned pattern mismatch: " + predicate_id)
        template = templates.get(implementation["template_id"])
        require(template is not None, "Unknown template: " + predicate_id)
        if template is None:
            continue
        used.add(template["id"])
        require(template["revision"] == implementation["template_revision"], "Template revision mismatch: " + predicate_id)
        require(template["review_status"] == "reviewed" and template["oracle_test_status"] == "not_run", "Template status mismatch: " + predicate_id)
        slots = set(INTERNAL.findall(template["body"]))
        require(slots == set(implementation["slots"]), "Internal slot mismatch: " + predicate_id)
        rendered = INTERNAL.sub(lambda match: implementation["slots"][match.group(1)], template["body"])
        require(hashlib.sha256(rendered.encode("utf-8")).hexdigest() == implementation["rendered_sql_sha256"], "Rendered fingerprint mismatch: " + predicate_id)
        require(sorted(set(OPERATIONAL.findall(rendered))) == implementation["parameters"], "Operational tag mismatch: " + predicate_id)
        graph_sql = predicates[predicate_id]["attributes"]["sql"]
        expected_graph_sql = {
            "dialect": "oracle", "status": "authored", "template": implementation["template_id"],
            "templateRevision": implementation["template_revision"], "mappingRevision": 6,
            "sourceBatch": implementation["source_batch"], "renderedSqlSha256": implementation["rendered_sql_sha256"],
            "parameters": implementation["parameters"], "internalSlotsResolved": True, "oracleTestStatus": "not_run"
        }
        require(graph_sql == expected_graph_sql, "Graph SQL reference mismatch: " + predicate_id)

    require(used == set(templates), "Unused canonical template")
    normalized = [re.sub(r"\s+", " ", item["body"]).strip() for item in library["templates"]]
    require(len(normalized) == len(set(normalized)), "Duplicate normalized template body")
    inventory = tag_contract["parameterInventory"]
    require(len(inventory) == 350 and len({item["name"] for item in inventory}) == 350, "Operational tag inventory mismatch")

    example = read(ROOT / "examples" / "P01.1-bindings.example.json")
    p01 = rows["P01.1"]["implementation"]
    require(set(example["replacements"]) == set(p01["parameters"]), "Example binding keys mismatch")

    return {
        "status": "passed" if not errors else "failed",
        "catalogueVersion": "1.0.0",
        "graphRevision": 2,
        "libraryRevision": 6,
        "mappingRevision": 6,
        "predicateCount": len(rows),
        "mappedPredicateCount": sum(row["implementation"] is not None for row in rows.values()),
        "graphSqlReferenceCount": sum(node["attributes"]["sql"]["status"] == "authored" for node in predicates.values()),
        "templateCount": len(templates),
        "operationalTagCount": len(inventory),
        "nativeOracleExecution": "not_run",
        "manifestFileCount": len(manifest["files"]),
        "checks": [
            "manifest sizes and SHA256", "JSON schema documents readable", "graph node/edge integrity",
            "frozen IDs and labels", "364 graph-to-mapping joins", "planned pattern joins",
            "template IDs and revisions", "internal slot completeness", "rendered SQL fingerprints",
            "operational tag inventories", "graph SQL references", "all 46 templates used",
            "no duplicate normalized template bodies", "runtime binding example"
        ],
        "errors": errors,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", default=None)
    args = parser.parse_args()
    report = validate()
    text = json.dumps(report, indent=2) + "\n"
    if args.report:
        Path(args.report).write_text(text, encoding="utf-8")
    print(text, end="")
    if report["status"] != "passed":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
