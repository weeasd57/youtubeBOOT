'use client';

import dynamic from 'next/dynamic';

// استيراد مكون منع نوافذ التأكيد بشكل ديناميكي لتجنب مشاكل SSR
const BrowserDialogBlocker = dynamic(
  () => import('./BrowserDialogBlocker'),
  { ssr: false }
);

export default function DialogBlockerWrapper() {
  return <BrowserDialogBlocker />;
} 