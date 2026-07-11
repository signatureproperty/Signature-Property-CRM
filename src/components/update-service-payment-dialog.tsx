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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { useFirestore } from '@/firebase/provider';
import { doc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { useProfile } from '@/context/profile-context';
import { useToast } from '@/hooks/use-toast';
import { Loader2, DollarSign, Wallet, CreditCard, Banknote, Check } from 'lucide-react';
import type { ProvidedService, ServicePaymentStatus, ServicePaymentMethod } from '@/lib/types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { useCurrency } from '@/context/currency-context';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  paymentStatus: z.enum(['Pending', 'Partial', 'Paid']),
  paymentMethod: z.enum(['Cash', 'Online', 'N/A']),
  amountPaid: z.coerce.number().min(0, 'Amount must be positive'),
  paymentNote: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface UpdateServicePaymentDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  log: ProvidedService;
}

export function UpdateServicePaymentDialog({ isOpen, setIsOpen, log }: UpdateServicePaymentDialogProps) {
  const { profile } = useProfile();
  const { currency } = useCurrency();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      paymentStatus: log.paymentStatus || 'Pending',
      paymentMethod: log.paymentMethod || 'N/A',
      amountPaid: log.amountPaid || 0,
      paymentNote: log.paymentNote || '',
    },
  });

  useEffect(() => {
    if (isOpen) {
        form.reset({
            paymentStatus: log.paymentStatus || 'Pending',
            paymentMethod: log.paymentMethod || 'N/A',
            amountPaid: log.amountPaid || 0,
            paymentNote: log.paymentNote || '',
        });
    }
  }, [isOpen, log, form]);

  const onSubmit = async (values: FormValues) => {
    if (!profile.agency_id) return;
    setIsLoading(true);

    const docRef = doc(firestore, 'agencies', profile.agency_id, 'providedServices', log.id);
    
    const updateData: any = { ...values };
    if (values.paymentStatus === 'Paid') {
        updateData.paymentCompletedAt = new Date().toISOString();
    }
    
    // Update non-blocking
    updateDoc(docRef, updateData).catch(async () => {
        const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: values,
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
    });

    // Log Activity non-blocking
    const clientName = log.assignedToType === 'Lead' ? log.leadName : (log.externalName || log.externalClientDetails);
    const activityColRef = collection(firestore, 'agencies', profile.agency_id, 'activityLogs');
    addDoc(activityColRef, {
        userName: profile.name,
        action: `updated payment for "${log.serviceName}" to ${values.paymentStatus}`,
        target: clientName || 'Client',
        targetType: 'Service',
        timestamp: new Date().toISOString(),
        agency_id: profile.agency_id,
        details: { from: log.paymentStatus || 'None', to: values.paymentStatus }
    }).catch(() => {});

    toast({ title: 'Payment Details Updated' });
    setIsLoading(false);
    setIsOpen(false);
  };

  const remainingBalance = log.priceCharged - (form.watch('amountPaid') || 0);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md max-h-[70vh] sm:max-h-[90vh] border-none shadow-3xl rounded-[2rem] p-0 overflow-hidden">
        <div className="p-8 pb-2">
            <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-600">
                        <DollarSign className="h-6 w-6" />
                    </div>
                    <div>
                        <DialogTitle className="font-headline text-xl font-black">Record Payment</DialogTitle>
                        <DialogDescription className="text-xs font-medium">Manage accounting for <strong>{log.serviceName}</strong>.</DialogDescription>
                    </div>
                </div>
            </DialogHeader>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="px-8 space-y-6">
                <div className="p-4 rounded-2xl bg-muted/20 border border-border/40 flex justify-between items-center">
                    <div>
                        <p className="text-[9px] font-black uppercase text-muted-foreground opacity-60">Total Charged</p>
                        <p className="text-lg font-black text-foreground">{formatCurrency(log.priceCharged, currency)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[9px] font-black uppercase text-muted-foreground opacity-60">Balance Due</p>
                        <p className={cn("text-lg font-black", remainingBalance <= 0 ? "text-emerald-600" : "text-destructive")}>
                            {formatCurrency(remainingBalance, currency)}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="paymentStatus"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">Payment Status</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="h-11 rounded-xl">
                                            <SelectValue />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="rounded-xl border-none shadow-xl">
                                        <SelectItem value="Pending">Pending</SelectItem>
                                        <SelectItem value="Partial">Partial Payment</SelectItem>
                                        <SelectItem value="Paid">Fully Paid</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="paymentMethod"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">Method</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="h-11 rounded-xl">
                                            <SelectValue />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="rounded-xl border-none shadow-xl">
                                        <SelectItem value="N/A">Not Selected</SelectItem>
                                        <SelectItem value="Cash"><div className="flex items-center gap-2"><Banknote className="h-4 w-4"/> Cash</div></SelectItem>
                                        <SelectItem value="Online"><div className="flex items-center gap-2"><CreditCard className="h-4 w-4"/> Online</div></SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )}
                    />
                </div>

                <FormField
                    control={form.control}
                    name="amountPaid"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">Amount Received (PKR)</FormLabel>
                            <FormControl>
                                <Input 
                                    type="number" 
                                    placeholder="Enter amount..." 
                                    {...field} 
                                    className="h-12 rounded-xl font-bold text-lg bg-emerald-500/5 border-emerald-500/20" 
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="paymentNote"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">Internal Notes (Optional)</FormLabel>
                            <FormControl>
                                <Textarea 
                                    placeholder="Reference ID, bank details, or reason for partial payment..." 
                                    {...field} 
                                    rows={3} 
                                    className="rounded-xl resize-none bg-muted/20 border-none"
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
            </div>

            <DialogFooter className="p-8 border-t bg-muted/5 mt-4">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)} className="rounded-xl h-11 px-6 font-bold">Cancel</Button>
              <Button type="submit" disabled={isLoading} className="rounded-xl h-11 px-10 glowing-btn font-black flex-1 sm:flex-none">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                Confirm Payment
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
