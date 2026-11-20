import assert from 'node:assert/strict';
import test from 'node:test';
import { bindStorybookFileDelivery, deliverStorybookJson } from '../src/shell/infra/storybook-file-delivery.ts';

test('file delivery preserves portable JSON and refuses export after identity changes', async () => {
  const original = { title: '信件 / Letters', media: 'data:image/png;base64,AAEC', lines: ['你好', 'second line'] };
  let current = true;
  const assertCurrent = () => { if (!current) throw new Error('identity changed'); };
  const received = [];
  const unbind = bindStorybookFileDelivery(async (json, filename, guard) => {
    guard();
    received.push({ json, filename });
  });
  try {
    await deliverStorybookJson(original, '信件/作品.json', assertCurrent);
    assert.deepEqual(JSON.parse(received[0].json), original);
    assert.equal(received[0].filename, '信件-作品.json');
    current = false;
    await assert.rejects(deliverStorybookJson(original, 'private.json', assertCurrent), /identity changed/);
    assert.equal(received.length, 1);
  } finally { unbind(); }
  current = true;
  await assert.rejects(deliverStorybookJson(original, 'closed.json', assertCurrent), /unavailable/);
});
