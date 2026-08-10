import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildStorybookTextCandidateInput,
  invokeStorybookImage,
  invokeStorybookText,
} from '../src/storybook/ai/storybook-runtime-invokers.ts';

function appConfig(route = 'local') {
  return {
    owner: { owner: { oneofKind: 'app', app: { appId: 'nimi.storybook' } } },
    capabilities: [{
      capabilityContract: 'text.generate',
      requiredFeatures: [],
      route: route === 'local'
        ? { oneofKind: 'local', local: {} }
        : {
            oneofKind: 'cloud',
            cloud: {
              implementation: {
                implementationId: 'runtime-catalog-entry',
                driverId: 'runtime-driver',
                driverDialect: 'runtime-dialect',
              },
              providerModelTarget: { fields: {} },
            },
          },
    }],
  };
}

test('Storybook dispatches exact bounded unary text input through App Access', async () => {
  let observed;
  const client = {
    aiConfig: { async get() { return appConfig(); }, async overwrite() { throw new Error('not used'); } },
    ai: { text: { async generateCandidate(input) {
      observed = input;
      return { text: '候选文本', finishReason: 'stop', traceId: 'trace-1' };
    } } },
  };
  const result = await invokeStorybookText(client, {
    prompt: '场景事实',
    directive: '仅依据事实生成。',
    surfaceId: 'nimi.storybook.play.scene',
  }, appConfig());

  assert.equal(result.ok, true);
  assert.equal(result.text, '候选文本');
  assert.equal(result.route, 'local');
  assert.equal(result.traceId, 'trace-1');
  assert.deepEqual(observed.messages, [
    { role: 'system', text: '仅依据事实生成。' },
    { role: 'user', text: '场景事实' },
  ]);
  assert.deepEqual(
    { temperature: observed.temperature, topP: observed.topP, maxTokens: observed.maxTokens },
    { temperature: 0.7, topP: 1, maxTokens: 1024 },
  );
});

test('Storybook enforces App Access text byte and token bounds before dispatch', () => {
  assert.throws(
    () => buildStorybookTextCandidateInput({
      prompt: 'x'.repeat(32 * 1024 + 1),
      temperature: 0.7,
      topP: 1,
      maxTokens: 1024,
    }),
    /32 KiB App Access bound/,
  );
  const bounded = buildStorybookTextCandidateInput({
    prompt: 'valid',
    temperature: 99,
    topP: 99,
    maxTokens: 5000,
  });
  assert.deepEqual(
    { temperature: bounded.temperature, topP: bounded.topP, maxTokens: bounded.maxTokens },
    { temperature: 0.7, topP: 1, maxTokens: 1024 },
  );
});

test('unconfigured text and image generation fail closed without dispatch', async () => {
  let dispatched = false;
  const client = {
    aiConfig: { async get() { return appConfig(); }, async overwrite() { throw new Error('not used'); } },
    ai: { text: { async generateCandidate() { dispatched = true; throw new Error('must not run'); } } },
  };
  const text = await invokeStorybookText(client, {
    prompt: 'valid',
    surfaceId: 'nimi.storybook.play.scene',
  }, null);
  assert.equal(text.ok, false);
  assert.equal(text.reason, 'ai-binding-missing');
  assert.equal(dispatched, false);

  const image = await invokeStorybookImage({
    prompt: 'asset description',
    surfaceId: 'nimi.storybook.studio.asset',
  });
  assert.equal(image.ok, false);
  assert.equal(image.reason, 'capability-unavailable');
});
