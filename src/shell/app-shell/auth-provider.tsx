import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { OfflineCoordinator, type OfflineTier } from '@nimiplatform/kit/core/offline-coordinator';
import {
  Button,
  InlineAlert,
  StatusBadge,
  Surface,
} from '@nimiplatform/kit/ui';
import { useAppStore } from './app-store.js';

const storybookAuthGateOfflineCoordinator = new OfflineCoordinator();

const StorybookLoginPage = lazy(() =>
  import('../features/auth/storybook-login-page.js').then((module) => ({
    default: module.StorybookLoginPage,
  })),
);

let storybookBootstrapModulePromise:
  | Promise<typeof import('../infra/storybook-bootstrap.js')>
  | null = null;

function loadStorybookBootstrapModule(): Promise<typeof import('../infra/storybook-bootstrap.js')> {
  storybookBootstrapModulePromise ??= import('../infra/storybook-bootstrap.js');
  return storybookBootstrapModulePromise;
}

async function runStorybookBootstrap(options?: { readonly force?: boolean }): Promise<void> {
  const bootstrap = await loadStorybookBootstrapModule();
  await bootstrap.runStorybookBootstrap(options);
}

type AuthGateState =
  | { kind: 'checking' }
  | { kind: 'blocked'; message: string; offlineTier: OfflineTier }
  | { kind: 'login-required' }
  | { kind: 'ready' };

function resolveAuthGateState(input: {
  authStatus: ReturnType<typeof useAppStore.getState>['auth']['status'];
  bootstrapReady: boolean;
  bootstrapError: string | null;
}): AuthGateState {
  if (input.bootstrapError) {
    storybookAuthGateOfflineCoordinator.markRuntimeReachable(false);
    return {
      kind: 'blocked',
      message: input.bootstrapError,
      offlineTier: storybookAuthGateOfflineCoordinator.getTier(),
    };
  }
  if (!input.bootstrapReady || input.authStatus === 'bootstrapping') {
    return { kind: 'checking' };
  }
  storybookAuthGateOfflineCoordinator.markRuntimeReachable(true);
  if (input.authStatus === 'unauthenticated') {
    return { kind: 'login-required' };
  }
  return { kind: 'ready' };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const authStatus = useAppStore((s) => s.auth.status);
  const bootstrapReady = useAppStore((s) => s.bootstrapReady);
  const bootstrapError = useAppStore((s) => s.bootstrapError);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    void runStorybookBootstrap();
  }, []);

  const gateState = useMemo(
    () => resolveAuthGateState({ authStatus, bootstrapReady, bootstrapError }),
    [authStatus, bootstrapError, bootstrapReady],
  );

  const retry = useCallback(() => {
    const store = useAppStore.getState();
    store.setBootstrapError(null);
    store.setBootstrapReady(false);
    setRetrying(true);
    void runStorybookBootstrap({ force: true }).finally(() => {
      setRetrying(false);
    });
  }, []);

  if (gateState.kind === 'blocked') {
    return (
      <AuthGateScreen
        badge={<StatusBadge tone="danger" shape="dot">Runtime blocked · {gateState.offlineTier}</StatusBadge>}
        title="Runtime 不可用"
        detail="Storybook 通过 Nimi Runtime / SDK 取得账号、AI 路由和授权。Runtime 未就绪时产品表面不会挂载。"
      >
        <InlineAlert tone="danger">{gateState.message}</InlineAlert>
        <Button tone="primary" onClick={retry} loading={retrying}>重试</Button>
      </AuthGateScreen>
    );
  }

  if (gateState.kind === 'checking') {
    return (
      <AuthGateScreen
        badge={<StatusBadge tone="neutral" shape="dot">Runtime check</StatusBadge>}
        title="连接 Runtime"
        detail="正在建立 developer-registered Runtime session，并校验当前账号投影。"
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

  if (gateState.kind === 'login-required') {
    return (
      <Suspense
        fallback={
          <AuthGateScreen
            badge={<StatusBadge tone="neutral" shape="dot">Login</StatusBadge>}
            title="加载登录"
            detail="正在打开 Runtime account browser broker。"
          >
            <div className="flex items-center gap-3 text-sm text-[var(--nimi-text-secondary)]" role="status">
              <span
                aria-hidden="true"
                className="inline-block h-4 w-4 rounded-full border-2 border-[var(--nimi-border-strong)] border-r-transparent animate-spin"
              />
              <span>加载中</span>
            </div>
          </AuthGateScreen>
        }
      >
        <StorybookLoginPage />
      </Suspense>
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
