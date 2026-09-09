/**
 * Kid-friendly hover text for the game API.
 *
 * Methods without an object-literal options bag keep the original simple hover.
 * Methods that accept optional object properties get a collapsed summary plus a
 * native <details> control so kids can open "See all options" without closing
 * the hover widget.
 */

export const SEE_ALL_OPTIONS_LABEL = 'See all options';
export const HIDE_OPTIONS_LABEL = 'Show less';
export const MISSING_OPTION_DESCRIPTION = 'No extra description for this option yet.';

/** Shared option-field helper used by API documentation metadata. */
export function optionField(name, type, description, extra = {}) {
  const field = {
    name,
    type,
    description,
    optional: extra.optional !== false,
  };
  if (extra.example != null) field.example = extra.example;
  return field;
}

export function hasOptionalObjectLiteral(entry) {
  return Array.isArray(entry?.options) && entry.options.length > 0;
}

export function methodSignature(entry) {
  const doc = String(entry?.doc || '');
  const first = doc.split('\n')[0].trim();
  if (first.includes('(') && first.includes(')')) return first;
  if (entry?.kind === 'Function' || entry?.kind === 'Method') {
    return `${entry.label}()`;
  }
  return '';
}

/** Short "what does this do?" text. Never includes the full options dump. */
export function collapsedDescription(entry) {
  if (entry?.detail) return String(entry.detail).trim();
  const doc = String(entry?.doc || '').trim();
  if (!doc) return '';
  const withoutOptions = doc.split(/\nOptions\b/i)[0].trim();
  const paragraphs = withoutOptions.split(/\n\s*\n/);
  if (paragraphs.length > 1) {
    return paragraphs.slice(1).join('\n\n').split('\nExample:')[0].trim();
  }
  return withoutOptions;
}

export function formatOptionProperty(prop = {}) {
  const name = prop.name ? String(prop.name) : '';
  if (!name) return '';

  const optional = prop.optional === false ? 'required' : 'optional';
  const type = prop.type ? String(prop.type) : '';
  const description = prop.description
    ? String(prop.description)
    : MISSING_OPTION_DESCRIPTION;
  const example = prop.example != null ? String(prop.example) : '';

  let line = `${name} (${optional})`;
  if (type) line += ` — ${type}`;
  line += `\n${description}`;
  if (example) line += ` Example: ${example}`;
  return line;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatOptionPropertyHtml(prop = {}) {
  const name = prop.name ? escapeHtml(prop.name) : '';
  if (!name) return '';

  const optional = prop.optional === false ? 'required' : 'optional';
  const type = prop.type ? escapeHtml(prop.type) : '';
  const description = escapeHtml(prop.description || MISSING_OPTION_DESCRIPTION);
  const example = prop.example != null
    ? ` Example: <code>${escapeHtml(prop.example)}</code>`
    : '';
  const typeBit = type ? ` — ${type}` : '';

  return `<p><strong><code>${name}</code></strong> (${optional})${typeBit}<br>${description}${example}</p>`;
}

export function formatOptionsDisclosure(options = [], { expanded = false } = {}) {
  const items = options.map(formatOptionPropertyHtml).filter(Boolean).join('');
  const body = items || `<p>${escapeHtml(MISSING_OPTION_DESCRIPTION)}</p>`;
  if (expanded) {
    return `<p><a role="button">${HIDE_OPTIONS_LABEL}</a></p>${body}`;
  }
  return `<details><summary>${SEE_ALL_OPTIONS_LABEL}</summary>${body}</details>`;
}

export function resolveHoverExpanded(entry, context) {
  if (!hasOptionalObjectLiteral(entry)) return false;
  const request = context?.verbosityRequest;
  if (!request) return false;
  const previousLevel = request.previousHover?.canDecreaseVerbosity ? 1 : 0;
  return previousLevel + (request.verbosityDelta || 0) > 0;
}

function simpleHoverBody(entry) {
  return '```\n' + (entry.doc || entry.detail || '') + '\n```';
}

function collapsedHoverBody(entry) {
  const parts = [];
  const description = collapsedDescription(entry);
  if (description) parts.push(description);
  const signature = methodSignature(entry);
  if (signature) parts.push('`' + signature + '`');
  return parts.join('\n\n');
}

/**
 * Monaco hover contents.
 * @param {object} entry  API completion metadata
 * @param {{ expanded?: boolean }} [state]
 */
export function buildHoverContents(entry, { expanded = false } = {}) {
  if (!entry) return [];

  const contents = [{ value: `**${entry.label}**` }];

  if (!hasOptionalObjectLiteral(entry)) {
    contents.push({ value: simpleHoverBody(entry) });
    return contents;
  }

  contents.push({ value: collapsedHoverBody(entry) });
  contents.push({
    value: formatOptionsDisclosure(entry.options, { expanded }),
    supportHtml: true,
  });
  return contents;
}

/** Full Monaco hover object, including verbosity flags so expand can relayout. */
export function buildHover(entry, context) {
  const expanded = resolveHoverExpanded(entry, context);
  const hasOptions = hasOptionalObjectLiteral(entry);
  return {
    contents: buildHoverContents(entry, { expanded }),
    canIncreaseVerbosity: hasOptions && !expanded,
    canDecreaseVerbosity: hasOptions && expanded,
  };
}
