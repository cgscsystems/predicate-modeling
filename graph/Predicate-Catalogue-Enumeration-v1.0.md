# Predicate catalogue — enumeration v1.0

Status: FROZEN — catalogue release 1.0.0, approved by the user on 2026-09-23. Scope: completed enumeration (1.2–1.3). SQL enrichment is deferred and will be Oracle-only, with customizable SQL held as properties of predicate definitions. No application or graph-schema redesign is proposed here.

Inventory: **364 named predicate members**, organized into **158 complementary pairs and 15 multiway groups across 26 families**. These include deliberate role-specific variants of shared operations. There are **34 semantic types**. The original catalogue's 173 entries are all accounted for in the disposition crosswalk; that number happens also to equal this draft's number of pair/group axes, not its number of predicates.

The second uniqueness example is understood to carry the comment `--All non-uniques`.

## Reading the catalogue

Each numbered entry is an axis containing either a complementary pair (`↔`) or a named multiway group (`;`). Each member is a predicate definition, not just a possible result label. An axis ID plus the member's position identifies it for review, e.g. U01.1 = Uniqueness and U01.2 = Non-uniqueness. These identifiers are stable in release 1.0.0; later graph and SQL enrichment refer to them without reordering or renumbering members.

Definitions specify what is selected. A value predicate normally selects rows carrying that value; group predicates select groups and can subsequently expose their member rows. A whole-column claim such as “this column is unique” is explicitly separate from selecting values that occur once.

Pairs partition their **stated evaluable population**. Nulls, failed parsing, missing references needed to judge a rule, and absent baselines are not silently assigned to the negative member. Presence predicates handle nulls directly. Unless an entry says otherwise, a value-dependent test uses non-null, successfully interpreted inputs. “Not evaluated / indeterminate” remains available in the investigation record; it is not a new predicate duplicated into every pair. Structural absence of a match is, however, the defined negative result of a reference-existence test.

U01 deliberately follows the supplied query: occurrence counting includes a null-valued group. All rows whose key value occurs once are unique; all rows whose key value occurs more than once are non-unique. No arbitrary “first duplicate” is removed. An investigator may restrict the population to non-null values, but must use that same population for both members. Composite-key versions count tuples, not concatenated strings.

Named groups are mutually exclusive and exhaustive on the population stated in their definition. Separate axes can overlap: uppercase and alphabetic are compatible predicates, not alternative categories. Ranges declare inclusivity; sequences declare ordering; classifications declare their scheme. These are definition-level qualifications, not an execution framework.

The catalogue is a broad reusable basis. Domain-specific values, formats, thresholds, rules and logical compositions are parameterized instances rather than an infinite list of separately named predicates.

## Semantic types

Multiple roles can apply to the same column. ALL includes unclassified columns; it is semantic applicability, not a promise that every Oracle datatype supports every operation directly.

| Semantic type | Meaning |
|---|---|
| Identifier | A label for identity; arithmetic is not implied by numeric storage. |
| ReferenceKey | A value or tuple used to link to another record or domain. |
| Code | A symbolic value from a coding scheme. |
| Classification | An assignment within a category system, possibly hierarchical or multiple. |
| Status | A state in a business lifecycle. |
| BooleanFlag | A two-state fact represented by explicitly identified encodings. |
| Quantity | A count or amount for which arithmetic is meaningful. |
| Measurement | A measured magnitude, with units and precision where relevant. |
| MonetaryAmount | A financial amount; replaces ambiguous old semantic label Currency. |
| CurrencyCode | The currency designation attached to an amount; also a Code. |
| Percentage | A proportion represented on a declared scale, such as 0–100. |
| Ratio | A relationship between quantities; not necessarily bounded by one. |
| Ordinal | A meaningful rank or order; numeric spacing need not be meaningful. |
| SequenceNumber | A position in a specified sequence; can also be an Identifier. |
| Date | A calendar date role, even when stored in a datetime datatype. |
| Timestamp | A point in time, with a declared timezone interpretation where needed. |
| TimeOfDay | A position within a day, without an implied calendar date. |
| Duration | Elapsed time, expressed in a declared unit or interval representation. |
| ValidityPeriod | A start/end pair describing when something applies. |
| Name | A human, organization or other named-entity label. |
| Address | A structured or textual location description. |
| PostalCode | A jurisdiction-specific postal identifier; also a Code. |
| GeographicEntity | A geographic area or place identity. |
| GeographicCoordinate | Coordinates with a declared coordinate reference system. |
| Geometry | A spatial shape with a declared reference system. |
| FreeText | Text whose primary role is unconstrained language/content. |
| EmailAddress | An electronic mail address; format validity does not prove reachability. |
| TelephoneNumber | A telephone identifier under a specified numbering plan. |
| URI | A resource identifier; syntactic validity does not prove availability. |
| UnitCode | A designation of a measurement unit; also a Code. |
| Version | An ordered or labeled revision under an explicit version scheme. |
| EventType | A code identifying an event kind; also a Code. |
| StructuredDocument | A JSON, XML or other structured payload. |
| BinaryPayload | Bytes with a declared or investigated interpretation. |

Convenience sets used below: **NUM** = Quantity, Measurement, MonetaryAmount, Percentage, Ratio and numeric Duration. **TEXTUAL** = Name, Address, PostalCode, FreeText, EmailAddress, TelephoneNumber, URI, textual Identifier/Code/Status/Classification/Version. **TEMP** = Date, Timestamp, TimeOfDay. **KEY** = Identifier, ReferenceKey, Code. **GEO** = Address, PostalCode, GeographicEntity, GeographicCoordinate, Geometry. These are shorthand lists, not additional mandatory semantic types. ALL checks remain available alongside every specialization.

## Oracle storage applicability

| Code | Applicable storage / interpretation |
|---|---|
| A | Any target datatype for operations that do not require comparing its content, such as nullness or row counting. |
| C | Comparable scalar values or tuples: ordinary character, numeric and datetime values where the operation is supported. RAW/interval/other types require operation-specific treatment. LOB/document/object comparison is not assumed. |
| T | CHAR, VARCHAR2, NCHAR, NVARCHAR2; CLOB/NCLOB only through appropriate text operations. |
| N | NUMBER and numeric types including BINARY_FLOAT/BINARY_DOUBLE; finite values unless explicitly testing non-finite values. |
| D | DATE and TIMESTAMP variants, interpreted according to their semantic role. Oracle DATE can contain time. |
| I | INTERVAL types, or numeric durations with explicit units. |
| O | Values with a meaningful order: numeric, datetime, suitable intervals, or explicitly ordered codes/text. |
| J | JSON/XML stored in an available native or textual/binary representation; capability depends on Oracle version and representation. |
| G | Coordinate columns or spatial objects; spatial-object predicates require relevant Oracle spatial functions. |
| B | RAW, BLOB or other byte payloads with appropriate functions. |
| M | Imported metadata, declared rules, reference mappings or attached evidence. This is an input kind, not an Oracle datatype. |

`T→N` and `T→D` mean the predicate concerns interpreting text as that target type. Ordinary arithmetic and temporal predicates become applicable only after that interpretation has been established. Numeric identifiers may use an explicitly chosen textual rendering for lexical format checks; rendering cannot recover leading zeros already lost in storage. Multiple codes separated by commas mean required or alternative inputs as explained by the definition. All arithmetic comparisons require compatible units; monetary comparisons require a common currency or a specified conversion basis.

Oracle-specific qualification: zero-length ordinary character values are treated as NULL, whereas an initialized empty LOB can be non-null. The catalogue therefore does not promise a separate empty-string partition for ordinary VARCHAR2 data. SQL UNKNOWN is also not the same as FALSE. [O1]

## 01 — Presence and missingness

| ID | Predicates | Definition | Semantic applicability | Types |
|---|---|---|---|---|
| P01 | Null ↔ Non-null | Stored value is NULL / is not NULL. | ALL | A |
| P02 | Semantically missing ↔ Semantically present | Value matches the declared missingness rule / supplies a value under that rule. Rule may include nulls, blanks and sentinels. | ALL | A; T/C as rule requires |
| P03 | Whitespace-only ↔ Contains non-whitespace | A non-null string consists entirely of the selected whitespace characters / contains at least one other character. | TEXTUAL | T |
| P04 | Default-valued ↔ Non-default-valued | Value equals the selected default value / differs; does not infer whether a default mechanism produced it. | ALL | C |
| P05 | Sentinel-valued ↔ Non-sentinel-valued | Value belongs / does not belong to a declared placeholder set, e.g. unknown-code markers. | ALL | C |
| P06 | Empty payload ↔ Non-empty payload | A non-null LOB/document collection has zero content length or zero members / more than zero, under the chosen representation. | BinaryPayload, StructuredDocument, FreeText | B/J/T |

## 02 — Completeness

| ID | Predicates | Definition | Semantic applicability | Types |
|---|---|---|---|---|
| C01 | Complete record ↔ Incomplete record | All required fields are semantically present / at least one required field is missing. | ALL | A |
| C02 | All populated; Partly populated; All missing | In a nonempty selected column/group: every value is present; some but not all are present; none are present. | ALL | A |
| C03 | Required value supplied ↔ Required value missing | Among rows where a declared condition requires a field, that field is present / missing. | ALL | A, rule inputs |
| C04 | Sufficient completeness ↔ Insufficient completeness | Present-value fraction meets / fails a declared minimum, for a nonempty column or group. | ALL | A |
| C05 | Required combination satisfied ↔ Required combination violated | A specified field-presence rule, such as at least one contact field or both coordinate fields, holds / fails. | ALL | A |

## 03 — Uniqueness and cardinality

| ID | Predicates | Definition | Semantic applicability | Types |
|---|---|---|---|---|
| U01 | Uniqueness ↔ Non-uniqueness | A row's selected value occurs exactly once / more than once in the chosen population; includes null groups as in the supplied example. | ALL | C |
| U02 | Composite uniqueness ↔ Composite non-uniqueness | The selected tuple occurs exactly once / more than once. Includes null components using a consistent grouping convention. | ALL | C tuple |
| U03 | Record uniqueness ↔ Record duplication | The complete declared record projection occurs once / more than once. “Record” means the selected comparison fields, not an assumed business entity. | ALL | C tuple |
| U04 | Unique column or key ↔ Non-unique column or key | Across a selected nonempty population, no selected value/tuple repeats / at least one repeats. Null policy must be the same on both sides. | ALL | C |
| U05 | Constant ↔ Varying | A nonempty eligible population has exactly one distinct value / more than one. An all-null population is handled by C02 if nulls are excluded. | ALL | C |
| U06 | Cardinality within bounds ↔ Cardinality outside bounds | Distinct-value count is / is not inside a declared interval; can include zero. | ALL | C |
| U07 | Key candidate ↔ Not a key candidate | Selected key fields are jointly unique and non-null / one or both requirements fail in the observed population. This does not prove future uniqueness. | ALL; especially KEY | C tuple |

## 04 — Equality and membership

| ID | Predicates | Definition | Semantic applicability | Types |
|---|---|---|---|---|
| M01 | Equals selected value ↔ Differs from selected value | Value equals / differs from a specified non-null value. Instantiating this for code 1 produces the original TABLE1.COL1 = 1 partition. | ALL | C |
| M02 | In selected set ↔ Outside selected set | Value belongs / does not belong to an explicitly selected set. | ALL | C |
| M03 | Allowed value ↔ Disallowed value | Value belongs / does not belong to the business-approved domain. Same membership operation as M02, with a normative role. | ALL; especially Code, Status, BooleanFlag | C |
| M04 | True encoding; False encoding; Unrecognized encoding | Non-null flag value belongs to the declared true set, false set, or neither; sets must be disjoint. | BooleanFlag | C |

## 05 — Representation and conversion

| ID | Predicates | Definition | Semantic applicability | Types |
|---|---|---|---|---|
| V01 | Parseable ↔ Unparseable | Representation can / cannot be interpreted using the selected grammar and locale. | ALL with encoded representation | T/B |
| V02 | Convertible ↔ Non-convertible | Value can / cannot be converted to the specified target datatype under the selected conversion rules. | ALL | Source/target dependent |
| V03 | Lossless conversion ↔ Lossy conversion | Among successfully converted values, specified value or representation information is / is not preserved by the defined comparison. | ALL | Source/target dependent |
| V04 | Well formed ↔ Malformed | Value satisfies / violates its declared semantic representation contract, e.g. a ten-digit identifier. | ALL with a format contract | T/N/B/J |
| V05 | Canonical representation ↔ Noncanonical representation | Representation equals / differs from the result of a specified normalization procedure. | ALL with normalization | T/C/J |
| V06 | Decoding-valid ↔ Decoding-invalid | Available source bytes can / cannot be decoded under a selected encoding. Correct decoding alone does not prove intended wording. | BinaryPayload, encoded text | B |

## 06 — Length and lexical format

| ID | Predicates | Definition | Semantic applicability | Types |
|---|---|---|---|---|
| F01 | Pattern match ↔ Pattern mismatch | Value satisfies / fails a specified full-string or substring pattern; matching mode is explicit. | TEXTUAL | T |
| F02 | Expected length ↔ Unexpected length | Length equals / differs from a specified length; character versus byte length is declared. | TEXTUAL, BinaryPayload | T/B; rendered N |
| F03 | Length within bounds ↔ Length outside bounds | Length lies / does not lie inside the specified interval. | TEXTUAL, BinaryPayload | T/B |
| F04 | Uniform length ↔ Varying length | All values in a nonempty population have the same measured length / at least two lengths occur. This is a population property. | TEXTUAL, BinaryPayload | T/B |
| F05 | Checksum-valid ↔ Checksum-invalid | An available checksum/check digit agrees / disagrees with the specified algorithm on an evaluable value. | Identifier, Code, BinaryPayload | T/N/B |
| F06 | Allowed characters ↔ Disallowed characters present | All characters belong to a specified repertoire / at least one does not. | TEXTUAL | T |
| F07 | Delimited structure valid ↔ Delimited structure invalid | Record text follows / violates declared delimiter, quoting and field-count rules. | StructuredDocument, FreeText | T |

## 07 — Character content, case and whitespace

| ID | Predicates | Definition | Semantic applicability | Types |
|---|---|---|---|---|
| X01 | Alphabetic-only ↔ Not alphabetic-only | Nonempty string contains only letters under the chosen character rules / contains something else. | TEXTUAL | T |
| X02 | Digit-only ↔ Not digit-only | Nonempty string consists entirely of digits from the selected repertoire / does not. Signs and decimal separators are not digits. | TEXTUAL | T |
| X03 | Alphanumeric-only ↔ Not alphanumeric-only | Nonempty string contains only selected letters/digits / contains other characters. | TEXTUAL | T |
| X04 | ASCII-only ↔ Contains non-ASCII | Every character is in ASCII / at least one is not. “Unicode” is not the opposite of ASCII. | TEXTUAL | T |
| X05 | Mixed scripts ↔ Single script | Among strings with at least one script-bearing character, more than one script / exactly one script occurs under selected script rules. | TEXTUAL | T |
| X06 | Has control characters ↔ No control characters | At least one character belongs to the declared control-character set / none does. | TEXTUAL | T |
| X07 | Uppercase; Lowercase; Mixed case; No cased letters | Among nonempty strings: all cased letters are upper; all are lower; both occur; no cased letters occur. Character/locale rules are explicit. | TEXTUAL | T |
| X08 | Title-case conforming ↔ Title-case nonconforming | String follows / fails a chosen title-case convention. This is not assumed to be correct spelling for personal names. | TEXTUAL | T |
| X09 | Leading whitespace ↔ No leading whitespace | Selected whitespace occurs / does not occur at the start of a nonempty string. | TEXTUAL | T |
| X10 | Trailing whitespace ↔ No trailing whitespace | Selected whitespace occurs / does not occur at the end of a nonempty string. | TEXTUAL | T |
| X11 | Internal whitespace ↔ No internal whitespace | Selected whitespace occurs / does not occur between non-whitespace characters. | TEXTUAL | T |
| X12 | Contains whitespace ↔ Whitespace-free | At least one selected whitespace character occurs / none occurs. | TEXTUAL | T |
| X13 | Token present ↔ Token absent | A specified token or keyword occurs / does not occur with declared token boundaries and case rules. | TEXTUAL | T |
| X14 | Prefix match ↔ Prefix mismatch | String begins / does not begin with a specified sequence. | TEXTUAL | T |
| X15 | Suffix match ↔ Suffix mismatch | String ends / does not end with a specified sequence. | TEXTUAL | T |
| X16 | Substring present ↔ Substring absent | A specified character sequence occurs anywhere / does not occur, without requiring token boundaries. | TEXTUAL | T |
| X17 | Trimmed ↔ Untrimmed | A nonempty string has neither leading nor trailing selected whitespace / has at least one. Composite of X09 and X10. | TEXTUAL | T |

## 08 — Numeric properties

| ID | Predicates | Definition | Semantic applicability | Types |
|---|---|---|---|---|
| N01 | Negative; Zero; Positive | A finite numeric value is below zero, equal to zero, or above zero. | NUM | N |
| N02 | Integral ↔ Fractional | Finite value has no fractional component / has a fractional component. Decimal storage alone does not imply fractional content. | NUM; Identifier/SequenceNumber when their format requires it | N |
| N03 | Even ↔ Odd | An integral value is divisible by two / is not. | Quantity, SequenceNumber; Identifier only under a stated coding rule | N integral |
| N04 | Multiple of increment ↔ Not a multiple of increment | Value lies / does not lie on a declared numerical grid, with any tolerance specified. | NUM | N |
| N05 | Within precision/scale contract ↔ Outside precision/scale contract | Value can / cannot be represented within a stated decimal precision/scale without disallowed change. Does not infer historical rounding. | NUM, numeric Identifier | N |
| N06 | Finite; Infinite; NaN | Floating-point value is finite, an infinity, or not-a-number. | NUM | BINARY_FLOAT/BINARY_DOUBLE |
| N07 | Consistent with rounded source ↔ Inconsistent with rounded source | Target equals / differs from rounding an available source to declared precision. Does not prove the transformation actually occurred. | NUM | N pair |
| N08 | Consistent with truncated source ↔ Inconsistent with truncated source | Target equals / differs from truncating an available source to declared precision. | NUM | N pair |

## 09 — Ordering, bounds and tolerances

| ID | Predicates | Definition | Semantic applicability | Types |
|---|---|---|---|---|
| R01 | Less than reference; Equal to reference; Greater than reference | Value falls below, equals, or exceeds a specified comparable reference. | NUM, TEMP, Duration, Ordinal, SequenceNumber, Version | O |
| R02 | Within range ↔ Outside range | Value lies / does not lie between selected bounds with explicit endpoint inclusion. | NUM, TEMP, Duration, Ordinal, SequenceNumber, Version | O |
| R03 | Lower boundary; Interior; Upper boundary; Outside interval | For distinct bounds, value equals the lower bound, lies strictly between, equals the upper bound, or lies outside. | NUM, TEMP, Duration, Ordinal, SequenceNumber | O |
| R04 | At observed minimum ↔ Above observed minimum | Value equals / exceeds the minimum of its nonempty eligible population. | ALL with meaningful order | O |
| R05 | At observed maximum ↔ Below observed maximum | Value equals / is below the maximum of its nonempty eligible population. | ALL with meaningful order | O |
| R06 | Within tolerance ↔ Outside tolerance | Distance from a stated reference is at most / greater than the specified tolerance, using a defined distance measure. | NUM, TEMP, Duration, GeographicCoordinate | N/D/I/G |

## 10 — Date and time representation

| ID | Predicates | Definition | Semantic applicability | Types |
|---|---|---|---|---|
| D01 | Valid calendar value ↔ Invalid calendar value | Text/components represent / fail to represent a real date/time under the selected calendar and grammar. Not a search for impossible dates in an already valid native DATE column. | TEMP | T→D; numeric components |
| D02 | Unambiguous interpretation ↔ Ambiguous interpretation | Among values with at least one valid interpretation, the permitted formats/timezones produce one distinct meaning / more than one. | Date, Timestamp | T→D; local datetime plus zone |
| D03 | Complete date/time specification ↔ Partial date/time specification | All components required by the selected granularity are supplied / one or more are absent. | TEMP | T, component columns |
| D04 | Required granularity satisfied ↔ Required granularity violated | Interpreted value obeys / fails the declared granularity, e.g. date-only values contain no non-midnight time component. | TEMP | D |
| D05 | Timezone specified ↔ Timezone unspecified | Representation or accompanying metadata supplies / does not supply the timezone needed for interpretation. | Timestamp | T/D/M |

## 11 — Temporal position and timeliness

| ID | Predicates | Definition | Semantic applicability | Types |
|---|---|---|---|---|
| T01 | Before cutoff; At cutoff; After cutoff | Interpreted value precedes, equals, or follows a fixed cutoff. Past/present/future are aliases when the reference instant is “now”; a present-day window instead uses T03. | TEMP | D |
| T02 | On or before cutoff ↔ After cutoff | Value is at most / greater than a fixed cutoff. Retained as a convenient pair, distinct from strict Before. | TEMP | D |
| T03 | Within period ↔ Outside period | Value belongs / does not belong to a declared calendar/time interval. | TEMP | D |
| T04 | Selected calendar class ↔ Other calendar class | Value belongs / does not belong to a chosen weekday, month, fiscal period or business-calendar class. | TEMP | D plus calendar M |
| T05 | Fresh ↔ Stale | A non-future record age is at most / greater than a declared freshness limit relative to a fixed evaluation instant. Future-dated rows use T01. | Timestamp, Date | D |
| T06 | On-time ↔ Late | Recorded event time is at most / greater than its applicable deadline. Missing events use P02 or E03; they are not automatically late completed events. | Timestamp, Date | D |
| T07 | Within latency allowance ↔ Exceeds latency allowance | A nonnegative observed delay between specified events meets / exceeds the allowed duration. Reversed event order uses E01. | Timestamp, Duration | D pair/I/N |

## 12 — Intervals, sequences and events

| ID | Predicates | Definition | Semantic applicability | Types |
|---|---|---|---|---|
| E01 | Ordered endpoints ↔ Reversed endpoints | Start is at or before end / start is after end, for a pair with both endpoints supplied. | ValidityPeriod, TEMP | D pair; O pair |
| E02 | Expired; Effective; Not yet effective | For a valid period and as-of instant: instant is at/after end, within [start,end), or before start. Declared open endpoints may represent infinities. | ValidityPeriod, Status, Version | D pair |
| E03 | Required event present ↔ Required event absent | A required matching event exists / does not exist for the subject in the chosen observation window. | EventType, Identifier, Timestamp | C/D |
| E04 | Overlapping intervals ↔ Nonoverlapping intervals | Two valid intervals share eligible time / do not; boundary-touch policy is declared. | ValidityPeriod | D pairs |
| E05 | Contiguous succession ↔ Noncontiguous succession | Consecutive valid intervals meet at the selected boundary / have a gap or overlap. | ValidityPeriod | D pairs |
| E06 | Expected next step ↔ Unexpected next step | A row with a predecessor advances by the required sequence increment / does not. First rows are outside this population. | SequenceNumber, Date, Timestamp | N/D |
| E07 | Nondecreasing sequence ↔ Sequence regression | A row with a predecessor is at least as large as that predecessor / is smaller, under the declared order. | NUM, TEMP, Ordinal, Version | O |
| E08 | Permitted transition ↔ Forbidden transition | A known ordered state pair is / is not in the allowed transition relation. | Status, EventType | C pair |
| E09 | First occurrence ↔ Later occurrence | Row is the earliest for an entity under a declared total order / has a predecessor. | Identifier, ReferenceKey, EventType | C with ordered rows |
| E10 | Latest occurrence ↔ Earlier occurrence | Row is the latest for an entity under a declared total order / has a successor. | Identifier, ReferenceKey, Version, EventType | C with ordered rows |
| E11 | Increasing; Unchanged; Decreasing | Value is greater than, equal to, or smaller than its predecessor under a declared ordering. First rows are excluded. | NUM, TEMP, Ordinal, Version | O |

## 13 — Reference integrity

| ID | Predicates | Definition | Semantic applicability | Types |
|---|---|---|---|---|
| K01 | In reference set ↔ Outside reference set | Non-null source value or tuple has / lacks a matching key in a designated reference population. | ALL; especially KEY | C |
| K02 | Referenced ↔ Unreferenced | A reference-side key is used / unused by the designated source population. Includes Has child / No child for a declared parent-child relation. | KEY | C |
| K03 | Parent exists ↔ Orphan reference | A non-null child parent-key has / lacks a matching parent. Role-specific form of K01; a legitimate root without a parent key is not automatically orphaned. | ReferenceKey | C |
| K04 | Zero matches; One match; Multiple matches | A source row matches zero, exactly one, or more than one reference record under a declared join condition. | ALL; especially KEY | C |
| K05 | Effective reference ↔ Ineffective reference | Among matched reference records with known validity periods, the reference is / is not effective at the subject's relevant date. | Code, ReferenceKey, Status | C/D |
| K06 | Approved reference; Deprecated reference; Other reference status | Matched reference carries approved, deprecated or another known lifecycle status under disjoint specified sets. An unmatched key is K01, not Deprecated. | Code, ReferenceKey | C |
| K07 | Mapping available ↔ Mapping unavailable | A declared translation/crosswalk supplies / does not supply at least one mapping for a source value. Mapping ambiguity is K04. | Code, Classification, Identifier | C |

## 14 — Relationship shape and dependencies

| ID | Predicates | Definition | Semantic applicability | Types |
|---|---|---|---|---|
| L01 | One-to-one; One-to-many; Many-to-one; Many-to-many | On deduplicated observed entity-pairs with at least one edge: classify by whether every left entity has at most one right and every right at most one left; both, left only unrestricted, right only unrestricted, or both unrestricted. More precisely: 1:1 both maxima=1; 1:M left max>1/right max=1; M:1 left max=1/right max>1; M:M both maxima>1. Orientation and population are fixed. | KEY | C entity pairs |
| L02 | Functionally dependent ↔ Functional-dependency violation | For a nonempty determinant group X, all eligible rows have one Y value / multiple Y values. Testing all groups supports an observed X→Y claim. | ALL | C tuple |
| L03 | One related entity ↔ Multiple related entities | A subject with at least one relationship has one distinct target / more than one. Zero-related subjects are K04. | KEY | C |
| L04 | Required relationship coverage ↔ Incomplete relationship coverage | Every eligible subject has the required relation / at least one does not. | KEY | C |
| L05 | Join multiplicity within allowance ↔ Join multiplicity exceeds allowance | Number of output matches per source row is at most / greater than the declared allowance. Counts matching records, unlike L03's distinct entities. | ALL | C |

L01 is a population-level observed classification, not a universal schema guarantee. Different subsets can have different cardinalities. Raw join duplication alone does not establish distinct-entity many-to-many relationships.

## 15 — Cross-column and group consistency

| ID | Predicates | Definition | Semantic applicability | Types |
|---|---|---|---|---|
| Q01 | Values agree ↔ Values disagree | Two evaluable fields agree / disagree under a declared equality, normalization or tolerance rule. | ALL | C; N/D for tolerance |
| Q02 | Column order respected ↔ Column order violated | Selected A is at most B / exceeds B; may compare amounts, ranks or dates. | NUM, TEMP, Ordinal, Duration | O pair |
| Q03 | Derivation consistent ↔ Derivation inconsistent | Stored result agrees / disagrees with the declared calculation from available inputs within any specified tolerance. | ALL with derivation | Operation dependent |
| Q04 | Aggregate reconciled ↔ Aggregate unreconciled | A defined sum/count/other aggregate agrees / disagrees with an available control value. | NUM; ALL for counts | N/A |
| Q05 | Allowed combination ↔ Forbidden combination | Evaluable tuple is / is not in the allowed cross-field relationship, e.g. country–province or currency–account type. | ALL | C tuple |
| Q06 | Group consistent ↔ Group conflicting | Rows for the same declared entity agree / disagree on a selected attribute at a fixed relevant scope/time. | ALL | C tuple |
| Q07 | Units compatible ↔ Units incompatible | Known units or currency designations can / cannot be compared under the selected dimensional/conversion policy. | Measurement, Duration, MonetaryAmount, UnitCode, CurrencyCode | C/M |

## 16 — Classification

| ID | Predicates | Definition | Semantic applicability | Types |
|---|---|---|---|---|
| A01 | Classified ↔ Unclassified | Subject has at least one accepted assignment / has none in the specified scheme. | Classification, Code, Status | C |
| A02 | Single-classified ↔ Multi-classified | Among classified subjects, exactly one distinct accepted class / more than one is assigned. Multiple classes may be legitimate. | Classification | C |
| A03 | Unambiguous classification ↔ Ambiguous classification | Candidate evidence resolves to exactly one admissible class / multiple competing classes when the scheme requires one. Zero candidates are unresolved, not ambiguous. | Classification | C/M |
| A04 | Classification consistent ↔ Classification inconsistent | Recorded classification agrees / disagrees with an available authoritative assignment or deterministic rule. | Classification, Code, Status | C/M |
| A05 | In selected category ↔ Outside selected category | Subject belongs / does not belong to a selected category in a defined scheme. A semantic specialization of M02. | Classification, Code, GeographicEntity | C |

## 17 — Business rules and lifecycle

| ID | Predicates | Definition | Semantic applicability | Types |
|---|---|---|---|---|
| B01 | Rule compliant ↔ Rule violation | An evaluable, explicitly named business rule holds / fails. Generic extension point, not an unqualified global label of validity. | ALL | Rule dependent |
| B02 | Active ↔ Inactive | Subject is / is not active under a defined lifecycle rule at a fixed as-of point. Unknown lifecycle data is indeterminate. | Status, Identifier | C/D/M |
| B03 | Eligible ↔ Ineligible | Available facts satisfy / fail a declared eligibility rule. | ALL | Rule dependent |
| B04 | Authorized ↔ Unauthorized | An action/subject is permitted / prohibited by the applicable explicit authorization relation. Missing policy evidence is indeterminate. | Identifier, ReferenceKey, Status, EventType | C/M |
| B05 | Current version ↔ Superseded version | In a complete declared version chain, record is the selected current revision / an earlier superseded revision. Scheduled future revisions are outside this pair. | Version, Identifier, Status | C/O |
| B06 | Deleted-marked ↔ Not deleted-marked | Available soft-deletion marker indicates deletion / does not. This does not inspect physically removed rows. | BooleanFlag, Status | C |

## 18 — Geographic predicates

| ID | Predicates | Definition | Semantic applicability | Types |
|---|---|---|---|---|
| G01 | Coordinates in domain ↔ Coordinates outside domain | Coordinates meet / fail the legal numeric bounds of the declared reference system. | GeographicCoordinate | N tuple/G |
| G02 | Geography known ↔ Geography unknown to reference | Value or combination has / lacks a matching record in a selected geographic reference release. | GEO | C |
| G03 | Spatially resolvable ↔ Spatially unresolved | Available mappings resolve a subject to at least one usable spatial representation / none. Uniqueness of mapping is separate. | GEO | C/G/M |
| G04 | Inside selected area ↔ Outside selected area | A resolved point/geometry satisfies / fails the selected spatial containment relation; treatment of boundaries and partial overlap is explicit. | GeographicCoordinate, Geometry, GeographicEntity | G |
| G05 | Domestic ↔ Foreign | Known geography belongs / does not belong to the declared home jurisdiction. | GEO | C/G |
| G06 | Selected settlement class ↔ Other settlement class | Known classification is / is not the selected urban/rural/etc. class under an identified scheme. No universal binary urban/rural assumption. | GeographicEntity, Address, PostalCode | C/M |
| G07 | Geometry valid ↔ Geometry invalid | Geometry satisfies / fails the spatial representation's specified validity rules. | Geometry | G |
| G08 | Boundary release applicable ↔ Boundary release inapplicable | Known boundary version is / is not applicable to the relevant date and use. | GeographicEntity, Geometry, Version | G/C/D/M |

## 19 — Frequency and distribution

| ID | Predicates | Definition | Semantic applicability | Types |
|---|---|---|---|---|
| S01 | Frequent ↔ Infrequent | Observed value frequency is at least / below a declared count/share threshold. “Common” and “rare” are aliases. | ALL | C |
| S02 | Modal ↔ Nonmodal | Observed category has / does not have the maximum frequency; all tied modes qualify. | ALL | C |
| S03 | Inlier ↔ Outlier | Value falls within / outside a declared statistical rule in its reference population. “Typical” is an alias for Inlier only under that rule. | NUM, Duration; TEMP on justified scale | N/I/D |
| S04 | Dispersion within bounds ↔ Dispersion outside bounds | A specified defined dispersion statistic lies / does not lie in its interval. Statistic and minimum sample requirements must be named. | NUM, Duration | N/I |
| S05 | Distribution compatible ↔ Distribution incompatible | A declared comparison of an observed distribution to a baseline meets / fails its criterion. Compatibility does not prove identical distributions. | ALL | C/N and baseline |
| S06 | Drift within allowance ↔ Drift exceeds allowance | A declared difference in a metric/distribution across matched populations or periods is at most / above its limit. | ALL | Statistic dependent |
| S07 | Entropy within bounds ↔ Entropy outside bounds | Entropy under declared categories/bins and log base lies / does not lie in its chosen interval. | ALL | C; binned N |
| S08 | Association meets criterion ↔ Association below criterion | A specified association statistic between variables meets / fails a threshold on an adequate sample. Does not establish causality or predictive performance. | ALL with appropriate statistic | C/N |

## 20 — Coverage, volume and representation

| ID | Predicates | Definition | Semantic applicability | Types |
|---|---|---|---|---|
| H01 | Empty population ↔ Nonempty population | Selected table/group contains zero / more than zero rows. | ALL | A |
| H02 | Volume within bounds ↔ Volume outside bounds | Row count lies / does not lie within a declared interval. | ALL | A |
| H03 | Expected member observed ↔ Expected member absent | Member of an enumerated expected domain occurs / does not occur in the observed population. Selects expected-domain members, including those with no fact row. | Code, Classification, Date, GeographicEntity, KEY | C |
| H04 | Domain fully covered ↔ Domain incompletely covered | Every expected domain member is observed / at least one is absent. | ALL with expected domain | C |
| H05 | Underrepresented; Within representation bounds; Overrepresented | Category's observed share is below, inside, or above a declared interval around an external/declared baseline. No claim of sampling representativeness follows automatically. | Classification, Code, GeographicEntity; ALL with bins | C/N |
| H06 | Balanced ↔ Unbalanced | Specified category proportions meet / fail an explicit balance criterion. Balance need not mean equal shares. | Classification, Code | C |

## 21 — Reconciliation and change between extracts

| ID | Predicates | Definition | Semantic applicability | Types |
|---|---|---|---|---|
| Z01 | Shared key; Source-only key; Target-only key | A key in the union of compared extracts occurs in both, source only, or target only. Align population filters and extraction times. | KEY | C |
| Z02 | Unchanged record ↔ Changed record | Among unambiguously matched keys, selected attributes agree / disagree across extracts. | ALL | C tuple |
| Z03 | Reconciled measure ↔ Unreconciled measure | A chosen count, total or statistic agrees / disagrees across aligned extracts within tolerance. | ALL for counts; NUM for arithmetic | A/N |
| Z04 | Multiplicity preserved ↔ Multiplicity changed | Occurrence count of a compared key or record projection agrees / differs between extracts. | ALL | C |
| Z05 | New domain value ↔ Previously observed domain value | A current value is absent / present in the chosen historical reference population. | ALL | C |

## 22 — Hierarchies and graph structure

| ID | Predicates | Definition | Semantic applicability | Types |
|---|---|---|---|---|
| Y01 | Root ↔ Non-root | Node has no declared parent assignment / at least one; missing referenced parents remain K03. | Identifier, ReferenceKey, Classification | C |
| Y02 | Leaf ↔ Non-leaf | Node has no observed children / at least one. | Identifier, ReferenceKey, Classification | C |
| Y03 | Connected ↔ Isolated | Node has at least one incident edge / none in the specified graph; declares whether self-loops count. | Identifier, ReferenceKey | C |
| Y04 | On a cycle ↔ Not on a cycle | Node participates / does not participate in a cycle under the declared directed/undirected graph definition. | Identifier, ReferenceKey | C |
| Y05 | Reachable ↔ Unreachable | Node has / lacks an allowed path from a specified source/root set in the available graph. | Identifier, ReferenceKey | C |
| Y06 | Self-reference ↔ No self-reference | A non-null referenced node identifier equals / differs from the subject's own identifier. | Identifier, ReferenceKey | C pair |
| Y07 | Depth within bounds ↔ Depth outside bounds | Defined node depth lies / does not lie inside a chosen interval. Root set, path convention and cycle treatment must be specified. | Identifier, ReferenceKey, Classification | C graph |

## 23 — Structured payloads

| ID | Predicates | Definition | Semantic applicability | Types |
|---|---|---|---|---|
| J01 | Document syntax valid ↔ Document syntax invalid | Payload parses / fails to parse under the selected JSON/XML/other syntax. Native validated storage may make the negative member unreachable. | StructuredDocument | J/T/B |
| J02 | Path present ↔ Path absent | A selected path exists / does not exist in a parsed document. A present JSON null is not an absent path. | StructuredDocument | J |
| J03 | Expected node type ↔ Unexpected node type | Existing node has / lacks the expected scalar/object/array/etc. type. | StructuredDocument | J |
| J04 | Document contract conforming ↔ Document contract nonconforming | Parsed document meets / fails declared required paths, types and other structural constraints. | StructuredDocument | J/M |
| J05 | Collection size within bounds ↔ Collection size outside bounds | Parsed array/collection member count lies / does not lie in a specified interval. | StructuredDocument | J |
| J06 | JSON null ↔ Non-null JSON node | An existing parsed JSON node is the JSON null literal / another value. | StructuredDocument | J |

## 24 — Provenance and verification facts

| ID | Predicates | Definition | Semantic applicability | Types |
|---|---|---|---|---|
| W01 | Verification recorded ↔ No verification recorded | Qualifying verification evidence is / is not attached to a data subject for a named rule and scope. This says nothing about whether verification passed. | ALL | M/C |
| W02 | Approved provenance ↔ Unapproved provenance | Known source belongs / does not belong to a declared approved-source set. Unknown source is handled by P02. | ALL | M/C |
| W03 | Evidence agrees ↔ Evidence conflicts | Available independent records agree / disagree on the specified assertion under a defined reconciliation rule. | ALL | M/C |

These apply to provenance or audit facts in the data. An investigation's own reviewed/unreviewed status stays in its workflow record; it is not automatically a predicate about the database value. “Trusted” and “suspect” are not intrinsic properties inferred from formatting.

## 25 — Schema and metadata predicates (imported profile)

| ID | Predicates | Definition | Semantic applicability | Types |
|---|---|---|---|---|
| SC01 | Expected object present ↔ Expected object absent | Expected table/column/constraint exists / does not exist in the imported metadata inventory. | ALL | M |
| SC02 | Declared type matches ↔ Declared type differs | Imported datatype agrees / disagrees with the selected expected type. Separate from V02's content conversion. | ALL | M |
| SC03 | Declared nullability matches ↔ Declared nullability differs | Imported nullability agrees / disagrees with the expected declaration. | ALL | M |
| SC04 | Required constraint declared ↔ Required constraint undeclared | Required key/reference/check constraint appears / does not appear in supplied metadata. Declaration does not prove enablement or historical validation. | ALL | M |
| SC05 | Constraint enabled ↔ Constraint disabled | A known constraint's imported enablement status is enabled / disabled. Missing status is indeterminate. | ALL | M |
| SC06 | Constraint validated ↔ Constraint not validated | A known constraint's imported validation status indicates validation / nonvalidation. | ALL | M |
| SC07 | Structure unchanged ↔ Structure changed | Selected metadata properties agree / disagree between aligned schema snapshots. | ALL | M |

This family consumes the supplied pre-profiled schema. It does not introduce a requirement for the application to re-profile it.

## 26 — Logical and conditional composition

| ID | Predicates | Definition | Semantic applicability | Types |
|---|---|---|---|---|
| LC01 | All component predicates hold ↔ At least one fails | On a common population with determinate components, every selected predicate is true / at least one is false. | ALL | Component dependent |
| LC02 | At least one component holds ↔ None holds | At least one selected predicate is true / all are false. | ALL | Component dependent |
| LC03 | Exactly one component holds ↔ Not exactly one holds | Exactly one selected predicate is true / zero or more than one are true. | ALL | Component dependent |
| LC04 | Conditional rule satisfied ↔ Conditional rule violated | Among subjects where condition P is true, Q is true / false. Subjects where P is false are outside this investigation's population. | ALL | Component dependent |

Composition is finite per investigation but extensible. It supplies a precise home for additional business-specific predicates without pretending the named catalogue covers every possible rule.

## Disposition of the original lists

This crosswalk covers every name in the 26 original families. A name can be retained, narrowed, merged as an alias, represented through a parameterized definition, or excluded as an ungrounded claim. No original family is silently dropped. Original casing is normalized below.

| Original family | Original names → disposition |
|---|---|
| Existence | Null/NonNull → P01; Missing/Present → P02; Empty/NonEmpty → P06 for payloads, P01 for zero-length ordinary Oracle strings; DefaultValue/NonDefaultValue → P04. |
| Cardinality | Unique/Duplicate/Singleton/MultiOccurrence → U01; Distinct/NonDistinct → retired as row-predicate labels: DISTINCT is a projection operation, while repetition is U01 and population cardinality is U06. |
| Completeness | FullyPopulated/PartiallyPopulated → C02, expanded with All missing; Sparse/Dense → C04 with an explicit threshold, not free-floating labels. |
| TypeConformance | TypeValid/TypeInvalid → SC02 for declarations or V02 for content interpretation, depending on intended meaning; Parseable/Unparseable → V01; Castable/Uncastable → V02. |
| Format | WellFormed/Malformed → V04; Standardized/NonStandardized → V05; PatternMatch/PatternMismatch → F01; FixedLength/VariableLength → F04 as a population observation; ExpectedLength/UnexpectedLength → F02; Trimmed/Untrimmed → X17; EncodedCorrectly/EncodingError → V06, narrowed to detectable decoding validity; ValidCharacterSet/InvalidCharacterSet → F06. |
| ReferenceIntegrity | InReferenceSet/NotInReferenceSet → K01; Referenced/Unreferenced/HasChild/NoChild → K02; HasParent/MissingParent → K03; Mapped/Unmapped → K07; CurrentReference/DeprecatedReference → K05/K06, separated because effective dating and deprecation are different axes. |
| Relationships | OneToOne/OneToMany/ManyToOne/ManyToMany → L01; Orphan → K03; Connected/Isolated → Y03; ReferentiallyConsistent → L04 or a named combination of K01/K04/K05. |
| Sign | Positive/Negative/Zero → N01. |
| Range | WithinRange/OutsideRange → R02; LowerBound/UpperBound → R03 when selecting boundary-valued rows, otherwise parameters rather than predicates; BelowMinimum/AboveMaximum → R01 with supplied limits, not claims about exceeding an observed minimum/maximum. |
| Distribution | Common/Rare/Frequent/Infrequent → S01 aliases; Typical/Outlier → S03; HighVariance/LowVariance → S04 with a defined statistic and threshold. |
| NumericProperties | Integer/Decimal → N02, renamed Integral/Fractional; Rounded/Truncated → N07/N08 only as consistency with an available source; Even/Odd → N03; PrecisionLoss → V03 or N05, depending on conversion versus representability. |
| DateValidity | ValidDate/InvalidDate/ImpossibleDate → D01; AmbiguousDate → D02; PartialDate → D03. |
| TemporalPosition | Past/Present/Future → T01 with a fixed as-of instant, or T03 for a present period; Historical/Current/Prospective → E02 for effective periods, B05 for version succession. Ambiguous labels are not standalone definitions. |
| TemporalRules | BeforeCutoff/AfterCutoff/BeforeReferenceDate/AfterReferenceDate → T01, with equality explicitly included as a third member; WithinPeriod/OutsidePeriod → T03. |
| CharacterComposition | Alphabetic → X01; Numeric → X02 (Digit-only text); Alphanumeric → X03; SpecialCharacter → F06 with a declared repertoire; ASCII → X04; Unicode → not an opposite to ASCII, use X04 for non-ASCII content or V06 for decoding; MixedCharacterSet → X05 if mixed scripts are intended, otherwise F06/V06. |
| Case | Uppercase/Lowercase/MixedCase → X07, expanded with No cased letters; ProperCase → X08. |
| Whitespace | LeadingWhitespace → X09; TrailingWhitespace → X10; InternalWhitespace → X11; WhitespaceFree → X12. |
| Content | ContainsToken/MissingToken/KeywordMatch/KeywordMismatch → X13; PrefixMatch → X14; SuffixMatch → X15. |
| CategoryMembership | CategoryA/CategoryB/CategoryC → parameterized M01 or A05; OtherCategory → complement of a selected category/set; Uncategorized → A01. Placeholder category names are removed from the reusable catalogue. |
| ClassificationQuality | Classified/Unclassified → A01; AmbiguousClassification → A03; MultiClassified → A02; ambiguity is not the same as legitimate multiple assignments. |
| DataQuality | Valid/Invalid → a named B01 rule, never unqualified; Trusted/Untrusted → W02 only when approved provenance is intended, otherwise explicit business policy; Verified/Unverified → W01 when evidence is a data fact, otherwise workflow; Consistent/Inconsistent → specified Q01/Q03/Q05; Conflicting → Q06/W03; Suspect → not intrinsic, requires a named flagging rule B01. |
| GeographicValidity | ValidLocation/InvalidLocation → selected G01/G02/G07 or their composition; KnownLocation/UnknownLocation → G02; Mappable/Unmappable → G03. |
| GeographicClassification | Urban/Rural → G06 with identified classification scheme; Domestic/Foreign → G05; CurrentBoundary/HistoricalBoundary → G08 for applicability or E02 for effective dating. |
| BusinessRules | RuleCompliant/RuleViolation → B01; Active/Inactive → B02; Current/Historical → B05 or E02 according to meaning; Authorized/Unauthorized → B04; Eligible/Ineligible → B03. |
| InformationContent | HighEntropy/LowEntropy → S07 with explicit bounds; Predictive/NonPredictive → reserved for a separately specified model-evaluation investigation with target, baseline and evaluation design, not intrinsic column predicates; Informative/Uninformative → no universal definition, use S08 for a specified association criterion or a named B01 rule. |
| Coverage | Underrepresented/Overrepresented → H05; Balanced → H06; Representative → narrowed to H05 only for measured category shares; broad population representativeness is not asserted by a column predicate. |

## Standardization references and relationship to this design

The catalogue, grouping decisions and crosswalk are this project's proposal, not a claim to reproduce a universal standard. The following primary sources provide coverage and terminology checks. Similar labels are not assumed to have identical null policies, scopes or denominators.

| Ref | Primary source | Use here |
|---|---|---|
| GX1 | [Great Expectations: uniqueness](https://docs.greatexpectations.io/docs/reference/learn/data_quality_use_cases/uniqueness/) | Terminology reference for U01–U07. |
| GX2 | [Great Expectations: integrity](https://docs.greatexpectations.io/docs/reference/learn/data_quality_use_cases/integrity/) | Coverage reference for reference, cross-table and business-rule investigations; our selection predicates remain distinct from whole-population expectations. |
| GX3 | [Great Expectations: data quality use cases](https://docs.greatexpectations.io/docs/reference/learn/data_quality_use_cases/dq_use_cases_lp/) | Coverage checklist for missingness, distribution, freshness, schema, volume and uniqueness. |
| SO1 | [SodaCL: metrics and checks](https://docs.soda.io/soda-documentation/soda-v3/sodacl-reference/metrics-and-checks) | Supports distinguishing a measured statistic from a criterion; used for families 19–21 and count-based predicates. |
| SH1 | [W3C SHACL](https://www.w3.org/TR/shacl/) | Constraint vocabulary precedent, including datatype, cardinality, ranges, patterns, membership and logical composition. This is not an RDF/SHACL implementation claim. |
| O1 | [Oracle 19c SQL reference: nulls](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Nulls.html) | Oracle empty-character and three-valued comparison semantics. |
| O2 | [Oracle 19c SQL reference: analytic functions](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Analytic-Functions.html) | Context for the supplied per-row partition-count uniqueness pattern and the need to state comparison/ordering rules. |

No SQL templates have been generated in this enumeration. The enumerated identities, labels, definitions, family membership and applicability are frozen as release 1.0.0. Changes to those meanings require a new catalogue version; adding graph relationships or Oracle SQL does not itself alter the frozen enumeration. Specialized entries such as spatial validation, structured payloads, statistical comparisons and evidence-based predicates are included explicitly; their applicability depends on the available columns, metadata and Oracle capabilities rather than being assumed for every imported column.
