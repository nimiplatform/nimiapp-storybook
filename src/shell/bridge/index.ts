export {
  hasTauriInvoke,
  invoke,
  invokeChecked,
  BridgeError,
  getDaemonStatus,
  oauthListenForCode,
  openExternalUrl,
  focusMainWindow,
  parseRuntimeBridgeDaemonStatus,
  hasTauriRuntime,
  invokeTauri,
} from '@nimiplatform/kit/shell/renderer/bridge';

export type {
  RuntimeBridgeDaemonStatus,
  JsonValue,
  JsonObject,
  JsonPrimitive,
} from '@nimiplatform/kit/shell/renderer/bridge';

import type { TauriOAuthBridge } from '@nimiplatform/kit/core/oauth';
import {
  focusMainWindow,
  hasTauriInvoke,
  oauthListenForCode,
  openExternalUrl,
} from '@nimiplatform/kit/shell/renderer/bridge';

export const STORYBOOK_TOKEN_EXCHANGE_FORBIDDEN =
  'Storybook does not expose OAuth token exchange; Runtime account service owns token custody.';

export const storybookTauriOAuthBridge: TauriOAuthBridge = {
  hasTauriInvoke,
  oauthListenForCode,
  openExternalUrl,
  focusMainWindow,
  oauthTokenExchange: async () => {
    throw new Error(STORYBOOK_TOKEN_EXCHANGE_FORBIDDEN);
  },
};

export type { StorybookRuntimeDefaults } from './storybook-types.ts';
export { getStorybookRuntimeDefaults } from './storybook-runtime-defaults.ts';
