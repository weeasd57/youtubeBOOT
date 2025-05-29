'use client';

import dynamic from 'next/dynamic';

// Dynamically import the Footer component with SSR disabled
const Footer = dynamic(() => import('./footer'), {
  ssr: false,
});

export default function FooterWrapper() {
  return <Footer />;
}
