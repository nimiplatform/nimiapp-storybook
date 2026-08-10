import type { NimiLocalAppClient } from '@nimiplatform/sdk';
import { STORYBOOK_APP_ID } from '../../contracts/app-identity.ts';
import { useAppStore } from '../app-shell/app-store.ts';
import { getStorybookNimiClient } from '../infra/storybook-nimi-client.ts';

export const appId = STORYBOOK_APP_ID;
export const appTitle = 'Storybook';
export const scaffoldProfile = 'standalone' as const;
export const runtimeAccountLoginEnabled = false;

export type StorybookRuntimeAuthMode = 'desktop-supervised-local-app';

export type StorybookRuntimePlatformClient = Pick<NimiLocalAppClient, 'ai' | 'aiConfig'>;

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
    status: 'ready',
    mode: 'desktop-supervised-local-app',
    client: getStorybookNimiClient(),
    auth: {
      state: 'ready',
      source: 'desktop-supervised-standard-bridge',
    },
  };
}
