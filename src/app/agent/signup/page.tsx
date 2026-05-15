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
    defaultValues: { name: '', email: '', password: '' },
  });

  const onSubmit = async (values: SignupFormValues) => {
    setIsLoading(true);
    try {
      if (!auth || !firestore) throw new Error('Services not available.');
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

      toast({ title: 'Agent Profile Created!', description: 'Please check your email for verification.' });
      router.push('/login');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Signup Failed', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-svh w-full items-center justify-center p-4 font-body overflow-hidden relative bg-background">
      <div className="w-full max-w-sm z-10 space-y-6 animate-fade-in">
        <div className="flex items-center justify-between px-2">
            <Button variant="ghost" size="sm" asChild>
                <Link href="/login" className="flex items-center gap-2"><ArrowLeft className="h-4 w-4" /> Back to Login</Link>
            </Button>
            <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-emerald-500" />
                <span className="text-sm font-black tracking-widest uppercase text-foreground">Agent Profile</span>
            </div>
        </div>

        <Card className="glass-card rounded-[2rem] border-border/50">
          <CardHeader className="text-center pb-2">
             <CardTitle>Create Agent Account</CardTitle>
             <CardDescription>Join agencies and manage your personal leads</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase tracking-widest opacity-70">Your Name</Label>
                      <FormControl><Input placeholder="Full Name" className="h-10 rounded-xl bg-muted/30" {...field} /></FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase tracking-widest opacity-70">Personal Email</Label>
                      <FormControl><Input type="email" placeholder="agent@email.com" className="h-10 rounded-xl bg-muted/30" {...field} /></FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase tracking-widest opacity-70">Password</Label>
                       <div className="relative">
                        <FormControl><Input type={showPassword ? 'text' : 'password'} className="pr-10 h-10 rounded-xl bg-muted/30" {...field} placeholder="••••••••" /></FormControl>
                        <Button type="button" variant="ghost" size="icon" className="absolute inset-y-0 right-0 h-full px-3" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                      </div>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full h-12 text-sm font-black mt-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg transition-all" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Register as Agent
                </Button>
                
                <p className="text-center text-[10px] text-muted-foreground/60 mt-4 leading-relaxed">
                    By creating an account, you can be invited to join professional real estate agencies.
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
        <ProfileProvider>
          <AgentSignupPageContent />
        </ProfileProvider>
    );
}