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
import { Loader2, Eye, EyeOff, Moon, Sun, ShieldCheck, UserCircle, LogIn } from 'lucide-react';
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
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { doc, getDoc } from 'firebase/firestore';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  email: z.string().email('Please enter a valid email.'),
  password: z.string().min(1, 'Password is required.'),
});

type LoginFormValues = z.infer<typeof formSchema>;

export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const handlePostLoginRedirect = async (user: any) => {
    const userDocRef = doc(firestore, 'users', user.uid);
    const userDocSnap = await getDoc(userDocRef);

    router.push('/overview');
  };

  const onSubmit = async (values: LoginFormValues) => {
    setIsLoading(true);
    try {
      if (!auth) throw new Error('Auth service is not available.');
      const result = await signInWithEmailAndPassword(auth, values.email, values.password);
      const user = result.user;

      if (!user.emailVerified) {
        await signOut(auth);
        toast({
          variant: 'destructive',
          title: 'Verification Required',
          description: 'Please verify your email before logging in.',
        });
        setIsLoading(false);
        return;
      }

      await handlePostLoginRedirect(user);
    } catch (error: any) {
      console.error('Login Error:', error);
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: error.code === 'auth/invalid-credential' ? 'Incorrect email or password.' : 'An unexpected error occurred.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      if (!auth || !firestore) throw new Error('Services not available.');
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Google sign-in users are usually verified, but we check anyway
      if (!user.emailVerified) {
        await signOut(auth);
        toast({
          variant: 'destructive',
          title: 'Verification Required',
          description: 'Please verify your email before logging in.',
        });
        return;
      }

      await handlePostLoginRedirect(user);
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') {
          toast({ variant: 'destructive', title: 'Google Sign-In Failed' });
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex h-svh w-full items-center justify-center p-4 font-body overflow-hidden relative bg-background">
      <div className="absolute top-6 right-6 z-10">
        <Button 
          variant="outline" 
          size="icon" 
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} 
          className="rounded-full shadow-md"
        >
            <Sun className={cn("h-5 w-5 transition-all", theme === 'dark' ? "scale-0 rotate-90" : "scale-100 rotate-0")} />
            <Moon className={cn("absolute h-5 w-5 transition-all", theme === 'dark' ? "scale-100 rotate-0" : "scale-0 -rotate-90")} />
        </Button>
      </div>

      <div className="w-full max-w-sm z-10 space-y-6 animate-fade-in">
        <div className="text-center space-y-1">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
            <LogIn className="text-primary h-6 w-6" />
          </div>
          <h1 className="text-3xl font-black font-headline tracking-tighter uppercase text-foreground">
            Signature CRM
          </h1>
          <p className="text-muted-foreground text-sm font-medium">
            Professional Real Estate Portal
          </p>
        </div>

        <Card className="glass-card overflow-hidden rounded-[2rem] border-border/50">
          <CardHeader className="pb-2 text-center">
            <CardTitle>Welcome Back</CardTitle>
            <CardDescription>Sign in to manage your agency</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 font-bold rounded-xl border-border/60"
                  onClick={handleGoogleSignIn}
                  disabled={isGoogleLoading || isLoading}
                >
                  {isGoogleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 488 512" fill="currentColor">
                      <path d="M488 261.8C488 403.3 381.5 512 244 512 111.8 512 0 400.2 0 264.8S111.8 17.6 244 17.6c78.2 0 128.8 30.7 172.4 69.3l-59.8 58.6C324.2 119.8 291.6 98.4 244 98.4c-83.8 0-146.4 65.5-146.4 166.4s62.6 166.4 146.4 166.4c97.2 0 130.3-72.8 134.7-109.8H244v-73.4h239.3c5.1 26.6 7.7 54.5 7.7 85.4z" />
                    </svg>
                  )}
                  Google Sign-In
                </Button>

                <div className="relative flex items-center py-2">
                    <Separator className="flex-1" />
                    <span className="px-3 text-[10px] uppercase font-black text-muted-foreground/50">Or use email</span>
                    <Separator className="flex-1" />
                </div>

                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <Label className="text-xs font-bold uppercase tracking-wider opacity-70">Email Address</Label>
                        <FormControl>
                          <Input type="email" placeholder="name@agency.com" className="h-11 rounded-xl bg-muted/30" {...field} />
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
                        <Label className="text-xs font-bold uppercase tracking-wider opacity-70">Password</Label>
                        <div className="relative">
                          <FormControl>
                            <Input type={showPassword ? 'text' : 'password'} className="pr-10 h-11 rounded-xl bg-muted/30" {...field} placeholder="••••••••" />
                          </FormControl>
                          <Button type="button" variant="ghost" size="icon" className="absolute inset-y-0 right-0 h-full px-3" onClick={() => setShowPassword(!showPassword)}>
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                        <FormMessage className="text-[10px]" />
                      </FormItem>
                    )}
                  />
                </div>

                <Button type="submit" className="w-full h-12 text-sm font-black mt-2 glowing-btn rounded-xl" disabled={isLoading || isGoogleLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Login
                </Button>

                <div className="pt-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Separator className="flex-1" />
                    <span className="text-[10px] font-black text-muted-foreground uppercase">Create Account</span>
                    <Separator className="flex-1" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" size="sm" className="h-10 rounded-xl font-bold text-[10px] flex items-center gap-1.5" asChild>
                      <Link href="/signup">
                        <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Create Agency
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" className="h-10 rounded-xl font-bold text-[10px] flex items-center gap-1.5" asChild>
                      <Link href="/agent/signup">
                        <UserCircle className="h-3.5 w-3.5 text-primary" /> Create Agent
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
