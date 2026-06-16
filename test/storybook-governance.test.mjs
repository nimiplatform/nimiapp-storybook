import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('storybook repository exposes nimicoding governance and product authority', () => {
  assert.match(read('.nimi/config/bootstrap.yaml'), /bootstrap_contract: "nimicoding\.bootstrap"/);
  assert.match(read('.nimi/config/skill-manifest.yaml'), /spec_reconstruction/);
  assert.match(read('.nimi/config/app-identity.yaml'), /app_id: nimi\.storybook/);
  assert.match(read('.nimi/config/build-profile.yaml'), /build_command: pnpm run build/);
  assert.match(read('.nimi/spec/INDEX.md'), /storybook/);
  assert.match(read('.nimi/spec/storybook/kernel/product-contract.md'), /SBK-PROD-01/);
  assert.match(read('.nimi/spec/storybook/kernel/runtime-ai-contract.md'), /SBK-AI-01/);
});

test('storybook domain admission is host-owned and not the default project placeholder', () => {
  const admission = read('.nimi/contracts/domain-admission.schema.yaml');
  assert.match(admission, /domain_id: storybook/);
  assert.match(admission, /domain_root: \.nimi\/spec\/storybook/);
  assert.doesNotMatch(admission, /domain_root: \.nimi\/spec\/project/);
});

test('gitflow and local state boundaries match standalone app expectations', () => {
  const gitignore = read('.gitignore');
  assert.match(gitignore, /\.nimi\/local\//);
  assert.match(gitignore, /\.nimi\/cache\//);
  assert.match(gitignore, /\.nimi\/topics\//);
  assert.match(read('CHANGELOG.md'), /Keep a Changelog/);
  assert.match(read('RELEASE.md'), /pnpm nimicoding:doctor/);
  assert.doesNotMatch(read('ADMISSION.md'), /pnpm run init/);
});
