import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUp, Check, ChevronDown, Clock3, Feather, LoaderCircle, MessageCircle, RotateCcw, Settings2, Sparkles, X } from 'lucide-react';
import { getExperienceRun } from '../../store/storybook-store.js';
import { experienceBusy, recoverExperience, runExperienceGeneration, updateExperience, forkSavedExperience } from '../../ai/storybook-experience.js';
import { tasksOf, type GenerationTask } from '../../engine/protocol/types.js';
import { hasUsableFallback, safeMediaUri, taskSupport } from '../../engine/protocol/validate.js';
import { activeCard, activeNode, availableExperienceChoices, cardArtwork, chooseExperience, eventContentParts, resolveExperienceParts, substitute, latestTaskAttempt, requiredTasksPending, type ExperienceRun } from '../../engine/protocol/session.js';
import { NativeImage } from './native-media.js';
import { ExperienceContent } from './shared.js';
import { dialogueEditor } from '../../store/content-editors.js';
import { useEditorSession } from '../use-editor-session.js';

// @nimi-authority: rule.storybook.ia.r008
export function ExperiencePlay({ runId, onBack, onSettings, onFork }: { runId: string; onBack: () => void; onSettings: () => void; onFork: (id: string) => void }) {
  const [run, setRun] = useState(() => getExperienceRun(runId));
  const draft = useEditorSession(dialogueEditor(runId));
  const input = draft.value;
  const setInput = (text: string) => { void draft.session.update(() => text).catch(() => undefined); };
  const [error, setError] = useState(''); const [history, setHistory] = useState(false);
  const [saving, setSaving] = useState(false); const savingRef = useRef(false);
  const [, setActivity] = useState(0);
  const historyDialog = useRef<HTMLDialogElement>(null);
  const end = useRef<HTMLDivElement>(null); const textarea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const update = () => { setRun(getExperienceRun(runId)); setActivity(value => value + 1); };
    window.addEventListener('storybook-store-updated', update);
    window.addEventListener('storybook-experience-updated', update);
    const current = getExperienceRun(runId);
    if (current) void recoverExperience(current).catch(e => setError(e instanceof Error ? e.message : '经历未能恢复。'));
    return () => { window.removeEventListener('storybook-store-updated', update); window.removeEventListener('storybook-experience-updated', update); };
  }, [runId]);
  const busy = saving || experienceBusy(runId);
  const stalled = !busy && (run?.attempts.some(a => a.status === 'running') ?? false);
  useEffect(() => {
    if (!history) return;
    const opener = document.activeElement; const dialog = historyDialog.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { dialog?.close(); if (opener instanceof HTMLElement && opener.isConnected) opener.focus(); };
  }, [history]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [run?.events.length, busy]);
  useEffect(() => {
    if (!run || busy || stalled) return;
    const tasks = tasksOf(run.authority.work);
    const task = tasks.find(t => t.trigger.event === 'enter' && (!t.trigger.node || t.trigger.node === run.nodeId) && !latestTaskAttempt(run, t) && (t.dependsOn ?? []).every(id => {
      const dependency = tasks.find(d => d.id === id)!; const result = latestTaskAttempt(run, dependency);
      return result && result.status !== 'running' && (result.status === 'succeeded' || hasUsableFallback(dependency, run.authority.work));
    }));
    if (task) void runExperienceGeneration(run.id, { taskId: task.id }).catch(e => setError(e instanceof Error ? e.message : '生成中断。'));
  }, [run, busy, stalled]);
  if (!run) return <div className="sb-page"><p>找不到这段经历。</p><button onClick={onBack}>返回收藏</button></div>;
  const work = run.authority.work; const card = activeCard(run); const node = activeNode(run);
  const name = card?.data.name || '叙述者'; const artwork = safeMediaUri((run.roleId ? run.authority.cards[run.roleId]?.artwork : undefined) ?? (card ? cardArtwork(card) : undefined));
  const choices = availableExperienceChoices(run); const required = requiredTasksPending(run);
  const tasks = tasksOf(work).filter(t => !t.trigger.node || t.trigger.node === run.nodeId);
  const lastDialogue = [...run.attempts].reverse().find(a => a.taskId === '$dialogue');
  const dialogueFailed = lastDialogue && ['unavailable', 'failed', 'cancelled'].includes(lastDialogue.status) && run.events.at(-1)?.kind === 'user';
  const canTalk = !node?.end && node?.dialogue !== false;
  function persist(change: (current: ExperienceRun) => ExperienceRun) {
    setError('');
    void updateExperience(runId, change).catch(e => setError(e instanceof Error ? e.message : '经历未能保存。'));
  }
  async function send() {
    if (!input.trim() || busy || stalled || !run) return;
    setError('');
    try { await runExperienceGeneration(run.id, { message: draft.session.getSnapshot().value }); }
    catch (e) { setError(e instanceof Error ? e.message : '发送失败。输入仍保留在这里。'); }
  }
  async function generate(task: GenerationTask) {
    if (busy || stalled || savingRef.current) return;
    savingRef.current = true; setSaving(true);
    setError('');
    try { await runExperienceGeneration(runId, { taskId: task.id }); }
    catch (e) { setError(e instanceof Error ? e.message : '生成中断。'); }
    finally { savingRef.current = false; setSaving(false); }
  }
  async function restore() {
    if (!run || savingRef.current) return;
    savingRef.current = true; setSaving(true); setError('');
    try { setRun(await recoverExperience(run)); }
    catch (e) { setError(e instanceof Error ? e.message : '保存仍未完成，请稍后重试。'); }
    finally { savingRef.current = false; setSaving(false); }
  }
  return <div className="sb-experience-player">
    <header className="sb-experience-toolbar"><button className="sb-quiet-button" aria-label="返回我的世界" onClick={onBack}><ArrowLeft size={16} /><span>我的世界</span></button><div><strong>{work.title}</strong><span>{node?.title || `与${name}的这段相遇`}</span></div><div className="sb-reader-tools"><button className="sb-icon-button" title="经历与回溯" aria-label="经历与回溯" onClick={() => setHistory(true)}><Clock3 size={18} /></button><button className="sb-icon-button" title="设置与 AI" aria-label="设置与 AI" onClick={onSettings}><Settings2 size={18} /></button></div></header>
    <div className="sb-experience-layout">
      <aside className="sb-companion"><div className="sb-companion-portrait">{artwork ? <NativeImage uri={artwork} alt={name} /> : <span>{name.slice(0, 1)}</span>}</div><span className="sb-eyebrow">WITH YOU IN THIS WORLD</span><h2>{name}</h2><p>{work.summary || '从这一刻开始，共同经历。'}</p>
        {Object.keys(run.authority.cards).length > 1 && <label className="sb-field"><span>此刻想与谁交谈</span><select aria-label="交谈角色" disabled={busy || Boolean(node?.role)} value={run.roleId ?? ''} onChange={e => { const roleId = e.target.value; persist(current => ({ ...current, roleId })); }}>{Object.entries(run.authority.cards).map(([key, bound]) => <option key={key} value={key}>{bound.card.data.name}</option>)}</select></label>}
        {run.authority.worlds.length > 0 && <div className="sb-companion-worlds"><span>身处的世界</span>{run.authority.worlds.map(w => <p key={w.sourceRef}>{w.book.name || '世界资料'}</p>)}</div>}
        <small><Check size={12} />经历自动保存</small>
      </aside>
      <main className="sb-experience-thread">
        {Object.keys(run.authority.cards).length > 1 && <label className="sb-field sb-mobile-role-picker"><span>此刻想与谁交谈</span><select aria-label="交谈角色（移动端）" disabled={busy || Boolean(node?.role)} value={run.roleId ?? ''} onChange={e => { const roleId = e.target.value; persist(current => ({ ...current, roleId })); }}>{Object.entries(run.authority.cards).map(([key, bound]) => <option key={key} value={key}>{bound.card.data.name}</option>)}</select></label>}
        <div className="sb-experience-opening-label"><span />{new Date(run.createdAt).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })} · 一段新的经历<span /></div>
        {run.events.length === 0 && <div className="sb-unwritten"><Feather size={36} strokeWidth={1} /><h2>故事正在等你的第一句话。</h2><p>说一句话，或做一个动作，让这个世界开始回应。</p></div>}
        {run.events.map(event => {
          const eventCard = event.role ? run.authority.cards[event.role]?.card : undefined;
          return <article className={`sb-experience-event sb-experience-event--${event.kind}`} key={event.id}>
            <div className="sb-event-label">{event.kind === 'user' || event.kind === 'choice' ? run.playerName : event.kind === 'scene' ? flowTitle(run, event.nodeId) : event.kind === 'feedback' ? '选择之后' : eventCard?.data.name || '叙述者'}{event.kind === 'choice' && <span>你的选择</span>}</div>
            <ExperienceContent expand={false} parts={eventContentParts(event, run)} work={work} run={{ ...run, visit: event.visit }} char={eventCard?.data.name ?? name} user={run.playerName} />
          </article>;
        })}
        {busy && <div className="sb-experience-thinking" role="status"><span /><span /><span /><p>这个世界正在回应…</p></div>}
        {stalled && <div className="sb-experience-recovery" role="alert"><p>上次操作尚未完成保存。先恢复记录，再继续这段经历。</p><button className="sb-quiet-button" onClick={() => { void restore(); }}><RotateCcw size={14} />重试保存与恢复</button></div>}
        {dialogueFailed && <div className="sb-experience-recovery" role="alert"><p>{lastDialogue.message}</p><div><button className="sb-quiet-button" disabled={busy} onClick={() => { void runExperienceGeneration(run.id, { retryDialogue: true }).catch(e => setError(e instanceof Error ? e.message : '重试失败。')); }}><RotateCcw size={14} />重试这句话</button><button className="sb-quiet-button" onClick={onSettings}>设置与 AI<ArrowUp size={14} /></button></div></div>}
        {tasks.length > 0 && <section className="sb-experience-tasks" aria-label="体验中的生成内容">{tasks.map(task => {
          const attempt = latestTaskAttempt(run, task); const succeeded = attempt?.status === 'succeeded'; const waiting = attempt?.status === 'running'; const inputsReady = (task.dependsOn ?? []).every(id => { const dependency = tasksOf(work).find(t => t.id === id); const result = dependency && latestTaskAttempt(run, dependency); return result && result.status !== 'running' && (result.status === 'succeeded' || hasUsableFallback(dependency!, work)); }); const unsupported = taskSupport(task, work, inputsReady ? resolveExperienceParts(run, task.inputs) : undefined); const showFallback = Boolean(unsupported && hasUsableFallback(task, work)); const fixedUnavailable = Boolean(unsupported && (!showFallback || attempt?.status === 'unavailable'));
          return <div className="sb-experience-task" key={task.id}><div className="sb-task-heading"><span><Sparkles size={16} /><strong>{task.label}</strong></span><button className="sb-quiet-button" disabled={busy || stalled || fixedUnavailable || (succeeded && task.reuse !== 'never')} onClick={() => { void generate(task); }}>{waiting ? <LoaderCircle size={14} className="sb-spin" /> : succeeded && task.reuse !== 'never' ? <Check size={14} /> : <Sparkles size={14} />}{waiting ? '正在生成' : succeeded ? task.reuse === 'never' ? '再生成一次' : '已生成' : fixedUnavailable ? showFallback ? '作者预置' : '暂不支持' : showFallback ? '查看作者内容' : attempt ? '重试' : '生成'}</button></div>{(attempt?.message || unsupported) && <p className="sb-muted">{attempt?.message || unsupported}{hasUsableFallback(task, work) ? ' · 以下是作者提供的替代内容。' : ''}</p>}{succeeded ? Object.values(attempt.outputs).map((parts, i) => <ExperienceContent key={i} parts={parts} expand={false} work={work} run={run} char={name} user={run.playerName} />) : attempt && !waiting && hasUsableFallback(task, work) ? <ExperienceContent parts={task.fallback!} work={work} run={run} char={name} user={run.playerName} /> : null}</div>;
        })}</section>}
        {required.length > 0 && <p className="sb-notice">先完成「{required.map(t => t.label).join('、')}」，就能继续。</p>}
        {choices.length > 0 && <div className="sb-experience-choices" aria-label="当前选择">{choices.map(choice => <button key={choice.id} disabled={busy || stalled || required.length > 0} onClick={() => { try { persist(current => chooseExperience(current, choice.id, new Date().toISOString())); } catch (e) { setError(e instanceof Error ? e.message : '选择不可用。'); } }}><span>{substitute(choice.label, name, run.playerName)}</span><ArrowUp size={17} /></button>)}</div>}
        {node?.end && <div className="sb-experience-ending"><span>这一幕，在这里落下帷幕</span><h2>{node.title || '故事未必只有这一种可能。'}</h2>{run.checkpoints.length > 0 && <button className="sb-quiet-button" onClick={() => setHistory(true)}><RotateCcw size={15} />回到某个选择，再走一次</button>}</div>}
        {draft.status === 'error' && <div className="sb-notice" role="alert"><p>输入框的修改尚未同步到本机。{draft.error}</p><button className="sb-quiet-button" onClick={() => { void draft.session.flush().catch(() => undefined); }}>重试保存输入</button></div>}
        {error && <p className="sb-notice" role="alert">{error}</p>}
        <div ref={end} style={{ scrollMarginBottom: 180 }} />
        {canTalk && <div className="sb-experience-composer"><div className="sb-composer-inner"><textarea ref={textarea} aria-label="对角色说的话" placeholder={`对${name}说点什么，或描述你的行动…`} value={input} maxLength={6000} rows={2} disabled={stalled || required.length > 0} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} /><button aria-label="发送" title="发送" disabled={busy || stalled || !input.trim() || required.length > 0} onClick={() => { void send(); }}>{busy ? <LoaderCircle className="sb-spin" size={20} /> : <ArrowUp size={20} />}</button></div><div className="sb-composer-caption"><span><MessageCircle size={12} />你的话语，也会成为故事的一部分</span><span>Enter 发送 · Shift Enter 换行</span></div></div>}
        {lastDialogue?.context && <details className="sb-context-note"><summary>本轮上下文<ChevronDown size={12} /></summary><p>按需激活 {lastDialogue.context.activatedLore.length} 条设定，约 {lastDialogue.context.estimatedLoreTokens} tokens（估算）。{lastDialogue.context.omittedTurns > 0 ? `受上下文容量限制，本轮未发送最早的 ${lastDialogue.context.omittedTurns} 条记录；完整经历仍保存在本机。` : '本轮包含全部已有经历。'}</p></details>}
      </main>
    </div>
    {history && <dialog ref={historyDialog} className="sb-history-backdrop" aria-label="经历与回溯" onCancel={() => setHistory(false)} onClick={e => { if (e.target === e.currentTarget) setHistory(false); }}><aside className="sb-experience-history"><div className="sb-dialog-heading"><h2>那些可以重来的瞬间</h2><button className="sb-icon-button" aria-label="关闭经历" onClick={() => setHistory(false)}><X size={20} /></button></div><p className="sb-muted">从某个瞬间另走一路。这段经历会留在你的足迹里。</p>{run.checkpoints.length === 0 && <p className="sb-muted">{node?.end ? '这段体验已经结束，没有可回溯的选择或回应。你仍可以回看内容。' : '第一次回应之后，就能从这里回溯。'}</p>}{run.checkpoints.map((cp, index) => <button className="sb-history-step" key={cp.id} disabled={busy || stalled} onClick={async () => { try { const next = await forkSavedExperience(runId, cp.id); onFork(next.id); } catch (e) { setError(e instanceof Error ? e.message : '无法回溯。'); } }}><span>{String(index + 1).padStart(2, '0')}</span><strong>{run.events[cp.eventCount]?.kind === 'choice' ? substitute(cp.label, cp.roleId ? run.authority.cards[cp.roleId]?.card.data.name ?? '叙述者' : '叙述者', run.playerName) : cp.label}</strong><RotateCcw size={15} /></button>)}</aside></dialog>}
  </div>;
}
function flowTitle(run: ExperienceRun, nodeId?: string) {
  const module = run.authority.work.modules?.['nimi.storybook.flow'];
  const config = module?.config as { nodes?: { id: string; title?: string }[] } | undefined;
  return config?.nodes?.find(n => n.id === nodeId)?.title || '这一幕';
}
