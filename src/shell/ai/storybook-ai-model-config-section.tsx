import { useEffect, useMemo, useState } from 'react';
import {
  ModelConfigAiModelHub,
  defaultModelConfigProfileCopy,
  useModelConfigProfileController,
  type AppModelConfigSurface,
  type ModelConfigProjectionStatus,
  type SharedAIConfigService,
} from '@nimiplatform/kit/features/model-config';
import type {
  NimiAIConfig,
  NimiAIConfigTargetRef,
  NimiAIScopeRef,
} from '@nimiplatform/sdk/ai';
import { useAppStore } from '../app-shell/app-store.js';
import {
  createStorybookAIConfigService,
  createStorybookAIScopeRef,
} from '../../storybook/ai/storybook-ai-config-store.ts';
import { createStorybookRuntimeModelPickerProviderCache } from './storybook-runtime-model-provider.ts';
import {
  STORYBOOK_TEXT_GENERATE_CAPABILITY_ID,
  createStorybookModelRequirementDeclaration,
} from './storybook-ai-requirements.ts';
import { translateStorybookModelConfig } from './model-config-copy.ts';

function bindingStatus(
  config: NimiAIConfig,
  runtimeReady: boolean,
  runtimeDetail: string | null,
): ModelConfigProjectionStatus {
  if (!runtimeReady) {
    return {
      supported: false,
      tone: 'attention',
      badgeLabel: 'Runtime 未就绪',
      title: 'Runtime 不可用',
      detail: runtimeDetail || 'Storybook bootstrap 尚未完成。',
    };
  }
  const targetRef = config.capabilities.targetRefs[STORYBOOK_TEXT_GENERATE_CAPABILITY_ID] || null;
  if (!targetRef) {
    return {
      supported: false,
      tone: 'attention',
      badgeLabel: '需要绑定',
      title: '缺少 text.generate 目标',
      detail: 'Storybook 不会自动选择 provider/model；请通过 AI Config 绑定 Runtime route。',
    };
  }
  return {
    supported: true,
    tone: 'ready',
    badgeLabel: '已配置',
    title: '模型已配置',
    detail: targetRefLabel(targetRef),
  };
}

function targetRefLabel(targetRef: NimiAIConfigTargetRef): string {
  if (targetRef.kind === 'cloud-connector') {
    return targetRef.providerModelId || targetRef.connectorId;
  }
  if (targetRef.kind === 'local-runtime') {
    return targetRef.profileBindingId || targetRef.readinessRef || 'local-runtime';
  }
  return targetRef.sliceId;
}

function useLiveAIConfig(service: SharedAIConfigService, scopeRef: NimiAIScopeRef): NimiAIConfig {
  const [config, setConfig] = useState<NimiAIConfig>(() => service.aiConfig.get(scopeRef));
  useEffect(() => {
    setConfig(service.aiConfig.get(scopeRef));
    return service.aiConfig.subscribe(scopeRef, setConfig);
  }, [service, scopeRef]);
  return config;
}

export function StorybookAiModelConfigSection() {
  const bootstrapReady = useAppStore((state) => state.bootstrapReady);
  const bootstrapError = useAppStore((state) => state.bootstrapError);
  const service = useMemo(() => createStorybookAIConfigService(), []);
  const scopeRef = useMemo(() => createStorybookAIScopeRef(), []);
  const config = useLiveAIConfig(service, scopeRef);
  const providerCache = useMemo(() => createStorybookRuntimeModelPickerProviderCache(), []);
  const requirementDeclaration = useMemo(
    () => createStorybookModelRequirementDeclaration(scopeRef),
    [scopeRef],
  );

  const surface = useMemo<AppModelConfigSurface>(() => ({
    scopeRef,
    aiConfigService: service,
    requirementDeclaration,
    enabledCapabilities: [STORYBOOK_TEXT_GENERATE_CAPABILITY_ID],
    providerResolver: (capabilityId: string) => (bootstrapReady ? providerCache(capabilityId) : null),
    projectionResolver: () => bindingStatus(config, bootstrapReady, bootstrapError),
    runtimeReady: bootstrapReady,
    runtimeNotReadyLabel: bootstrapError || 'Runtime 未就绪',
    i18n: { t: translateStorybookModelConfig },
  }), [bootstrapError, bootstrapReady, config, providerCache, requirementDeclaration, scopeRef, service]);

  const profileCopy = useMemo(
    () => defaultModelConfigProfileCopy(translateStorybookModelConfig),
    [],
  );
  const currentOrigin = useMemo(
    () => (config.profileOrigin
      ? { profileId: config.profileOrigin.profileId, title: config.profileOrigin.title }
      : null),
    [config.profileOrigin],
  );
  const profile = useModelConfigProfileController({
    scopeRef,
    aiConfigService: service,
    requirementDeclaration,
    copy: profileCopy,
    currentOrigin,
  });

  return (
    <section
      id="storybook-ai-model-config"
      className="sb-ai-model-config"
      tabIndex={-1}
    >
      <div className="sb-ai-model-config__head">
        <div>
          <h2>AI 模型</h2>
          <p>Runtime route binding for Storybook generation.</p>
        </div>
      </div>
      <ModelConfigAiModelHub
        surface={surface}
        profile={profile}
        className="sb-ai-model-config__hub"
      />
    </section>
  );
}
