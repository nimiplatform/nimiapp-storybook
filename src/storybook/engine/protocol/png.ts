import { parseProtocolDocument } from './validate.js';
import type { CharacterCardV2 } from './types.js';

export type PngCards = { cards: CharacterCardV2[]; warnings: string[] };
const comparable = (value: unknown): unknown => Array.isArray(value) ? value.map(comparable)
  : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, comparable(item)])) : value;

// @nimi-authority: rule.storybook.protocol.r002
export function cardsFromPng(bytes: Uint8Array): PngCards {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 20 || signature.some((v, i) => bytes[i] !== v)) throw new Error('这不是完整的 PNG 角色卡。');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = new TextDecoder('latin1');
  const cards: CharacterCardV2[] = []; const warnings: string[] = []; const seen = new Set<string>();
  let complete = false; let candidate = 0;
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const size = view.getUint32(offset);
    if (size > bytes.length - offset - 12) throw new Error('PNG 文件不完整。');
    const type = ascii.decode(bytes.subarray(offset + 4, offset + 8));
    const chunk = bytes.subarray(offset + 8, offset + 8 + size);
    if (type === 'tEXt') {
      const zero = chunk.indexOf(0);
      if (zero >= 0 && ascii.decode(chunk.subarray(0, zero)) === 'chara') {
        candidate++;
        try {
          const decoded = atob(ascii.decode(chunk.subarray(zero + 1)));
          const text = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(decoded, c => c.charCodeAt(0)));
          const { document } = parseProtocolDocument(JSON.parse(text));
          if (document.kind !== 'card') throw new Error('需要 Character Card V2。');
          const key = JSON.stringify(comparable(document.data));
          if (!seen.has(key)) { seen.add(key); cards.push(document.data); }
        } catch (error) { warnings.push(`第 ${candidate} 份角色数据无法使用：${error instanceof Error ? error.message : '编码无法读取。'}`); }
      }
    }
    offset += size + 12;
    if (type === 'IEND') { complete = true; break; }
  }
  if (!complete) throw new Error('PNG 文件不完整。');
  if (!cards.length) throw new Error(warnings.join('\n') || '这张 PNG 没有可读取的 chara 角色卡数据。当前支持 tEXt 格式的 V2 卡。');
  return { cards, warnings };
}
