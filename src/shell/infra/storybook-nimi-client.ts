import {
  createNimiClient,
  type NimiLocalAppClient,
} from '@nimiplatform/sdk';
import {
  createNimiLocalAppStandardShellSurface,
} from '@nimiplatform/kit/shell/renderer/bridge';

let storybookClient: NimiLocalAppClient | null = null;

export function getStorybookNimiClient(): NimiLocalAppClient {
  storybookClient ??= createNimiClient({
    localApp: {
      standardShell: createNimiLocalAppStandardShellSurface(),
    },
  });
  return storybookClient;
}
