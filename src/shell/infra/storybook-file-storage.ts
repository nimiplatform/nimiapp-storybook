import type { StorybookFileBackend } from '../../storybook/store/native-repository.js';
import { getStorybookNimiClient } from './storybook-nimi-client.js';

// @nimi-authority: rule.storybook.protocol.r007
export function createStorybookFileBackend(): StorybookFileBackend {
  const assets = getStorybookNimiClient().storage.assets;
  return {
    async list(prefix) {
      const paths: string[] = []; let cursor: string | undefined;
      do {
        const page = await assets.list({ prefix, ...(cursor ? { cursor } : {}), pageSize: 100 });
        paths.push(...page.assets.map(a => a.relativePath)); cursor = page.nextCursor || undefined;
      } while (cursor);
      return paths;
    },
    async read(relativePath) {
      const result = await assets.read({ relativePath });
      const decoder = new TextDecoder('utf-8', { fatal: true }); let text = '';
      for await (const chunk of result.body) text += decoder.decode(chunk, { stream: true });
      text += decoder.decode(); return JSON.parse(text) as unknown;
    },
    async write(relativePath, value) {
      // Kit's chunked file API handles narrative records beyond the small
      // storage.writeJson document limit. Commit is owned by the native carrier.
      await assets.write({ relativePath, body: new Blob([JSON.stringify(value)], { type: 'application/json' }), mediaType: 'application/json', overwrite: true });
    },
    async remove(relativePath) { await assets.remove(relativePath); },
  };
}
