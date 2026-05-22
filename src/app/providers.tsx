'use client';

import React, { useMemo, useEffect, useState } from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';

export function Providers({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Initialize Firebase once on the client side
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
                {mounted ? (
                    <>
                        {children}
                        <Toaster />
                    </>
                ) : (
                    <div className="bg-background min-h-screen" />
                )}
            </FirebaseProvider>
        </ThemeProvider>
    );
}
