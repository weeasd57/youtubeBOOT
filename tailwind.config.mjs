/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    screens: {
      'xs': '475px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      fontFamily: {
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          '"Liberation Mono"',
          '"Courier New"',
          'monospace',
        ],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        light: {
          background: '#ffffff',
          foreground: '#1f2937',
          primary: '#3b82f6',
          secondary: '#4b5563',
          accent: '#f97316',
          muted: '#f3f4f6',
          card: '#ffffff',
          'card-foreground': '#1f2937',
        },
        dark: {
          background: '#1f2937',
          foreground: '#f9fafb',
          primary: '#3b82f6',
          secondary: '#9ca3af',
          accent: '#f97316',
          muted: '#374151',
          card: '#FFD700',
          'card-foreground': '#f9fafb',
        },
      },
    },
  },
  plugins: [],
};
