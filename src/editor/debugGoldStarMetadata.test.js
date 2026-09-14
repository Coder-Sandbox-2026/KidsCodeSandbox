import { test } from 'node:test';
import { execFileSync } from 'node:child_process';

async function checkMetadata(enabled, base) {
  const { default: assert } = await import('node:assert/strict');
  const { registerHooks } = await import('node:module');
  registerHooks({ load(url, context, next) {
    const result = next(url, context);
    if (url.endsWith('/debugGoldStarConfig.js')) return {
      ...result, source: String(result.source).replace('import.meta.env?.DEV === true', String(enabled)),
    };
    return result;
  }});
  const { API_DOCS, SHAPE_OPTIONS, findCompletion } = await import(new URL('./apiCompletions.js', base));
  const { GAME_API_DTS } = await import(new URL('./gameApiTypes.js', base));
  const { resolveCompletionInsert } = await import(new URL('./codeCoach.js', base));
  const { formatFriendlyError } = await import(new URL('./ErrorHandler.js', base));
  const entry = API_DOCS.find(item => item.label === 'createDebugGoldStar');
  assert.equal(Boolean(entry), enabled);
  assert.equal(GAME_API_DTS.includes('declare function createDebugGoldStar(options?: ShapeOptions): GameObject;'), enabled);
  assert.deepEqual(API_DOCS.filter(item => /debug/i.test(item.label)).map(item => item.label), enabled ? ['createDebugGoldStar'] : []);
  for (const typo of ['createDebugGoldstar', 'creatDebugGoldStar']) {
    const result = formatFriendlyError(new ReferenceError(typo + ' is not defined'), '').friendly;
    assert.equal(result.includes('Did you mean "createDebugGoldStar"?'), enabled);
  }
  if (entry) {
    assert.equal(entry.options, SHAPE_OPTIONS);
    assert.match(entry.doc, /development/i);
    assert.match(entry.doc, /GameObject/);
    for (const level of ['off', 'basic', 'guided', 'high']) {
      const result = resolveCompletionInsert(entry, level).insertText;
      assert.match(result, /^createDebugGoldStar/);
      if (level === 'guided' || level === 'high') assert.match(result, /position:.*\[0, 2, 0\]/);
    }
  }
  assert(findCompletion('createGoldCoin'));
}

for (const enabled of [false, true]) {
  test('debug star editor metadata enabled=' + enabled, () => {
    // Fresh processes exercise both states of the shared runtime flag.
    const code = '(' + checkMetadata.toString() + ')(' + enabled + ', ' + JSON.stringify(import.meta.url) + ')';
    execFileSync(process.execPath, ['--input-type=module', '-e', code], { stdio: 'pipe' });
  });
}
