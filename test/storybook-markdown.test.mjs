import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const root = path.resolve(import.meta.dirname, '..');
mkdirSync(path.join(root, '.nimi/local'), { recursive: true });
const out = mkdtempSync(path.join(root, '.nimi/local/markdown-tests-'));
await build({ entryPoints: [path.join(root, 'src/storybook/ui/protocol/prose.tsx')], outfile: path.join(out, 'prose.mjs'), bundle: true, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic', logLevel: 'silent' });
const { Prose } = await import(pathToFileURL(path.join(out, 'prose.mjs')).href);
const render = text => renderToStaticMarkup(createElement(Prose, { text }));
test.after(() => rmSync(out, { recursive: true, force: true }));

test('shared prose renders inline and reference images with nested Markdown while code remains literal', () => {
  const html = render('# A scene\n\n*See **this** picture:* ![](https://example.org/scene_(night).png)\n\n![A garden][scene]\n\n[scene]: ./stories/garden.jpg "Garden"\n\n`![](https://example.org/not-an-image.png)`');
  assert.match(html, /<h1>A scene<\/h1>/);
  assert.match(html, /<em>See <strong>this<\/strong> picture:<\/em>/);
  assert.match(html, /src="https:\/\/example.org\/scene_\(night\).png"/);
  assert.match(html, /src="\.\/stories\/garden.jpg"/);
  assert.equal((html.match(/<img /g) ?? []).length, 2);
  assert.match(html, /<code>!\[\]\(https:\/\/example.org\/not-an-image.png\)<\/code>/);
});

test('Markdown uses safe links and image URLs and does not execute imported HTML', () => {
  const html = render('[read](https://example.org/story)\n\n![bad](javascript:alert)\n\n![file](file:///etc/passwd)\n\n![svg](data:image/svg+xml;base64,AAAA)\n\n<script>alert(1)</script>\n\n<iframe src="https://example.org"></iframe>');
  assert.match(html, /href="https:\/\/example.org\/story"/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.doesNotMatch(html, /<img |<script|<iframe|src="file:|src="javascript:/);
  assert.match(html, /图片地址暂不支持/);
});

test('Markdown supports lists, quotes and GFM tables without rewriting source text', () => {
  const source = '> A memory\n\n- first\n- second\n\n| Place | Mood |\n| --- | --- |\n| garden | quiet |';
  const html = render(source);
  assert.match(html, /<blockquote>/); assert.match(html, /<ul>/); assert.match(html, /<table>/);
  assert.match(html, /<td>quiet<\/td>/);
});

test('unsupported external schemes and credential-bearing links remain plain text', () => {
  const html = render('[email](mailto:a@example.org) [credentials](https://name:secret@example.org) [local](file:///tmp/a) [web](https://example.org)');
  assert.equal((html.match(/<a /g) ?? []).length, 1);
  assert.doesNotMatch(html, /href="mailto:|href="file:|href="https:\/\/name:/);
});
