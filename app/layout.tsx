import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/inter';
import './globals.css';

export const metadata: Metadata = {
  title: 'One Stop Pro Manager — the meeting IDE for product teams',
  description:
    'A meeting IDE that listens to your team, extracts the real problem statement, then hands you every stage, tool and document you need to go from ideation to a live deployment.',
  openGraph: {
    title: 'One Stop Pro Manager',
    description: 'Turn the Monday meeting into a launched product. Problem extraction, 9 lifecycle stages and 100+ free tools in one room.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#f7f8fa',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
