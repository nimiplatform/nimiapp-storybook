import { useEffect, useSyncExternalStore } from 'react';
import type { EditorSession } from '../store/editor-session.js';

const activeEditors = new Set<{ flushForNavigation(): Promise<void> }>();
export async function flushStorybookEditors() { await Promise.all([...activeEditors].map(editor => editor.flushForNavigation())); }

export function useEditorSession<T>(session: EditorSession<T>) {
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  useEffect(() => {
    activeEditors.add(session);
    return () => { activeEditors.delete(session); };
  }, [session]);
  return { ...snapshot, session };
}
