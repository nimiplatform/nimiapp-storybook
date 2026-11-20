import { useCallback, useEffect, useMemo, useState } from 'react';
import type { NimiAIConfigSnapshot } from '@nimiplatform/sdk/ai';
import {
  ModelConfigAIConfigSurface,
  type ModelConfigFormattedError,
  type ModelConfigOverwrite,
} from '@nimiplatform/kit/features/model-config';
import { STORYBOOK_APP_ID } from '../../contracts/app-identity.ts';
import { requireStorybookAIConfigOwner } from '../../storybook/ai/storybook-ai-config-store.ts';
import { useNimiAppSession, type NimiAppScope } from '@nimiplatform/kit/auth/app';
import { STORYBOOK_MODEL_CONFIG_COPY } from './model-config-copy.ts';
import { STORYBOOK_TEXT_GENERATE_CAPABILITY_ID } from './storybook-ai-requirements.ts';

export function StorybookAiModelConfigSection() {
  const { snapshot } = useNimiAppSession();
  const scope = snapshot.runtime.status === 'connected' ? snapshot.runtime.scope : undefined;
  return <Config key={scope?.viewKey ?? 'disconnected'} scope={scope} />;
}
function Config({ scope }: { scope?: NimiAppScope }) {
  const [snapshot, setSnapshot] = useState<NimiAIConfigSnapshot | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!scope) {
      setSnapshot(undefined);
      setLoadError(null);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const next = await scope.client.aiConfig.get();
      if (scope.signal.aborted) return;
      if (next.config) requireStorybookAIConfigOwner(next.config);
      setSnapshot(next);
    } catch (error) {
      if (scope.signal.aborted) return;
      setSnapshot(undefined);
      setLoadError(error instanceof Error ? error.message : String(error || 'AIConfig read failed.'));
    } finally {
      if (!scope.signal.aborted) setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const overwrite = useCallback<ModelConfigOverwrite>(async (input) => {
    if (!scope) throw new Error('请先连接 Nimi。');
    scope.signal.throwIfAborted();
    const result = await scope.client.aiConfig.overwrite(input);
    scope.signal.throwIfAborted();
    if (result.config) requireStorybookAIConfigOwner(result.config);
    setSnapshot({ config: result.config, revision: result.revision, effectiveSelections: [] });
    void refresh();
    return result;
  }, [refresh, scope]);

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
        listOptions={(query) => scope ? scope.client.aiConfig.listOptions(query) : Promise.reject(new Error('请先连接 Nimi。'))}
        loading={loading}
        disabled={!scope}
        loadError={loadError}
        onRetry={() => void refresh()}
        onOverwrite={overwrite}
        formatError={formatModelConfigError}
        copy={STORYBOOK_MODEL_CONFIG_COPY}
        language="zh-CN"
        className="sb-ai-model-config__hub"
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
