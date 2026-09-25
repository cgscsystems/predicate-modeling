# App classification — review table

Generated from `catalogue/app-classification.json` by `python build/classification.py`. Do not edit by hand; edit the JSON and regenerate.

Phase 0 of `docs/APPLICATION-DESIGN.md` (§6): each predicate's **output** (`partition` returns rows of the source and can be drilled into; `measure` returns a count, statistic or summary) and each group's **attachment** (`column` or `table`) and **cross-source** flag (the SQL also reads another relation supplied by tags).

## Conventions used

- **Output** is decided per template from its final top-level `SELECT`. Where that `SELECT` is itself a mapping slot, each predicate's slot value decides, and differences are recorded as predicate overrides.
- A template counts as `partition` when it returns the rows of its subject relation (`t.*` or `p.*` built from `t.*`), with or without extra `profile_*` columns.
- **Attachment** is to the relation whose rows the SQL returns or summarizes (the subject). The group is `column` when it is about one column's values, including a column tested against a companion column on the same row (start/end, value/deadline, x/y). Anchoring such pairs on a column keeps semantic-type and storage filtering (§9) useful. It is `table` when the group is about the record or several fields together.
- **Cross-source** is true only when the SQL reads a second relation of records (reference, mapping, baseline, extract, event, edge or evidence tables and queries). Tags that supply a literal (`reference_value`), a same-row expression (`source_value`), entity column lists (`left_entity_columns`) or a declared value list (`*_set_query`) do not count.

## Summary

| | Count |
|---|---|
| Templates: partition / measure | 24 / 22 |
| Predicates: partition / measure (after overrides) | 287 / 77 |
| Groups: column, same source | 109 |
| Groups: column, cross-source | 37 |
| Groups: table, same source | 12 |
| Groups: table, cross-source | 15 |
| Groups where the decision differs from the tag heuristic | 53 |

## Templates

| Template | Predicates | Output | Note |
|---|---|---|---|
| `oracle.occurrence_rows` | 6 | partition | Source rows plus profile_occurrence_count. |
| `oracle.population_unique` | 2 | measure | Single summary row (population, max occurrences, duplicates). |
| `oracle.key_candidate` | 2 | measure | Single summary row. |
| `oracle.distinct_population` | 4 | measure | Single row: distinct value count. |
| `oracle.distinct_per_subject` | 10 | measure | One row per determinant/subject group with a distinct count. Selects groups, not their member rows. |
| `oracle.scalar_equality` | 22 | partition |  |
| `oracle.scalar_membership` | 8 | partition |  |
| `oracle.unrecognized_boolean` | 1 | partition |  |
| `oracle.subject_category` | 2 | partition |  |
| `oracle.related_existence` | 40 | partition | Returns rows of the subject relation ({{schema_name}}.{{table_name}}, or ({{subject_query}}) for the Y01–Y03 node dictionary). |
| `oracle.join_match_count` | 5 | partition | Subject rows plus profile_match_count. |
| `oracle.relationship_degree` | 4 | measure | Single summary row of degree maxima. |
| `oracle.population_coverage` | 4 | measure | Single summary row of covered/missing counts. |
| `oracle.selected_row_rule` | 22 | partition |  |
| `oracle.selected_text_regex` | 28 | partition |  |
| `oracle.selected_length_comparison` | 4 | partition |  |
| `oracle.population_presence_counts` | 5 | measure | Single summary row. |
| `oracle.population_length_diversity` | 2 | measure | Single summary row. |
| `oracle.finite_numeric_rule` | 17 | partition | Source rows plus profile_value. |
| `oracle.floating_value_class` | 3 | partition |  |
| `oracle.ordered_interval_rule` | 11 | partition |  |
| `oracle.population_numeric_extreme` | 4 | partition | Source rows (all ties) plus profile_value/minimum/maximum. |
| `oracle.coordinate_rectangle` | 2 | partition |  |
| `oracle.population_row_volume` | 4 | measure | Single row: row count. |
| `oracle.category_frequency_profile` | 4 | measure | One row per category with frequency and share. |
| `oracle.numeric_population_statistics` | 4 | measure | Final SELECT is the [[selection]] slot. S04 selects the summary row (measure); S03 selects source rows with statistics attached (overridden to partition). |
| `oracle.aligned_numeric_aggregate_comparison` | 6 | measure | Single summary row comparing two aggregates. |
| `oracle.categorical_total_variation` | 2 | measure | Single summary row. |
| `oracle.category_shannon_entropy` | 2 | measure | Single summary row. |
| `oracle.pearson_association` | 2 | measure | Single summary row. |
| `oracle.category_representation_intervals` | 5 | measure | Final SELECT is the [[selection]] slot: H05 returns one row per domain category, H06 one balance summary row. Both measure. |
| `oracle.temporal_row_filter` | 12 | partition |  |
| `oracle.predecessor_profile` | 11 | partition | Source rows plus position/previous-value columns. |
| `oracle.row_position_profile` | 6 | partition | Source rows plus profile_position. |
| `oracle.reference_pair_filter` | 9 | partition | Returns t.* joined to matching reference rows, so a subject row appears once per matched reference record (pair grain); drilling in may repeat subject rows. The template carries a SQL comment saying so. |
| `oracle.computed_document_evidence` | 40 | partition | Source rows plus profile_evidence. |
| `oracle.evaluable_agreement` | 10 | partition | Rows of {{subject_query}} plus profile_agreement. |
| `oracle.explicit_authorization` | 2 | partition | Subject rows that carry an explicit PERMIT/DENY decision. |
| `oracle.extract_union_counts` | 7 | measure | One row per key with source/target occurrence counts. |
| `oracle.unique_extract_agreement` | 2 | measure | One row per matched key with investigator-chosen comparison_output_columns, not subject rows. |
| `oracle.graph_cycle_participation` | 2 | measure | Returns a list of node_id values (one row per distinct node), not subject rows. |
| `oracle.graph_rooted_reachability` | 2 | measure | Returns a list of node_id values (one row per distinct node), not subject rows. |
| `oracle.graph_shortest_depth` | 2 | measure | One row per reachable node with its depth. |
| `oracle.declared_condition_rows` | 14 | partition | Rows of {{subject_query}} plus profile_rule_truth. |
| `oracle.metadata_set_difference` | 2 | measure | Single summary row of added/removed counts. |
| `oracle.component_truth_aggregation` | 6 | partition | Rows of {{subject_query}} plus component counts; subject_query must expose a subject_id column. |

## Predicate overrides

| Predicate | Output | Note |
|---|---|---|
| S03.1 | partition | Selection returns source rows (v.*) with mean/SD attached; the template default is measure. |
| S03.2 | partition | Selection returns source rows (v.*) with mean/SD attached; the template default is measure. |

## Groups

`Heuristic` is the tag-based first pass; **bold** marks a group where the decision differs from it.

### Presence and missingness

| Axis | Group | Members | Output | Attachment | Cross-source | Heuristic | Note |
|---|---|---|---|---|---|---|---|
| P01 | Null / Non-null | 2 | partition | column | no | column |  |
| **P02** | Semantically missing / Semantically present | 2 | partition | column | no | table | Heuristic says table (no column tag); missingness is a rule about one column's values, as §6 notes. |
| P03 | Whitespace-only / Contains non-whitespace | 2 | partition | column | no | column |  |
| P04 | Default-valued / Non-default-valued | 2 | partition | column | no | column |  |
| P05 | Sentinel-valued / Non-sentinel-valued | 2 | partition | column | no | column | sentinel_set_query supplies a declared value list, not another relation of records. |
| P06 | Empty payload / Non-empty payload | 2 | partition | column | no | column |  |

### Completeness

| Axis | Group | Members | Output | Attachment | Cross-source | Heuristic | Note |
|---|---|---|---|---|---|---|---|
| C01 | Complete record / Incomplete record | 2 | partition | table | no | table | Rule spans several fields of the record. |
| **C02** | All populated / Partly populated / All missing | 3 | measure | column | no | table | Heuristic says table. Definition is about one selected column's presence; missing_condition is written against that column. |
| **C03** | Required value supplied / Required value missing | 2 | partition | column | no | table | Heuristic says table. About one required field, conditioned on a row-level rule. |
| **C04** | Sufficient completeness / Insufficient completeness | 2 | measure | column | no | table | Heuristic says table. Definition is about one selected column's presence; missing_condition is written against that column. |
| C05 | Required combination satisfied / Required combination violated | 2 | partition | table | no | table | Rule spans several fields of the record. |

### Uniqueness and cardinality

| Axis | Group | Members | Output | Attachment | Cross-source | Heuristic | Note |
|---|---|---|---|---|---|---|---|
| U01 | Uniqueness / Non-uniqueness | 2 | partition | column | no | column |  |
| **U02** | Composite uniqueness / Composite non-uniqueness | 2 | partition | table | no | column | Composite tuple spanning several columns; key_columns is left for the investigator (column tags do not fill on table groups). |
| U03 | Record uniqueness / Record duplication | 2 | partition | table | no | table | Record projection across several fields. |
| U04 | Unique column or key / Non-unique column or key | 2 | measure | column | no | column | Single column or composite key. On a column, key_columns fills with that column; the investigator can override for a composite key. |
| U05 | Constant / Varying | 2 | measure | column | no | column |  |
| U06 | Cardinality within bounds / Cardinality outside bounds | 2 | measure | column | no | column |  |
| U07 | Key candidate / Not a key candidate | 2 | measure | column | no | column | Single column or composite key. On a column, key_columns fills with that column; the investigator can override for a composite key. |

### Equality and membership

| Axis | Group | Members | Output | Attachment | Cross-source | Heuristic | Note |
|---|---|---|---|---|---|---|---|
| M01 | Equals selected value / Differs from selected value | 2 | partition | column | no | column |  |
| M02 | In selected set / Outside selected set | 2 | partition | column | no | column |  |
| M03 | Allowed value / Disallowed value | 2 | partition | column | no | column | allowed_set_query is a declared domain list; the relational version (reference table) is K01. |
| M04 | True encoding / False encoding / Unrecognized encoding | 3 | partition | column | no | column |  |

### Representation and conversion

| Axis | Group | Members | Output | Attachment | Cross-source | Heuristic | Note |
|---|---|---|---|---|---|---|---|
| V01 | Parseable / Unparseable | 2 | partition | column | no | column |  |
| V02 | Convertible / Non-convertible | 2 | partition | column | no | column |  |
| V03 | Lossless conversion / Lossy conversion | 2 | partition | column | no | column |  |
| V04 | Well formed / Malformed | 2 | partition | column | no | column |  |
| V05 | Canonical representation / Noncanonical representation | 2 | partition | column | no | column |  |
| V06 | Decoding-valid / Decoding-invalid | 2 | partition | column | no | column |  |

### Length and lexical format

| Axis | Group | Members | Output | Attachment | Cross-source | Heuristic | Note |
|---|---|---|---|---|---|---|---|
| F01 | Pattern match / Pattern mismatch | 2 | partition | column | no | column |  |
| F02 | Expected length / Unexpected length | 2 | partition | column | no | column |  |
| F03 | Length within bounds / Length outside bounds | 2 | partition | column | no | column |  |
| F04 | Uniform length / Varying length | 2 | measure | column | no | column |  |
| F05 | Checksum-valid / Checksum-invalid | 2 | partition | column | no | column | Checksum column and expected-hash column are on the same row; anchor on the value column. |
| F06 | Allowed characters / Disallowed characters present | 2 | partition | column | no | column |  |
| F07 | Delimited structure valid / Delimited structure invalid | 2 | partition | column | no | column |  |

### Character content, case and whitespace

| Axis | Group | Members | Output | Attachment | Cross-source | Heuristic | Note |
|---|---|---|---|---|---|---|---|
| X01 | Alphabetic-only / Not alphabetic-only | 2 | partition | column | no | column |  |
| X02 | Digit-only / Not digit-only | 2 | partition | column | no | column |  |
| X03 | Alphanumeric-only / Not alphanumeric-only | 2 | partition | column | no | column |  |
| X04 | ASCII-only / Contains non-ASCII | 2 | partition | column | no | column |  |
| **X05** | Mixed scripts / Single script | 2 | partition | column | yes | column | Reads {{script_rules_schema}}.{{script_rules_table}} inside the evidence expression. |
| X06 | Has control characters / No control characters | 2 | partition | column | no | column |  |
| X07 | Uppercase / Lowercase / Mixed case / No cased letters | 4 | partition | column | no | column |  |
| X08 | Title-case conforming / Title-case nonconforming | 2 | partition | column | no | column |  |
| X09 | Leading whitespace / No leading whitespace | 2 | partition | column | no | column |  |
| X10 | Trailing whitespace / No trailing whitespace | 2 | partition | column | no | column |  |
| X11 | Internal whitespace / No internal whitespace | 2 | partition | column | no | column |  |
| X12 | Contains whitespace / Whitespace-free | 2 | partition | column | no | column |  |
| X13 | Token present / Token absent | 2 | partition | column | no | column |  |
| X14 | Prefix match / Prefix mismatch | 2 | partition | column | no | column |  |
| X15 | Suffix match / Suffix mismatch | 2 | partition | column | no | column |  |
| X16 | Substring present / Substring absent | 2 | partition | column | no | column |  |
| X17 | Trimmed / Untrimmed | 2 | partition | column | no | column |  |

### Numeric properties

| Axis | Group | Members | Output | Attachment | Cross-source | Heuristic | Note |
|---|---|---|---|---|---|---|---|
| N01 | Negative / Zero / Positive | 3 | partition | column | no | column |  |
| N02 | Integral / Fractional | 2 | partition | column | no | column |  |
| N03 | Even / Odd | 2 | partition | column | no | column |  |
| N04 | Multiple of increment / Not a multiple of increment | 2 | partition | column | no | column |  |
| N05 | Within precision/scale contract / Outside precision/scale contract | 2 | partition | column | no | column |  |
| N06 | Finite / Infinite / NaN | 3 | partition | column | no | column |  |
| **N07** | Consistent with rounded source / Inconsistent with rounded source | 2 | partition | column | no | cross-source | Heuristic says cross-source (source_value tag). source_value is an expression on the same row, not another relation. |
| **N08** | Consistent with truncated source / Inconsistent with truncated source | 2 | partition | column | no | cross-source | Heuristic says cross-source (source_value tag). source_value is an expression on the same row, not another relation. |

### Ordering, bounds and tolerances

| Axis | Group | Members | Output | Attachment | Cross-source | Heuristic | Note |
|---|---|---|---|---|---|---|---|
| **R01** | Less than reference / Equal to reference / Greater than reference | 3 | partition | column | no | cross-source | Heuristic says cross-source (reference_value tag). reference_value is a literal, not another relation. |
| R02 | Within range / Outside range | 2 | partition | column | no | column |  |
| R03 | Lower boundary / Interior / Upper boundary / Outside interval | 4 | partition | column | no | column |  |
| R04 | At observed minimum / Above observed minimum | 2 | partition | column | no | column |  |
| R05 | At observed maximum / Below observed maximum | 2 | partition | column | no | column |  |
| **R06** | Within tolerance / Outside tolerance | 2 | partition | column | no | cross-source | Heuristic says cross-source (reference_value tag). reference_value is a literal, not another relation. |

### Date and time representation

| Axis | Group | Members | Output | Attachment | Cross-source | Heuristic | Note |
|---|---|---|---|---|---|---|---|
| D01 | Valid calendar value / Invalid calendar value | 2 | partition | column | no | column |  |
| **D02** | Unambiguous interpretation / Ambiguous interpretation | 2 | partition | column | yes | column | Reads the permitted-format list {{date_formats_schema}}.{{date_formats_table}}. |
| D03 | Complete date/time specification / Partial date/time specification | 2 | partition | table | no | table | Up to six separate component columns (required_component_1..6). |
| D04 | Required granularity satisfied / Required granularity violated | 2 | partition | column | no | column |  |
| **D05** | Timezone specified / Timezone unspecified | 2 | partition | column | no | table | Heuristic says table. About one timestamp column; timezone_evidence_expression may reference a companion column on the same row. |

### Temporal position and timeliness

| Axis | Group | Members | Output | Attachment | Cross-source | Heuristic | Note |
|---|---|---|---|---|---|---|---|
| T01 | Before cutoff / At cutoff / After cutoff | 3 | partition | column | no | column |  |
| T02 | On or before cutoff / After cutoff | 2 | partition | column | no | column |  |
| T03 | Within period / Outside period | 2 | partition | column | no | column |  |
| T04 | Selected calendar class / Other calendar class | 2 | partition | column | yes | cross-source | Calendar-class reference relation ({{reference_schema}}.{{reference_table}}). |
| T05 | Fresh / Stale | 2 | partition | column | no | column |  |
| T06 | On-time / Late | 2 | partition | column | no | column | deadline_column is on the same row; anchor on the event column. |
| **T07** | Within latency allowance / Exceeds latency allowance | 2 | partition | column | no | table | Heuristic says table. Column pair (start_column, end_column) on the same row; attached to a column so Timestamp/Duration filtering applies. Neither column tag is auto-filled. |

### Intervals, sequences and events

| Axis | Group | Members | Output | Attachment | Cross-source | Heuristic | Note |
|---|---|---|---|---|---|---|---|
| E01 | Ordered endpoints / Reversed endpoints | 2 | partition | column | no | column | Column pair; column_name is the start, end_column is entered. |
| **E02** | Expired / Effective / Not yet effective | 3 | partition | column | no | table | Heuristic says table. Period columns on the same row (ValidityPeriod); attached to a column so type filtering applies. Period tags are entered by hand. |
| **E03** | Required event present / Required event absent | 2 | partition | table | yes | table | About the subject record; reads the event relation {{event_schema}}.{{event_table}}. |
| **E04** | Overlapping intervals / Nonoverlapping intervals | 2 | partition | column | no | table | Heuristic says table. Period columns on the same row (ValidityPeriod); attached to a column so type filtering applies. Period tags are entered by hand. |
| E05 | Contiguous succession / Noncontiguous succession | 2 | partition | column | no | column | Chain over rows ordered per entity; tested value is one column. |
| E06 | Expected next step / Unexpected next step | 2 | partition | column | no | column | Chain over rows ordered per entity; tested value is one column. |
| E07 | Nondecreasing sequence / Sequence regression | 2 | partition | column | no | column | Chain over rows ordered per entity; tested value is one column. |
| **E08** | Permitted transition / Forbidden transition | 2 | partition | column | yes | column | Reads the allowed-transition relation {{transition_schema}}.{{transition_table}}. |
| E09 | First occurrence / Later occurrence | 2 | partition | column | no | column | entity_columns fills with the column; total_order is entered. |
| E10 | Latest occurrence / Earlier occurrence | 2 | partition | column | no | column | entity_columns fills with the column; total_order is entered. |
| E11 | Increasing / Unchanged / Decreasing | 3 | partition | column | no | column | Chain over rows ordered per entity; tested value is one column. |

### Reference integrity

| Axis | Group | Members | Output | Attachment | Cross-source | Heuristic | Note |
|---|---|---|---|---|---|---|---|
| K01 | In reference set / Outside reference set | 2 | partition | column | yes | cross-source | The reference/mapping relation is the other source. |
| K02 | Referenced / Unreferenced | 2 | partition | column | yes | cross-source | Reference-side key column: the node is the referenced table; the referencing population ({{source_schema}}.{{source_table}}) is the other source. |
| **K03** | Parent exists / Orphan reference | 2 | partition | column | yes | table | Heuristic says table. Child parent-key column; the parent relation is the other source. |
| K04 | Zero matches / One match / Multiple matches | 3 | partition | column | yes | cross-source | The reference/mapping relation is the other source. |
| K05 | Effective reference / Ineffective reference | 2 | partition | column | yes | cross-source | Matched reference relation; pair grain (see reference_pair_filter). |
| K06 | Approved reference / Deprecated reference / Other reference status | 3 | partition | column | yes | cross-source | Matched reference relation; pair grain (see reference_pair_filter). |
| K07 | Mapping available / Mapping unavailable | 2 | partition | column | yes | cross-source | The reference/mapping relation is the other source. |

### Relationship shape and dependencies

| Axis | Group | Members | Output | Attachment | Cross-source | Heuristic | Note |
|---|---|---|---|---|---|---|---|
| **L01** | One-to-one / One-to-many / Many-to-one / Many-to-many | 4 | measure | table | no | cross-source | Heuristic says cross-source (left_/right_ tags), but those are entity column lists. Pair of entity columns from {{subject_query}}; mark cross-source by hand if the pair spans tables. |
| L02 | Functionally dependent / Functional-dependency violation | 2 | measure | column | no | column | Dependent column Y; value_columns fills with it, group_columns (determinant X) is entered. |
| L03 | One related entity / Multiple related entities | 2 | measure | column | no | column | Related-entity column; value_columns fills with it, group_columns (subject) is entered. |
| **L04** | Required relationship coverage / Incomplete relationship coverage | 2 | measure | table | yes | table | About subject records; reads the relation table. |
| L05 | Join multiplicity within allowance / Join multiplicity exceeds allowance | 2 | partition | column | yes | cross-source | Join key column; consistent with K04. |

### Cross-column and group consistency

| Axis | Group | Members | Output | Attachment | Cross-source | Heuristic | Note |
|---|---|---|---|---|---|---|---|
| **Q01** | Values agree / Values disagree | 2 | partition | column | no | cross-source | Heuristic says cross-source. Two fields on the same row of {{subject_query}}; anchored on the left field. |
| Q02 | Column order respected / Column order violated | 2 | partition | column | no | column | Column pair; column_name is A, comparison_column is B. |
| **Q03** | Derivation consistent / Derivation inconsistent | 2 | partition | column | no | table | Heuristic says table. About one stored derived column. |
| Q04 | Aggregate reconciled / Aggregate unreconciled | 2 | measure | column | yes | cross-source | Aggregate of one value column compared with a control/other population. Use H02 for plain row counts. |
| **Q05** | Allowed combination / Forbidden combination | 2 | partition | table | yes | table | Tuple of several fields checked against an allowed-combinations relation. |
| Q06 | Group consistent / Group conflicting | 2 | measure | column | no | column | Attribute column; value_columns fills with it, group_columns (entity) is entered. |
| **Q07** | Units compatible / Units incompatible | 2 | partition | column | yes | table | Heuristic says table. Unit/currency code column; compatibility relation is the other source. |

### Classification

| Axis | Group | Members | Output | Attachment | Cross-source | Heuristic | Note |
|---|---|---|---|---|---|---|---|
| **A01** | Classified / Unclassified | 2 | partition | table | yes | table | About the subject record; reads the assignment relation. |
| A02 | Single-classified / Multi-classified | 2 | measure | column | no | column | Class column; value_columns fills with it, group_columns (subject) is entered. |
| A03 | Unambiguous classification / Ambiguous classification | 2 | measure | column | no | column | Class column; value_columns fills with it, group_columns (subject) is entered. |
| **A04** | Classification consistent / Classification inconsistent | 2 | partition | column | yes | table | Cross-source because the authoritative assignment is usually joined into {{subject_query}}; it is not when the authority is a deterministic rule. |
| **A05** | In selected category / Outside selected category | 2 | partition | table | yes | table | Subject rows are the node's table; category assignments come from {{assignment_schema}}.{{assignment_table}}. |

### Business rules and lifecycle

| Axis | Group | Members | Output | Attachment | Cross-source | Heuristic | Note |
|---|---|---|---|---|---|---|---|
| B01 | Rule compliant / Rule violation | 2 | partition | table | no | table | Record-level business rule. |
| B02 | Active / Inactive | 2 | partition | table | no | table | Lifecycle rule over the subject record (may combine status and dates). |
| B03 | Eligible / Ineligible | 2 | partition | table | no | table | Record-level business rule. |
| **B04** | Authorized / Unauthorized | 2 | partition | table | yes | table | Authorization relation is the other source. |
| B05 | Current version / Superseded version | 2 | partition | column | no | column | Entity identifier column; entity_columns fills with it. |
| **B06** | Deleted-marked / Not deleted-marked | 2 | partition | column | no | table | Heuristic says table. About one soft-delete marker column. |

### Geographic predicates

| Axis | Group | Members | Output | Attachment | Cross-source | Heuristic | Note |
|---|---|---|---|---|---|---|---|
| **G01** | Coordinates in domain / Coordinates outside domain | 2 | partition | column | no | table | Heuristic says table. Coordinate pair on the same row; anchor on x. |
| G02 | Geography known / Geography unknown to reference | 2 | partition | column | yes | cross-source | Geographic reference relation is the other source. |
| **G03** | Spatially resolvable / Spatially unresolved | 2 | partition | column | yes | table | Heuristic says table. Geographic column resolved through a spatial mapping relation. |
| G04 | Inside selected area / Outside selected area | 2 | partition | column | no | column |  |
| **G05** | Domestic / Foreign | 2 | partition | column | yes | table | Geographic reference relation is the other source. |
| **G06** | Selected settlement class / Other settlement class | 2 | partition | column | yes | table | Geographic reference relation is the other source. |
| G07 | Geometry valid / Geometry invalid | 2 | partition | column | no | column |  |
| G08 | Boundary release applicable / Boundary release inapplicable | 2 | partition | column | yes | cross-source | Geographic reference relation is the other source. |

### Frequency and distribution

| Axis | Group | Members | Output | Attachment | Cross-source | Heuristic | Note |
|---|---|---|---|---|---|---|---|
| S01 | Frequent / Infrequent | 2 | measure | column | no | column |  |
| S02 | Modal / Nonmodal | 2 | measure | column | no | column |  |
| S03 | Inlier / Outlier | 2 | partition | column | no | column |  |
| S04 | Dispersion within bounds / Dispersion outside bounds | 2 | measure | column | no | column |  |
| S05 | Distribution compatible / Distribution incompatible | 2 | measure | column | yes | cross-source | Baseline or comparison population is another relation. |
| S06 | Drift within allowance / Drift exceeds allowance | 2 | measure | column | yes | cross-source | Baseline or comparison population is another relation. |
| S07 | Entropy within bounds / Entropy outside bounds | 2 | measure | column | no | column |  |
| **S08** | Association meets criterion / Association below criterion | 2 | measure | column | no | table | Heuristic says table. Variable pair on the same row; anchor on x. |

### Coverage, volume and representation

| Axis | Group | Members | Output | Attachment | Cross-source | Heuristic | Note |
|---|---|---|---|---|---|---|---|
| H01 | Empty population / Nonempty population | 2 | measure | table | no | table |  |
| H02 | Volume within bounds / Volume outside bounds | 2 | measure | table | no | table |  |
| **H03** | Expected member observed / Expected member absent | 2 | partition | column | yes | table | Subject is the expected-domain table, mirroring K02. Attach to the domain table's column so "Expected member absent" partitions domain rows; the observed table ({{observed_schema}}.{{observed_table}}) is the other source. |
| **H04** | Domain fully covered / Domain incompletely covered | 2 | measure | column | yes | table | Same subject convention as H03. |
| H05 | Underrepresented / Within representation bounds / Overrepresented | 3 | measure | column | yes | cross-source | Observed category column vs declared baseline relation. |
| H06 | Balanced / Unbalanced | 2 | measure | column | yes | cross-source | Observed category column vs declared baseline relation. |

### Reconciliation and change between extracts

| Axis | Group | Members | Output | Attachment | Cross-source | Heuristic | Note |
|---|---|---|---|---|---|---|---|
| Z01 | Shared key / Source-only key / Target-only key | 3 | measure | column | yes | cross-source | Key/value column compared across extracts. |
| Z02 | Unchanged record / Changed record | 2 | measure | table | yes | cross-source | Record-level comparison across extracts. |
| Z03 | Reconciled measure / Unreconciled measure | 2 | measure | column | yes | cross-source | Aggregate of one value column compared with a control/other population. Use H02 for plain row counts. |
| Z04 | Multiplicity preserved / Multiplicity changed | 2 | measure | column | yes | cross-source | Key/value column compared across extracts. |
| Z05 | New domain value / Previously observed domain value | 2 | measure | column | yes | cross-source | Key/value column compared across extracts. |

### Hierarchies and graph structure

| Axis | Group | Members | Output | Attachment | Cross-source | Heuristic | Note |
|---|---|---|---|---|---|---|---|
| **Y01** | Root / Non-root | 2 | partition | column | yes | table | Node identifier column. The node dictionary is {{subject_query}}; the edge/parent query is the other source (it may read the same table in a self-referencing hierarchy). |
| Y02 | Leaf / Non-leaf | 2 | partition | column | yes | cross-source | Node identifier column. The node dictionary is {{subject_query}}; the edge/parent query is the other source (it may read the same table in a self-referencing hierarchy). |
| **Y03** | Connected / Isolated | 2 | partition | column | yes | table | Node identifier column. The node dictionary is {{subject_query}}; the edge/parent query is the other source (it may read the same table in a self-referencing hierarchy). |
| **Y04** | On a cycle / Not on a cycle | 2 | measure | column | yes | table | Node identifier column. The node dictionary is {{subject_query}}; the edge/parent query is the other source (it may read the same table in a self-referencing hierarchy). |
| **Y05** | Reachable / Unreachable | 2 | measure | column | yes | table | Node identifier column. The node dictionary is {{subject_query}}; the edge/parent query is the other source (it may read the same table in a self-referencing hierarchy). |
| **Y06** | Self-reference / No self-reference | 2 | partition | column | no | table | Heuristic says table. Reference column compared with the row's own identifier. |
| **Y07** | Depth within bounds / Depth outside bounds | 2 | measure | column | yes | table | Node identifier column. The node dictionary is {{subject_query}}; the edge/parent query is the other source (it may read the same table in a self-referencing hierarchy). |

### Structured payloads

| Axis | Group | Members | Output | Attachment | Cross-source | Heuristic | Note |
|---|---|---|---|---|---|---|---|
| J01 | Document syntax valid / Document syntax invalid | 2 | partition | column | no | column |  |
| J02 | Path present / Path absent | 2 | partition | column | no | column |  |
| J03 | Expected node type / Unexpected node type | 2 | partition | column | no | column |  |
| J04 | Document contract conforming / Document contract nonconforming | 2 | partition | column | no | column |  |
| J05 | Collection size within bounds / Collection size outside bounds | 2 | partition | column | no | column |  |
| J06 | JSON null / Non-null JSON node | 2 | partition | column | no | column |  |

### Provenance and verification facts

| Axis | Group | Members | Output | Attachment | Cross-source | Heuristic | Note |
|---|---|---|---|---|---|---|---|
| **W01** | Verification recorded / No verification recorded | 2 | partition | table | yes | table | Evidence records are another relation. |
| **W02** | Approved provenance / Unapproved provenance | 2 | partition | column | yes | table | Heuristic says table. Provenance/source column checked against an approved-source relation. |
| **W03** | Evidence agrees / Evidence conflicts | 2 | partition | table | yes | table | Evidence records are another relation. |

### Schema and metadata predicates (imported profile)

| Axis | Group | Members | Output | Attachment | Cross-source | Heuristic | Note |
|---|---|---|---|---|---|---|---|
| **SC01** | Expected object present / Expected object absent | 2 | partition | table | yes | table | Metadata inventory relation is the other source. Subject is the expected-object/required-constraint list. |
| **SC02** | Declared type matches / Declared type differs | 2 | partition | column | no | table | Meaningful on an imported metadata inventory (e.g. ALL_TAB_COLUMNS, ALL_CONSTRAINTS) loaded as a table; attach to the type/nullability/status column. |
| **SC03** | Declared nullability matches / Declared nullability differs | 2 | partition | column | no | table | Meaningful on an imported metadata inventory (e.g. ALL_TAB_COLUMNS, ALL_CONSTRAINTS) loaded as a table; attach to the type/nullability/status column. |
| **SC04** | Required constraint declared / Required constraint undeclared | 2 | partition | table | yes | table | Metadata inventory relation is the other source. Subject is the expected-object/required-constraint list. |
| SC05 | Constraint enabled / Constraint disabled | 2 | partition | column | no | column | Meaningful on an imported metadata inventory (e.g. ALL_TAB_COLUMNS, ALL_CONSTRAINTS) loaded as a table; attach to the type/nullability/status column. |
| SC06 | Constraint validated / Constraint not validated | 2 | partition | column | no | column | Meaningful on an imported metadata inventory (e.g. ALL_TAB_COLUMNS, ALL_CONSTRAINTS) loaded as a table; attach to the type/nullability/status column. |
| **SC07** | Structure unchanged / Structure changed | 2 | measure | table | yes | table | Two metadata snapshots. |

### Logical and conditional composition

| Axis | Group | Members | Output | Attachment | Cross-source | Heuristic | Note |
|---|---|---|---|---|---|---|---|
| **LC01** | All component predicates hold / At least one fails | 2 | partition | table | yes | table | Component results are another relation (component_result_query). |
| **LC02** | At least one component holds / None holds | 2 | partition | table | yes | table | Component results are another relation (component_result_query). |
| **LC03** | Exactly one component holds / Not exactly one holds | 2 | partition | table | yes | table | Component results are another relation (component_result_query). |
| LC04 | Conditional rule satisfied / Conditional rule violated | 2 | partition | table | no | table |  |
