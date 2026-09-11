import { useEffect, useState } from 'react';
import './protocol/protocol.css';
import { BookOpen, Compass, Feather, Footprints, Settings2, X, ArrowUpRight } from 'lucide-react';
import { StorybookAiModelConfigSection } from '../../shell/ai/storybook-ai-model-config-section.js';
import { SessionSettings } from '../../shell/app-shell/auth-provider.js';
import { useAppStore } from '../../shell/app-shell/app-store.js';
import { PlayHome } from './play/play-home.js';
import { PlayRun } from './play/play-run.js';
import { StudioHome } from './studio/studio-home.js';
import { StudioIntake } from './studio/studio-intake.js';
import { StudioProject } from './studio/studio-project.js';

import { ExperienceSetup } from './protocol/experience-setup.js';
import { ExperiencePlay } from './protocol/experience-play.js';
import { WorkEditor } from './protocol/work-editor.js';
import type { StorybookWork } from '../engine/protocol/types.js';
import { mintId } from '../engine/ids.js';
import { flushStorybookEditors } from './use-editor-session.js';
import { hasPendingExperienceWork } from '../ai/storybook-experience.js';
import { hasPendingEditorWork } from '../store/editor-session.js';

import { initializeStorybookStore, isStorybookStoreReady } from '../store/native-repository.js';
import { createStorybookFileBackend } from '../../shell/infra/storybook-file-storage.js';

type Surface = 'play' | 'studio';
type PlayView =
  | { screen: 'library'; filter: 'all' | 'continue' }
  | { screen: 'run'; runId: string }
  | { screen: 'experience-setup'; documentId: string }
  | { screen: 'experience-run'; runId: string };
type StudioView =
  | { screen: 'projects' }
  | { screen: 'intake' }
  | { screen: 'project'; projectId: string }
  | { screen: 'work'; documentId: string; initial?: StorybookWork };

// @nimi-authority: rule.storybook.ia.r001
export function StorybookApp() {
  const [contentReady, setContentReady] = useState(false);
  const [contentError, setContentError] = useState('');
  function openContent() { setContentError(''); void initializeStorybookStore(createStorybookFileBackend()).then(() => setContentReady(true)).catch(() => setContentError('请通过 Nimi 打开 Storybook，以访问 App 的本机内容库。若已在 App 中，请恢复 Nimi 连接后重试。')); }
  useEffect(() => { openContent(); }, []);
  useEffect(() => {
    const preserveResult = (event: BeforeUnloadEvent) => { if (hasPendingExperienceWork() || hasPendingEditorWork()) event.preventDefault(); };
    window.addEventListener('beforeunload', preserveResult);
    return () => window.removeEventListener('beforeunload', preserveResult);
  }, []);
  const [surface, setSurface] = useState<Surface>('play');
  const [playView, setPlayView] = useState<PlayView>({ screen: 'library', filter: 'all' });
  const [studioView, setStudioView] = useState<StudioView>({ screen: 'projects' });
  const [settings, setSettings] = useState(false);
  const [navigationError, setNavigationError] = useState('');
  function navigate(action: () => void) { void flushStorybookEditors().then(() => { setNavigationError(''); action(); }).catch(() => setNavigationError('修改尚未保存，已留在当前页面。请重试保存或先导出。')); }
  function openSettings() { navigate(() => setSettings(true)); }
  const connected = useAppStore(
    (s) => s.bootstrapReady && !s.bootstrapError && s.auth.status === 'authenticated',
  );
  const reading = !settings && surface === 'play' && (playView.screen === 'run' || playView.screen === 'experience-run');
  function library(filter: 'all' | 'continue') {
    navigate(() => { setSettings(false); setSurface('play'); setPlayView({ screen: 'library', filter }); });
  }
  if (!contentReady || !isStorybookStoreReady()) return <div className="sb-page sb-content-loading"><BookOpen size={30} strokeWidth={1.2} /><p>{contentError || '正在打开你的世界…'}</p>{contentError && <button className="sb-primary" onClick={openContent}>重新打开</button>}</div>;
  return (
    <div className={`sb-app${reading ? ' sb-app--reading' : ''}`} data-testid="storybook-app">
      {!reading && (
        <aside className="sb-sidebar">
          <button className="sb-brand" onClick={() => library('all')} aria-label="Storybook 书架">
            <BookOpen size={27} strokeWidth={1.6} />
            <span>
              storybook<span className="sb-brand-dot">.</span>
            </span>
          </button>
          <div className="sb-sidebar-label">你的故事宇宙</div>
          <nav className="sb-nav" aria-label="主导航">
            <button
              className={
                surface === 'play' && playView.screen === 'library' && playView.filter === 'all'
                  ? 'is-active'
                  : ''
              }
              data-testid="surface-play"
              onClick={() => library('all')}
            >
              <Compass size={19} />
              发现故事
            </button>
            <button
              className={
                surface === 'play' &&
                playView.screen === 'library' &&
                playView.filter === 'continue'
                  ? 'is-active'
                  : ''
              }
              onClick={() => library('continue')}
            >
              <Footprints size={19} />
              我的足迹
            </button>
            <div className="sb-nav-divider" />
            <button
              className={surface === 'studio' ? 'is-active' : ''}
              data-testid="surface-studio"
              onClick={() => navigate(() => {
                setSettings(false);
                setSurface('studio');
              })}
            >
              <Feather size={19} />
              创作间<span className="sb-nav-note">Studio</span>
            </button>
          </nav>
          <div className="sb-sidebar-note">
            <span>故事没有唯一的读法。</span>
            <p>
              你走过的那条路，
              <br />
              才是你的故事。
            </p>
            <BookOpen size={22} strokeWidth={1} />
          </div>
          <div className="sb-sidebar-bottom">
            <button className="sb-settings-link" onClick={openSettings}>
              <Settings2 size={18} />
              设置与 AI
              <ArrowUpRight size={14} />
            </button>
            <span className="sb-connection">
              <i className={connected ? 'is-connected' : ''} />
              {connected ? 'Nimi 已连接' : '本地阅读'}
              <span>PRE-ALPHA</span>
            </span>
          </div>
        </aside>
      )}
      <main className="sb-main">
        {navigationError && <p className="sb-notice" role="alert">{navigationError}</p>}
        {settings ? (
          <div className="sb-page sb-settings-page">
            <div className="sb-dialog-heading">
              <div>
                <span className="sb-eyebrow">MAKE ROOM FOR IMAGINATION</span>
                <h2>设置与 AI</h2>
              </div>
              <button
                className="sb-icon-button"
                aria-label="关闭设置"
                onClick={() => setSettings(false)}
              >
                <X size={20} />
              </button>
            </div>
            <SessionSettings />
            <StorybookAiModelConfigSection />
          </div>
        ) : surface === 'play' ? (
          playView.screen === 'library' ? (
            <PlayHome
              filter={playView.filter}
              onOpenDocument={(documentId) => setPlayView({ screen: 'experience-setup', documentId })}
              onExperienceRun={(runId) => setPlayView({ screen: 'experience-run', runId })}
              onStartRun={(runId) => setPlayView({ screen: 'run', runId })}
            />
          ) : playView.screen === 'experience-setup' ? (
            <ExperienceSetup key={playView.documentId} documentId={playView.documentId} onBack={() => library('all')} onStart={(runId) => setPlayView({ screen: 'experience-run', runId })} onCreate={(initial) => { setSurface('studio'); setStudioView({ screen: 'work', documentId: mintId('document'), initial }); }} />
          ) : playView.screen === 'experience-run' ? (
            <ExperiencePlay key={playView.runId} runId={playView.runId} onBack={() => library('all')} onSettings={openSettings} onFork={(runId) => setPlayView({ screen: 'experience-run', runId })} />
          ) : (
            <PlayRun
              key={playView.runId}
              runId={playView.runId}
              onExit={() => library('all')}
              onOpenSettings={openSettings}
              onOpenRun={(runId) => setPlayView({ screen: 'run', runId })}
            />
          )
        ) : studioView.screen === 'projects' ? (
          <StudioHome
            onNewProject={() => setStudioView({ screen: 'intake' })}
            onNewExperience={() => setStudioView({ screen: 'work', documentId: mintId('document') })}
            onEditExperience={(documentId) => setStudioView({ screen: 'work', documentId })}
            onResumeDraft={(documentId) => setStudioView({ screen: 'work', documentId })}
            onOpenProject={(projectId) => setStudioView({ screen: 'project', projectId })}
          />
        ) : studioView.screen === 'intake' ? (
          <StudioIntake
            onCreated={(projectId) => setStudioView({ screen: 'project', projectId })}
            onCancel={() => setStudioView({ screen: 'projects' })}
          />
        ) : studioView.screen === 'work' ? (
          <WorkEditor key={studioView.documentId} documentId={studioView.documentId} initial={studioView.initial} onBack={() => setStudioView({ screen: 'projects' })} onPublished={(documentId) => { setSurface('play'); setStudioView({ screen: 'projects' }); setPlayView({ screen: 'experience-setup', documentId }); }} />
        ) : (
          <StudioProject
            key={studioView.projectId}
            projectId={studioView.projectId}
            onBack={() => setStudioView({ screen: 'projects' })}
            onOpenSettings={openSettings}
            onPlay={(runId) => {
              setSurface('play');
              setPlayView({ screen: 'run', runId });
            }}
          />
        )}
      </main>
    </div>
  );
}
