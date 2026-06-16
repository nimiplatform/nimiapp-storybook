import type { NimiClient } from '@nimiplatform/sdk';

let storybookClient: NimiClient | null = null;

export function setStorybookNimiClient(client: NimiClient | null): void {
  storybookClient = client;
}

export function hasStorybookNimiClient(): boolean {
  return storybookClient !== null;
}

export function getStorybookNimiClient(): NimiClient {
  if (!storybookClient) {
    throw new Error('Storybook Nimi client is not initialized. Run bootstrap before using Runtime surfaces.');
  }
  return storybookClient;
}
