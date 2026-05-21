
'use client';

import { useState, useEffect } from 'react';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { useFirestore } from '@/firebase/provider';
import { doc, setDoc, addDoc, collection, updateDoc } from 'firebase/firestore';
import { useProfile } from '@/context/profile-context';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Sparkles } from 'lucide-react';
import type { Service } from '@/lib/types';

const formSchema = z.object({
  name: z.string().min(1, 'Service name is required'),
  price: z.coerce.number().min(0, 'Price must be positive'),
  category: z.string().min(1, 'Category is required'),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface AddServiceDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  serviceToEdit?: Service | null;
}

export function AddServiceDialog({ isOpen, setIsOpen, serviceToEdit }: AddServiceDialogProps) {
  const { profile } = useProfile();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      price: 0,
      category: 'Marketing',
      description: '',
    },
  });

  useEffect(() => {
    if (isOpen && serviceToEdit) {
      form.reset({
        name: serviceToEdit.name,
        price: serviceToEdit.price,
        category: serviceToEdit.category,
        description: serviceToEdit.description,
      });
    } else if (isOpen) {
      form.reset({
        name: '',
        price: 0,
        category: 'Marketing',
        description: '',
      });
    }
  }, [isOpen, serviceToEdit, form]);

  const onSubmit = async (values: FormValues) => {
    if (!profile.agency_id) return;
    setIsLoading(true);

    try {
        if (serviceToEdit) {
            const docRef = doc(firestore, 'agencies', profile.agency_id, 'services', serviceToEdit.id);
            await updateDoc(docRef, values);
            toast({ title: 'Service Updated' });
        } else {
            const colRef = collection(firestore, 'agencies', profile.agency_id, 'services');
            await addDoc(colRef, {
                ...values,
                agency_id: profile.agency_id,
                created_at: new Date().toISOString(),
            });
            toast({ title: 'Service Created' });
        }
        setIsOpen(false);
    } catch (error) {
        toast({ title: 'Error saving service', variant: 'destructive' });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md border-none shadow-3xl rounded-[2rem]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-xl text-primary">
                <Sparkles className="h-6 w-6" />
            </div>
            <div>
                <DialogTitle className="font-headline text-xl font-black">
                    {serviceToEdit ? 'Edit Service' : 'Create New Service'}
                </DialogTitle>
                <DialogDescription className="text-xs font-medium">
                    Add a custom service to your agency portfolio.
                </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">Service Name</FormLabel>
                  <FormControl><Input placeholder="e.g. Video Shooting (Basic)" {...field} className="h-11 rounded-xl" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">Base Price</FormLabel>
                    <FormControl><Input type="number" {...field} className="h-11 rounded-xl" /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">Category</FormLabel>
                    <FormControl><Input placeholder="e.g. Media" {...field} className="h-11 rounded-xl" /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">Description (Optional)</FormLabel>
                  <FormControl><Textarea {...field} rows={3} className="rounded-xl resize-none" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)} className="rounded-xl h-11">Cancel</Button>
              <Button type="submit" disabled={isLoading} className="rounded-xl h-11 px-8 glowing-btn font-black">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {serviceToEdit ? 'Save Changes' : 'Create Service'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
