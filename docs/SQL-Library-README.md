# Standalone Oracle SQL authoring library

This is the working authority for SQL enrichment. The frozen catalogue remains 1.0.0. The existing graph and ZIP are unchanged and are not read or written by the authoring tools.

## Files and ownership

| File | Owns |
|---|---|
| Oracle-SQL-Library.json | Canonical reusable query bodies, template IDs/revisions, and usage instructions recovered from the four source batches and later batches. |
| Predicate-SQL-Mapping.json | Every one of the 364 frozen predicate IDs, its planned pattern, and either its exact template revision/branch mapping or an explicit unimplemented entry. |
| SQL-Authoring-Ledger.json | Draft/review/portable-test/Oracle-test states, review findings, pending work and next actions. |
| SQL-Authoring-Ledger.md | Generated readable status and pattern work queue. |
| Oracle-SQL-Working-Library.sql | Generated readable SQL view. It is not a second editable source of query bodies. |
| Frozen-Predicate-Inventory.json | Immutable IDs, labels and definitions extracted from the frozen catalogue; checksum pinned by the validator. |
| check_sql_library.py | Reproducible batch 5 SQLite fixtures and validation regression checks. |
| check_batch06.py | Reproducible batch 6 join-match multiplicity fixtures. |
| check_batch07.py | Reproducible batch 7 observed relationship cardinality fixtures. |
| check_batch08.py | Reproducible batch 8 required relationship and domain coverage fixtures. |
| sql_workflow.py | Standard-library-only validation, per-predicate rendering and SQL export. It neither connects to Oracle nor modifies the graph or a ZIP. |

The original batch files remain historical authoring inputs. Their IDs and checksums are recorded. Do not independently edit old batches and this library: new authoring should revise a canonical library template, update its mapped consumers deliberately, and update the ledger. An investigator's customized query is separate from the reusable template.

## Two kinds of substitution

`[[slots]]` are internal authoring differences resolved by the predicate mapping: for example equality versus inequality, positive versus negative existence, and the appropriate column-placeholder name. They are not user-supplied database values.

`{{parameters}}` remain in the rendered Oracle SQL for human/application customization. Examples are schema names, column lists, a selected value, or an explicit eligibility condition. Full usage instructions and datatype/null constraints remain with the source batch in the library. Rendering is textual assembly, not an SQL parser, identifier sanitizer, or execution engine.

## Workflow

1. Select a planned shared pattern and its unmapped predicates from the ledger.
2. Read their frozen definitions and required scope/null/empty-population rules.
3. Reuse an existing body where appropriate, otherwise add a distinct template variant with a stable ID and revision.
4. Supply explicit predicate-to-template slot bindings. Preserve the predicate IDs and meanings.
5. Record assumptions and any unsupported cases; do not turn missing business input into an invented default.
6. Exercise representative logic cases and obtain independent review where it adds value.
7. Record draft, review and Oracle execution separately; validate and regenerate the readable views.
8. Consolidate with the graph only when requested at the end. Prefer graph references to template IDs/revisions over duplicated canonical SQL bodies.

## Commands

Keep the JSON files and script together, then run:

```sh
python sql_workflow.py status
python sql_workflow.py validate
python sql_workflow.py render U04.1
python sql_workflow.py export
python check_sql_library.py
python check_batch06.py
python check_batch07.py
python check_batch08.py
```

No third-party Python packages are required. The validator checks all 364 mapping entries, template references/revisions, slot completeness, rendered-query fingerprints, parameter inventories ledger alignment, frozen IDs/labels, and review evidence tied to exact SQL fingerprints. These checks do not establish Oracle execution compatibility.

## Review and validation states

`drafted` means a query body and mapping exist. `reviewed` means the identified independent review has been read and any material findings resolved or explicitly left open. `prior_portable_checks_reported` records checks performed in earlier turns; it is not a claim those checks were rerun during consolidation. `portable_checked` means this run has stored its check evidence. `oracle_test_status: not_run` is retained until actual Oracle-side results are supplied.

SQL rendered from the four imported batches is checked against those source queries after removing comments and normalizing formatting. This demonstrates consolidation preserved their query structure. Source-level instructions, including U01 null grouping and A05 classification eligibility, remain part of their use contract.

The earlier graph already contains the first six queries. That historical state has deliberately not been edited. This external SQL library supersedes it as the ongoing SQL-authoring source until final consolidation.

## Current checkpoint

68/364 predicates drafted and independently reviewed, using 13 shared bodies. Batch 8 adds L04.1/.2 and H04.1/.2: required relationship coverage and expected-domain coverage. Its 60 SQLite checks cover complete/incomplete and known-empty populations, missing link keys, expected identity eligibility, scopes, duplicates and extra observations. The universal definitions permit known-empty positive coverage and expose zero counts; missing investigation inputs remain unevaluable. The ledger records independent review, exact implementation fingerprints and test evidence. No Oracle execution has been performed. Earlier batches retain their own dated validation evidence.

Source occurrence notes containing earlier graph-integration instructions are retained only as historical provenance; current usage notes omit those obsolete steps. No graph integration or ZIP rebuilding takes place before final consolidation.
