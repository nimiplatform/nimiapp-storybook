import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  STORYBOOK_APP_ID,
  STORYBOOK_RUNTIME_APP_ID,
} from '../src/contracts/app-identity.ts';

const APP_ROOT = path.resolve(import.meta.dirname, '..');

function read(relativePath) {
  return readFileSync(path.join(APP_ROOT, relativePath), 'utf8');
}

function sourceText(relativeRoot) {
  const root = path.join(APP_ROOT, relativeRoot);
  const entries = [];
  for (const item of readdirSync(root, { withFileTypes: true })) {
    const relative = path.join(relativeRoot, item.name);
    if (item.isDirectory()) entries.push(sourceText(relative));
    else if (/\.(?:cts|ts|tsx)$/u.test(item.name)) entries.push(read(relative));
  }
  return entries.join('\n');
}

const PACKAGE = JSON.parse(read('package.json'));
const MANIFEST = read('nimi.app.yaml');
const BUILD_PROFILE = read('.nimi/config/build-profile.yaml');
const BOOTSTRAP_SOURCE = read('src/shell/mount-storybook.tsx');
const CLIENT_SOURCE = read('src/shell/infra/storybook-nimi-client.ts');
const AUTH_GATE_SOURCE = read('src/shell/app-shell/auth-provider.tsx');
const RUNTIME_PLATFORM_SOURCE = read('src/shell/auth/runtime-platform.ts');
const RUNTIME_AI_SOURCE = read('src/storybook/ai/storybook-runtime-invokers.ts');
const ALL_ACTIVE_SOURCE = sourceText('src');

test('Storybook uses one canonical app id across manifest and managed-web carrier', () => {
  assert.equal(STORYBOOK_APP_ID, 'nimi.storybook');
  assert.equal(STORYBOOK_RUNTIME_APP_ID, STORYBOOK_APP_ID);
  assert.match(MANIFEST, /^app_id: nimi\.storybook$/m);
  assert.equal(existsSync(path.join(APP_ROOT, 'src-electron')), false);
  assert.match(BUILD_PROFILE, /^build_profile_ref: managed-web-pnpm-vite$/m);
  assert.match(BUILD_PROFILE, /^\s+desktop-universal:$/m);
  assert.match(BUILD_PROFILE, /^\s+payload_path: dist\/renderer$/m);
});

test('official development path uses Desktop-supervised managed-web carrier with no app-owned Electron host', () => {
  assert.equal(PACKAGE.scripts.dev, 'nimi-app dev --shell electron');
  assert.equal(PACKAGE.scripts['dev:shell'], 'nimi-app dev');
  assert.equal(PACKAGE.main, undefined);
  assert.equal(PACKAGE.scripts.postinstall, undefined);
  assert.equal(PACKAGE.devDependencies.electron, undefined);
  assert.match(MANIFEST, /^profile: standalone$/m);
  assert.match(MANIFEST, /^app_access:\s*\n  - runtime\.consume$/m);
  assert.doesNotMatch(MANIFEST, /^permissions:/m);
  assert.match(MANIFEST, /local_development:\s*\n  electron:\s*\n    renderer_origin: http:\/\/127\.0\.0\.1:1473/m);
  assert.match(MANIFEST, /title_bar_style: native/);
});

test('platform entries delegate identity and connection to the installed Kit', () => {
  assert.match(read('src/main.tsx'), /createDesktopNimiAppSession/);
  assert.match(read('src/main.tsx'), /configureStorybookExternalLinkProtocols\(\['https:'\]\)/);
  assert.match(read('src/main.web.tsx'), /createWebNimiAppSession/);
  assert.doesNotMatch(CLIENT_SOURCE, /createNimiClient|auth\.status|fetch\(/);
  assert.match(BOOTSTRAP_SOURCE, /NimiAppAccessGate/);
  assert.doesNotMatch(ALL_ACTIVE_SOURCE, /prepareRuntimeClientLogin|completeRuntimeClientLogin/);
});

test('active source contains no app registration, credential custody, self-authorization, or account broker', () => {
  for (const retired of [
    /createNimiDeveloperRegisteredRuntimeAccountCaller/,
    /createNimiRuntimeFullAppRegistration/,
    /createNimiRuntimeAppSessionMetadataProvider/,
    /authorizeExternalPrincipal/,
    /x-nimi-access-token/i,
    /token\.secret/,
    /RuntimeAccountBrowserBroker/,
    /DesktopShellAuthPage/,
  ]) {
    assert.doesNotMatch(ALL_ACTIVE_SOURCE, retired);
  }
});

test('authenticated Storybook uses the admitted protected text and AIConfig carrier only', () => {
  assert.match(RUNTIME_PLATFORM_SOURCE, /status: 'ready'/);
  assert.match(RUNTIME_PLATFORM_SOURCE, /state.runtime.scope.client/);
  assert.match(RUNTIME_AI_SOURCE, /client\.ai\.scenario\.execute/);
  assert.match(RUNTIME_AI_SOURCE, /loadStorybookAIConfig\(client\.aiConfig\)/);
  assert.doesNotMatch(RUNTIME_AI_SOURCE, /client\.runtime|client\.features|createNimiRuntimeAIModel/);
});

test('Storybook resolves portable capability intent without app-owned binding custody', () => {
  assert.match(RUNTIME_AI_SOURCE, /NimiPortableAppAIConfig/);
  assert.match(RUNTIME_AI_SOURCE, /capabilityContract === STORYBOOK_TEXT_GENERATE_CAPABILITY_ID/);
  assert.doesNotMatch(RUNTIME_AI_SOURCE, /connectorId|connectorGrantId|profileBindingId|providerModelId/);
});

test('session loss offers the shared connection action without exiting the app', () => {
  assert.match(AUTH_GATE_SOURCE, /session.connectRuntime\(\)/);
  assert.doesNotMatch(BOOTSTRAP_SOURCE, /app\.quit|window\.close/);
});
