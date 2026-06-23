'use client';

import React, { useState, type ReactNode } from 'react';
import { AppSidebar } from '@/components/shared/sidebar';
import { AppHeader } from '@/components/shared/header';
import { SidebarProvider } from '@/components/ui/sidebar';
import { usePathname, useRouter } from 'next/navigation';
import { CurrencyProvider } from '@/context/currency-context';
import { ProfileProvider, useProfile } from '@/context/profile-context';
import { useUser } from '@/firebase/auth/use-user';
import { Loader2, MailWarning, Send, ShieldAlert } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AppLoader } from '@/components/ui/loader';
import { useToast } from '@/hooks/use-toast';
import { sendEmailVerification } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { MobileNav } from '@/components/shared/mobile-nav';
import { LayoutStateProvider, useSearch } from '@/context/layout-context';

function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const { profile, isLoading: isProfileLoading } = useProfile();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [isResending, setIsResending] = useState(false);

  React.useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  const handleResendVerification = async () => {
      if (!user) return;
      setIsResending(true);
      try {
        await sendEmailVerification(user);
        toast({ title: 'Verification Email Sent', description: 'Please check your inbox.' });
      } catch (error) {
        console.error("Error resending verification email:", error);
        toast({ title: 'Error', description: 'Could not send email. Please try again later.', variant: 'destructive' });
      } finally {
        setIsResending(false);
      }
  }

  // Prevent full screen loader on every update if profile is already loaded
  if (isUserLoading || (isProfileLoading && !profile.user_id)) {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <AppLoader />
        </div>
    );
  }
  
  if (!user || !profile.role) {
    return (
         <div className="flex h-screen w-full items-center justify-center bg-background">
            <AppLoader />
        </div>
    );
  }

  const agentForbiddenPaths = ['/team', '/analytics', '/reports', '/finance', '/services'];

  let isAllowed = true;
  let message = "This page is not accessible with your current role.";

  if (profile.role === 'Agent' && agentForbiddenPaths.some(path => pathname.startsWith(path))) {
      isAllowed = false;
  }

  if (!isAllowed) {
      return (
         <div className="flex h-screen w-full items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
            <Card className="max-w-md w-full border-destructive shadow-2xl bg-background">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto bg-destructive/10 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                        <ShieldAlert className="text-destructive h-6 w-6" />
                    </div>
                    <CardTitle className="text-xl font-bold font-headline">Access Denied</CardTitle>
                    <CardTitle className="text-xl font-bold font-headline">Access Denied</CardTitle>
                    <CardDescription className="text-sm font-medium">
                        {message}
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-center pt-4">
                    <Button variant="outline" className="rounded-full px-8" onClick={() => router.push('/overview')}>
                        Return to Dashboard
                    </Button>
                </CardContent>
            </Card>
        </div>
      )
  }

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden">
        {!user.emailVerified && (
            <div className="z-50 w-full bg-amber-500 text-amber-900 shadow-md flex-shrink-0">
                <div className="container mx-auto flex items-center justify-center p-2 px-4 text-[11px] sm:text-sm font-bold gap-3 sm:gap-6 text-center">
                    <div className="flex items-center gap-2">
                        <MailWarning className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                        <span className="leading-tight">Verify your email to unlock all features.</span>
                    </div>
                    <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-8 px-3 py-0 text-[10px] sm:text-xs font-black uppercase tracking-widest border border-amber-900/30 hover:bg-amber-400"
                        onClick={handleResendVerification}
                        disabled={isResending}
                    >
                        {isResending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1"/>}
                        Resend
                    </Button>
                </div>
            </div>
        )}
        <div className="flex-1 flex overflow-hidden relative">
            {children}
        </div>
    </div>
  );
}

function ProtectedLayoutContent({ children }: { children: ReactNode }) {
  const { searchQuery, setSearchQuery } = useSearch();
  const pathname = usePathname();
  const isSearchable = ['/properties', '/buyers', '/recording', '/editing'].some(path => pathname.startsWith(path));

  React.useEffect(() => {
    if (!isSearchable) {
      setSearchQuery('');
    }
  }, [isSearchable, pathname, setSearchQuery]);

  return (
    <AuthGuard>
        <SidebarProvider>
            <div className="flex h-full w-full bg-background overflow-hidden">
                <AppSidebar />
                <div className="flex flex-col flex-1 overflow-hidden">
                    <AppHeader 
                        searchable={isSearchable}
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                    />
                    <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-32">
                        {children}
                    </main>
                    <MobileNav />
                </div>
            </div>
        </SidebarProvider>
    </AuthGuard>
  );
}

export default function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ProfileProvider>
        <CurrencyProvider>
            <LayoutStateProvider>
                <ProtectedLayoutContent>
                    {children}
                </ProtectedLayoutContent>
            </LayoutStateProvider>
        </CurrencyProvider>
    </ProfileProvider>
  )
}
