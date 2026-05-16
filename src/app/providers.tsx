'use client';

import React, { useMemo } from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';

export function Providers({ children }: { children: React.ReactNode }) {
    // Initialize Firebase once on the client side to avoid chunk loading conflicts
    const firebaseServices = useMemo(() => {
        return initializeFirebase();
    }, []);

    return (
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
            <FirebaseProvider
                firebaseApp={firebaseServices.firebaseApp}
                auth={firebaseServices.auth}
                firestore={firebaseServices.firestore}
                storage={firebaseServices.storage}
            >
                {children}
                <Toaster />
            </FirebaseProvider>
        </ThemeProvider>
    );
}
