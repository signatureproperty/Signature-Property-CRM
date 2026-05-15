'use client';

import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { User, UserRole } from '@/lib/types';
import { useEffect, useState } from 'react';
import { useFirestore, useAuth } from '@/firebase/provider';
import { doc, setDoc, serverTimestamp, writeBatch, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useProfile } from '@/context/profile-context';
import { Loader2, Mail, Shield, User as UserIcon, Lock } from 'lucide-react';
import { createUserWithEmailAndPassword } from 'firebase/auth';

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['Agent', 'Admin', 'Video Recorder']).default('Agent'),
  password: z.string().optional(),
}).refine(data => {
    return data.role !== 'Video Recorder' || (data.password && data.password.length >= 6);
}, {
    message: "Password must be at least 6 characters for Video Recorder.",
    path: ["password"],
});

type AddMemberFormValues = z.infer<typeof formSchema>;

interface AddTeamMemberFormProps {
  setDialogOpen: (open: boolean) => void;
  memberToEdit?: User | null;
  onRoleChange: (role: UserRole) => void;
}

export function AddTeamMemberForm({ setDialogOpen, memberToEdit, onRoleChange }: AddTeamMemberFormProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const auth = useAuth();
  const { profile } = useProfile();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<AddMemberFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      role: 'Agent',
      password: '',
    },
  });

  const watchedRole = useWatch({ control: form.control, name: 'role' });

  useEffect(() => {
    onRoleChange(watchedRole as UserRole);
  }, [watchedRole, onRoleChange]);

  useEffect(() => {
    if (memberToEdit) {
      form.reset({
        name: memberToEdit.name,
        email: memberToEdit.email || '',
        role: (memberToEdit.role === 'Super Admin' ? 'Admin' : memberToEdit.role) as any,
      });
    }
  }, [memberToEdit, form]);

  const handleSaveMember = async (values: AddMemberFormValues) => {
    if (!profile.agency_id) return;
    
    setIsLoading(true);

    try {
        if (memberToEdit) {
            const memberRef = doc(firestore, 'agencies', profile.agency_id, 'teamMembers', memberToEdit.id);
            await updateDoc(memberRef, { role: values.role, name: values.name });
            toast({ title: 'Role Updated', description: `Details for ${values.name} updated.` });
        } else {
            const teamMembersRef = collection(firestore, 'agencies', profile.agency_id, 'teamMembers');
            const q = query(teamMembersRef, where("email", "==", values.email));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                toast({ title: 'Member Already Exists', description: 'This email is already part of your team.', variant: 'destructive' });
                setIsLoading(false);
                return;
            }

            if (values.role === 'Video Recorder') {
                if (!values.password) return;
                
                const tempAuth = auth;
                const userCredential = await createUserWithEmailAndPassword(tempAuth, values.email, values.password);
                const newUser = userCredential.user;

                const batch = writeBatch(firestore);
                batch.set(doc(firestore, 'users', newUser.uid), {
                    id: newUser.uid,
                    name: values.name,
                    email: values.email,
                    role: 'Video Recorder',
                    agency_id: profile.agency_id,
                    createdAt: serverTimestamp()
                });
                batch.set(doc(firestore, 'agencies', profile.agency_id, 'teamMembers', newUser.uid), {
                    id: newUser.uid,
                    user_id: newUser.uid,
                    name: values.name,
                    email: values.email,
                    role: 'Video Recorder',
                    status: 'Active',
                    agency_id: profile.agency_id,
                    agency_name: profile.agencyName,
                    joinedAt: serverTimestamp()
                });
                await batch.commit();
                
                await auth.signOut();
                toast({ title: "Recorder Account Created", description: "Please log in again as Admin to continue." });
                window.location.href = '/login';
                return;

            } else {
                const batch = writeBatch(firestore);
                const newMemberRef = doc(teamMembersRef);
                
                batch.set(newMemberRef, {
                    id: newMemberRef.id,
                    name: values.name,
                    email: values.email,
                    role: values.role,
                    status: 'Pending',
                    agency_id: profile.agency_id,
                    agency_name: profile.agencyName,
                    invitedAt: serverTimestamp()
                });

                const invitationId = `${values.email}_${profile.agency_id}`;
                batch.set(doc(firestore, 'invitations', invitationId), {
                    toEmail: values.email,
                    fromAgencyId: profile.agency_id,
                    fromAgencyName: profile.agencyName,
                    status: 'pending',
                    role: values.role,
                    invitedAt: serverTimestamp(),
                    memberDocId: newMemberRef.id
                });
                
                await batch.commit();
                toast({ title: 'Invitation Sent!', description: `An invitation has been sent to ${values.email}.` });
            }
        }
        setDialogOpen(false);
    } catch (error: any) {
        console.error("Error saving team member:", error);
        toast({ title: 'Error Occurred', description: error.message || 'Could not save member.', variant: 'destructive' });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSaveMember)} className="space-y-4 pt-4">
         <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2"><UserIcon className="h-3.5 w-3.5" /> Full Name</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g. Ali Raza" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> Email Address</FormLabel>
              <FormControl>
                <Input type="email" {...field} placeholder="agent@example.com" disabled={!!memberToEdit} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2"><Shield className="h-3.5 w-3.5" /> Assign Role</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Agent">Agent (Recommended)</SelectItem>
                  <SelectItem value="Video Recorder">Video Recorder</SelectItem>
                  <SelectItem value="Admin">Co-Admin</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        {watchedRole === 'Video Recorder' && !memberToEdit && (
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2"><Lock className="h-3.5 w-3.5" /> Set Account Password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} placeholder="Min. 6 characters" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
        )}
        <div className="flex justify-end gap-2 pt-6 border-t mt-4">
          <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button type="submit" className="glowing-btn px-6" disabled={isLoading}>
            {isLoading && <Loader2 className="animate-spin mr-2" />}
            {memberToEdit ? 'Save Changes' : (watchedRole === 'Video Recorder' ? 'Create Account' : 'Send Invitation')}
          </Button>
        </div>
      </form>
    </Form>
  );
}
