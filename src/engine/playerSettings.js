/**
 * Kid-facing player movement settings and friendly validation.
 * Defaults match the original first-person feel (instant walk, single jump).
 */
export const DEFAULT_PLAYER_SETTINGS = {
  walkSpeed: 7,
  jumpForce: 7,
  gravity: 25,
  airControl: 1,
  maxFallSpeed: 80,
  acceleration: 1000,
  deceleration: 1000,
  jumpCount: 1,
  movementEnabled: true,
};

const SETTING_META = {
  walkSpeed: { label: 'Walk speed', min: 0 },
  jumpForce: { label: 'Jump force', min: 0 },
  gravity: { label: 'Gravity', min: 0 },
  airControl: { label: 'Air control', min: 0, max: 1 },
  maxFallSpeed: { label: 'Maximum fall speed', min: 0 },
  acceleration: { label: 'Acceleration', min: 0 },
  deceleration: { label: 'Deceleration', min: 0 },
  jumpCount: { label: 'Jump count', min: 0, integer: true },
  movementEnabled: { label: 'Movement enabled', boolean: true },
};

export function createPlayerSettings() {
  return { ...DEFAULT_PLAYER_SETTINGS };
}

function friendlyNumber(label, value, { min, max, integer } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a number.`);
  }
  if (integer && !Number.isInteger(value)) {
    throw new Error(`${label} must be a whole number.`);
  }
  if (min !== undefined && value < min) {
    throw new Error(max === undefined
      ? `${label} must be ${min} or greater.`
      : `${label} must be between ${min} and ${max}.`);
  }
  if (max !== undefined && value > max) {
    throw new Error(`${label} must be between ${min ?? 0} and ${max}.`);
  }
  return value;
}

export function validatePlayerSetting(key, value) {
  const meta = SETTING_META[key];
  if (!meta) {
    throw new Error(`Unknown player setting "${key}".`);
  }
  if (meta.boolean) {
    if (typeof value !== 'boolean') {
      throw new Error(`${meta.label} must be true or false.`);
    }
    return value;
  }
  return friendlyNumber(meta.label, value, meta);
}

/** Apply a settings object; unknown keys are ignored so typos can be caught by setters. */
export function applyPlayerSettings(target, raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('setSettings() expects an object, like { walkSpeed: 8 }.');
  }
  const next = { ...target };
  for (const key of Object.keys(SETTING_META)) {
    if (raw[key] !== undefined) {
      next[key] = validatePlayerSetting(key, raw[key]);
    }
  }
  return next;
}
