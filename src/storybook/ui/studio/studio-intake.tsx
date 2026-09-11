import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Feather, FileText, Sparkles, Upload } from 'lucide-react';
import { getIntakeDraft } from '../../store/storybook-store.js';
import { intakeEditor } from '../../store/content-editors.js';
import { submitIntake } from '../../store/intake-submission.js';
import { useEditorSession } from '../use-editor-session.js';

const SEEDS = [
  {
    label: '一个不可能的来电',
    text: '凌晨三点，你接到自己的来电。电话那头的声音说，十分钟后会有人敲门，无论如何都不要打开。可门外传来的，是你已经去世三年的母亲的声音。她喊的是那个只有她知道的小名。',
  },
  {
    label: '记忆的旧书店',
    text: '这家旧书店出售的不是书，而是别人遗忘的记忆。你一直只是店里的整理员，直到某天，你在一叠待销毁的记忆中看到了自己的童年。它被标注为：从未发生。老板今天恰好不在。',
  },
  {
    label: '重逢的另一种可能',
    text: '你和十年未见的朋友约在老地方。对方准时出现，穿着十年前告别时的同一件外套。他不知道你们曾经分别，也不知道你们因为哪一句话再没有联系。桌上只有两杯刚泡好的茶。',
  },
];
const DIRECTIONS = ['忠于原文', '悬疑感更强', '更温柔的余韵', '让选择更两难'];
export function StudioIntake({
  onCreated,
  onCancel,
}: {
  onCreated: (projectId: string) => void;
  onCancel: () => void;
}) {
  const editor = useEditorSession(intakeEditor());
  const draft = editor.value;
  const submitting = Boolean(editor.operation);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  function editDraft(change: Partial<typeof draft>) {
    if (editor.session.getSnapshot().operation) return;
    void editor.session.update(current => ({ ...current, ...change })).catch(() => undefined);
  }
  async function submit() {
    setError(null);
    try { onCreated(await submitIntake()); }
    catch (e) { setError(e instanceof Error ? e.message : '草稿未能保存，请重试。'); }
  }
  return (
    <div className="sb-page sb-intake">
      <header className="sb-page-top">
        <button className="sb-quiet-button" onClick={() => { void editor.session.flushForNavigation().then(onCancel).catch(() => undefined); }}>
          <ArrowLeft size={16} />
          回到创作间
        </button>
        <span className="sb-eyebrow">FROM WORDS TO WORLDS</span>
      </header>
      <div className="sb-intake-heading">
        <span className="sb-intake-icon">
          <Feather size={26} strokeWidth={1.4} />
        </span>
        <h1>每个故事，都有另一种可能。</h1>
        <p>给我一段文字。我们一起把它变成一个可以走进去的世界。</p>
      </div>
      <div className="sb-intake-workspace" inert={submitting}>
        <section className="sb-writing-paper">
          <div className="sb-writing-top">
            <label htmlFor="sb-name" className="sb-sr-only">
              故事名称（可选）
            </label>
            <input
              id="sb-name"
              value={draft.name}
              maxLength={60}
              onChange={(e) => editDraft({ name: e.target.value })}
              placeholder="给故事起个名字，也可以晚点再想"
            />
            <button className="sb-quiet-button" onClick={() => fileInput.current?.click()}>
              <Upload size={14} />
              导入文字
            </button>
            <input
              hidden
              ref={fileInput}
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  if (file.size > 40 * 1024) throw new Error('请使用 8000 字以内的文本片段。');
                  const text = await file.text();
                  if (text.length > 8000) throw new Error('请使用 8000 字以内的文本片段。');
                  editDraft({
                    text,
                    name: editor.session.getSnapshot().value.name || file.name.replace(/\.(txt|md)$/i, ''),
                  });
                  setError(null);
                } catch (err) {
                  setError(err instanceof Error ? err.message : '读取失败。');
                }
              }}
            />
          </div>
          <label htmlFor="sb-text" className="sb-sr-only">
            故事原文
          </label>
          <textarea
            id="sb-text"
            value={draft.text}
            maxLength={8000}
            onChange={(e) => editDraft({ text: e.target.value })}
            placeholder={
              '粘贴一篇短篇、一段你喜欢的文字，\n或者，只是一个突然冒出来的念头。\n\n那天，事情本来不应该这样发生……'
            }
          />
          <div className="sb-writing-footer">
            <span>
              <FileText size={13} />
              {editor.status === 'saving' ? '正在保存草稿…' : editor.status === 'error' ? '草稿尚未保存' : getIntakeDraft() ? '草稿已保存在本机' : '输入后自动保存到本机'}
            </span>
            <span>{draft.text.length.toLocaleString()} / 8,000 字</span>
          </div>
        </section>
        <aside className="sb-intake-aside">
          <span className="sb-eyebrow">A LITTLE DIRECTION</span>
          <h3>想让故事往哪里走？</h3>
          <p>保留故事的灵魂，给体验一点方向。</p>
          <div className="sb-directions">
            {DIRECTIONS.map((d) => (
              <button
                key={d}
                aria-pressed={draft.direction === d}
                className={draft.direction === d ? 'is-active' : ''}
                onClick={() => editDraft({ direction: d })}
              >
                {d}
              </button>
            ))}
          </div>
          <div className="sb-creation-steps">
            <div>
              <span>01</span>
              <p>
                <strong>读懂故事</strong>
                <small>提炼世界、人物与隐藏的冲突</small>
              </p>
            </div>
            <div>
              <span>02</span>
              <p>
                <strong>一起定方向</strong>
                <small>看一眼 AI 的提案，由你拍板</small>
              </p>
            </div>
            <div>
              <span>03</span>
              <p>
                <strong>让选择发生</strong>
                <small>编排分支与结局，亲自走进去</small>
              </p>
            </div>
          </div>
        </aside>
      </div>
      {editor.status === 'error' && <div className="sb-notice" role="alert"><p>输入仍保留在这里。{editor.error}</p><button className="sb-quiet-button" onClick={() => { void editor.session.flush().catch(() => undefined); }}>重试保存</button></div>}
      {editor.notice && <p className="sb-notice" role="status">{editor.notice}</p>}
      {error && (
        <p className="sb-notice" role="alert">
          {error}
        </p>
      )}
      <div className="sb-intake-submit">
        <span>还没想好？从一个灵感开始</span>
        <button
          className="sb-primary"
          disabled={submitting || !draft.text.trim()}
          onClick={submit}
          data-testid="studio-intake-submit"
        >
          <Sparkles size={17} />
          {submitting ? '正在创建故事…' : '让故事开始生长'}
          <ArrowRight size={17} />
        </button>
      </div>
      <div className="sb-seed-grid" inert={submitting}>
        {SEEDS.map((seed) => (
          <button
            key={seed.label}
            onClick={() => {
              editDraft({ text: seed.text, name: seed.label });
              setError(null);
            }}
          >
            <span>{seed.label}</span>
            <p>{seed.text}</p>
            <ArrowRight size={15} />
          </button>
        ))}
      </div>
    </div>
  );
}
