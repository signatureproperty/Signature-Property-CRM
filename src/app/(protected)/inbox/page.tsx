
'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AppLoader } from '@/components/ui/loader';

export default function InboxPage() {
    const router = useRouter();

    useEffect(() => {
        // Inbox is deprecated, moving users back to dashboard
        router.replace('/overview');
    }, [router]);

    return (
        <div className="flex h-[calc(100vh-140px)] items-center justify-center">
            <AppLoader />
        </div>
    );
}
