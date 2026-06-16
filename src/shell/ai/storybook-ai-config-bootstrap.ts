import {
  ensureNimiAppFirstLaunchAIConfig,
  type NimiAIConfig,
  type NimiAIProfile,
  type NimiAIScopeRef,
  type NimiResolvedRecommendedAIProfile,
} from '@nimiplatform/sdk/ai';
import {
  createStorybookAIScopeRef,
  loadStorybookAIConfig,
  saveStorybookAIConfig,
} from '../../storybook/ai/storybook-ai-config-store.ts';
import {
  STORYBOOK_TEXT_GENERATE_CAPABILITY_ID,
  createStorybookModelRequirementDeclaration,
} from './storybook-ai-requirements.ts';

export type StorybookFirstLaunchAIConfigInitOutcome =
  | {
      outcome: 'already-bound';
      config: NimiAIConfig;
    }
  | {
      outcome: 'initialized';
      config: NimiAIConfig;
      profileId: string;
      profileSource: 'recommended-profile' | 'account-default-profile';
    }
  | {
      outcome: 'setup-required';
      reason:
        | 'profile_unresolved'
        | 'setup_required_no_live_config'
        | 'first_launch_config_apply_failed';
      detail: string;
    };

export type StorybookFirstLaunchAIConfigInitOptions = {
  readonly scopeRef?: NimiAIScopeRef;
  readonly loadConfig?: (scopeRef: NimiAIScopeRef) => NimiAIConfig;
  readonly saveConfig?: (next: NimiAIConfig, scopeRef: NimiAIScopeRef) => NimiAIConfig;
  readonly resolveRecommendedProfile?: (
    scopeRef: NimiAIScopeRef,
  ) => NimiResolvedRecommendedAIProfile | null | Promise<NimiResolvedRecommendedAIProfile | null>;
  readonly resolveAccountDefaultProfile?: () => NimiAIProfile | null | Promise<NimiAIProfile | null>;
  readonly now?: () => string;
};

function detailFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readTextGenerateTargetRef(config: NimiAIConfig) {
  return config.capabilities.targetRefs[STORYBOOK_TEXT_GENERATE_CAPABILITY_ID] || null;
}

function ensureAIConfigShape(config: NimiAIConfig, scopeRef: NimiAIScopeRef): NimiAIConfig {
  return {
    ...config,
    scopeRef,
    capabilities: {
      targetRefs: { ...(config.capabilities.targetRefs || {}) },
      selectedParams: { ...(config.capabilities.selectedParams || {}) },
    },
    profileOrigin: config.profileOrigin ?? null,
  };
}

export async function ensureStorybookAIConfigFromFirstLaunchProfile(
  options: StorybookFirstLaunchAIConfigInitOptions = {},
): Promise<StorybookFirstLaunchAIConfigInitOutcome> {
  const scopeRef = options.scopeRef ?? createStorybookAIScopeRef();
  const loadConfig = options.loadConfig ?? loadStorybookAIConfig;
  const saveConfig = options.saveConfig ?? ((next, targetScopeRef) =>
    saveStorybookAIConfig(next, targetScopeRef));
  const config = ensureAIConfigShape(loadConfig(scopeRef), scopeRef);

  if (readTextGenerateTargetRef(config)) {
    return { outcome: 'already-bound', config };
  }

  try {
    const result = await ensureNimiAppFirstLaunchAIConfig({
      scopeRef,
      getExistingAppAIConfig: () => null,
      resolveRecommendedProfile: options.resolveRecommendedProfile ?? (() => null),
      resolveAccountDefaultProfile: options.resolveAccountDefaultProfile ?? (() => null),
      resolveRequirementDeclarations: ({ scopeRef: requirementScopeRef }) => [
        createStorybookModelRequirementDeclaration(requirementScopeRef),
      ],
      applyHostAIConfig: (targetScopeRef, next) => saveConfig(next, targetScopeRef),
      now: options.now,
    });
    if (result.outcome === 'initialized') {
      return {
        outcome: 'initialized',
        config: result.config,
        profileId: result.profileId,
        profileSource: result.profileSource,
      };
    }
    if (result.outcome === 'already-initialized') {
      return { outcome: 'already-bound', config: result.config };
    }
    return {
      outcome: 'setup-required',
      reason: 'setup_required_no_live_config',
      detail: result.setupRepairPlan.unmetRequirements
        .map((item) => `${item.requirementId}: ${item.detail}`)
        .join('; ') || `Profile ${result.profileId} cannot materialize text.generate.`,
    };
  } catch (error) {
    return {
      outcome: 'setup-required',
      reason: detailFromError(error).includes('SDK_AI_CONFIG_INIT_APPLY_FAILED')
        ? 'first_launch_config_apply_failed'
        : 'profile_unresolved',
      detail: detailFromError(error),
    };
  }
}
