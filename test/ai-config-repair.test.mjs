import assert from 'node:assert/strict';
import test from 'node:test';

import { encodeNimiAIScopeRef } from '@nimiplatform/sdk/ai';
import {
  STORYBOOK_AI_CONFIG_INDEX_KEY,
  STORYBOOK_AI_CONFIG_QUARANTINE_PREFIX,
  STORYBOOK_AI_CONFIG_STORAGE_PREFIX,
  createStorybookAIScopeRef,
  repairStorybookAIConfigStorageForScope,
} from '../src/storybook/ai/storybook-ai-config-store.ts';

function createMemoryStorage() {
  const items = new Map();
  return {
    getItem(key) {
      return items.has(key) ? items.get(key) : null;
    },
    setItem(key, value) {
      items.set(key, String(value));
    },
    removeItem(key) {
      items.delete(key);
    },
  };
}

test('Storybook AIConfig repair quarantines persisted refs missing remoteModelCatalogId', () => {
  const storage = createMemoryStorage();
  const scopeRef = createStorybookAIScopeRef();
  const scopeKey = encodeNimiAIScopeRef(scopeRef);
  const storageKey = `${STORYBOOK_AI_CONFIG_STORAGE_PREFIX}:${scopeKey}`;
  const raw = JSON.stringify({
    scopeRef,
    capabilities: {
      targetRefs: {
        'text.generate': {
          kind: 'cloud-connector',
          connectorId: 'connector-openai',
          providerModelId: 'gpt-runtime',
          provider: 'openai',
        },
      },
      selectedParams: {},
    },
    profileOrigin: null,
  });
  storage.setItem(STORYBOOK_AI_CONFIG_INDEX_KEY, JSON.stringify([scopeKey]));
  storage.setItem(storageKey, raw);

  const result = repairStorybookAIConfigStorageForScope(scopeRef, storage, {
    now: () => '2026-06-26T00:00:00.000Z',
  });

  assert.equal(result.scanned, 1);
  assert.equal(result.quarantined, 1);
  assert.deepEqual(result.removedScopeKeys, [scopeKey]);
  assert.equal(storage.getItem(storageKey), null);
  assert.deepEqual(JSON.parse(storage.getItem(STORYBOOK_AI_CONFIG_INDEX_KEY)), []);
  assert.equal(result.quarantineKeys.length, 1);
  assert.match(result.quarantineKeys[0], new RegExp(`^${STORYBOOK_AI_CONFIG_QUARANTINE_PREFIX}`));
  const quarantine = JSON.parse(storage.getItem(result.quarantineKeys[0]));
  assert.match(
    quarantine.reason,
    /AI_FIELD_REQUIRED@config\.capabilities\.targetRefs\.text\.generate\.remoteModelCatalogId/,
  );
  assert.equal(quarantine.raw, raw);
});
