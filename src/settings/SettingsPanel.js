/**
 * SettingsPanel – kid-friendly dialog driven by SETTINGS_SCHEMA.
 * Updates the settings store only. Does not touch Monaco.
 */
import { SETTINGS_SCHEMA } from './settingsSchema.js';

function renderChoice(field, current, store) {
  const group = document.createElement('fieldset');
  group.className = 'settings-field';

  const legend = document.createElement('legend');
  legend.className = 'settings-field-title';
  legend.id = `settings-label-${field.key}`;
  legend.textContent = field.label;
  group.appendChild(legend);

  if (field.description) {
    const desc = document.createElement('p');
    desc.className = 'settings-field-desc';
    desc.id = `settings-desc-${field.key}`;
    desc.textContent = field.description;
    group.appendChild(desc);
  }

  const list = document.createElement('div');
  list.className = 'settings-options';
  list.setAttribute('role', 'radiogroup');
  list.setAttribute('aria-labelledby', legend.id || '');
  if (field.description) list.setAttribute('aria-describedby', `settings-desc-${field.key}`);

  for (const opt of field.options) {
    const id = `setting-${field.key}-${opt.value}`;
    const row = document.createElement('label');
    row.className = 'settings-option';
    row.htmlFor = id;

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = field.key;
    input.id = id;
    input.value = opt.value;
    input.checked = current === opt.value;
    input.addEventListener('change', () => {
      if (input.checked) store.set(field.key, opt.value);
    });

    const text = document.createElement('span');
    text.className = 'settings-option-text';
    const title = document.createElement('span');
    title.className = 'settings-option-label';
    title.textContent = opt.label;
    text.appendChild(title);
    if (opt.hint) {
      const hint = document.createElement('span');
      hint.className = 'settings-option-hint';
      hint.textContent = opt.hint;
      text.appendChild(hint);
    }

    row.appendChild(input);
    row.appendChild(text);
    list.appendChild(row);
  }

  group.appendChild(list);

  if (field.hint) {
    const tip = document.createElement('p');
    tip.className = 'settings-hint';
    tip.textContent = field.hint;
    group.appendChild(tip);
  }

  return group;
}

function renderBody(body, store) {
  body.replaceChildren();
  const values = store.getAll();
  for (const field of SETTINGS_SCHEMA) {
    if (field.type === 'choice') {
      body.appendChild(renderChoice(field, values[field.key], store));
    }
  }
}

export function mountSettingsPanel(store) {
  const button = document.getElementById('btn-settings');
  const backdrop = document.getElementById('settings-backdrop');
  const dialog = document.getElementById('settings-dialog');
  const closeBtn = document.getElementById('settings-close');
  const body = document.getElementById('settings-body');
  if (!button || !backdrop || !dialog || !closeBtn || !body) return;

  let lastFocus = null;

  function open() {
    lastFocus = document.activeElement;
    renderBody(body, store);
    backdrop.classList.remove('hidden');
    button.setAttribute('aria-expanded', 'true');
    const first = dialog.querySelector('input:checked, input, button');
    first?.focus();
  }

  function close() {
    backdrop.classList.add('hidden');
    button.setAttribute('aria-expanded', 'false');
    (lastFocus || button).focus?.();
  }

  button.addEventListener('click', () => {
    if (backdrop.classList.contains('hidden')) open();
    else close();
  });
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !backdrop.classList.contains('hidden')) {
      e.preventDefault();
      close();
    }
  });

  store.subscribe(() => {
    if (!backdrop.classList.contains('hidden')) renderBody(body, store);
  });
}
