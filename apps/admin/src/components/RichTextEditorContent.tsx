import { useEffect, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Color from '@tiptap/extension-color';
import TextStyle from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import DOMPurify from 'dompurify';
import './RichTextEditor.css';

function editorContent(value: string): string {
  if (/<\/?[a-z][^>]*>/i.test(value)) return DOMPurify.sanitize(value, { USE_PROFILES: { html: true } });
  return value.split('\n').map(line => `<p>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`).join('');
}

function colorInputValue(color: string | undefined): string {
  if (color && /^#[0-9a-f]{6}$/i.test(color)) return color;
  const rgb = color?.match(/^rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)$/);
  return rgb ? '#' + rgb.slice(1).map(n => Number(n).toString(16).padStart(2, '0')).join('') : '#111827';
}

export function RichTextEditor({ value, onChange, disabled = false, label = 'Metin editörü' }: {
  value: string; onChange: (value: string) => void; disabled?: boolean; label?: string;
}) {
  const [showLink, setShowLink] = useState(false);
  const [url, setUrl] = useState('');
  const [linkError, setLinkError] = useState('');
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] } }), TextStyle, Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false, protocols: ['https', 'http', 'mailto', 'tel'], HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } })],
    content: editorContent(value), editable: !disabled,
    editorProps: { attributes: { role: 'textbox', 'aria-label': label, 'aria-multiline': 'true' } },
    onUpdate: ({ editor: current }) => onChange(current.isEmpty ? '' : DOMPurify.sanitize(current.getHTML())),
  });
  useEffect(() => { editor?.setEditable(!disabled); }, [editor, disabled]);
  useEffect(() => {
    if (!editor) return;
    const content = editorContent(value);
    if (value !== editor.getHTML() && !(value === '' && editor.isEmpty)) editor.commands.setContent(content, false);
  }, [editor, value]);

  if (!editor) return null;
  const button = (text: string, action: () => void, active = false, unavailable = false) => (
    <button type="button" title={text} aria-label={text} aria-pressed={active} disabled={disabled || unavailable}
      onMouseDown={e => e.preventDefault()} onClick={action}>{text}</button>
  );
  const applyLink = () => {
    const next = url.trim();
    if (!next) { editor.chain().focus().extendMarkRange('link').unsetLink().run(); setShowLink(false); return; }
    if (!/^(https?:\/\/[^\s]+|mailto:[^\s@]+@[^\s@]+|tel:\+?[\d ()-]+)$/i.test(next)) {
      setLinkError('https://, http://, mailto: veya tel: ile başlayan geçerli bir bağlantı girin.'); return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: next }).run();
    setShowLink(false); setLinkError('');
  };
  return <div className="cms-rich-text" aria-label={label}>
    <div className="cms-rich-text-toolbar" role="toolbar" aria-label={`${label} biçimlendirme`}>
      <select aria-label="Paragraf veya başlık" disabled={disabled} value={editor.isActive('heading', { level: 2 }) ? 'h2' : editor.isActive('heading', { level: 3 }) ? 'h3' : 'p'} onChange={e => {
        if (e.target.value === 'p') editor.chain().focus().setParagraph().run();
        else editor.chain().focus().toggleHeading({ level: e.target.value === 'h2' ? 2 : 3 }).run();
      }}><option value="p">Normal metin</option><option value="h2">Başlık</option><option value="h3">Alt başlık</option></select>
      {button('Kalın', () => { editor.chain().focus().toggleBold().run(); }, editor.isActive('bold'))}
      {button('İtalik', () => { editor.chain().focus().toggleItalic().run(); }, editor.isActive('italic'))}
      {button('Üstü çizili', () => { editor.chain().focus().toggleStrike().run(); }, editor.isActive('strike'))}
      <label className="cms-rich-text-color">Renk <input aria-label="Yazı rengi" type="color" disabled={disabled} value={colorInputValue(editor.getAttributes('textStyle').color)} onChange={e => { editor.chain().focus().setColor(e.target.value).run(); }} /></label>
      {button('Madde listesi', () => { editor.chain().focus().toggleBulletList().run(); }, editor.isActive('bulletList'))}
      {button('Numaralı liste', () => { editor.chain().focus().toggleOrderedList().run(); }, editor.isActive('orderedList'))}
      {button('Alıntı', () => { editor.chain().focus().toggleBlockquote().run(); }, editor.isActive('blockquote'))}
      {(['left', 'center', 'right'] as const).map((align, index) => <span key={align}>{button(['Sola hizala', 'Ortala', 'Sağa hizala'][index], () => { editor.chain().focus().setTextAlign(align).run(); }, editor.isActive({ textAlign: align }))}</span>)}
      {button('Bağlantı', () => { setUrl(editor.getAttributes('link').href || ''); setLinkError(''); setShowLink(!showLink); }, editor.isActive('link'))}
      {button('Bağlantıyı kaldır', () => { editor.chain().focus().unsetLink().run(); }, false, !editor.isActive('link'))}
      {button('Biçimi temizle', () => { editor.chain().focus().unsetAllMarks().clearNodes().run(); })}
      {button('Geri al', () => { editor.chain().focus().undo().run(); }, false, !editor.can().undo())}
      {button('İleri al', () => { editor.chain().focus().redo().run(); }, false, !editor.can().redo())}
    </div>
    {showLink && <div className="cms-rich-text-link">
      <label>Bağlantı adresi <input type="url" value={url} disabled={disabled} placeholder="https://example.com" onChange={e => setUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyLink(); } }} /></label>
      <button type="button" disabled={disabled} onClick={applyLink}>Uygula</button>
      <button type="button" onClick={() => setShowLink(false)}>İptal</button>
      {linkError && <p role="alert">{linkError}</p>}
    </div>}
    <EditorContent editor={editor} />
  </div>;
}
