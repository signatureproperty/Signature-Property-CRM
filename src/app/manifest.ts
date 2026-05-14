import { MetadataRoute } from 'next';
import { initializeFirebase } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
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
    console.error("Manifest generation error:", error);
  }

  return {
    name: appName,
    short_name: appName,
    description: appDesc,
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#3b82f6',
    icons: [
      {
        src: iconUrl,
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: iconUrl,
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}