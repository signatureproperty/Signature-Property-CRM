import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';
import { initializeFirebase } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function generateMetadata(): Promise<Metadata> {
  let appName = 'Signature Property CRM';
  let appDesc = 'The ultimate real-estate CRM, simplified.';
  let iconUrl = '/icon-512x512.png';

  try {
    const { firestore } = initializeFirebase();
    const docRef = doc(firestore, 'system_config', 'branding');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const data = docSnap.data();
        appName = data.appName || appName;
        appDesc = data.appDescription || appDesc;
        iconUrl = data.pwaIconUrl || iconUrl;
    }
  } catch (error) {
    console.error("Metadata generation error:", error);
  }

  return {
    title: appName,
    description: appDesc,
    manifest: '/manifest.json',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: appName,
    },
    icons: {
        icon: iconUrl,
        apple: iconUrl,
    },
    formatDetection: {
        telephone: false,
    },
  }
}

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
