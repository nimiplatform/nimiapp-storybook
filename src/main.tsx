import React from 'react';
import { createRoot } from 'react-dom/client';
import { NimiThemeProvider, NimiToaster, TooltipProvider } from '@nimiplatform/kit/ui';
import { installNimiShellRuntimeBridge } from '@nimiplatform/kit/shell/renderer/bridge';
import './styles.css';
import './shell/auth/auth-i18n.js';
import { App } from './shell/App.js';
import { installStorybookGlobalErrorLogging } from './shell/infra/renderer-log.js';

// Platform bootstrap (Kit-owned): install the Desktop-supervised standard
// bridge before the local-app client reads its public session posture.
installStorybookGlobalErrorLogging();
installNimiShellRuntimeBridge();

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <NimiThemeProvider accentPack="nimi-accent">
      <TooltipProvider>
        <App />\r
        <NimiToaster />
      </TooltipProvider>
    </NimiThemeProvider>
  </React.StrictMode>,
);
