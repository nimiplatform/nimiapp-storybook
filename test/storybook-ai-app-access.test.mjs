import assert from 'node:assert/strict';
import test from 'node:test';
import { createNimiLocalAppAIConsumptionClient } from '@nimiplatform/sdk/app';

import {
  buildStorybookTextInput,
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

test('Storybook dispatches exact bounded synchronous text input through App Access', async () => {
  let observed;
  const client = {
    aiConfig: { async get() { return appConfig(); }, async overwrite() { throw new Error('not used'); } },
    ai: { scenario: { async execute(input) {
      observed = input;
      return { output: { type: 'text-generate', items: [{ type: 'text', text: '候选文本' }], finishReason: 'stop' }, traceId: 'trace-1' };
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
    { temperature: undefined, topP: undefined, maxTokens: undefined },
  );
  assert.equal(observed.type, 'text-generate');
  for (const field of ['temperature', 'topP', 'maxTokens']) assert.equal(Object.hasOwn(observed, field), false);
});

test('Storybook enforces App Access text byte and token bounds before dispatch', () => {
  assert.throws(
    () => buildStorybookTextInput({
      prompt: 'x'.repeat(32 * 1024 + 1),
      temperature: 0.7,
      topP: 1,
      maxTokens: 1024,
    }),
    /32 KiB App Access bound/,
  );
  assert.throws(() => buildStorybookTextInput({
    prompt: 'valid',
    temperature: 99,
    topP: 99,
    maxTokens: 5000,
  }), /Explicit temperature/);
});

test('unconfigured text and image generation fail closed without dispatch', async () => {
  let dispatched = false;
  const client = {
    aiConfig: { async get() { return appConfig(); }, async overwrite() { throw new Error('not used'); } },
    ai: { scenario: { async execute() { dispatched = true; throw new Error('must not run'); } } },
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

test('long source and chapter context preserve full text in separately bounded App Access messages', () => {
  const source = '字'.repeat(8000);
  const chapter = 'scene '.repeat(3000);
  const request = buildStorybookTextInput({ prompt: chapter.trim(), context: [source], directive: '只使用完整原文。', temperature: 0.7, topP: 1, maxTokens: 4096 });
  assert.equal(request.messages.length, 3);
  assert.equal(request.messages[1].text, source);
  assert.equal(request.messages[2].text, chapter.trim());
  assert.throws(() => buildStorybookTextInput({ prompt: 'write', context: ['x'.repeat(32769)], temperature: 0.7, topP: 1, maxTokens: 4096 }), /32 KiB/);
});

test('experience prompts preserve V2 post-history placement within the protected message contract', () => {
  const messages = [
    { role: 'system', text: 'card system' },
    { role: 'user', text: 'history and player input' },
    { role: 'system', text: 'card post-history instructions' },
  ];
  const input = { messages, temperature: 0.7, topP: 1, maxTokens: 1024 };
  assert.deepEqual(buildStorybookTextInput(input).messages, messages);
  assert.throws(() => buildStorybookTextInput({ ...input, prompt: 'ambiguous second input' }), /cannot be mixed/);
  assert.throws(() => buildStorybookTextInput({ ...input, messages: [{ role: 'assistant', text: 'unsupported carrier role' }] }), /Unsupported/);
  assert.throws(() => buildStorybookTextInput({ ...input, messages: [] }), /message count/);
});

test('ordered system messages pass the real SDK execute validator without reordering or adding defaults', async () => {
  let submitted;
  const ai = createNimiLocalAppAIConsumptionClient({ scenario: { async execute(spec) {
    submitted = spec;
    return { output: { type: 'text-generate', items: [
      { type: 'reasoning-continuity', carrier: { kind: 'test.opaque', version: 1, payload: [1, 2] } },
      { type: 'text', text: 'A complete reply.' },
    ], finishReason: 'stop' }, traceId: 'trace-ordered' };
  } } });
  const messages = [{ role: 'system', text: 'first' }, { role: 'system', text: 'second' }, { role: 'user', text: 'hello' }, { role: 'system', text: 'post-history' }];
  const result = await invokeStorybookText({ ai }, { messages, surfaceId: 'nimi.storybook.play.experience' }, appConfig());
  assert.equal(result.ok, true);
  assert.equal(result.text, 'A complete reply.');
  assert.deepEqual(submitted.messages, messages);
  assert.deepEqual(Object.keys(submitted).sort(), ['messages', 'type']);
});

test('explicit zero sampling and token settings are preserved rather than replaced by App defaults', async () => {
  const config = appConfig();
  config.capabilities[0].defaults = { fields: {
    temperature: { kind: { oneofKind: 'numberValue', numberValue: 0 } },
    topP: { kind: { oneofKind: 'numberValue', numberValue: 0.8 } },
    maxTokens: { kind: { oneofKind: 'numberValue', numberValue: 2000 } },
  } };
  let submitted;
  const client = { ai: { scenario: { async execute(spec) {
    submitted = spec;
    return { output: { type: 'text-generate', items: [{ type: 'text', text: 'Complete' }], finishReason: 'stop' }, traceId: 'trace-explicit' };
  } } } };
  const result = await invokeStorybookText(client, { prompt: 'hello', maxTokens: 3000, surfaceId: 'nimi.storybook.play.scene' }, config);
  assert.equal(result.ok, true);
  assert.deepEqual({ temperature: submitted.temperature, topP: submitted.topP, maxTokens: submitted.maxTokens }, { temperature: 0, topP: 0.8, maxTokens: 3000 });
});

for (const finishReason of ['length', 'content-filter', 'tool-calls']) {
  test(`nonempty ${finishReason} output cannot become a complete Storybook generation`, async () => {
    const client = { ai: { scenario: { async execute() { return { output: { type: 'text-generate', items: [{ type: 'text', text: 'Incomplete' }], finishReason }, traceId: 'trace-incomplete' }; } } } };
    const result = await invokeStorybookText(client, { prompt: 'hello', surfaceId: 'nimi.storybook.play.scene' }, appConfig());
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'runtime-call-failed');
  });
}
