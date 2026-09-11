import { ArrowRight, Feather, Plus, BookOpen, FileText } from 'lucide-react';
import { listProjects, listDocuments, listWorkDrafts } from '../../store/storybook-store.js';
import { relativeDate } from '../shared.js';
export function StudioHome({
  onNewProject,
  onNewExperience,
  onEditExperience,
  onResumeDraft,
  onOpenProject,
}: {
  onNewProject: () => void;
  onNewExperience: () => void;
  onEditExperience: (documentId: string) => void;
  onResumeDraft: (documentId: string) => void;
  onOpenProject: (projectId: string) => void;
}) {
  const projects = listProjects();
  const drafts = listWorkDrafts();
  return (
    <div className="sb-page sb-studio-home">
      <header className="sb-page-top">
        <span className="sb-eyebrow">THE AUTHOR IN YOU</span>
        <span className="sb-muted">STUDIO</span>
      </header>
      <div className="sb-page-heading">
        <div>
          <h1>让想象，长出一个世界。</h1>
          <p>这里是你的创作间。一个念头，也能成为一场值得亲历的故事。</p>
        </div>
      </div>
      <section className="sb-studio-invite">
        <div>
          <span className="sb-eyebrow">YOUR WORDS. THEIR WORLD.</span>
          <h2>
            故事由你开始。
            <br />
            剩下的，我们一起想象。
          </h2>
          <p>
            带来角色、世界和想法，编排属于你的体验，
            <br />
            让每一次相遇，都有不同的可能。
          </p>
          <button className="sb-primary" onClick={onNewExperience}>
            <Plus size={18} />
            新建体验作品
            <ArrowRight size={16} />
          </button>
          <button className="sb-quiet-button sb-studio-secondary" onClick={onNewProject}><FileText size={16} />从叙事文本改编</button>
        </div>
        <div className="sb-studio-art">
          <img src="./stories/garden.jpg" alt="雨夜中亮着温暖灯光的故事小店" />
          <span>
            <Feather size={16} />
            有些世界，还在等你写下第一句。
          </span>
        </div>
      </section>
      {drafts.length > 0 && <section className="sb-studio-works"><div className="sb-section-title"><h2>继续草稿</h2><span>每份作品的修改独立保存</span></div><div className="sb-project-list">{drafts.map(draft => {
        let title = '尚未命名的草稿';
        try {
          const parsed: unknown = JSON.parse(draft.text);
          if (parsed && typeof parsed === 'object' && 'title' in parsed && typeof parsed.title === 'string' && parsed.title.trim()) title = parsed.title;
        } catch { /* Incomplete JSON remains an editable draft. */ }
        return <button key={draft.documentId} onClick={() => onResumeDraft(draft.documentId)}><FileText size={24} /><div><h3>{title}</h3><p>继续编辑尚未发布的修改</p></div><small>{relativeDate(draft.updatedAt)}</small><ArrowRight size={17} /></button>;
      })}</div></section>}
      {listDocuments('work').length > 0 && <section className="sb-studio-works"><div className="sb-section-title"><h2>我的体验作品</h2><span>角色可以换，世界可以延展</span></div><div className="sb-project-list">{listDocuments('work').map(d => d.kind === 'work' && <button key={d.id} onClick={() => onEditExperience(d.id)}><Feather size={24} /><div><h3>{d.data.title}</h3><p>{drafts.some(draft => draft.documentId === d.id) ? '有尚未发布的修改 · 继续编辑' : d.data.summary || '独立 Storybook 作品'}</p></div><ArrowRight size={17} /></button>)}</div></section>}
      <div className="sb-section-title">
        <h2>我的创作</h2>
        <span>{projects.length} 个故事</span>
      </div>
      {projects.length === 0 ? (
        <div className="sb-studio-empty">
          <FileText size={28} strokeWidth={1.2} />
          <div>
            <h3>第一张白纸，已经为你铺好。</h3>
            <p>草稿、人物提案和已完成的故事，都会保存在这里。</p>
          </div>
          <button className="sb-quiet-button" onClick={onNewProject}>
            提起笔
            <ArrowRight size={15} />
          </button>
        </div>
      ) : (
        <div className="sb-project-list">
          {projects.map((r) => (
            <button key={r.project.id} onClick={() => onOpenProject(r.project.id)}>
              <span className="sb-project-icon">
                <BookOpen size={23} strokeWidth={1.3} />
              </span>
              <div>
                <h3>{r.project.name}</h3>
                <p>{r.truthPackage.bible?.premise || r.sourceDraft?.text.slice(0, 60)}</p>
              </div>
              <span className="sb-status">
                {r.truthPackage.chapters.length
                  ? '可以试玩'
                  : r.truthPackage.bible?.approved
                    ? '等待编排'
                    : r.foundationDraft
                      ? '等待你确认'
                      : '创作草稿'}
              </span>
              <small>{relativeDate(r.project.updatedAt)}</small>
              <ArrowRight size={17} />
            </button>
          ))}
        </div>
      )}
      <footer className="sb-page-footer">
        <Feather size={14} />
        <span>不需要懂代码。只需要有一个想讲的故事。</span>
      </footer>
    </div>
  );
}
