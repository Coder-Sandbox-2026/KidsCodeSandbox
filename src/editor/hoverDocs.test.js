import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  findCompletion,
  findHoverEntry,
  PRINT_OPTIONS,
  SHAPE_OPTIONS,
} from './apiCompletions.js';
import {
  MISSING_OPTION_DESCRIPTION,
  SEE_ALL_OPTIONS_LABEL,
  buildHover,
  buildHoverContents,
  collapsedDescription,
  formatOptionProperty,
  formatOptionsDisclosure,
  hasOptionalObjectLiteral,
  methodSignature,
} from './hoverDocs.js';

function simpleText(contents) {
  return contents
    .filter((part) => !part.supportHtml)
    .map((part) => part.value)
    .join('\n');
}

function disclosure(contents) {
  return contents.find((part) => part.supportHtml) || null;
}

const getPlayer = findCompletion('getPlayer');
const createCube = findCompletion('createCube');
const printFn = findCompletion('print');

test('a method without an optional object literal keeps the simple hover', () => {
  assert.equal(hasOptionalObjectLiteral(getPlayer), false);
  const contents = buildHoverContents(getPlayer);
  const text = simpleText(contents);

  assert.equal(contents.length, 2);
  assert.equal(disclosure(contents), null);
  assert.match(text, /\*\*getPlayer\*\*/);
  assert.match(text, /```/);
  assert.match(text, /getPlayer\(\)/);
  assert.doesNotMatch(text, new RegExp(SEE_ALL_OPTIONS_LABEL));
  assert.deepEqual(contents, buildHoverContents(getPlayer, { expanded: true }));
});

test('a method with an optional object literal advertises extra options', () => {
  assert.equal(hasOptionalObjectLiteral(createCube), true);
  const contents = buildHoverContents(createCube);
  const html = disclosure(contents)?.value || '';

  assert.match(simpleText(contents), /Create a cube in the game world/);
  assert.match(html, /<details>/);
  assert.match(html, new RegExp(`<summary>${SEE_ALL_OPTIONS_LABEL}</summary>`));
  assert.equal(disclosure(contents)?.supportHtml, true);
});

test('collapsed hover stays short and does not list every object property', () => {
  const contents = buildHoverContents(createCube, { expanded: false });
  const simple = simpleText(contents);
  const html = disclosure(contents)?.value || '';

  assert.doesNotMatch(simple, /bounciness/);
  assert.doesNotMatch(simple, /friction/);
  assert.doesNotMatch(simple, /<details/);
  assert.doesNotMatch(html, / open>/);
  assert.equal(collapsedDescription(createCube), createCube.detail);
  assert.equal(methodSignature(createCube), 'createCube(options)');
});

test('expanding shows all object-literal properties', () => {
  const collapsed = formatOptionsDisclosure(SHAPE_OPTIONS, { expanded: false });
  const expanded = formatOptionsDisclosure(SHAPE_OPTIONS, { expanded: true });

  assert.match(collapsed, /<details>/);
  assert.match(collapsed, new RegExp(`<summary>${SEE_ALL_OPTIONS_LABEL}</summary>`));
  assert.doesNotMatch(collapsed, /Show less/);
  assert.doesNotMatch(expanded, /<details/);
  assert.match(expanded, /Show less/);

  const contents = buildHoverContents(createCube, { expanded: true });
  const html = disclosure(contents)?.value || '';
  for (const field of SHAPE_OPTIONS) {
    assert.match(html, new RegExp(`<code>${field.name}</code>`));
  }
  assert.equal(SHAPE_OPTIONS.length > 1, true);
});

test('expanded properties include kid-friendly descriptions, types, and examples', () => {
  const html = disclosure(buildHoverContents(createCube, { expanded: true }))?.value || '';
  const position = SHAPE_OPTIONS.find((field) => field.name === 'position');

  assert.match(html, /<code>position<\/code>/);
  assert.match(html, /\(optional\)/);
  assert.match(html, /\[x, y, z\]/);
  assert.match(html, new RegExp(position.description.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(html, /Example: <code>\[0, 3, -5\]<\/code>/);
});

test('methods with multiple optional properties list every field', () => {
  assert.ok(PRINT_OPTIONS.length > 1);
  const html = disclosure(buildHoverContents(printFn, { expanded: true }))?.value || '';
  for (const field of PRINT_OPTIONS) {
    assert.match(html, new RegExp(`<code>${field.name}</code>`));
    assert.match(html, new RegExp(field.description.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  const settings = findHoverEntry('setSettings');
  const settingsHtml = disclosure(buildHoverContents(settings, { expanded: true }))?.value || '';
  assert.match(settingsHtml, /<code>walkSpeed<\/code>/);
  assert.match(settingsHtml, /<code>jumpForce<\/code>/);
  assert.match(settingsHtml, /<code>gravity<\/code>/);
  assert.match(settingsHtml, /<code>movementEnabled<\/code>/);
});

test('missing option descriptions or metadata still render safely', () => {
  const unnamed = formatOptionProperty({});
  assert.equal(unnamed, '');

  const sparse = formatOptionProperty({ name: 'sparkle' });
  assert.match(sparse, /^sparkle \(optional\)/);
  assert.match(sparse, new RegExp(MISSING_OPTION_DESCRIPTION));
  assert.doesNotMatch(sparse, /Example:/);

  const required = formatOptionProperty({
    name: 'id',
    optional: false,
    type: 'text',
    description: 'The name of this text label.',
  });
  assert.match(required, /id \(required\) — text/);

  const mystery = {
    label: 'mysteryFx',
    kind: 'Function',
    detail: 'A mystery effect',
    doc: 'mysteryFx(options)',
    options: [
      { name: 'foo' },
      { name: 'bar', type: 'text' },
    ],
  };
  const html = disclosure(buildHoverContents(mystery, { expanded: true }))?.value || '';
  assert.match(html, /<code>foo<\/code>/);
  assert.match(html, /<code>bar<\/code>/);
  assert.match(html, new RegExp(MISSING_OPTION_DESCRIPTION));
  assert.match(html, / — text/);

  const emptyOptions = buildHoverContents({
    label: 'emptyOpts',
    kind: 'Function',
    detail: 'Nothing extra',
    options: [],
  });
  assert.equal(hasOptionalObjectLiteral({ options: [] }), false);
  assert.equal(disclosure(emptyOptions), null);
  assert.match(simpleText(emptyOptions), /Nothing extra/);
});

test('live createCube hover uses the shared shape option catalog', () => {
  assert.equal(findHoverEntry('createCube').options, SHAPE_OPTIONS);
  assert.equal(createCube.options, SHAPE_OPTIONS);
});

test('verbosity request expands object-literal options in the hover', () => {
  const collapsed = buildHover(createCube);
  assert.equal(collapsed.canIncreaseVerbosity, true);
  assert.equal(collapsed.canDecreaseVerbosity, false);
  assert.doesNotMatch(simpleText(collapsed.contents), /bounciness/);

  const expanded = buildHover(createCube, {
    verbosityRequest: { verbosityDelta: 1, previousHover: collapsed },
  });
  assert.equal(expanded.canIncreaseVerbosity, false);
  assert.equal(expanded.canDecreaseVerbosity, true);
  const html = disclosure(expanded.contents)?.value || '';
  assert.match(html, /<code>bounciness<\/code>/);
  assert.match(html, /<code>friction<\/code>/);
  assert.match(html, /Show less/);

  const collapsedAgain = buildHover(createCube, {
    verbosityRequest: { verbosityDelta: -1, previousHover: expanded },
  });
  assert.equal(collapsedAgain.canIncreaseVerbosity, true);
  assert.match(disclosure(collapsedAgain.contents)?.value || '', /<details>/);
});
