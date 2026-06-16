import {
  createRuntimeAccountBrowserBroker,
  type AuthPlatformAdapter,
} from '@nimiplatform/kit/auth';
import { storybookTauriOAuthBridge } from '../../bridge/index.js';
import {
  ensureStorybookRuntimeClientReady,
  logoutStorybookRuntimeAccount,
  type StorybookAuthUser,
} from '../../infra/storybook-bootstrap.js';
import {
  getStorybookRuntimeSession,
  loadStorybookRuntimeAccountUser,
  storybookRuntimeAccountCaller,
} from '../../infra/storybook-runtime-session.ts';
import { useAppStore } from '../../app-shell/app-store.ts';

const STORYBOOK_EMBEDDED_AUTH_UNSUPPORTED =
  'Embedded auth flow is not supported in Storybook desktop-browser mode.';

const STORYBOOK_TOKEN_PROXY_FORBIDDEN =
  'Storybook does not own access/refresh token custody. '
  + 'Runtime is the sole owner; login through the desktop browser broker.';

function unsupported<T>(): Promise<T> {
  return Promise.reject(new Error(STORYBOOK_EMBEDDED_AUTH_UNSUPPORTED));
}

export async function loadCurrentUser(): Promise<StorybookAuthUser | null> {
  await ensureStorybookRuntimeClientReady();
  return loadStorybookRuntimeAccountUser(getStorybookRuntimeSession().accountRuntime);
}

async function syncAuthSessionFromRuntime(): Promise<void> {
  const user = await loadCurrentUser();
  const store = useAppStore.getState();
  if (user) {
    store.setAuthSession(user);
  } else {
    store.clearAuthSession();
  }
}

export function createStorybookDesktopBrowserAuthAdapter(): AuthPlatformAdapter {
  return {
    checkEmail: unsupported,
    passwordLogin: unsupported,
    requestEmailOtp: unsupported,
    verifyEmailOtp: unsupported,
    verifyTwoFactor: unsupported,
    walletChallenge: unsupported,
    walletLogin: unsupported,
    oauthLogin: unsupported,
    updatePassword: unsupported,
    loadCurrentUser,
    applyToken: async () => {
      throw new Error(STORYBOOK_TOKEN_PROXY_FORBIDDEN);
    },
    persistSession: async () => {
      throw new Error(STORYBOOK_TOKEN_PROXY_FORBIDDEN);
    },
    clearPersistedSession: async () => {
      await logoutStorybookRuntimeAccount();
      useAppStore.getState().clearAuthSession();
    },
    oauthBridge: storybookTauriOAuthBridge,
    syncAfterLogin: syncAuthSessionFromRuntime,
    onLoginComplete: syncAuthSessionFromRuntime,
  };
}

export function createStorybookRuntimeAccountBrowserBroker() {
  return createRuntimeAccountBrowserBroker({
    caller: storybookRuntimeAccountCaller,
    beforeRequest: ensureStorybookRuntimeClientReady,
    getClient: () => getStorybookRuntimeSession().client,
    projectUser: (projection) => {
      const accountId = String(projection.accountId || '').trim();
      return accountId
        ? {
            id: accountId,
            displayName: String(projection.displayName || '').trim(),
          }
        : null;
    },
  });
}
