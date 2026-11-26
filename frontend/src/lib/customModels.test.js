import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getCustomModels, saveCustomModels } from './customModels.js';

function mockStorage(t) {
  const values = new Map();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  } });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  });
  saveCustomModels([]);
  return values;
}

test('legacy credentials migrate to memory and disappear from persisted metadata', t => {
  const storage = mockStorage(t);
  storage.set('custom_ai_models', JSON.stringify([{ id: 'model', provider: 'openai', model_name: 'example', api_key: 'private-key', unexpected_secret: 'private-value' }]));
  const [model] = getCustomModels();
  assert.equal(model.api_key, 'private-key');
  assert.equal(model.requires_api_key, true);
  assert.equal(storage.get('custom_ai_models').includes('private-'), false);
  assert.equal(getCustomModels()[0].api_key, 'private-key');
});

test('omitted keys survive edits in the same page while explicit clear removes them', t => {
  const storage = mockStorage(t);
  const model = { id: 'model', provider: 'custom', model_name: 'example', base_url: 'http://localhost:1234', api_key: 'private-key' };
  saveCustomModels([model]);
  const { api_key: ignoredKey, ...metadata } = getCustomModels()[0];
  assert.equal(ignoredKey, 'private-key');
  assert.equal(saveCustomModels([{ ...metadata, name: 'Renamed' }])[0].api_key, 'private-key');
  assert.equal(saveCustomModels([{ ...metadata, api_key: '' }])[0].api_key, undefined);
  assert.equal(storage.get('custom_ai_models').includes('private-key'), false);
});

test('credential identity changes prevent another endpoint from inheriting a key', t => {
  mockStorage(t);
  saveCustomModels([{ id: 'model', provider: 'custom', model_name: 'example', base_url: 'http://localhost:1234', api_key: 'private-key' }]);
  assert.equal(saveCustomModels([{ id: 'model', provider: 'custom', model_name: 'example', base_url: 'http://localhost:5678' }])[0].api_key, undefined);
});

test('invalid saved model data does not reveal its contents in errors', t => {
  const storage = mockStorage(t);
  storage.set('custom_ai_models', '{"api_key":"private-key"');
  assert.throws(getCustomModels, error => !error.message.includes('private-key'));
});
