import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RunLifecycle, RunCancelledError } from './RunLifecycle.js';

test('generations are unique and invalidation cancels every pending wait', async () => {
  const runs = new RunLifecycle();
  const first = runs.begin();
  const a = first.wait(60_000);
  const b = first.wait(60_000);
  const second = runs.begin();
  assert.notEqual(first.id, second.id);
  assert.equal(first.active, false);
  assert.equal(second.active, true);
  await assert.rejects(a, RunCancelledError);
  await assert.rejects(b, RunCancelledError);
  assert.equal(first.waits.size, 0);
  runs.invalidate();
  assert.equal(second.active, false);
});

test('current waits resolve and remove their cancellation registration', async () => {
  const run = new RunLifecycle().begin();
  await run.wait(0);
  assert.equal(run.waits.size, 0);
});

test('retained views, nested values and extracted methods check ownership', () => {
  const runs = new RunLifecycle();
  const first = runs.begin();
  const raw = { vector: { x: 1, set(x) { this.x = x; return this; } } };
  const view = first.view(raw);
  const vector = view.vector;
  const set = vector.set;
  assert.equal(first.view(raw), view);
  assert.equal(set(2), vector);
  assert.equal(raw.vector.x, 2);
  runs.begin();
  assert.throws(() => set(3), RunCancelledError);
  assert.throws(() => { vector.x = 3; }, RunCancelledError);
  assert.throws(() => Object.defineProperty(vector, 'x', { value: 3 }), RunCancelledError);
  assert.throws(() => { delete vector.x; }, RunCancelledError);
  assert.throws(() => view.vector, RunCancelledError);
  assert.equal(raw.vector.x, 2);
});

test('old results and errors are silent; current results and errors are reported', async () => {
  const runs = new RunLifecycle();
  const reports = [];
  const report = { success: () => reports.push('success'), error: e => reports.push(e.message) };
  let resume;
  const gate = new Promise(resolve => { resume = resolve; });
  const old = runs.begin();
  const success = old.execute('await gate;', { gate }, report);
  const failure = old.execute('await gate; throw new Error("old failure");', { gate }, report);
  const current = runs.begin();
  resume();
  await Promise.all([success, failure]);
  assert.deepEqual(reports, []);
  await current.execute('', {}, report);
  await current.execute('throw new Error("current failure");', {}, report);
  assert.deepEqual(reports, ['success', 'current failure']);
});

test('callbacks ignore stale invocation and stale asynchronous rejection', async () => {
  const runs = new RunLifecycle();
  const run = runs.begin();
  let calls = 0;
  let resume;
  const gate = new Promise(resolve => { resume = resolve; });
  const fn = async () => { calls++; await gate; throw new Error('late'); };
  const callback = run.callback(fn);
  assert.equal(run.callback(fn), callback);
  const pending = callback();
  runs.invalidate();
  callback();
  resume();
  await pending;
  assert.equal(calls, 1);
});
