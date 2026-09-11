import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, GitBranch, Search, Upload, Footprints } from 'lucide-react';
import { CURATED_STORIES, buildCuratedPackage } from '../../content/library.js';
import { validatePreparedPackage, type PreparedStorybookPackage } from '../../engine/index.js';
import {
  listImportedPackages,
  saveImportedPackage,
  listRuns,
  type ImportedPackageRecord,
} from '../../store/storybook-store.js';
import { ContentImport } from '../protocol/content-import.js';
import { CollectionShelf } from '../protocol/collection-shelf.js';
import { listDocuments, listExperienceRuns } from '../../store/storybook-store.js';
import { beginStory, titleOf, coverOf, relativeDate, endingCountOf } from '../shared.js';

export function PlayHome({
  onStartRun,
  onOpenDocument,
  onExperienceRun,
  filter = 'all',
}: {
  onStartRun: (runId: string) => void;
  onOpenDocument: (id: string) => void;
  onExperienceRun: (id: string) => void;
  filter?: 'all' | 'continue';
}) {
  const [packages, setPackages] = useState<ImportedPackageRecord[]>(() => listImportedPackages());
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState('全部');
  const [error, setError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  useEffect(() => {
    let active = true;
    const seed = async () => {
    try {
      for (const story of CURATED_STORIES) {
        if (listImportedPackages().some((r) => r.id === `storybook-${story.id}`)) continue;
        const now = new Date().toISOString();
        const built = buildCuratedPackage(story, now);
        if (!built.ok) throw new Error(built.message);
        const report = validatePreparedPackage(built.value);
        if (!report.valid) throw new Error('故事文件未通过完整性检查。');
        await saveImportedPackage({
          id: built.value.manifest.packageId,
          label: story.title,
          source: 'official',
          entryLabel: 'recommended',
          package: built.value,
          importedAt: now,
        });
      }
      if (active) setPackages(listImportedPackages());
    } catch (e) {
      setError(e instanceof Error ? e.message : '书架暂时无法载入。');
    }
    };
    void seed();
    return () => { active = false; };
  }, []);
  const runs = useMemo(() => listRuns(), [packages]);
  const libraryBooks = packages.filter(
    (book, index) =>
      !book.sourceProjectId ||
      packages.findIndex((other) => other.sourceProjectId === book.sourceProjectId) === index,
  );
  const featured = libraryBooks[0];
  const activeRuns = runs.filter((r) => r.run.status === 'active');
  const matchingRuns = (filter === 'continue' ? runs : activeRuns).filter(run => {
    const book = packages.find(p => p.id === run.packageId);
    return book && [titleOf(book), book.package.publicSummary, ...book.package.publicCast.map(c => c.name)].join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  });
  const genres = [
    '全部',
    ...new Set(libraryBooks.flatMap((r) => r.package.presentation?.themes.slice(0, 1) ?? [])),
  ];
  const visible = libraryBooks.filter(
    (r) =>
      (genre === '全部' || r.package.presentation?.themes.includes(genre)) &&
      `${titleOf(r)} ${r.package.publicSummary}`.toLowerCase().includes(query.toLowerCase()),
  );
  async function start(record: ImportedPackageRecord) {
    try {
      onStartRun(await beginStory(record));
    } catch (e) {
      setError(e instanceof Error ? e.message : '暂时无法打开故事。');
    }
  }
  async function importPackage(text: string) {
    const parsed: unknown = JSON.parse(text);
    const report = validatePreparedPackage(parsed);
    if (!report.valid) throw new Error('故事文件未通过完整性检查。');
    const prepared = parsed as PreparedStorybookPackage;
    if (listImportedPackages().some(r => r.id === prepared.manifest.packageId)) throw new Error('这份故事已经在书架上了。');
    await saveImportedPackage({ id: prepared.manifest.packageId, label: prepared.presentation?.title || prepared.publicSummary.slice(0, 30), source: 'local-import', entryLabel: 'friend-provided', package: prepared, importedAt: new Date().toISOString() });
    setPackages(listImportedPackages());
    setImportOpen(false);
  }

  return (
    <div className="sb-library sb-page">
      <header className="sb-page-top">
        <span className="sb-eyebrow">
          {filter === 'continue' ? 'THE PATHS YOU HAVE TAKEN' : 'A LITTLE ESCAPE, A DIFFERENT YOU'}
        </span>
        <div className="sb-library-header-actions">
            <label className="sb-search">
              <Search size={15} />
              <input
                aria-label="搜索角色、世界或作品"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索角色、世界或作品…"
              />
            </label>
        <button
          className="sb-quiet-button"
          onClick={() => {
            setError(null);
            setImportOpen(true);
          }}
        >
          <Upload size={15} />
          导入角色或作品
        </button>
        </div>
      </header>
      <div className="sb-page-heading">
        <div>
          <h1>{filter === 'continue' ? '那些走过的故事。' : '下一页，由你决定。'}</h1>
          <p>
            {filter === 'continue'
              ? '每一个选择，都为你留下了一条独一无二的路。'
              : '走进别人的世界，留下自己的故事。'}
          </p>
        </div>
        {filter === 'all' && (
          <span className="sb-library-count">
            {(libraryBooks.length + listDocuments().length).toString().padStart(2, '0')} <span>个等待发生的世界</span>
          </span>
        )}
      </div>
      {filter === 'all' && <section className="sb-import-invitation"><div><span className="sb-eyebrow">YOUR CHARACTERS. YOUR WORLDS.</span><h2>一张角色卡，就能开启新的可能。</h2><p>带来喜欢的角色、世界资料，或一整套自己编排的体验。</p></div><button className="sb-primary" onClick={() => setImportOpen(true)}><Upload size={17} />带一个世界进来</button></section>}
      {error && !importOpen && (
        <p role="alert" className="sb-notice">
          {error}
        </p>
      )}
      {filter === 'all' && featured && listDocuments().length === 0 && (
        <section
          className="sb-featured"
          style={coverOf(featured) ? { backgroundImage: `url(${coverOf(featured)})` } : undefined}
        >
          <div className="sb-featured-shade" />
          <div className="sb-featured-copy">
            <span className="sb-featured-kicker">
              <span />
              从这里开始 · STORY NO. 01
            </span>
            <div className="sb-featured-genre">
              {featured.package.presentation?.themes.join(' / ')}
            </div>
            <h2>{titleOf(featured)}</h2>
            <p>{featured.package.publicSummary}</p>
            <div className="sb-featured-meta">
              <span>
                <BookOpen size={14} />
                {featured.package.playableChapters.flatMap((chapter) => chapter.nodes).length}{' '}
                个场景
              </span>
              <span>
                <GitBranch size={14} />
                {endingCountOf(featured.package)} 种结局
              </span>
            </div>
            <button className="sb-primary sb-primary--cream" onClick={() => start(featured)}>
              翻开故事
              <ArrowRight size={17} />
            </button>
          </div>
          <span className="sb-featured-caption">
            {featured.package.presentation?.playerRole || '翻开故事，成为故事里的人。'}
          </span>
        </section>
      )}
      <CollectionShelf filter={filter} query={query} onOpen={onOpenDocument} onResume={onExperienceRun} />
      {(filter === 'continue' || activeRuns.length > 0) && (
        <section className="sb-footprints">
          <div className="sb-section-title">
            <h2>{filter === 'continue' ? '你的故事足迹' : '故事还在等你'}</h2>
            <span>{filter === 'continue' ? `${matchingRuns.length} 段经历` : '接着上一次的选择'}</span>
          </div>
          {(filter === 'continue' ? matchingRuns : matchingRuns.slice(0, 2)).map((r) => {
            const book = packages.find((p) => p.id === r.packageId);
            if (!book) return null;
            const node = book.package.playableChapters
              .flatMap((c) => c.nodes)
              .find((n) => n.id === r.run.currentNodeId);
            return (
              <button className="sb-resume" key={r.run.id} onClick={() => onStartRun(r.run.id)}>
                {coverOf(book) ? <img src={coverOf(book)} alt="" /> : <BookOpen size={25} />}
                <span>
                  <strong>{titleOf(book)}</strong>
                  <small>
                    {node?.title || (r.run.status === 'ended' ? '故事已结束' : '故事进行中')}
                    {r.forkedFrom ? ' · 另一条路' : ''}
                  </small>
                </span>
                <span className="sb-resume-time">{relativeDate(r.run.updatedAt)}</span>
                <span className="sb-resume-action">
                  {r.run.status === 'ended' ? '回看结局' : '继续故事'}
                  <ArrowRight size={16} />
                </span>
              </button>
            );
          })}
          {filter === 'continue' && query.trim() && runs.length > 0 && matchingRuns.length === 0 && <p className="sb-muted" role="status">没有匹配的故事经历，换个名称试试。</p>}
          {runs.length === 0 && listExperienceRuns().length === 0 && (
            <div className="sb-empty">
              <Footprints size={32} strokeWidth={1} />
              <h3>第一段足迹，从翻开一本书开始。</h3>
              <p>故事会自动记住你走到哪里。</p>
              {featured && (
                <button className="sb-primary" onClick={() => start(featured)}>
                  开始我的第一个故事
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
          )}
        </section>
      )}
      {filter === 'all' && (
        <section>
          <div className="sb-section-title">
            <h2>挑一个世界，暂住片刻</h2>
            <span>精选原创</span>
          </div>
          <div className="sb-library-tools">
            <div className="sb-filter-row" aria-label="故事题材">
              {genres.map((g) => (
                <button
                  key={g}
                  onClick={() => setGenre(g)}
                  className={genre === g ? 'is-active' : ''}
                  aria-pressed={genre === g}
                >
                  {g === '全部' ? '全部故事' : g}
                </button>
              ))}
            </div>

          </div>
          <div className="sb-book-grid">
            {visible.map((book, i) => (
              <button className="sb-book" key={book.id} onClick={() => start(book)}>
                <div className={`sb-book-art sb-book-art--${i % 3}`}>
                  {coverOf(book) ? (
                    <img src={coverOf(book)} alt="" />
                  ) : (
                    <span className="sb-typographic-cover">{titleOf(book)}</span>
                  )}
                  <span className="sb-book-origin">
                    {book.source === 'official' ? 'STORYBOOK ORIGINAL' : '独立创作'}
                  </span>
                  <span className="sb-book-open">
                    <ArrowRight size={18} />
                  </span>
                </div>
                <div className="sb-book-body">
                  <div className="sb-book-themes">
                    {book.package.presentation?.themes.join(' · ') || '互动故事'}
                  </div>
                  <h3>{titleOf(book)}</h3>
                  <p>{book.package.publicSummary}</p>
                  <div className="sb-book-footer">
                    <span>
                      <GitBranch size={13} />
                      {endingCountOf(book.package)} 种结局
                    </span>
                    <span>{book.package.presentation?.playerRole || '以你的视角'}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
          {visible.length === 0 && (
            <div className="sb-empty">
              <Search size={24} />
              <p>还没有找到这个故事，换一个词试试。</p>
            </div>
          )}
        </section>
      )}
      <footer className="sb-page-footer">
        <BookOpen size={14} />
        <span>你带来的世界，会因你的参与而不同。</span>
        <span>POWERED BY NIMI</span>
      </footer>
      {importOpen && <ContentImport onClose={() => setImportOpen(false)} onPrepared={importPackage} onImported={(id) => { setImportOpen(false); onOpenDocument(id); }} />}
    </div>
  );
}
