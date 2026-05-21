import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Signature Property CRM',
  description: 'The ultimate real-estate CRM, simplified.',
  appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: 'Signature Property CRM',
  },
  icons: {
      icon: [
        { url: '/icon-512x512.png', type: 'image/png' },
      ],
      shortcut: '/icon-512x512.png',
      apple: '/icon-512x512.png',
  },
  formatDetection: {
      telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#3b82f6',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
