import assert from 'node:assert/strict';
import test from 'node:test';

import {
  STORYBOOK_AI_CONFIG_INDEX_KEY,
  STORYBOOK_AI_CONFIG_QUARANTINE_PREFIX,
  STORYBOOK_AI_CONFIG_STORAGE_PREFIX,
  loadStorybookAIConfig,
  overwriteStorybookAIConfig,
  repairStorybookAIConfigStorage,
  versionStorybookAIConfig,
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

function appConfig(capabilities = []) {
  return {
    owner: { owner: { oneofKind: 'app', app: { appId: 'nimi.storybook' } } },
    capabilities,
  };
}

test('Storybook quarantines retired renderer-owned AIConfig without guessing a migration', () => {
  const storage = createMemoryStorage();
  const scopeKey = 'app:nimi.storybook:storybook.generation';
  const storageKey = `${STORYBOOK_AI_CONFIG_STORAGE_PREFIX}:${scopeKey}`;
  const raw = JSON.stringify({ scopeRef: { kind: 'app' }, capabilities: {} });
  storage.setItem(STORYBOOK_AI_CONFIG_INDEX_KEY, JSON.stringify([scopeKey]));
  storage.setItem(storageKey, raw);

  const result = repairStorybookAIConfigStorage(storage, {
    now: () => '2026-08-08T00:00:00.000Z',
  });

  assert.equal(result.scanned, 1);
  assert.equal(result.quarantined, 1);
  assert.deepEqual(result.removedScopeKeys, [scopeKey]);
  assert.equal(storage.getItem(storageKey), null);
  assert.deepEqual(JSON.parse(storage.getItem(STORYBOOK_AI_CONFIG_INDEX_KEY)), []);
  assert.match(result.quarantineKeys[0], new RegExp(`^${STORYBOOK_AI_CONFIG_QUARANTINE_PREFIX}`));
  const quarantine = JSON.parse(storage.getItem(result.quarantineKeys[0]));
  assert.equal(quarantine.reasonCode, 'STORYBOOK_LEGACY_AI_CONFIG_RETIRED');
  assert.equal(quarantine.raw, raw);
});

test('Storybook reads and whole-overwrites Runtime-owned portable App AIConfig', async () => {
  let current = appConfig();
  let revision = 'revision-1';
  const client = {
    async get() { return { config: current, revision, effectiveSelections: [] }; },
    async overwrite({ capabilities, expectedRevision }) {
      assert.equal(expectedRevision, revision);
      current = appConfig([...capabilities]);
      revision = 'revision-2';
      return { outcome: 'committed', config: current, revision };
    },
  };
  const loaded = await loadStorybookAIConfig(client);
  const baseVersion = versionStorybookAIConfig(loaded);
  const intent = {
    capabilityContract: 'text.generate',
    requiredFeatures: [],
    route: { oneofKind: 'local', local: {} },
  };
  const saved = await overwriteStorybookAIConfig([intent], { client, expectedBaseVersion: baseVersion });
  assert.deepEqual(saved.capabilities, [intent]);
  await assert.rejects(
    overwriteStorybookAIConfig([], { client, expectedBaseVersion: baseVersion }),
    /AIConfig CAS conflict/,
  );
});

test('Storybook rejects a mismatched Runtime App AIConfig owner', async () => {
  const client = {
    async get() {
      return { config: { owner: { owner: { oneofKind: 'app', app: { appId: 'app.other' } } }, capabilities: [] }, revision: 'revision-1', effectiveSelections: [] };
    },
    async overwrite() { throw new Error('not used'); },
  };
  await assert.rejects(loadStorybookAIConfig(client), /exact nimi\.storybook App/);
});

test('Storybook accepts an unconfigured Runtime snapshot and preserves Runtime conflict rejection', async () => {
  const client = {
    async get() { return { config: null, revision: 'revision-1', effectiveSelections: [] }; },
    async overwrite(input) {
      assert.equal(input.expectedRevision, 'revision-1');
      return { outcome: 'conflict', config: appConfig(), revision: 'revision-2', reasonCode: 'AI_CONFIG_REVISION_CONFLICT' };
    },
  };
  assert.equal(await loadStorybookAIConfig(client), null);
  await assert.rejects(overwriteStorybookAIConfig([], { client }), /Runtime revision changed/);
});
