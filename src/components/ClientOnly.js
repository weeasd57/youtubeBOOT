'use client';

import { useEffect, useState } from 'react';

export default function ClientOnly({ children, fallback = null }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // When rendering on the server or during hydration, return a fallback
  if (!isClient) {
    return fallback;
  }

  // Once we're on the client and hydration is complete, render children
  return children;
} 