import { mkdir, readdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';

/** Real filesystem repository tests; protected Kit carrier acceptance runs in the App. */
export function createFileBackend(directory) {
  const file = relative => {
    const target = path.resolve(directory, relative);
    if (!target.startsWith(path.resolve(directory) + path.sep)) throw new Error('path escapes test directory');
    return target;
  };
  return {
    async list(prefix) {
      const result = [];
      async function visit(current, relative) {
        let entries;
        try { entries = await readdir(current, { withFileTypes: true }); }
        catch (e) { if (e.code === 'ENOENT') return; throw e; }
        for (const entry of entries) {
          const next = path.join(current, entry.name); const key = relative + entry.name;
          if (entry.isDirectory()) await visit(next, key + '/');
          else if (key.startsWith(prefix) && key.endsWith('.json')) result.push(key);
        }
      }
      await visit(directory, ''); return result.sort();
    },
    async read(relative) { return JSON.parse(await readFile(file(relative), 'utf8')); },
    async write(relative, value) {
      const target = file(relative); await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target + '.tmp', JSON.stringify(value)); await rename(target + '.tmp', target);
    },
    async remove(relative) { await rm(file(relative), { force: true }); },
  };
}
