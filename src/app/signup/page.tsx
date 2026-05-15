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
import { Loader2, Eye, EyeOff, Building2, ArrowLeft, ShieldCheck } from 'lucide-react';
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
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification, GoogleAuthProvider, signInWithPopup, getAdditionalUserInfo } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ProfileProvider, useProfile } from '@/context/profile-context';
import { Separator } from '@/components/ui/separator';

const formSchema = z.object({
  name: z.string().min(1, 'Your name is required.'),
  agencyName: z.string().min(1, 'Agency name is required.'),
  email: z.string().email('Please enter a valid email.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

type SignupFormValues = z.infer<typeof formSchema>;

function SignupPageContent() {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { setProfile } = useProfile();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', agencyName: '', email: '', password: '' },
  });

  const handleGoogleSignUp = async () => {
      setIsGoogleLoading(true);
      try {
          if (!auth || !firestore) throw new Error('Services not available.');
          const provider = new GoogleAuthProvider();
          const result = await signInWithPopup(auth, provider);
          const user = result.user;
          const additionalInfo = getAdditionalUserInfo(result);

          if (additionalInfo?.isNewUser) {
              const agencyId = user.uid;
              const batch = writeBatch(firestore);

              batch.set(doc(firestore, 'users', user.uid), {
                  id: user.uid,
                  name: user.displayName,
                  email: user.email,
                  role: 'Admin',
                  agency_id: agencyId,
                  createdAt: serverTimestamp(),
              });

              batch.set(doc(firestore, 'agencies', agencyId), {
                  id: agencyId,
                  agencyName: `${user.displayName}'s Agency`,
                  ownerId: user.uid,
                  name: user.displayName,
                  createdAt: serverTimestamp(),
                  avatar: user.photoURL,
                  planName: 'Basic',
              });

              batch.set(doc(firestore, 'agencies', agencyId, 'teamMembers', user.uid), {
                  id: user.uid,
                  name: user.displayName,
                  email: user.email,
                  role: 'Admin',
                  status: 'Active',
                  joinedAt: serverTimestamp(),
                  avatar: user.photoURL,
                  agency_id: agencyId,
              });

              await batch.commit();
          }

          toast({ title: 'Welcome to Signature CRM!' });
          router.push('/overview');
      } catch (error) {
          toast({ variant: 'destructive', title: 'Sign-Up Failed' });
      } finally {
          setIsGoogleLoading(false);
      }
  };

  const onSubmit = async (values: SignupFormValues) => {
    setIsLoading(true);
    try {
      if (!auth || !firestore) throw new Error('Services not available.');
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const user = userCredential.user;
      
      if (user) {
        await updateProfile(user, { displayName: values.name });
        const agencyId = user.uid; 
        const batch = writeBatch(firestore);

        batch.set(doc(firestore, 'users', user.uid), {
             id: user.uid,
             name: values.name,
             email: values.email,
             role: 'Admin',
             agency_id: agencyId,
             createdAt: serverTimestamp(),
        });
        
        batch.set(doc(firestore, 'agencies', agencyId), {
            id: agencyId,
            agencyName: values.agencyName,
            ownerId: user.uid,
            name: values.name,
            createdAt: serverTimestamp(),
            planName: 'Basic',
        });

        batch.set(doc(firestore, 'agencies', agencyId, 'teamMembers', user.uid), {
            id: user.uid,
            name: values.name,
            email: values.email,
            role: 'Admin',
            status: 'Active',
            joinedAt: serverTimestamp(),
            agency_id: agencyId,
        });
        
        await batch.commit();
        await sendEmailVerification(user);
      }

      toast({ title: 'Account Created!', description: 'Verification email sent.' });
      router.push('/overview');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Signup Failed', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-svh w-full items-center justify-center p-4 font-body overflow-hidden relative bg-background">
      <div className="w-full max-w-md z-10 space-y-6 animate-fade-in">
        <div className="flex items-center justify-between px-2">
            <Button variant="ghost" size="sm" asChild>
                <Link href="/login" className="flex items-center gap-2"><ArrowLeft className="h-4 w-4" /> Back to Login</Link>
            </Button>
            <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <span className="text-sm font-black tracking-widest uppercase text-foreground">Agency Portal</span>
            </div>
        </div>

        <Card className="glass-card rounded-[2rem] border-border/50">
          <CardHeader className="text-center pb-2">
             <CardTitle>Register Your Agency</CardTitle>
             <CardDescription>Setup your business workspace in seconds</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 rounded-xl font-bold"
                  onClick={handleGoogleSignUp}
                  disabled={isGoogleLoading || isLoading}
                >
                  {isGoogleLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Register with Google
                </Button>

                <div className="relative flex items-center py-2">
                    <Separator className="flex-1" />
                    <span className="px-3 text-[10px] uppercase font-black text-muted-foreground/50">Details</span>
                    <Separator className="flex-1" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase tracking-widest opacity-70">Owner Name</Label>
                        <FormControl><Input placeholder="Full Name" className="h-10 rounded-xl bg-muted/30" {...field} /></FormControl>
                        <FormMessage className="text-[10px]" />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="agencyName"
                    render={({ field }) => (
                        <FormItem className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase tracking-widest opacity-70">Agency Name</Label>
                        <FormControl><Input placeholder="Company Name" className="h-10 rounded-xl bg-muted/30" {...field} /></FormControl>
                        <FormMessage className="text-[10px]" />
                        </FormItem>
                    )}
                    />
                </div>

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase tracking-widest opacity-70">Business Email</Label>
                      <FormControl><Input type="email" placeholder="admin@agency.com" className="h-10 rounded-xl bg-muted/30" {...field} /></FormControl>
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

                <Button type="submit" className="w-full h-12 text-sm font-black mt-2 glowing-btn rounded-xl" disabled={isLoading || isGoogleLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Agency Account
                </Button>
                
                <p className="text-center text-[10px] text-muted-foreground/60 leading-relaxed mt-2">
                    By registering, you become the primary Admin of your agency workspace.
                </p>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SignupPage() {
    return (
        <FirebaseClientProvider>
          <ProfileProvider>
            <SignupPageContent />
          </ProfileProvider>
        </FirebaseClientProvider>
    );
}