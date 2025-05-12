import "./globals.css";
import { Providers } from "./providers";

export const metadata = {
  title: "YouTube Drive Uploader",
  description: "Upload videos from Google Drive to YouTube as Shorts",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body
        className="font-sans antialiased"
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
