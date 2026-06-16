import type { NimiClient } from '@nimiplatform/sdk';
import { ReasonCode } from '@nimiplatform/sdk/types';
import { STORYBOOK_APP_ID } from '../../contracts/app-identity.ts';
import { useAppStore } from '../app-shell/app-store.ts';
import { getStorybookNimiClient } from '../infra/storybook-nimi-client.ts';
import { storybookRuntimeAccountCaller } from '../infra/storybook-runtime-session.ts';

export const appId = STORYBOOK_APP_ID;
export const appTitle = 'Storybook';
export const scaffoldProfile = 'workspace-app' as const;
export const runtimeAccountLoginEnabled = true;

export type StorybookRuntimeAuthMode = 'developer-registered-runtime-app';

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
        source: 'runtime-developer-registered-app-session';
      };
    }
  | StorybookRuntimeAuthUnavailable;

export function clearRuntimePlatformProjection(): void {
  // Projection state is owned by storybook-bootstrap and the Runtime session.
}

export function getRuntimeAccountCaller() {
  return storybookRuntimeAccountCaller;
}

export async function getRuntimePlatformProjection(): Promise<StorybookRuntimePlatformProjection> {
  const state = useAppStore.getState();
  if (!state.bootstrapReady) {
    return unavailable({
      status: state.bootstrapError ? 'action-required' : 'unavailable',
      mode: 'developer-registered-runtime-app',
      reasonCode: state.bootstrapError
        ? ReasonCode.SDK_PLATFORM_CLIENT_NOT_READY
        : ReasonCode.SDK_RUNTIME_METHOD_UNAVAILABLE,
      actionHint: 'complete_storybook_runtime_bootstrap',
      message: state.bootstrapError || 'Storybook Runtime bootstrap is not ready.',
    });
  }
  try {
    return {
      status: 'ready',
      mode: 'developer-registered-runtime-app',
      client: getStorybookNimiClient(),
      auth: {
        state: 'ready',
        source: 'runtime-developer-registered-app-session',
      },
    };
  } catch (error) {
    return unavailable({
      status: 'action-required',
      mode: 'developer-registered-runtime-app',
      reasonCode: ReasonCode.SDK_PLATFORM_CLIENT_NOT_READY,
      actionHint: 'run_storybook_bootstrap',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function unavailable(input: StorybookRuntimeAuthUnavailable): StorybookRuntimeAuthUnavailable {
  return input;
}
