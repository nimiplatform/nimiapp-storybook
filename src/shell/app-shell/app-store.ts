import { create } from 'zustand';
import type { StorybookRuntimeDefaults } from '../bridge/index.js';

export type AuthUser = {
  id: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
};

export type AuthStatus = 'bootstrapping' | 'authenticated' | 'unauthenticated';

interface AppState {
  auth: {
    status: AuthStatus;
    user: AuthUser | null;
  };
  bootstrapReady: boolean;
  bootstrapError: string | null;
  runtimeDefaults: StorybookRuntimeDefaults | null;

  setAuthSession: (user: AuthUser) => void;
  clearAuthSession: () => void;
  setBootstrapReady: (ready: boolean) => void;
  setBootstrapError: (error: string | null) => void;
  setRuntimeDefaults: (defaults: StorybookRuntimeDefaults) => void;
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
    user: null,
  },
  bootstrapReady: false,
  bootstrapError: null,
  runtimeDefaults: null,

  setAuthSession(user) {
    set({ auth: { status: 'authenticated', user } });
  },
  clearAuthSession() {
    set({ auth: { status: 'unauthenticated', user: null } });
  },
  setBootstrapReady: (ready) => set({ bootstrapReady: ready }),
  setBootstrapError: (error) => set({ bootstrapError: error }),
  setRuntimeDefaults: (defaults) => set({ runtimeDefaults: defaults }),
}));

if (typeof window !== 'undefined' && import.meta.env?.DEV) {
  window.__STORYBOOK_APP_STORE__ = useAppStore;
}
