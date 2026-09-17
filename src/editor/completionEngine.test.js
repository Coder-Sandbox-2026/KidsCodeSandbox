import { test } from 'node:test';
import assert from 'node:assert/strict';
import { API_DOCS, MEMBER_DOCS, PLAYER_DOCS, findCompletion } from './apiCompletions.js';
import { registerAutocomplete, bindOptionSuggestionScope } from './AutocompleteProvider.js';
import {
  asTokenTemplate,
  buildCompletion,
  completeLine,
  globalNameMatchRank,
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
  assert.doesNotMatch(guided, /position:/);
  assert.match(guided, /color:/);
  assert.doesNotMatch(guided, /physics:/);
  assert.doesNotMatch(high, /position:/);
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


import { optionContext, currentPositionText, withCurrentPosition } from './completionEngine.js';

test('option suggestions use the called API and omit used fields and unsafe contexts', () => {
  const options = source => optionContext(source, API_DOCS, PLAYER_DOCS);
  assert.ok(options('createCube({\n ma').some(p => p.name === 'mass'));
  assert.ok(!options('playTyphoon({ ma').some(p => p.name === 'mass'));
  assert.ok(!options('createCube({ mass: 1, ma').some(p => p.name === 'mass'));
  assert.ok(options('createCube({ position: [0, 3, -5], co').some(p => p.name === 'color'));
  assert.ok(options('player.setSettings({ wa').some(p => p.name === 'walkSpeed'));
  for (const source of ['unknown({ ma', 'obj.createCube({ ma', 'createCube({ position: [ma',
    'createCube({ nested: { ma', 'createCube({ color: "ma', '/* createCube({ ma',
    'print({ ma', 'createCube({ mass: ma']) assert.equal(options(source), null, source);
});

test('completion positions are rounded on demand with safe static fallback', () => {
  const position = currentPositionText(() => ({ x: 1.00012, y: 4.9, z: -31.1223000009 }));
  assert.equal(position, '[1.0, 4.9, -31.1]');
  const template = 'createCube({ position: [0, 3, -5] })';
  assert.equal(withCurrentPosition(template, position), 'createCube({ position: [1.0, 4.9, -31.1] })');
  assert.equal(withCurrentPosition(template, currentPositionText(() => null)), template);
  assert.equal(currentPositionText(() => { throw Error('not ready'); }), null);
  assert.equal(currentPositionText(() => ({ x: NaN, y: 0, z: 0 })), null);
});


test('placement templates omit position but position remains a valid option', () => {
  for (const item of API_DOCS.filter(item => item.label.startsWith('create') && item.options)) {
    for (const level of ['guided', 'high']) {
      assert.doesNotMatch(buildCompletion(item, { level }).insertText, /position\s*:/, item.label);
    }
    assert.ok(optionContext(item.label + '({ pos', API_DOCS, PLAYER_DOCS).some(p => p.name === 'position'));
  }
});

function completionProvider() {
  let provider;
  registerAutocomplete({ languages: {
    CompletionItemKind: { Function: 1, Method: 2, Property: 3 },
    CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
    registerCompletionItemProvider(_language, registered) { provider = registered; },
    registerHoverProvider() {},
  } });
  return provider;
}

// The marker represents the cursor, including when the closing braces exist.
function suggestionsAt(provider, source) {
  const offset = source.indexOf('|');
  const before = source.slice(0, offset);
  const lines = source.replace('|', '').split('\n');
  const lineNumber = before.split('\n').length;
  const column = before.split('\n').at(-1).length + 1;
  const word = before.match(/[\w$]*$/)[0];
  return provider.provideCompletionItems({
    getWordUntilPosition: () => ({ startColumn: column - word.length, endColumn: column }),
    getLineContent: number => lines[number - 1],
    getValueInRange: () => before,
  }, { lineNumber, column });
}

test('global API discovery matches meaningful words and preserves Monaco metadata', () => {
  const provider = completionProvider();
  const api = findCompletion('createGoldStar');
  assert.ok(api, 'authoritative GoldStar API spelling');
  const original = suggestionsAt(provider, 'createG|').suggestions.find(s => s.label === api.label);
  for (const query of ['star', 'gold', 'create', 'createG', 'goldstar', 'STAR', 'oldst']) {
    const found = suggestionsAt(provider, `${query}|`).suggestions.find(s => s.label === api.label);
    assert.ok(found, query);
    assert.ok(found.filterText.toLowerCase().startsWith(query.toLowerCase()), query);
    for (const field of ['kind', 'insertText', 'insertTextRules', 'detail', 'documentation']) {
      assert.deepEqual(found[field], original[field], field);
    }
  }
  assert.ok(suggestionsAt(provider, 'create|').suggestions.some(s => s.label === 'createCube'));
  assert.equal(globalNameMatchRank('create_GoldStar', 'create_G'), 0);
  assert.equal(globalNameMatchRank('create_GoldStar', 'star'), 1);
  assert.equal(globalNameMatchRank('create_GoldStar', 'goldstar'), 2);
  assert.equal(globalNameMatchRank('create_GoldStar', 'oldst'), 2);
  assert.equal(globalNameMatchRank('create_GoldStar', 'xyz'), -1);
  const gold = suggestionsAt(provider, 'gold|').suggestions.find(s => s.label === api.label);
  assert.ok(original.sortText < gold.sortText);
});

test('global word matching stays isolated from properties, members, strings and comments', () => {
  const provider = completionProvider();
  for (const source of ['createCube({\n star|\n});', 'player.star|',
    'const x = "star|";', '// star|']) {
    assert.deepEqual(suggestionsAt(provider, source).suggestions, [], source);
  }
  assert.deepEqual(suggestionsAt(provider, 'createCone({\n po|\n});').suggestions.map(s => s.label), ['position']);
  assert.deepEqual(suggestionsAt(provider, 'createCone({\n sit|\n});').suggestions, []);
});

test('Monaco provider refreshes options on object entry and continued typing', () => {
  const provider = completionProvider();
  assert.ok(provider.triggerCharacters.includes('{'));
  assert.equal(suggestionsAt(provider, 'create|').incomplete, true);
  for (const api of ['createCube', 'createSphere', 'createCone', 'createCylinder', 'createPlane', 'createCake', 'createGoldCoin']) {
    for (const prefix of ['', 'p', 'po']) {
      const result = suggestionsAt(provider, `${api}({\n    ${prefix}|\n});`);
      assert.equal(result.incomplete, true);
      const matching = result.suggestions.filter(item => item.filterText.startsWith(prefix));
      assert.equal(matching.length, result.suggestions.length);
      assert.ok(matching.some(item => item.label === 'position'), `${api}: ${prefix}`);
      if (prefix !== 'po') assert.ok(matching.some(item => item.label === 'physics'));
      const position = matching.find(item => item.label === 'position');
      assert.equal(position.range.startColumn, 5);
      assert.equal(position.range.endColumn, 5 + prefix.length);
      assert.match(position.insertText, /^position(?:$|:)/);
    }
  }
  for (const [source, expected] of [
    ['createSphere({\n color: "green",\n phy|\n});', 'physics'],
    ['createCylinder({\n color: "red",\n ph|\n});', 'physics'],
    ['createSphere({ po| });', 'position'],
    ['createCone({\n color: "green",\n physics: true,\n p|\n});', 'position'],
  ]) {
    const items = suggestionsAt(provider, source).suggestions;
    assert.ok(items.some(item => item.label === expected), source);
    if (source.includes('color:')) assert.ok(!items.some(item => item.label === 'color'));
    if (source.includes('physics: true')) assert.ok(!items.some(item => item.label === 'physics'));
  }
});

test('commas do not trigger API suggestions but subsequent property typing does', () => {
  const provider = completionProvider();
  // Monaco requests character-triggered completion only for registered triggers.
  assert.ok(!provider.triggerCharacters.includes(','));
  assert.ok(!provider.triggerCharacters.includes('\n'));
  assert.ok(!provider.triggerCharacters.includes(' '));
  for (const prefix of ['p', 'po']) {
    const result = suggestionsAt(provider, `createCone({\n    color: "green",\n    ${prefix}|\n});`);
    const matching = result.suggestions.filter(item => item.filterText.startsWith(prefix));
    assert.ok(matching.some(item => item.label === 'position'));
    if (prefix === 'p') assert.ok(matching.some(item => item.label === 'physics'));
    assert.ok(!result.suggestions.some(item => item.label === 'color'));
  }
});

test('Monaco option completions preserve value and ordinary JavaScript contexts', () => {
  const provider = completionProvider();
  for (const source of ['const obj = { p| };', 'unknown({ p| });', 'createCone({ physics: p| });']) {
    const items = suggestionsAt(provider, source).suggestions;
    assert.ok(!items.some(item => item.label === 'physics' || item.label === 'position'), source);
    assert.deepEqual(items, []);
  }
  assert.deepEqual(suggestionsAt(provider, 'createCone({ color: "gr|" });').suggestions, []);
  assert.deepEqual(suggestionsAt(provider, 'foo.|').suggestions, []);
  assert.ok(suggestionsAt(provider, 'const foo = createCube({});\nfoo.|').suggestions.some(item => item.label === 'position'));
  const existingColon = suggestionsAt(provider, 'createCone({ po|: [0, 1, 2] });').suggestions;
  assert.equal(existingColon.find(item => item.label === 'position').insertText, 'position');
});

test('custom suggestions require a supported context and matching metadata', () => {
  const provider = completionProvider();
  for (const source of ['.|', ',|', 'crea.|', 'createCone({ xyz| });',
    'const x = { crea| };', 'const s = "crea|";', '// crea|',
    '/* comment\ncrea|\n*/', 'const s = `text\ncrea|`;',
    'createCone({ color: crea| });', 'createCone({ position: [1, crea|, 3] });',
    'createCone({ nested: { crea| } });', 'const list = [crea|];']) {
    assert.deepEqual(suggestionsAt(provider, source).suggestions, [], source);
  }
  assert.deepEqual(suggestionsAt(provider, 'createCone({ p| });').suggestions.map(item => item.label), ['position', 'physics']);
  assert.deepEqual(suggestionsAt(provider, 'createCone({ po| });').suggestions.map(item => item.label), ['position']);
  assert.deepEqual(suggestionsAt(provider, 'createCone({ color: "red", po| });').suggestions.map(item => item.label), ['position']);
  assert.deepEqual(suggestionsAt(provider, 'createCone({ position: [1, 2, 3], p| });').suggestions.map(item => item.label), ['physics']);
  const globals = suggestionsAt(provider, 'const cube = crea|').suggestions;
  assert.ok(globals.some(item => item.label === 'createCone'));
  assert.ok(globals.every(item => item.label.startsWith('crea')));
  const members = suggestionsAt(provider, 'player.|').suggestions;
  assert.ok(members.some(item => item.label === 'setWalkSpeed'));
  assert.ok(!members.some(item => item.label === 'createCone'));
  assert.ok(suggestionsAt(provider, 'player.setW|').suggestions.every(item => item.label.startsWith('setW')));
});

test('used options never fall back to global suggestions and keep Property kinds', () => {
  const provider = completionProvider();
  for (const api of ['createCube', 'createSphere', 'createCone', 'createCylinder', 'createPlane']) {
    assert.deepEqual(suggestionsAt(provider, `${api}({\n position: [0, 3, -5],\n color: "red",\n physics: true,\n p|\n});`).suggestions, []);
  }
  for (const [body, expected] of [
    ['color: "red",\n po', 'position'], ['position: [0, 3, -5],\n po', null],
    ['phy', 'physics'], ['physics: true,\n phy', null],
  ]) {
    const items = suggestionsAt(provider, `createCube({\n ${body}|\n});`).suggestions;
    assert.deepEqual(items.map(item => item.label), expected ? [expected] : []);
    for (const item of items) assert.equal(item.kind, 3); // Property, not Text
  }
});

test('document-word suggestions are disabled only in API option-property context', () => {
  let source = 'createCube({\n position: [0, 3, -5],\n color: "red",\n physics: true,\n p';
  const events = {};
  const changes = [];
  const subscribe = name => callback => {
    events[name] = callback;
    return { dispose() {} };
  };
  bindOptionSuggestionScope({
    getRawOptions: () => ({ wordBasedSuggestions: 'currentDocument' }),
    getModel: () => ({ getValueInRange: () => source }),
    getPosition: () => ({ lineNumber: 5, column: 3 }),
    updateOptions: options => changes.push(options.wordBasedSuggestions),
    onDidChangeCursorPosition: subscribe('cursor'),
    onDidChangeModelContent: subscribe('content'),
    onDidChangeModel: subscribe('model'),
    onDidDispose: subscribe('dispose'),
  });
  assert.deepEqual(changes, ['off']);
  source = 'createCube({ color: "red", po';
  events.content();
  assert.deepEqual(changes, ['off']);
  for (const outside of ['createCube({ color: "', 'createCube({ position: [1, ', 'print', 'const obj = { p']) {
    source = outside;
    events.cursor();
    assert.equal(changes.at(-1), 'currentDocument');
    source = 'createCube({ phy';
    events.model();
    assert.equal(changes.at(-1), 'off');
  }
  events.dispose();
});
