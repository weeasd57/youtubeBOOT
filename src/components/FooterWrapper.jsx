'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

// Dynamically import the Footer component with SSR disabled
const Footer = dynamic(() => import('./footer'), {
  ssr: false,
});

export default function FooterWrapper() {
  const pathname = usePathname();
  
  // Hide footer on terms and privacy pages
  const hideFooter = pathname === '/terms' || pathname === '/privacy';
  
  // If footer should be hidden, return null
  if (hideFooter) {
    return null;
  }
  
  return <Footer />;
}
