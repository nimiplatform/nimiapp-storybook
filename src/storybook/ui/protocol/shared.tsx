import type { ContentPart, ImportedDocument, StorybookWork } from '../../engine/protocol/types.js';
import { cardArtwork, outputParts, substitute, type ExperienceRun } from '../../engine/protocol/session.js';
import { safeMediaUri, validateWork } from '../../engine/protocol/validate.js';

import { portableWork } from '../../../shell/infra/storybook-media-storage.js';
import { NativeImage, NativePlayer } from './native-media.js';
import { Prose } from './prose.js';
export { Prose } from './prose.js';

export function artworkOf(document: ImportedDocument): string | undefined {
  if (document.artwork) return safeMediaUri(document.artwork);
  if (document.kind === 'card') return safeMediaUri(cardArtwork(document.data));
  if (document.kind === 'work' && document.data.cover) {
    const resource = document.data.resources?.[document.data.cover];
    if (resource?.type === 'media') return safeMediaUri(resource.uri);
  }
  return undefined;
}
export async function downloadJson(value: unknown, name: string) {
  if (value && typeof value === 'object' && 'format' in value && value.format === 'nimi.storybook' && !validateWork(value).some(i => i.level === 'error')) value = await portableWork(value as StorybookWork);
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name.replace(/[\\/:*?"<>|]/g, '-') + '.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// @nimi-authority: rule.storybook.protocol.r006
export function ExperienceContent({ parts, work, run, char = '', user = '你', expand = true }: { parts: ContentPart[]; work: StorybookWork; run?: ExperienceRun; char?: string; user?: string; expand?: boolean }) {
  return <>{parts.map((part, i) => {
    if (part.type === 'text') return <Prose key={i} text={expand ? substitute(part.text, char, user) : part.text} />;
    if (part.type === 'output') {
      const resolved = run ? outputParts(run, part.task, part.output) : [];
      return resolved.length ? <ExperienceContent key={i} parts={resolved} work={work} run={run} char={char} user={user} expand={expand} /> : <p key={i} className="sb-media-placeholder">{part.alt || '此处的内容将在体验中生成。'}</p>;
    }
    const resource = part.type === 'media' ? part : work.resources?.[part.ref];
    if (resource?.type === 'text') return <Prose key={i} text={expand ? substitute(resource.text, char, user) : resource.text} />;
    if (resource?.type !== 'media') return <p key={i} className="sb-media-placeholder">{part.alt || '此资源暂时无法显示。'}</p>;
    return <Media key={i} uri={resource.uri} mimeType={resource.mimeType} alt={part.alt || resource.alt || '作品中的媒体'} />;
  })}</>;
}

function Media({ uri, mimeType, alt }: { uri: string; mimeType: string; alt: string }) {
  if (/^image\/(png|jpeg|webp|gif)$/.test(mimeType)) return <figure className="sb-experience-media"><NativeImage key={uri} uri={uri} alt={alt} lazy retryable /><figcaption>{alt}</figcaption></figure>;
  if (/^audio\/(mpeg|ogg|wav)$/.test(mimeType)) return <figure className="sb-experience-media"><figcaption>{alt}</figcaption><NativePlayer key={uri} uri={uri} kind="audio" alt={alt} /></figure>;
  if (/^video\/(mp4|webm)$/.test(mimeType)) return <figure className="sb-experience-media"><NativePlayer key={uri} uri={uri} kind="video" alt={alt} /><figcaption>{alt}</figcaption></figure>;
  return <p className="sb-media-placeholder">{alt} · 媒体格式暂不支持</p>;
}
