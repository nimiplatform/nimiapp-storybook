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
const ELECTRON_MAIN = read('src-electron/main.ts');
const ELECTRON_PRELOAD = read('src-electron/preload.cts');
const BOOTSTRAP_SOURCE = read('src/shell/infra/storybook-bootstrap.ts');
const CLIENT_SOURCE = read('src/shell/infra/storybook-nimi-client.ts');
const AUTH_GATE_SOURCE = read('src/shell/app-shell/auth-provider.tsx');
const RUNTIME_PLATFORM_SOURCE = read('src/shell/auth/runtime-platform.ts');
const RUNTIME_AI_SOURCE = read('src/storybook/ai/storybook-runtime-invokers.ts');
const ALL_ACTIVE_SOURCE = `${sourceText('src')}\n${sourceText('src-electron')}`;

test('Storybook uses one canonical app id across manifest and supervised Electron host', () => {
  assert.equal(STORYBOOK_APP_ID, 'nimi.storybook');
  assert.equal(STORYBOOK_RUNTIME_APP_ID, STORYBOOK_APP_ID);
  assert.match(MANIFEST, /^app_id: nimi\.storybook$/m);
  assert.match(ELECTRON_MAIN, /const STORYBOOK_APP_ID = 'nimi\.storybook'/);
});

test('official development path is Desktop-supervised Electron with no app-owned CDP', () => {
  assert.equal(PACKAGE.scripts.dev, 'nimi-app dev --shell electron');
  assert.equal(PACKAGE.scripts['dev:shell'], 'nimi-app dev');
  assert.equal(PACKAGE.scripts['dev:electron'], 'nimi-app dev --shell electron');
  assert.match(MANIFEST, /^permissions: \[\]$/m);
  assert.match(MANIFEST, /local_development:\s*\n  electron:\s*\n    renderer_origin: http:\/\/127\.0\.0\.1:1473/m);
  assert.match(ELECTRON_MAIN, /registerNimiElectronAppBridge/);
  assert.match(ELECTRON_MAIN, /onProtectedSessionFailure: \(\) => app\.quit\(\)/);
  assert.match(ELECTRON_PRELOAD, /installNimiElectronRuntimeBridge/);
  assert.doesNotMatch(ELECTRON_MAIN, /remote-debugging|CDP|cdp/i);
});

test('bootstrap consumes only public local-app session posture', () => {
  assert.match(CLIENT_SOURCE, /createNimiLocalAppStandardShellSurface/);
  assert.match(CLIENT_SOURCE, /createNimiClient\(\{\s*localApp:/);
  assert.match(BOOTSTRAP_SOURCE, /getStorybookNimiClient\(\)\.auth\.status\(\)/);
  assert.match(BOOTSTRAP_SOURCE, /session\.sessionBound/);
  assert.match(AUTH_GATE_SOURCE, /Desktop-supervised standard bridge/);
  assert.match(AUTH_GATE_SOURCE, /不提供自登录或自授权入口/);
  assert.match(RUNTIME_PLATFORM_SOURCE, /desktop-supervised-local-app/);
  assert.equal(existsSync(path.join(APP_ROOT, 'src/shell/infra/storybook-runtime-session.ts')), false);
  assert.equal(existsSync(path.join(APP_ROOT, 'src/shell/features/auth/storybook-auth-adapter.ts')), false);
  assert.equal(existsSync(path.join(APP_ROOT, 'src/shell/features/auth/storybook-login-page.tsx')), false);
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

test('generic generation remains typed unavailable until admitted on the standard bridge', () => {
  assert.match(RUNTIME_PLATFORM_SOURCE, /storybook-generic-runtime-generation-not-admitted/);
  assert.match(RUNTIME_PLATFORM_SOURCE, /admit_public_local_app_generation_contract/);
  assert.doesNotMatch(RUNTIME_AI_SOURCE, /requireStorybookRuntimeSubjectUserId/);
});

test('Storybook text binding parser consumes v2 targetRef without retired local ids', () => {
  const targetRefModelBody = RUNTIME_AI_SOURCE.slice(
    RUNTIME_AI_SOURCE.indexOf('function targetRefModel'),
    RUNTIME_AI_SOURCE.indexOf('function schedulingTargetFor'),
  );
  assert.match(targetRefModelBody, /profileBindingId/);
  assert.match(targetRefModelBody, /readinessRef/);
  assert.doesNotMatch(targetRefModelBody, /profileId/);
  assert.doesNotMatch(targetRefModelBody, /targetId/);
});
