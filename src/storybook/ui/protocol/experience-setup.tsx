import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Download, Globe2, MessageCircle, UserRound, Sparkles, Layers, Feather } from 'lucide-react';
import { getDocument, listDocuments, saveExperienceRun } from '../../store/storybook-store.js';
import { conversationOf, flowOf, type StorybookWork } from '../../engine/protocol/types.js';
import { inspectWorkSupport, safeMediaUri, validateCard } from '../../engine/protocol/validate.js';
import { cardArtwork, createExperience, defaultWork, documentTitle, embeddedWork, externalExtensionNames, workWithCard, workWithWorlds, type BoundCard, type BoundWorld } from '../../engine/protocol/session.js';
import { artworkOf, downloadJson, ExperienceContent, Prose } from './shared.js';

import { NativeImage } from './native-media.js';

export function ExperienceSetup({ documentId, onBack, onStart, onCreate }: { documentId: string; onBack: () => void; onStart: (id: string) => void; onCreate: (work: StorybookWork) => void }) {
  const [source] = useState(() => getDocument(documentId));
  const [documents] = useState(() => listDocuments());
  const embedded = source?.kind === 'card' ? embeddedWork(source.data) : {};
  const [useEmbedded, setUseEmbedded] = useState(Boolean(embedded.work));
  const work = useMemo(() => source ? useEmbedded && embedded.work ? embedded.work : defaultWork(source) : undefined, [source, useEmbedded]);
  const [bindings, setBindings] = useState<Record<string, string>>({});
  const [worldSelection, setWorldSelection] = useState<string[] | null>(null);
  const [playerName, setPlayerName] = useState('你'); const [greeting, setGreeting] = useState(0); const [error, setError] = useState('');
  if (!source || !work) return <div className="sb-page"><p>找不到这份内容。</p><button className="sb-quiet-button" onClick={onBack}>返回收藏</button></div>;
  const cardDocuments = documents.filter(d => d.kind === 'card');
  const worldDocuments = documents.filter(d => d.kind === 'lorebook');
  const resourceCards = Object.entries(work.resources ?? {}).filter(([, r]) => r.type === 'character');
  const resourceWorlds = Object.entries(work.resources ?? {}).filter(([, r]) => r.type === 'lorebook');
  const slots = Object.entries(work.roles ?? {});
  const bindingValue = (role: string, index: number) => bindings[role] ?? (work.roles?.[role].card ? `resource:${work.roles[role].card}` : index === 0 && source.kind === 'card' ? source.id : '');
  const selectedCards: Record<string, BoundCard> = {};
  slots.forEach(([role], index) => {
    const selected = bindingValue(role, index);
    if (selected.startsWith('resource:')) {
      const key = selected.slice(9); const r = work.resources?.[key];
      if (r?.type === 'character') {
        const portrait = r.portrait ? work.resources?.[r.portrait] : undefined;
        selectedCards[role] = { sourceRef: `${source.id}#resources/${key}`, card: r.card, ...(portrait?.type === 'media' ? { artwork: portrait.uri, artworkMimeType: portrait.mimeType } : {}) };
      }
    } else {
      const d = cardDocuments.find(d => d.id === selected);
      if (d?.kind === 'card') selectedCards[role] = { sourceRef: d.id, card: d.data, artwork: d.artwork, ...(d.artwork ? { artworkMimeType: 'image/png' } : {}) };
    }
  });
  const currentRole = conversationOf(work).role ?? Object.keys(selectedCards)[0];
  const active = selectedCards[currentRole];
  const card = active?.card;
  const worlds = worldSelection ?? (source.kind === 'lorebook' ? [source.id] : (conversationOf(work).worlds ?? []).map(ref => `resource:${ref}`));
  const selectedWorlds: BoundWorld[] = worlds.flatMap(ref => {
    if (ref.startsWith('resource:')) { const r = work.resources?.[ref.slice(9)]; return r?.type === 'lorebook' ? [{ sourceRef: `${source.id}#resources/${ref.slice(9)}`, book: r.book }] : []; }
    const d = worldDocuments.find(w => w.id === ref); return d?.kind === 'lorebook' ? [{ sourceRef: d.id, book: d.data }] : [];
  });
  const flow = flowOf(work); const node = flow?.nodes.find(n => n.id === flow.entry);
  const greetings = card ? [card.data.first_mes, ...card.data.alternate_greetings] : [];
  const opening = node?.content ?? conversationOf(work).opening ?? (greetings[greeting] ? [{ type: 'text' as const, text: greetings[greeting] }] : []);
  const support = inspectWorkSupport(work); const blocked = support.some(i => i.blocking);
  const image = safeMediaUri(active?.artwork ?? (card ? cardArtwork(card) : artworkOf(source)));
  const needsCard = slots.some(([key, role]) => role.required && !selectedCards[key]);
  const unsupportedCardExtensions = card ? externalExtensionNames(card) : [];
  const cardIssues = card ? validateCard(card).filter(i => i.level === 'warning') : [];
  async function enter() {
    try { const run = createExperience({ work: work!, sourceRef: source!.id, cards: selectedCards, worlds: selectedWorlds, playerName, greetingIndex: greeting, now: new Date().toISOString() }); await saveExperienceRun(run); onStart(run.id); }
    catch (e) { setError(e instanceof Error ? e.message : '无法开始，请检查内容。'); }
  }
  function create() {
    let draft = structuredClone(work!);
    Object.entries(selectedCards).forEach(([role, bound]) => { draft = workWithCard(draft, role, bound.card, bound.artwork && bound.artworkMimeType ? { uri: bound.artwork, mimeType: bound.artworkMimeType } : undefined); });
    draft = workWithWorlds(draft, selectedWorlds.map(world => world.book));
    onCreate(draft);
  }
  return <div className="sb-page sb-experience-setup">
    <header className="sb-page-top"><button className="sb-quiet-button" onClick={onBack}><ArrowLeft size={16} />返回我的世界</button><button className="sb-quiet-button" onClick={async () => { try { await downloadJson(source.data, documentTitle(source)); } catch (e) { setError(e instanceof Error ? e.message : '导出失败。'); } }}><Download size={15} />导出原始 JSON</button></header>
    <div className="sb-setup-grid">
      <aside className="sb-identity-card">
        <div className="sb-identity-portrait">{image ? <NativeImage uri={image} alt={card?.data.name ?? documentTitle(source)} /> : <><span className="sb-portrait-orbit" /><span>{(card?.data.name ?? documentTitle(source)).slice(0, 1)}</span></>}<div className="sb-portrait-label">{source.kind === 'work' || useEmbedded ? 'AN EXPERIENCE, YOUR WAY' : 'SOMEONE TO MEET'}</div></div>
        <div className="sb-identity-copy"><span className="sb-eyebrow">{source.kind === 'card' ? 'CHARACTER CARD V2' : source.kind === 'work' ? 'STORYBOOK EXPERIENCE' : 'WORLDBUILDING'}</span><h1>{useEmbedded || source.kind === 'work' ? work.title : documentTitle(source)}</h1>{card?.data.creator && <p className="sb-byline">{source.kind === 'card' && !useEmbedded ? '角色作者：' : `${card.data.name} 的角色作者：`}{card.data.creator}</p>}
          {work.summary && <p className="sb-setup-summary">{work.summary}</p>}
          {card && <div className="sb-tags">{card.data.tags.slice(0, 8).map((tag, i) => <span key={i}>{tag}</span>)}</div>}
          {card?.data.creator_notes && <details className="sb-creator-notes" open><summary>{source.kind === 'card' && !useEmbedded ? '角色作者的话' : `${card.data.name} · 角色作者的话`}</summary><Prose text={card.data.creator_notes} /></details>}
          {source.kind === 'lorebook' && <><p className="sb-setup-summary">{source.data.description}</p><span className="sb-byline">{source.data.entries.length} 条世界资料 · 随互动按需唤起</span></>}
        </div>
      </aside>
      <section className="sb-setup-main">
        <span className="sb-eyebrow">EVERY ENCOUNTER BEGINS DIFFERENTLY</span><h2>这一次，怎样相遇？</h2><p className="sb-muted">选择同行的人，带上一个世界。你的每段经历都会独立保存。</p>
        {source.kind === 'card' && (embedded.work || embedded.error) && <div className="sb-setup-mode"><button aria-pressed={!useEmbedded} className={!useEmbedded ? 'is-active' : ''} onClick={() => { setUseEmbedded(false); setBindings({}); setWorldSelection(null); setGreeting(0); }}>使用角色卡</button><button disabled={!embedded.work} aria-pressed={useEmbedded} className={useEmbedded ? 'is-active' : ''} onClick={() => { setUseEmbedded(true); setBindings({}); setWorldSelection(null); setGreeting(0); }}>附带的 Storybook 体验</button></div>}
        {embedded.error && <p className="sb-notice">附带作品无法使用：{embedded.error}。角色卡本身仍可独立使用。</p>}
        <div className="sb-binding-panel">
          <label className="sb-field"><span><UserRound size={15} />故事里如何称呼你</span><input value={playerName} maxLength={80} onChange={e => setPlayerName(e.target.value)} aria-label="游玩称呼" /></label>
          {slots.map(([role, slot], index) => <label className="sb-field" key={role}><span><MessageCircle size={15} />{slot.label}{slot.required && <small>需要角色</small>}</span><select aria-label={slot.label} value={bindingValue(role, index)} onChange={e => { setBindings({ ...bindings, [role]: e.target.value }); setGreeting(0); }}>{!slot.card && <option value="">{slot.required ? '选择一张角色卡' : '由叙述者陪伴'}</option>}{resourceCards.map(([key, r]) => r.type === 'character' && <option key={key} value={`resource:${key}`}>{r.card.data.name} · 作品内置</option>)}{cardDocuments.map(d => <option key={d.id} value={d.id}>{documentTitle(d)}</option>)}</select></label>)}
          {(worldDocuments.length > 0 || resourceWorlds.length > 0) && <fieldset className="sb-world-picker"><legend><Globe2 size={15} />世界资料 <span>可叠加或更换</span></legend>{[...resourceWorlds.map(([key, r]) => ({ id: `resource:${key}`, title: `${r.type === 'lorebook' ? r.book.name || key : key} · 作品内置` })), ...worldDocuments.map(d => ({ id: d.id, title: `${documentTitle(d)} · 我的收藏` }))].map(w => <label key={w.id}><input type="checkbox" checked={worlds.includes(w.id)} onChange={e => setWorldSelection(e.target.checked ? [...worlds, w.id] : worlds.filter(id => id !== w.id))} /><span>{w.title}</span></label>)}{card?.data.character_book && <p>角色卡自带的资料也会参与互动。</p>}</fieldset>}
        </div>
        <div className="sb-opening-heading"><span><Sparkles size={16} />{flow ? node?.title || '作品开场' : '相遇的第一幕'}</span>{!flow && !conversationOf(work).opening && greetings.length > 1 && <div className="sb-opening-switch"><button aria-label="上一个开场" onClick={() => setGreeting((greeting + greetings.length - 1) % greetings.length)}>←</button><span>{greeting + 1} / {greetings.length}</span><button aria-label="下一个开场" onClick={() => setGreeting((greeting + 1) % greetings.length)}>→</button></div>}</div>
        <div className="sb-opening-preview">{opening.length ? <ExperienceContent parts={opening} work={work} char={card?.data.name} user={playerName} /> : <div className="sb-unwritten"><Feather size={26} strokeWidth={1.2} /><p>这里还没有写好的第一幕。</p><span>你说出的第一句话，会让它开始。</span></div>}</div>
        {support.length > 0 && <div className="sb-support-notices">{support.map(issue => <p key={issue.id} className={issue.blocking ? 'sb-notice' : 'sb-muted'}>{issue.message}</p>)}</div>}
        {(unsupportedCardExtensions.length > 0 || cardIssues.length > 0) && <details className="sb-format-details"><summary><Layers size={14} />导入说明</summary>{unsupportedCardExtensions.length > 0 && <p>已保留附加字段 {unsupportedCardExtensions.join('、')}。这些平台扩展尚未执行，远程 lorebook 引用不会自动加载。</p>}{cardIssues.map((i, index) => <p key={index}>{i.message}</p>)}</details>}
        {error && <p className="sb-notice" role="alert">{error}</p>}
        <div className="sb-setup-actions"><button className="sb-primary" disabled={blocked || needsCard || !playerName.trim()} onClick={enter}>走进这次相遇<ArrowRight size={17} /></button><button className="sb-quiet-button" onClick={create}><Feather size={15} />在创作间使用</button></div>
        {needsCard && <p className="sb-muted">先导入一张角色卡，再为需要的角色位置选择它。</p>}
      </section>
    </div>
  </div>;
}
