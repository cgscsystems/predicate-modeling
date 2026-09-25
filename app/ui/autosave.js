// Autosave to localStorage (design §12). Every access is guarded: the app works without storage.

const AUTOSAVE_KEY = "predicate-workbench.autosave";
const AUTOSAVE_DELAY_MS = 800;

function browserStorage() {
  try {
    return window.localStorage;
  } catch (error) {
    return null;
  }
}

export function storageAvailable() {
  const storage = browserStorage();
  if (!storage) return false;
  try {
    storage.setItem(AUTOSAVE_KEY + ".probe", "1");
    storage.removeItem(AUTOSAVE_KEY + ".probe");
    return true;
  } catch (error) {
    return false;
  }
}

// { savedAt, lastExportAt, changedSinceExport, workspace } or null.
export function readAutosave() {
  try {
    const text = browserStorage().getItem(AUTOSAVE_KEY);
    const payload = text ? JSON.parse(text) : null;
    return payload && payload.workspace ? payload : null;
  } catch (error) {
    return null;
  }
}

export function clearAutosave() {
  try {
    browserStorage().removeItem(AUTOSAVE_KEY);
  } catch (error) {
    // Nothing to clear when storage is unavailable.
  }
}

function writeAutosave(app) {
  const savedAt = new Date().toISOString();
  try {
    browserStorage().setItem(AUTOSAVE_KEY, JSON.stringify({
      savedAt,
      lastExportAt: app.lastExportAt,
      changedSinceExport: app.changedSinceExport,
      workspace: app.ws,
    }));
    app.autosave.savedAt = savedAt;
    app.autosave.failed = false;
  } catch (error) {
    app.autosave.failed = true;
  }
}

// Debounced; paused while the startup restore offer is open so the old autosave survives.
export function scheduleAutosave(app, onSaved) {
  if (!app.autosave.available || app.autosave.offerPending) return;
  clearTimeout(app.autosave.timer);
  app.autosave.timer = setTimeout(() => {
    writeAutosave(app);
    if (onSaved) onSaved();
  }, AUTOSAVE_DELAY_MS);
}

export function flushAutosave(app) {
  if (!app.autosave.available || app.autosave.offerPending) return;
  clearTimeout(app.autosave.timer);
  writeAutosave(app);
}
