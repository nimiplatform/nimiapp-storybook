import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('storybook repository exposes nimicoding governance and product authority', () => {
  assert.match(read('.nimi/methodology/authority-authoring.yaml'), /nimicoding\.authority\/v2/);
  assert.match(read('.nimi/config/app-identity.yaml'), /app_id: nimi\.storybook/);
  assert.match(read('.nimi/config/build-profile.yaml'), /build_command: pnpm run build/);
  assert.match(
    read('.nimi/spec/storybook/canonical/product.authority.yaml'),
    /rule\.storybook\.product\.r001/,
  );
  assert.match(
    read('.nimi/spec/storybook/canonical/runtime-ai.authority.yaml'),
    /rule\.storybook\.runtime-ai\.r001/,
  );
});

test('storybook authority is a closed v2 corpus without the legacy project placeholder', () => {
  const product = read('.nimi/spec/storybook/canonical/product.authority.yaml');
  assert.match(product, /format: nimicoding\.authority\/v2/);
  assert.doesNotMatch(product, /\.nimi\/spec\/project/);
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
