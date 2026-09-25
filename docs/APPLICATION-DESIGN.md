# Predicate Investigation Workbench — application design

This is the build specification for the workbench application. It records decisions the product owner has already made; treat them as settled. Where this document is silent, choose the simplest option consistent with it and note the choice in your commit message. Do not reopen settled decisions without asking the product owner.

Read in this order: this document, `README.md`, `graph/Predicate-Catalogue-Enumeration-v1.0.md` (skim the introduction and the semantic type table), then `docs/reference/prototype-workbench.html` (a throwaway prototype; inspiration only, not code to extend).

---

## 1. Purpose

The team is migrating to Denodo and needs to profile a large, messy Oracle database before and during the migration. Profiling runs outside Denodo in a SQL tool. The workbench is where investigators organize that work and record its results, table by table and column by column.

The core idea: each column can split its table into subsets of rows (partitions) using business-meaningful conditions. A condition that cannot be split further along that column is a **predicate**. Predicates can be applied inside other predicates' rows, building a hierarchy that mirrors Denodo's folder-structured namespaces. For each predicate the investigator records the SQL they ran, the result and their conclusion. Rows that fail expectations are identified for QA.

The workbench **constrains and scaffolds**; it does not automate. It:

- pre-builds the table/column outline from an imported metadata sheet;
- offers only the predicate groups that suit each column's data type and semantic type;
- pre-fills SQL templates with schema, table, column and scope so the investigator has less to type;
- records everything the investigator enters.

It never connects to a database or runs SQL. Generated SQL is a labor-saving starting point; it is not required to run as written. When something cannot be pre-filled, leave it visibly unfilled for the human.

### Non-goals

- Executing SQL, connecting to databases, or validating SQL syntax.
- Automatically or exhaustively generating predicates or sentences. Humans choose every node.
- Joins between tables in the hierarchy. A nested table is always a subset of its parent's rows.
- Modeling keys and relationships between tables. Key metadata is shown as notes only.
- Multi-user collaboration or a server.
- Denodo export and reports (deferred; see §14).

---

## 2. Glossary

Use these terms consistently in code, UI and documentation.

| Term | Meaning |
|---|---|
| **Predicate** | A condition that selects a subset of rows. A *primary predicate* derives directly from one column. In the catalogue, a `PredicateDefinition` (364 of them, IDs such as `U01.1`). |
| **Group** | A set of predicates that together split a population: a complementary pair (Null / Non-null) or a multiway group. Catalogue `PredicateGroup` (173, IDs such as `U01`). |
| **Family** | One of 26 catalogue folders that organize groups. Organization only; no semantics. |
| **Semantic type** | A human-assigned role for a column (Code, Identifier, ... 34 in total). With the data type, it determines which groups are offered. |
| **Storage class** | A catalogue category of physical data types (A, C, T, N, D, I, O, J, G, B, M). Derived from the Oracle data type. |
| **Partition** | A predicate node whose SQL returns rows. It can be split further. |
| **Measure** | A predicate node whose SQL returns a count, statistic or summary. It records a fact about the rows it is evaluated over and has no children. |
| **Sentence** | A compound predicate. *Nested*: a predicate applied inside another partition (any node at depth two or more). *Lateral*: two or more sibling partitions combined at the same level. |
| **Semantic partition** | The general class covering predicates and sentences. |
| **Source** | The relation a node's SQL selects from: the real table at the root, or the parent partition's rows when nested. |
| **Tag** | A `{{name}}` placeholder in a SQL template, filled by the app or the investigator. |
| **Slot** | A `[[name]]` placeholder already resolved by the catalogue mapping. The app never sees slots. |

---

## 3. Inputs in this repository

| File | Used for |
|---|---|
| `graph/Predicate-Catalogue-Graph-v1.0.0-sql-enriched.json` | Groups, predicates, families, semantic types, storage classes, applicability and complements. |
| `sql/Oracle-SQL-Library.json` | Template bodies. |
| `sql/Predicate-SQL-Mapping.json` | Per-predicate template, slot values and tag list. |
| `docs/SQL-Implementation-Contracts.md` | Human reference for what individual tags mean. Link to it from the UI's help text; do not parse it. |

`tools/validate_catalogue.py` must keep passing. Do not modify the catalogue, library or mapping files.

### Graph facts the app relies on

Nodes (`nodes[]`, each with `id`, `type`, `label`, `attributes`):

- `PredicateDefinition`: `id` = `predicate:<ref>`; `attributes.catalogueRef`, `attributes.definition`.
- `PredicateGroup`: `id` = `group:<axis>`; `attributes.kind` (`complementary_pair` | `multiway_group`), `definition`, `intendedExclusive`, `intendedExhaustive`.
- `PredicateFamily`: `id` = `family:NN`; `label`.
- `SemanticType`: `id` = `semantic:<Label>`; `attributes.definition`.
- `StorageClass`: `id` = `storage:<Letter>`; `attributes.definition`.
- `ApplicabilityRule`: `id` = `applicability:<axis>` (same axis as its group); `attributes.universalSemanticApplicability` (bool), `semanticApplicability` and `storageApplicability` (human-readable text).

Edges (`edges[]`, each with `type`, `source`, `target`, `attributes`):

- `GROUP_HAS_MEMBER`: group → predicate, `attributes.ordinal` gives member order.
- `IN_FAMILY`: predicate → family. A group's family is its members' family.
- `RECOMMENDS_FOR_TYPE`: rule → semantic type.
- `MENTIONS_STORAGE_CLASS`: rule → storage class.
- `GOVERNS_DEFINITION`: rule → predicate.
- `COMPLEMENT_OF`: predicate ↔ predicate, stored once, traverse both ways.
- `SPECIALIZES`, `COMPOSED_FROM`, `USES_QUERY_PATTERN`: not used by the app in v1.

The graph's `extensions.sqlIntegration.tagContract` points to a file that no longer exists. Ignore it.

---

## 4. Architecture

- **Deliverable:** one self-contained file, `dist/workbench.html`, that opens by double-click (`file://`) in current Chrome and Edge, with no network access at runtime. Commit the built file so the product owner can download it.
- **Source:** plain JavaScript (ES modules) and CSS in `app/`. No framework is required; keep dependencies to the XLSX reader below.
- **Build:** `build/build.py` (Python 3 standard library only) does two things:
  1. Builds the **catalogue bundle** (§5) from the three catalogue files and the classification file (§6), including stage-one SQL for every predicate, and fails if `tools/validate_catalogue.py` fails.
  2. Inlines the JavaScript, CSS, vendored XLSX reader and catalogue bundle into `dist/workbench.html`.
- **XLSX reading:** vendor SheetJS Community Edition (`xlsx.full.min.js`, Apache-2.0) into `app/vendor/` and inline it. Only reading is needed.
- **Tests:** keep the logic (import parsing, applicability filtering, SQL generation, merging, workspace serialization) in modules with no DOM dependency, and test them with Node's built-in runner (`node --test`). Use Playwright with the preinstalled Chromium for a small number of end-to-end checks against `dist/workbench.html`.
- **IDs:** generate node IDs with a counter plus a random suffix. Do not rely on `crypto.randomUUID`, which is unavailable in some `file://` contexts.

Suggested layout:

```
app/            source modules, styles, vendor/
build/          build.py, classification tooling
catalogue/      app-classification.json (§6)
dist/           workbench.html (built, committed)
examples/       metadata.example.csv
tests/          node and playwright tests
```

---

## 5. Catalogue bundle

Built once by `build/build.py` and embedded in the HTML as JSON. Shape (field names are a suggestion; keep them stable once chosen):

```jsonc
{
  "catalogueVersion": "1.0.0",
  "semanticTypes": [{ "id": "Code", "definition": "..." }],
  "storageClasses": [{ "id": "T", "definition": "..." }],
  "families": [{ "id": "family:03", "label": "Uniqueness and cardinality" }],
  "groups": [{
    "id": "U01",
    "label": "U01 — Uniqueness / Non-uniqueness",
    "kind": "complementary_pair",
    "definition": "...",
    "familyId": "family:03",
    "members": ["U01.1", "U01.2"],            // by ordinal
    "applicability": {
      "universal": true,                     // U01 applies to every semantic type
      "semanticTypes": [],                   // from RECOMMENDS_FOR_TYPE edges
      "storageClasses": ["C"],               // from MENTIONS_STORAGE_CLASS; empty = no storage constraint
      "semanticText": "...", "storageText": "..."
    },
    "attachment": "column",                  // from §6
    "crossSource": false                     // from §6
  }],
  "predicates": [{
    "id": "U01.1",
    "label": "Uniqueness",
    "definition": "...",
    "groupId": "U01",
    "complements": ["U01.2"],
    "templateId": "oracle.occurrence_rows",
    "sql": "SELECT p.* FROM ( ... {{schema_name}}.{{table_name}} ... ) p WHERE ...;",  // stage one: slots resolved
    "tags": ["column_name", "schema_name", "table_name"],
    "output": "partition"                    // from §6: partition | measure
  }]
}
```

Stage-one SQL: take the template body, replace every `[[slot]]` with the mapping's value, and check the SHA-256 of the result against `rendered_sql_sha256` (the build fails on mismatch). `tags` is the mapping's `parameters` list.

---

## 6. Phase 0 — classification (review gate)

Two properties the app needs are not recorded in the catalogue. Produce them as `catalogue/app-classification.json`, then **stop and ask the product owner to review it before building the UI.**

1. **Predicate output: `partition` or `measure`.**
   - `partition`: the SQL returns rows of the source (for example `SELECT t.*` or `SELECT p.*` over source rows, possibly with extra diagnostic `profile_*` columns).
   - `measure`: the SQL returns aggregates, one row per group or category, or a single summary row (for example `COUNT(*) AS profile_row_count`, frequency profiles, entropy, candidate-key summaries).
   - Classify per template from its final top-level `SELECT`, then per predicate (they almost always follow their template). Flag uncertain cases with a note.
2. **Group attachment: `column` or `table`, plus `crossSource`.**
   - `column`: the group is about one column's values (it uses a column tag such as `column_name`, `value_expression`, `text_column`, `key_columns`, or a condition that is naturally about a single column, such as P02 missingness).
   - `table`: the group is about the table or partition as a whole (row volume, completeness across fields, record duplication).
   - `crossSource: true`: the SQL also reads another relation supplied by tags (`reference_*`, `source_*`, `left_*`/`right_*`, `baseline_*`, `node_query` and similar). These groups still attach to a column or table; the other relation appears only inside the SQL.
   - A tag-based heuristic sorts roughly 100 groups as column, 24 as table and 49 as cross-source, but it misclassifies some (P02 comes out as table). Use it as a first pass, then read each group's definition.

Format: `{ "templates": { "<templateId>": { "output": "...", "note": "..." } }, "predicateOverrides": { "<id>": { "output": "...", "note": "..." } }, "groups": { "<axis>": { "attachment": "...", "crossSource": bool, "note": "..." } } }`. Also generate a readable Markdown table from it for the review.

---

## 7. Metadata import

### 7.1 File

CSV (UTF-8, comma-separated, quoted fields allowed) or XLSX (first sheet). One row per column. `examples/metadata.example.csv` shows the layout.

| Column | Required | Use |
|---|---|---|
| `SCHEMA_OWNER` | yes | Schema; fills `{{schema_name}}` |
| `TABLE_NAME` | yes | Table; creates the root Table node |
| `COLUMN_NAME` | yes | Column; creates the Column node and fills column tags |
| `DATA_TYPE` | yes | Oracle data type, e.g. `VARCHAR2(2)`, `NUMBER(6,0)`; mapped to storage classes (§7.3) |
| `SEMANTIC_TYPE` | yes (value may be blank) | One or more of the 34 catalogue semantic types, separated by `;` |
| any other column | no | Kept verbatim and shown as read-only notes on the column (`KEY: value`) |

- **Header matching** ignores case, spaces and underscores: `Semantic Type` matches `SEMANTIC_TYPE`.
- **Semantic type values** are matched the same way against catalogue labels (`Postal Code` → `PostalCode`, `free text` → `FreeText`). Blank means unclassified. An unrecognized value produces an import warning naming the row and value; that value is dropped and the column is treated as having its remaining valid types (or unclassified).
- If `COLUMN_ID` is present, order columns by it within a table; otherwise keep file order.
- Reject the file (with a clear message) if a required header is missing. Skip rows missing schema, table or column and list them in the import report.
- Show an import report: tables and columns added, columns updated, warnings, skipped rows.

### 7.2 Merge

Importing merges into the current workspace, keyed by `SCHEMA.TABLE.COLUMN` (case-insensitive, stored uppercase):

- New tables and columns are added.
- For existing columns, data type, semantic types and notes are refreshed from the file. If a refresh changes the storage classes or semantic types of a column that already has groups, keep the groups and mark any that no longer match as "off-recommendation" (§9).
- Nothing is ever deleted, and investigation records are never touched.

### 7.3 Data type → storage classes

Match on the base type name (text before `(`, uppercase, ignore `WITH [LOCAL] TIME ZONE` and similar suffixes).

| Oracle base type | Storage classes |
|---|---|
| VARCHAR2, NVARCHAR2, VARCHAR, CHAR, NCHAR | T, C, O, A |
| CLOB, NCLOB | T, J, A |
| NUMBER, FLOAT, INTEGER, INT, SMALLINT, DECIMAL, BINARY_FLOAT, BINARY_DOUBLE | N, C, O, A |
| DATE, TIMESTAMP | D, C, O, A |
| INTERVAL (YEAR TO MONTH, DAY TO SECOND) | I, C, O, A |
| RAW, LONG RAW, BLOB | B, A |
| JSON, XMLTYPE | J, A |
| SDO_GEOMETRY | G, A |
| anything else | A |

Class M (imported metadata) is never derived from a column type.

---

## 8. Workspace model

The workspace is the complete record of an investigation. It serializes to one JSON document.

```jsonc
{
  "format": "predicate-workbench-workspace",
  "formatVersion": 1,
  "catalogueVersion": "1.0.0",
  "savedAt": "2026-09-25T12:00:00Z",
  "columns": {                                  // registry from metadata import
    "ADMIN.APPLICATION.ADR_TYP_CDE": {
      "schema": "ADMIN", "table": "APPLICATION", "column": "ADR_TYP_CDE",
      "dataType": "VARCHAR2(2)", "storageClasses": ["T","C","O","A"],
      "semanticTypes": ["Code"], "notes": { "COLUMN_COMMENT": "..." }, "order": 68
    }
  },
  "nodes": { "<nodeId>": { /* see below */ } },
  "roots": ["<tableNodeId>", "..."],           // root Table nodes, sorted by schema.table
  "extensions": { "groups": [], "predicates": [] }   // custom catalogue entries (§11)
}
```

### 8.1 Node kinds

Every node has `id`, `kind`, `parentId`, `children` (ordered IDs) and `collapsed`.

| Kind | Fields | Parent | Allowed children |
|---|---|---|---|
| `table` | `schema`, `table` | none (root) or a partition `predicate`/`sentence` | `column`, table-level `group`, `sentence` |
| `column` | `columnKey` (registry key) | `table` | column-level `group` |
| `group` | `groupId` (catalogue axis or custom ID), `offRecommendation` (bool) | `column` or `table` | `predicate` |
| `predicate` | `predicateId`, `tagValues` {tag: text}, `record` | `group` | one `table` node, only if its output is `partition` |
| `sentence` | `componentIds` (≥2 predicate or sentence node IDs), `record` | `table` | one `table` node |

- **Root table nodes** are created on import with a `column` child for every column of that table.
- **Nested table nodes** (under a partition) start with no columns. The investigator adds the columns they want to split on from a list of the table's columns (from the registry) and can add table-level groups. A partition has at most one table child; "drill in" creates it on first use.
- **Adding a group** creates all its members as `predicate` children, in ordinal order, with empty records. Members can be deleted individually, marked N/A, or added again (a second `M01.1` with a different `selected_value`, for instance). The same group can be added to a node more than once, e.g. two `M01` groups for two different values.
- **Lateral sentence:** the investigator selects two or more partition nodes that sit under the same enclosing table node (the components may be under different columns) and chooses "Combine". The sentence node is placed under that table node.
- **Deleting** a node deletes its subtree after confirmation. There is no other destructive operation.

### 8.2 Record

Predicate and sentence nodes carry:

| Field | Notes |
|---|---|
| `status` | One of: Not tested (default), Confirmed, Empty, Exception found, Rejected, N/A |
| `rowCount` | Optional number, as reported by the investigator |
| `appliedSql` | The SQL actually run, pasted by the investigator |
| `results` | Free text: result summary, sample rows, counts |
| `notes` | Free text: conclusions and reasoning (for example, why a complement was not pursued) |
| `updatedAt` | Set when any record field changes |

"Empty" records that the predicate returned no rows. It is the usual justification for not pursuing a complement or children.

---

## 9. Applicability filtering

For a column with storage classes `S` and semantic types `T`, a catalogue group `g` is **recommended** when both hold:

- **Semantic:** `g.applicability.universal` is true, or `T` shares at least one type with `g.applicability.semanticTypes`. An unclassified column (empty `T`) gets only universal groups.
- **Storage:** `g.applicability.storageClasses` is empty, or contains `A`, or shares at least one class with `S`.

Additionally, only groups whose `attachment` matches the node (`column` groups on column nodes, `table` groups on table nodes) are offered.

The add-group menu lists recommended groups nested by family, with each group's label and definition visible (tooltip or secondary text) and its members shown. A **Show all** toggle lists every group of the matching attachment; choosing a non-recommended group sets `offRecommendation: true`, which the outline shows with a visible marker. Include a text filter in the menu. Cross-source groups are listed with a marker indicating they need another relation.

The catalogue's applicability text is explicitly advisory ("not an executable eligibility rule"), which is why Show all exists. Show the group's `semanticText` and `storageText` in its detail view.

---

## 10. SQL generation

Generated SQL is recomputed from the current state whenever a node is displayed. It is read-only in the UI and has a Copy button. The investigator's edits go into `record.appliedSql`.

### 10.1 Source of a node

The source of a node is the source of its nearest enclosing `table` node:

- **Root table:** `SCHEMA.TABLE`.
- **Table under partition `P`:**
  ```sql
  (SELECT t.COL1, t.COL2, ..., t.COLn FROM (<parent SQL>) t)
  ```
  - `<parent SQL>` is `P.record.appliedSql` if it is non-empty, otherwise `P`'s generated SQL, with trailing whitespace and the final `;` removed.
  - The column list is every column of that table from the registry, in order. Projecting only the base columns prevents duplicate diagnostic columns (`profile_*`) when partitions nest, which Oracle rejects (ORA-00918).
- Indent the inner SQL so nested SQL stays readable.

### 10.2 Filling tags

Start from the predicate's stage-one SQL. Fill tags in this order:

1. **The investigator's value** in `tagValues[tag]`, if non-empty, always wins.
2. **Automatic values:**

   | Tag | Value |
   |---|---|
   | `schema_name` + `table_name` | These always appear together as `{{schema_name}}.{{table_name}}`. Replace the pair with the node's source (§10.1). |
   | `subject_query` | `SELECT * FROM <source>` |
   | `column_name`, `text_column`, `value_column`, `document_column`, `raw_column`, `lob_column`, `geometry_column` | The column name, unqualified (templates already prefix `t.`) |
   | `value_expression` | `t.<COLUMN>` |
   | `value_columns`, `key_columns`, `category_columns`, `entity_columns` | The column name |
   | `population_condition`, `population_scope_condition`, `row_scope_condition`, `chain_scope_condition`, `subject_scope_condition` | `1 = 1` (the parent's scope is carried by the source) |
   | `values_nonnull_condition`, `category_nonnull_condition` | `<COLUMN> IS NOT NULL` |

   Column tags apply only when the group is attached to a column. On table-level groups they stay unfilled.
3. **Anything else stays as `{{tag}}`** in the output.

Coverage with these rules: 44 of 364 predicates fill completely, 95 have one tag left (usually the value being tested, such as `selected_value` for M01), and the rest have more.

### 10.3 Tag editor

A predicate's detail view lists every tag in its template with its current value and where it came from (automatic, entered, or unfilled). Unfilled tags are highlighted. The investigator can enter a value for any tag, including overriding an automatic one, and can clear an override to go back to the automatic value. Link to `docs/SQL-Implementation-Contracts.md` for tag meanings (the investigator has the repository locally).

When a group is added, show a small form for the tags left unfilled after automatic filling. It is optional and can be skipped. Values entered there apply to every member of the group, since complementary members share their parameters.

### 10.4 Sentences

- **Nested:** no special handling. A predicate under a nested table gets its source from §10.1.
- **Lateral:** generate each component's SQL against the shared source, strip trailing `;`, and combine:
  ```sql
  SELECT * FROM (<component 1>)
  INTERSECT
  SELECT * FROM (<component 2>);
  ```
  Add a comment line: `-- INTERSECT removes duplicate rows and requires identical column lists; adjust as needed.`

### 10.5 Measures

Measure nodes generate SQL like any predicate, but they have no children and no "drill in".

---

## 11. Catalogue extensions

The product owner will add predicates over time. Extensions live in the workspace (`extensions`) and can be exported and imported separately as a catalogue-extension file.

- **Custom group:** ID `custom:<slug>` (unique), label, definition, attachment (`column` | `table`), applicability (semantic types, storage classes, or universal) and members.
- **Custom predicate:** ID `<groupId>.<n>`, label, definition, output (`partition` | `measure`), and a SQL template written with the same `{{tag}}` conventions. The tag list is derived from the template text. The same filling rules apply.
- **Blank predicate:** on any column or table node the investigator can add a one-off "Custom predicate" with a label and hand-written SQL, without defining a reusable group.
- **Import merges by ID and never overwrites.** If an incoming ID already exists with different content, keep the existing entry and list the conflict in the import report.
- Frozen catalogue entries cannot be edited.

---

## 12. Persistence

- **Export workspace** downloads the workspace JSON (`workbench-<yyyymmdd-hhmm>.json`). This file is the real record.
- **Open workspace** loads a workspace JSON, replacing the current one after confirmation. Reject files with the wrong `format` or a newer `formatVersion`. If the file's `catalogueVersion` differs from the app's, warn, and mark nodes whose predicate or group IDs are no longer in the catalogue as orphaned instead of dropping them.
- **Autosave** to `localStorage` after changes (debounced), wrapped in try/catch; on startup, offer to restore the autosave. The app must work if storage is unavailable. Show when the last export happened so the investigator knows whether their file is current.

---

## 13. User interface

Modeled on Workflowy: one outline, fast to navigate, where any node can become the whole view.

- **Outline:** indented tree of tables → columns → groups → predicates → nested tables, and so on. Expand/collapse per node; collapsed state is saved.
- **Zoom:** any node can be opened as the root of the view, with a breadcrumb back up. Nested depth is the normal case, so this is essential.
- **Node rows** show a kind icon, the name, and compact metadata:
  - table: schema.table, count of tested and total predicates in the subtree;
  - column: data type, semantic types;
  - group: axis ID, label, off-recommendation or cross-source marker;
  - predicate: label, key tag values (e.g. `= 'NC'`), status badge, row count; measures look different from partitions.
- **Detail panel** for the selected node: definition, record fields (§8.2), generated SQL with Copy, tag editor (§10.3), column notes for columns.
- **Add actions** appear in context: add group (§9), add column (on nested tables), drill in (on partitions), combine (with a multi-selection of eligible partitions), custom predicate.
- **Keyboard:** up/down to move, left/right to collapse/expand, Enter to open the detail panel, a shortcut to zoom in and out, a shortcut to focus search. Mouse must also work for everything.
- **Search/filter:** by name and by status (for example, show only "Exception found").
- **Toolbar:** Import metadata, Import catalogue extension, Export workspace, Open workspace, autosave and last-export indicator.
- Clean, readable styling that works at laptop widths. Status colors must not be the only signal; pair them with text or icons.

---

## 14. Deferred (not in v1)

- Export of the outline as a Denodo folder and view-name structure.
- Markdown or CSV reports of the investigation.
- Use of `SPECIALIZES` and `COMPOSED_FROM` edges.

---

## 15. Build phases

Work in this order and commit after each phase.

1. **Phase 0 — classification** (§6). Commit `catalogue/app-classification.json` and its Markdown review table. **Stop and ask the product owner to review.**
2. **Phase 1 — core logic without UI:** catalogue bundle build, metadata import and merge, storage mapping, applicability filtering, SQL generation, workspace serialization, extension merge. Node tests for each.
3. **Phase 2 — UI:** outline, zoom, detail panel, add flows, sentences, persistence. Playwright checks for the acceptance scenarios.
4. **Phase 3 — polish:** keyboard, search/filter, import reports, empty and error states.

## 16. Acceptance scenarios

Use `examples/metadata.example.csv` unless stated.

1. Importing the example creates one root table per `SCHEMA.TABLE` with all its columns, in `COLUMN_ID` order, and shows extra sheet columns as notes.
2. Re-importing the same file changes nothing. Importing a file with one extra column adds only that column.
3. A `Code` column on `VARCHAR2` offers M01 (universal, storage C) and Code-specific groups; an unclassified column offers only universal groups; a `NUMBER` column offers no group whose storage classes are only T; Show all lists more and marks the choice off-recommendation.
4. Adding U01 to a root column produces two predicates whose SQL has schema, table and column filled and no `{{...}}` left.
5. Adding M01 with `selected_value` = `'NC'` produces members filtering `= 'NC'` and `<> 'NC'`, with nothing left unfilled.
6. Drilling into `M01.1`, adding a column and adding U01 produces SQL whose source is the projected subquery of the M01.1 SQL. Two levels of nesting stay syntactically balanced (parentheses match; no duplicate `profile_*` columns in the projected lists).
7. If `appliedSql` is entered on the parent, the child's source uses it instead of the generated SQL.
8. A measure predicate cannot be drilled into.
9. Combining two sibling partitions produces a lateral sentence with INTERSECT SQL.
10. Export, reload the page, and open the file: the workspace is identical. Autosave restore works; the app still runs with storage disabled.
11. Importing an extension file with a new group adds it; importing it again reports no changes; importing a conflicting version reports a conflict and keeps the original.
12. `dist/workbench.html` works from `file://` with the network disabled.
