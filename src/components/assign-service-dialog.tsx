
'use client';

import { useState, useMemo } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { useFirestore } from '@/firebase/provider';
import { doc, addDoc, collection } from 'firebase/firestore';
import { useProfile } from '@/context/profile-context';
import { useToast } from '@/hooks/use-toast';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useMemoFirebase } from '@/firebase/hooks';
import { Loader2, Zap, User, UserPlus, FileText } from 'lucide-react';
import type { Service, Buyer, AssignedToType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';

const formSchema = z.object({
  priceCharged: z.coerce.number().min(0, 'Amount is required'),
  assignedToType: z.enum(['Lead', 'External']).default('Lead'),
  leadId: z.string().optional(),
  externalClientDetails: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface AssignServiceDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  service: Service;
}

export function AssignServiceDialog({ isOpen, setIsOpen, service }: AssignServiceDialogProps) {
  const { profile } = useProfile();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const buyersQuery = useMemoFirebase(() => 
    profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'buyers') : null,
    [profile.agency_id, firestore]
  );
  const { data: buyers } = useCollection<Buyer>(buyersQuery);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      priceCharged: service.price,
      assignedToType: 'Lead',
      leadId: '',
      externalClientDetails: '',
    },
  });

  const watchedType = form.watch('assignedToType');

  const onSubmit = async (values: FormValues) => {
    if (!profile.agency_id) return;
    
    if (values.assignedToType === 'Lead' && !values.leadId) {
        toast({ title: 'Please select a lead', variant: 'destructive' });
        return;
    }
    
    if (values.assignedToType === 'External' && !values.externalClientDetails?.trim()) {
        toast({ title: 'Please provide client details', variant: 'destructive' });
        return;
    }

    setIsLoading(true);

    try {
        const lead = values.assignedToType === 'Lead' ? buyers?.find(b => b.id === values.leadId) : null;
        
        const colRef = collection(firestore, 'agencies', profile.agency_id, 'providedServices');
        await addDoc(colRef, {
            serviceId: service.id,
            serviceName: service.name,
            priceCharged: values.priceCharged,
            assignedToType: values.assignedToType,
            leadId: values.leadId || null,
            leadName: lead?.name || null,
            externalClientDetails: values.externalClientDetails || null,
            status: 'Pending',
            agency_id: profile.agency_id,
            created_at: new Date().toISOString(),
        });

        // Log Activity
        const activityColRef = collection(firestore, 'agencies', profile.agency_id, 'activityLogs');
        await addDoc(activityColRef, {
            userName: profile.name,
            action: `assigned service "${service.name}" to ${values.assignedToType === 'Lead' ? lead?.name : 'External Client'}`,
            target: service.name,
            targetType: 'Service',
            timestamp: new Date().toISOString(),
            agency_id: profile.agency_id,
        });

        toast({ title: 'Service Assigned Successfully' });
        setIsOpen(false);
    } catch (error) {
        toast({ title: 'Error assigning service', variant: 'destructive' });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md border-none shadow-3xl rounded-[2rem] p-0 overflow-hidden">
        <div className="p-6 pb-2">
            <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-primary/10 rounded-xl text-primary">
                        <Zap className="h-6 w-6" />
                    </div>
                    <div>
                        <DialogTitle className="font-headline text-xl font-black">Sell Service</DialogTitle>
                        <DialogDescription className="text-xs font-medium">Assign <strong>{service.name}</strong> to a client.</DialogDescription>
                    </div>
                </div>
            </DialogHeader>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="px-6 space-y-6">
                <FormField
                    control={form.control}
                    name="priceCharged"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">Price Charged (PKR)</FormLabel>
                        <FormControl><Input type="number" {...field} className="h-11 rounded-xl font-bold text-primary" /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Client Type</Label>
                    <FormField
                        control={form.control}
                        name="assignedToType"
                        render={({ field }) => (
                            <RadioGroup
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                className="grid grid-cols-2 gap-4"
                            >
                                <div>
                                    <RadioGroupItem value="Lead" id="lead" className="sr-only" />
                                    <Label
                                        htmlFor="lead"
                                        className={cn(
                                            "flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all",
                                            field.value === 'Lead' ? "border-primary bg-primary/5 text-primary" : "border-border opacity-60"
                                        )}
                                    >
                                        <User className="h-5 w-5 mb-1" />
                                        <span className="text-xs font-bold">Existing Lead</span>
                                    </Label>
                                </div>
                                <div>
                                    <RadioGroupItem value="External" id="external" className="sr-only" />
                                    <Label
                                        htmlFor="external"
                                        className={cn(
                                            "flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all",
                                            field.value === 'External' ? "border-primary bg-primary/5 text-primary" : "border-border opacity-60"
                                        )}
                                    >
                                        <UserPlus className="h-5 w-5 mb-1" />
                                        <span className="text-xs font-bold">External / New</span>
                                    </Label>
                                </div>
                            </RadioGroup>
                        )}
                    />
                </div>

                {watchedType === 'Lead' ? (
                    <FormField
                        control={form.control}
                        name="leadId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">Select Buyer Lead</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="h-11 rounded-xl">
                                            <SelectValue placeholder="Choose a lead..." />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="rounded-xl shadow-2xl border-none">
                                        {buyers?.filter(b => !b.is_deleted).map(b => (
                                            <SelectItem key={b.id} value={b.id}>{b.name} ({b.serial_no})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )}
                    />
                ) : (
                    <FormField
                        control={form.control}
                        name="externalClientDetails"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">Client Details & Notes</FormLabel>
                                <FormControl>
                                    <Textarea 
                                        placeholder="Name, Phone, and specific service requirements..." 
                                        {...field} 
                                        rows={4} 
                                        className="rounded-xl resize-none"
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                )}
            </div>

            <DialogFooter className="p-6 border-t bg-muted/5 mt-4">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)} className="rounded-xl h-11">Cancel</Button>
              <Button type="submit" disabled={isLoading} className="rounded-xl h-11 px-8 glowing-btn font-black flex-1 sm:flex-none">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                Assign Service
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function Check({ className }: { className?: string }) {
    return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M20 6 9 17l-5-5"/></svg>;
}
