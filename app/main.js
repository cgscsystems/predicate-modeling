// Entry point. The catalogue bundle and SheetJS are inlined into the page by build/build.py.

import { startApp } from "./ui/app.js";

startApp(JSON.parse(document.getElementById("catalogue-bundle").textContent), window.XLSX);
