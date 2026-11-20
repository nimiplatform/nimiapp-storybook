import { NimiAccountControl, useNimiAppSession } from '@nimiplatform/kit/auth/app';
import { Button } from '@nimiplatform/kit/ui';

// @nimi-authority: rule.storybook.ia.r006
export function SessionSettings() {
  const { session, snapshot } = useNimiAppSession();
  const connected = snapshot.runtime.status === 'connected';
  return <section className={`sb-session-card${connected ? ' is-connected' : ''}`}>
    <span className={`sb-connection-dot${connected ? ' is-connected' : ''}`} />
    <div className="sb-session-card__body">
      <strong>{connected ? '已连接 Nimi' : '未连接 Nimi'}</strong>
      <p>{connected ? '故事保存在主 Runtime；AI 使用你在此 App 下的配置。' : '已打开的内容可以继续阅读。保存和 AI 需要重新连接。'}</p>
      {snapshot.issue && <p role="alert">{snapshot.issue.message}</p>}
      {!connected && <Button tone="secondary" size="sm" loading={snapshot.runtime.status === 'connecting'} onClick={() => void session.connectRuntime()}>连接 Nimi</Button>}
      {session.account.kind === 'app-session' && <p>退出账号会清除本页尚未保存的编辑和生成结果，请先保存。</p>}
      <NimiAccountControl language="zh" />
    </div>
  </section>;
}
