import { create } from 'zustand';

export type AuthStatus = 'bootstrapping' | 'authenticated' | 'unauthenticated';

interface AppState {
  auth: {
    status: AuthStatus;
    reasonCode: string;
    actionHint: string;
  };
  bootstrapReady: boolean;
  bootstrapError: string | null;

  setAuthSession: () => void;
  clearAuthSession: (reasonCode: string, actionHint: string) => void;
  setBootstrapReady: (ready: boolean) => void;
  setBootstrapError: (error: string | null) => void;
}

declare global {
  interface ImportMeta {
    readonly env?: { readonly DEV?: boolean };
  }
  interface Window {
    __STORYBOOK_APP_STORE__?: typeof useAppStore;
  }
}

export const useAppStore = create<AppState>((set) => ({
  auth: {
    status: 'bootstrapping',
    reasonCode: 'local-app-session-checking',
    actionHint: 'wait_for_desktop_supervised_session',
  },
  bootstrapReady: false,
  bootstrapError: null,

  setAuthSession() {
    set({
      auth: {
        status: 'authenticated',
        reasonCode: 'local-app-session-bound',
        actionHint: 'use_storybook',
      },
    });
  },
  clearAuthSession(reasonCode, actionHint) {
    set({ auth: { status: 'unauthenticated', reasonCode, actionHint } });
  },
  setBootstrapReady: (ready) => set({ bootstrapReady: ready }),
  setBootstrapError: (error) => set({ bootstrapError: error }),
}));

if (typeof window !== 'undefined' && import.meta.env?.DEV) {
  window.__STORYBOOK_APP_STORE__ = useAppStore;
}
