import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CHALLENGES } from './challengeCatalog.js';
import { createChallengeValidator } from './challengeValidation.js';
import { mountChallengeUI } from './ChallengeUI.js';
import { CHALLENGE_LEVEL_CONFIG } from './challengeLevelConfig.js';
import { selectChallengeLevel } from './challengeSelection.js';

test('validation rejects wrong concepts, quoted comments, literals and stale runs', () => {
  const check = (id, source, name, value, current = true) => {
    let count = 0;
    const validator = createChallengeValidator(CHALLENGES[id - 1], source, {
      isCurrent: () => current, onComplete: () => count++,
    });
    validator.observe(name, value);
    validator.observe(name, value);
    validator.succeeded();
    return count;
  };
  assert.equal(check(3, 'const url = "https://example.com";'), 0);
  assert.equal(check(3, '/* // not a line comment */'), 0);
  assert.equal(check(3, '`// template`;'), 0);
  assert.equal(check(3, '// a note'), 1);
  assert.equal(check(4, 'let score = 10; print(score);', 'print', 10), 1);
  assert.equal(check(4, 'let score = 10; print(10);', 'print', 10), 0);
  assert.equal(check(4, 'if (false) { let score = 10; print(score); } print(10);', 'print', 10), 0);
  assert.equal(check(4, 'let score = 10; print(score);', 'print', '10'), 0);
  assert.equal(check(5, 'const hero = "Ace"; print(hero);', 'print', 'Ace'), 1);
  assert.equal(check(2, '', 'print', 'hello'), 0);
  assert.equal(check(6, '', 'createSphere'), 0);
  assert.equal(check(11, '', 'getPlayer'), 0);
  assert.equal(check(11, '', 'setJumpForce', 15), 1);
  assert.equal(check(1, '', 'print', 'late', false), 0);
});

// Minimal DOM for the existing UI's text, focus, buttons and visibility behavior.
class Element extends EventTarget {
  constructor() {
    super();
    this.children = [];
    this.queries = new Map();
    this.classes = new Set();
    this.classList = {
      contains: name => this.classes.has(name),
      add: name => this.classes.add(name),
      remove: name => this.classes.delete(name),
      toggle: (name, force = !this.classes.has(name)) => force ? this.classes.add(name) : this.classes.delete(name),
    };
  }
  set className(value) { this.classes = new Set(value.split(' ')); }
  setAttribute() {}
  appendChild(child) { this.children.push(child); }
  querySelector(selector) {
    if (!this.queries.has(selector)) this.queries.set(selector, new Element());
    return this.queries.get(selector);
  }
  focus() { document.activeElement = this; }
  contains(element) { return element === this || [...this.queries.values()].some(node => node.contains(element)); }
  click() { this.dispatchEvent(new Event('click')); }
}

test('current briefing, answer, next/reset/clear, and final catalog boundary', async t => {
  const saved = { document: globalThis.document, window: globalThis.window };
  globalThis.document = { createElement: () => new Element(), activeElement: new Element() };
  globalThis.window = { confirm: () => true };
  t.after(() => Object.assign(globalThis, saved));
  const viewport = new Element();
  let code = '';
  let resets = 0;
  let selected = 1;
  const ui = mountChallengeUI({
    viewport,
    editor: { getCode: () => code, setCode: value => { code = value; } },
    runCode() {},
    getChallengeId: () => selected,
    onAdvance(level) { assert.equal(code, ''); selected = level; resets++; },
  });
  const [feedback, overlay] = viewport.children;
  for (let i = 0; i < 12; i++) {
    assert.equal(ui.currentChallenge, CHALLENGES[i]);
    assert.ok(CHALLENGES[i].title.startsWith('Challenge ' + (i + 1) + ' \u2014 '));
    assert.equal(overlay.querySelector('h2').textContent, CHALLENGES[i].title);
    assert.equal(overlay.querySelector('code').textContent, CHALLENGES[i].example);
    assert.equal(overlay.querySelector('#challenge-briefing-help').querySelector('p').textContent, CHALLENGES[i].help);
    overlay.querySelector('[data-action="answer"]').click();
    assert.equal(code, CHALLENGES[i].example);
    assert.equal(ui.hasNextChallenge(), i + 1 < 12);
    if (ui.hasNextChallenge()) {
      ui.setComplete(true);
      assert.equal(await ui.nextChallenge(), true);
      assert.equal(code, '');
      assert.equal(feedback.classList.contains('hidden'), true);
      assert.equal(overlay.classList.contains('hidden'), false);
      assert.equal(overlay.querySelector('[data-action="info"]').textContent, 'More Info');
    }
  }
  assert.equal(await ui.nextChallenge(), false);
  assert.equal(resets, 11);
  assert.equal(Object.isFrozen(CHALLENGES), true);
  assert.equal(CHALLENGES.every(Object.isFrozen), true);
});

test('dropdown jumps and Next share selected stage, objective, UI and reward config', async t => {
  const saved = globalThis.document;
  globalThis.document = { createElement: () => new Element(), activeElement: new Element() };
  t.after(() => { globalThis.document = saved; });
  let selected = 1, dropdown = 1, stage = 'challenge-1', config;
  const viewport = new Element();
  const select = level => selectChallengeLevel(level, {
    setLevel: id => { selected = dropdown = id; },
    reset: () => { stage = `challenge-${selected}`; config = CHALLENGE_LEVEL_CONFIG[selected]; },
    stop() {}, show: () => ui.show(),
  });
  const ui = mountChallengeUI({ viewport, editor: { setCode() {} }, runCode() {},
    getChallengeId: () => selected, onAdvance: select });
  const verify = id => {
    assert.equal(selected, id);
    assert.equal(dropdown, id);
    assert.equal(stage, `challenge-${id}`);
    assert.equal(ui.currentChallenge.id, id);
    assert.equal(viewport.children[1].querySelector('h2').textContent, CHALLENGES[id - 1].title);
    assert.equal(config, CHALLENGE_LEVEL_CONFIG[id]);
  };
  select(3); verify(3);
  await ui.nextChallenge(); verify(4);
  select(1); select(8); verify(8);
  select(9); await ui.nextChallenge(); verify(10);
  await ui.nextChallenge(); verify(11);
  await ui.nextChallenge(); verify(12);
  assert.equal(ui.hasNextChallenge(), false);
  assert.equal(select(13), false);
  assert.deepEqual(CHALLENGE_LEVEL_CONFIG[6].goldStar, { position: [-0.4, 8.3, -37.6], scale: 0.6 });
  assert.deepEqual(CHALLENGE_LEVEL_CONFIG[7].goldStar, { position: [35, 2, 42.7], scale: 0.2 });
  assert.deepEqual(CHALLENGE_LEVEL_CONFIG[8].playerPosition, [30.973, 17.950, 24.599]);
  assert.deepEqual(CHALLENGE_LEVEL_CONFIG[8].playerDirection, [-0.999, 0, 0.050]);
  assert.equal(Object.keys(CHALLENGE_LEVEL_CONFIG).length, 12);
  assert.equal(CHALLENGES[11].validation, CHALLENGES[0].validation);
  assert.equal(CHALLENGES[11].objective, CHALLENGES[0].objective);
  assert.deepEqual(CHALLENGE_LEVEL_CONFIG[10].playerPosition, [44.661, 22.250, -15.425]);
  assert.deepEqual(CHALLENGE_LEVEL_CONFIG[10].playerDirection, [0.078, 0, 0.997]);
  assert.deepEqual(CHALLENGE_LEVEL_CONFIG[10].goldStar, { position: [-28, 12, -31.1], scale: 1.0 });
  assert.deepEqual(CHALLENGE_LEVEL_CONFIG[11].playerPosition, [24.627, 0.950, 40.763]);
  assert.deepEqual(CHALLENGE_LEVEL_CONFIG[11].playerDirection, [0.042, 0, -0.999]);
  assert.deepEqual(CHALLENGE_LEVEL_CONFIG[11].goldStar, { position: [23.5, 28, 42.3], scale: 0.9 });
  for (const id of [10, 11]) assert.equal('temporaryInspection' in CHALLENGE_LEVEL_CONFIG[id], false);
  assert.deepEqual(CHALLENGE_LEVEL_CONFIG[1].playerPosition, [-22.520, 2.700, -18.584]);
  assert.deepEqual(CHALLENGE_LEVEL_CONFIG[1].playerDirection, [-0.589, 0, 0.808]);
  assert.deepEqual(CHALLENGE_LEVEL_CONFIG[1].goldStar, { position: [23.7, 6, -20.4], scale: 0.2 });
  const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
  for (const id of [10, 11, 12]) assert.ok(html.includes(`data-challenge-level="${id}"`));
});
