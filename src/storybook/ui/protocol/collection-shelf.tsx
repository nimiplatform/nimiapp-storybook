import { useEffect, useState } from 'react';
import { ArrowRight, Globe2, Layers, MessageCircle, Sparkles } from 'lucide-react';
import { listDocuments, listExperienceRuns } from '../../store/storybook-store.js';
import { activeNode, documentTitle } from '../../engine/protocol/session.js';
import { NativeImage } from './native-media.js';
import { artworkOf } from './shared.js';
import { relativeDate } from '../shared.js';

export function CollectionShelf({ filter, query, onOpen, onResume }: { filter: 'all' | 'continue'; query: string; onOpen: (id: string) => void; onResume: (id: string) => void }) {
  const [documents, setDocuments] = useState(() => listDocuments()); const [runs, setRuns] = useState(() => listExperienceRuns());
  const [kind, setKind] = useState<'all' | 'card' | 'work' | 'lorebook'>('all');
  useEffect(() => { const update = () => { setDocuments(listDocuments()); setRuns(listExperienceRuns()); }; window.addEventListener('storybook-store-updated', update); return () => window.removeEventListener('storybook-store-updated', update); }, []);
  const visible = documents.filter(d => (kind === 'all' || d.kind === kind) && `${documentTitle(d)} ${d.kind === 'card' ? d.data.data.tags.join(' ') : ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const matchingRuns = runs.filter(run => [run.authority.work.title, run.playerName, ...Object.values(run.authority.cards).map(c => c.card.data.name), ...run.authority.worlds.map(w => w.book.name ?? '')].join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const recent = filter === 'continue' ? matchingRuns : matchingRuns.filter(r => !activeNode(r)?.end).slice(0, 2);
  if (!documents.length && !runs.length) return null;
  return <>
    {(recent.length > 0 || (filter === 'continue' && runs.length > 0)) && <section className="sb-footprints"><div className="sb-section-title"><h2>{filter === 'continue' ? '那些相遇的足迹' : '有人还在等你'}</h2><span>{filter === 'continue' ? `${recent.length} 段独立经历` : '接着上一次的相遇'}</span></div>{!recent.length && <p className="sb-muted" role="status">没有匹配的相遇，换个角色、世界或作品名试试。</p>}{recent.map(run => <button className="sb-resume" key={run.id} onClick={() => onResume(run.id)}><MessageCircle size={23} /><span><strong>{run.authority.work.title}</strong><small>{Object.values(run.authority.cards).map(c => c.card.data.name).join(' · ') || '开放体验'}{run.forkedFrom ? ' · 另一种可能' : ''}</small></span><span className="sb-resume-time">{relativeDate(run.updatedAt)}</span><span className="sb-resume-action">{activeNode(run)?.end ? '回看经历' : '继续相遇'}<ArrowRight size={16} /></span></button>)}</section>}
    {filter === 'all' && <section className="sb-collection-section"><div className="sb-section-title"><div><span className="sb-eyebrow">WORLDS YOU BROUGHT WITH YOU</span><h2>你的世界，不止一种可能</h2></div><span>{documents.length} 份收藏</span></div><div className="sb-filter-row" aria-label="收藏类型">{(['all','card','work','lorebook'] as const).map(k => <button key={k} aria-pressed={kind === k} className={kind === k ? 'is-active' : ''} onClick={() => setKind(k)}>{({ all: '全部收藏', card: '角色', work: '体验作品', lorebook: '世界资料' })[k]}</button>)}</div><div className="sb-collection-grid">{visible.map(d => {
      const image = artworkOf(d); const CardIcon = d.kind === 'card' ? MessageCircle : d.kind === 'work' ? Layers : Globe2;
      return <button className={`sb-collection-card sb-collection-card--${d.kind}`} key={d.id} onClick={() => onOpen(d.id)}><div className="sb-collection-art">{image ? <NativeImage uri={image} lazy /> : <><span className="sb-collection-letter">{documentTitle(d).slice(0, 1)}</span><Sparkles size={28} strokeWidth={1} /></>}<span className="sb-collection-kind"><CardIcon size={12} />{d.kind === 'card' ? '角色卡' : d.kind === 'work' ? '体验作品' : '世界资料'}</span></div><div className="sb-collection-copy"><h3>{documentTitle(d)}</h3><p>{d.kind === 'card' ? d.data.data.creator_notes.slice(0, 80) || '一个世界，从相遇开始。' : d.kind === 'work' ? d.data.summary || '换一个同行者，发现另一种可能。' : d.data.description || `${d.data.entries.length} 条等待被唤起的设定`}</p><span>{d.kind === 'card' ? `${d.data.data.alternate_greetings.length + 1} 种开场 · 开放互动` : d.kind === 'work' ? `${Object.keys(d.data.roles ?? {}).length} 个角色位置` : '可以与角色自由搭配'}<ArrowRight size={15} /></span></div></button>;
    })}</div>{!visible.length && <p className="sb-muted">这里还没有匹配的收藏。</p>}</section>}
  </>;
}
