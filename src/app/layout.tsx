import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Padlet — collaborative boards",
  description: "Collect notes, images, videos, and links on shared boards.",
};

const themeScript = `
try {
  var t = localStorage.getItem('padlet:theme');
  var d = t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (d) document.documentElement.classList.add('dark');
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
