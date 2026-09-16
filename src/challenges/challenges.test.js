import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHALLENGES } from './challengeCatalog.js';
import { createChallengeValidator } from './challengeValidation.js';
import { mountChallengeUI } from './ChallengeUI.js';

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
  const ui = mountChallengeUI({
    viewport,
    editor: { getCode: () => code, setCode: value => { code = value; } },
    runCode() {},
    onAdvance() { assert.equal(code, ''); resets++; },
  });
  const [feedback, overlay] = viewport.children;
  for (let i = 0; i < CHALLENGES.length; i++) {
    assert.equal(ui.currentChallenge, CHALLENGES[i]);
    assert.equal(overlay.querySelector('h2').textContent, CHALLENGES[i].title);
    assert.equal(overlay.querySelector('code').textContent, CHALLENGES[i].example);
    assert.equal(overlay.querySelector('#challenge-briefing-help').querySelector('p').textContent, CHALLENGES[i].help);
    overlay.querySelector('[data-action="answer"]').click();
    assert.equal(code, CHALLENGES[i].example);
    assert.equal(ui.hasNextChallenge(), i + 1 < CHALLENGES.length);
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
  assert.equal(resets, CHALLENGES.length - 1);
  assert.equal(Object.isFrozen(CHALLENGES), true);
  assert.equal(CHALLENGES.every(Object.isFrozen), true);
});
