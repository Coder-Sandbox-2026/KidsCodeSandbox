import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSuccessSequence } from './SuccessSequence.js';

function harness() {
  const events = [];
  const pending = [];
  const gate = name => signal => new Promise(resolve => {
    events.push(name);
    pending.push({ resolve, signal });
  });
  const sequence = createSuccessSequence({
    play: name => events.push(name),
    flash: gate('flash'),
    wait: (ms, signal) => gate(ms)(signal),
    stop: () => events.push('stop'),
    show: () => events.push('show'),
    clear: () => events.push('clear'),
  });
  return { events, pending, sequence };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

test('collection waits for the entire flash, then 1s, sound, 4s, shared stop and one modal', async () => {
  const { events, pending, sequence } = harness();
  const completion = sequence.collect();
  assert.deepEqual(events, ['collect']);
  await sequence.collect();
  assert.deepEqual(events, ['collect', 'flash']);
  pending.shift().resolve();
  await flush();
  assert.deepEqual(events, ['collect', 'flash', 1000]);
  pending.shift().resolve();
  await flush();
  assert.deepEqual(events, ['collect', 'flash', 1000, 'success', 4000]);
  pending.shift().resolve();
  await completion;
  assert.deepEqual(events, ['collect', 'flash', 1000, 'success', 4000, 'stop', 'show']);
  await sequence.collect();
  assert.equal(events.filter(event => event === 'show').length, 1);
});

for (const stage of [0, 1, 2]) {
  test(`cancel during stage ${stage} prevents stale sounds, stops and modals`, async () => {
    const { events, pending, sequence } = harness();
    const completion = sequence.collect();
    await flush();
    for (let i = 0; i < stage; i++) {
      pending.shift().resolve();
      await flush();
    }
    sequence.cancel();
    assert(pending[0].signal.aborted);
    const count = events.length;
    pending.shift().resolve();
    await completion;
    assert.equal(events.length, count);
    assert(!events.includes('stop'));
    assert(!events.includes('show'));
    const next = sequence.collect();
    await flush();
    assert.equal(events.filter(event => event === 'collect').length, 2);
    sequence.cancel();
    pending.shift().resolve();
    await next;
  });
}
