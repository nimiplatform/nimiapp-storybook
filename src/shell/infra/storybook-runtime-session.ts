import { createNimiClient, type NimiClient } from '@nimiplatform/sdk';
import {
  Runtime,
  createNimiDeveloperRegisteredRuntimeAccountCaller,
  createNimiRuntimeAppSessionMetadataProvider,
  createNimiRuntimeFullAppRegistration,
  toNimiRuntimeTimestamp,
  withNimiRuntimeIdempotencyMetadata,
  type NimiRuntimeAccountCaller,
  type RuntimeOptions,
} from '@nimiplatform/sdk/runtime';
import {
  AccountSessionState,
  AuthorizationPreset,
  ExternalPrincipalType,
  PolicyMode,
  type AccountProjection,
  type AuthorizeExternalPrincipalResponse,
} from '@nimiplatform/sdk/runtime/generated';
import {
  createNimiClientId,
  createNimiError,
  ReasonCode,
  type CoreMetadata,
} from '@nimiplatform/sdk/types';
import {
  STORYBOOK_RUNTIME_APP_ID,
  STORYBOOK_RUNTIME_APP_INSTANCE_ID,
  STORYBOOK_RUNTIME_DEVICE_ID,
} from '../../contracts/app-identity.ts';

export {
  STORYBOOK_RUNTIME_APP_ID,
  STORYBOOK_RUNTIME_APP_INSTANCE_ID,
  STORYBOOK_RUNTIME_DEVICE_ID,
};

const STORYBOOK_RUNTIME_DEVELOPER_REGISTRATION = true;
const RUNTIME_APP_SESSION_INSTANCE_ID = `${STORYBOOK_RUNTIME_APP_ID}.platform-runtime-session`;
const RUNTIME_APP_SESSION_DEVICE_ID = 'platform-runtime-session';
const RUNTIME_APP_SESSION_TTL_SECONDS = 3600;
const RUNTIME_APP_SESSION_REFRESH_SKEW_MS = 30_000;
const RUNTIME_PROTECTED_SCOPES = ['ai.spend.meter'] as const;
const RUNTIME_PROTECTED_SCOPE_CATALOG_VERSION = 'sdk-v2';
const RUNTIME_PROTECTED_TOKEN_TTL_SECONDS = 3600;
const RUNTIME_PROTECTED_TOKEN_REFRESH_SKEW_MS = 60_000;
const RUNTIME_PROTECTED_CONSENT_ID = 'storybook-runtime-account';

export type StorybookAuthUser = {
  id: string;
  displayName: string;
};

export type StorybookRuntimeSession = {
  readonly client: NimiClient;
  readonly runtime: Runtime;
  readonly accountRuntime: Runtime;
  readonly accountCaller: NimiRuntimeAccountCaller;
};

export const storybookRuntimeAccountCaller = createNimiDeveloperRegisteredRuntimeAccountCaller({
  appId: STORYBOOK_RUNTIME_APP_ID,
  appInstanceId: STORYBOOK_RUNTIME_APP_INSTANCE_ID,
  deviceId: STORYBOOK_RUNTIME_DEVICE_ID,
});

let currentSession: StorybookRuntimeSession | null = null;

type ProtectedAccessMetadata = {
  readonly subjectUserId: string;
  readonly metadata: CoreMetadata;
  readonly expiresAtMs: number;
};

let protectedAccessCache: ProtectedAccessMetadata | null = null;
let protectedAccessInflight: {
  readonly subjectUserId: string;
  readonly promise: Promise<ProtectedAccessMetadata>;
} | null = null;

export async function configureStorybookRuntimeSession(): Promise<StorybookRuntimeSession> {
  const accountRuntime = new Runtime({
    appId: STORYBOOK_RUNTIME_APP_ID,
    transport: runtimeTransport(),
  });
  await accountRuntime.ready();
  await registerStorybookRuntimeAccountCaller(accountRuntime);

  const runtime = new Runtime({
    appId: STORYBOOK_RUNTIME_APP_ID,
    transport: runtimeTransport(),
    authMetadata: createStorybookRuntimeAppSessionMetadataProvider(accountRuntime),
  });
  const client = createNimiClient({
    appId: STORYBOOK_RUNTIME_APP_ID,
    runtime,
    realm: false,
    app: false,
    permissions: false,
  });
  await client.runtime.ready();
  const session: StorybookRuntimeSession = {
    client,
    runtime,
    accountRuntime,
    accountCaller: storybookRuntimeAccountCaller,
  };
  currentSession = session;
  return session;
}

export function getStorybookRuntimeSession(): StorybookRuntimeSession {
  if (!currentSession) {
    throw createNimiError({
      message: 'Storybook Runtime session is not ready.',
      reasonCode: ReasonCode.SDK_PLATFORM_CLIENT_NOT_READY,
      actionHint: 'run_storybook_bootstrap',
      source: 'sdk',
    });
  }
  return currentSession;
}

export function clearStorybookRuntimeSession(): void {
  currentSession = null;
  protectedAccessCache = null;
  protectedAccessInflight = null;
}

export function normalizeStorybookAccountProjection(
  projection: AccountProjection | null | undefined,
): StorybookAuthUser | null {
  const accountId = normalizeText(projection?.accountId);
  if (!accountId) return null;
  return {
    id: accountId,
    displayName: normalizeText(projection?.displayName),
  };
}

export async function loadStorybookRuntimeAccountUser(
  runtime: Runtime,
): Promise<StorybookAuthUser | null> {
  const response = await runtime.account.getAccountSessionStatus({
    caller: storybookRuntimeAccountCaller,
  });
  if (response.state !== AccountSessionState.AUTHENTICATED) return null;
  return normalizeStorybookAccountProjection(response.accountProjection);
}

export async function requireStorybookRuntimeSubjectUserId(): Promise<string> {
  const session = getStorybookRuntimeSession();
  const response = await session.accountRuntime.account.getAccountSessionStatus({
    caller: session.accountCaller,
  });
  const accountId = response.state === AccountSessionState.AUTHENTICATED
    ? normalizeText(response.accountProjection?.accountId)
    : '';
  if (!accountId) {
    throw createNimiError({
      message: 'Storybook Runtime AI requires an authenticated Runtime account subject.',
      reasonCode: ReasonCode.AUTH_CONTEXT_MISSING,
      actionHint: 'complete_runtime_account_login',
      source: 'runtime',
    });
  }
  return accountId;
}

export async function logoutStorybookRuntimeAccount(): Promise<void> {
  throw createNimiError({
    message: 'Storybook is a developer-registered local app and cannot own Runtime account logout. Sign out from the first-party Desktop account surface.',
    reasonCode: ReasonCode.PRINCIPAL_UNAUTHORIZED,
    actionHint: 'use_desktop_account_surface',
    source: 'runtime',
  });
}

function runtimeTransport(): RuntimeOptions['transport'] {
  return {
    type: 'tauri-ipc',
    commandNamespace: 'runtime_bridge',
    eventNamespace: 'runtime_bridge',
  };
}

async function registerStorybookRuntimeAccountCaller(runtime: Runtime): Promise<void> {
  await createNimiRuntimeFullAppRegistration(
    () => ({ auth: runtime.auth }),
    {
      appId: STORYBOOK_RUNTIME_APP_ID,
      appInstanceId: storybookRuntimeAccountCaller.appInstanceId,
      deviceId: storybookRuntimeAccountCaller.deviceId,
      capabilities: [...RUNTIME_PROTECTED_SCOPES],
      developerRegistration: STORYBOOK_RUNTIME_DEVELOPER_REGISTRATION,
      rejectionLabel: 'Storybook Runtime account caller registration rejected',
    },
  )();
}

function createStorybookRuntimeAppSessionMetadataProvider(
  accountRuntime: Runtime,
): () => Promise<CoreMetadata> {
  const requiredRuntimeSessionMetadata = createNimiRuntimeAppSessionMetadataProvider({
    appId: STORYBOOK_RUNTIME_APP_ID,
    appInstanceId: RUNTIME_APP_SESSION_INSTANCE_ID,
    deviceId: RUNTIME_APP_SESSION_DEVICE_ID,
    capabilities: [...RUNTIME_PROTECTED_SCOPES],
    ttlSeconds: RUNTIME_APP_SESSION_TTL_SECONDS,
    refreshSkewMs: RUNTIME_APP_SESSION_REFRESH_SKEW_MS,
    developerRegistration: STORYBOOK_RUNTIME_DEVELOPER_REGISTRATION,
    auth: accountRuntime.auth,
  });

  return async () => {
    const session = await accountRuntime.account.getAccountSessionStatus({
      caller: storybookRuntimeAccountCaller,
    });
    const subjectUserId = session.state === AccountSessionState.AUTHENTICATED
      ? normalizeText(session.accountProjection?.accountId)
      : '';
    if (!subjectUserId) return {};
    const appSessionMetadata = await requiredRuntimeSessionMetadata();
    const protectedAccessMetadata = await getStorybookRuntimeProtectedAccessMetadata(
      accountRuntime,
      subjectUserId,
    );
    return {
      ...appSessionMetadata,
      ...protectedAccessMetadata,
    };
  };
}

async function getStorybookRuntimeProtectedAccessMetadata(
  accountRuntime: Runtime,
  subjectUserId: string,
): Promise<CoreMetadata> {
  if (
    protectedAccessCache
    && protectedAccessCache.subjectUserId === subjectUserId
    && protectedAccessCache.expiresAtMs - Date.now() > RUNTIME_PROTECTED_TOKEN_REFRESH_SKEW_MS
  ) {
    return protectedAccessCache.metadata;
  }
  if (!protectedAccessInflight || protectedAccessInflight.subjectUserId !== subjectUserId) {
    protectedAccessInflight = {
      subjectUserId,
      promise: issueStorybookRuntimeProtectedAccessMetadata(accountRuntime, subjectUserId),
    };
  }
  const inflight = protectedAccessInflight;
  try {
    const issued = await inflight.promise;
    protectedAccessCache = issued;
    return issued.metadata;
  } finally {
    if (protectedAccessInflight === inflight) protectedAccessInflight = null;
  }
}

async function issueStorybookRuntimeProtectedAccessMetadata(
  accountRuntime: Runtime,
  subjectUserId: string,
): Promise<ProtectedAccessMetadata> {
  const token = await accountRuntime.grants.authorizeExternalPrincipal({
    domain: 'app-auth',
    appId: STORYBOOK_RUNTIME_APP_ID,
    externalPrincipalId: STORYBOOK_RUNTIME_APP_ID,
    externalPrincipalType: ExternalPrincipalType.APP,
    subjectUserId,
    consentId: RUNTIME_PROTECTED_CONSENT_ID,
    consentVersion: 'v1',
    decisionAt: toNimiRuntimeTimestamp(new Date()),
    policyVersion: 'storybook-runtime-account-v1',
    policyMode: PolicyMode.CUSTOM,
    preset: AuthorizationPreset.UNSPECIFIED,
    scopes: [...RUNTIME_PROTECTED_SCOPES],
    resourceSelectors: {
      conversationIds: [],
      messageIds: [],
      documentIds: [],
      labels: {},
    },
    canDelegate: false,
    maxDelegationDepth: 0,
    ttlSeconds: RUNTIME_PROTECTED_TOKEN_TTL_SECONDS,
    scopeCatalogVersion: RUNTIME_PROTECTED_SCOPE_CATALOG_VERSION,
    policyOverride: false,
  }, withNimiRuntimeIdempotencyMetadata({
    metadata: { domain: 'app-auth' },
  }, createRuntimeProtectedAccessIdempotencyKey(subjectUserId)));
  const tokenId = normalizeText(token.tokenId);
  const secret = normalizeText(token.secret);
  if (!tokenId || !secret) {
    throw createNimiError({
      message: 'Storybook Runtime protected access token response is missing credentials.',
      reasonCode: ReasonCode.PRINCIPAL_UNAUTHORIZED,
      actionHint: 'authorize_storybook_runtime_protected_access',
      source: 'runtime',
    });
  }
  return {
    subjectUserId,
    metadata: {
      'x-nimi-access-token-id': tokenId,
      'x-nimi-access-token-secret': secret,
    },
    expiresAtMs: runtimeTimestampMillis(token)
      || Date.now() + (RUNTIME_PROTECTED_TOKEN_TTL_SECONDS * 1000),
  };
}

function createRuntimeProtectedAccessIdempotencyKey(subjectUserId: string): string {
  const normalizedSubject = subjectUserId.replace(/[^a-zA-Z0-9._:-]/g, '_').slice(0, 80) || 'unknown';
  return createNimiClientId(`storybook-runtime-protected-${normalizedSubject}`);
}

function runtimeTimestampMillis(token: AuthorizeExternalPrincipalResponse): number {
  const expiresAt = token.expiresAt;
  if (!expiresAt) return 0;
  const seconds = Number(expiresAt.seconds || 0);
  const nanos = Number(expiresAt.nanos || 0);
  const millis = (seconds * 1000) + Math.floor(nanos / 1_000_000);
  return Number.isFinite(millis) && millis > 0 ? millis : 0;
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
