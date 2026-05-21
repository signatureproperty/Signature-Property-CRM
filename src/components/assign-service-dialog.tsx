'use client';

import { useState } from 'react';
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
import { Loader2, Zap, User, UserPlus, Phone, Check, ChevronsUpDown } from 'lucide-react';
import type { Service, Buyer } from '@/lib/types';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { countryCodes } from '@/lib/data';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { formatPhoneNumber } from '@/lib/utils';
import { ScrollArea } from './ui/scroll-area';

const formSchema = z.object({
  priceCharged: z.coerce.number().min(0, 'Amount is required'),
  assignedToType: z.enum(['Lead', 'External']).default('Lead'),
  leadId: z.string().optional(),
  externalName: z.string().optional(),
  country_code: z.string().default('+92'),
  externalPhone: z.string().optional(),
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
  const [countryCodePopoverOpen, setCountryCodePopoverOpen] = useState(false);

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
      externalName: '',
      country_code: '+92',
      externalPhone: '',
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
    
    if (values.assignedToType === 'External' && !values.externalName?.trim()) {
        toast({ title: 'Please provide client name', variant: 'destructive' });
        return;
    }

    setIsLoading(true);

    const lead = values.assignedToType === 'Lead' ? buyers?.find(b => b.id === values.leadId) : null;
    const clientName = (values.assignedToType === 'Lead' ? lead?.name : values.externalName) || 'Client';
    const formattedPhone = values.externalPhone ? formatPhoneNumber(values.externalPhone, values.country_code) : null;

    const colRef = collection(firestore, 'agencies', profile.agency_id, 'providedServices');
    const providedData = {
        serviceId: service.id,
        serviceName: service.name,
        priceCharged: values.priceCharged,
        assignedToType: values.assignedToType,
        leadId: values.leadId || null,
        leadName: lead?.name || null,
        externalName: values.externalName || null,
        externalPhone: formattedPhone,
        externalClientDetails: values.externalClientDetails || null,
        status: 'Pending',
        agency_id: profile.agency_id,
        created_at: new Date().toISOString(),
    };

    addDoc(colRef, providedData).catch(async () => {
        const permissionError = new FirestorePermissionError({
            path: colRef.path,
            operation: 'create',
            requestResourceData: providedData,
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
    });

    // Log Activity Non-blocking
    const activityColRef = collection(firestore, 'agencies', profile.agency_id, 'activityLogs');
    addDoc(activityColRef, {
        userName: profile.name,
        action: `assigned service "${service.name}" to ${clientName}`,
        target: service.name,
        targetType: 'Service',
        timestamp: new Date().toISOString(),
        agency_id: profile.agency_id,
    }).catch(() => {});

    toast({ title: 'Processing assignment...' });
    setIsLoading(false);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md border-none shadow-3xl rounded-[2rem] p-0 overflow-hidden max-h-[95vh] flex flex-col">
        <div className="p-6 pb-2 shrink-0">
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

        <ScrollArea className="flex-1">
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-6 pt-2">
                <div className="space-y-6">
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
                                                <SelectValue placeholder="Choose a lead by Name or Serial..." />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent className="rounded-xl shadow-2xl border-none max-h-60">
                                            {buyers?.filter(b => !b.is_deleted).map(b => (
                                                <SelectItem key={b.id} value={b.id}>
                                                    <span className="font-bold">{b.name}</span>
                                                    <span className="ml-2 text-[10px] opacity-60 font-mono">({b.serial_no})</span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )}
                        />
                    ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="externalName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">Client Name</FormLabel>
                                            <FormControl><Input placeholder="John Doe" {...field} className="h-11 rounded-xl" /></FormControl>
                                        </FormItem>
                                    )}
                                />
                                <div className="space-y-1">
                                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Phone Number</Label>
                                    <div className="flex gap-2">
                                        <FormField
                                            control={form.control}
                                            name="country_code"
                                            render={({ field }) => (
                                                <FormItem className="w-24">
                                                    <Popover open={countryCodePopoverOpen} onOpenChange={setCountryCodePopoverOpen}>
                                                        <PopoverTrigger asChild>
                                                            <FormControl>
                                                                <Button variant="outline" role="combobox" className="w-full justify-between h-11 px-2 rounded-xl">
                                                                    {field.value || "+92"}
                                                                    <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                                                                </Button>
                                                            </FormControl>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-64 p-0">
                                                            <Command>
                                                                <CommandInput placeholder="Search code..." />
                                                                <CommandList>
                                                                    <CommandEmpty>No country found.</CommandEmpty>
                                                                    <CommandGroup>
                                                                        {countryCodes.map((country) => (
                                                                            <CommandItem
                                                                                value={country.dial_code}
                                                                                key={country.code}
                                                                                onSelect={() => {
                                                                                    form.setValue("country_code", country.dial_code);
                                                                                    setCountryCodePopoverOpen(false);
                                                                                }}
                                                                            >
                                                                                <Check className={cn("mr-2 h-4 w-4", country.dial_code === field.value ? "opacity-100" : "opacity-0")} />
                                                                                {country.dial_code} ({country.code})
                                                                            </CommandItem>
                                                                        ))}
                                                                    </CommandGroup>
                                                                </CommandList>
                                                            </Command>
                                                        </PopoverContent>
                                                    </Popover>
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="externalPhone"
                                            render={({ field }) => (
                                                <FormItem className="flex-1">
                                                    <FormControl>
                                                        <Input placeholder="3001234567" {...field} className="h-11 rounded-xl" />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>
                            </div>
                            <FormField
                                control={form.control}
                                name="externalClientDetails"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">Requirements & Details</FormLabel>
                                        <FormControl>
                                            <Textarea 
                                                placeholder="Specific service requirements..." 
                                                {...field} 
                                                rows={3} 
                                                className="rounded-xl resize-none"
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </div>
                    )}
                </div>
                <DialogFooter className="pt-4 flex gap-2">
                    <Button type="button" variant="ghost" onClick={() => setIsOpen(false)} className="rounded-xl h-11 px-6 font-bold flex-1 sm:flex-none">Cancel</Button>
                    <Button type="submit" disabled={isLoading} className="rounded-xl h-11 px-8 glowing-btn font-black flex-1 sm:flex-none">
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
                        Confirm Sale
                    </Button>
                </DialogFooter>
            </form>
            </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
