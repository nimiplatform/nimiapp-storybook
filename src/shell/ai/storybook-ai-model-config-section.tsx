import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  NimiCapabilityAIConfigIntent,
  NimiPortableAppAIConfig,
  NimiPortableAppAIConfigIntent,
} from '@nimiplatform/sdk/ai';
import {
  ModelConfigAIConfigSurface,
  type ModelConfigFormattedError,
} from '@nimiplatform/kit/features/model-config';
import { STORYBOOK_APP_ID } from '../../contracts/app-identity.ts';
import {
  loadStorybookAIConfig,
  overwriteStorybookAIConfig,
  versionStorybookAIConfig,
} from '../../storybook/ai/storybook-ai-config-store.ts';
import { useAppStore } from '../app-shell/app-store.js';
import { STORYBOOK_MODEL_CONFIG_COPY } from './model-config-copy.ts';
import { STORYBOOK_TEXT_GENERATE_CAPABILITY_ID } from './storybook-ai-requirements.ts';

export function StorybookAiModelConfigSection() {
  const bootstrapReady = useAppStore((state) => state.bootstrapReady);
  const authenticated = useAppStore((state) => state.auth.status === 'authenticated');
  const [config, setConfig] = useState<NimiPortableAppAIConfig | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!bootstrapReady || !authenticated) {
      setConfig(undefined);
      setLoadError(null);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      setConfig(await loadStorybookAIConfig());
    } catch (error) {
      setConfig(undefined);
      setLoadError(error instanceof Error ? error.message : String(error || 'AIConfig read failed.'));
    } finally {
      setLoading(false);
    }
  }, [authenticated, bootstrapReady]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const overwrite = useCallback(async (
    capabilities: readonly NimiCapabilityAIConfigIntent[],
  ) => {
    const expectedBaseVersion = versionStorybookAIConfig(config ?? null);
    const next = await overwriteStorybookAIConfig(
      requirePortableCapabilities(capabilities),
      { expectedBaseVersion },
    );
    setConfig(next);
  }, [config]);

  const context = useMemo(() => ({
    owner: 'app-ai-config' as const,
    consumer: 'third-party-app' as const,
    appId: STORYBOOK_APP_ID,
  }), []);
  const presentedCapabilities = useMemo(
    () => config === undefined
      ? undefined
      : config === null
        ? null
        : config.capabilities.map(presentCapability),
    [config],
  );

  return (
    <section id="storybook-ai-model-config" className="sb-ai-model-config" tabIndex={-1}>
      <ModelConfigAIConfigSurface
        context={context}
        capabilityContracts={[STORYBOOK_TEXT_GENERATE_CAPABILITY_ID]}
        capabilities={presentedCapabilities}
        loading={loading}
        disabled={!bootstrapReady || !authenticated}
        loadError={loadError}
        onRetry={() => void refresh()}
        onOverwrite={overwrite}
        formatError={formatModelConfigError}
        copy={STORYBOOK_MODEL_CONFIG_COPY}
        className="sb-ai-model-config__hub"
        headerSlot={(
          <p className="sb-ai-model-config__posture">
            {authenticated
              ? '配置由 Runtime 保存；Storybook 不持有 provider、model 或凭据。'
              : '连接到 Desktop 管理的 Nimi 会话后即可读取配置。'}
          </p>
        )}
      />
    </section>
  );
}

function formatModelConfigError(error: unknown): ModelConfigFormattedError {
  return {
    message: 'AI 配置操作未完成。请确认 Nimi 会话可用后重试。',
    technicalDetail: error instanceof Error ? error.message : String(error || 'Unknown AIConfig error.'),
  };
}

function requirePortableCapabilities(
  capabilities: readonly NimiCapabilityAIConfigIntent[],
): readonly NimiPortableAppAIConfigIntent[] {
  return capabilities.map((intent) => {
    if (intent.route.oneofKind === 'local') {
      return {
        capabilityContract: intent.capabilityContract,
        requiredFeatures: [...intent.requiredFeatures],
        ...(intent.defaults ? { defaults: intent.defaults } : {}),
        route: { oneofKind: 'local' as const, local: {} },
      };
    }
    if (intent.route.oneofKind === 'cloud') {
      const grantId = intent.route.cloud.connectorGrantId?.trim();
      if (grantId) {
        throw new Error('Third-party App AIConfig must not carry ConnectorGrant custody.');
      }
      return {
        capabilityContract: intent.capabilityContract,
        requiredFeatures: [...intent.requiredFeatures],
        ...(intent.defaults ? { defaults: intent.defaults } : {}),
        route: {
          oneofKind: 'cloud' as const,
          cloud: {
            implementation: intent.route.cloud.implementation,
            providerModelTarget: intent.route.cloud.providerModelTarget,
          },
        },
      };
    }
    throw new Error('AIConfig capability route must be Local or Cloud.');
  });
}

function presentCapability(
  intent: NimiPortableAppAIConfigIntent,
): NimiCapabilityAIConfigIntent {
  if (intent.route.oneofKind === 'local') {
    return {
      capabilityContract: intent.capabilityContract,
      requiredFeatures: [...intent.requiredFeatures],
      ...(intent.defaults ? { defaults: intent.defaults } : {}),
      route: { oneofKind: 'local', local: {} },
    };
  }
  return {
    capabilityContract: intent.capabilityContract,
    requiredFeatures: [...intent.requiredFeatures],
    ...(intent.defaults ? { defaults: intent.defaults } : {}),
    route: {
      oneofKind: 'cloud',
      cloud: {
        implementation: intent.route.cloud.implementation,
        providerModelTarget: intent.route.cloud.providerModelTarget,
        connectorGrantId: '',
      },
    },
  };
}
