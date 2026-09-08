import type {
  NimiPortableAppAIConfig,
  NimiPortableAppAIConfigIntent,
} from '@nimiplatform/sdk/ai';
import type { NimiLocalAppAIConfigClient } from '@nimiplatform/sdk/app';
import { STORYBOOK_APP_ID } from '../../contracts/app-identity.ts';
import { getStorybookNimiClient } from '../../shell/infra/storybook-nimi-client.ts';

// These keys identify the retired renderer-owned AIConfig store. They remain
// only long enough to quarantine old developer data; Runtime is the sole live
// AIConfig store after the App Access hard cut.
export const STORYBOOK_AI_CONFIG_STORAGE_PREFIX = 'nimiapp-storybook:generation-ai-config:v2';
export const STORYBOOK_AI_CONFIG_INDEX_KEY = `${STORYBOOK_AI_CONFIG_STORAGE_PREFIX}:index`;
export const STORYBOOK_AI_CONFIG_QUARANTINE_PREFIX = `${STORYBOOK_AI_CONFIG_STORAGE_PREFIX}:quarantine:`;

export type StorybookAIConfigStorageRepairResult = {
  readonly scanned: number;
  readonly quarantined: number;
  readonly removedScopeKeys: readonly string[];
  readonly quarantineKeys: readonly string[];
};

type StorybookAIConfigStorageRepairOptions = {
  readonly now?: () => string;
};

type LegacyStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type StorybookAIConfigClient = Pick<NimiLocalAppAIConfigClient, 'get' | 'overwrite'>;

export function repairStorybookAIConfigStorage(
  storage: LegacyStorage | null = browserLocalStorage(),
  options: StorybookAIConfigStorageRepairOptions = {},
): StorybookAIConfigStorageRepairResult {
  if (!storage) {
    return { scanned: 0, quarantined: 0, removedScopeKeys: [], quarantineKeys: [] };
  }
  const scopeKeys = readLegacyScopeIndex(storage);
  const removedScopeKeys: string[] = [];
  const quarantineKeys: string[] = [];
  const quarantinedAt = options.now?.() ?? new Date().toISOString();

  for (const scopeKey of scopeKeys) {
    const originalKey = `${STORYBOOK_AI_CONFIG_STORAGE_PREFIX}:${scopeKey}`;
    const raw = storage.getItem(originalKey);
    if (raw === null) continue;
    const quarantineKey = uniqueQuarantineKey(storage, scopeKey, quarantinedAt);
    storage.setItem(quarantineKey, JSON.stringify({
      schemaVersion: 1,
      reasonCode: 'STORYBOOK_LEGACY_AI_CONFIG_RETIRED',
      reason: 'Renderer-owned NimiAIConfig is not portable App AIConfig and cannot be migrated safely.',
      scopeKey,
      originalKey,
      quarantinedAt,
      raw,
    }));
    storage.removeItem(originalKey);
    removedScopeKeys.push(scopeKey);
    quarantineKeys.push(quarantineKey);
  }
  storage.setItem(STORYBOOK_AI_CONFIG_INDEX_KEY, '[]');
  return {
    scanned: scopeKeys.length,
    quarantined: quarantineKeys.length,
    removedScopeKeys,
    quarantineKeys,
  };
}

export async function loadStorybookAIConfig(
  client: StorybookAIConfigClient = getStorybookNimiClient().aiConfig,
): Promise<NimiPortableAppAIConfig | null> {
  repairStorybookAIConfigStorage();
  try {
    const snapshot = await client.get();
    return snapshot.config ? requireStorybookAIConfigOwner(snapshot.config) : null;
  } catch (error) {
    if (isAIConfigNotFound(error)) return null;
    throw error;
  }
}

export async function overwriteStorybookAIConfig(
  capabilities: readonly NimiPortableAppAIConfigIntent[],
  options: {
    readonly client?: StorybookAIConfigClient;
    readonly expectedBaseVersion?: string;
  } = {},
): Promise<NimiPortableAppAIConfig> {
  const client = options.client ?? getStorybookNimiClient().aiConfig;
  const snapshot = await client.get();
  const current = snapshot.config ? requireStorybookAIConfigOwner(snapshot.config) : null;
  const expectedBaseVersion = options.expectedBaseVersion?.trim();
  if (expectedBaseVersion) {
    if (versionStorybookAIConfig(current) !== expectedBaseVersion) {
      throw new Error('AIConfig CAS conflict: baseVersion is stale');
    }
  }
  const result = await client.overwrite({ expectedRevision: snapshot.revision, capabilities });
  if (result.outcome === 'conflict') throw new Error('AIConfig CAS conflict: Runtime revision changed');
  return requireStorybookAIConfigOwner(result.config);
}

export function versionStorybookAIConfig(config: NimiPortableAppAIConfig | null): string {
  return fnv1a(canonicalJson(config));
}

export function requireStorybookAIConfigOwner(
  config: NimiPortableAppAIConfig,
): NimiPortableAppAIConfig {
  const owner = config.owner?.owner;
  if (owner?.oneofKind !== 'app' || owner.app.appId !== STORYBOOK_APP_ID) {
    throw new Error('Storybook AIConfig owner must be the exact nimi.storybook App.');
  }
  return config;
}

function browserLocalStorage(): LegacyStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readLegacyScopeIndex(storage: LegacyStorage): string[] {
  const raw = storage.getItem(STORYBOOK_AI_CONFIG_INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? [...new Set(parsed.filter((entry): entry is string => (
        typeof entry === 'string' && entry.trim().length > 0
      )))]
      : [];
  } catch {
    return [];
  }
}

function uniqueQuarantineKey(
  storage: LegacyStorage,
  scopeKey: string,
  quarantinedAt: string,
): string {
  const base = `${STORYBOOK_AI_CONFIG_QUARANTINE_PREFIX}${encodeURIComponent(scopeKey)}:${encodeURIComponent(quarantinedAt)}`;
  let candidate = base;
  let suffix = 1;
  while (storage.getItem(candidate) !== null) {
    candidate = `${base}:${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function isAIConfigNotFound(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const record = error as Record<string, unknown>;
  const reason = typeof record.reasonCode === 'string'
    ? record.reasonCode
    : typeof record.code === 'string'
      ? record.code
      : '';
  return reason.trim().toUpperCase().replaceAll('-', '_') === 'AI_CONFIG_NOT_FOUND';
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalJson(record[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
