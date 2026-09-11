import { useRef, useState, useId } from 'react';
import { Upload, X, FileJson, Image } from 'lucide-react';
import { importDocument } from '../../store/storybook-store.js';
import { record, parseProtocolDocument } from '../../engine/protocol/validate.js';
import { cardsFromPng, type PngCards } from '../../engine/protocol/png.js';
import { useModal } from '../use-modal.js';

import { storeStorybookMedia, storeWorkMedia } from '../../../shell/infra/storybook-media-storage.js';

export function ContentImport({ onClose, onImported, onPrepared }: { onClose: () => void; onImported: (id: string) => void; onPrepared: (text: string) => Promise<void> }) {
  const [text, setText] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const dialog = useModal(); const titleId = useId(); const busyRef = useRef(false);
  const [candidates, setCandidates] = useState<(PngCards & { name: string; artwork: string }) | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  async function parse(text: string, name: string, artwork?: string) {
    const parsed: unknown = JSON.parse(text);
    if (record(parsed) && 'manifest' in parsed && !('spec' in parsed) && !('format' in parsed)) { await onPrepared(text); return; }
    const { document } = parseProtocolDocument(parsed);
    const data = document.kind === 'work' ? await storeWorkMedia(document.data) : document.data;
    const nativeArtwork = artwork ? await storeStorybookMedia(artwork) : undefined;
    const imported = await importDocument(data, name, nativeArtwork); onImported(imported.id);
  }
  async function fileImport(file?: File) {
    if (!file || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(''); setCandidates(null); setSelected(null);
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error('文件超过 8 MB，请使用较小的 JSON 或 PNG。');
      if (/\.png$/i.test(file.name)) {
        const bytes = new Uint8Array(await file.arrayBuffer()); const result = cardsFromPng(bytes);
        const artwork = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
        if (result.cards.length > 1 || result.warnings.length) setCandidates({ ...result, name: file.name, artwork });
        else await parse(JSON.stringify(result.cards[0]), file.name, artwork);
      } else await parse(await file.text(), file.name);
    } catch (e) { setError(e instanceof SyntaxError ? 'JSON 无法解析，请检查文件内容。' : e instanceof Error ? e.message : '读取失败，请重新选择。'); }
    finally { busyRef.current = false; setBusy(false); }
  }
  async function importSelected() {
    if (!candidates || selected === null || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try { await parse(JSON.stringify(candidates.cards[selected]), candidates.name, candidates.artwork); }
    catch (e) { setError(e instanceof Error ? e.message : '导入失败。'); }
    finally { busyRef.current = false; setBusy(false); }
  }
  return <dialog ref={dialog} aria-labelledby={titleId} className="sb-dialog sb-content-import" onCancel={onClose} onClick={e => { if (e.target === dialog.current) onClose(); }}>
    <div className="sb-dialog-heading"><div><span className="sb-eyebrow">BRING YOUR OWN UNIVERSE</span><h2 id={titleId}>把你的世界带进来</h2></div><button className="sb-icon-button" aria-label="关闭导入" onClick={onClose}><X size={20} /></button></div>
    <p className="sb-muted">一张角色卡，就能开始。也可以带来世界资料，或一整套自己编排的体验。</p>
    <label className={`sb-upload ${busy ? 'is-busy' : ''}`} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void fileImport(e.dataTransfer.files[0]); }}>
      <Upload size={29} strokeWidth={1.4} /><strong>{busy ? '正在打开…' : '选择文件，或拖到这里'}</strong><span>Character Card V2 · Storybook 作品 · Lorebook</span><small><FileJson size={13} /> JSON <Image size={13} /> PNG 角色卡 · 最多 8 MB</small>
      <input aria-label="选择导入文件" type="file" accept=".json,.png,application/json,image/png" disabled={busy} onChange={e => { void fileImport(e.target.files?.[0]); e.target.value = ''; }} />
    </label>
    {candidates && <section className="sb-png-candidates" aria-label="选择 PNG 中的角色数据"><h3>这张图片里有 {candidates.cards.length} 份可用的角色设定</h3><p className="sb-muted">相同内容已合并。比较下面的开场和设定，再选择要带入的版本。</p>{candidates.warnings.map((warning, i) => <p className="sb-notice" key={i}>{warning}</p>)}{candidates.cards.map((card, i) => <article key={i}><label><input type="radio" name="png-card" disabled={busy} checked={selected === i} onChange={() => setSelected(i)} /><span>版本 {i + 1} · {card.data.name || '未命名角色'}</span></label><p className="sb-muted">{card.data.creator || '未标注作者'} · 作者版本 {card.data.character_version || '未标注'} · {card.data.alternate_greetings.length + 1} 个开场 · {card.data.character_book?.entries.length ?? 0} 条设定</p><details><summary>查看开场与角色设定</summary><h4>开场</h4><p>{card.data.first_mes}</p><h4>角色描述</h4><p>{card.data.description}</p><h4>情境</h4><p>{card.data.scenario}</p></details></article>)}<button className="sb-primary" disabled={selected === null || busy} onClick={() => { void importSelected(); }}>{busy ? '正在导入…' : '导入所选版本'}</button></section>}
    <details className="sb-paste-import"><summary>粘贴 JSON</summary><textarea className="sb-textarea sb-code-input" aria-label="导入 JSON" value={text} onChange={e => setText(e.target.value)} /><button className="sb-primary" disabled={busy || !text.trim()} onClick={async () => { if (busyRef.current) return; busyRef.current = true; setBusy(true); setError(''); try { if (new TextEncoder().encode(text).length > 8 * 1024 * 1024) throw new Error('内容超过 8 MB。'); await parse(text, '粘贴的内容.json'); } catch (e) { setError(e instanceof Error ? e.message : '导入失败。'); } finally { busyRef.current = false; setBusy(false); } }}>加入我的收藏</button></details>
    {error && <p className="sb-notice" role="alert">{error}</p>}
    <p className="sb-import-footnote">内容保存在本机。角色卡原有字段会完整保留。</p>
  </dialog>;
}
