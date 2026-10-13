import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@nimiplatform/kit/ui';
import { useAppStore } from './app-store.js';
import { runStorybookBootstrap } from '../infra/storybook-bootstrap.js';

// @nimi-authority: rule.storybook.ia.r006
// Local books need no authenticated session. Runtime operations still use the
// Desktop-supervised standard bridge and their existing readiness checks.
export function AuthProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    void runStorybookBootstrap();
  }, []);
  return <>{children}</>;
}

export function SessionSettings() {
  const auth = useAppStore((s) => s.auth);
  const ready = useAppStore((s) => s.bootstrapReady);
  const error = useAppStore((s) => s.bootstrapError);
  const [retrying, setRetrying] = useState(false);
  const connected = ready && auth.status === 'authenticated' && !error;
  async function retry() {
    setRetrying(true);
    try {
      await runStorybookBootstrap({ force: true });
    } finally {
      setRetrying(false);
    }
  }
  return (
    <section className={`sb-session-card${connected ? ' is-connected' : ''}`}>
      <span className={`sb-connection-dot${connected ? ' is-connected' : ''}`} />
      <div className="sb-session-card__body">
        <strong>{connected ? '已连接 Nimi' : '未连接 Nimi'}</strong>
        <p>
          {connected
            ? 'AI 改编、分支编排和角色对话均可使用。'
            : '从 Nimi Desktop 打开 Storybook 即可使用 AI。已有的故事和草稿仍可在本机阅读与编辑。'}
        </p>
        {!connected && (
          <div className="sb-session-card__actions">
            <Button tone="secondary" size="sm" loading={retrying} onClick={() => void retry()}>
              重新检查连接
            </Button>
            <details>
              <summary>技术详情</summary>
              <p>Storybook 不提供自登录或自授权入口。</p>
              <code>
                {error || auth.reasonCode} · {auth.actionHint}
              </code>
            </details>
          </div>
        )}
      </div>
    </section>
  );
}
