
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect } from 'react';
import { useUser } from '@/firebase/auth/use-user';
import { useAuth, useFirestore } from '@/firebase/provider';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useProfile } from '@/context/profile-context';
import { collection, getDocs, writeBatch, doc, deleteDoc } from 'firebase/firestore';

interface ResetAccountDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isPasswordRequired: boolean;
}

const formSchema = (isPasswordRequired: boolean) => z.object({
  password: isPasswordRequired ? z.string().min(1, 'Password is required to confirm.') : z.string().optional(),
  confirmationText: !isPasswordRequired ? z.string().refine(val => val.toUpperCase() === 'RESET', { message: "Please type 'RESET' to confirm." }) : z.string().optional(),
});


export function ResetAccountDialog({
  isOpen,
  setIsOpen,
  isPasswordRequired,
}: ResetAccountDialogProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { profile } = useProfile();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const form = useForm<z.infer<ReturnType<typeof formSchema>>>({
    resolver: zodResolver(formSchema(isPasswordRequired)),
    defaultValues: { password: '', confirmationText: '' },
  });

  // Reset form when dialog opens/closes or auth type changes
  useEffect(() => {
    form.reset({ password: '', confirmationText: '' });
  }, [isOpen, isPasswordRequired, form]);


  const handleReset = async () => {
    if (!profile.agency_id) {
        toast({ title: 'Error', description: 'Agency ID not found.', variant: 'destructive'});
        return;
    }
    
    console.log("Triggering account data reset...");
    
    try {
        const subCollections = ['properties', 'buyers', 'teamMembers', 'appointments', 'followUps', 'activityLogs'];
        const BATCH_SIZE = 499;

        for (const subCol of subCollections) {
            const collectionRef = collection(firestore, 'agencies', profile.agency_id, subCol);
            const querySnapshot = await getDocs(collectionRef);
            
            if (querySnapshot.empty) continue;

            let batch = writeBatch(firestore);
            let count = 0;
            
            for (const docSnapshot of querySnapshot.docs) {
                batch.delete(docSnapshot.ref);
                count++;
                if (count === BATCH_SIZE) {
                    await batch.commit();
                    batch = writeBatch(firestore);
                    count = 0;
                }
            }
            if (count > 0) {
                await batch.commit();
            }
        }
        
        // Remove the admin from the teamMembers subcollection
        const adminTeamMemberRef = doc(firestore, 'agencies', profile.agency_id, 'teamMembers', profile.user_id);
        await deleteDoc(adminTeamMemberRef);


        toast({
            title: 'Account Reset Successful',
            description: 'All your CRM data has been permanently deleted.',
        });

        // Reload the page to reflect the cleared state
        window.location.reload();
    } catch (error) {
        console.error("Error resetting account data:", error);
        toast({ title: "Reset Failed", description: "Could not delete all data. Please try again.", variant: 'destructive'});
    }
  };

  const onSubmit = async (data: z.infer<ReturnType<typeof formSchema>>) => {
    if (!user) {
        setError('Could not verify user. Please try logging in again.');
        return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
        if (isPasswordRequired) {
            if (!user.email || !data.password) {
                setError('Password is required for this action.');
                setIsLoading(false);
                return;
            }
            const credential = EmailAuthProvider.credential(user.email, data.password);
            await reauthenticateWithCredential(user, credential);
        } else {
             if (data.confirmationText?.toUpperCase() !== 'RESET') {
                setError("Please type 'RESET' to confirm.");
                setIsLoading(false);
                return;
            }
        }
        
        // Re-authentication/confirmation successful, proceed with reset
        await handleReset();

    } catch (error: any) {
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
            setError('Incorrect password. Please try again.');
        } else {
            setError('An unexpected error occurred during confirmation.');
            console.error(error);
        }
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline text-destructive">Reset Your Account</DialogTitle>
          <DialogDescription>
            This is a permanent action. Please confirm to proceed.
          </DialogDescription>
        </DialogHeader>
        
        <Alert variant="destructive" className="my-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Warning!</AlertTitle>
            <AlertDescription>
                You are about to delete all CRM data, including properties, buyers, and appointments. This action cannot be undone.
            </AlertDescription>
        </Alert>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {isPasswordRequired ? (
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} placeholder="Enter your password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
                 <FormField
                control={form.control}
                name="confirmationText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To confirm, type "RESET" below</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="RESET" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm & Reset Account
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
