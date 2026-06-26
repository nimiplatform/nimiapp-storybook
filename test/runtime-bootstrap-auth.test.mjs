import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  STORYBOOK_APP_ID,
  STORYBOOK_RUNTIME_APP_ID,
  STORYBOOK_RUNTIME_APP_INSTANCE_ID,
  STORYBOOK_RUNTIME_DEVICE_ID,
} from '../src/contracts/app-identity.ts';

const BOOTSTRAP_SOURCE = readFileSync(
  new URL('../src/shell/infra/storybook-bootstrap.ts', import.meta.url),
  'utf8',
);
const SESSION_SOURCE = readFileSync(
  new URL('../src/shell/infra/storybook-runtime-session.ts', import.meta.url),
  'utf8',
);
const RUNTIME_AI_SOURCE = readFileSync(
  new URL('../src/storybook/ai/storybook-runtime-invokers.ts', import.meta.url),
  'utf8',
);
const AI_CONFIG_STORE_SOURCE = readFileSync(
  new URL('../src/storybook/ai/storybook-ai-config-store.ts', import.meta.url),
  'utf8',
);
const AI_CONFIG_SECTION_SOURCE = readFileSync(
  new URL('../src/shell/ai/storybook-ai-model-config-section.tsx', import.meta.url),
  'utf8',
);
const BRIDGE_SOURCE = readFileSync(
  new URL('../src/shell/bridge/index.ts', import.meta.url),
  'utf8',
);
const TAURI_MAIN_SOURCE = readFileSync(
  new URL('../src-tauri/src/main.rs', import.meta.url),
  'utf8',
);

test('Storybook uses one canonical Nimi app id across manifest, Runtime, and Tauri identity', () => {
  assert.equal(STORYBOOK_APP_ID, 'nimi.storybook');
  assert.equal(STORYBOOK_RUNTIME_APP_ID, 'nimi.storybook');
  assert.equal(STORYBOOK_RUNTIME_APP_INSTANCE_ID, 'nimi.storybook.local-developer');
  assert.equal(STORYBOOK_RUNTIME_DEVICE_ID, 'storybook-local-developer-device');
  assert.equal(STORYBOOK_RUNTIME_APP_ID, STORYBOOK_APP_ID);
});

test('Storybook Nimi client uses developer-registered Runtime session without raw Realm tokens', () => {
  assert.match(BOOTSTRAP_SOURCE, /configureStorybookRuntimeSession/);
  assert.doesNotMatch(BOOTSTRAP_SOURCE, /syncStorybookRuntimeDeveloperRegistrationConfig/);
  assert.match(SESSION_SOURCE, /createNimiClient/);
  assert.match(SESSION_SOURCE, /createNimiDeveloperRegisteredRuntimeAccountCaller/);
  assert.doesNotMatch(SESSION_SOURCE, /createRealmFetchTransport/);
  assert.doesNotMatch(SESSION_SOURCE, /getAccessToken/);
  assert.match(SESSION_SOURCE, /createNimiRuntimeAppSessionMetadataProvider/);
  assert.match(SESSION_SOURCE, /authorizeExternalPrincipal/);
  assert.match(SESSION_SOURCE, /protectedAccessInflight\.subjectUserId !== subjectUserId/);
  assert.match(SESSION_SOURCE, /protectedAccessInflight === inflight/);
  assert.match(SESSION_SOURCE, /realm:\s*false/);
  assert.match(SESSION_SOURCE, /app:\s*false/);
  assert.match(SESSION_SOURCE, /permissions:\s*false/);
  assert.match(SESSION_SOURCE, /type:\s*'tauri-ipc'/);
  assert.match(SESSION_SOURCE, /commandNamespace:\s*'runtime_bridge'/);
  assert.match(SESSION_SOURCE, /eventNamespace:\s*'runtime_bridge'/);
  assert.match(SESSION_SOURCE, /appId:\s*STORYBOOK_RUNTIME_APP_ID/);
  assert.match(SESSION_SOURCE, /externalPrincipalId:\s*STORYBOOK_RUNTIME_APP_ID/);
  assert.match(RUNTIME_AI_SOURCE, /appId:\s*STORYBOOK_RUNTIME_APP_ID/);
});

test('Storybook does not own Runtime developer-registration gate or local auth token storage', () => {
  assert.doesNotMatch(BOOTSTRAP_SOURCE, /setDaemonConfig|restartDaemon|mergeNimiRuntimeBridgeDeveloperRegistrationConfig/);
  assert.doesNotMatch(SESSION_SOURCE, /createNimiLocalFirstPartyRuntimeAccountCaller|LOCAL_FIRST_PARTY_APP/);
  assert.doesNotMatch(TAURI_MAIN_SOURCE, /auth_session_commands|auth_session_load|auth_session_save|auth_session_clear/);
  assert.doesNotMatch(BRIDGE_SOURCE, /startDaemon|stopDaemon|restartDaemon|getDaemonConfig|setDaemonConfig|RuntimeBridgeConfigSetResult/);
  assert.doesNotMatch(BRIDGE_SOURCE, /createTauriOAuthBridge/);
  assert.match(BRIDGE_SOURCE, /STORYBOOK_TOKEN_EXCHANGE_FORBIDDEN/);
  assert.doesNotMatch(TAURI_MAIN_SOURCE, /oauth_commands::oauth_token_exchange/);
  assert.doesNotMatch(TAURI_MAIN_SOURCE, /runtime_bridge::runtime_bridge_start|runtime_bridge::runtime_bridge_stop|runtime_bridge::runtime_bridge_restart/);
  assert.doesNotMatch(TAURI_MAIN_SOURCE, /runtime_bridge::runtime_bridge_config_get|runtime_bridge::runtime_bridge_config_set/);
});

test('Storybook AI Config is SDK-backed and surfaced through Kit ModelConfig', () => {
  assert.match(AI_CONFIG_STORE_SOURCE, /createNimiAIConfigStore/);
  assert.match(AI_CONFIG_STORE_SOURCE, /createNimiAIHostSurface/);
  assert.match(AI_CONFIG_STORE_SOURCE, /createNimiAIConfigSubscriptionRegistry/);
  assert.match(AI_CONFIG_SECTION_SOURCE, /ModelConfigAiModelHub/);
  assert.match(AI_CONFIG_SECTION_SOURCE, /createStorybookRuntimeModelPickerProviderCache/);
  assert.match(RUNTIME_AI_SOURCE, /createNimiRuntimeAIModel/);
  assert.match(RUNTIME_AI_SOURCE, /createNimiRuntimeAISchedulingClient/);
  assert.match(RUNTIME_AI_SOURCE, /requireStorybookRuntimeSubjectUserId/);
});

test('Storybook text Runtime model consumes v2 targetRef without retired local ids', () => {
  const targetRefModelBody = RUNTIME_AI_SOURCE.slice(
    RUNTIME_AI_SOURCE.indexOf('function targetRefModel'),
    RUNTIME_AI_SOURCE.indexOf('function schedulingTargetFor'),
  );
  assert.match(targetRefModelBody, /profileBindingId/);
  assert.match(targetRefModelBody, /readinessRef/);
  assert.doesNotMatch(targetRefModelBody, /profileId/);
  assert.doesNotMatch(targetRefModelBody, /targetId/);
  assert.match(RUNTIME_AI_SOURCE, /readonly targetRef: NimiAIConfigTargetRef/);
  assert.match(RUNTIME_AI_SOURCE, /targetRef: bound\.targetRef/);
});
