import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import {
  loadStorybookAIConfig,
  overwriteStorybookAIConfig,
  versionStorybookAIConfig,
} from '../src/storybook/ai/storybook-ai-config-store.ts';

function appConfig(capabilities = []) {
  return {
    owner: { owner: { oneofKind: 'app', app: { appId: 'nimi.storybook' } } },
    capabilities,
  };
}

test('Storybook has no renderer-owned AIConfig persistence or automatic migration', () => {
  const source = readFileSync(new URL('../src/storybook/ai/storybook-ai-config-store.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /localStorage|indexedDB|quarantine|LegacyStorage/);
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
