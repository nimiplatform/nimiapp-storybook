import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Button,
  InlineAlert,
  StatusBadge,
  Surface,
} from '@nimiplatform/kit/ui';
import { useAppStore } from './app-store.js';
import { runStorybookBootstrap } from '../infra/storybook-bootstrap.js';

type AuthGateState =
  | { kind: 'checking' }
  | { kind: 'blocked'; message: string }
  | { kind: 'action-required'; reasonCode: string; actionHint: string }
  | { kind: 'ready' };

function resolveAuthGateState(input: {
  auth: ReturnType<typeof useAppStore.getState>['auth'];
  bootstrapReady: boolean;
  bootstrapError: string | null;
}): AuthGateState {
  if (input.bootstrapError) return { kind: 'blocked', message: input.bootstrapError };
  if (!input.bootstrapReady || input.auth.status === 'bootstrapping') return { kind: 'checking' };
  if (input.auth.status === 'unauthenticated') {
    return {
      kind: 'action-required',
      reasonCode: input.auth.reasonCode,
      actionHint: input.auth.actionHint,
    };
  }
  return { kind: 'ready' };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAppStore((state) => state.auth);
  const bootstrapReady = useAppStore((state) => state.bootstrapReady);
  const bootstrapError = useAppStore((state) => state.bootstrapError);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    void runStorybookBootstrap();
  }, []);

  const gateState = useMemo(
    () => resolveAuthGateState({ auth, bootstrapReady, bootstrapError }),
    [auth, bootstrapError, bootstrapReady],
  );

  const retry = useCallback(() => {
    const store = useAppStore.getState();
    store.setBootstrapError(null);
    store.setBootstrapReady(false);
    setRetrying(true);
    void runStorybookBootstrap({ force: true }).finally(() => setRetrying(false));
  }, []);

  if (gateState.kind === 'blocked') {
    return (
      <AuthGateScreen
        badge={<StatusBadge tone="danger" shape="dot">Session blocked</StatusBadge>}
        title="Desktop 会话不可用"
        detail="Storybook 仅通过 Desktop-supervised standard bridge 使用 Nimi 平台会话。"
      >
        <InlineAlert tone="danger">{gateState.message}</InlineAlert>
        <Button tone="primary" onClick={retry} loading={retrying}>重试</Button>
      </AuthGateScreen>
    );
  }

  if (gateState.kind === 'checking') {
    return (
      <AuthGateScreen
        badge={<StatusBadge tone="neutral" shape="dot">Session check</StatusBadge>}
        title="连接 Desktop"
        detail="正在校验由 Desktop supervisor 建立的本地 App 会话。"
      >
        <div className="flex items-center gap-3 text-sm text-[var(--nimi-text-secondary)]" role="status">
          <span
            aria-hidden="true"
            className="inline-block h-4 w-4 rounded-full border-2 border-[var(--nimi-border-strong)] border-r-transparent animate-spin"
          />
          <span>启动中</span>
        </div>
      </AuthGateScreen>
    );
  }

  if (gateState.kind === 'action-required') {
    return (
      <AuthGateScreen
        badge={<StatusBadge tone="warning" shape="dot">Desktop action required</StatusBadge>}
        title="请从 Nimi Desktop 启动 Storybook"
        detail="账号登录、项目准入和会话续期均由 Desktop 管理；Storybook 不提供自登录或自授权入口。"
      >
        <InlineAlert tone="warning">
          请确认 Nimi Desktop 已登录并已为当前项目建立受保护会话。
        </InlineAlert>
        <details className="text-xs text-[var(--nimi-text-muted)]">
          <summary>技术详情</summary>
          <code>{gateState.reasonCode} · {gateState.actionHint}</code>
        </details>
        <Button tone="primary" onClick={retry} loading={retrying}>重新检查</Button>
      </AuthGateScreen>
    );
  }

  return <>{children}</>;
}

function AuthGateScreen({
  badge,
  title,
  detail,
  children,
}: {
  badge: ReactNode;
  title: string;
  detail: string;
  children: ReactNode;
}) {
  return (
    <div className="runtime-check-screen">
      <Surface
        tone="panel"
        elevation="raised"
        padding="lg"
        className="runtime-unavailable-panel"
      >
        <div className="runtime-unavailable-heading">
          <div>{badge}</div>
          <div>
            <h1>{title}</h1>
            <p>{detail}</p>
          </div>
        </div>
        <div className="flex flex-col items-start gap-4">{children}</div>
      </Surface>
    </div>
  );
}
