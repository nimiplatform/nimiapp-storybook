/** The UI cache is a projection. The bound Nimi native file store owns durability. */
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
let initialized = false;
let pendingWrite = Promise.resolve();
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
function ready() { if (!initialized || !backend) throw new Error('本机内容库尚未打开。请通过 Nimi 恢复 Storybook。'); }
export function recordPath(collection: Collection, id: string): string {
  const encoded = encodeURIComponent(id).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16)}`);
  if (!encoded || encoded.length > 200) throw new Error('内容标识为空或过长，无法保存。');
  return `${RECORD_ROOT}${collection}/item-${encoded}.json`;
}

// @nimi-authority: rule.storybook.protocol.r007
export function initializeStorybookStore(storage: StorybookFileBackend): Promise<void> {
  if (initialized) return Promise.resolve();
  if (loading) return loading;
  loading = (async () => {
    const files = await storage.list(RECORD_ROOT);
    const loaded = new Map<Collection, Map<string, unknown>>(COLLECTIONS.map(c => [c, new Map()]));
    for (const path of files) {
      const match = /^storybook\/records\/([^/]+)\/item-(.+)\.json$/.exec(path);
      if (!match || !COLLECTIONS.includes(match[1] as Collection)) continue;
      const id = decodeURIComponent(match[2]); const collection = match[1] as Collection;
      if (recordPath(collection, id) !== path) throw new Error(`内容文件路径不规范：${path}`);
      try { loaded.get(collection)!.set(id, immutable(await storage.read(path))); }
      catch (error) { throw new Error(`未能读取本机内容 ${path}。文件已保留，请检查后重试。`, { cause: error }); }
    }
    records.clear(); loaded.forEach((map, key) => records.set(key, map));
    backend = storage; initialized = true;
  })().finally(() => { loading = undefined; });
  return loading;
}
export function allRecords<T>(collection: Collection): T[] { ready(); return [...records.get(collection)!.values()] as T[]; }
export function getRecord<T>(collection: Collection, id: string): T | null { ready(); return records.get(collection)!.get(id) as T ?? null; }
export async function putRecord(collection: Collection, id: string, value: unknown): Promise<void> {
  ready();
  const path = recordPath(collection, id); const snapshot = structuredClone(value);
  const write = pendingWrite.then(async () => {
    await backend!.write(path, snapshot);
    records.get(collection)!.set(id, immutable(snapshot)); changed();
  });
  pendingWrite = write.catch(() => undefined);
  await write;
}
export async function removeRecord(collection: Collection, id: string): Promise<void> {
  ready();
  const write = pendingWrite.then(async () => {
    await backend!.remove(recordPath(collection, id));
    records.get(collection)!.delete(id); changed();
  });
  pendingWrite = write.catch(() => undefined); await write;
}
