import { useState } from 'react';
import { ArrowLeft, ArrowRight, Braces, Download, Feather, Plus, Save } from 'lucide-react';
import { getWorkDraft, getDocument, listDocuments, saveWork, clearWorkDraft } from '../../store/storybook-store.js';
import { CONVERSATION, conversationOf, type StorybookWork } from '../../engine/protocol/types.js';
import { inspectWorkSupport, validateWork } from '../../engine/protocol/validate.js';
import { documentTitle, workWithCard, workWithWorlds } from '../../engine/protocol/session.js';
import { storeWorkMedia } from '../../../shell/infra/storybook-media-storage.js';
import { downloadJson } from './shared.js';
import { useEditorSession } from '../use-editor-session.js';
import { mintId } from '../../engine/ids.js';
import { workEditor } from '../../store/content-editors.js';
import { forgetEditorSession } from '../../store/editor-session.js';

// @nimi-authority: rule.storybook.protocol.r003
export function WorkEditor({ documentId, initial, onBack, onPublished }: { documentId: string; initial?: StorybookWork; onBack: () => void; onPublished: (id: string) => void }) {
  const editor = useEditorSession(workEditor(documentId, initial));
  const draft = editor.value;
  const [saved, setSaved] = useState(''); const [error, setError] = useState('');
  const publishing = Boolean(editor.operation);
  const [documents] = useState(() => listDocuments());
  let parsed: unknown; let parseError = '';
  try { parsed = JSON.parse(draft); } catch { parseError = 'JSON 尚未写完整。草稿会保留。'; }
  const issues = parsed ? validateWork(parsed) : [];
  const valid = Boolean(parsed && !issues.some(i => i.level === 'error'));
  const work = valid ? parsed as StorybookWork : undefined;
  const support = work ? inspectWorkSupport(work) : [];
  function write(value: string) { setSaved(''); setError(''); void editor.session.update(() => value).catch(() => undefined); }
  function update(change: (work: StorybookWork) => StorybookWork) {
    setSaved(''); setError('');
    void editor.session.update(current => JSON.stringify(change(JSON.parse(current) as StorybookWork), null, 2)).catch(() => undefined);
  }
  async function publish(copy = false) {
    if (!work || publishing) return;
    try {
      const savedId = await editor.session.run('publish', async () => {
      await editor.session.flush();
      const latest = JSON.parse(editor.session.getSnapshot().value) as StorybookWork;
      if (validateWork(latest).some(issue => issue.level === 'error')) throw new Error('请先修正作品定义。');
      const next = await storeWorkMedia(latest);
      const doc = await saveWork(copy ? mintId('document') : documentId, copy ? { ...next, title: `${next.title} · 副本` } : next);
      if (!copy) await clearWorkDraft(documentId);
      return doc.id;
      }, true);
      if (!copy) forgetEditorSession(`work:${documentId}`);
      setSaved('作品已保存到我的世界'); onPublished(savedId);
    }
    catch (e) { setError(e instanceof Error ? e.message : '保存失败。'); }
  }
  return <div className="sb-page sb-work-editor"><header className="sb-page-top"><button className="sb-quiet-button" disabled={publishing} onClick={() => { void editor.session.flush().then(onBack).catch(() => undefined); }}><ArrowLeft size={16} />返回创作间</button><span className="sb-eyebrow">A WORLD THAT CAN TRAVEL</span></header><div className="sb-page-heading"><div><h1>编排一场属于你的体验。</h1><p>从一个想法开始。角色、世界、分支和媒体，都可以慢慢加入。</p></div></div>
    <div className="sb-work-editor-grid" inert={publishing}><section className="sb-work-form"><div className="sb-section-title"><h2><Feather size={18} />创作的起点</h2><span role="status">{editor.status === 'saving' ? '正在保存草稿…' : editor.status === 'error' ? '草稿未保存' : getWorkDraft(documentId) ? '草稿已保存在本机' : '开始编辑后自动保存'}</span></div>
      <label className="sb-field"><span>作品名</span><input aria-label="作品名" value={work?.title ?? ''} disabled={!work} onChange={e => update(w => ({ ...w, title: e.target.value || '未命名作品' }))} /></label>
      <label className="sb-field"><span>给玩家的简介</span><textarea aria-label="作品简介" value={work?.summary ?? ''} disabled={!work} rows={2} placeholder="让人想走进来的那一句话。" onChange={e => update(w => ({ ...w, summary: e.target.value }))} /></label>
      <label className="sb-field"><span>交给 AI 的创作意图</span><textarea aria-label="创作意图" disabled={!work} rows={7} value={work ? conversationOf(work).context ?? '' : ''} placeholder="可以是一种氛围、一套规则，或一个即将发生的时刻。人物与世界设定也可以直接写在这里。" onChange={e => update(w => ({ ...w, modules: { ...w.modules, [CONVERSATION]: { version: '1', config: { ...conversationOf(w), context: e.target.value } } } }))} /></label>
      <div className="sb-section-title"><h2>谁会出现在这里</h2><button className="sb-quiet-button" disabled={!work} onClick={() => update(w => { let n = 1; while (Object.hasOwn(w.roles ?? {}, `role-${n}`)) n++; return { ...w, roles: { ...w.roles, [`role-${n}`]: { label: `角色 ${n}` } } }; })}><Plus size={14} />增加角色位置</button></div>
      {work && Object.entries(work.roles ?? {}).map(([role, slot]) => <div className="sb-editor-role" key={role}><input aria-label={`角色位置 ${role}`} value={slot.label} onChange={e => update(w => ({ ...w, roles: { ...w.roles, [role]: { ...slot, label: e.target.value || '角色' } } }))} /><select aria-label={`${slot.label}的默认角色`} value="" onChange={e => { const d = documents.find(d => d.id === e.target.value); if (d?.kind === 'card') update(w => workWithCard(w, role, d.data, d.artwork ? { uri: d.artwork, mimeType: 'image/png' } : undefined)); }}><option value="">{slot.card && work.resources?.[slot.card]?.type === 'character' ? `已选：${(work.resources[slot.card] as { type: 'character'; card: { data: { name: string } } }).card.data.name}` : '由玩家选择，或选一张默认卡'}</option>{documents.filter(d => d.kind === 'card').map(d => <option key={d.id} value={d.id}>{documentTitle(d)}</option>)}</select></div>)}
      <p className="sb-muted">默认卡会随作品一起导出。玩家仍可以在新经历中更换角色。</p>
      {documents.some(d => d.kind === 'lorebook') && <label className="sb-field"><span>加入世界资料</span><select aria-label="加入世界资料" value="" disabled={!work} onChange={e => { const d = documents.find(d => d.id === e.target.value); if (d?.kind === 'lorebook') update(w => { const existing = (conversationOf(w).worlds ?? []).flatMap(ref => { const resource = w.resources?.[ref]; return resource?.type === 'lorebook' ? [resource.book] : []; }); return workWithWorlds(w, [...existing, d.data]); }); }}><option value="">选择已导入的世界资料</option>{documents.filter(d => d.kind === 'lorebook').map(d => <option key={d.id} value={d.id}>{documentTitle(d)}</option>)}</select>{work && <small>{(conversationOf(work).worlds ?? []).map(ref => { const r = work.resources?.[ref]; return r?.type === 'lorebook' ? r.book.name || ref : ref; }).join(' · ')}</small>}</label>}
    </section><section className="sb-protocol-editor"><div className="sb-section-title"><h2><Braces size={18} />完整作品定义</h2><span>0.1.0</span></div><p className="sb-muted">在这里精细编排流程、反馈、媒体和生成任务。左侧编辑会保留其他字段。</p><textarea wrap="off" spellCheck={false} className="sb-code-input" aria-label="Storybook 作品 JSON" value={draft} onChange={e => write(e.target.value)} /><div className="sb-protocol-validation" role="status">{parseError || (valid ? '结构有效 · 可以保存或导出' : issues.filter(i => i.level === 'error').slice(0, 4).map(i => `${i.path}：${i.message}`).join('\n'))}</div>{support.map(i => <p className={i.blocking ? 'sb-notice' : 'sb-muted'} key={i.id}>{i.message}</p>)}<div className="sb-template-links"><a href="./protocol/examples/branching-encounter.storybook.json" download>分支与反馈示例</a><a href="./protocol/examples/postcard.storybook.json" download>媒体与生成示例</a></div></section></div>
    {editor.status === 'error' && <div className="sb-notice" role="alert"><p>修改仍在这里，但尚未保存到本机。{editor.error}</p><button className="sb-quiet-button" onClick={() => { void editor.session.flush().catch(() => undefined); }}>重试保存</button></div>}
    {error && <p className="sb-notice" role="alert">{error}</p>}{saved && <p role="status">{saved}</p>}<footer className="sb-editor-actions"><button className="sb-quiet-button" disabled={publishing} onClick={async () => { try { await downloadJson(JSON.parse(draft), work?.title || 'storybook-draft'); } catch { setError('请先修正 JSON 语法后再导出。'); } }}><Download size={16} />导出独立作品</button>{getDocument(documentId) && <button className="sb-quiet-button" disabled={!valid || publishing} onClick={() => { void publish(true); }}>另存副本</button>}<button className="sb-primary" disabled={!valid || publishing} onClick={() => { void publish(); }}><Save size={16} />{publishing ? '正在保存…' : '保存并预览'}<ArrowRight size={16} /></button></footer>
  </div>;
}
