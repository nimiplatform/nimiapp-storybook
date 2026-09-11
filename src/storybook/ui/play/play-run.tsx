import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  GitBranch,
  MessageCircle,
  Send,
  Sparkles,
  X,
  Settings2,
  RotateCcw,
  ChevronDown,
} from 'lucide-react';
import {
  findNode,
  generateChoicesForNode,
  appendTranscriptEntry,
  buildPlayNarrativeContext,
  processTurn,
  createRunEnvelope,
  deriveCandidateFromTurn,
  mintId,
  validatePreparedPackage,
  type Choice,
  type SourceTurnRequest,
} from '../../engine/index.js';
import {
  getImportedPackage,
  getRun,
  saveRun,
  listRuns,
  type RunRecord,
} from '../../store/storybook-store.js';
import { advanceStory, forkStory } from '../../engine/play-session.js';
import { runSceneText } from '../../ai/storybook-runtime.js';
import { coverOf, titleOf, beginStory, endingCountOf } from '../shared.js';

export function PlayRun({
  runId,
  onExit,
  onOpenSettings,
  onOpenRun,
}: {
  runId: string;
  onExit: () => void;
  onOpenSettings: () => void;
  onOpenRun: (runId: string) => void;
}) {
  const [record, setRecord] = useState<RunRecord | null>(() => getRun(runId));
  const [freeText, setFreeText] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [talk, setTalk] = useState(false);
  const [fontSize, setFontSize] = useState(19);
  const [night, setNight] = useState(false);
  const [showReading, setShowReading] = useState(false);
  const journal = useRef<HTMLDialogElement>(null);
  const storyRef = useRef<HTMLElement>(null);
  const book = record ? getImportedPackage(record.packageId) : null;
  const prepared = book?.package;
  const chapter = prepared?.playableChapters.find((c) => c.id === record?.run.chapterId);
  const node = chapter && record ? findNode(chapter, record.run.currentNodeId) : null;
  useEffect(() => {
    storyRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
  }, [record?.run.currentNodeId]);
  if (
    !record ||
    !book ||
    !prepared ||
    !chapter ||
    !node ||
    !validatePreparedPackage(prepared).valid
  )
    return (
      <div className="sb-page sb-empty">
        <BookOpen size={30} />
        <h2>这本故事暂时无法打开。</h2>
        <p>进度仍保存在本机，请重新导入完整故事文件。</p>
        <button className="sb-primary" onClick={onExit}>
          返回书架
        </button>
      </div>
    );
  const choices = generateChoicesForNode(chapter, node);
  const checkpoints = record.checkpoints ?? [];
  const currentTurnStart =
    record.transcript.entries
      .slice()
      .reverse()
      .find((e) => e.kind === 'enter-node')?.seq ?? 0;
  const conversation = record.transcript.entries.filter(
    (e) => e.seq > currentTurnStart && ['source-turn', 'free-text'].includes(e.kind),
  );
  const ended = record.run.status === 'ended';
  const discovered = new Set(
    listRuns(record.packageId)
      .filter((r) => r.run.status === 'ended')
      .map((r) => r.run.endingId),
  );
  const endingCount = endingCountOf(prepared);
  const progress = ended
    ? 100
    : Math.min(
        100,
        Math.round(
          (new Set(
            record.transcript.entries.filter((e) => e.kind === 'enter-node').map((e) => e.nodeId),
          ).size /
            chapter.nodes.length) *
            100,
        ),
      );
  async function persist(next: RunRecord) {
    await saveRun(next);
    setRecord(next);
  }
  async function choose(choice: Choice) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await persist(advanceStory(record!, chapter!, choice, new Date().toISOString()));
      setNotice(null);
      setFreeText('');
      setTalk(false);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '选择未能保存。');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function replay(id: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const fork = forkStory(record!, id, new Date().toISOString());
      await saveRun(fork);
      journal.current?.close();
      onOpenRun(fork.run.id);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : '暂时无法回到这条路。');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function sendFreeText() {
    if (!freeText.trim() || busyRef.current || ended) return;
    const text = freeText.trim();
    busyRef.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const now = new Date().toISOString();
      const inputRecord = {
        ...record!,
        transcript: appendTranscriptEntry(record!.transcript, {
          at: now,
          kind: 'free-text',
          detail: '你',
          text,
          nodeId: node!.id,
        }),
      };
      await persist(inputRecord);
      setFreeText('');
      const turnRef = mintId('turn');
      const context = buildPlayNarrativeContext({
        runId,
        turnRef,
        storySummary: prepared!.publicSummary,
        contentBoundaries: prepared!.contentBoundaries,
        publicCast: prepared!.publicCast,
        run: record!.run,
      });
      const request: SourceTurnRequest = {
        id: turnRef,
        runId,
        sourceId: node!.speaker || 'narrator',
        trigger: 'free-text',
        userText: text,
      };
      const outcome = await processTurn({
        request,
        context,
        envelope:
          record!.narrative ??
          createRunEnvelope({
            runId,
            projectId: record!.run.projectId,
            packageVersion: prepared!.truthPackageVersion,
          }),
        generate: async () => {
          const ai = await runSceneText({
            projectId: record!.run.projectId,
            contextLines: [
              ...context.scopes.canon,
              ...context.scopes.story,
              ...context.scopes.subject,
              `当前场景：${node!.text}`,
              `这些行动必须仍可执行：${choices.map((c) => c.label).join('；')}`,
              ...record!.transcript.entries
                .filter((e) => ['choice', 'source-turn', 'free-text'].includes(e.kind))
                .slice(-8)
                .map((e) => `${e.kind === 'source-turn' ? '角色' : '玩家'}：${e.text || e.detail}`),
              `玩家现在说：${text}`,
            ],
            instruction: `以当前场景中被问到的角色回应玩家，80至150字，只写对白，可标注说话人。保持角色鲜明的语气与意图，记住刚才的谈话与玩家选择。不要写动作、环境变化、内心旁白或未来事件；这些会改变已有选择的前置条件。禁止把文风意象当成事实，禁止补充未知的设备运转、角色记忆或世界规则。疑问可以回应为疑问，承诺只能是角色的信念。不要替玩家选路线，不提系统、模型或规则。`,
          });
          const current = getRun(runId) ?? inputRecord;
          await saveRun({ ...current, generationRuns: [...(current.generationRuns ?? []), ai.run] });
          if (ai.ok)
            return {
              ok: true as const,
              candidate: {
                spineEvents: [{ id: mintId('spine'), kind: 'dialogue' as const, text: ai.value }],
                stateChanges: [],
                metrics: {},
              },
            };
          return { ok: false as const, reason: ai.reason, message: ai.message };
        },
        provenance: { surface: 'play.free-text' },
      });
      const latest = getRun(runId) ?? inputRecord;
      if (outcome.status === 'REJECTED' || !outcome.record.coreOutput) {
        await persist({ ...latest, narrative: outcome.envelope });
        setFreeText(text);
        setNotice('这次对话没有接通。可以重试，或选择下方的行动继续故事。');
        return;
      }
      const reply = outcome.record.coreOutput.spineEvents.map((e) => e.text).join('\n');
      const candidate = deriveCandidateFromTurn({
        turnId: outcome.record.id,
        targetTruthRef: null,
        targetObjectFamily: 'feedback-rule',
        mutationType: 'add-feedback',
        proposedChange: { playerSteer: text, guardedOutput: reply, nodeId: node!.id },
      });
      await persist({
        ...latest,
        narrative: outcome.envelope,
        transcript: appendTranscriptEntry(latest.transcript, {
          at: new Date().toISOString(),
          kind: 'source-turn',
          detail: node!.speaker || '故事的回应',
          text: reply,
          nodeId: node!.id,
        }),
        promotionCandidates: [...(latest.promotionCandidates ?? []), candidate],
      });
    } catch (e) {
      setFreeText(text);
      setNotice(e instanceof Error ? e.message : '对话中断了，可以重试。');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  return (
    <div className={`sb-reader${night ? ' sb-reader--night' : ''}`}>
      <header className="sb-reader-bar">
        <button className="sb-quiet-button" onClick={onExit} disabled={busy}>
          <ArrowLeft size={17} />
          返回书架
        </button>
        <span className="sb-reader-book">
          <BookOpen size={16} />
          {titleOf(book)}
        </span>
        <div className="sb-reader-tools">
          <button
            className="sb-quiet-button"
            aria-expanded={showReading}
            onClick={() => setShowReading(!showReading)}
            aria-label="阅读设置"
          >
            Aa
          </button>
          <button className="sb-quiet-button" onClick={() => journal.current?.showModal()}>
            <GitBranch size={17} />
            <span>我的故事线</span>
            <span className="sb-count">{checkpoints.length}</span>
          </button>
        </div>
      </header>
      {showReading && (
        <div className="sb-reading-options">
          <span>字号</span>
          <button
            onClick={() => setFontSize(Math.max(16, fontSize - 1))}
            disabled={fontSize <= 16}
            aria-label="缩小字号"
          >
            A−
          </button>
          <span>{fontSize}</span>
          <button
            onClick={() => setFontSize(Math.min(25, fontSize + 1))}
            disabled={fontSize >= 25}
            aria-label="放大字号"
          >
            A+
          </button>
          <button aria-pressed={night} onClick={() => setNight(!night)}>
            {night ? '切换日间' : '切换夜读'}
          </button>
        </div>
      )}
      <div className="sb-reader-progress">
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className="sb-reader-layout">
        <aside className="sb-story-aside">
          {coverOf(book) ? (
            <img src={coverOf(book)} alt="" />
          ) : (
            <div className="sb-reader-type-cover">
              <BookOpen size={24} strokeWidth={1.2} />
              <strong>{titleOf(book)}</strong>
              <small>YOUR STORY</small>
            </div>
          )}
          <span className="sb-eyebrow">{ended ? 'THE END, FOR NOW' : 'YOU ARE IN THE STORY'}</span>
          <h2>{titleOf(book)}</h2>
          <p>{prepared.presentation?.playerRole}</p>
          <div className="sb-story-tags">
            {prepared.presentation?.themes.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
          <div className="sb-state-card">
            <small>你留下的影响</small>
            {Object.entries(record.run.variables).map(([id, value]) => (
              <div key={id}>
                <span>{prepared.presentation?.variableLabels[id] || id}</span>
                <strong>
                  {value > 0 ? '+' : ''}
                  {value}
                </strong>
              </div>
            ))}
            <p>
              <Check size={13} />
              进度已自动保存
            </p>
          </div>
        </aside>
        <article className="sb-story-paper" ref={storyRef} key={node.id}>
          <div className="sb-scene-meta">
            <span>
              {ended ? '属于你的结局' : `第 ${String(checkpoints.length + 1).padStart(2, '0')} 幕`}
            </span>
            <span>
              {ended
                ? '这一页，写下了你的选择'
                : node.speaker
                  ? `${node.speaker} 在场`
                  : '故事正在发生'}
            </span>
          </div>
          <h1>{node.title || chapter.title}</h1>
          <div className="sb-story-prose" style={{ fontSize }}>
            {node.text
              .split(/\n+/)
              .filter(Boolean)
              .map((p, i) => (
                <p key={i}>{p}</p>
              ))}
          </div>
          {conversation.length > 0 && (
            <div className="sb-conversation">
              {conversation.map((entry) => (
                <div
                  key={entry.seq}
                  className={
                    entry.kind === 'free-text' ? 'sb-conversation-you' : 'sb-conversation-reply'
                  }
                >
                  <small>{entry.kind === 'free-text' ? '你轻声说' : entry.detail}</small>
                  <p>{entry.text}</p>
                </div>
              ))}
            </div>
          )}
          {ended ? (
            <div className="sb-ending">
              <span className="sb-ending-ornament">
                <GitBranch size={24} strokeWidth={1} />
              </span>
              <h2>这是你选择的故事。</h2>
              <p>
                你已抵达 {discovered.size} / {endingCount} 种结局。另一条路，会带你去哪里？
              </p>
              <div className="sb-ending-path">
                {record.transcript.entries
                  .filter((e) => e.kind === 'choice')
                  .map((e) => (
                    <span key={e.seq}>{e.detail}</span>
                  ))}
              </div>
              <div className="sb-actions">
                <button
                  className="sb-primary"
                  onClick={() => journal.current?.showModal()}
                  disabled={!checkpoints.length}
                >
                  <GitBranch size={16} />
                  回到某个岔路
                </button>
                <button
                  className="sb-quiet-button"
                  onClick={async () => {
                    try {
                      onOpenRun(await beginStory(book));
                    } catch (e) {
                      setNotice(e instanceof Error ? e.message : '无法重新开始。');
                    }
                  }}
                >
                  <RotateCcw size={15} />
                  重新开始
                </button>
              </div>
            </div>
          ) : (
            <div className="sb-next">
              <div className="sb-choice-heading">
                <span>接下来，你会怎么做？</span>
                <small>选择，让故事发生</small>
              </div>
              <div className="sb-choices" data-testid="play-choices">
                {choices.map((choice, i) => (
                  <button
                    key={choice.id}
                    className="sb-choice-btn"
                    disabled={busy}
                    onClick={() => choose(choice)}
                  >
                    <span className="sb-choice-number">{String(i + 1).padStart(2, '0')}</span>
                    <span>{choice.label}</span>
                    <ArrowRight size={16} />
                  </button>
                ))}
              </div>
              <div className="sb-improv">
                <button
                  className="sb-improv-toggle"
                  aria-expanded={talk}
                  onClick={() => setTalk(!talk)}
                >
                  <MessageCircle size={16} />
                  我想说点别的<span>AI 即兴对话</span>
                  <ChevronDown size={15} />
                </button>
                {talk && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void sendFreeText();
                    }}
                  >
                    <label className="sb-sr-only" htmlFor="sb-freetext-input">
                      你想说的话
                    </label>
                    <textarea
                      id="sb-freetext-input"
                      maxLength={600}
                      value={freeText}
                      disabled={busy}
                      onChange={(e) => setFreeText(e.target.value)}
                      placeholder="问一个选项里没有的问题，或者说句心里话…"
                    />
                    <div>
                      <small>角色会回应你。故事仍由上方的选择推进。</small>
                      <button
                        type="submit"
                        aria-label="发送对话"
                        disabled={busy || !freeText.trim()}
                      >
                        {busy ? <Sparkles className="sb-pulse" size={18} /> : <Send size={18} />}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}
          {busy && (
            <p role="status" className="sb-ai-wait">
              <Sparkles size={15} />
              故事里的人正在回应你…
            </p>
          )}
          {notice && (
            <div role="alert" className="sb-notice">
              <p>{notice}</p>
              <button className="sb-quiet-button" onClick={onOpenSettings}>
                <Settings2 size={14} />
                检查 AI 连接
              </button>
            </div>
          )}
          <footer className="sb-reader-note">
            {ended
              ? '有些故事结束了，但留在心里的还在继续。'
              : '不必急。这个世界，会等你做出选择。'}
          </footer>
        </article>
      </div>
      <dialog
        ref={journal}
        className="sb-dialog sb-journal"
        onClick={(e) => {
          if (e.target === journal.current) journal.current.close();
        }}
      >
        <div className="sb-dialog-heading">
          <div>
            <span className="sb-eyebrow">EVERY CHOICE LEAVES A TRACE</span>
            <h2>我的故事线</h2>
          </div>
          <button
            className="sb-icon-button"
            aria-label="关闭故事线"
            onClick={() => journal.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        <p className="sb-muted">回到某个选择，走一条新的路。原来的经历会留在「我的足迹」。</p>
        <div className="sb-timeline">
          {checkpoints.map((point, i) => (
            <div className="sb-timeline-step" key={point.id}>
              <span className="sb-timeline-dot">{i + 1}</span>
              <div>
                <small>
                  {chapter.nodes.find((n) => n.id === point.run.currentNodeId)?.title || '故事岔路'}
                </small>
                <p>{point.label}</p>
                <button
                  className="sb-quiet-button"
                  disabled={busy}
                  onClick={() => replay(point.id)}
                >
                  从这里走另一条路
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          ))}
          <div className="sb-timeline-step">
            <span className="sb-timeline-dot is-current">
              <BookOpen size={14} />
            </span>
            <div>
              <small>你在这里</small>
              <p>{node.title || chapter.title}</p>
            </div>
          </div>
        </div>
      </dialog>
    </div>
  );
}
