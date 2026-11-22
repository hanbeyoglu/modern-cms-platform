import { lazy, Suspense } from 'react';

const Editor = lazy(() => import('./RichTextEditorContent').then(module => ({ default: module.RichTextEditor })));

export function RichTextEditor(props: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  return <Suspense fallback={<p role="status">Metin editörü yükleniyor…</p>}><Editor {...props} /></Suspense>;
}
