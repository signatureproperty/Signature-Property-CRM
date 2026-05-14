'use client';

import React, { useState } from 'react';
import { AppSidebar } from '@/components/shared/sidebar';
import { AppHeader } from '@/components/shared/header';
import { SidebarProvider } from '@/components/ui/sidebar';
import { usePathname, useRouter } from 'next/navigation';
import { CurrencyProvider } from '@/context/currency-context';
import { ProfileProvider, useProfile } from '@/context/profile-context';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { useUser } from '@/firebase/auth/use-user';
import { Loader2, MailWarning, Send, AlertTriangle } from 'lucide-react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { AppLoader } from '@/components/ui/loader';
import { useToast } from '@/hooks/use-toast';
import { sendEmailVerification } from 'firebase/auth';
import { Button } from '@/components/ui/button';

// A simple React context to manage global search state
const SearchContext = React.createContext<{
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}>({
  searchQuery: '',
  setSearchQuery: () => {},
});

export const useSearch = () => React.useContext(SearchContext);

// Context for general UI state that needs to be shared
const UIContext = React.createContext<{
  isMoreMenuOpen: boolean;
  setIsMoreMenuOpen: (isOpen: boolean) => void;
}>({
  isMoreMenuOpen: false,
  setIsMoreMenuOpen: () => {},
});

export const useUI = () => React.useContext(UIContext);


function AuthGuard({ children }: { children: React.ReactNode }) {
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
        toast({ title: 'Verification Email Sent', description: 'Please check your inbox (and spam folder).' });
      } catch (error) {
        console.error("Error resending verification email:", error);
        toast({ title: 'Error', description: 'Could not send email. Please try again later.', variant: 'destructive' });
      } finally {
        setIsResending(false);
      }
  }

  if (isUserLoading || isProfileLoading) {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <AppLoader />
        </div>
    );
  }
  
  if (!user || !profile.role) {
    // This can happen briefly between login and profile hydration
    return (
         <div className="flex h-screen w-full items-center justify-center bg-background">
            <AppLoader />
        </div>
    );
  }

  // Define restricted paths for each role
  // REMOVED /inbox from forbidden paths for Agents as requested
  const agentForbiddenPaths = ['/team', '/documents', '/analytics', '/reports', '/finance'];
  const recorderForbiddenPaths = ['/team', '/upgrade', '/buyers', '/analytics', '/reports', '/tools', '/follow-ups', '/appointments', '/activities', '/trash', '/settings', '/support', '/properties', '/documents', '/finance', '/inbox'];

  let isAllowed = true;
  let message = "This page is not accessible with your current role.";

  if (profile.role === 'Agent' && agentForbiddenPaths.some(path => pathname.startsWith(path))) {
      isAllowed = false;
  }
  
  if (profile.role === 'Video Recorder' && recorderForbiddenPaths.some(path => pathname.startsWith(path))) {
      isAllowed = false;
  }


  if (!isAllowed) {
      return (
         <div className="flex h-screen w-full items-center justify-center p-4">
            <Card className="max-w-md text-center border-destructive">
                <CardHeader>
                    <CardTitle className="flex items-center justify-center gap-2 text-destructive"><AlertTriangle/>Access Denied</CardTitle>
                    <CardDescription>
                        {message}
                    </CardDescription>
                </CardHeader>
            </Card>
        </div>
      )
  }

  return (
    <>
        {!user.emailVerified && (
            <div className="sticky top-0 z-40 w-full bg-amber-500 text-amber-900 shadow-md">
                <div className="container mx-auto flex items-center justify-center p-2 text-sm font-semibold gap-4">
                    <MailWarning className="h-5 w-5" />
                    <span>Please verify your email address to unlock all features.</span>
                    <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-auto px-2 py-1 text-amber-900 hover:bg-amber-400 hover:text-amber-900"
                        onClick={handleResendVerification}
                        disabled={isResending}
                    >
                        {isResending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-2"/>}
                        Resend Email
                    </Button>
                </div>
            </div>
        )}
        {children}
    </>
  );
}

function ProtectedLayoutContent({ children }: { children: React.ReactNode }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const pathname = usePathname();
  const isSearchable = ['/properties', '/buyers', '/recording', '/editing'].some(path => pathname.startsWith(path));


  // Reset search when navigating away from searchable pages
  React.useEffect(() => {
    if (!isSearchable) {
      setSearchQuery('');
    }
  }, [isSearchable, pathname]);


  return (
    <SearchContext.Provider value={{ searchQuery, setSearchQuery }}>
      <UIContext.Provider value={{ isMoreMenuOpen, setIsMoreMenuOpen }}>
        <SidebarProvider>
          <AuthGuard>
            <div className="flex h-screen w-full bg-background">
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
            </div>
            </div>
          </AuthGuard>
        </SidebarProvider>
      </UIContext.Provider>
    </SearchContext.Provider>
  );
}


export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FirebaseClientProvider>
      <ProfileProvider>
        <CurrencyProvider>
              <ProtectedLayoutContent>
                  {children}
              </ProtectedLayoutContent>
        </CurrencyProvider>
      </ProfileProvider>
    </FirebaseClientProvider>
  )
}
