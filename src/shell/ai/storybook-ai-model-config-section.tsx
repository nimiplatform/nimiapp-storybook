import { useCallback, useEffect, useMemo, useState } from 'react';
import type { NimiAIConfigSnapshot } from '@nimiplatform/sdk/ai';
import {
  ModelConfigAIConfigSurface,
  type ModelConfigFormattedError,
  type ModelConfigOverwrite,
} from '@nimiplatform/kit/features/model-config';
import { STORYBOOK_APP_ID } from '../../contracts/app-identity.ts';
import { requireStorybookAIConfigOwner } from '../../storybook/ai/storybook-ai-config-store.ts';
import { getStorybookNimiClient } from '../infra/storybook-nimi-client.ts';
import { useAppStore } from '../app-shell/app-store.js';
import { STORYBOOK_MODEL_CONFIG_COPY } from './model-config-copy.ts';
import { STORYBOOK_TEXT_GENERATE_CAPABILITY_ID } from './storybook-ai-requirements.ts';

export function StorybookAiModelConfigSection() {
  const bootstrapReady = useAppStore((state) => state.bootstrapReady);
  const authenticated = useAppStore((state) => state.auth.status === 'authenticated');
  const [snapshot, setSnapshot] = useState<NimiAIConfigSnapshot | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!bootstrapReady || !authenticated) {
      setSnapshot(undefined);
      setLoadError(null);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const next = await getStorybookNimiClient().aiConfig.get();
      if (next.config) requireStorybookAIConfigOwner(next.config);
      setSnapshot(next);
    } catch (error) {
      setSnapshot(undefined);
      setLoadError(error instanceof Error ? error.message : String(error || 'AIConfig read failed.'));
    } finally {
      setLoading(false);
    }
  }, [authenticated, bootstrapReady]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const overwrite = useCallback<ModelConfigOverwrite>(async (input) => {
    const result = await getStorybookNimiClient().aiConfig.overwrite(input);
    if (result.config) requireStorybookAIConfigOwner(result.config);
    setSnapshot({ config: result.config, revision: result.revision, effectiveSelections: [] });
    void refresh();
    return result;
  }, [refresh]);

  const context = useMemo(() => ({
    owner: 'app-ai-config' as const,
    consumer: 'third-party-app' as const,
    appId: STORYBOOK_APP_ID,
  }), []);

  return (
    <section id="storybook-ai-model-config" className="sb-ai-model-config" tabIndex={-1}>
      <ModelConfigAIConfigSurface
        context={context}
        capabilityContracts={[STORYBOOK_TEXT_GENERATE_CAPABILITY_ID]}
        capabilities={snapshot ? snapshot.config?.capabilities ?? null : undefined}
        revision={snapshot?.revision}
        effectiveSelections={snapshot?.effectiveSelections}
        listOptions={(query) => getStorybookNimiClient().aiConfig.listOptions(query)}
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
