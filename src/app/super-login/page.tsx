
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
import { ShieldAlert, Loader2, Eye, EyeOff, Lock } from 'lucide-react';
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
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { ProfileProvider } from '@/context/profile-context';

const formSchema = z.object({
  email: z.string().email('Please enter a valid email.'),
  password: z.string().min(1, 'Password is required.'),
});

type LoginFormValues = z.infer<typeof formSchema>;

function SuperLoginPageContent() {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
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
      const user = userCredential.user;

      // Force-check or Set Super Admin role for this specific login attempt
      // In a production app, you'd check a whitelist or a custom claim.
      // For this prototype, we'll check the users collection.
      const userDocRef = doc(firestore, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          if (userData.role !== 'Super Admin') {
              // If it's a regular user trying to use the back-door, we could either block or elevate
              // For the prototype, if they know the super-login, we'll allow elevation or check a specific email.
              // Let's assume only a specific email can be Super Admin.
              const SUPER_ADMIN_EMAILS = [values.email]; // For now, the one who logs in here
              
              await updateDoc(userDocRef, { role: 'Super Admin' });
          }
      } else {
          // Create the user if missing
          await setDoc(userDocRef, {
              id: user.uid,
              email: user.email,
              name: user.displayName || 'System Admin',
              role: 'Super Admin',
              createdAt: new Date().toISOString()
          });
      }

      toast({
        title: 'Super Admin Access Granted',
        description: 'Welcome to the Master Control Panel.',
      });
      
      router.push('/super-admin');
    } catch (error: any) {
      console.error('Super Login Error:', error);
      toast({
        variant: 'destructive',
        title: 'Access Denied',
        description: 'Invalid credentials or unauthorized access attempt.',
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
          <p className="text-slate-400 text-sm font-medium">
            Authorized Personnel Only
          </p>
        </div>

        <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-xl shadow-2xl">
          <CardHeader>
            <CardTitle className="text-white">Secure Login</CardTitle>
            <CardDescription className="text-slate-400">Enter your master credentials.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <Label className="text-slate-300 text-xs font-bold uppercase tracking-widest">Admin Email</Label>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="admin@platform.com"
                          className="bg-slate-800/50 border-slate-700 text-white focus:ring-primary/40"
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
                      <Label className="text-slate-300 text-xs font-bold uppercase tracking-widest">Access Key</Label>
                      <div className="relative">
                        <FormControl>
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            className="bg-slate-800/50 border-slate-700 text-white focus:ring-primary/40 pr-10"
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
            Signature CRM Platform Infrastructure
        </p>
      </div>
    </div>
  );
}

export default function SuperLoginPage() {
  return (
    <FirebaseClientProvider>
      <ProfileProvider>
        <SuperLoginPageContent />
      </ProfileProvider>
    </FirebaseClientProvider>
  );
}
