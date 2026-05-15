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
import { Loader2, Eye, EyeOff, Moon, Sun, ShieldCheck, UserCircle } from 'lucide-react';
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
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { ProfileProvider } from '@/context/profile-context';
import { Separator } from '@/components/ui/separator';
import { doc, getDoc } from 'firebase/firestore';
import { useTheme } from 'next-themes';

const formSchema = z.object({
  email: z.string().email('Please enter a valid email.'),
  password: z.string().min(1, 'Password is required.'),
});

type LoginFormValues = z.infer<typeof formSchema>;

function LoginPageContent() {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { setTheme, theme } = useTheme();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

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
    <div className="flex h-svh w-full items-center justify-center p-4 font-body overflow-hidden relative">
      {/* Dynamic Background to match CRM */}
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#2563eb] to-[#0f172a]" />
      
      <div className="absolute top-4 right-4 z-10">
        <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="rounded-full text-white/80 hover:text-white hover:bg-white/10">
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
      </div>

      <div className="w-full max-w-sm z-10 space-y-4">
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-black text-white font-headline tracking-tighter uppercase">
            Signature CRM
          </h1>
          <p className="text-blue-100/70 text-sm font-medium">
            Professional Real Estate Management
          </p>
        </div>

        <Card className="glass-card shadow-2xl border-white/10 bg-white/5 backdrop-blur-2xl overflow-hidden rounded-[2.5rem]">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-xl text-center">Welcome Back</CardTitle>
            <CardDescription className="text-blue-100/50 text-xs text-center italic">Sign in to your dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-10 bg-white/5 border-white/10 text-white hover:bg-white/10 text-xs font-bold rounded-xl"
                  onClick={handleGoogleSignIn}
                  disabled={isGoogleLoading || isLoading}
                >
                  {isGoogleLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 488 512" fill="currentColor">
                      <path d="M488 261.8C488 403.3 381.5 512 244 512 111.8 512 0 400.2 0 264.8S111.8 17.6 244 17.6c78.2 0 128.8 30.7 172.4 69.3l-59.8 58.6C324.2 119.8 291.6 98.4 244 98.4c-83.8 0-146.4 65.5-146.4 166.4s62.6 166.4 146.4 166.4c97.2 0 130.3-72.8 134.7-109.8H244v-73.4h239.3c5.1 26.6 7.7 54.5 7.7 85.4z" />
                    </svg>
                  )}
                  Continue with Google
                </Button>

                <div className="relative my-1">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-white/5" />
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase font-black">
                        <span className="bg-transparent px-2 text-blue-200/40">Or email</span>
                    </div>
                </div>

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <Label className="text-blue-100 text-xs font-bold">Email Address</Label>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="m@example.com"
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/20 h-10 rounded-xl focus:ring-primary/40"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <Label className="text-blue-100 text-xs font-bold">Password</Label>
                      <div className="relative">
                        <FormControl>
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            className="bg-white/5 border-white/10 text-white placeholder:text-white/20 pr-10 h-10 rounded-xl focus:ring-primary/40"
                            {...field}
                            placeholder="••••••••"
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute inset-y-0 right-0 h-full px-3 text-white/40 hover:text-white"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full h-11 text-sm font-black mt-2 glowing-btn rounded-xl shadow-lg"
                  disabled={isLoading || isGoogleLoading}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Login to Portal
                </Button>

                <div className="flex flex-col gap-2 mt-4">
                  <div className="flex items-center gap-2">
                    <Separator className="flex-1 bg-white/5" />
                    <span className="text-[10px] font-black text-blue-200/40 uppercase">New Here?</span>
                    <Separator className="flex-1 bg-white/5" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" className="h-9 bg-white/5 border-white/10 text-white hover:bg-white/10 text-[10px] font-bold rounded-xl flex items-center gap-1.5" asChild>
                      <Link href="/signup">
                        <ShieldCheck className="h-3.5 w-3.5" /> Agency
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" className="h-9 bg-white/5 border-white/10 text-white hover:bg-white/10 text-[10px] font-bold rounded-xl flex items-center gap-1.5" asChild>
                      <Link href="/agent/signup">
                        <UserCircle className="h-3.5 w-3.5" /> Agent
                      </Link>
                    </Button>
                  </div>
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
