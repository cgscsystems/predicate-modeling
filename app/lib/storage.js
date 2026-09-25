// Oracle data type -> catalogue storage classes (design §7.3).

const STORAGE_BY_BASE_TYPE = [
  [["VARCHAR2", "NVARCHAR2", "VARCHAR", "CHAR", "NCHAR"], ["T", "C", "O", "A"]],
  [["CLOB", "NCLOB"], ["T", "J", "A"]],
  [["NUMBER", "FLOAT", "INTEGER", "INT", "SMALLINT", "DECIMAL", "BINARY_FLOAT", "BINARY_DOUBLE"], ["N", "C", "O", "A"]],
  [["DATE", "TIMESTAMP"], ["D", "C", "O", "A"]],
  [["INTERVAL"], ["I", "C", "O", "A"]],
  [["RAW", "LONG RAW", "BLOB"], ["B", "A"]],
  [["JSON", "XMLTYPE"], ["J", "A"]],
  [["SDO_GEOMETRY"], ["G", "A"]],
];

// "TIMESTAMP(6) WITH LOCAL TIME ZONE" -> "TIMESTAMP"; "INTERVAL DAY(2) TO SECOND(6)" -> "INTERVAL";
// an owner prefix such as "MDSYS.SDO_GEOMETRY" is dropped.
export function oracleBaseType(dataType) {
  let base = String(dataType || "").toUpperCase().split("(")[0];
  base = base.replace(/\s+WITH\s+(LOCAL\s+)?TIME\s+ZONE.*$/, "").replace(/\s+/g, " ").trim();
  base = base.slice(base.lastIndexOf(".") + 1);
  if (base.startsWith("INTERVAL")) return "INTERVAL";
  return base;
}

export function storageClassesFor(dataType) {
  const base = oracleBaseType(dataType);
  for (const [types, classes] of STORAGE_BY_BASE_TYPE) {
    if (types.includes(base)) return classes.slice();
  }
  return ["A"];
}
