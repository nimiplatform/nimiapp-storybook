import type {
  NimiAICapabilityRequirementDeclaration,
  NimiAIScopeRef,
} from '@nimiplatform/sdk/ai';

export const STORYBOOK_TEXT_GENERATE_CAPABILITY_ID = 'text.generate';

export function createStorybookModelRequirementDeclaration(
  scopeRef: NimiAIScopeRef,
): NimiAICapabilityRequirementDeclaration {
  return {
    requirementId: 'storybook.generation.text-generate',
    scopeRef,
    requiredSlices: [{
      requirementSliceId: 'storybook.generation.text-generate.required',
      capability: STORYBOOK_TEXT_GENERATE_CAPABILITY_ID,
      profileSliceRef: 'storybook.generation.text-generate',
      readinessPolicy: 'required',
    }],
    setupProjectionPolicy: 'sdk-ai-config-setup-projection',
  };
}
