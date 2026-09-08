/**
 * AppSettings – small local preferences store.
 * UI and autocomplete read from here; they do not talk to each other.
 */
import { SETTINGS_DEFAULTS, isValidSettingValue } from './settingsSchema.js';

const STORAGE_KEY = 'kidscode3d_settings';

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function sanitize(saved) {
  const next = { ...SETTINGS_DEFAULTS };
  for (const [key, value] of Object.entries(saved)) {
    if (isValidSettingValue(key, value)) {
      next[key] = value;
    } else if (!(key in SETTINGS_DEFAULTS) && value !== undefined) {
      // Keep unknown future keys so upgrades do not wipe them.
      next[key] = value;
    }
  }
  return next;
}

class AppSettings {
  constructor() {
    this._values = sanitize(loadSaved());
    this._listeners = new Set();
  }

  get(key) {
    return this._values[key];
  }

  getAll() {
    return { ...this._values };
  }

  set(key, value) {
    if (key in SETTINGS_DEFAULTS && !isValidSettingValue(key, value)) return this._values[key];
    if (this._values[key] === value) return value;
    this._values = { ...this._values, [key]: value };
    this._persist();
    for (const fn of this._listeners) {
      try { fn(this.getAll(), key); } catch { /* keep other listeners going */ }
    }
    return value;
  }

  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._values));
    } catch {
      /* private mode / quota — keep in-memory value */
    }
  }
}

export const appSettings = new AppSettings();
