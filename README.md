# Predicate Catalog application handoff 1.0.0

This directory is the minimum self-contained handoff for the Application Pipeline.

## Completion state

- Frozen catalogue: 364 predicate definitions, version 1.0.0.
- SQL mapping: 364/364 predicates mapped to an exact reviewed Oracle template revision.
- Canonical SQL: 46 templates, library revision 6.
- Graph: revision 2 with 364 SQL references and exact operational tag inventories.
- Portable validation: passed before packaging and rechecked by this package validator.
- Native Oracle execution: **not run**. Production acceptance still requires Oracle-side execution against representative target schemas and data.

## Package contents

- `graph/Predicate-Catalogue-Graph-v1.0.0-sql-enriched.json` — application graph with per-predicate SQL references.
- `schemas/predicate-catalogue-graph.schema.json` — schema for the enriched graph.
- `sql/Oracle-SQL-Library.json` — canonical template bodies.
- `schemas/oracle-sql-library.schema.json` — library schema.
- `sql/Predicate-SQL-Mapping.json` — exact internal slot bindings and required operational tags for all predicates.
- `schemas/predicate-sql-mapping.schema.json` — mapping schema.
- `sql/SQL-Tag-Contract.json` — two-stage tag and security contract.
- `schemas/runtime-bindings.schema.json` — application binding document schema.
- `runtime/render_predicate.py` — reference renderer; it does not execute SQL.
- `runtime/validate_package.py` — standard-library package validator.
- `docs/SQL-Implementation-Contracts.md` — algorithm, input, null, scope and limitation contracts.
- `MANIFEST.json` and `VALIDATION.json` — package integrity and validation evidence.

## Rendering contract

1. Select a `predicate_id` in `Predicate-SQL-Mapping.json`.
2. Resolve `[[internal_slots]]` only from that reviewed mapping. The reference renderer performs this and verifies the saved SHA256.
3. Supply exactly the listed `{{operational_tags}}` through a binding document.
4. Treat every operational replacement as trusted application configuration. Use driver bind placeholders such as `:threshold` for data values, then pass the values separately through the Oracle driver.
5. Reject missing, extra, nested or residual tags. Never insert raw end-user text into identifiers, conditions, expressions, column lists or subqueries.

Inspect stage-one SQL and required tags:

```powershell
python -X utf8 -B runtime/render_predicate.py P01.1
```

Render the included non-production example:

```powershell
python -X utf8 -B runtime/render_predicate.py P01.1 examples/P01.1-bindings.example.json
```

Validate the complete handoff:

```powershell
python -X utf8 -B runtime/validate_package.py
```

## Inputs the application must still supply

The package contains no fabricated runtime database model. The Application Pipeline must supply authorized Oracle connections, table/view and column bindings, investigation scope, business/reference rules, parameter values and evidence snapshots. It must validate identifiers and trusted SQL fragments, bind data values, preserve complementary-predicate scope, and record executed SQL plus Oracle results. These are deployment inputs, not missing catalogue mappings.
