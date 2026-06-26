// App-owned dispatcher onto the admitted Runtime/SDK AI execution surface. Text
// generation routes through an NimiAIConfig binding (source local/cloud + model id) —
// there is NO hardcoded provider/model and NO app-local provider routing. Image
// generation uses the runtime media surface with model "auto", i.e. the runtime
// chooses the route; Storybook never names a provider. Every failure is surfaced
// as a typed unavailable using the verbatim Runtime error.

// Import the enum from the typed subpath, not the root barrel, so the app's AI
// code does not pull the SDK client (and its Node/gRPC transport graph) into the
// module graph. Client construction itself stays scaffold-managed (runtime-platform.ts).
import { ReasonCode } from '@nimiplatform/sdk/types';
import {
  createNimiAIConfigEvidence,
  createNimiAIRuntimeEvidence,
  createNimiRuntimeAIModel,
  createNimiRuntimeAISchedulingClient,
  projectNimiAIRuntimeEvidenceMetadata,
  type NimiAIConfig,
  type NimiAIConfigTargetRef,
  type NimiAISchedulingTargetInput,
} from '@nimiplatform/sdk/ai';
import { createNimiImageGenerationScenario } from '@nimiplatform/sdk/features/generation';
import { STORYBOOK_RUNTIME_APP_ID } from '../../contracts/app-identity.ts';
import type { StorybookRuntimePlatformClient } from '../../shell/auth/runtime-platform.js';
import { requireStorybookRuntimeSubjectUserId } from '../../shell/infra/storybook-runtime-session.ts';
import { STORYBOOK_TEXT_GENERATE_CAPABILITY_ID } from '../../shell/ai/storybook-ai-requirements.ts';
import { loadStorybookAIConfig } from './storybook-ai-config-store.js';
import { storybookAIUnavailable, type StorybookAIUnavailable, type StorybookAIUnavailableReason } from './storybook-unavailable.js';

const STORYBOOK_APP_ID = STORYBOOK_RUNTIME_APP_ID;
const TEXT_BINDING_CAPABILITY = STORYBOOK_TEXT_GENERATE_CAPABILITY_ID;

export type StorybookTextResult =
  | { ok: true; capability: 'text.generate'; text: string; finishReason: string; model: string; route: 'local' | 'cloud'; configHash: string; traceId?: string }
  | StorybookAIUnavailable;

export type StorybookImageResult =
  | { ok: true; capability: 'image.generate'; jobId: string; jobState: string; artifactCount: number; firstArtifactRef?: string; firstArtifactMime?: string }
  | StorybookAIUnavailable;

type ResolvedTextBinding = {
  model: string;
  route: 'local' | 'cloud';
  connectorId?: string;
  readonly targetRef: NimiAIConfigTargetRef;
  params: RuntimeTextParams;
  configHash: string;
  metadata: Record<string, string>;
  schedulingTarget: NimiAISchedulingTargetInput | null;
};

type RuntimeTextParams = {
  readonly temperature?: number;
  readonly topP?: number;
  readonly maxTokens?: number;
  readonly timeoutMs?: number;
};

function describeSdkError(error: unknown): string {
  if (!error) return 'Runtime SDK call failed with no error message.';
  if (error instanceof Error) {
    const reasonCode = (error as { reasonCode?: string }).reasonCode;
    const message = error.message || error.name || 'Runtime SDK call failed.';
    return reasonCode ? `${reasonCode}: ${message}` : message;
  }
  return String(error);
}

function reasonFromSdkError(error: unknown): StorybookAIUnavailableReason {
  const reasonCode = error && typeof error === 'object' && 'reasonCode' in error ? String((error as { reasonCode?: unknown }).reasonCode || '') : '';
  switch (reasonCode) {
    case ReasonCode.AUTH_CONTEXT_MISSING:
      return 'auth-context-missing';
    case ReasonCode.PRINCIPAL_UNAUTHORIZED:
    case ReasonCode.SESSION_EXPIRED:
    case ReasonCode.APP_TOKEN_EXPIRED:
    case ReasonCode.APP_TOKEN_REVOKED:
      return 'principal-unauthorized';
    case ReasonCode.SDK_RUNTIME_METHOD_UNAVAILABLE:
      return 'sdk-method-unavailable';
    default:
      return 'runtime-call-failed';
  }
}

function buildMetadata(surfaceId: string, extra?: Record<string, string>): Record<string, string> {
  return { callerKind: 'third-party-app', callerId: STORYBOOK_APP_ID, surfaceId, ...(extra || {}) };
}

function targetRefModel(targetRef: NimiAIConfigTargetRef): string {
  if (targetRef.kind === 'cloud-connector') {
    return String(targetRef.providerModelId || '').trim();
  }
  if (targetRef.kind === 'local-runtime') {
    return String(targetRef.profileBindingId || targetRef.readinessRef || '').trim();
  }
  return '';
}

function schedulingTargetFor(
  capability: string,
  targetRef: NimiAIConfigTargetRef,
): NimiAISchedulingTargetInput | null {
  if (targetRef.kind === 'profile-slice') return null;
  return { capability, targetRef };
}

function paramsRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : undefined;
}

function numberParam(params: Readonly<Record<string, unknown>> | undefined, key: string): number | undefined {
  const value = params?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function extractTextParams(params: Readonly<Record<string, unknown>> | undefined): RuntimeTextParams {
  return {
    ...(numberParam(params, 'temperature') !== undefined
      ? { temperature: numberParam(params, 'temperature') }
      : {}),
    ...(numberParam(params, 'topP') !== undefined ? { topP: numberParam(params, 'topP') } : {}),
    ...(numberParam(params, 'maxTokens') !== undefined
      ? { maxTokens: numberParam(params, 'maxTokens') }
      : {}),
    ...(numberParam(params, 'timeoutMs') !== undefined
      ? { timeoutMs: numberParam(params, 'timeoutMs') }
      : {}),
  };
}

/** Resolve the user-selected text route binding from NimiAIConfig. Fails closed. */
export function resolveStorybookTextBinding(config: NimiAIConfig = loadStorybookAIConfig()): ResolvedTextBinding | StorybookAIUnavailable {
  const targetRef = config.capabilities.targetRefs[TEXT_BINDING_CAPABILITY] || null;
  if (!targetRef) {
    return storybookAIUnavailable('text.generate', 'ai-binding-missing', `No NimiAIConfig targetRef selected for ${TEXT_BINDING_CAPABILITY}. Storybook fails closed before dispatch — it does not pick a provider for you.`);
  }
  if (targetRef.kind === 'profile-slice') {
    return storybookAIUnavailable('text.generate', 'ai-binding-missing', `AIConfig targetRef for ${TEXT_BINDING_CAPABILITY} still points to profile-slice ${targetRef.sliceId}; apply/materialize a live Runtime target before dispatch.`);
  }
  const model = targetRefModel(targetRef);
  if (!model) {
    return storybookAIUnavailable('text.generate', 'ai-binding-missing', `NimiAIConfig targetRef for ${TEXT_BINDING_CAPABILITY} has no Runtime model id.`);
  }
  const connectorId = targetRef.kind === 'cloud-connector' ? String(targetRef.connectorId || '').trim() : '';
  if (targetRef.kind === 'cloud-connector' && !connectorId) {
    return storybookAIUnavailable('text.generate', 'ai-binding-missing', 'Cloud Runtime bindings require a connectorId.');
  }
  const route: 'local' | 'cloud' = targetRef.kind === 'cloud-connector' ? 'cloud' : 'local';
  const evidence = createNimiAIConfigEvidence(config);
  return {
    model,
    route,
    ...(connectorId ? { connectorId } : {}),
    targetRef,
    params: extractTextParams(paramsRecord(config.capabilities.selectedParams[TEXT_BINDING_CAPABILITY])),
    configHash: evidence.configHash,
    schedulingTarget: schedulingTargetFor(TEXT_BINDING_CAPABILITY, targetRef),
    metadata: {
      aiConfigScopeKind: config.scopeRef.kind,
      aiConfigScopeOwnerId: config.scopeRef.ownerId,
      aiConfigScopeSurfaceId: config.scopeRef.surfaceId || '',
      aiConfigProfileId: config.profileOrigin?.profileId || '',
      aiConfigProfileTitle: config.profileOrigin?.title || '',
      aiConfigCapabilityId: TEXT_BINDING_CAPABILITY,
      aiConfigTargetRefKind: targetRef.kind,
      aiConfigBindingSource: route,
      aiConfigBindingConnectorId: connectorId,
      aiConfigBindingModel: model,
      aiConfigHash: evidence.configHash,
      aiConfigBindingKeys: evidence.capabilityBindingKeys.join(','),
    },
  };
}

function pickTraceId(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  return typeof record.traceId === 'string' ? record.traceId : undefined;
}

async function schedulingMetadata(
  client: StorybookRuntimePlatformClient,
  config: NimiAIConfig,
  target: NimiAISchedulingTargetInput | null,
): Promise<Record<string, string> | { readonly failure: string }> {
  if (!target) return {};
  try {
    const scheduling = createNimiRuntimeAISchedulingClient({
      appId: STORYBOOK_RUNTIME_APP_ID,
      runtime: client.runtime,
      targets: [target],
    });
    const batch = await scheduling.peek({ config });
    const judgement = batch.aggregateJudgement ?? null;
    if (judgement?.state === 'denied') {
      return {
        failure: `Runtime scheduling denied text.generate: ${judgement.detail || 'denied'}`,
      };
    }
    return projectNimiAIRuntimeEvidenceMetadata(createNimiAIRuntimeEvidence({
      schedulingJudgement: judgement,
    }));
  } catch (error) {
    return {
      failure: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Single-shot text generation via the NimiAIConfig-resolved route. */
export async function invokeStorybookText(
  client: StorybookRuntimePlatformClient,
  input: { prompt: string; directive?: string; surfaceId: string },
  config: NimiAIConfig = loadStorybookAIConfig(),
): Promise<StorybookTextResult> {
  const prompt = input.prompt.trim();
  if (!prompt) {
    return storybookAIUnavailable('text.generate', 'input-invalid', 'Text generation prompt is empty.');
  }
  const resolved = resolveStorybookTextBinding(config);
  if ('ok' in resolved && resolved.ok === false) return resolved;
  const bound = resolved as ResolvedTextBinding;
  const directedPrompt = input.directive ? `${input.directive}\n\n${prompt}` : prompt;
  try {
    const scheduling = await schedulingMetadata(client, config, bound.schedulingTarget);
    if ('failure' in scheduling) {
      return storybookAIUnavailable('text.generate', 'runtime-call-failed', scheduling.failure);
    }
    const subjectUserId = await requireStorybookRuntimeSubjectUserId();
    const model = createNimiRuntimeAIModel({
      runtime: client.runtime,
      appId: STORYBOOK_RUNTIME_APP_ID,
      routePolicy: bound.route,
      connectorId: bound.connectorId,
      subjectUserId,
      timeoutMs: bound.params.timeoutMs,
      model: {
        modelId: bound.model,
        ...(bound.connectorId ? { providerId: bound.connectorId } : {}),
      },
      targetRef: bound.targetRef,
    });
    const output = await model.generateText({
      model: model.model,
      messages: [{
        role: 'user',
        content: [{ type: 'text', text: directedPrompt }],
      }],
    });
    return {
      ok: true,
      capability: 'text.generate',
      text: output.text,
      finishReason: output.finishReason,
      model: bound.model,
      route: bound.route,
      configHash: bound.configHash,
      traceId: pickTraceId(output.raw),
    };
  } catch (error) {
    return storybookAIUnavailable('text.generate', reasonFromSdkError(error), describeSdkError(error));
  }
}

function summariseArtifact(artifact: unknown): { ref?: string; mime?: string } {
  if (!artifact || typeof artifact !== 'object') return {};
  const record = artifact as Record<string, unknown>;
  const inline = record.inline as Record<string, unknown> | undefined;
  return {
    ref: typeof record.uri === 'string' ? record.uri : typeof record.artifactId === 'string' ? record.artifactId : undefined,
    mime: typeof record.mimeType === 'string' ? record.mimeType : typeof inline?.mimeType === 'string' ? (inline.mimeType as string) : undefined,
  };
}

/**
 * Image generation through the runtime media surface. model "auto" defers route
 * selection to the runtime — Storybook never names a provider/model. Returns a
 * typed unavailable on any runtime contract failure.
 */
export async function invokeStorybookImage(
  client: StorybookRuntimePlatformClient,
  input: { prompt: string; surfaceId: string },
): Promise<StorybookImageResult> {
  const prompt = input.prompt.trim();
  if (!prompt) {
    return storybookAIUnavailable('image.generate', 'input-invalid', 'Image prompt is empty.');
  }
  try {
    const generation = client.features.generation.createRuntimeClient({
      head: {
        modelId: 'auto',
        routePolicy: 'unspecified',
      },
    });
    const job = await generation.submit({
      scenario: createNimiImageGenerationScenario({
        kind: 'image',
        prompt,
      }),
      requestId: `${STORYBOOK_APP_ID}:image:${Date.now().toString(36)}`,
      idempotencyKey: `${STORYBOOK_APP_ID}:image:${input.surfaceId}:${prompt}`,
      labels: buildMetadata(input.surfaceId),
    });
    const first = summariseArtifact(job.artifacts[0]);
    return {
      ok: true,
      capability: 'image.generate',
      jobId: job.id,
      jobState: job.status,
      artifactCount: job.artifacts.length,
      firstArtifactRef: first.ref,
      firstArtifactMime: first.mime,
    };
  } catch (error) {
    return storybookAIUnavailable('image.generate', reasonFromSdkError(error), describeSdkError(error));
  }
}
