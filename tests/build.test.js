import test from "node:test";
import assert from "node:assert/strict";
import { loadBundle } from "./helpers.js";

test("bundle carries the whole catalogue with stage-one SQL", () => {
  const bundle = loadBundle();
  assert.equal(bundle.catalogueVersion, "1.0.0");
  assert.equal(bundle.groups.length, 173);
  assert.equal(bundle.predicates.length, 364);
  assert.equal(bundle.semanticTypes.length, 34);
  assert.equal(bundle.families.length, 26);
  for (const predicate of bundle.predicates) {
    assert.doesNotMatch(predicate.sql, /\[\[/, predicate.id + " has an unresolved slot");
    assert.ok(["partition", "measure"].includes(predicate.output));
  }
});

test("groups carry members in ordinal order, applicability and classification", () => {
  const groups = new Map(loadBundle().groups.map((g) => [g.id, g]));
  const u01 = groups.get("U01");
  assert.deepEqual(u01.members, ["U01.1", "U01.2"]);
  assert.equal(u01.applicability.universal, true);
  assert.deepEqual(u01.applicability.storageClasses, ["C"]);
  assert.equal(u01.attachment, "column");
  assert.equal(u01.familyId, "family:03");
  assert.deepEqual(groups.get("X07").members, ["X07.1", "X07.2", "X07.3", "X07.4"]);
  assert.ok(groups.get("X01").applicability.semanticTypes.includes("Name"));
  assert.equal(groups.get("H01").attachment, "table");
  assert.equal(groups.get("K01").crossSource, true);
});

test("predicate outputs follow templates and overrides", () => {
  const predicates = new Map(loadBundle().predicates.map((p) => [p.id, p]));
  assert.equal(predicates.get("U01.1").output, "partition");
  assert.equal(predicates.get("U04.1").output, "measure");
  assert.equal(predicates.get("S03.1").output, "partition");
  assert.equal(predicates.get("S04.1").output, "measure");
  assert.deepEqual(predicates.get("P01.1").complements, ["P01.2"]);
  assert.deepEqual(predicates.get("U01.1").tags, ["column_name", "schema_name", "table_name"]);
});
