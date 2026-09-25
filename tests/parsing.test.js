import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv } from "../app/lib/csv.js";
import { oracleBaseType, storageClassesFor } from "../app/lib/storage.js";

test("CSV: quoted fields, escaped quotes, CRLF, BOM and a missing final newline", () => {
  const rows = parseCsv('﻿a,b,c\r\n1,"x, y","say ""hi"""\r\n2,"multi\nline",\n3,,last');
  assert.deepEqual(rows, [["a", "b", "c"], ["1", "x, y", 'say "hi"'], ["2", "multi\nline", ""], ["3", "", "last"]]);
});

test("storage: base type matching per design §7.3", () => {
  const cases = {
    "VARCHAR2(2)": ["T", "C", "O", "A"],
    "nvarchar2(20 char)": ["T", "C", "O", "A"],
    "CLOB": ["T", "J", "A"],
    "NUMBER(6,0)": ["N", "C", "O", "A"],
    "BINARY_DOUBLE": ["N", "C", "O", "A"],
    "DATE": ["D", "C", "O", "A"],
    "TIMESTAMP(6) WITH LOCAL TIME ZONE": ["D", "C", "O", "A"],
    "TIMESTAMP WITH TIME ZONE": ["D", "C", "O", "A"],
    "INTERVAL DAY(2) TO SECOND(6)": ["I", "C", "O", "A"],
    "INTERVAL YEAR(2) TO MONTH": ["I", "C", "O", "A"],
    "LONG RAW": ["B", "A"],
    "BLOB": ["B", "A"],
    "XMLTYPE": ["J", "A"],
    "SYS.XMLTYPE": ["J", "A"],
    "MDSYS.SDO_GEOMETRY": ["G", "A"],
    "ROWID": ["A"],
    "": ["A"],
  };
  for (const [type, classes] of Object.entries(cases)) assert.deepEqual(storageClassesFor(type), classes, type);
  assert.equal(oracleBaseType("timestamp(3)"), "TIMESTAMP");
  assert.ok(!storageClassesFor("NUMBER").includes("M"));
});
