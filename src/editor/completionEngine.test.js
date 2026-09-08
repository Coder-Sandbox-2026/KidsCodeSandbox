import { test } from 'node:test';
import assert from 'node:assert/strict';
import { API_DOCS, MEMBER_DOCS, PLAYER_DOCS, findCompletion } from './apiCompletions.js';
import {
  asTokenTemplate,
  buildCompletion,
  completeLine,
  isInCommentOrString,
  replaceWord,
} from './completionEngine.js';

function item(label, completion) {
  return { label, kind: 'Function', completion: { kind: 'token', ...completion } };
}

const getPlayer = findCompletion('getPlayer');
const createCube = findCompletion('createCube');
const onKeyDown = findCompletion('onKeyDown');
const onKeyPressed = findCompletion('onKeyPressed');
const onKeyReleased = findCompletion('onKeyReleased');
const onCollision = findCompletion('onCollision', MEMBER_DOCS);
const setWalkSpeed = findCompletion('setWalkSpeed', PLAYER_DOCS);
const color = findCompletion('color', MEMBER_DOCS);

function complete(line, start, api, level = 'high') {
  return completeLine(line, start, api, level);
}

function wordStart(line, token) {
  return line.lastIndexOf(token) + 1;
}

function insertOf(api, line, token, level) {
  const start = wordStart(line, token);
  const end = start + (line.slice(start - 1).match(/^\w*/)?.[0].length || 0);
  return buildCompletion(api, {
    level,
    line,
    wordStartColumn: start,
    wordEndColumn: end,
  });
}

// --- Dimension A: replacement safety (range stays the current word) ---

test('assignment: only the partial identifier is replaced', () => {
  const line = 'const player = get';
  const start = wordStart(line, 'get');
  assert.equal(complete(line, start, getPlayer, 'off'), 'const player = getPlayer');
  assert.equal(complete(line, start, getPlayer, 'basic'), 'const player = getPlayer();');
  assert.equal(complete(line, start, getPlayer, 'guided'), 'const player = getPlayer();');
  assert.equal(complete(line, start, getPlayer, 'high'), 'const player = getPlayer();');
  assert.doesNotMatch(complete(line, start, getPlayer, 'high'), /const player = const player/);
});

test('let / var assignments keep the declaration', () => {
  assert.equal(complete('let player = get', wordStart('let player = get', 'get'), getPlayer, 'basic'), 'let player = getPlayer();');
  assert.equal(complete('var player = get', wordStart('var player = get', 'get'), getPlayer, 'basic'), 'var player = getPlayer();');
  assert.equal(complete('const cube = create', wordStart('const cube = create', 'create'), createCube, 'basic'), 'const cube = createCube();');
});

test('member access keeps the object prefix', () => {
  assert.equal(
    complete('player.set', 8, setWalkSpeed, 'basic'),
    'player.setWalkSpeed();'
  );
  const out = complete('coin.onCol', 6, onCollision, 'high');
  assert.match(out, /^coin\.onCollision\(/);
  assert.doesNotMatch(out, /coin\.coin/);
});

test('nested expressions keep surrounding source', () => {
  assert.equal(complete('print(get', 7, getPlayer, 'basic'), 'print(getPlayer()');
  assert.equal(complete('print(get', 7, getPlayer, 'high'), 'print(getPlayer()');
  assert.equal(complete('distance(get', 10, getPlayer, 'basic'), 'distance(getPlayer()');
  assert.equal(complete('if (get', 5, getPlayer, 'basic'), 'if (getPlayer()');
  assert.equal(complete('random(get', 8, getPlayer, 'basic'), 'random(getPlayer()');
});

test('whitespace before the token is preserved', () => {
  const line = 'const player =     get';
  const start = wordStart(line, 'get');
  assert.equal(complete(line, start, getPlayer, 'basic'), 'const player =     getPlayer();');
});

test('already-typed parentheses are not duplicated', () => {
  assert.equal(complete('getPlayer(', 1, getPlayer, 'high'), 'getPlayer(');
  assert.equal(complete('createCube(', 1, createCube, 'high'), 'createCube(');
  assert.equal(complete('onKeyDown(', 1, onKeyDown, 'high'), 'onKeyDown(');
});

test('mid-line comment after the token is preserved', () => {
  const line = 'const player = get // note';
  const start = wordStart(line, 'get');
  assert.equal(complete(line, start, getPlayer, 'basic'), 'const player = getPlayer(); // note');
});

test('callback body assignment', () => {
  const line = '    const player = get';
  const start = wordStart(line, 'get');
  assert.equal(complete(line, start, getPlayer, 'high'), '    const player = getPlayer();');
});

test('accidental full-statement templates are clipped to the token', () => {
  const wrapped = item('getPlayer', {
    off: 'getPlayer',
    basic: 'getPlayer()',
    guided: 'getPlayer()',
    high: 'const player = getPlayer();',
  });
  const line = 'const player = get';
  const start = wordStart(line, 'get');
  assert.equal(complete(line, start, wrapped, 'high'), 'const player = getPlayer();');
  assert.equal(asTokenTemplate('getPlayer', 'const player = getPlayer();'), 'getPlayer();');
  assert.equal(asTokenTemplate('wait', 'await wait(1000)'), 'wait(1000)');
});

test('asTokenTemplate keeps rich API scaffolds intact', () => {
  const scaffold = 'onKeyDown("${1:KeyE}", () => {\n\t${0}\n})';
  assert.equal(asTokenTemplate('onKeyDown', scaffold), scaffold);
  const collision = 'onCollision((${1:other}) => {\n\t${0}\n})';
  assert.equal(asTokenTemplate('onCollision', collision), collision);
});

test('assignment property templates only apply after a dot', () => {
  const member = complete('cube.col', 6, color, 'high');
  assert.match(member, /^cube\.color = /);
  const assign = complete('const c = col', 11, color, 'high');
  assert.equal(assign, 'const c = color');
});

test('buildCompletion range is always the word columns', () => {
  const built = buildCompletion(getPlayer, {
    level: 'high',
    line: 'const player = get',
    wordStartColumn: 16,
    wordEndColumn: 19,
  });
  assert.deepEqual(built.range, { startColumn: 16, endColumn: 19 });
  assert.equal(replaceWord('const player = get', 16, 19, built.insertText), 'const player = getPlayer();');
  assert.doesNotMatch(built.insertText, /const player/);
});

test('comments and strings are ignorable contexts', () => {
  assert.equal(isInCommentOrString('// get', 6), true);
  assert.equal(isInCommentOrString('const text = "get"', 17), true);
  assert.equal(isInCommentOrString('const player = get', 18), false);
});

// --- Dimension B: Code Coach richness from live API metadata ---

test('live getPlayer metadata is token-scoped, not a statement snippet', () => {
  assert.equal(getPlayer.completion.off, 'getPlayer');
  assert.equal(getPlayer.completion.basic, 'getPlayer()');
  assert.equal(getPlayer.completion.guided, 'getPlayer()');
  assert.equal(getPlayer.completion.high, 'getPlayer()');
  assert.doesNotMatch(getPlayer.completion.high, /const player/);
});

test('getPlayer Code Coach levels after const player = get', () => {
  const line = 'const player = get';
  assert.equal(complete(line, wordStart(line, 'get'), getPlayer, 'off'), 'const player = getPlayer');
  assert.equal(complete(line, wordStart(line, 'get'), getPlayer, 'basic'), 'const player = getPlayer();');
  assert.equal(complete(line, wordStart(line, 'get'), getPlayer, 'guided'), 'const player = getPlayer();');
  assert.equal(complete(line, wordStart(line, 'get'), getPlayer, 'high'), 'const player = getPlayer();');
});

test('onKeyDown High keeps parameter and callback scaffold', () => {
  const line = 'onKey';
  assert.equal(complete(line, 1, onKeyDown, 'off'), 'onKeyDown');
  assert.equal(complete(line, 1, onKeyDown, 'basic'), 'onKeyDown();');

  const guided = complete(line, 1, onKeyDown, 'guided');
  const high = complete(line, 1, onKeyDown, 'high');
  assert.match(guided, /onKeyDown\("\$\{1:KeyE\}", \(\) => \{/);
  assert.match(high, /onKeyDown\("\$\{1:KeyE\}", \(\) => \{/);
  assert.match(high, /\}\);?\s*$/);
  assert.doesNotMatch(high, /^onKeyDown\(\);?\s*$/);

  const built = insertOf(onKeyDown, line, 'onKey', 'high');
  assert.deepEqual(built.range, { startColumn: 1, endColumn: 6 });
  assert.match(built.insertText, /KeyE/);
  assert.doesNotMatch(built.insertText, /^onKeyDown\(\);?$/);
});

test('onKeyPressed and onKeyReleased High keep callback scaffolds', () => {
  assert.equal(complete('onKeyP', 1, onKeyPressed, 'off'), 'onKeyPressed');
  assert.equal(complete('onKeyP', 1, onKeyPressed, 'basic'), 'onKeyPressed();');
  assert.match(complete('onKeyP', 1, onKeyPressed, 'high'), /onKeyPressed\("\$\{1:KeyE\}", \(\) => \{/);
  assert.doesNotMatch(complete('onKeyP', 1, onKeyPressed, 'high'), /^onKeyPressed\(\);?\s*$/);

  assert.equal(complete('onKeyR', 1, onKeyReleased, 'off'), 'onKeyReleased');
  assert.match(complete('onKeyR', 1, onKeyReleased, 'high'), /onKeyReleased\("\$\{1:KeyE\}", \(\) => \{/);
  assert.doesNotMatch(complete('onKeyR', 1, onKeyReleased, 'high'), /^onKeyReleased\(\);?\s*$/);
});

test('onCollision High keeps callback scaffold and the object prefix', () => {
  const line = 'coin.onCol';
  assert.equal(complete(line, 6, onCollision, 'off'), 'coin.onCollision');
  assert.equal(complete(line, 6, onCollision, 'basic'), 'coin.onCollision();');

  const high = complete(line, 6, onCollision, 'high');
  assert.match(high, /^coin\.onCollision\(\(\$\{1:other\}\) => \{/);
  assert.doesNotMatch(high, /^coin\.onCollision\(\);?\s*$/);
  assert.doesNotMatch(high, /coin\.coin/);
});

test('createCube Guided and High stay richer than Basic', () => {
  const line = 'create';
  assert.equal(complete(line, 1, createCube, 'off'), 'createCube');
  assert.equal(complete(line, 1, createCube, 'basic'), 'createCube();');

  const guided = complete(line, 1, createCube, 'guided');
  const high = complete(line, 1, createCube, 'high');
  assert.match(guided, /position:/);
  assert.match(guided, /color:/);
  assert.doesNotMatch(guided, /physics:/);
  assert.match(high, /position:/);
  assert.match(high, /physics:\s*true/);
  assert.notEqual(guided, 'createCube();');
  assert.notEqual(high, 'createCube();');
});

test('every live API completion is token-scoped and keeps High richer than Basic when metadata differs', () => {
  const catalogs = [API_DOCS, MEMBER_DOCS, PLAYER_DOCS];
  for (const catalog of catalogs) {
    for (const api of catalog) {
      const { off, basic, guided, high } = api.completion;
      assert.equal(api.completion.kind, 'token');
      assert.doesNotMatch(off, /^(const|let|var)\s+/);
      assert.doesNotMatch(basic, /^(const|let|var)\s+/);
      assert.doesNotMatch(guided, /^(const|let|var)\s+/);
      assert.doesNotMatch(high, /^(const|let|var)\s+/);
      assert.match(off, new RegExp(`^${api.label}\\b`));
      assert.match(high, new RegExp(`^${api.label}\\b`));
      assert.equal(asTokenTemplate(api.label, high), high, `${api.label} High must stay an API template`);

      if (guided !== basic) {
        assert.notEqual(guided, `${api.label}()`, `${api.label} Guided must not collapse to empty ()`);
      }
      if (high !== basic) {
        assert.notEqual(high, `${api.label}()`, `${api.label} High must not collapse to empty ()`);
      }
    }
  }
});
