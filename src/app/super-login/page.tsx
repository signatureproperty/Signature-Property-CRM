'use client';

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
import { ShieldAlert, Loader2, Eye, EyeOff, Lock, Sparkles } from 'lucide-react';
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
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ProfileProvider, useProfile } from '@/context/profile-context';

const formSchema = z.object({
  email: z.string().email('Please enter a valid email.'),
  password: z.string().min(1, 'Password is required.'),
});

type LoginFormValues = z.infer<typeof formSchema>;

function SuperLoginPageContent() {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { setProfile } = useProfile();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
      if (!auth || !firestore) {
        throw new Error('Firebase services are not initialized.');
      }
      
      const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
      
      if (userCredential.user) {
        router.push('/overview');
      }
    } catch (error: any) {
      console.error('Login Error:', error);
      let errorMsg = 'Invalid credentials.';
      
      toast({
        variant: 'destructive',
        title: 'Access Denied',
        description: errorMsg,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-950 p-4 font-body">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
                <ShieldAlert className="h-10 w-10 text-primary animate-pulse" />
            </div>
          </div>
          <h1 className="text-3xl font-black text-white font-headline tracking-tighter">
            Master Control
          </h1>
          <p className="text-slate-400 text-sm font-medium uppercase tracking-[0.15em]">
            Signature CRM System
          </p>
        </div>

        <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="bg-primary/10 py-2 px-4 flex items-center gap-2 border-b border-slate-800">
             <Sparkles className="h-3 w-3 text-primary" />
             <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Platform Administrator Access</span>
          </div>
          <CardHeader>
            <CardTitle className="text-white">Authorized Login</CardTitle>
            <CardDescription className="text-slate-400">Login to manage the entire platform.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <Label className="text-slate-300 text-xs font-bold uppercase tracking-widest">Master Email</Label>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="admin@platform.com"
                          className="bg-slate-800/50 border-slate-700 text-white focus:ring-primary/40 h-12"
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
                    <FormItem className="space-y-1">
                      <Label className="text-slate-300 text-xs font-bold uppercase tracking-widest">Master Key</Label>
                      <div className="relative">
                        <FormControl>
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            className="bg-slate-800/50 border-slate-700 text-white focus:ring-primary/40 pr-10 h-12"
                            {...field}
                            placeholder="••••••••"
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute inset-y-0 right-0 h-full px-3 text-slate-500 hover:text-white"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full h-12 text-base font-bold mt-4 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Lock className="mr-2 h-4 w-4" />
                  )}
                  Authenticate
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
        
        <p className="text-center text-[10px] text-slate-600 uppercase font-bold tracking-[0.2em]">
            Authorized Personnel Only
        </p>
      </div>
    </div>
  );
}

export default function SuperLoginPage() {
  return (
    <ProfileProvider>
      <SuperLoginPageContent />
    </ProfileProvider>
  );
}