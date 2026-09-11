import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  Feather,
  GitBranch,
  Play,
  Settings2,
  Sparkles,
  Users,
  BookOpen,
} from 'lucide-react';
import {
  buildPreparedPackage,
  validatePreparedPackage,
  buildStudioProjection,
  type FoundationDraft,
} from '../../engine/index.js';
import {
  saveImportedPackage,
  type StoredProjectRecord,
  type ImportedPackageRecord,
} from '../../store/storybook-store.js';
import { generateProjectFoundation, generateProjectChapter, approveProjectAndGenerate } from '../../ai/storybook-project.js';
import { projectEditor } from '../../store/content-editors.js';
import { beginStory } from '../shared.js';
import { StudioAdvanced } from './studio-advanced.js';
import { StudioPromotion } from './studio-promotion.js';
import { StudioPlaytest } from './studio-playtest.js';
import { useEditorSession } from '../use-editor-session.js';

type StudioTab = 'workbench' | 'playtest' | 'editor' | 'promotion';
const TABS: { value: StudioTab; label: string }[] = [
  { value: 'workbench', label: '故事设定' },
  { value: 'playtest', label: '分支与试玩' },
  { value: 'editor', label: '高级编辑' },
  { value: 'promotion', label: '创作记忆' },
];
const nowIso = () => new Date().toISOString();

// @nimi-authority: rule.storybook.ia.r007
export function StudioProject({
  projectId,
  onBack,
  onOpenSettings,
  onPlay,
}: {
  projectId: string;
  onBack: () => void;
  onOpenSettings: () => void;
  onPlay: (runId: string) => void;
}) {
  const editor = useEditorSession(projectEditor(projectId));
  const record = editor.value;
  const busy = editor.operation?.kind ?? null;
  const chapterPhase = editor.operation?.phase ?? 'writing';
  const started = useRef(false);
  const notice = editor.notice ?? record?.generationRuns?.at(-1)?.provenance.message ?? null;
  const setNotice = (message: string | null) => editor.session.setNotice(message ?? undefined);
  const [tab, setTab] = useState<StudioTab>('workbench');
  const [elapsed, setElapsed] = useState(0);
  const revisionNote = record?.revisionNote ?? '';
  useEffect(() => {
    if (!busy) return;
    const start = editor.operation!.startedAt;
    setElapsed(Math.floor((Date.now() - start) / 1000));
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [busy, editor.operation?.startedAt]);
  useEffect(() => {
    if (
      !started.current &&
      !editor.operation &&
      record?.sourceDraft &&
      !record.generationRuns?.length &&
      !record.foundationDraft
    ) {
      started.current = true;
      void draftFoundation();
    }
  }, []); // A retained draft is never regenerated merely by navigating back.
  async function saveAndSet(change: (current: StoredProjectRecord) => StoredProjectRecord) {
    await editor.session.update(current => {
      if (!current) throw new Error('找不到故事。');
      return change(current);
    });
  }
  async function draftFoundation() { try { await generateProjectFoundation(projectId); } catch (e) { setNotice(e instanceof Error ? e.message : '构思未完成。'); } }
  async function generateChapter(revise = false) { try { await generateProjectChapter(projectId, revise); setTab('playtest'); } catch (e) { setNotice(e instanceof Error ? e.message : '章节未完成。'); } }
  async function editDraft(field: keyof FoundationDraft, value: string) {
    try { await saveAndSet(current => current.foundationDraft ? ({
      ...current,
      foundationDraft: {
        ...current.foundationDraft,
        draft: { ...current.foundationDraft.draft, [field]: value },
      },
    }) : current); } catch (e) { setNotice(e instanceof Error ? e.message : '修改未能保存。'); }
  }
  async function approveAndGenerate() { try { await approveProjectAndGenerate(projectId); setTab('playtest'); } catch (e) { setNotice(e instanceof Error ? e.message : '设定未能确认。'); } }
  async function prepare(): Promise<ImportedPackageRecord> {
    if (editor.session.getSnapshot().operation) throw new Error('请等当前修订完成后再导出。');
    await editor.session.flush();
    const record = editor.session.getSnapshot().value;
    if (!record) throw new Error('找不到故事。');
    const built = buildPreparedPackage({
      pkg: record.truthPackage,
      producer: record.project.name,
      now: nowIso(),
    });
    if (!built.ok) throw new Error(built.pointers?.join('；') || built.message);
    if (!validatePreparedPackage(built.value).valid)
      throw new Error('故事还有未闭合的分支，请先在高级编辑中检查。');
    built.value.manifest.packageId = `${record.project.id}-v${record.truthPackage.version}`;
    const result: ImportedPackageRecord = {
      id: built.value.manifest.packageId,
      label: record.project.name,
      source: 'local-import',
      entryLabel: 'creator-provided',
      package: built.value,
      importedAt: nowIso(),
      sourceProjectId: projectId,
    };
    await saveImportedPackage(result);
    return result;
  }
  async function publish() {
    if (editor.session.getSnapshot().operation) return;
    try {
      const book = await prepare();
      onPlay(await beginStory(book));
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '故事未能放上书架。');
    }
  }
  async function exportStory() {
    try {
      const book = await prepare();
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(book.package, null, 2)], { type: 'application/json' }),
      );
      const a = document.createElement('a');
      a.href = url;
      a.download = `${record!.project.name.replace(/[\\/:*?"<>|]/g, '-')}.storybook.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '导出失败。');
    }
  }
  if (!record)
    return (
      <div className="sb-page sb-empty">
        <h2>找不到这个故事。</h2>
        <button className="sb-primary" onClick={onBack}>
          回到创作间
        </button>
      </div>
    );
  const pkg = record.truthPackage;
  const draft = record.foundationDraft?.draft;
  const studio = buildStudioProjection(pkg);
  const hasChapters = pkg.chapters.length > 0;
  const approved = pkg.bible?.approved;
  const cast = draft?.cast ?? pkg.sourceCast?.sources ?? [];
  const premise = draft?.premise ?? pkg.bible?.premise;
  return (
    <div className="sb-page sb-project">
      <header className="sb-page-top">
        <button className="sb-quiet-button" onClick={() => { void editor.session.flush().then(onBack).catch(() => undefined); }}>
          <ArrowLeft size={16} />
          创作间
        </button>
        <span className="sb-eyebrow">
          {busy ? 'IMAGINATION AT WORK' : 'YOUR STORY IS TAKING SHAPE'}
        </span>
      </header>
      <p className="sb-muted" role="status">{editor.status === 'saving' ? '正在保存修改…' : editor.status === 'error' ? '修改仍在当前页面，尚未保存到本机。' : '修改已保存在本机'}</p>
      {editor.status === 'error' && <div className="sb-notice" role="alert"><p>{editor.error}</p><button className="sb-quiet-button" onClick={() => { void editor.session.flush().catch(() => undefined); }}>重试保存</button></div>}
      <div className="sb-page-heading">
        <div>
          <h1>{draft?.title || record.project.name}</h1>
          <p>
            {hasChapters
              ? '人物已经就位。翻开故事，试试自己的选择。'
              : draft
                ? '这是 AI 读完原文后的一种想象。改成你喜欢的样子，再让故事发生。'
                : approved
                  ? '故事设定已确认，可以开始编排场景与分支。'
                  : '你的文字已保存。现在，让我们找出藏在里面的可能性。'}
          </p>
        </div>
        {hasChapters && (
          <button className="sb-primary" disabled={!!busy} onClick={publish}>
            <Play size={16} />
            放上书架并开玩
          </button>
        )}
      </div>
      <div className="sb-workflow">
        {['放入文字', '确认故事设定', '编排分支', '进入故事'].map((label, i) => {
          const stage = hasChapters ? 3 : approved || busy === 'chapter' ? 2 : 1;
          return (
            <div className={i < stage ? 'is-done' : i === stage ? 'is-current' : ''} key={label}>
              <span>{i < stage ? <Check size={13} /> : i + 1}</span>
              {label}
            </div>
          );
        })}
      </div>
      {busy && (
        <section className="sb-generation" role="status">
          <Sparkles size={26} className="sb-pulse" />
          <div>
            <h2>
              {busy === 'foundation'
                ? 'AI 正在读你的故事…'
                : busy === 'regeneration' ? '正在更新世界设定…' : chapterPhase === 'continuity'
                  ? '让每条路，都讲得通…'
                  : '你的故事，正在长出岔路…'}
            </h2>
            <p>
              {busy === 'foundation'
                ? '正在构思人物、玩家身份和故事里的两难抉择。'
                : busy === 'regeneration' ? '依据已采纳的偏好更新设定，原内容与编辑均保留。' : chapterPhase === 'continuity'
                  ? 'AI 正在沿着每条路线，检查道具、人物认知与因果。'
                  : '正在编写场景、具体行动与不同的结局。接下来还会检查剧情是否连贯。'}
            </p>
            <small>已等待 {elapsed} 秒 · 原文与已确认的设定均已保存</small>
          </div>
        </section>
      )}
      {notice && (
        <div role="alert" className="sb-notice">
          <p>{notice}</p>
          <button className="sb-quiet-button" onClick={onOpenSettings}>
            <Settings2 size={14} />
            设置与 AI
          </button>
        </div>
      )}
      {hasChapters && (
        <div className="sb-surface-switch" role="tablist" aria-label="Studio 工作区切换">
          {TABS.map((t) => (
            <button
              key={t.value}
              className={`sb-surface-switch__btn${tab === t.value ? ' sb-surface-switch__btn--active' : ''}`}
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => setTab(t.value)}
              data-testid={`studio-tab-${t.value}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      {tab === 'workbench' && (
        <>
          <div className="sb-foundation-grid">
            <section className="sb-foundation-main">
              <span className="sb-eyebrow">THE HEART OF THE STORY</span>
              <h2>{draft ? '你想讲的，是这样的故事吗？' : '故事的灵魂'}</h2>
              {draft ? (
                <>
                  <label className="sb-field">
                    故事名称
                    <input
                      className="sb-input"
                      value={draft.title}
                      onChange={(e) => editDraft('title', e.target.value)}
                      maxLength={60}
                    />
                  </label>
                  <label className="sb-field">
                    故事简介
                    <textarea
                      className="sb-textarea"
                      value={draft.premise}
                      onChange={(e) => editDraft('premise', e.target.value)}
                    />
                  </label>
                </>
              ) : (
                <p className="sb-foundation-premise">{premise}</p>
              )}
              <details className="sb-world-detail">
                <summary>世界与背景</summary>
                {draft ? (
                  <textarea
                    className="sb-textarea"
                    aria-label="世界设定"
                    value={draft.world}
                    onChange={(e) => editDraft('world', e.target.value)}
                  />
                ) : (
                  <p>{pkg.bible?.worldSummary}</p>
                )}
              </details>
              <div className="sb-foundation-detail">
                <BookOpen size={18} />
                <div>
                  <small>你将成为</small>
                  {draft ? (
                    <input
                      className="sb-input"
                      aria-label="玩家身份"
                      value={draft.playerRole}
                      onChange={(e) => editDraft('playerRole', e.target.value)}
                    />
                  ) : (
                    <p>{pkg.scenarioFrame?.playerPosition || '等待 AI 构思一个值得亲历的身份'}</p>
                  )}
                </div>
              </div>
              <div className="sb-foundation-detail">
                <GitBranch size={18} />
                <div>
                  <small>你的两难抉择</small>
                  {draft ? (
                    <textarea
                      className="sb-textarea"
                      aria-label="故事冲突"
                      value={draft.tension}
                      onChange={(e) => editDraft('tension', e.target.value)}
                    />
                  ) : (
                    <p>{pkg.adaptationBrief?.coreTension || '从你的原文中发现值得改变的岔路'}</p>
                  )}
                </div>
              </div>
              <div className="sb-foundation-detail">
                <Feather size={18} />
                <div>
                  <small>故事的声音</small>
                  {draft ? (
                    <input
                      className="sb-input"
                      aria-label="叙述风格"
                      value={draft.style}
                      onChange={(e) => editDraft('style', e.target.value)}
                    />
                  ) : (
                    <p>
                      {approved || hasChapters
                        ? pkg.bible?.styleFingerprint
                        : '等待你和 AI 定下叙述的声音'}
                    </p>
                  )}
                </div>
              </div>
            </section>
            <aside className="sb-cast-panel">
              <span className="sb-eyebrow">PEOPLE YOU WILL MEET</span>
              <h2>
                <Users size={18} />
                你会遇见的人
              </h2>
              {cast.map((c, i) => (
                <div className="sb-cast-card" key={c.name}>
                  <span className={`sb-cast-initial sb-cast-initial--${i % 3}`}>
                    {c.name.slice(0, 1)}
                  </span>
                  <div>
                    <h3>{c.name}</h3>
                    <p>{c.publicFacts.join('；')}</p>
                    <small>{c.voice}</small>
                    <details className="sb-character-notes">
                      <summary>动机与秘密 · 仅创作者可见</summary>
                      <p>想要：{c.goals.join('；')}</p>
                      <p>藏着：{c.privateFacts.join('；') || '没有额外秘密'}</p>
                    </details>
                  </div>
                </div>
              ))}
              {cast.length === 0 && <p className="sb-muted">等待人物从文字里走出来。</p>}
              <div className="sb-author-note">
                你是这个世界的作者。
                <br />
                AI 提供一种可能，最后由你决定。
              </div>
            </aside>
          </div>
          <div className="sb-review-actions">
            {draft ? (
              <>
                <button
                  className="sb-quiet-button"
                  disabled={!!busy}
                  onClick={() => void draftFoundation()}
                >
                  再给我一种构思
                </button>
                <button className="sb-primary" disabled={!!busy} onClick={approveAndGenerate}>
                  <Check size={16} />
                  确认设定，编排故事
                  <ArrowRight size={16} />
                </button>
              </>
            ) : !hasChapters ? (
              <button
                className="sb-primary"
                disabled={!!busy}
                onClick={() => (approved ? void generateChapter() : void draftFoundation())}
              >
                <Sparkles size={17} />
                {approved ? '开始编排故事' : '生成改编提案'}
                <ArrowRight size={16} />
              </button>
            ) : (
              <button className="sb-quiet-button" onClick={exportStory}>
                <Download size={16} />
                导出故事文件
              </button>
            )}
          </div>
        </>
      )}
      {tab === 'playtest' && (
        <>
          <div className="sb-chapter-overview">
            <div>
              <GitBranch size={20} />
              <h2>每条路，都能走到结局。</h2>
              <p>
                {pkg.chapters.flatMap((c) => c.nodes).length} 个场景 ·{' '}
                {pkg.stateEndingMatrix?.endings.length || 0} 种结局
              </p>
            </div>
            <div className="sb-chapter-scenes">
              {pkg.chapters
                .flatMap((c) => c.nodes)
                .map((n) => (
                  <span key={n.id} className={n.isEnding ? 'is-ending' : ''}>
                    {n.isEnding ? '结局 · ' : ''}
                    {n.title || n.id}
                  </span>
                ))}
            </div>
          </div>
          <StudioPlaytest key={pkg.version} record={record} />
          <label className="sb-revision-note">
            想让这个故事更好一点？
            <textarea
              className="sb-textarea"
              value={revisionNote}
              onChange={(e) => {
                const value = e.target.value;
                void saveAndSet(current => ({ ...current, revisionNote: value })).catch(e => setNotice(e instanceof Error ? e.message : '修改意见未能保存。'));
              }}
              maxLength={800}
              placeholder="比如：这段对话太直白了，让他有所隐瞒；或者某件道具已经用过，不应该再次出现。"
            />
          </label>
          <div className="sb-review-actions">
            <button
              className="sb-quiet-button"
              disabled={!!busy}
              onClick={() => void generateChapter(true)}
            >
              <Sparkles size={15} />
              优化故事逻辑
            </button>
            <button className="sb-quiet-button" onClick={exportStory}>
              <Download size={15} />
              导出故事
            </button>
            <button className="sb-primary" disabled={!!busy} onClick={publish}>
              放上书架并开玩
              <ArrowRight size={16} />
            </button>
          </div>
        </>
      )}
      {tab === 'editor' && <StudioAdvanced record={record} busy={Boolean(editor.operation)} onUpdate={saveAndSet} />}
      {tab === 'promotion' && <StudioPromotion record={record} onUpdate={saveAndSet} />}
      <details className="sb-source-detail">
        <summary>查看原文与创作记录</summary>
        <pre>{record.sourceDraft?.text || pkg.scenarioFrame?.background}</pre>
        <p>改编方向：{record.sourceDraft?.direction || '自定义'}</p>
        <p>
          故事完整性：
          {studio.payload.validation.valid
            ? '通过当前阶段检查'
            : studio.payload.validation.findings.map((f) => f.message).join('；')}
        </p>
        <p>真实 AI 请求：{record.generationRuns?.length ?? 0} 次</p>{record.generationRuns?.filter(run => run.result).map(run => <details key={run.id}><summary>{run.result!.kind === 'story-foundation' ? '生成的提案' : '生成的章节'} · {new Date(run.provenance.at).toLocaleString()}</summary><pre>{JSON.stringify(run.result!.value, null, 2)}</pre></details>)}
      </details>
    </div>
  );
}
