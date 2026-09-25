# Vendored libraries

| File | Library | Version | License | Source |
|---|---|---|---|---|
| `xlsx.full.min.js` | SheetJS Community Edition | 0.18.5 | Apache-2.0 (`xlsx.LICENSE`) | npm `xlsx@0.18.5`, `package/dist/xlsx.full.min.js`; tarball integrity `sha512-dmg3LCjBPHZnQp5/F/+nnTa+miPJxUXB6vtk42YjBBKayDNagxGEeIdWApkYPOf3Z3pm3k62Knjzp7lMeTEtFQ==` |

Only reading is used: the first sheet of an imported metadata workbook (`app/lib/xlsx.js`).

0.18.5 is the last SheetJS release on the npm registry. Two advisories affect reading crafted files and are fixed in later releases published only at cdn.sheetjs.com: prototype pollution (CVE-2023-30533, fixed in 0.19.3) and a regular-expression denial of service (CVE-2024-22363, fixed in 0.20.2). The workbench only opens files the investigator chooses, locally and offline. To upgrade, replace `xlsx.full.min.js` with the same file from `https://cdn.sheetjs.com/xlsx-<version>/package/dist/xlsx.full.min.js`; the API used here is unchanged.
