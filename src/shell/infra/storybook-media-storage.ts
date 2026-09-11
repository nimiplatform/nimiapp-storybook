import { openNimiLocalAppAssetMediaUrl } from '@nimiplatform/kit/shell/renderer/bridge';
import { getStorybookNimiClient } from './storybook-nimi-client.js';
import { mapWorkMedia } from '../../storybook/engine/protocol/media.js';
import type { StorybookWork } from '../../storybook/engine/protocol/types.js';

const PREFIX = 'storybook-media:';
const LOCAL_MEDIA = /^storybook-media:([a-f0-9]{64}\.(?:png|jpg|webp|gif|mp3|ogg|wav|mp4|webm))$/;
const EXTENSIONS: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'video/mp4': 'mp4', 'video/webm': 'webm' };
const imports = new Map<string, Promise<string>>();
export function nativeMediaPath(uri: string): string | undefined {
  const match = LOCAL_MEDIA.exec(uri); return match ? `storybook/media/${match[1]}` : undefined;
}

// @nimi-authority: rule.storybook.protocol.r007
export async function storeStorybookMedia(uri: string): Promise<string> {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/.exec(uri);
  if (!match || !EXTENSIONS[match[1]]) return uri;
  const running = imports.get(uri); if (running) return running;
  const job = (async () => {
    const binary = atob(match[2]); const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
    const file = `${hash}.${EXTENSIONS[match[1]]}`; const path = `storybook/media/${file}`;
    const assets = getStorybookNimiClient().storage.assets;
    try { await assets.stat(path); }
    catch (error) {
      if (!error || typeof error !== 'object' || !('reasonCode' in error) || error.reasonCode !== 'not-found') throw error;
      await assets.write({ relativePath: path, body: bytes, mediaType: match[1] });
    }
    return `${PREFIX}${file}`;
  })();
  imports.set(uri, job);
  try { return await job; } finally { imports.delete(uri); }
}
export function storeWorkMedia(work: StorybookWork): Promise<StorybookWork> { return mapWorkMedia(work, storeStorybookMedia); }
export async function portableStorybookMedia(uri: string): Promise<string> {
  const path = nativeMediaPath(uri); if (!path) return uri;
  const result = await getStorybookNimiClient().storage.assets.read({ relativePath: path });
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  for await (const chunk of result.body) chunks.push(new Uint8Array(chunk));
  const blob = new Blob(chunks, { type: result.asset.mediaType });
  return new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob);
  });
}
export async function portableWork(work: StorybookWork): Promise<StorybookWork> { return mapWorkMedia(work, portableStorybookMedia); }
export async function openStorybookMedia(uri: string) {
  const path = nativeMediaPath(uri);
  if (!path) throw new Error('本机媒体引用无效。');
  return openNimiLocalAppAssetMediaUrl(path);
}
