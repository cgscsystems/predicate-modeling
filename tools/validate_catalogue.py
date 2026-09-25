"""Standard-library consistency check for the predicate catalogue, SQL library and mapping."""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GRAPH = ROOT / "graph" / "Predicate-Catalogue-Graph-v1.0.0-sql-enriched.json"
ENUMERATION = ROOT / "graph" / "Predicate-Catalogue-Enumeration-v1.0.md"
LIBRARY = ROOT / "sql" / "Oracle-SQL-Library.json"
MAPPING = ROOT / "sql" / "Predicate-SQL-Mapping.json"
SCHEMAS = ("predicate-catalogue-graph.schema.json", "oracle-sql-library.schema.json", "predicate-sql-mapping.schema.json")
INTERNAL = re.compile(r"\[\[(\w+)\]\]")
OPERATIONAL = re.compile(r"\{\{(\w+)\}\}")


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def validate():
    errors = []

    def require(condition, message):
        if not condition:
            errors.append(message)

    graph = read(GRAPH)
    library = read(LIBRARY)
    mapping = read(MAPPING)
    for schema_name in SCHEMAS:
        schema = read(ROOT / "schemas" / schema_name)
        require(schema.get("$schema") == "https://json-schema.org/draft/2020-12/schema", "Unexpected schema dialect: " + schema_name)

    require(hashlib.sha256(ENUMERATION.read_bytes()).hexdigest() == graph["source"]["sha256"], "Frozen enumeration does not match graph source hash")
    require(graph["catalogueVersion"] == library["catalogue_version"] == mapping["catalogue_version"] == "1.0.0", "Catalogue version mismatch")
    require(library["library_revision"] == mapping["mapping_revision"] == 7, "SQL revision mismatch")

    templates = {item["id"]: item for item in library["templates"]}
    rows = {item["predicate_id"]: item for item in mapping["predicates"]}
    predicates = {item["attributes"]["catalogueRef"]: item for item in graph["nodes"] if item["type"] == "PredicateDefinition"}
    require(len(templates) == len(library["templates"]), "Duplicate template IDs")
    require(len(rows) == len(mapping["predicates"]), "Duplicate mapping predicate IDs")
    require(set(rows) == set(predicates) == set(mapping["catalogue_inventory"]), "Predicate inventory mismatch")

    graph_index = {node["id"]: node for node in graph["nodes"]}
    require(len(graph_index) == len(graph["nodes"]), "Duplicate graph node IDs")
    edge_ids = [edge["id"] for edge in graph["edges"]]
    require(len(edge_ids) == len(set(edge_ids)), "Duplicate graph edge IDs")
    planned = {}
    for edge in graph["edges"]:
        require(edge["source"] in graph_index and edge["target"] in graph_index, "Dangling graph edge: " + edge["id"])
        if edge["type"] == "USES_QUERY_PATTERN":
            planned[edge["source"].split(":", 1)[1]] = edge["target"].split(":", 1)[1]

    used = set()
    for predicate_id, row in rows.items():
        implementation = row["implementation"]
        require(row["label"] == predicates[predicate_id]["label"], "Label mismatch: " + predicate_id)
        require(planned.get(predicate_id) == row["planned_pattern_id"], "Planned pattern mismatch: " + predicate_id)
        template = templates.get(implementation["template_id"])
        require(template is not None, "Unknown template: " + predicate_id)
        if template is None:
            continue
        used.add(template["id"])
        require(template["revision"] == implementation["template_revision"], "Template revision mismatch: " + predicate_id)
        require(set(INTERNAL.findall(template["body"])) == set(implementation["slots"]), "Internal slot mismatch: " + predicate_id)
        rendered = INTERNAL.sub(lambda match: implementation["slots"][match.group(1)], template["body"])
        require(hashlib.sha256(rendered.encode("utf-8")).hexdigest() == implementation["rendered_sql_sha256"], "Rendered fingerprint mismatch: " + predicate_id)
        require(sorted(set(OPERATIONAL.findall(rendered))) == implementation["parameters"], "Operational tag mismatch: " + predicate_id)
        require("{{schema_name}}.{{table_name}}" in rendered or "{{subject_query}}" in rendered,
                "Subject relation is neither {{schema_name}}.{{table_name}} nor {{subject_query}}: " + predicate_id)
        graph_sql = predicates[predicate_id]["attributes"]["sql"]
        require(graph_sql["template"] == implementation["template_id"]
                and graph_sql["templateRevision"] == implementation["template_revision"]
                and graph_sql["renderedSqlSha256"] == implementation["rendered_sql_sha256"]
                and graph_sql["parameters"] == implementation["parameters"], "Graph SQL reference mismatch: " + predicate_id)

    require(used == set(templates), "Unused template: " + ", ".join(sorted(set(templates) - used)))
    normalized = [re.sub(r"\s+", " ", item["body"]).strip() for item in library["templates"]]
    require(len(normalized) == len(set(normalized)), "Duplicate normalized template body")

    return {
        "status": "passed" if not errors else "failed",
        "predicates": len(rows),
        "templates": len(templates),
        "graphNodes": len(graph["nodes"]),
        "graphEdges": len(graph["edges"]),
        "errors": errors,
    }


def main():
    report = validate()
    print(json.dumps(report, indent=2))
    if report["status"] != "passed":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
