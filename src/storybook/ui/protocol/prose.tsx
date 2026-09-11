import Markdown, { type Components, type UrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { safeMediaUri } from '../../engine/protocol/validate.js';
import { NativeImage } from './native-media.js';

const urlTransform: UrlTransform = (url, key) => {
  if (key === 'src') return safeMediaUri(url);
  if (/^#[\w-]+$/.test(url)) return url;
  try {
    const target = new URL(url);
    return ['https:', 'http:'].includes(target.protocol) && target.hostname && !target.username && !target.password ? target.href : undefined;
  } catch { return undefined; }
};
const components: Components = {
  img: ({ src, alt, title }) => <span className="sb-prose-image" title={title}>{typeof src === 'string' && src
    ? <NativeImage key={src} uri={src} alt={alt || '故事中的图片'} lazy />
    : <span className="sb-media-placeholder">{alt || '图片'} · 图片地址暂不支持。</span>}</span>,
  a: ({ href, children, title }) => href
    ? <a href={href} title={title} target={href.startsWith('#') ? undefined : '_blank'} rel="noopener noreferrer">{children}</a>
    : <span>{children}</span>,
  table: ({ children }) => <div className="sb-prose-table"><table>{children}</table></div>,
};

// @nimi-authority: rule.storybook.protocol.r002
// @nimi-authority: rule.storybook.protocol.r006
export function Prose({ text }: { text: string }) {
  return <div className="sb-content-prose"><Markdown remarkPlugins={[remarkGfm]} components={components} urlTransform={urlTransform}>{text}</Markdown></div>;
}
