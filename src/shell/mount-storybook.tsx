import React from 'react';
import { createRoot } from 'react-dom/client';
import { NimiThemeProvider, NimiToaster, TooltipProvider } from '@nimiplatform/kit/ui';
import { NimiAppAccessGate, NimiAppSessionProvider, type NimiAppSession } from '@nimiplatform/kit/auth/app';
import { bindStorybookSession } from './infra/storybook-nimi-client.js';
import { useAppStore } from './app-shell/app-store.js';
import { detachStorybookStore, resetStorybookStore } from '../storybook/store/native-repository.js';
import { resetStorybookEditors } from '../storybook/store/editor-session.js';
import { resetStorybookExperiences } from '../storybook/ai/storybook-experience.js';
import { App } from './App.js';
import '../styles.css';
import './auth/auth-i18n.js';
import { bindStorybookFileDelivery, type StorybookFileDelivery } from './infra/storybook-file-delivery.js';

// @nimi-authority: rule.storybook.ia.r006
export function mountStorybook(session: NimiAppSession, fileDelivery: StorybookFileDelivery) {
  const unbindFileDelivery = bindStorybookFileDelivery(fileDelivery);
  bindStorybookSession(session);
  let identityKey: string | undefined;
  let connectionKey: string | undefined;
  const project = () => {
    const state = session.getSnapshot();
    const nextIdentity = state.identity.status === 'signed-in' ? state.identity.viewKey : undefined;
    const nextConnection = state.runtime.status === 'connected' ? state.runtime.scope.viewKey : undefined;
    if (identityKey !== nextIdentity) {
      resetStorybookStore(); resetStorybookEditors(); resetStorybookExperiences();
    } else if (connectionKey !== nextConnection) detachStorybookStore();
    identityKey = nextIdentity; connectionKey = nextConnection;
    const store = useAppStore.getState();
    if (nextConnection) store.setAuthSession();
    else store.clearAuthSession(state.issue?.reasonCode ?? 'runtime-disconnected', 'connect_runtime');
    store.setBootstrapReady(state.identity.status !== 'checking');
    store.setBootstrapError(state.issue?.message ?? null);
  };
  const off = session.subscribe(project); project();
  const root = createRoot(document.getElementById('root')!);
  root.render(<React.StrictMode><NimiThemeProvider accentPack="nimi-accent"><TooltipProvider>
    <NimiAppSessionProvider session={session}>
      <NimiAppAccessGate title="Storybook" language="zh" requireRuntime={false}><App /></NimiAppAccessGate>
    </NimiAppSessionProvider><NimiToaster />
  </TooltipProvider></NimiThemeProvider></React.StrictMode>);
  void session.start();
  return () => { off(); session.dispose(); root.unmount(); unbindFileDelivery(); resetStorybookStore(); resetStorybookEditors(); resetStorybookExperiences(); };
}
