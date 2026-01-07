'use client';

import { useUser } from '@/firebase/auth/use-user';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AppLoader } from '@/components/ui/loader';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { ProfileProvider } from '@/context/profile-context';

function HomePageContent() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading) {
      if (user) {
        router.replace('/overview');
      } else {
        router.replace('/login');
      }
    }
  }, [user, isUserLoading, router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <AppLoader />
    </div>
  );
}


export default function HomePage() {
    return (
        <FirebaseClientProvider>
            <ProfileProvider>
                <HomePageContent />
            </ProfileProvider>
        </FirebaseClientProvider>
    )
}
