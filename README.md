# Predicate modeling

Reference data for a predicate investigation workbench: an offline, outline-style tool for profiling a database table by table and column by column, recording the SQL used, the results and the conclusions for each predicate.

This repository holds the frozen predicate catalogue, its Oracle SQL scaffolds and the workbench application, which is being built in phases (see `docs/APPLICATION-DESIGN.md` §15). Open `dist/workbench.html` (double-click; it needs no network or server) to use it.

## Contents

| Path | What it is |
|---|---|
| `graph/Predicate-Catalogue-Enumeration-v1.0.md` | The frozen catalogue (release 1.0.0) in readable form: 364 predicates in 173 groups across 26 families, and 34 semantic types. |
| `graph/Predicate-Catalogue-Graph-v1.0.0-sql-enriched.json` | The same catalogue as a graph: predicates, groups, families, semantic types, storage classes, applicability rules and the edges between them. Each predicate references its SQL template. |
| `sql/Oracle-SQL-Library.json` | 46 reusable Oracle SQL template bodies. |
| `sql/Predicate-SQL-Mapping.json` | For each of the 364 predicates: its template, the values of its internal slots and the tags left to fill in. |
| `schemas/` | JSON schemas for the three files above. |
| `docs/SQL-Implementation-Contracts.md` | Notes on how individual templates treat nulls, scope and parameters. |
| `docs/APPLICATION-DESIGN.md` | Build specification for the workbench application. |
| `docs/reference/prototype-workbench.html` | The original throwaway prototype, kept for reference only. |
| `examples/metadata.example.csv` | Synthetic metadata sheet in the import layout. |
| `tools/validate_catalogue.py` | Consistency check across the graph, library and mapping. |
| `catalogue/app-classification.json` | App-specific classification: predicate output (partition or measure) and group attachment. Review table in `app-classification.md`. |
| `app/vendor/` | Vendored SheetJS reader for XLSX imports (see its README). |
| `dist/workbench.html` | The built workbench: one self-contained file. |
| `app/` | Workbench source: `lib/` logic (no DOM), `ui/` interface, `index.html` and `styles.css`. |
| `build/build.py` | Validates the catalogue, builds the catalogue bundle and inlines everything into `dist/workbench.html`. |
| `build/classification.py` | Checks the classification and regenerates its review table. |
| `tests/` | Node tests (`npm test`) and Playwright end-to-end checks (`tests/e2e`, `npm run test:e2e`). |

## Terminology

| Term | Meaning |
|---|---|
| Predicate | A condition that selects a subset of rows. A primary predicate is derived directly from one column. |
| Group | A set of predicates that together split a population: a complementary pair (Null / Non-null) or a multiway group. Catalogue IDs such as `U01`. |
| Family | One of the catalogue's 26 organizing folders for groups. Organization only. |
| Sentence | A compound predicate, whether nested (a predicate applied inside another predicate's rows) or lateral (several predicates combined at the same level). |
| Semantic partition | The general class covering predicates and sentences. |
| Semantic type | A human-assigned role for a column (Code, Identifier, ...). With the data type, it limits which groups apply. |

A predicate either returns rows, making it a partition that can be split further, or returns a measure (a count or statistic), making it a fact recorded about the partition it is evaluated in.

## SQL templates

The templates save typing. They are not required to run as written; the investigator copies them into a SQL environment and adapts them.

- `[[slot]]`: internal differences between predicates that share a template (for example `= 1` versus `> 1`). These are already resolved by the mapping.
- `{{tag}}`: values the investigator or the application supplies, such as `{{column_name}}` or `{{population_condition}}`. Anything not filled in stays visible for the investigator to complete.
- The source relation always appears as `{{schema_name}}.{{table_name}}`. It can be replaced by a parenthesized query to evaluate the predicate inside another predicate's rows.

The templates have not been run against Oracle.

## Validation

```sh
python tools/validate_catalogue.py
```

Checks that the frozen enumeration matches the graph's recorded hash, that every predicate in the graph has a mapping to an existing template, that resolving each mapping reproduces its recorded SQL fingerprint and tag list, that every predicate reads its subject from `{{schema_name}}.{{table_name}}` or `{{subject_query}}`, and that the graph's SQL references agree with the mapping. Standard library only.

## Building and testing the workbench

```sh
python build/build.py      # validate the catalogue and classification, write dist/workbench.html
npm test                   # logic tests; needs Node 20+ and Python 3 on PATH (set PYTHON to override)
npm run test:e2e           # builds, then drives dist/workbench.html in Chromium via Playwright
```
