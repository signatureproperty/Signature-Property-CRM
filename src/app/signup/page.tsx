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
import { Loader2, Eye, EyeOff, Building2, ArrowLeft } from 'lucide-react';
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
import { doc, setDoc, serverTimestamp, writeBatch, getDoc } from 'firebase/firestore';
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
    defaultValues: {
      name: '',
      agencyName: '',
      email: '',
      password: '',
    },
  });

  const handleGoogleSignUp = async () => {
      setIsGoogleLoading(true);
      try {
          if (!auth || !firestore) {
              throw new Error('Auth or Firestore service is not available.');
          }
          const provider = new GoogleAuthProvider();
          const result = await signInWithPopup(auth, provider);
          const user = result.user;
          const additionalInfo = getAdditionalUserInfo(result);

          if (additionalInfo?.isNewUser) {
              const agencyId = user.uid;
              const batch = writeBatch(firestore);

              const userDocRef = doc(firestore, 'users', user.uid);
              batch.set(userDocRef, {
                  id: user.uid,
                  name: user.displayName,
                  email: user.email,
                  role: 'Admin',
                  agency_id: agencyId,
                  createdAt: serverTimestamp(),
              });

              const agencyDocRef = doc(firestore, 'agencies', agencyId);
              batch.set(agencyDocRef, {
                  id: agencyId,
                  agencyName: `${user.displayName}'s Agency`,
                  ownerId: user.uid,
                  name: user.displayName,
                  createdAt: serverTimestamp(),
                  avatar: user.photoURL,
                  planName: 'Basic',
              });

              const teamMemberRef = doc(firestore, 'agencies', agencyId, 'teamMembers', user.uid);
              batch.set(teamMemberRef, {
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

              const newProfileData = {
                  id: user.uid,
                  name: user.displayName || '',
                  agencyName: `${user.displayName}'s Agency`,
                  email: user.email || '',
                  phone: '',
                  role: 'Admin' as const,
                  agency_id: agencyId,
                  user_id: user.uid,
                  avatar: user.photoURL || '',
                  planName: 'Basic' as const,
              };
              setProfile(newProfileData);
          }

          toast({
              title: 'Successfully Signed In!',
              description: additionalInfo?.isNewUser ? 'Your new agency account has been created.' : 'Welcome back!',
          });
          router.push('/overview');

      } catch (error: any) {
          console.error('Google Sign-Up Error:', error);
          toast({
              variant: 'destructive',
              title: 'Google Sign-Up Failed',
              description: 'Could not sign up with Google. Please try again.',
          });
      } finally {
          setIsGoogleLoading(false);
      }
  };

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

      toast({
        title: 'Account Created!',
        description: 'Please verify your email to continue.',
      });
      router.push('/overview');

    } catch (error: any) {
      console.error('Signup Error:', error);
      toast({
        variant: 'destructive',
        title: 'Signup Failed',
        description: error.code === 'auth/email-already-in-use' ? 'Email already in use.' : 'Error occurred.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-svh w-full items-center justify-center p-4 font-body overflow-hidden relative">
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#2563eb] to-[#0f172a]" />
      
      <div className="w-full max-w-md z-10 space-y-4">
        <div className="flex items-center justify-between px-2">
            <Button variant="ghost" size="sm" className="text-white/60 hover:text-white" asChild>
                <Link href="/login"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link>
            </Button>
            <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-400" />
                <span className="text-sm font-black text-white tracking-widest uppercase">Agency Registration</span>
            </div>
        </div>

        <Card className="glass-card shadow-2xl border-white/10 bg-white/5 backdrop-blur-2xl overflow-hidden rounded-[2.5rem]">
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-10 bg-white/5 border-white/10 text-white hover:bg-white/10 text-xs font-bold rounded-xl"
                  onClick={handleGoogleSignUp}
                  disabled={isGoogleLoading || isLoading}
                >
                  {isGoogleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Signup with Google
                </Button>

                <div className="relative my-1">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-white/5" /></div>
                    <div className="relative flex justify-center text-[10px] uppercase font-black"><span className="bg-transparent px-2 text-blue-200/40">Or fill details</span></div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem className="space-y-1">
                        <Label className="text-blue-100 text-xs font-bold">Full Name</Label>
                        <FormControl><Input placeholder="Ali Khan" className="bg-white/5 border-white/10 text-white h-10 rounded-xl" {...field} /></FormControl>
                        <FormMessage className="text-[10px]" />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="agencyName"
                    render={({ field }) => (
                        <FormItem className="space-y-1">
                        <Label className="text-blue-100 text-xs font-bold">Agency Name</Label>
                        <FormControl><Input placeholder="Signature Prop" className="bg-white/5 border-white/10 text-white h-10 rounded-xl" {...field} /></FormControl>
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
                      <Label className="text-blue-100 text-xs font-bold">Email</Label>
                      <FormControl><Input type="email" placeholder="admin@example.com" className="bg-white/5 border-white/10 text-white h-10 rounded-xl" {...field} /></FormControl>
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
                        <FormControl><Input type={showPassword ? 'text' : 'password'} className="bg-white/5 border-white/10 text-white pr-10 h-10 rounded-xl" {...field} placeholder="••••••••" /></FormControl>
                        <Button type="button" variant="ghost" size="icon" className="absolute inset-y-0 right-0 h-full px-3 text-white/40 hover:text-white" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                      </div>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full h-11 text-sm font-black mt-2 glowing-btn rounded-xl shadow-lg" disabled={isLoading || isGoogleLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Agency Account
                </Button>
                
                <p className="text-center text-[10px] text-blue-200/50 mt-2">
                    By signing up, you agree to our Terms and Service.
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
