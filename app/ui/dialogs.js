// Modal dialogs built on <dialog>. Escape closes them.

import { el } from "./dom.js";

// actions: [{ label, kind: "primary" | "danger", onClick }]; onClick returning true keeps it open.
export function openDialog({ title, body, actions, wide, onClose, label }) {
  const dialog = el("dialog", { class: "dialog" + (wide ? " wide" : ""), "aria-label": label || title });
  let closed = false;
  const close = () => {
    if (!closed) dialog.close();
  };
  dialog.addEventListener("close", () => {
    closed = true;
    dialog.remove();
    if (onClose) onClose();
  });
  const buttons = (actions || [{ label: "Close" }]).map((action) => el("button", {
    type: "button",
    class: action.kind || "",
    text: action.label,
    onclick: async () => {
      const keepOpen = action.onClick ? await action.onClick() : false;
      if (keepOpen !== true) close();
    },
  }));
  dialog.append(
    el("header", { class: "dialog-header" }, el("h2", { text: title }),
      el("button", { type: "button", class: "icon-button", "aria-label": "Close", text: "×", onclick: close })),
    el("div", { class: "dialog-body" }, body),
    el("footer", { class: "dialog-actions" }, buttons),
  );
  document.body.append(dialog);
  dialog.showModal();
  return { dialog, close };
}

export function confirmDialog(title, message, confirmLabel, danger) {
  return new Promise((resolve) => {
    let answer = false;
    openDialog({
      title,
      body: el("p", { text: message }),
      actions: [
        { label: "Cancel" },
        { label: confirmLabel || "Confirm", kind: danger ? "danger" : "primary", onClick: () => { answer = true; } },
      ],
      onClose: () => resolve(answer),
    });
  });
}

export function messageDialog(title, body) {
  openDialog({ title, body: typeof body === "string" ? el("p", { text: body }) : body, actions: [{ label: "OK", kind: "primary" }] });
}
