import { openNimiAppAssetMediaUrl } from '@nimiplatform/kit/core/app-asset-media';
import { captureStorybookIdentity, captureStorybookWriteScope } from '../../storybook/store/native-repository.js';
import { getStorybookNimiClient } from './storybook-nimi-client.js';
import { mapWorkMedia } from '../../storybook/engine/protocol/media.js';
import type { StorybookWork } from '../../storybook/engine/protocol/types.js';

const PREFIX = 'storybook-media:';
const LOCAL_MEDIA = /^storybook-media:([a-f0-9]{64}\.(?:png|jpg|webp|gif|mp3|ogg|wav|mp4|webm))$/;
const EXTENSIONS: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'video/mp4': 'mp4', 'video/webm': 'webm' };
type Assets = ReturnType<typeof getStorybookNimiClient>['storage']['assets'];
const imports = new WeakMap<Assets, Map<string, Promise<string>>>();
export function nativeMediaPath(uri: string): string | undefined {
  const match = LOCAL_MEDIA.exec(uri); return match ? `storybook/media/${match[1]}` : undefined;
}

// @nimi-authority: rule.storybook.protocol.r007
export function storeStorybookMedia(uri: string): Promise<string> {
  return storeMedia(uri, getStorybookNimiClient().storage.assets, captureStorybookWriteScope());
}
async function storeMedia(uri: string, assets: Assets, assertCurrent: () => void): Promise<string> {
  assertCurrent();
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/.exec(uri);
  if (!match || !EXTENSIONS[match[1]]) return uri;
  let jobs = imports.get(assets);
  if (!jobs) { jobs = new Map(); imports.set(assets, jobs); }
  const running = jobs.get(uri); if (running) return running;
  const job = (async () => {
    const binary = atob(match[2]); const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
    const file = `${hash}.${EXTENSIONS[match[1]]}`; const path = `storybook/media/${file}`;
    assertCurrent();
    // The path is derived from these exact bytes. Re-import may replace the
    // same content; existing Runtime references never re-upload their media.
    await assets.write({ relativePath: path, body: bytes, mediaType: match[1], overwrite: true });
    assertCurrent();
    return `${PREFIX}${file}`;
  })();
  jobs.set(uri, job);
  try { return await job; } finally { jobs.delete(uri); }
}
export function storeWorkMedia(work: StorybookWork): Promise<StorybookWork> {
  const assets = getStorybookNimiClient().storage.assets; const assertCurrent = captureStorybookWriteScope();
  return mapWorkMedia(work, uri => storeMedia(uri, assets, assertCurrent));
}
async function portableMedia(uri: string, assets: Assets, assertIdentity: () => void): Promise<string> {
  assertIdentity();
  const path = nativeMediaPath(uri); if (!path) return uri;
  const result = await assets.read({ relativePath: path });
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  for await (const chunk of result.body) chunks.push(new Uint8Array(chunk));
  const blob = new Blob(chunks, { type: result.asset.mediaType });
  return new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => { try { assertIdentity(); resolve(String(reader.result)); } catch (error) { reject(error); } }; reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob);
  });
}
export async function portableWork(work: StorybookWork): Promise<StorybookWork> {
  const assets = getStorybookNimiClient().storage.assets; const assertIdentity = captureStorybookIdentity();
  return mapWorkMedia(work, uri => portableMedia(uri, assets, assertIdentity));
}
export async function openStorybookMedia(uri: string) {
  const path = nativeMediaPath(uri);
  if (!path) throw new Error('本机媒体引用无效。');
  return openNimiAppAssetMediaUrl(getStorybookNimiClient().storage.assets, path);
}
