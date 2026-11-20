import type { NimiAppRuntimeClient } from '@nimiplatform/sdk';
import type { NimiAppSession } from '@nimiplatform/kit/core/app-session';

let session: NimiAppSession;
export function bindStorybookSession(value: NimiAppSession) { session = value; }
export function getStorybookSession(): NimiAppSession { return session; }
export function getStorybookNimiClient(): NimiAppRuntimeClient {
  const runtime = session.getSnapshot().runtime;
  if (runtime.status !== 'connected') throw new Error('请先连接 Nimi，以访问内容库和 AI。');
  runtime.scope.signal.throwIfAborted();
  return runtime.scope.client;
}
