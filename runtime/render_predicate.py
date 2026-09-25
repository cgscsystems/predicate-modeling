"""Resolve reviewed internal slots and exact operational tags; never executes SQL."""
import argparse
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INTERNAL = re.compile(r"\[\[(\w+)\]\]")
OPERATIONAL = re.compile(r"\{\{(\w+)\}\}")


def load():
    library = json.loads((ROOT / "sql" / "Oracle-SQL-Library.json").read_text(encoding="utf-8"))
    mapping = json.loads((ROOT / "sql" / "Predicate-SQL-Mapping.json").read_text(encoding="utf-8"))
    return library, mapping


def render_stage_one(predicate_id):
    library, mapping = load()
    templates = {item["id"]: item for item in library["templates"]}
    row = next((item for item in mapping["predicates"] if item["predicate_id"] == predicate_id), None)
    if row is None:
        raise ValueError("Unknown predicate ID: " + predicate_id)
    implementation = row["implementation"]
    template = templates[implementation["template_id"]]
    if template["revision"] != implementation["template_revision"]:
        raise ValueError("Template revision mismatch")
    body = template["body"]
    slots = set(INTERNAL.findall(body))
    if slots != set(implementation["slots"]):
        raise ValueError("Internal slot set mismatch")
    sql = INTERNAL.sub(lambda match: implementation["slots"][match.group(1)], body)
    digest = hashlib.sha256(sql.encode("utf-8")).hexdigest()
    if digest != implementation["rendered_sql_sha256"]:
        raise ValueError("Reviewed SQL fingerprint mismatch")
    if sorted(set(OPERATIONAL.findall(sql))) != implementation["parameters"]:
        raise ValueError("Operational tag inventory mismatch")
    return row, implementation, sql


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("predicate_id")
    parser.add_argument("bindings", nargs="?", help="JSON document conforming to schemas/runtime-bindings.schema.json")
    args = parser.parse_args()
    row, implementation, sql = render_stage_one(args.predicate_id)
    output = {
        "predicateId": row["predicate_id"],
        "label": row["label"],
        "templateId": implementation["template_id"],
        "templateRevision": implementation["template_revision"],
        "mappingRevision": 6,
        "renderedSqlSha256": implementation["rendered_sql_sha256"],
        "requiredParameters": implementation["parameters"],
        "sql": sql,
        "bindValues": {},
    }
    if args.bindings:
        bindings = json.loads(Path(args.bindings).read_text(encoding="utf-8"))
        if bindings.get("predicateId") != args.predicate_id or bindings.get("mappingRevision") != 6:
            raise ValueError("Binding identity/revision mismatch")
        replacements = bindings.get("replacements", {})
        expected = set(implementation["parameters"])
        if set(replacements) != expected:
            raise ValueError(f"Replacement keys differ; missing={sorted(expected-set(replacements))}, extra={sorted(set(replacements)-expected)}")
        for name, value in replacements.items():
            if not isinstance(value, str) or not value.strip():
                raise ValueError("Every replacement must be a nonempty SQL fragment: " + name)
            if "[[" in value or "{{" in value or "]]" in value or "}}" in value:
                raise ValueError("Nested tag delimiter in replacement: " + name)
        sql = OPERATIONAL.sub(lambda match: replacements[match.group(1)], sql)
        if INTERNAL.search(sql) or OPERATIONAL.search(sql):
            raise ValueError("Residual tag after rendering")
        output["sql"] = sql
        output["finalSqlSha256"] = hashlib.sha256(sql.encode("utf-8")).hexdigest()
        output["bindValues"] = bindings.get("bindValues", {})
    print(json.dumps(output, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
