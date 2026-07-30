import { useAppStore } from '../app-shell/app-store.js';
import { describeError, logRendererEvent } from './renderer-log.js';
import { getStorybookNimiClient } from './storybook-nimi-client.js';
import { STORYBOOK_APP_ID } from '../../contracts/app-identity.ts';

let bootstrapPromise: Promise<void> | null = null;

export const STORYBOOK_RUNTIME_APP_ID = STORYBOOK_APP_ID;

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

export async function ensureStorybookSessionBound(): Promise<void> {
  await ensureStorybookBootstrapReady();
  const auth = useAppStore.getState().auth;
  if (auth.status !== 'authenticated') {
    throw Object.assign(new Error('Storybook requires a Desktop-supervised local-app session.'), {
      reasonCode: auth.reasonCode,
      actionHint: auth.actionHint,
      source: 'sdk',
    });
  }
}

async function doRunStorybookBootstrap(): Promise<void> {
  const store = useAppStore.getState();
  const flowId = `storybook-bootstrap-${Date.now().toString(36)}`;

  try {
    const session = await getStorybookNimiClient().auth.status();
    if (session.sessionBound) {
      store.setAuthSession();
    } else {
      logRendererEvent({
        level: 'warn',
        area: 'storybook-bootstrap.session',
        message: 'action:desktop-supervised-session-required',
        flowId,
        details: {
          reasonCode: session.reasonCode,
          actionHint: session.actionHint,
        },
      });
      store.clearAuthSession(session.reasonCode, session.actionHint);
    }
    store.setBootstrapReady(true);
    store.setBootstrapError(null);
  } catch (error) {
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
