import {
  createNimiAIConfigStore,
  createNimiAIConfigSubscriptionRegistry,
  createNimiAIHostSurface,
  createNimiAppAIScopeRef,
  validateNimiAIConfig,
  versionNimiAIConfig,
  type NimiAIConfig,
  type NimiAIHostStorage,
  type NimiAIProfile,
  type NimiAIScopeRef,
} from '@nimiplatform/sdk/ai';
import type {
  SharedAIConfigService,
  SharedAIConfigSubscribeListener,
  SharedAIConfigUnsubscribe,
} from '@nimiplatform/kit/features/model-config/headless';
import { resolveBrowserStorage } from '@nimiplatform/kit/core/storage-json';
import { STORYBOOK_APP_ID } from '../../contracts/app-identity.ts';

export const STORYBOOK_AI_SURFACE_ID = 'storybook.generation';
export const STORYBOOK_AI_CONFIG_STORAGE_PREFIX = 'nimiapp-storybook:generation-ai-config:v2';
export const STORYBOOK_AI_CONFIG_INDEX_KEY = `${STORYBOOK_AI_CONFIG_STORAGE_PREFIX}:index`;
export const STORYBOOK_AI_PROFILE_LIBRARY_STORAGE_KEY = 'nimiapp-storybook:generation-ai-profiles:v1';
export const STORYBOOK_AI_PROFILE_LIBRARY_SCHEMA_VERSION = 1;

type StorybookAIProfileLibraryStore = {
  schemaVersion: typeof STORYBOOK_AI_PROFILE_LIBRARY_SCHEMA_VERSION;
  profiles: NimiAIProfile[];
};

const configSubscriptions = createNimiAIConfigSubscriptionRegistry();
const ephemeralProfiles: NimiAIProfile[] = [];

function isStorageLike(value: unknown): value is Storage {
  return Boolean(value)
    && typeof (value as Storage).getItem === 'function'
    && typeof (value as Storage).setItem === 'function'
    && typeof (value as Storage).removeItem === 'function';
}

function getStorage(): Storage | null {
  const storage = resolveBrowserStorage('local');
  return isStorageLike(storage) ? storage : null;
}

function useEphemeralStore(): boolean {
  return typeof window === 'undefined';
}

const aiConfigStore = createNimiAIConfigStore({
  indexKey: STORYBOOK_AI_CONFIG_INDEX_KEY,
  storage: () => getStorage() as NimiAIHostStorage | null,
  configKeyForScope: (scopeKey) => `${STORYBOOK_AI_CONFIG_STORAGE_PREFIX}:${scopeKey}`,
  enableEphemeralStore: useEphemeralStore(),
});

export function createStorybookAIScopeRef(): NimiAIScopeRef {
  return createNimiAppAIScopeRef(STORYBOOK_APP_ID, STORYBOOK_AI_SURFACE_ID);
}

function defaultProfileLibraryStore(): StorybookAIProfileLibraryStore {
  return {
    schemaVersion: STORYBOOK_AI_PROFILE_LIBRARY_SCHEMA_VERSION,
    profiles: [],
  };
}

function parseProfileLibrary(raw: string): StorybookAIProfileLibraryStore {
  const parsed = JSON.parse(raw) as Partial<StorybookAIProfileLibraryStore>;
  if (
    parsed.schemaVersion !== STORYBOOK_AI_PROFILE_LIBRARY_SCHEMA_VERSION
    || !Array.isArray(parsed.profiles)
  ) {
    throw new Error('Stored Storybook AIProfile library schema is invalid.');
  }
  return {
    schemaVersion: STORYBOOK_AI_PROFILE_LIBRARY_SCHEMA_VERSION,
    profiles: [...parsed.profiles],
  };
}

function loadProfileLibraryStore(storage: Storage | null = getStorage()): StorybookAIProfileLibraryStore {
  if (!storage) {
    if (!useEphemeralStore()) {
      throw new Error('Storybook AIProfile library requires browser local storage.');
    }
    return {
      schemaVersion: STORYBOOK_AI_PROFILE_LIBRARY_SCHEMA_VERSION,
      profiles: [...ephemeralProfiles],
    };
  }
  const raw = storage.getItem(STORYBOOK_AI_PROFILE_LIBRARY_STORAGE_KEY);
  return raw ? parseProfileLibrary(raw) : defaultProfileLibraryStore();
}

export function listStorybookAIProfiles(): NimiAIProfile[] {
  return [...loadProfileLibraryStore().profiles];
}

export function loadStorybookAIConfig(
  scopeRef: NimiAIScopeRef = createStorybookAIScopeRef(),
): NimiAIConfig {
  try {
    return aiConfigStore.load(scopeRef);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith('AIConfig targetRef is invalid: ')) {
      throw new Error(`Stored ${message}`, { cause: error });
    }
    if (message === 'AIConfig schema is invalid.') {
      throw new Error('Stored Storybook AIConfig scope does not match storybook.generation.', {
        cause: error,
      });
    }
    throw error;
  }
}

export function saveStorybookAIConfig(
  next: NimiAIConfig,
  scopeRef: NimiAIScopeRef = createStorybookAIScopeRef(),
  options?: { readonly expectedBaseVersion?: string },
): NimiAIConfig {
  const normalized = { ...next, scopeRef };
  const expectedBaseVersion = options?.expectedBaseVersion?.trim();
  if (expectedBaseVersion) {
    const currentVersion = versionNimiAIConfig(loadStorybookAIConfig(scopeRef));
    if (currentVersion !== expectedBaseVersion) {
      throw new Error('AIConfig CAS conflict: baseVersion is stale');
    }
  }
  const validation = validateNimiAIConfig(normalized);
  if (!validation.valid) {
    throw new Error(`AIConfig validation failed: ${validation.errors.join('; ')}`);
  }
  const saved = aiConfigStore.save(normalized);
  configSubscriptions.notify(saved);
  return saved;
}

export function createStorybookAIConfigService(): SharedAIConfigService {
  const surface = createNimiAIHostSurface({
    configStore: aiConfigStore,
    subscriptions: configSubscriptions,
    profiles: listStorybookAIProfiles(),
  });

  return {
    aiConfig: {
      get(scopeRef: NimiAIScopeRef): NimiAIConfig {
        return loadStorybookAIConfig(scopeRef);
      },
      update(scopeRef: NimiAIScopeRef, next: NimiAIConfig): void {
        saveStorybookAIConfig(next, scopeRef);
      },
      subscribe(
        scopeRef: NimiAIScopeRef,
        listener: SharedAIConfigSubscribeListener,
      ): SharedAIConfigUnsubscribe {
        return configSubscriptions.subscribe(scopeRef, listener);
      },
    },
    aiProfile: {
      list: async () => [...(await surface.aiProfile.list())],
      previewApply: (scopeRef, profileId, options) =>
        surface.aiProfile.previewApply(scopeRef, profileId, options),
      apply: (scopeRef, profileId, options) => surface.aiProfile.apply(scopeRef, profileId, options),
    },
  };
}
