import type { ReactNode } from 'react';
import { AmbientBackground } from '@nimiplatform/kit/ui';

export function ShellLayout({ children }: { children: ReactNode }) {
  return (
    <AmbientBackground variant="mesh" className="app-shell">
      <main className="app-shell__body">{children}</main>
    </AmbientBackground>
  );
}
