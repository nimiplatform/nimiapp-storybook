export type EditorOperation = { kind: string; startedAt: number; phase?: string; blockNavigation: boolean };
export type EditorSnapshot<T> = { value: T; status: 'saved' | 'saving' | 'error'; error?: string; notice?: string; operation?: EditorOperation };

// @nimi-authority: rule.storybook.protocol.r007
export function createEditorSession<T>(initial: T, persist: (value: T) => Promise<void>) {
  let snapshot: EditorSnapshot<T> = { value: initial, status: 'saved' };
  let revision = 0;
  let committed = 0;
  let tail: Promise<void> = Promise.resolve();
  let operation: Promise<unknown> | undefined;
  const listeners = new Set<() => void>();
  const emit = (next: EditorSnapshot<T>) => { snapshot = next; listeners.forEach(listener => listener()); };
  const save = () => {
    const version = revision;
    const value = structuredClone(snapshot.value);
    emit({ ...snapshot, status: 'saving', error: undefined });
    const job = tail.catch(() => undefined).then(() => persist(value));
    tail = job.then(() => {
      committed = version;
      if (revision === version) emit({ ...snapshot, status: 'saved', error: undefined });
    }, error => {
      if (revision === version) emit({ ...snapshot, status: 'error', error: error instanceof Error ? error.message : '本机保存失败。' });
      throw error;
    });
    // A failed background save is visible in the snapshot and retryable by flush.
    void tail.catch(() => undefined);
    return tail;
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async update(change: (current: T) => T) {
      const value = change(snapshot.value);
      revision++;
      emit({ ...snapshot, value, status: 'saving' });
      return save();
    },
    async flush() {
      await tail.catch(() => undefined);
      while (committed !== revision) await save();
    },
    async flushForNavigation() {
      if (snapshot.operation?.blockNavigation) await operation;
      await tail.catch(() => undefined);
      while (committed !== revision) await save();
    },
    setNotice(notice?: string) { emit({ ...snapshot, notice }); },
    setPhase(phase: string) { if (snapshot.operation) emit({ ...snapshot, operation: { ...snapshot.operation, phase } }); },
    run<R>(kind: string, action: () => Promise<R>, blockNavigation = false): Promise<R> {
      if (operation) return Promise.reject(new Error('这份内容还有操作未完成，请稍后重试。'));
      const job = Promise.resolve().then(action).catch(error => {
        emit({ ...snapshot, notice: error instanceof Error ? error.message : '操作未完成。' });
        throw error;
      }).finally(() => { operation = undefined; emit({ ...snapshot, operation: undefined }); });
      operation = job;
      emit({ ...snapshot, notice: undefined, operation: { kind, startedAt: Date.now(), blockNavigation } });
      return job;
    },
  };
}

export type EditorSession<T> = ReturnType<typeof createEditorSession<T>>;
const sessions = new Map<string, EditorSession<unknown>>();
// The logical content owns its session, including while every view is unmounted.
export function sharedEditorSession<T>(key: string, initial: () => T, persist: (value: T) => Promise<void>): EditorSession<T> {
  const existing = sessions.get(key);
  if (existing) return existing as EditorSession<T>;
  const session = createEditorSession(initial(), persist);
  sessions.set(key, session as EditorSession<unknown>);
  return session;
}
export function forgetEditorSession(key: string) {
  const snapshot = sessions.get(key)?.getSnapshot();
  if (snapshot && (snapshot.operation || snapshot.status !== 'saved')) throw new Error('尚有未完成的编辑，不能释放草稿。');
  sessions.delete(key);
}
export function hasPendingEditorWork() { return [...sessions.values()].some(session => { const s = session.getSnapshot(); return s.status !== 'saved' || Boolean(s.operation); }); }
