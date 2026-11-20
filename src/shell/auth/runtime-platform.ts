import type { NimiAppRuntimeClient } from '@nimiplatform/sdk';
import { STORYBOOK_APP_ID } from '../../contracts/app-identity.ts';
import { getStorybookSession } from '../infra/storybook-nimi-client.ts';

export const appId = STORYBOOK_APP_ID;
export const appTitle = 'Storybook';
export const scaffoldProfile = 'standalone' as const;
export type StorybookRuntimeAuthMode = 'nimi-app-session';
export type StorybookRuntimePlatformClient = Pick<NimiAppRuntimeClient, 'ai' | 'aiConfig'>;
export type StorybookRuntimeAuthUnavailable = {
  status: 'unavailable' | 'action-required'; mode: StorybookRuntimeAuthMode;
  reasonCode: string; actionHint: string; message: string;
};
export type StorybookRuntimePlatformProjection =
  | { status: 'ready'; mode: StorybookRuntimeAuthMode; client: StorybookRuntimePlatformClient;
      auth: { state: 'ready'; source: 'nimi-app-session' } }
  | StorybookRuntimeAuthUnavailable;

// @nimi-authority: rule.storybook.runtime-ai.r001
export async function getRuntimePlatformProjection(): Promise<StorybookRuntimePlatformProjection> {
  const state = getStorybookSession().getSnapshot();
  if (state.runtime.status !== 'connected') return {
    status: 'action-required', mode: 'nimi-app-session',
    reasonCode: state.issue?.reasonCode ?? 'runtime-disconnected', actionHint: 'connect_runtime',
    message: state.issue?.message ?? '请连接 Nimi 后使用 AI。',
  };
  return { status: 'ready', mode: 'nimi-app-session', client: state.runtime.scope.client,
    auth: { state: 'ready', source: 'nimi-app-session' } };
}
