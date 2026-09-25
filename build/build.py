"""Build the workbench catalogue bundle and, once the UI exists, dist/workbench.html.

Usage:
    python build/build.py                 # validate and build everything available
    python build/build.py --bundle PATH   # validate, then write only the catalogue bundle ("-" for stdout)

Standard library only. Fails if tools/validate_catalogue.py fails, if the classification
check fails, or if any predicate's stage-one SQL does not match its recorded fingerprint.
"""
import collections
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
sys.path.insert(0, str(ROOT / "build"))

import classification  # noqa: E402
import validate_catalogue  # noqa: E402

GRAPH = ROOT / "graph" / "Predicate-Catalogue-Graph-v1.0.0-sql-enriched.json"
LIBRARY = ROOT / "sql" / "Oracle-SQL-Library.json"
MAPPING = ROOT / "sql" / "Predicate-SQL-Mapping.json"
CLASSIFICATION = ROOT / "catalogue" / "app-classification.json"
APP_HTML = ROOT / "app" / "index.html"
SLOT = re.compile(r"\[\[(\w+)\]\]")


class BuildError(Exception):
    pass


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def validate():
    report = validate_catalogue.validate()
    if report["status"] != "passed":
        raise BuildError("validate_catalogue failed:\n" + "\n".join(report["errors"]))
    groups, templates, mapping = classification.load_catalogue()
    errors = classification.check(read(CLASSIFICATION), groups, templates, mapping)
    if errors:
        raise BuildError("classification check failed:\n" + "\n".join(errors))


def build_bundle():
    graph = read(GRAPH)
    templates = {item["id"]: item for item in read(LIBRARY)["templates"]}
    mapping = {row["predicate_id"]: row["implementation"] for row in read(MAPPING)["predicates"]}
    app = read(CLASSIFICATION)
    nodes = {node["id"]: node for node in graph["nodes"]}

    members = collections.defaultdict(list)
    family_of = {}
    recommends = collections.defaultdict(list)
    storage = collections.defaultdict(list)
    complements = collections.defaultdict(list)
    for edge in graph["edges"]:
        kind, source, target = edge["type"], edge["source"], edge["target"]
        if kind == "GROUP_HAS_MEMBER":
            members[source].append((edge["attributes"]["ordinal"], target))
        elif kind == "IN_FAMILY":
            family_of[source] = target
        elif kind == "RECOMMENDS_FOR_TYPE":
            recommends[source].append(nodes[target]["label"])
        elif kind == "MENTIONS_STORAGE_CLASS":
            storage[source].append(nodes[target]["label"])
        elif kind == "COMPLEMENT_OF":
            complements[source].append(target)
            complements[target].append(source)

    def ref(node_id):
        return nodes[node_id]["attributes"]["catalogueRef"]

    groups, predicates = [], []
    for node in graph["nodes"]:
        if node["type"] != "PredicateGroup":
            continue
        axis = node["attributes"]["catalogueAxis"]
        rule = nodes["applicability:" + axis]
        member_ids = [target for _, target in sorted(members[node["id"]])]
        app_group = app["groups"][axis]
        groups.append({
            "id": axis,
            "label": node["label"],
            "kind": node["attributes"]["kind"],
            "definition": node["attributes"]["definition"],
            "familyId": family_of[member_ids[0]],
            "members": [ref(pid) for pid in member_ids],
            "applicability": {
                "universal": rule["attributes"]["universalSemanticApplicability"],
                "semanticTypes": sorted(recommends[rule["id"]]),
                "storageClasses": sorted(storage[rule["id"]]),
                "semanticText": rule["attributes"]["semanticApplicability"],
                "storageText": rule["attributes"]["storageApplicability"],
            },
            "attachment": app_group["attachment"],
            "crossSource": app_group["crossSource"],
            "note": app_group.get("note", ""),
        })
        for predicate_node_id in member_ids:
            predicate_id = ref(predicate_node_id)
            implementation = mapping[predicate_id]
            template = templates[implementation["template_id"]]
            sql = SLOT.sub(lambda match: implementation["slots"][match.group(1)], template["body"])
            if hashlib.sha256(sql.encode("utf-8")).hexdigest() != implementation["rendered_sql_sha256"]:
                raise BuildError("Stage-one SQL fingerprint mismatch: " + predicate_id)
            override = app["predicateOverrides"].get(predicate_id)
            predicates.append({
                "id": predicate_id,
                "label": nodes[predicate_node_id]["label"],
                "definition": nodes[predicate_node_id]["attributes"]["definition"],
                "groupId": axis,
                "complements": sorted(ref(other) for other in complements[predicate_node_id]),
                "templateId": implementation["template_id"],
                "sql": sql,
                "tags": implementation["parameters"],
                "output": (override or app["templates"][implementation["template_id"]])["output"],
            })

    def by_type(kind, key="definition"):
        return [{"id": node["label"], key: node["attributes"][key]}
                for node in graph["nodes"] if node["type"] == kind]

    return {
        "catalogueVersion": graph["catalogueVersion"],
        "semanticTypes": by_type("SemanticType"),
        "storageClasses": by_type("StorageClass"),
        "families": [{"id": node["id"], "label": node["label"]}
                     for node in graph["nodes"] if node["type"] == "PredicateFamily"],
        "groups": groups,
        "predicates": predicates,
    }


def main(argv):
    try:
        validate()
        bundle = build_bundle()
    except BuildError as error:
        print(error, file=sys.stderr)
        return 1
    text = json.dumps(bundle, ensure_ascii=False, separators=(",", ":"))
    if "--bundle" in argv:
        target = argv[argv.index("--bundle") + 1]
        if target == "-":
            sys.stdout.write(text)
        else:
            Path(target).write_text(text, encoding="utf-8", newline="\n")
        return 0
    if not APP_HTML.exists():
        print("Catalogue bundle OK ({} groups, {} predicates); app/index.html not present yet, so no HTML was built."
              .format(len(bundle["groups"]), len(bundle["predicates"])))
        return 0
    raise NotImplementedError("HTML inlining arrives with the UI (phase 2)")


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
