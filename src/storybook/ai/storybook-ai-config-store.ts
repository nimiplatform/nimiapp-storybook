import type {
  NimiPortableAppAIConfig,
  NimiPortableAppAIConfigIntent,
} from '@nimiplatform/sdk/ai';
import type { NimiLocalAppAIConfigClient } from '@nimiplatform/sdk/app';
import { STORYBOOK_APP_ID } from '../../contracts/app-identity.ts';
import { getStorybookNimiClient } from '../../shell/infra/storybook-nimi-client.ts';

export type StorybookAIConfigClient = Pick<NimiLocalAppAIConfigClient, 'get' | 'overwrite'>;

export async function loadStorybookAIConfig(
  client: StorybookAIConfigClient = getStorybookNimiClient().aiConfig,
): Promise<NimiPortableAppAIConfig | null> {
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
