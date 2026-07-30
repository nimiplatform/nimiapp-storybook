import type { NimiClient } from '@nimiplatform/sdk';
import { STORYBOOK_APP_ID } from '../../contracts/app-identity.ts';
import { useAppStore } from '../app-shell/app-store.ts';

export const appId = STORYBOOK_APP_ID;
export const appTitle = 'Storybook';
export const scaffoldProfile = 'workspace-app' as const;
export const runtimeAccountLoginEnabled = false;

export type StorybookRuntimeAuthMode = 'desktop-supervised-local-app';

/**
 * Retained only as the input type for the typed generation boundary. The
 * Desktop-supervised local-app carrier does not materialize this client until
 * a public generic-generation contract is admitted.
 */
export type StorybookRuntimePlatformClient = Pick<NimiClient, 'appId' | 'runtime' | 'ai' | 'features'>;

export type StorybookRuntimeAuthUnavailable = {
  status: 'unavailable' | 'action-required';
  mode: StorybookRuntimeAuthMode;
  reasonCode: string;
  actionHint: string;
  message: string;
};

export type StorybookRuntimePlatformProjection =
  | {
      status: 'ready';
      mode: StorybookRuntimeAuthMode;
      client: StorybookRuntimePlatformClient;
      auth: {
        state: 'ready';
        source: 'desktop-supervised-standard-bridge';
      };
    }
  | StorybookRuntimeAuthUnavailable;

export function clearRuntimePlatformProjection(): void {
  // Session posture is projected by the standard local-app carrier.
}

export async function getRuntimePlatformProjection(): Promise<StorybookRuntimePlatformProjection> {
  const state = useAppStore.getState();
  if (!state.bootstrapReady || state.auth.status !== 'authenticated') {
    return {
      status: 'action-required',
      mode: 'desktop-supervised-local-app',
      reasonCode: state.auth.reasonCode,
      actionHint: state.auth.actionHint,
      message: state.bootstrapError || 'Storybook Desktop-supervised local-app session is not ready.',
    };
  }
  return {
    status: 'unavailable',
    mode: 'desktop-supervised-local-app',
    reasonCode: 'storybook-generic-runtime-generation-not-admitted',
    actionHint: 'admit_public_local_app_generation_contract',
    message: 'Storybook generic Runtime generation is not admitted on the Desktop-supervised standard bridge.',
  };
}
