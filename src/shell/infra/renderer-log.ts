import { hasTauriRuntime, invokeTauri } from '../bridge/index.js';

export type StorybookRendererLogLevel = 'debug' | 'info' | 'warn' | 'error';

type JsonObject = Record<string, unknown>;

type StorybookRendererLogPayload = {
  level: StorybookRendererLogLevel;
  area: string;
  message: string;
  traceId?: string;
  flowId?: string;
  source?: string;
  costMs?: number;
  details?: JsonObject;
};

let globalErrorLoggingInstalled = false;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeValue(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : '[UNSERIALIZABLE]';
  if (typeof value === 'bigint' || typeof value === 'symbol' || typeof value === 'function') {
    return '[UNSERIALIZABLE]';
  }
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : '[UNSERIALIZABLE]';
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) return '[CIRCULAR]';
    seen.add(value);
    return value.map((entry) => sanitizeValue(entry, seen));
  }
  if (isRecord(value)) {
    if (seen.has(value)) return '[CIRCULAR]';
    seen.add(value);
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) out[key] = sanitizeValue(entry, seen);
    return out;
  }
  return '[UNSERIALIZABLE]';
}

function sanitize(details: JsonObject | undefined): JsonObject | undefined {
  if (!details) return undefined;
  return sanitizeValue(details, new WeakSet()) as JsonObject;
}

export function describeError(error: unknown): JsonObject {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null,
    };
  }
  if (isRecord(error)) return sanitize(error) ?? { value: String(error) };
  return { value: String(error) };
}

export function logRendererEvent(payload: StorybookRendererLogPayload): void {
  if (!hasTauriRuntime()) return;
  void invokeTauri('log_renderer_event', {
    payload: {
      ...payload,
      details: sanitize(payload.details),
    },
  }).catch(() => {});
}

export function installStorybookGlobalErrorLogging(): void {
  if (globalErrorLoggingInstalled || typeof window === 'undefined') return;
  globalErrorLoggingInstalled = true;
  window.addEventListener('error', (event) => {
    logRendererEvent({
      level: 'error',
      area: 'window.error',
      message: event.message || 'window error',
      details: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error ? describeError(event.error) : null,
      },
    });
  });
  window.addEventListener('unhandledrejection', (event) => {
    logRendererEvent({
      level: 'error',
      area: 'window.unhandledrejection',
      message: 'unhandled promise rejection',
      details: { reason: describeError(event.reason) },
    });
  });
}
