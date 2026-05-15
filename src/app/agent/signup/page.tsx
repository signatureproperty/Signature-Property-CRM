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
import { User, Loader2, Eye, EyeOff, ArrowLeft, UserCheck } from 'lucide-react';
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
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ProfileProvider } from '@/context/profile-context';
import { Separator } from '@/components/ui/separator';

const formSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('Please enter a valid email.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

type SignupFormValues = z.infer<typeof formSchema>;

function AgentSignupPageContent() {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: SignupFormValues) => {
    setIsLoading(true);
    try {
      if (!auth || !firestore) {
        throw new Error('Auth or Firestore service is not available.');
      }
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      
      const user = userCredential.user;
      if (user) {
        await updateProfile(user, { displayName: values.name });
        
        const batch = writeBatch(firestore);

        batch.set(doc(firestore, 'agents', user.uid), {
            id: user.uid,
            name: values.name,
            email: values.email,
            role: 'Agent',
            createdAt: serverTimestamp(),
        });

        batch.set(doc(firestore, 'users', user.uid), {
            id: user.uid,
            name: values.name,
            email: values.email,
            role: 'Agent',
            agency_id: null,
            createdAt: serverTimestamp(),
        });

        await batch.commit();
        await sendEmailVerification(user);
      }

      toast({
        title: 'Agent Account Created!',
        description: 'A verification email has been sent.',
      });
      router.push('/login');

    } catch (error: any) {
      console.error('Signup Error:', error);
      toast({
        variant: 'destructive',
        title: 'Signup Failed',
        description: error.code === 'auth/email-already-in-use' ? 'Email already in use.' : 'Unexpected error.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-svh w-full items-center justify-center p-4 font-body overflow-hidden relative">
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#2563eb] to-[#0f172a]" />

      <div className="w-full max-w-sm z-10 space-y-4">
        <div className="flex items-center justify-between px-2">
            <Button variant="ghost" size="sm" className="text-white/60 hover:text-white" asChild>
                <Link href="/login"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
            </Button>
            <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-emerald-400" />
                <span className="text-sm font-black text-white tracking-widest uppercase">Agent Registration</span>
            </div>
        </div>

        <Card className="glass-card shadow-2xl border-white/10 bg-white/5 backdrop-blur-2xl overflow-hidden rounded-[2.5rem]">
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <Label className="text-blue-100 text-xs font-bold">Your Name</Label>
                      <FormControl><Input placeholder="Ali Khan" className="bg-white/5 border-white/10 text-white h-10 rounded-xl" {...field} /></FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <Label className="text-blue-100 text-xs font-bold">Email Address</Label>
                      <FormControl><Input type="email" placeholder="agent@example.com" className="bg-white/5 border-white/10 text-white h-10 rounded-xl" {...field} /></FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <Label className="text-blue-100 text-xs font-bold">Create Password</Label>
                       <div className="relative">
                        <FormControl><Input type={showPassword ? 'text' : 'password'} className="bg-white/5 border-white/10 text-white pr-10 h-10 rounded-xl" {...field} placeholder="••••••••" /></FormControl>
                        <Button type="button" variant="ghost" size="icon" className="absolute inset-y-0 right-0 h-full px-3 text-white/40 hover:text-white" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                      </div>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full h-11 text-sm font-black mt-4 bg-gradient-to-br from-emerald-400 to-teal-700 text-white rounded-xl shadow-lg hover:shadow-emerald-500/20 active:scale-95 transition-all" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Agent Account
                </Button>
                
                <p className="text-center text-[10px] text-blue-200/50 mt-4 leading-relaxed">
                    By creating an account, you become an independent agent eligible to join verified real estate agencies.
                </p>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AgentSignupPage() {
    return (
        <FirebaseClientProvider>
          <ProfileProvider>
            <AgentSignupPageContent />
          </ProfileProvider>
        </FirebaseClientProvider>
    );
}
