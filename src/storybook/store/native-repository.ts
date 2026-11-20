/** The UI cache is a projection. The captured Nimi storage carrier owns durability. */
export interface StorybookFileBackend {
  list(prefix: string): Promise<string[]>;
  read(path: string): Promise<unknown>;
  write(path: string, value: unknown): Promise<void>;
  remove(path: string): Promise<void>;
}
export const RECORD_ROOT = 'storybook/records/';
export const COLLECTIONS = ['projects', 'packages', 'story-runs', 'documents', 'experience-runs', 'drafts'] as const;
export type Collection = typeof COLLECTIONS[number];
let backend: StorybookFileBackend | undefined;
let loading: Promise<void> | undefined;
let loadingStorage: StorybookFileBackend | undefined;
let initialized = false;
let pendingWrite = Promise.resolve();
let identityEpoch = 0;
let connectionEpoch = 0;
const records = new Map<Collection, Map<string, unknown>>();
export function isStorybookStoreReady(): boolean { return initialized; }

function immutable<T>(value: T): T {
  const pending: unknown[] = [value];
  while (pending.length) {
    const item = pending.pop();
    if (item && typeof item === 'object' && !Object.isFrozen(item)) {
      Object.freeze(item); pending.push(...Object.values(item));
    }
  }
  return value;
}
function changed() { if (typeof window !== 'undefined') window.dispatchEvent(new Event('storybook-store-updated')); }
function ready() { if (!initialized) throw new Error('内容库尚未打开，请连接 Nimi 后重试。'); }
export function captureStorybookIdentity() {
  const epoch = identityEpoch;
  return () => { if (epoch !== identityEpoch) throw new Error('Storybook 身份已变化，旧操作已停止。'); };
}
export function captureStorybookWriteScope() {
  const epoch = connectionEpoch;
  const storage = backend;
  return () => {
    if (!storage || epoch !== connectionEpoch || storage !== backend) throw new Error('内容库连接已变化。请重新连接后明确重试保存。');
  };
}
export function detachStorybookStore() {
  connectionEpoch++; backend = undefined; loading = undefined; loadingStorage = undefined;
  pendingWrite = Promise.resolve(); changed();
}
export function resetStorybookStore() {
  identityEpoch++; detachStorybookStore(); records.clear(); initialized = false; changed();
}
export function recordPath(collection: Collection, id: string): string {
  const encoded = encodeURIComponent(id).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16)}`);
  if (!encoded || encoded.length > 200) throw new Error('内容标识为空或过长，无法保存。');
  return `${RECORD_ROOT}${collection}/item-${encoded}.json`;
}

// @nimi-authority: rule.storybook.protocol.r007
export function initializeStorybookStore(storage: StorybookFileBackend): Promise<void> {
  if (initialized && backend === storage) return Promise.resolve();
  if (loading && loadingStorage === storage) return loading;
  const epoch = ++connectionEpoch;
  backend = undefined; loadingStorage = storage;
  const job = (async () => {
    const files = await storage.list(RECORD_ROOT);
    const loaded = new Map<Collection, Map<string, unknown>>(COLLECTIONS.map(c => [c, new Map()]));
    for (const path of files) {
      const match = /^storybook\/records\/([^/]+)\/item-(.+)\.json$/.exec(path);
      if (!match || !COLLECTIONS.includes(match[1] as Collection)) continue;
      const id = decodeURIComponent(match[2]); const collection = match[1] as Collection;
      if (recordPath(collection, id) !== path) throw new Error(`内容文件路径不规范：${path}`);
      try { loaded.get(collection)!.set(id, immutable(await storage.read(path))); }
      catch (error) { throw new Error(`未能读取内容库文件 ${path}。文件已保留，请检查后重试。`, { cause: error }); }
    }
    if (epoch !== connectionEpoch) throw new Error('内容库连接已变化，旧读取结果已丢弃。');
    records.clear(); loaded.forEach((map, key) => records.set(key, map));
    backend = storage; initialized = true;
    changed();
  })().finally(() => { if (loading === job) { loading = undefined; loadingStorage = undefined; } });
  loading = job;
  return job;
}
export function allRecords<T>(collection: Collection): T[] { ready(); return [...records.get(collection)!.values()] as T[]; }
export function getRecord<T>(collection: Collection, id: string): T | null { ready(); return records.get(collection)!.get(id) as T ?? null; }
export async function putRecord(collection: Collection, id: string, value: unknown): Promise<void> {
  ready();
  const storage = backend; const assertCurrent = captureStorybookWriteScope();
  assertCurrent();
  const path = recordPath(collection, id); const snapshot = structuredClone(value);
  const write = pendingWrite.then(async () => {
    assertCurrent(); await storage!.write(path, snapshot); assertCurrent();
    records.get(collection)!.set(id, immutable(snapshot)); changed();
  });
  pendingWrite = write.catch(() => undefined);
  await write;
}
export async function removeRecord(collection: Collection, id: string): Promise<void> {
  ready();
  const storage = backend; const assertCurrent = captureStorybookWriteScope();
  assertCurrent();
  const write = pendingWrite.then(async () => {
    assertCurrent(); await storage!.remove(recordPath(collection, id)); assertCurrent();
    records.get(collection)!.delete(id); changed();
  });
  pendingWrite = write.catch(() => undefined); await write;
}
