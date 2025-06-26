'use client';

import React, { ReactNode } from 'react';
import { ThemeProvider as NextThemesProvider, ThemeProviderProps as NextThemeProviderProps } from 'next-themes';

interface ThemeProviderProps extends Omit<NextThemeProviderProps, 'children'> {
  children: ReactNode;
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
