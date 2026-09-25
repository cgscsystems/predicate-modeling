// First sheet of an XLSX workbook as rows of cell text. XLSX is the vendored SheetJS global.

export function rowsFromWorkbook(XLSX, data) {
  const workbook = XLSX.read(data, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "", blankrows: false })
    .map((row) => row.map((value) => (value == null ? "" : String(value))));
}
