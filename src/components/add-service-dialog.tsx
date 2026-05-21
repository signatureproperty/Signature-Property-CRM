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
import { doc, addDoc, collection, updateDoc } from 'firebase/firestore';
import { useProfile } from '@/context/profile-context';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Sparkles, X, CheckCircle2, Tag as TagIcon, ListChecks } from 'lucide-react';
import type { Service } from '@/lib/types';
import { Badge } from './ui/badge';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { ScrollArea } from './ui/scroll-area';

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
  
  // Statuses (One selection)
  const [customStatusInput, setCustomStatusInput] = useState('');
  const [customStatuses, setCustomStatuses] = useState<string[]>([]);
  
  // Tags (Multiple labels)
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

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
      setCustomStatuses(serviceToEdit.customStatuses || []);
      setTags(serviceToEdit.tags || []);
    } else if (isOpen) {
      form.reset({
        name: '',
        price: 0,
        category: 'Marketing',
        description: '',
      });
      setCustomStatuses([]);
      setTags([]);
    }
  }, [isOpen, serviceToEdit, form]);

  const handleAddStatus = () => {
    const trimmed = customStatusInput.trim();
    if (trimmed && !customStatuses.includes(trimmed)) {
        if (customStatuses.length >= 8) {
            toast({ title: 'Limit Reached', description: 'Max 8 custom statuses allowed.', variant: 'destructive' });
            return;
        }
        setCustomStatuses([...customStatuses, trimmed]);
        setCustomStatusInput('');
    }
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
        if (tags.length >= 10) {
            toast({ title: 'Limit Reached', description: 'Max 10 tags allowed.', variant: 'destructive' });
            return;
        }
        setTags([...tags, trimmed]);
        setTagInput('');
    }
  };

  const removeStatus = (status: string) => setCustomStatuses(customStatuses.filter(s => s !== status));
  const removeTag = (tag: string) => setTags(tags.filter(t => t !== tag));

  const onSubmit = async (values: FormValues) => {
    if (!profile.agency_id) return;
    setIsLoading(true);

    const payload = {
        ...values,
        customStatuses,
        tags,
        agency_id: profile.agency_id,
    };

    if (serviceToEdit) {
        const docRef = doc(firestore, 'agencies', profile.agency_id, 'services', serviceToEdit.id);
        updateDoc(docRef, payload).catch(async () => {
            const permissionError = new FirestorePermissionError({
                path: docRef.path,
                operation: 'update',
                requestResourceData: payload,
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
        });
        toast({ title: 'Updating Service...' });
    } else {
        const colRef = collection(firestore, 'agencies', profile.agency_id, 'services');
        addDoc(colRef, {
            ...payload,
            created_at: new Date().toISOString(),
        }).catch(async () => {
            const permissionError = new FirestorePermissionError({
                path: colRef.path,
                operation: 'create',
                requestResourceData: payload,
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
        });
        toast({ title: 'Creating Service...' });
    }
    
    setIsLoading(false);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-2xl border-none shadow-3xl rounded-[2rem] p-0 overflow-hidden">
        <div className="p-8 pb-2">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                    <Sparkles className="h-6 w-6" />
                </div>
                <div>
                    <DialogTitle className="font-headline text-2xl font-black">
                        {serviceToEdit ? 'Edit Service' : 'Create New Service'}
                    </DialogTitle>
                    <DialogDescription className="text-xs font-medium">
                        Define your agency service, workflow statuses, and labeling tags.
                    </DialogDescription>
                </div>
              </div>
            </DialogHeader>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <ScrollArea className="px-8 max-h-[65vh]">
                <div className="space-y-6 pb-6 pr-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">Service Name</FormLabel>
                            <FormControl><Input placeholder="e.g. Drone Video Pack" {...field} className="h-11 rounded-xl" /></FormControl>
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
                        name="price"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">Base Price (PKR)</FormLabel>
                            <FormControl><Input type="number" {...field} className="h-11 rounded-xl font-bold text-primary" /></FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />

                    {/* STATUSES SECTION */}
                    <div className="space-y-4 pt-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                <ListChecks className="h-3 w-3" /> Status Workflow Options (One Choice)
                            </Label>
                        </div>
                        <div className="flex gap-2">
                            <Input 
                                placeholder="Add status step..." 
                                value={customStatusInput}
                                onChange={e => setCustomStatusInput(e.target.value)}
                                onKeyDown={e => { if(e.key === 'Enter') { e.preventDefault(); handleAddStatus(); } }}
                                className="h-11 rounded-xl bg-muted/30"
                            />
                            <Button type="button" onClick={handleAddStatus} variant="secondary" className="h-11 px-6 rounded-xl font-bold">
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-1">
                            <Badge variant="outline" className="bg-emerald-500/5 text-emerald-600 border-emerald-500/20 px-3 py-1 font-bold gap-1.5 opacity-60">
                                <CheckCircle2 className="h-3 w-3" /> Pending (Default)
                            </Badge>
                            <Badge variant="outline" className="bg-emerald-500/5 text-emerald-600 border-emerald-500/20 px-3 py-1 font-bold gap-1.5 opacity-60">
                                <CheckCircle2 className="h-3 w-3" /> Completed (Default)
                            </Badge>
                            {customStatuses.map((status) => (
                                <Badge key={status} className="bg-primary/10 text-primary hover:bg-primary/20 border-none px-3 py-1 font-bold gap-2 group transition-all">
                                    {status}
                                    <button type="button" onClick={() => removeStatus(status)} className="opacity-40 hover:opacity-100"><X className="h-3 w-3" /></button>
                                </Badge>
                            ))}
                        </div>
                    </div>

                    {/* TAGS SECTION */}
                    <div className="space-y-4 pt-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
                                <TagIcon className="h-3 w-3" /> Labeling Tags (Multiple Choices)
                            </Label>
                        </div>
                        <div className="flex gap-2">
                            <Input 
                                placeholder="Add tag label..." 
                                value={tagInput}
                                onChange={e => setTagInput(e.target.value)}
                                onKeyDown={e => { if(e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                                className="h-11 rounded-xl bg-muted/30"
                            />
                            <Button type="button" onClick={handleAddTag} variant="secondary" className="h-11 px-6 rounded-xl font-bold">
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-1">
                            {tags.map((tag) => (
                                <Badge key={tag} className="bg-indigo-500/10 text-indigo-600 border-none px-3 py-1 font-bold gap-2 group transition-all">
                                    {tag}
                                    <button type="button" onClick={() => removeTag(tag)} className="opacity-40 hover:opacity-100"><X className="h-3 w-3" /></button>
                                </Badge>
                            ))}
                            {tags.length === 0 && <p className="text-[10px] text-muted-foreground italic">Add tags for extra categorization (e.g. Urgent, Paid Shot, Interior Only).</p>}
                        </div>
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
                </div>
            </ScrollArea>

            <DialogFooter className="p-8 border-t bg-muted/5 mt-0">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)} className="rounded-xl h-11 px-6 font-bold">Cancel</Button>
              <Button type="submit" disabled={isLoading} className="rounded-xl h-11 px-10 glowing-btn font-black flex-1 sm:flex-none">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {serviceToEdit ? 'Update Service' : 'Create Service'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
