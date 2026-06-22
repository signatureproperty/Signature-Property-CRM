'use client';

import { useUser } from '@/firebase/auth/use-user';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AppLoader } from '@/components/ui/loader';

/**
 * Root Home Page with auth-based redirection.
 * Refreshed to trigger clean re-bundle.
 */
export default function HomePage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading) {
      if (user) {
        if (user.emailVerified) {
          router.replace('/overview');
        } else {
          router.replace('/login');
        }
      } else {
        router.replace('/login');
      }
    }
  }, [user, isUserLoading, router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
            <AppLoader />

        </div>
    </div>
  );
}
