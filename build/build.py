"""Build dist/workbench.html: one self-contained file that opens from file:// without a network.

Usage:
    python build/build.py                 # validate, then write dist/workbench.html
    python build/build.py --bundle PATH   # validate, then write only the catalogue bundle ("-" for stdout)

The app's ES modules are joined into one classic script, following imports from app/main.js,
so modules must use plain relative named imports and unique top-level names.

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
APP_DIR = ROOT / "app"
APP_HTML = APP_DIR / "index.html"
APP_ENTRY = APP_DIR / "main.js"
DIST_HTML = ROOT / "dist" / "workbench.html"
SLOT = re.compile(r"\[\[(\w+)\]\]")
IMPORT = re.compile(r'^import \{[\w,\s]+\} from "(\.{1,2}/[\w/.-]+\.js)";\n?', re.M)
EXPORT = re.compile(r"^export (?=(?:async )?function |const |let |class )", re.M)


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


def module_order(entry):
    """Modules reachable from entry, dependencies first. Import cycles are an error."""
    order, state = [], {}

    def visit(path, chain):
        if state.get(path) == "done":
            return
        if state.get(path) == "active":
            raise BuildError("Import cycle: " + " -> ".join(str(p.relative_to(APP_DIR)) for p in chain + [path]))
        state[path] = "active"
        for relative in IMPORT.findall(path.read_text(encoding="utf-8")):
            visit((path.parent / relative).resolve(), chain + [path])
        state[path] = "done"
        order.append(path)

    visit(entry.resolve(), [])
    return order


def application_script():
    """All app modules as one classic script: imports removed, exports unwrapped."""
    parts = []
    for path in module_order(APP_ENTRY):
        source = path.read_text(encoding="utf-8")
        leftover = re.search(r"^\s*(import|export)\b.*$", EXPORT.sub("", IMPORT.sub("", source)), re.M)
        if leftover:
            raise BuildError("Unsupported module syntax in {}: {}".format(path.relative_to(ROOT), leftover.group(0).strip()))
        parts.append("// ---- {} ----\n{}".format(path.relative_to(APP_DIR).as_posix(), EXPORT.sub("", IMPORT.sub("", source))))
    return '(function () {\n"use strict";\n' + "\n".join(parts) + "\n})();\n"


def inline_script(code):
    return code.replace("</script", "<\\/script")


def build_html(bundle):
    html = APP_HTML.read_text(encoding="utf-8")
    replacements = {
        '<link rel="stylesheet" href="styles.css">':
            "<style>\n" + (APP_DIR / "styles.css").read_text(encoding="utf-8") + "</style>",
        '<script src="vendor/xlsx.full.min.js"></script>':
            "<script>\n" + inline_script((APP_DIR / "vendor" / "xlsx.full.min.js").read_text(encoding="utf-8")) + "\n</script>",
        '<script type="application/json" id="catalogue-bundle"></script>':
            '<script type="application/json" id="catalogue-bundle">'
            + json.dumps(bundle, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/") + "</script>",
        '<script type="module" src="main.js"></script>':
            "<script>\n" + inline_script(application_script()) + "</script>",
    }
    for marker, content in replacements.items():
        if html.count(marker) != 1:
            raise BuildError("app/index.html must contain exactly one " + marker)
        html = html.replace(marker, content)
    return html


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
    try:
        html = build_html(bundle)
    except BuildError as error:
        print(error, file=sys.stderr)
        return 1
    DIST_HTML.parent.mkdir(exist_ok=True)
    DIST_HTML.write_text(html, encoding="utf-8", newline="\n")
    print("Wrote {} ({} KB)".format(DIST_HTML.relative_to(ROOT).as_posix(), len(html.encode("utf-8")) // 1024))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
