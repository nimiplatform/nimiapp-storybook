import { useCallback, useEffect, useRef, useState } from 'react';
import { nativeMediaPath, openStorybookMedia } from '../../../shell/infra/storybook-media-storage.js';
import { safeMediaUri } from '../../engine/protocol/validate.js';

// @nimi-authority: rule.storybook.protocol.r007
export function useMediaUrl(uri?: string): { url?: string; error?: string; reload: () => void; native: boolean } {
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  const [resolved, setResolved] = useState<{ uri?: string; revision?: number; url?: string; error?: string }>({});
  useEffect(() => {
    if (!uri || !nativeMediaPath(uri)) return;
    let cancelled = false; let handle: Awaited<ReturnType<typeof openStorybookMedia>> | undefined;
    void openStorybookMedia(uri).then(value => {
      if (cancelled) { void value.revoke().catch(() => undefined); return; }
      handle = value; setResolved({ uri, revision, url: value.url });
    }).catch(() => { if (!cancelled) setResolved({ uri, revision, error: '本机媒体暂时无法打开。' }); });
    return () => { cancelled = true; if (handle) void handle.revoke().catch(() => undefined); };
  }, [uri, revision]);
  const native = Boolean(uri && nativeMediaPath(uri));
  const media = !uri ? {} : native ? resolved.uri === uri && resolved.revision === revision ? resolved : {} : safeMediaUri(uri) ? { url: safeMediaUri(uri) } : { error: '媒体地址暂不支持。' };
  return { ...media, reload, native };
}
export function NativeImage({ uri, alt = '', lazy = false, retryable = false }: { uri: string; alt?: string; lazy?: boolean; retryable?: boolean }) {
  const media = useMediaUrl(uri);
  const [failedUrl, setFailedUrl] = useState<string>();
  const renewed = useRef(false);
  function retry() { renewed.current = false; setFailedUrl(undefined); media.reload(); }
  return media.url && failedUrl !== media.url ? <img src={media.url} alt={alt} loading={lazy ? 'lazy' : 'eager'} referrerPolicy="no-referrer" onLoad={() => { renewed.current = false; }} onError={() => {
    if (media.native && !renewed.current) { renewed.current = true; media.reload(); }
    else setFailedUrl(media.url);
  }} /> : <span className="sb-media-placeholder">{alt && `${alt} · `}{media.error || (failedUrl ? '图片暂时无法显示。' : '正在打开图片…')}{retryable && (media.error || failedUrl) && safeMediaUri(uri) && <button className="sb-quiet-button" onClick={retry}>重新加载图片</button>}</span>;
}

export function NativePlayer({ uri, kind, alt }: { uri: string; kind: 'audio' | 'video'; alt: string }) {
  const media = useMediaUrl(uri);
  const [failed, setFailed] = useState(false);
  const renewed = useRef(false);
  const position = useRef(0);
  const playing = useRef(false);
  const player = useRef<HTMLMediaElement | null>(null);
  useEffect(() => {
    // A renewed preload=none URL needs an actual play request before metadata
    // can arrive; waiting for loadedmetadata alone would require a second click.
    if (media.url && playing.current && player.current) void player.current.play().catch(() => { playing.current = false; });
  }, [media.url]);
  const retry = () => { setFailed(false); renewed.current = true; media.reload(); };
  const props = {
    src: media.url,
    ref: (element: HTMLMediaElement | null) => { player.current = element; },
    controls: true,
    'aria-label': alt,
    onTimeUpdate: (event: React.SyntheticEvent<HTMLMediaElement>) => { position.current = event.currentTarget.currentTime; },
    onPlay: () => { playing.current = true; },
    onPause: (event: React.SyntheticEvent<HTMLMediaElement>) => { if (!event.currentTarget.error) playing.current = false; },
    onLoadedMetadata: (event: React.SyntheticEvent<HTMLMediaElement>) => {
      const player = event.currentTarget;
      if (position.current > 0 && Number.isFinite(player.duration)) player.currentTime = Math.min(position.current, player.duration);
      if (playing.current) void player.play().catch(() => { playing.current = false; });
    },
    onCanPlay: () => { renewed.current = false; },
    onError: () => { if (media.native && !renewed.current) retry(); else setFailed(true); },
  };
  if (!media.url || failed) return <div className="sb-media-placeholder" role="status">{media.error || (failed ? '媒体暂时无法播放。' : '正在打开媒体…')}{(media.error || failed) && <button className="sb-quiet-button" onClick={retry}>重新加载媒体</button>}</div>;
  return kind === 'audio' ? <audio {...props} preload="none" /> : <video {...props} playsInline preload="metadata" />;
}
