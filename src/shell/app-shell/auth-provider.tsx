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
    <section className="sb-session-card">
      <div>
        <span className={`sb-connection-dot${connected ? ' is-connected' : ''}`} />
        {connected ? '已连接 Nimi' : '连接你的 AI 搭档'}
      </div>
      <p>
        {connected
          ? '在下方选择叙事模型，就可以改编故事、编排分支，也可以在游玩时与角色交谈。'
          : '从 Nimi Desktop 打开 Storybook，即可使用 AI 创作与角色对话。已有故事和创作草稿仍可在本机使用。'}
      </p>
      <Button tone="secondary" size="sm" loading={retrying} onClick={() => void retry()}>
        重新检查连接
      </Button>
      {!connected && (
        <details>
          <summary>连接详情</summary>
          <p>Storybook 不提供自登录或自授权入口。</p>
          <code>
            {error || auth.reasonCode} · {auth.actionHint}
          </code>
        </details>
      )}
    </section>
  );
}
