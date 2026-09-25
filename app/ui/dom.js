// DOM helpers. User text is always set as text, never parsed as HTML.

const PROPERTY_KEYS = new Set(["value", "checked", "disabled", "selected", "open", "hidden"]);

function appendAll(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : String(child));
  }
}

// el("button", { class: "primary", text: "Save", onclick }, ...children)
export function el(tag, props, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (PROPERTY_KEYS.has(key)) node[key] = value;
    else node.setAttribute(key, value === true ? "" : value);
  }
  appendAll(node, children);
  return node;
}

export function replaceContent(node, ...children) {
  node.replaceChildren();
  appendAll(node, children);
}

export function copyText(text) {
  const fallback = () => {
    const area = el("textarea", { value: text, class: "offscreen", "aria-hidden": "true" });
    document.body.append(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  };
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text).then(() => true, fallback);
  }
  return Promise.resolve(fallback());
}

export function downloadText(fileName, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type: type || "application/json" }));
  const link = el("a", { href: url, download: fileName, class: "offscreen" });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Opens the browser's file picker and resolves with the chosen File, or null.
export function pickFile(accept) {
  return new Promise((resolve) => {
    const input = el("input", { type: "file", accept, class: "offscreen", "data-picker": accept });
    input.addEventListener("change", () => {
      resolve(input.files[0] || null);
      input.remove();
    });
    input.addEventListener("cancel", () => {
      resolve(null);
      input.remove();
    });
    document.body.append(input);
    input.click();
  });
}

export function formatTime(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  const today = new Date();
  const time = pad(date.getHours()) + ":" + pad(date.getMinutes());
  if (date.toDateString() === today.toDateString()) return time;
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) + " " + time;
}
