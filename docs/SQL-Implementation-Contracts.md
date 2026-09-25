# SQL implementation contracts — final authoring phase

Catalogue 1.0.0 remains frozen. These are customizable Oracle 19c query templates, not instantiated database queries. Native Oracle execution is pending. Choose the documented algorithm/representation, supply the declared evidence and parameters, then validate against the target database.

The full SQL export carries batch-specific instructions for batches 01–14. The sections below explain the new variants and dependencies introduced in the final six groups.

---

# Batch 09 — presence and text

61 predicate members use five shared query bodies. `fragment.json` contains canonical bodies and mappings; `batch.sql` is their readable rendering. `build.py` regenerates these two outputs. The existing standalone library and graph package were not modified.

All input text expressions are scalar character values. Oracle empty VARCHAR2 strings are NULL; neither text branch selects them. The default retains CHAR padding and does not perform normalization. `population_condition` defines the row population, including a particular group when needed. Source queries preserve duplicates. C02/C04/F04 return a single summary row when their population-level property holds. Empty populations produce no classification.

## Declared rules

P02 uses an explicit semantic missingness condition. For example, `t.v IS NULL OR TRIM(t.v) IS NULL OR t.v IN ('N/A','UNKNOWN')` classifies nulls, ASCII-space-only strings and two sentinels as missing. Other whitespace or sentinel conventions must be selected explicitly. `NOT(condition)` preserves UNKNOWN; it is never replaced with ELSE false.

C01 requires a conjunction of the declared required fields' semantic-present expressions. Example: `NOT (t.a IS NULL OR t.b IS NULL)` for null-only missingness. C03 first restricts to rows whose requirement condition is TRUE and then applies the same missingness rule to both members. C05 directly expresses the selected combination: at-least-one, both-or-neither, exactly-one, and so on. Its parameter is the actual SQL field-presence expression, not a preclassified external flag. Examples are in the SQL usage notes.

C02/C04 count both TRUE and FALSE outcomes for missingness. They require their sum to equal the row count, so an unknown rule result cannot be miscounted. The fraction uses NULLIF in the denominator. A group with any unknown result remains unclassified; this is a conservative input contract. Thresholds must be in [0,1]. C02 partly populated requires both a present and missing row. F04 excludes NULL values before counting distinct measured lengths; an all-null scope has no length classification.

## Character contracts and variants

Regex member parameters contain bracket-class contents, correctly escaped, expressed as SQL strings. Concrete default alphabets and whitespace sets are in `batch.sql`. Letter/digit/alphanumeric and upper/lower categories use explicitly chosen repertoires. The portable fixtures use enumerated ASCII alphabets. Case classification requires upper/lower sets to be disjoint; every nonempty string receives one of the four categories under those sets. Language alphabets can be supplied explicitly; arbitrary Unicode titlecase characters are not silently treated as upper/lower.

F01 has explicit full-string versus substring modes and accepts only `c`, `i`, `cn`, or `in` flags. Full mode anchors the entire expression. No multiline flag is allowed. Missing patterns are excluded; malformed patterns and expressions beyond Oracle's 512-byte pattern limit are configuration errors, not mismatching data.

X08's concrete title convention is `[A-Z][a-z]*([ ][A-Z][a-z]*)*`: ASCII words with uppercase initials and single intervening spaces. It is not a correctness test for personal names. Supply another complete convention where required.

X13 constructs boundaries from a declared token-character repertoire. Its token parameter must be a regex-escaped literal, and its flag is explicitly `c` or `i`. It deliberately does not use a database-specific word-boundary shorthand. X14–X16 use literal INSTR/SUBSTR operations, so `_` and `%` are ordinary characters. X15 includes `LENGTH(value) >= LENGTH(sequence)` within its complemented positive condition. A longer sequence therefore yields FALSE for suffix match and TRUE for mismatch even when Oracle SUBSTR returns NULL for the out-of-range start. Literal comparisons use the selected binary collation; a linguistic alternative must be documented. Prefix/suffix/substring do not case-fold implicitly.

X04 detects ASCIISTR expansion using lengths, so a literal backslash and hexadecimal digits cannot cause a false non-ASCII classification. ASCIISTR is a scalar operation: its expanded return value must fit the configured Oracle NVARCHAR2/string limits. Very long values need chunked evaluation or a character-level adapter before using this variant; this batch does not claim CLOB-wide ASCII scanning. Other regex predicates use their documented scalar VARCHAR2/NVARCHAR2 contract. Length measurement is explicitly LENGTH, LENGTHB, or LENGTH4; byte results depend on the database encoding. Inclusive length bounds must be nonnegative integers.

Use `NLS_COMP=BINARY`, `NLS_SORT=BINARY` and binary source collation for the supplied ASCII/literal variants. REGEXP_LIKE `c` explicitly selects case/accent sensitivity. POSIX classes, ranges under alternative collations, NVARCHAR2 behavior and database-encoding byte lengths require Oracle execution before production use.

## Verification

`python check_batch.py` executes every member's rendered SQL using SQLite with documented scalar emulation. The fixtures cover null text, spaces, tabs/newlines, uppercase/lowercase/mixed/no cased letters, non-ASCII characters and supplementary Unicode, controls, literal regex-like characters, literal backslash sequences, token boundaries, leading/trailing/internal whitespace, null requirements, duplicate source rows, population emptiness, unknown missingness and invalid thresholds/bounds. It separately checks rendered fingerprints and assignment/export completeness.

The regex emulator uses Python `re` with ASCII fixture repertoires and adjusts `$` to Oracle's full-string end semantics. It is not a POSIX/Oracle equivalence proof. LENGTHB is emulated with UTF-8. TRIM's empty result is normalized to Oracle NULL. Two-argument SUBSTR emulation returns NULL for an out-of-range starting position; the previous SQLite clamping behavior hid a suffix mismatch defect corrected during independent review. There is no Oracle connection and no native Oracle syntax, optimizer, collation or encoding execution claim. Independent review completed in review.json; native Oracle validation remains outstanding.

## Oracle references

- [Pattern-matching conditions, Oracle 19c](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Pattern-matching-Conditions.html): regex flags, full-string anchors, collation and pattern limits.
- [ASCIISTR, Oracle 19c](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/ASCIISTR.html): ASCII representation and non-ASCII escapes.
- [LENGTH, Oracle 19c](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/LENGTH.html): character, byte and code-point variants.
- [REGEXP_INSTR, Oracle 19c](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/REGEXP_INSTR.html): related regex position semantics, considered during authoring.

- [SUBSTR, Oracle 19c](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/SUBSTR.html): negative positions count backward; character and returned datatype semantics.


---

# Batch 10: numeric, interval and statistical predicates

66 frozen predicates are implemented by 13 new Oracle 19c templates. These are concrete supported variants of the supplied definitions, not implementations of every possible statistical method. The original author was `/root/author_numeric_statistics`; `/root/finish_review10` completed the missing notes and tests, reviewed the original mappings, and remediated one portable test issue. Parent review is required for that reviewer's remediation itself.

## Reproduction and evidence

Run `python build_fragment.py`, then `python check_batch.py` in this directory. The builder writes `fragment.json` and all 66 marked queries in `batch.sql`. The check harness executes the rendered queries with fixture parameters and verifies all stored digests and parameter sets. `test-results.json` records every check and exact predicate coverage. 209 fixture assertions and 66 structural checks pass: 19 predicates use portable SQLite syntax, 47 require the explicitly listed Oracle function emulations. All 66 have execution evidence in that portable environment; none has native Oracle execution evidence. Numeric instants exercise interval logic only; Oracle date, timestamp, timezone, collation, numeric precision and optimizer behavior remain untested.

## Invocation contract

Operational tokens are trusted SQL expressions/identifiers, not string interpolation from arbitrary input. Identifiers require caller validation and quoting. Values should use typed binds wherever the deployment renderer supports them. Every expression must itself be safe and deterministic; these templates cannot make an unsafe caller expression safe. `population_scope_condition` chooses one complete population, with `1=1` as an example. Complementary predicates must use identical scope, parameters and data snapshot.

`value_expression`, coordinates, category expressions and interval fields normally use source alias `t`; baseline expressions use `b`; aligned extracts use `l` and `r`. `source_value` in N07/N08 instead addresses the already projected source row as `p.source_column`. Source relations must not contain conflicting `profile_*` helper names. Multi-column category lists must expose distinct column names.

All numeric operational parameters must be finite, prepared Oracle NUMBER values; counts/sample minima should be nonnegative integers. Missing or invalid guarded parameters do not classify rows into a negative branch. Arithmetic and aggregate values use NUMBER semantics and support absolute values at most `1e60`. For binary floating inputs, the caller must declare and perform upstream normalization to NUMBER semantics; binary-to-decimal precision loss or underflow is not a claim of these variants. The outer finite classifiers still explicitly handle Infinity and NaN, and the guards safely suppress missing/nonfinite/out-of-envelope values. This is deliberately more restrictive than the floating classification/sign/extreme variants.

NUMBER arithmetic is still finite precision. Near numerical boundaries, numerical precision and aggregate accumulation limits must be checked on Oracle with production-scale data. The `1e60` operand bound keeps elementary products/squares well below NUMBER's exponent limit; it is not a proof of arbitrarily large aggregate accumulation safety. Inputs with extreme dynamic range need an explicitly scaled statistical variant. No native performance or numerical stability certification is implied.

## Definitions, algorithms and output grain

| Predicates | Concrete implementation and policy |
| --- | --- |
| N01 | Negative / zero / positive, excluding NULL, infinity and NaN. Source-row grain. |
| N02 | Integral if value equals its truncation toward zero. Decimal storage does not determine integrality. |
| N03 | Integral eligibility, then MOD(value,2) zero / nonzero. Negative odd numbers qualify. |
| N04 | Zero-origin grid: distance to ROUND(value/increment)*increment is at most absolute grid tolerance. Positive increment in [1e-60,1e60]; tolerance [0,1e60]. Off-grid is the strict complement on eligible values. |
| N05 | Precision p in [1,38], integer scale s in [-84,127]: rounded magnitude must be below 10^(p-s), and absolute rounding change must not exceed rounding_tolerance. Zero tolerance means no allowed change. Carry across the magnitude limit fails, including negative scales. No historical rounding inference. |
| N06 | Native IS NAN / IS INFINITE / neither; excludes NULL and includes either signed infinity. |
| N07/N08 | Exact equality to ROUND/TRUNC of available source at declared scale, using NUMBER semantics. Source NULL/nonfinite does not become inconsistent evidence. |
| R02/T03 | Explicit lower/upper inclusion flags in {0,1}. Bounds may coincide; this allows an empty interval unless both endpoints are included. Invalid order or missing bounds excludes both branches. |
| R03 | Strictly distinct bounds: lower / interior / upper / outside. |
| R04/R05 | Finite population minimum / maximum; all tied source rows retained. Missing/nonfinite members are excluded from this declared eligible population. |
| R06 | Absolute scalar distance from a supplied available reference; inclusive nonnegative tolerance. |
| E02 | Valid half-open [start,end) at an as-of instant: expired at/after end, effective inside, future before start. NULL endpoints act as infinities only when their matching open flag is 1. Equal/reversed finite endpoints are invalid. |
| G01 | Inclusive rectangle under caller-declared CRS and axis order; e.g. longitude [-180,180], latitude [-90,90]. No polygon/topological geometry validity claim. |
| H01/H02 | COUNT(*) on selected relation, returning a single summary when the count satisfies its branch, including zero. Groups with no observed rows require invocation from an explicit group domain. |
| S01/S02 | One output per observed category tuple; count/share threshold and all tied modes. NULL handling is declared by category_nonnull_condition; normally exclude incomplete category tuples. |
| S03 | Absolute z-score based on selected population AVG and STDDEV_POP; inclusive z_limit. Minimum sample at least 2 and SD strictly positive. Zero variance is undefined for this chosen rule; neither branch returns rows. Output preserves selected source-row multiplicity. |
| S04 | STDDEV_POP within/outside an inclusive nonnegative interval; minimum sample at least 1. A constant population has defined SD zero. One summary row. |
| Q04/Z03 | SUM(left) and SUM(right) within absolute difference_tolerance. Both extracts must be available and aligned by caller-defined scopes/units. A control value can be a one-row right relation; set minimum_sample_size=1 in that case. Missing or empty sums are undefined. No row-by-row reconciliation claim. |
| S05 | Categorical total-variation distance: half the sum of absolute differences between empirical shares and normalized nonnegative baseline weights. Uses the union of observed and baseline categories. Repeated baseline categories add their weights. Total baseline weight must be positive. Limit lies in [0,1]; equality is compatible. |
| S06 | Absolute difference of AVG across two explicitly aligned populations/periods. Equality at tolerance passes. Different row counts are allowed; matching of periods/entities is the scope contract, not an inferred key join. |
| S07 | Shannon entropy -sum(p*ln(p))/ln(base), base >1; category tuples or caller-prepared bin identifiers. Empty population is undefined; one category has zero entropy. Inclusive declared interval. |
| S08 | Absolute Pearson CORR coefficient at least association_threshold in [0,1]. Minimum sample at least 2, complete pairs, positive variance in both variables. Both positive and negative associations qualify by magnitude. No causal/predictive assertion. |
| H05 | One row per declared category with observed share below / inside / above clipped [baseline_share-allowance,baseline_share+allowance]. A declared but unobserved category receives zero share. |
| H06 | One summary for whether every declared category lies inside its H05 interval. Unequal expected shares can be balanced. |

S03/S04/S06/S08/Q04/Z03 require every selected numeric observation to be present, finite and inside the declared arithmetic envelope. They count selected rows separately from valid values so an invalid row cannot silently shrink the population. Categorical variants exclude missing category observations from the eligible population. H05/H06 require a unique, nonempty, exhaustive baseline domain; shares/allowances in [0,1]; shares sum to one within baseline_sum_tolerance; no unexpected observed category. Violating those conditions makes the population unevaluable, not unbalanced. S05 instead intentionally includes unexpected categories through its union.

All scalar source-row queries retain duplicate rows. Category outputs and population summaries are deliberately grouped. Every complementary pair uses the same evidence and excludes SQL UNKNOWN from both sides.

## Safety and remediation notes

Conversions, rounding and grid arithmetic occur inside guarded CASE expressions. Variable denominators use NULLIF; the entropy logarithm receives only a guarded positive base. No WHERE evaluation order is assumed to suppress a division or conversion error. Typed DATE/TIMESTAMP operands must already share the intended ordering/timezone semantics. Numeric interval operands are finite prepared NUMBER values.

The interrupted author's first test run failed S05 even for identical distributions because SQLite integer-divided the baseline weight ratio. Adding `1.0 *` to that numerator makes the intended fractional operation explicit; Oracle NUMBER division already had fractional behavior. This changed only the S05 template body and its two rendered fingerprints. Fifty additional independent-review fixtures cover signed infinity, midpoint rounding, negative scales, fractional grids, one-row controls, equal means with differing sums, nonuniform balance, duplicate/null baselines, empty statistical populations, actual SD and tuple categories.

## Oracle primary references checked

- [Floating-point conditions](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Floating-Point-Conditions.html): native finite/nonfinite tests apply to numeric expressions.
- [ROUND(number)](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/ROUND-number.html): NUMBER rounding, negative scales, and differing binary representations.
- [STDDEV_POP](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/STDDEV_POP.html): population dispersion and NULL behavior.
- [CORR](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/CORR.html): Pearson coefficient on nonmissing pairs.
- [CASE expressions](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/CASE-Expressions.html): guarded expressions and short-circuit branches.

These references support static semantic review; they do not replace execution on Oracle 19c.


---

# Batch 11 — temporal and reference operations

52 predicate members; four new shared bodies plus the existing `oracle.scalar_equality`. The shared filters contain concrete operations in their mappings, including component null tests, interval comparisons and arithmetic. No precomputed pass/fail flags stand in for sequence calculations. `build.py` reproducibly renders the fragment and batch. `check_batch.py` executes all 52 rendered statements against SQLite fixtures, with explicit temporal emulation limits in `test-results.json`.

## Parameters and grain

`{{...}}` substitutions are SQL identifiers, typed expressions or complete declared scopes, supplied by trusted authoring code. Bind ordinary scalar values. Avoid implicit text-to-date conversions. `schema_name`/`table_name` are the source relation; `t` is its alias. Reserve output names beginning `profile_`.

Ordinary filters preserve source rows. Analytic outputs preserve source rows and append diagnostic position/predecessor columns. Matched reference operations output **subject/reference-record pairs**, adding `profile_reference_record_id`. The reference identifier must uniquely identify each actual reference version (it may be a prepared surrogate over a composite version key). Multiple references are deliberately retained; a subject can be effective for one version and ineffective for another. This does not assert a unique subject classification. Subject-grain answers require prior reference resolution or an explicitly chosen quantifier. Unmatched subjects are outside K05/K06/G08/T04; K01 handles unmatched keys.

Every complementary branch must receive identical scope, calendar/release, timezone, reference sets and parameters. SQL UNKNOWN remains outside two-way comparisons. Empty populations produce no rows. Source duplication is preserved; reference duplication produces multiple pairs.

## Direct comparisons and component supply

R01/T01/T02/T06/E01/Q02 reuse the scalar comparison body. `column_name` is the value, event time, start endpoint or column A respectively. The other operand is a typed scalar reference, frozen cutoff, deadline column, end column or column B. Both missing value and missing reference naturally fail all branches. Record-level deadline lookup must already be resolved; the SQL never silently chooses one of several deadlines.

D03 supplies six expression slots for year, month, day, hour, minute and second. At day granularity bind the final three to nonnull `1`; at month granularity bind day and time slots to `1`. Required values of zero remain supplied. Fractional seconds are part of the second component. The operation tests supply, not validity. For another component system, fill the six slots with its required components; systems requiring more than six independent components need an expanded presence expression mapping. A compound date can be treated as one supplied component when that is the declared representation; this must not conceal missing subcomponents in a decomposed representation.

D05 tests preserved original timezone evidence. Bind a source timezone column, explicitly extracted timezone token, or metadata identifying the representation's zone. Do not bind `SESSIONTIMEZONE` merely because Oracle always has a session timezone. A supplied but invalid zone is specified and belongs in a separate validity check. Oracle empty strings count as null; SQLite fixtures intentionally do not claim to test this Oracle-specific behavior.

D04 uses `value = TRUNC(CAST(value AS DATE), format)` versus `<>`. Supported granularity tokens are Oracle datetime TRUNC units such as `'DD'`, `'HH24'`, `'MI'`, `'MM'`, `'YYYY'`. The left operand retains TIMESTAMP fractions, so a fractional second cannot disappear through the cast and falsely satisfy midnight alignment. The explicit cast on the right makes the baseline DATE overload clear. Use DATE or a timezone-normalized TIMESTAMP column; do not pass TIMESTAMP WITH TIME ZONE directly and permit implicit session-zone conversion. This variant does not implement arbitrary 15-minute bins or textual granularity labels; such cases require a declared rounding grid and a specific computed boundary expression.

## Ordering, immediate predecessors and current versions

`entity_columns` is the tuple of entity key expressions (`t.key1, t.key2`). `total_order` must specify deterministic ascending chronological/sequence precedence and end with an immutable unique row tie-breaker, for example `t.event_ts ASC, t.event_id ASC`. `reverse_total_order` reverses **each** direction and null precedence. Both inputs must describe the same order. No concatenated composite keys, unstable ROWID tie-breakers, or ties left to execution plans.

`chain_scope_condition` defines the complete relevant chain. `entity_and_order_known_condition` requires known entity key components and ordering evidence, e.g. `t.entity_id IS NOT NULL AND t.event_ts IS NOT NULL AND t.event_id IS NOT NULL`. Missing ordering evidence means that the intended full chain cannot be reconstructed. The caller must therefore resolve that evidence or explicitly declare the evaluable subchain as its population; these queries cannot certify adjacency across unknown-order rows in the original chain.

The analytic subquery keeps rows whose *measured value* is null or invalid. `LAG` uses its default respect-null behavior. E06/E07/E11 require both current and immediate predecessor values; the first row and the row after a missing value are excluded. E06 accepts a typed numeric `required_increment` (including zero or a negative increment if the domain declares one); null increment classifies neither branch.

E05 obtains the preceding end and validity from `LAG`. Both current and immediately preceding intervals must be valid. It does not skip reversed or missing intervals to fabricate a predecessor. Current start equal to preceding end is contiguous; either gap or overlap is noncontiguous. This is **adjacent-row succession**, not a computation of union coverage when nested intervals are present.

E08 matches `(previous_state,current_state)` against the scoped transition relation. Duplicate allowed rows do not multiply results. Both states must be supplied and interpreted labels; unknown/raw placeholder labels must be normalized to null while preserving the row's chain position. `transition_reference_known_condition` supplies a real reference-coverage predicate on the output alias `p` (for example `p.transition_release_loaded = 1` or an EXISTS lookup of complete release metadata). FALSE or UNKNOWN excludes that row from both classifications. This guard stays outside the analytic subquery so unknown coverage does not fabricate adjacency by removing source rows. Supply `1 = 1` only when completeness is guaranteed externally. A deliberately complete empty allowed relation forbids every known state pair. Reference member scopes and allowed state pairs must be interpreted, with unknown row-level reference metadata resolved before declaring completeness.

E09/E10 compute first/latest with `ROW_NUMBER`. B05 applies the fixed-as-of scope **before** ranking, so scheduled future revisions cannot supersede the current eligible revision. `current_revision_order` is authoritative descending precedence plus deterministic tie-breaker, e.g. `t.revision_number DESC, t.version_id DESC`; the complete version chain and this precedence rule are inputs. A chain containing only future revisions produces no current/superseded rows. This is the latest eligible revision policy, not an additional validity-expiry policy. A domain in which expiry removes a version from current eligibility needs that policy explicitly added to the declared chain scope.

## Intervals, reference validity and calendars

E04's supported boundary convention is nonempty half-open intervals `[start,end)`: valid endpoints satisfy `start < end`, overlap is `a.start < b.end AND b.start < a.end`, and touching boundaries do not overlap. A closed-interval variant changes validity to `<=`, overlap to `<=` at both ends and nonoverlap to strict `>`. Update both mapped branches together if adopting that alternate convention; empty half-open intervals remain outside this batch's eligible population.

K05/G08 use explicit known half-open validity bounds, again excluding missing, reversed and empty periods. A null valid-to field is **not silently interpreted as infinity**. If null denotes open-ended validity in the source model, provide a typed canonical view or a separately declared open-bound variant. G08 additionally applies the known `reference_use_condition` on t/r; unknown use evidence is outside both branches, even when the date alone would suggest inapplicability.

K06's approved/deprecated query results expose `member_value` and must be disjoint. Other is any other supplied interpreted lifecycle status. Missing statuses remain unclassified. Reference scope must fix the release/system being investigated.

T04 requires a nonnull `calendar_value_column`, matched to a complete declared calendar relation using `reference_match_condition`, e.g. `TRUNC(t.event_local_date) = r.calendar_date AND r.calendar_id = :calendar_id`. `calendar_class_column` contains the interpreted class (weekday number, month, fiscal period or business-day class); `selected_calendar_class_query` exposes chosen `member_value` values. The normal contract is one row per calendar date and calendar identity, with an actual foreign key/unique constraint or a validation query. Missing calendar rows/class values are unknown. For multi-label calendars, pair-grain output is retained: a date in both holiday and weekend classes can appear in both branches across distinct class records. To classify the date itself, use a one-row-per-date calendar class or an explicitly quantified category query.

## Fixed evaluation time, precision and duration variants

Capture fixed_as_of/fixed_cutoff once for the whole run. Normalize both operands to a declared zone and compatible type before comparison. Instants normally use UTC; civil-calendar membership and midnight granularity require the declared local calendar zone. Oracle DATE is timezone-naive with whole-second precision; TIMESTAMP can carry fractions; TIMESTAMP WITH LOCAL TIME ZONE depends on session display context. Do not cast to DATE when fractional seconds matter to a threshold.

The canonical T05/T07 variant uses DATE endpoints and NUMBER `allowance_days`; DATE subtraction returns fractional days. Eligibility excludes future/negative age, reversed latency, null endpoints and negative/missing allowances. Equality is within allowance. For an elapsed duration of three hours supply `3/24`; whole seconds use `seconds/86400`.

For fractional-second TIMESTAMP duration, the following concrete variant uses typed interval comparison. It requires both endpoints to be TIMESTAMP values already normalized to the same zone (or consistently typed timezone-bearing instants) and a nonnegative NUMBER allowance_seconds. Replace `<=` with `>` for the complementary branch:

```sql
SELECT t.*
FROM {{schema_name}}.{{table_name}} t
WHERE t.{{start_column}} IS NOT NULL
  AND t.{{end_column}} IS NOT NULL
  AND t.{{end_column}} >= t.{{start_column}}
  AND {{allowance_seconds}} >= 0
  AND (t.{{end_column}} - t.{{start_column}})
      <= NUMTODSINTERVAL({{allowance_seconds}}, 'SECOND');
```

Freshness substitutes the fixed as-of instant for the end expression. Do not mix DATE subtraction's NUMBER result with this INTERVAL limit. This documented variant has not been executed locally or registered as another canonical body; the catalogue mappings explicitly select the DATE-days variant. Very large values must remain within the database's DATE/INTERVAL numeric range.

## Validation evidence and Oracle references

`check_batch.py` currently passes 152 checks across all 52 members. It checks equal boundaries, duplicate source/reference cases, nulls, unknown increments, empty sources, invalid allowances, predecessor null preservation, first rows, deterministic tied sort values, reversed intervals, scheduled future versions, known/unknown reference validity, use, and lifecycle sets. SQLite executes the rendered SQL after only operational substitution. D04's registered TRUNC and numeric day fixtures emulate midnight boundaries; T05/T07 use numeric subtraction to emulate DATE days. They do not validate Oracle temporal overloads, timezone transformations or formats beyond DD. All Oracle executions remain pending.

Primary Oracle 19c references:

- [ROW_NUMBER](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/ROW_NUMBER.html): deterministic order and nesting for filtering.
- [LAG syntax](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/img_text/lag.html): physical predecessor and null-handling syntax.
- [SQL for analysis and reporting](https://docs.oracle.com/en/database/oracle/oracle-database/19/dwhsg/sql-analysis-reporting-data-warehouses.html): analytic evaluation and predecessor functions.
- [Datetime literals](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Literals.html): explicit DATE/TIMESTAMP values, fractions and zones.
- [Single-row functions](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/Single-Row-Functions.html): temporal function input-type distinctions.

Independent review added transition-reference availability guarding and regression coverage for composite keys, duplicate source pairs, as-of equality/unknown, future-only chains and unknown use. `review.json` records the independently checked implementation fingerprints. No graph or ZIP has been edited. Native Oracle execution remains pending.


---

# Batch 12 — conversion, representation, documents and spatial evidence

All 40 assigned members are implemented by one shared row-preserving measurement wrapper. The internal `evidence` slots contain the concrete algorithms below; they are already resolved in `batch.sql`. No operational parameter is an unspecified parsing/checksum/geometry pass flag. This wrapper count is not a claim that all operations are one algorithm.

Original source rows, including duplicates, are returned with `profile_evidence`. Reserve that output name. Bind `row_scope_condition` identically for both branches. Input expressions must be evaluable without errors; bad configuration is not bad data. SQL NULL is excluded from complementary classifications. Oracle treats empty VARCHAR2 as NULL; an initialized empty LOB is different. The native Oracle acceptance gate remains open.

## Supported variants and input contracts

| Axis | Concrete implementation | Contract and variants |
|---|---|---|
| P06 | `DBMS_LOB.GETLENGTH` | BLOB bytes or CLOB characters; null locator excluded, initialized empty locator zero. Do not apply to VARCHAR2. For JSON collections, use J05's type-checked `size()` evidence with =0/>0. |
| V01/V02 | `VALIDATE_CONVERSION(text AS NUMBER, format, NLS)` | Selected grammar/target is Oracle NUMBER; supply a legal numeric format literal such as `'999999999D999999'`. Explicit decimal dot/group comma locale; numeric format parsing is exactly Oracle's permissiveness. V01 asks grammar interpretation, V02 asks conversion; the same selected numeric case legitimately shares SQL. Missing text is excluded even though Oracle validates NULL as convertible. |
| V03 | Safe `TO_NUMBER(DEFAULT NULL ON CONVERSION ERROR)` followed by `TO_CHAR(...,'TM9',...)`, exact RAW comparison | Supported comparison is **representation information** roundtrip. `001`, padding or a leading plus may convert successfully yet lose representation. This is not a numeric-precision assertion. Parse failures are excluded. Input VARCHAR2 and reconstructed output must each fit 2000 bytes for SQL RAW. A different native source/target requires its own explicit inverse and comparison; a scalar equality flag is insufficient. |
| V04 | `REGEXP_LIKE` | Supply a non-null, valid complete semantic regex literal, e.g. `'^[0-9]{10}$'`. Case sensitive. Author must explicitly anchor the grammar and decide whitespace/newlines; invalid regex configuration raises rather than producing data failures. |
| V05 | `UPPER(TRIM(text))`, exact RAW comparison | Oracle-space trim plus Oracle uppercasing, not Unicode NFC or accent folding. VARCHAR2 <=2000 bytes before/after normalization. An all-space non-null source normalizes to SQL NULL and is noncanonical. Record database charset and case-mapping version. |
| V06 | Pairwise RAW hex bytes restricted to `00..7F` | Strict ASCII decoding, including ASCII controls; “decodes” is not “printable”. RAW source <=2000 bytes; no conversion through database text before validation. Missing RAW excluded. Non-ASCII encodings require the byte-decoder adapter below. |
| F05 | `STANDARD_HASH(raw,'SHA256')` equals available expected RAW digest | RAW payload <=2000 bytes and expected RAW SHA256 digest. No character encoding is inferred. Null payload or expected digest excluded. Digest disagreement is invalid under SHA256 only; cryptographic authenticity is a different claim. BLOB requires DBMS_CRYPTO HASH variant, appropriate privileges, and exact algorithm constants. Check digits require another specified algorithm. |
| F07 | Reject quote/CR/LF and count commas+1 | Explicit **no-quoting, single-line comma-delimited** grammar. Empty fields allowed; count is positive integral configuration. A quote anywhere is invalid, including balanced quotes, because this grammar forbids quoting. Not RFC4180 CSV. A quoting-aware parser adapter is required for that grammar. |
| X05 | Count DISTINCT script IDs whose regex occurs | Read `script_rules(script_id,character_regex)`, a complete versioned table for the selected script rules. Multiple regex rows per script allowed; duplicate rows do not inflate counts. Common/Inherited characters should be assigned according to the selected policy, ordinarily excluded. Zero script-bearing characters excluded. Supply Unicode Script/Script_Extensions-derived patterns when that is the chosen standard; block ranges alone are not an equivalent Unicode script implementation. A restricted repertoire can instead be explicitly selected. |
| D01 | `VALIDATE_CONVERSION(text AS DATE, format, English)` | Example exact format `'FXYYYY-MM-DD'`. Set session `NLS_CALENDAR='GREGORIAN'` for this variant and record it. Data is source text, not already valid native DATE. Alternative timestamp grammar can use VALIDATE_CONVERSION AS TIMESTAMP, preserving appropriate format and timezone contract. |
| D02 | Count DISTINCT successful `TO_DATE(DEFAULT NULL...)` results across permitted format rows | `date_formats(format_mask)` contains legal format models, e.g. `FXDD/MM/YYYY` and `FXMM/DD/YYYY`; format scope alias is f. Count **meanings**, not successful formats. 01/01 under both counts one; 02/03 can count two; impossible text and empty format set count zero and enter neither branch. Gregorian session, English language. This DATE variant does not model timezone/DST ambiguity. |
| G04 | Guarded SDO validity, then `SDO_GEOM.RELATE(...,'INSIDE+COVEREDBY+EQUAL',...)` | Oracle Spatial installed, execute privileges available; native resolved **2D** SDO_GEOMETRY inputs, same coordinate system/SRID, selected area a polygon. Positive tolerance in coordinate units. The selected relation accepts exactly Oracle INSIDE, COVEREDBY or EQUAL. COVEREDBY includes boundary contact with intersecting interiors; pure TOUCH and ON are excluded, including a line wholly on the polygon boundary. This is not a universal boundary-inclusive covers predicate; partial overlap/disjoint/geometry containing the selected area count outside. Invalid/unresolved geometries enter neither branch. SDO_GEOM.RELATE returns the requested **mask string** on success, not TRUE (except ANYINTERACT); SQL compares that mask. No spatial-index prerequisite for the function. |
| G07 | `SDO_GEOM.VALIDATE_GEOMETRY_WITH_CONTEXT(geom,tolerance)` | Native SDO geometry object, valid positive tolerance. TRUE means valid; returned diagnostics/FALSE mean invalid; SQL NULL and the literal string NULL (unsupported user-defined geometry) excluded. Tolerance overload does **not** validate metadata coordinate bounds; choose DIMINFO overload when that is part of the declared contract. Unsupported operation exceptions must be surfaced; do not convert every exception to “invalid”. |
| J01 | `IS JSON STRICT WITH UNIQUE KEYS` | Oracle19c text JSON documents: strict object/array syntax and unique member keys. Duplicate keys fail this explicitly selected grammar. SQL NULL excluded. XML/other formats need a separate parser adapter; JSON scalar root support must be version/grammar selected separately. |
| J02 | `JSON_EXISTS(... FALSE ON ERROR)` after parsed-document eligibility | JSON null is present. Bad document is not a missing path. Path is a trusted compile-time literal: bind `json_node_path` to text such as `$.a`, not a SQL quoted literal. |
| J03 | `JSON_VALUE(path.type())` vs expected type | Existing evaluable single node only. Expected literal must be one of `'null','boolean','number','string','object','array'`; NULL/unrecognized configuration forbidden. Type checks do not coerce numeric strings. |
| J04 | Required root object with numeric `$.id` and string `$.name` | Concrete **open document contract**: extra properties allowed; missing or wrong-type fields fail. JSON null fails both required field types. Empty name string is still a JSON string and conforms. Different contracts require resolving the SQL evidence to concrete required paths/types/constraints; this is not a general JSON Schema implementation. |
| J05 | Type-check array then `JSON_VALUE(path.size())` | Inclusive nonnegative integral min/max with min<=max. Missing paths, nonarrays, malformed docs excluded. Empty arrays have size zero. Counts members including JSON null and nested containers, not primitive descendants. |
| J06 | Type name `'null'` | JSON literal null distinguished from absent path and SQL NULL; objects and arrays are known non-null nodes. |

## Path semantics and safe evaluation

Use an exact single-node path with at most one result per eligible document. Wildcards and Oracle's implicit array unwrapping can produce multiple results even without a wildcard; prohibit such layouts in the selected path contract, or implement an explicit path-multiplicity classifier before node classification. The shipped JSON fixtures exercise exact object paths. SQL/JSON type()/size() do not automatically iterate over a targeted array.

`NULL ON ERROR` and `FALSE ON ERROR` make JSON calls safe even if the optimizer evaluates an expression before the sibling IS JSON condition. The parsed eligibility guard prevents those fallbacks from classifying corrupt documents as absent/nonconforming. Path syntax/configuration errors are compilation errors, not row errors. V03/D02 use DEFAULT NULL ON CONVERSION ERROR, not WHERE-order-dependent conversion guards. Spatial calls are inside nested CASE guards; valid arguments, supported geometry dimensions, SRID compatibility and privileges remain requirements.

## Additional grammar/encoding/checksum adapters

These are extension contracts, **not implemented alternate algorithms** and not counted as tested support. The concrete variants above work without an unspecified business pass flag.

* General parser: `parse(text, grammar_id, locale_id)` must return parse status `success | syntax_error | unavailable`, parsed typed representation and error offset. Only syntax_error maps to unparseable; unavailable/configuration/internal errors map to neither branch. XML may use an exception-contained XMLTYPE parser with explicit external-entity policy. Do not globally catch every Oracle exception as syntax failure.
* Strict byte decoder: `decode(raw_or_blob, encoding_id, version)` must return decoded Unicode scalar sequence or a precise invalid-byte location, with a separate unavailable status. It must reject malformed/overlong byte sequences and invalid code points under the selected encoding rather than replace them. Oracle RAW_TO_CHAR replacement/roundtrip behavior alone is not a proof of valid decoding. For UTF-8 implement the complete RFC3629 byte-state machine or use a versioned decoder in strict-error mode; preserve source bytes.
* Quoting-aware delimited parser: scan each character with outside-field, unquoted-field, quoted-field, and after-quote states; doubled quotes are escaped only inside quoted fields. Record field boundaries and field count; a quoted newline is handled according to the selected grammar, and unclosed quotes fail. Report parser/configuration failures separately. The shipped no-quoting variant deliberately rejects all quote characters.
* Check-digit adapter: receive the evaluable body and the supplied check digit separately, with an explicit algorithm/version and alphabet. Compute the expected digit from the body; compare it with the supplied digit. For Luhn, double alternate body digits starting from the rightmost body digit, subtract nine when >9, and take `(10 - (sum mod 10)) mod 10`. Malformed body/alphabet or absent digit is unevaluable, not automatically checksum-invalid. This description is a concrete algorithm specification; no Luhn SQL is shipped.
* Timezone interpretation adapter: enumerate permitted grammar/timezone/DST candidates into `(source identity tuple, UTC instant)` evidence and count distinct UTC instants; do not count timezone labels or grammar hits. The shipped D02 covers DATE meanings without timezone candidates.

## Verification and Oracle acceptance

Run `python check_batch.py`. It checks fingerprints/parameters for all40 members. It executes 52 fixture queries over26 members after explicit Oracle-function emulation/syntax translation. Fourteen members have static-only coverage. `test-results.json` states the exact IDs, emulations, and limitations; it does not label Python JSON or SQLite execution as Oracle execution. No independent review is claimed in these files.

Oracle acceptance must cover: native numeric masks/NLS and non-convertible inputs; safe roundtrip conversion; leap/non-leap dates and duplicate/distinct interpretations; malformed/duplicate-key JSON, null vs missing, arrays, types and path multiplicity; initialized empty LOB; RAW byte/digest cases; and Spatial valid/invalid/null/user-defined geometry, boundary/equality/overlap cases and SRID errors. G07 diagnostic string NULL and G04 mask-return semantics have explicit static regression assertions.

Independent review is recorded separately in `review.json`; rerun `python review_batch.py` for its 41 additional emulated rendered-query checks and structural checks. Combined with the authored fixtures, 36 predicate IDs have explicitly limited emulation coverage; the four Spatial members remain static-only. Numeric emulation covers a small decimal subset and date emulation three exact Gregorian masks. These checks do not certify Oracle execution. The independent review clarified that G04 excludes pure TOUCH/ON relationships; it did not change the selected SQL relation.

## Oracle19c primary references

* https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/VALIDATE_CONVERSION.html
* https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/TO_NUMBER.html
* https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/TO_DATE.html
* https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/STANDARD_HASH.html
* https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_LOB.html
* https://docs.oracle.com/en/database/oracle/oracle-database/19/adjsn/json-path-expressions.html
* https://docs.oracle.com/en/database/oracle/oracle-database/19/adjsn/function-JSON_VALUE.html
* https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/SQL-JSON-Conditions.html
* https://docs.oracle.com/en/database/oracle/oracle-database/19/spatl/SDO_GEOM-reference.html

No graph or ZIP changes. Canonical integration belongs to the coordinating agent after independent review.


---

# Batch 13 — reconciliation, provenance and graph predicates

47 predicates; seven new bodies. Existing `oracle.related_existence` and `oracle.distinct_per_subject` are reused by their exact version. This fragment does not change catalogue definitions or any previous body. Rendering has no database side effects.

## Common input contract

Queries inside operational placeholders are trusted SQL fragments, without trailing semicolons. They expose raw facts, authoritative relationships or aligned records, not precomputed answers to the predicate. Source filters must select a fixed population/time scope. Paired branches use identical parameters except their internal branch slot. Reserve `profile_*` names to avoid column collisions. Source-row classifiers preserve duplicates; grouped classifiers explicitly change grain.

SQL `UNKNOWN` is not the negative branch. Evidence, applicable policy and scope must be known before classifying. An authoritative empty relation is usable evidence; an unavailable relation is not an empty relation. Empty source populations produce no row-level or group-level claims. Oracle treats empty text as null; normalize literal-empty test data accordingly.

## Value and derivation agreement

`oracle.evaluable_agreement` calculates a three-valued agreement and selects 1/0. Default variants:

| Axis | Input query | Evaluable condition | Compared expressions |
|---|---|---|---|
| Q01 | `SELECT id, field_a, field_b FROM observations` | `t.field_a IS NOT NULL AND t.field_b IS NOT NULL` | `t.field_a`, `t.field_b` |
| Q03 | `SELECT id, stored_total, quantity, unit_price FROM items` | all three numeric inputs nonnull | stored `t.stored_total`, calculated `t.quantity*t.unit_price`, absolute tolerance e.g. `0.01` |
| A04 | recorded and authoritative classification paired by entity, scheme and time | both class IDs known, authoritative assignment unambiguous | recorded ID and authoritative ID |
| W03 | paired independent evidence records on the same assertion and scope | both values available and records satisfy the declared independence policy | first assertion and second assertion |
| Y06 | subject identifier plus reference identifier | every component of both identifiers nonnull | tuple equality condition, e.g. `t.own_a=t.ref_a AND t.own_b=t.ref_b` |

Q01/A04/W03 normalization can be supplied in the expression itself, e.g. `UPPER(TRIM(t.field_a))`. Default equality variant does not impose an invented fuzzy matching policy. Q03 actually evaluates the deterministic formula in SQL; it does not accept a precomputed consistency flag. A negative or null tolerance yields neither branch. Relative tolerance is a supported expression, e.g. `0.01*ABS(t.stored_total)` if appropriate to the domain. Division must use `NULLIF(denominator,0)`; conversion must be intrinsically safe, rather than depending on WHERE order. Missing or ambiguous authoritative classification must be removed by evidence eligibility, not translated into disagreement.

Y06 excludes absent references; root/no-parent is a separate predicate. Equality means all tuple components agree; CASE `NOT` produces no-self-reference when at least one component differs. Never concatenate composite identifiers.

## Allowed relationships and explicit authorization

Q05/Q07/G05/G06/W02 reuse `oracle.related_existence`: subject alias `t`, policy relation alias `r`, full tuple match and fixed scope. The negative branch means no allowed member *within a known applicable closed policy relation*. Example Q05:

- `allowed_tuple_subject_query`: `SELECT id,country_code,province_code FROM addresses`.
- `allowed_tuple_relation_query`: authoritative `(country_code, province_code, scheme_id)` tuples.
- `allowed_tuple_match_condition`: `r.country_code=t.country_code AND r.province_code=t.province_code`.
- `allowed_tuple_scope_condition`: `r.scheme_id=:scheme_id`.
- `allowed_tuple_evaluable_condition`: both subject values nonnull **and** applicable scheme/release evidence known to be loaded.

Q07 relation is compatible unit/currency pairs at a named conversion policy and date. This is a relation of external unit/conversion facts, not arbitrary SQL booleans. Directional conversions must have the appropriate pair direction. G05 relation lists jurisdictions contained in the declared home jurisdiction. G06 relation lists the selected class under a known scheme; its complement includes every other known class, without assuming a universal urban/rural dichotomy. W02 relation is the approved-source set, with source identity known.

`oracle.explicit_authorization` is intentionally different. B04 requires matching evidence with `decision_code='PERMIT'` or `'DENY'`. No matching row is indeterminate. Duplicate identical decisions are harmless. Conflicting, null or unrecognized decisions suppress both branches. Supply the applicable effective policy rows; if the domain has priority/override rules, resolve applicability by that explicit policy before passing the relation. Output remains one row per input action/subject.

## Group agreement

Q06 uses `oracle.distinct_per_subject`: `group_columns` are entity identity tuples and `value_columns` are selected attribute tuples. The named `group_agreement_scope_condition` selects the fixed time/scope. `groups_nonnull_condition` and `values_nonnull_condition` require every component needed for comparison to be known. Count 1 is consistent; count >1 is conflicting. Duplicate repeated evidence does not cause conflict. A group with only missing attributes has no evaluable result. A group with some missing attributes is classified based on its available comparable evidence; this is not a claim that all evidence is complete. Output is group identity plus distinct comparable attribute count.

## Extract reconciliation

`oracle.extract_union_counts` explicitly builds the union of key occurrences and aggregates per side. Both extract queries must project identically named, type-compatible `key_columns`, e.g. `key_part_a,key_part_b`. The key list contains column names without source alias because it is reused after UNION. The source/target eligibility conditions use alias `s`. Default key comparison excludes null components using the eligibility conditions. If null is intentionally a compared category, `1=1` includes null tuples under SQL GROUP BY semantics; that choice must apply consistently to both extracts. No sentinel or concatenation is used.

Z01 classifies shared/source-only/target-only keys across the union. Z04 compares occurrence counts across the same union, with the absent side count explicitly zero. Thus a source-only or target-only key is multiplicity changed. Z05 treats **source as current** and **target as historical reference** and outputs only keys with source_count>0. Counts include duplicates, but output grain is one compared tuple, not one source row. Align population filters, normalization, units, collation, and snapshot times.

`oracle.unique_extract_agreement` for Z02 computes key multiplicity independently in both extracts before joining. `source_record_eligibility_condition` and `target_record_eligibility_condition` establish the aligned population and known keys; **do not remove rows because a compared payload is missing before this count**, which could conceal ambiguity. `record_key_match_condition` is tuple equality between aliases `s` and `t`. `record_comparison_evaluable_condition` handles payload evidence only after unique matching. `comparison_output_columns` explicitly aliases any overlapping columns, e.g. `s.id,s.amount AS source_amount,t.amount AS target_amount`. Only one-to-one matched keys are classified.

`record_agreement_condition` may compare several selected attributes with AND. For null-as-unknown, ordinary equality is appropriate. If null/null should agree and null/non-null should disagree, use a total condition for each attribute:

```sql
(s.v IS NULL AND t.v IS NULL)
OR (s.v IS NOT NULL AND t.v IS NOT NULL AND s.v=t.v)
```

Do not use just `s.v=t.v OR (both null)` when expecting null/non-null to be false; that expression remains UNKNOWN.

## Graph input and conventions

Graph queries consume an explicit node dictionary and edge facts, never supplied cycle/reachability/depth flags. `node_query` exposes unique nonnull numeric `node_id`. A composite source identifier is mapped losslessly by a dictionary, e.g. `SELECT DENSE_RANK() OVER (ORDER BY key_a,key_b) AS node_id,key_a,key_b FROM (SELECT DISTINCT key_a,key_b FROM raw_nodes WHERE key_a IS NOT NULL AND key_b IS NOT NULL)`. Join each raw edge endpoint to that same dictionary by all key components. Dictionary IDs need only be stable within the fixed snapshot/query; do not independently rank endpoints, concatenate fields, or use collision-prone hashes. Numeric IDs support the optional undirected previous-node state and the portable test translation. Other numeric integral IDs work directly.

Local predicates use raw declared assignments:

- Y01 `parent_assignment_query` projects `parent_id,child_id`. A nonnull parent assignment makes the observed child non-root even if that parent is missing from nodes. A null parent is no assignment. This separates missing parent referential integrity (K03) from root status.
- Y02 checks whether there is an **observed** child, using `node_query` membership. Unobserved child endpoints do not establish non-leaf status.
- Y03 `incident_edge_query` projects `source_id,target_id`. Incident means either endpoint equals the node. Set `incident_edge_scope_condition` to `1=1` to count self-loops or `r.source_id<>r.target_id` to exclude them. Define explicitly whether dangling endpoint edges belong to this graph; the incident query selects that graph.

Traversal normalizes duplicate edges and keeps only edges whose two endpoints occur in the observed vertex dictionary. Edges point from parent/source to child/target. `root_query` provides zero or more known `node_id` values; repeated roots do not duplicate anchors. Missing root IDs are ignored because they are not graph vertices; failure to obtain the required root set is unknown evidence, not a legitimately empty root set.

Directed default: `traversal_edge_query` is the directed edge set; `walk_step_condition=1=1`.

Simple undirected variant: `traversal_edge_query` returns both directions, e.g. `SELECT a AS source_id,b AS target_id FROM raw_edges UNION SELECT b,a FROM raw_edges`; set `walk_step_condition` to `(w.previous_id IS NULL OR e.target_id<>w.previous_id)`. This suppresses immediate backtracking, so one undirected edge is not a spurious 2-cycle. Undirected parallel-edge cycles are outside this variant; parallel edges are deduplicated. Self-loops count as length-one cycles in both variants. Root/leaf use directed parent assignments and have no intrinsic undirected analogue without an assigned orientation.

Only the two stated walk conditions are supported. An arbitrary path-dependent restriction can invalidate vertex-only CYCLE state and shortest-depth reasoning. For edge eligibility or traversal policy, filter the static edge query instead. Path-state-dependent traversal requires a separate expanded state graph.

Y04 anchors a walk at every vertex and asks whether a positive-length walk returns to **that same origin**, with Oracle CYCLE marking that repeated origin. A node that can reach a different cycle but is not on it is therefore not classified on-cycle. This also handles disjoint cycles and isolated nodes.

Y05 anchors only roots. Root reachability includes the length-zero path; every observed nonvisited node is unreachable. A known empty root set makes all observed nodes unreachable.

Y07 defines depth as the shortest unweighted path from any root. Roots have depth zero; unreachable nodes have undefined depth and appear in neither branch. Directed and undirected cycles are allowed and stopped on the first repeated vertex along each branch. This retains all shortest paths. Minimum/maximum bounds are inclusive and require `0 <= minimum <= maximum`; null or reversed bounds classify neither branch. There is no recursion depth truncation. Simple-path enumeration can grow exponentially on dense graphs, so these are correctness-first oracle templates requiring plan/performance validation on large graphs.

## Verification evidence

W01 uses named rule/scope and subject tuple matching. Evidence can report PASS, FAIL or another result; existence is about a verification record, not its outcome. Unknown evidence-collection availability must be excluded from the evaluable subject query/condition. The absence branch assumes the applicable evidence population is known.

## Validation and Oracle reference

Run `python check_batch.py`. `test-results.json` records every individual case and distinguishes 41 predicates executed as portable SQLite SQL from six recursive graph predicates executed only after an explicit translation of Oracle CYCLE into visited-path state. The translated tests retain the rendered anchor, recursive edge traversal, and final classifier; they replace only the dialect-specific cycle machinery. Static checks verify all 47 mappings and actual rendered Oracle statements. These checks are not native Oracle execution. An independent review is recorded separately in `review.json`.

Oracle 19c primary reference: https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/SELECT.html — recursive subquery factoring uses anchor UNION ALL recursive member, an explicit column list, and the CYCLE clause. A detected repeated node is marked and expansion stops on that branch; this is why the cycle classifier includes the marked origin row. Native Oracle compilation/execution remains required before production use.

## Independent review follow-up

Review `batch13-independent-review-2026-09-25` retained all seven authored SQL bodies after inspecting all 47 mappings and the two reused canonical templates. The reviewer verified the recursive CTE and CYCLE rules against Oracle 19c SELECT documentation; there is no CONNECT BY implementation in this batch. No SQL-body defect was found under the documented contracts.

The test translator previously inserted its stop condition at the first `WHERE (` occurrence, which could belong to a caller-supplied node query. It now targets the recursive member specifically. The rerun adds all 512 directed graphs on three vertices, including self-loops, against independent transitive-closure cycle membership and breadth-first rooted distances. It also verifies total null-category comparison, target-side duplicate exclusion, and exact agreement between every batch.sql block and its fingerprinted mapping. The 3,162 checks comprise 72 portable SQL cases and 3,090 translated graph cases. The graph translator uses signed 64-bit integer fixture identities; arbitrary Oracle NUMBER precision is not tested. Native Oracle execution remains not run.


---

# Policy, metadata and logical composition

Oracle 19c templates. No graph/ZIP access. No native Oracle execution. Run one rendered SELECT at a time after substitution. All queries return original source rows (plus diagnostic rule truth/counts where shown), except SC07 which returns one population summary when the predicate holds. Source fields must not collide with generated profile_* diagnostic aliases; rename conflicting fields in the supplied source query.

## Declared business rules

B01 is the explicitly named rule extension point; B02 is an as-of lifecycle rule; B03 is the declared eligibility rule. `subject_query` supplies the evidence with alias t. Conditions are SQL conditions, not stored boolean guesses. Their evaluability conditions must establish required inputs and knowledge. Example B01: `t.AMOUNT <= t.LIMIT_AMOUNT` with both inputs nonnull. Example B02: `t.STATUS = 'ACTIVE' AND t.START_AT <= :as_of AND (t.END_AT IS NULL OR :as_of < t.END_AT)` when NULL end explicitly means open-ended, with known status and start/as-of inputs. Bind one fixed as-of instant and consistent timezones. B03 can use `t.SCORE >= :required_score AND t.REQUIRED_TRAINING = 'Y'`; null knowledge stays unevaluable. Unknown conditions produce NULL truth and neither branch. Conditions must be safe to evaluate independently of WHERE predicate order; prepared safe parsed inputs where necessary.

B06 requires an available marker interpretation. Example `t.DELETED_FLAG = 'Y'` with known marker scope `t.DELETED_FLAG IN ('Y','N')`. Unexpected/null codes are not presumed non-deleted; an explicitly meaningful null encoding can be declared. Does not detect physically removed records.

## Imported metadata

SC01 starts from expected objects and EXISTS/NOT EXISTS in a complete supplied inventory. SC04 starts from required constraints. Match full owner/schema/object identity and object kind, not just names; constraints can match normalized requirement descriptors including ordered column tuples and referenced objects/check definitions where applicable. Completeness of the imported inventory is mandatory for absence claims; missing privileges or an incomplete extract is not evidence of absence. Source/reference aliases t/r match the existing related-existence template. Scope is the same on both branches. SC04 only tests declaration, not enabled/validated behavior.

SC02/SC03 use an unambiguously aligned actual/expected metadata input query. Supply nonnull normalized complete type descriptors (e.g. NUMBER(10,2), VARCHAR2(20 CHAR)) for actual_type_expression/expected_type_expression. If comparing only DATA_TYPE, explicitly label the narrower base-type investigation. Use source metadata, not inference from row values. Nullability expressions similarly normalize known declarations, e.g. t.NULLABLE and t.EXPECTED_NULLABLE using Y/N. Unknown descriptors are excluded. Oracle scalar equality/collation applies; normalize descriptors deliberately in the supplied query, preserving byte/character semantics.

SC05/SC06 reuse scalar equality: schema_name/table_name point to prepared known-constraint metadata; column_name is the normalized enablement/validation column. SC05 accepts only ENABLED/DISABLED; SC06 only VALIDATED/NOT VALIDATED. Other and null values select neither member. Status alone does not prove historic data correctness, constraint type, or enforcement at other times.

SC07 compares the sets of selected metadata tuples using MINUS in both directions. old_metadata_query/new_metadata_query expose the same uniquely named columns; metadata_columns is a nonempty unqualified column list including object identity and every selected property. No lossy concatenation. Use comparable Oracle scalar fields, excluding raw LONG/LOB fields unless safely represented by an appropriate full comparison strategy. Set semantics intentionally ignore duplicate identical inventory rows. Null properties compare as equal in set operations, but unavailability of an entire required property makes snapshot_scope_known_condition false. Align owner filters, relevant extraction times and completeness; include identity so additions/removals are counted. Both known empty sets are unchanged. Output old-only and new-only tuple counts, not changed-object counts.

## Logical components

LC01-LC03: subject_query yields subject_id and source fields. subject_id is a stable nonnull identity on a common population; composite identities can use a collision-free surrogate mapping, not concatenation/hashing. Repeated source rows remain repeated output rows. component_definition_query supplies the selected component_id set; duplicates are deduplicated, and NULL component IDs are outside the selected set and are ignored. component_result_query supplies subject_id,component_id,truth_value, with truth_value using a numeric datatype (for example Oracle NUMBER), where 1=true,0=false,NULL=unknown. Normalize text encodings safely before supplying this query; the template does not parse arbitrary text truth values. Select a fixed rule set, scope and evaluation version. Exactly one evaluation per required component and subject is required: missing evaluations, duplicate evaluations (even agreeing), null or invalid truth codes exclude the subject from both branches. Unselected component results are ignored. Input components must describe the same subject population and snapshot. Empty selected component sets use mathematical identities: ALL=true, ANY=false, EXACTLY_ONE=false. Counts make that fact visible; it does not prove a substantive rule was checked.

LC04 uses the rule classifier: conditional_scope_condition establishes common evidence scope, antecedent_condition is P, consequent_condition is Q. Only true P enters; false/unknown P and unknown Q select neither branch. An implication with false P is not treated as satisfied because the frozen definition excludes it.

## References

- https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/CASE-Expressions.html
- https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/The-UNION-ALL-INTERSECT-MINUS-Operators.html
- https://docs.oracle.com/en/database/oracle/oracle-database/19/refrn/ALL_CONSTRAINTS.html

