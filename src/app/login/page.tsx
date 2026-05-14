
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Home, Loader2, Eye, EyeOff, Download, Share, X, Moon, Sun, Plus } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { useAuth, useFirestore } from '@/firebase/provider';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { ProfileProvider } from '@/context/profile-context';
import { Separator } from '@/components/ui/separator';
import { doc, getDoc } from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTheme } from 'next-themes';


const formSchema = z.object({
  email: z.string().email('Please enter a valid email.'),
  password: z.string().min(1, 'Password is required.'),
  remember: z.boolean().default(false),
});

type LoginFormValues = z.infer<typeof formSchema>;

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed',
    platform: string
  }>;
  prompt(): Promise<void>;
}

function LoginPageContent() {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [showIosInstall, setShowIosInstall] = useState(false);
  const { setTheme, theme } = useTheme();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
      remember: false,
    },
  });

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e as BeforeInstallPromptEvent);
    };

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator as any).standalone;
    
    setIsIos(isIosDevice && !isInStandaloneMode);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = () => {
    if (isIos) {
      setShowIosInstall(true);
    } else if (installPromptEvent) {
      installPromptEvent.prompt();
      installPromptEvent.userChoice.then(choiceResult => {
        if (choiceResult.outcome === 'accepted') {
          toast({ title: "App installing...", description: "Check your home screen shortly." });
        }
        setInstallPromptEvent(null);
      });
    }
  };

  const onSubmit = async (values: LoginFormValues) => {
    setIsLoading(true);
    try {
      if (!auth) {
        throw new Error('Auth service is not available.');
      }
      await signInWithEmailAndPassword(auth, values.email, values.password);
      router.push('/overview');
    } catch (error: any) {
      console.error('Login Error:', error);
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description:
          error.code === 'auth/invalid-credential'
            ? 'Incorrect email or password.'
            : 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      if (!auth || !firestore) {
        throw new Error('Auth service is not available.');
      }
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const userDocRef = doc(firestore, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        router.push('/overview');
      } else {
        await auth.signOut();
        toast({
          variant: 'destructive',
          title: 'Account Not Found',
          description: "Your account does not exist. Please sign up first.",
        });
      }
    } catch (error: any) {
      console.error('Google Sign-In Error:', error);
      if (error.code !== 'auth/popup-closed-by-user') {
          toast({
            variant: 'destructive',
            title: 'Google Sign-In Failed',
            description: 'Could not sign in with Google. Please try again or sign up.',
          });
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4 font-body">
      <div className="absolute top-4 right-4">
        <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="rounded-full text-white">
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
        </Button>
      </div>
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="flex justify-center items-center gap-3 mb-4">
            <h1 className="text-3xl font-black text-white font-headline tracking-tighter uppercase">
              Signature CRM
            </h1>
          </div>
          <p className="text-blue-100 font-medium">
            Welcome back! Please sign in to continue.
          </p>
        </div>

        <Card className="glass-card shadow-2xl border-white/20 bg-white/10">
          <CardHeader>
            <CardTitle className="text-white">Login</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 bg-white/5 text-white hover:bg-white/10"
                  onClick={handleGoogleSignIn}
                  disabled={isGoogleLoading || isLoading}
                >
                  {isGoogleLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <svg
                      className="mr-2 h-4 w-4"
                      aria-hidden="true"
                      focusable="false"
                      data-prefix="fab"
                      data-icon="google"
                      role="img"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 488 512"
                    >
                      <path
                        fill="currentColor"
                        d="M488 261.8C488 403.3 381.5 512 244 512 111.8 512 0 400.2 0 264.8S111.8 17.6 244 17.6c78.2 0 128.8 30.7 172.4 69.3l-59.8 58.6C324.2 119.8 291.6 98.4 244 98.4c-83.8 0-146.4 65.5-146.4 166.4s62.6 166.4 146.4 166.4c97.2 0 130.3-72.8 134.7-109.8H244v-73.4h239.3c5.1 26.6 7.7 54.5 7.7 85.4z"
                      ></path>
                    </svg>
                  )}
                  Sign in with Google
                </Button>

                <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-white/10" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-transparent px-2 text-blue-200">Or continue with</span>
                    </div>
                </div>

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <Label className="text-blue-100">Email</Label>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="m@example.com"
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/40"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <Label className="text-blue-100">Password</Label>
                      <div className="relative">
                        <FormControl>
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            className="bg-white/5 border-white/10 text-white placeholder:text-white/40 pr-10"
                            {...field}
                            placeholder="••••••••"
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute inset-y-0 right-0 h-full px-3 text-white/60 hover:text-white"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff /> : <Eye />}
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full h-12 text-base font-bold mt-4 glowing-btn"
                  disabled={isLoading || isGoogleLoading}
                >
                  {isLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Login
                </Button>

                {(installPromptEvent || isIos) && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-12 text-base font-bold bg-emerald-500 hover:bg-emerald-600 border-none text-white shadow-xl shadow-emerald-500/20"
                    onClick={handleInstallClick}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Install App
                  </Button>
                )}
                
                <Dialog open={showIosInstall} onOpenChange={setShowIosInstall}>
                    <DialogContent className="glass-modal">
                      <DialogHeader>
                        <DialogTitle className="text-foreground">Install on iPhone/iPad</DialogTitle>
                      </DialogHeader>
                      <div className="py-4 text-center space-y-4">
                        <p className="text-sm">To install the app on your device, tap the 'Share' icon in Safari and then select 'Add to Home Screen'.</p>
                        <div className="flex justify-center items-center gap-2">
                            <Share className="h-8 w-8 text-primary" />
                            <span className="mx-2 text-2xl">→</span>
                            <div className="p-2 border rounded-xl">
                                <Plus className="h-6 w-6" />
                            </div>
                        </div>
                      </div>
                    </DialogContent>
                </Dialog>


                <Separator className="my-4 border-white/10" />
                <div className="space-y-2 text-center">
                  <p className="text-sm text-blue-200">Don't have an account?</p>
                  <Button variant="outline" className="w-full bg-transparent border-white/20 text-white hover:bg-white/10" asChild>
                    <Link href="/signup">Create Agency Account</Link>
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <FirebaseClientProvider>
      <ProfileProvider>
        <LoginPageContent />
      </ProfileProvider>
    </FirebaseClientProvider>
  );
}
