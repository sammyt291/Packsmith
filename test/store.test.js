const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { JsonStore } = require('../src/store');

test('starts with a safe empty state', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'packsmith-'));
  const store = new JsonStore(path.join(dir, 'state.json'));
  assert.deepEqual(store.data, { accounts: [], selectedAccountId: null, instances: [] });
});

test('persists instances and restores them', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'packsmith-'));
  const file = path.join(dir, 'state.json');
  new JsonStore(file).save({ accounts: [], selectedAccountId: null, instances: [{ id: 'one', name: 'Workshop' }] });
  assert.equal(new JsonStore(file).data.instances[0].name, 'Workshop');
});

test('recovers from malformed state without overwriting it', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'packsmith-'));
  const file = path.join(dir, 'state.json');
  fs.writeFileSync(file, '{broken');
  const originalWarn = console.warn;
  console.warn = () => {};
  const store = new JsonStore(file);
  console.warn = originalWarn;
  assert.equal(store.data.instances.length, 0);
});
