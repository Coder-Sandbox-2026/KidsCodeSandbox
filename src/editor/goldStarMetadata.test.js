import { test } from 'node:test';
import { execFileSync } from 'node:child_process';

async function checkMetadata(enabled, base) {
  const { default: assert } = await import('node:assert/strict');
  const { registerHooks } = await import('node:module');
  registerHooks({
    resolve(specifier, context, next) {
      if (specifier.endsWith('?url')) return {
        url: `data:text/javascript,export default ${JSON.stringify(new URL(specifier, context.parentURL).href)}`,
        shortCircuit: true,
      };
      return next(specifier, context);
    },
    load(url, context, next) {
    const result = next(url, context);
    if (url.endsWith('/debugGoldStarConfig.js')) return {
      ...result, source: String(result.source).replace(/^export const DEBUG_GOLD_STAR_ENABLED = .*;$/m, `export const DEBUG_GOLD_STAR_ENABLED = ${enabled};`),
    };
    return result;
  }});
  const { API_DOCS, SHAPE_OPTIONS, findCompletion } = await import(new URL('./apiCompletions.js', base));
  const { GAME_API_DTS } = await import(new URL('./gameApiTypes.js', base));
  const { resolveCompletionInsert } = await import(new URL('./codeCoach.js', base));
  const { formatFriendlyError } = await import(new URL('./ErrorHandler.js', base));
  const { GameAPI } = await import(new URL('../api/GameAPI.js', base));
  const { createModelFactories } = await import(new URL('../api/ModelFactory.js', base));
  const api = Object.assign(Object.create(GameAPI.prototype), {
    engine: {}, shapes: {}, models: createModelFactories({}), _createConsole: () => ({}),
  });
  const scope = api.buildScope({ assertActive() {}, bind: fn => fn });
  assert.equal('createGoldStar' in scope, enabled);
  assert.equal(typeof api.models.createGoldStar, 'function');
  const entry = API_DOCS.find(item => item.label === 'createGoldStar');
  assert.equal(Boolean(entry), enabled);
  assert.equal(GAME_API_DTS.includes('declare function createGoldStar(options?: ShapeOptions): GoldStar;'), enabled);
  assert.deepEqual(API_DOCS.filter(item => /debug/i.test(item.label)).map(item => item.label), []);
  for (const typo of ['createGoldstar', 'creatGoldStar']) {
    const result = formatFriendlyError(new ReferenceError(typo + ' is not defined'), '').friendly;
    assert.equal(result.includes('Did you mean "createGoldStar"?'), enabled);
  }
  if (entry) {
    assert.equal(entry.options, SHAPE_OPTIONS);
    assert.match(entry.doc, /0.01/);
    assert.match(entry.doc, /GameObject/);
    for (const level of ['off', 'basic', 'guided', 'high']) {
      const result = resolveCompletionInsert(entry, level).insertText;
      assert.match(result, /^createGoldStar/);
      if (level === 'guided' || level === 'high') assert.match(result, /position:.*\[0, 2, 0\]/);
    }
  }
  assert(findCompletion('createGoldCoin'));
}

for (const enabled of [false, true]) {
  test('GoldStar API and editor exposure enabled=' + enabled, () => {
    // Fresh processes exercise both states of the shared runtime flag.
    const code = '(' + checkMetadata.toString() + ')(' + enabled + ', ' + JSON.stringify(import.meta.url) + ')';
    execFileSync(process.execPath, ['--input-type=module', '-e', code], { stdio: 'pipe' });
  });
}
