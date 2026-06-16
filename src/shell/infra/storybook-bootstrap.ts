import { getStorybookRuntimeDefaults } from '../bridge/index.js';
import { useAppStore } from '../app-shell/app-store.js';
import { ensureStorybookAIConfigFromFirstLaunchProfile } from '../ai/storybook-ai-config-bootstrap.ts';
import { describeError, logRendererEvent } from './renderer-log.js';
import { hasStorybookNimiClient, setStorybookNimiClient } from './storybook-nimi-client.js';
import {
  STORYBOOK_RUNTIME_APP_ID,
  STORYBOOK_RUNTIME_APP_INSTANCE_ID,
  STORYBOOK_RUNTIME_DEVICE_ID,
  clearStorybookRuntimeSession,
  configureStorybookRuntimeSession,
  loadStorybookRuntimeAccountUser,
  logoutStorybookRuntimeAccount as logoutCurrentStorybookRuntimeAccount,
  storybookRuntimeAccountCaller,
  type StorybookAuthUser,
} from './storybook-runtime-session.ts';

let bootstrapPromise: Promise<void> | null = null;

export {
  STORYBOOK_RUNTIME_APP_ID,
  STORYBOOK_RUNTIME_APP_INSTANCE_ID,
  STORYBOOK_RUNTIME_DEVICE_ID,
  loadStorybookRuntimeAccountUser,
  storybookRuntimeAccountCaller,
  type StorybookAuthUser,
};

export async function runStorybookBootstrap(options: { force?: boolean } = {}): Promise<void> {
  if (bootstrapPromise && !options.force) return bootstrapPromise;
  if (options.force) bootstrapPromise = null;
  bootstrapPromise = doRunStorybookBootstrap().finally(() => {
    if (!useAppStore.getState().bootstrapReady) bootstrapPromise = null;
  });
  return bootstrapPromise;
}

export async function ensureStorybookBootstrapReady(): Promise<void> {
  const store = useAppStore.getState();
  if (store.bootstrapReady) return;
  await runStorybookBootstrap();
  const next = useAppStore.getState();
  if (!next.bootstrapReady) {
    throw new Error(next.bootstrapError || 'Storybook bootstrap did not complete');
  }
}

export async function ensureStorybookRuntimeClientReady(): Promise<void> {
  await ensureStorybookBootstrapReady();
  if (hasStorybookNimiClient()) return;
  await runStorybookBootstrap({ force: true });
  if (!hasStorybookNimiClient()) {
    throw new Error('Storybook Nimi client is unavailable after bootstrap retry');
  }
}

async function doRunStorybookBootstrap(): Promise<void> {
  const store = useAppStore.getState();
  const flowId = `storybook-bootstrap-${Date.now().toString(36)}`;

  try {
    const runtimeDefaults = await getStorybookRuntimeDefaults();
    store.setRuntimeDefaults(runtimeDefaults);

    setStorybookNimiClient(null);
    clearStorybookRuntimeSession();
    const session = await configureStorybookRuntimeSession();
    setStorybookNimiClient(session.client);

    const runtimeAccountUser = await loadStorybookRuntimeAccountUser(session.accountRuntime)
      .catch((error) => {
        logRendererEvent({
          level: 'warn',
          area: 'storybook-bootstrap.account',
          message: 'action:runtime-account-projection-unavailable',
          flowId,
          details: { error: describeError(error) },
        });
        return null;
      });
    if (runtimeAccountUser) {
      store.setAuthSession(runtimeAccountUser);
    } else {
      store.clearAuthSession();
    }

    await session.runtime.ready();

    const aiConfigInit = await ensureStorybookAIConfigFromFirstLaunchProfile();
    if (aiConfigInit.outcome === 'setup-required') {
      logRendererEvent({
        level: 'warn',
        area: 'storybook-bootstrap.ai-config',
        message: 'action:first-launch-ai-config-setup-required',
        flowId,
        details: {
          reason: aiConfigInit.reason,
          detail: aiConfigInit.detail,
        },
      });
    }

    store.setBootstrapReady(true);
    store.setBootstrapError(null);
  } catch (error) {
    setStorybookNimiClient(null);
    clearStorybookRuntimeSession();
    const message = error instanceof Error ? error.message : String(error);
    logRendererEvent({
      level: 'error',
      area: 'bootstrap',
      message: 'action:bootstrap-failed',
      flowId,
      details: { error: describeError(error) },
    });
    store.setBootstrapError(message);
    store.setBootstrapReady(false);
  }
}

export async function logoutStorybookRuntimeAccount(): Promise<void> {
  await ensureStorybookRuntimeClientReady();
  await logoutCurrentStorybookRuntimeAccount();
}
