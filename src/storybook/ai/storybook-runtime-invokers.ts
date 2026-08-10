import type {
  NimiPortableAppAIConfig,
  NimiPortableAppAIConfigIntent,
} from '@nimiplatform/sdk/ai';
import { runtimeAIConfigStructToJson } from '@nimiplatform/sdk/ai';
import type { NimiLocalAppTextCandidateInput } from '@nimiplatform/sdk/app';
import type { StorybookRuntimePlatformClient } from '../../shell/auth/runtime-platform.js';
import { STORYBOOK_TEXT_GENERATE_CAPABILITY_ID } from '../../shell/ai/storybook-ai-requirements.ts';
import {
  loadStorybookAIConfig,
  versionStorybookAIConfig,
} from './storybook-ai-config-store.ts';
import {
  storybookAIUnavailable,
  type StorybookAIUnavailable,
  type StorybookAIUnavailableReason,
} from './storybook-unavailable.ts';

const MAX_MESSAGES = 8;
const MAX_MESSAGE_BYTES = 32 * 1024;
const MAX_PROMPT_BYTES = 64 * 1024;
const MAX_TOKENS = 4096;

const REGISTERED_TEXT_SURFACES = new Set([
  'nimi.storybook.studio.bible',
  'nimi.storybook.play.scene',
  'nimi.storybook.play.choices',
]);

export type StorybookTextResult =
  | {
      ok: true;
      capability: 'text.generate';
      text: string;
      finishReason: string;
      route: 'local' | 'cloud';
      configHash: string;
      traceId: string;
    }
  | StorybookAIUnavailable;

export type StorybookImageResult = StorybookAIUnavailable;

type ResolvedTextIntent = {
  readonly intent: NimiPortableAppAIConfigIntent;
  readonly route: 'local' | 'cloud';
  readonly configHash: string;
  readonly temperature: number;
  readonly topP: number;
  readonly maxTokens: number;
};

export function resolveStorybookTextIntent(
  config: NimiPortableAppAIConfig | null,
): ResolvedTextIntent | StorybookAIUnavailable {
  const intent = config?.capabilities.find(
    (entry) => entry.capabilityContract === STORYBOOK_TEXT_GENERATE_CAPABILITY_ID,
  );
  if (!intent) {
    return storybookAIUnavailable(
      'text.generate',
      'ai-binding-missing',
      'Storybook text generation has not been configured yet.',
    );
  }
  const defaults = runtimeAIConfigStructToJson(intent.defaults);
  const temperature = boundedNumber(defaults.temperature, 0, 2, 0.7);
  const topP = boundedNumber(defaults.topP, 0, 1, 1);
  const maxTokens = boundedInteger(defaults.maxTokens, 1, MAX_TOKENS, 1024);
  return {
    intent,
    route: intent.route.oneofKind,
    configHash: versionStorybookAIConfig(config),
    temperature,
    topP,
    maxTokens,
  };
}

export function buildStorybookTextCandidateInput(input: {
  readonly prompt: string;
  readonly directive?: string;
  readonly temperature: number;
  readonly topP: number;
  readonly maxTokens: number;
}): NimiLocalAppTextCandidateInput {
  const prompt = exactText(input.prompt, 'Text generation prompt');
  const directive = input.directive === undefined
    ? ''
    : exactText(input.directive, 'Text generation directive');
  const messages = [
    ...(directive ? [{ role: 'system' as const, text: directive }] : []),
    { role: 'user' as const, text: prompt },
  ];
  if (messages.length > MAX_MESSAGES) throw inputError('Text candidate message count exceeds the App Access bound.');
  let totalBytes = 0;
  for (const message of messages) {
    const bytes = utf8Bytes(message.text);
    if (bytes > MAX_MESSAGE_BYTES) {
      throw inputError('Text candidate message exceeds the 32 KiB App Access bound.');
    }
    totalBytes += utf8Bytes(message.role) + bytes;
  }
  if (totalBytes > MAX_PROMPT_BYTES) {
    throw inputError('Text candidate prompt exceeds the 64 KiB App Access bound.');
  }
  return {
    messages,
    temperature: boundedNumber(input.temperature, 0, 2, 0.7),
    topP: boundedNumber(input.topP, 0, 1, 1),
    maxTokens: boundedInteger(input.maxTokens, 1, MAX_TOKENS, 1024),
  };
}

export async function invokeStorybookText(
  client: StorybookRuntimePlatformClient,
  input: { prompt: string; directive?: string; surfaceId: string },
  config?: NimiPortableAppAIConfig | null,
): Promise<StorybookTextResult> {
  if (!REGISTERED_TEXT_SURFACES.has(input.surfaceId)) {
    return storybookAIUnavailable(
      'text.generate',
      'input-invalid',
      'This Storybook generation surface is not registered.',
    );
  }
  try {
    const resolved = resolveStorybookTextIntent(
      config === undefined ? await loadStorybookAIConfig(client.aiConfig) : config,
    );
    if ('ok' in resolved) return resolved;
    const request = buildStorybookTextCandidateInput({
      prompt: input.prompt,
      directive: input.directive,
      temperature: resolved.temperature,
      topP: resolved.topP,
      maxTokens: resolved.maxTokens,
    });
    const output = await client.ai.text.generateCandidate(request);
    return {
      ok: true,
      capability: 'text.generate',
      text: output.text,
      finishReason: output.finishReason,
      route: resolved.route,
      configHash: resolved.configHash,
      traceId: output.traceId,
    };
  } catch (error) {
    const reason = reasonFromSdkError(error);
    return storybookAIUnavailable(
      'text.generate',
      reason,
      userMessageForRuntimeFailure(reason),
      error instanceof Error ? error.message : String(error || 'Runtime text generation failed.'),
    );
  }
}

export async function invokeStorybookImage(
  input: { prompt: string; surfaceId: string },
): Promise<StorybookImageResult> {
  if (!input.prompt.trim()) {
    return storybookAIUnavailable('image.generate', 'input-invalid', 'Image prompt is empty.');
  }
  return storybookAIUnavailable(
    'image.generate',
    'capability-unavailable',
    'Image generation is not available through the current App Access contract.',
  );
}

function reasonFromSdkError(error: unknown): StorybookAIUnavailableReason {
  const reason = error && typeof error === 'object'
    ? String((error as { reasonCode?: unknown }).reasonCode || '')
    : '';
  if (reason === 'STORYBOOK_TEXT_INPUT_INVALID') return 'input-invalid';
  if (reason.includes('AUTH_CONTEXT_MISSING')) return 'auth-context-missing';
  if (/(?:UNAUTHORIZED|SESSION_EXPIRED|TOKEN_EXPIRED|TOKEN_REVOKED)/u.test(reason)) {
    return 'principal-unauthorized';
  }
  if (reason.includes('METHOD_UNAVAILABLE')) return 'sdk-method-unavailable';
  if (reason.includes('AI_CONFIG_NOT_FOUND')) return 'ai-binding-missing';
  return 'runtime-call-failed';
}

function userMessageForRuntimeFailure(reason: StorybookAIUnavailableReason): string {
  switch (reason) {
    case 'auth-context-missing':
    case 'principal-unauthorized':
      return '当前 Nimi 会话无法执行文本生成。';
    case 'ai-binding-missing':
      return 'Storybook 文本生成尚未完成配置。';
    case 'input-invalid':
      return '文本生成输入不符合当前限制。';
    case 'sdk-method-unavailable':
    case 'capability-unavailable':
      return '当前平台尚未提供可用的文本生成通道。';
    case 'runtime-not-ready':
    case 'runtime-call-failed':
      return 'Runtime 未能完成这次文本生成。';
  }
}

function exactText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim() || value.trim() !== value) {
    throw inputError(`${field} must be exact non-empty text.`);
  }
  return value;
}

function boundedNumber(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
    ? value
    : fallback;
}

function boundedInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  return Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= maximum
    ? Number(value)
    : fallback;
}

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function inputError(message: string): Error {
  return Object.assign(new Error(message), { reasonCode: 'STORYBOOK_TEXT_INPUT_INVALID' });
}
