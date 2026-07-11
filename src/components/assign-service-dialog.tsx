'use client';

import { useState, useMemo, useEffect } from 'react';
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
import { doc, addDoc, updateDoc, collection } from 'firebase/firestore';
import { useProfile } from '@/context/profile-context';
import { useToast } from '@/hooks/use-toast';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useMemoFirebase } from '@/firebase/hooks';
import { Loader2, Zap, User, UserPlus, Phone, Check, ChevronsUpDown, Building2, Search, Filter, Hash } from 'lucide-react';
import type { Service, Buyer, Property, ProvidedService } from '@/lib/types';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { countryCodes } from '@/lib/data';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandList, CommandItem } from './ui/command';
import { formatPhoneNumber } from '@/lib/utils';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { useCurrency } from '@/context/currency-context';
import { formatCurrency } from '@/lib/formatters';

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
  logToEdit?: ProvidedService | null;
}

export function AssignServiceDialog({ isOpen, setIsOpen, service, logToEdit }: AssignServiceDialogProps) {
  const { profile } = useProfile();
  const { currency } = useCurrency();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [countryCodePopoverOpen, setCountryCodePopoverOpen] = useState(false);
  const [leadPopoverOpen, setLeadPopoverOpen] = useState(false);
  const [activePrefixTab, setActivePrefixTab] = useState<string>('All');

  const buyersQuery = useMemoFirebase(() => 
    profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'buyers') : null,
    [profile.agency_id, firestore]
  );
  const { data: buyers } = useCollection<Buyer>(buyersQuery);

  const propertiesQuery = useMemoFirebase(() => 
    profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'properties') : null,
    [profile.agency_id, firestore]
  );
  const { data: properties } = useCollection<Property>(propertiesQuery);

  const applicableLeads = useMemo(() => {
    const list: Array<{ id: string; name: string; serial: string; type: 'Buyer' | 'Property'; searchStr: string }> = [];
    
    const target = service.applicableTo || 'Both';

    if (target === 'Buyers' || target === 'Both') {
        buyers?.filter(b => !b.is_deleted).forEach(b => {
            const numPart = b.serial_no.split('-')[1] || '';
            list.push({ 
                id: b.id, 
                name: b.name, 
                serial: b.serial_no, 
                type: 'Buyer',
                searchStr: `${b.serial_no} ${numPart} ${b.name}`.toLowerCase() 
            });
        });
    }

    if (target === 'Properties' || target === 'Both') {
        properties?.filter(p => !p.is_deleted).forEach(p => {
            const numPart = p.serial_no.split('-')[1] || '';
            list.push({ 
                id: p.id, 
                name: p.auto_title, 
                serial: p.serial_no, 
                type: 'Property',
                searchStr: `${p.serial_no} ${numPart} ${p.auto_title}`.toLowerCase()
            });
        });
    }

    let filtered = list;
    if (activePrefixTab !== 'All') {
        filtered = list.filter(l => l.serial.startsWith(activePrefixTab + '-'));
    }

    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [buyers, properties, service.applicableTo, activePrefixTab]);

  const availablePrefixes = useMemo(() => {
    const target = service.applicableTo || 'Both';
    if (target === 'Buyers') return ['B', 'RB'];
    if (target === 'Properties') return ['P', 'RP'];
    return ['B', 'RB', 'P', 'RP'];
  }, [service.applicableTo]);

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

  const parsePhone = (fullPhone: string | null | undefined) => {
    if (!fullPhone) return { countryCode: '+92', localNumber: '' };
    const cleaned = fullPhone.replace(/[\s\-()]/g, '');
    const match = cleaned.match(/^\+(\d{2,3})(\d{7,})$/);
    if (match) return { countryCode: '+' + match[1], localNumber: match[2] };
    return { countryCode: '+92', localNumber: cleaned.replace(/^\+?\d{1,3}/, '') };
  };

  useEffect(() => {
    if (isOpen) {
        if (logToEdit) {
            const { countryCode, localNumber } = parsePhone(logToEdit.externalPhone);
            form.reset({
                priceCharged: logToEdit.priceCharged,
                assignedToType: logToEdit.assignedToType,
                leadId: logToEdit.leadId || '',
                externalName: logToEdit.externalName || '',
                country_code: countryCode,
                externalPhone: localNumber,
                externalClientDetails: logToEdit.externalClientDetails || '',
            });
        } else {
            form.reset({
                priceCharged: service.price,
                assignedToType: 'Lead',
                leadId: '',
                externalName: '',
                country_code: '+92',
                externalPhone: '',
                externalClientDetails: '',
            });
        }
        setActivePrefixTab('All');
    }
  }, [isOpen, service, logToEdit, form]);

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

    const lead = values.assignedToType === 'Lead' ? applicableLeads.find(l => l.id === values.leadId) : null;
    const clientName = lead ? lead.name : (values.externalName || 'Client');
    const formattedPhone = values.externalPhone ? formatPhoneNumber(values.externalPhone, values.country_code) : null;

    const updateData: any = {
        serviceId: service.id,
        serviceName: service.name,
        priceCharged: values.priceCharged,
        assignedToType: values.assignedToType,
        leadId: values.leadId || null,
        leadName: clientName,
        leadType: lead?.type || null,
        externalName: values.externalName || null,
        externalPhone: formattedPhone,
        externalClientDetails: values.externalClientDetails || null,
    };

    if (logToEdit) {
        const docRef = doc(firestore, 'agencies', profile.agency_id, 'providedServices', logToEdit.id);
        updateDoc(docRef, updateData).catch(async () => {
            const permissionError = new FirestorePermissionError({
                path: docRef.path,
                operation: 'update',
                requestResourceData: updateData,
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
        });
    } else {
        updateData.status = 'Pending';
        updateData.agency_id = profile.agency_id;
        updateData.created_at = new Date().toISOString();
        updateData.paymentStatus = 'Pending';
        updateData.amountPaid = 0;
        const colRef = collection(firestore, 'agencies', profile.agency_id, 'providedServices');
        addDoc(colRef, updateData).catch(async () => {
            const permissionError = new FirestorePermissionError({
                path: colRef.path,
                operation: 'create',
                requestResourceData: updateData,
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
        });
    }

    const activityColRef = collection(firestore, 'agencies', profile.agency_id, 'activityLogs');
    addDoc(activityColRef, {
        userName: profile.name,
        action: `sold service "${service.name}" to ${clientName}`,
        target: service.name,
        targetType: 'Service',
        timestamp: new Date().toISOString(),
        agency_id: profile.agency_id,
    }).catch(() => {});

    toast({ title: 'Service assigned successfully' });
    setIsLoading(false);
    setIsOpen(false);
  };

  const currentSearchPlaceholder = useMemo(() => {
    if (activePrefixTab === 'All') return "Type Name or Numbers...";
    return `Searching ${activePrefixTab}- (type number only)`;
  }, [activePrefixTab]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-lg border-none shadow-3xl rounded-[2rem] p-0 overflow-hidden max-h-[80vh] sm:max-h-[95vh] flex flex-col">
        <div className="p-6 pb-2 shrink-0">
            <DialogHeader>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-primary/10 rounded-xl text-primary">
                        <Zap className="h-6 w-6" />
                    </div>
                    <div>
                        <DialogTitle className="font-headline text-xl font-black">{logToEdit ? 'Edit Service' : 'Sell Service'}</DialogTitle>
                        <DialogDescription className="text-xs font-medium">{logToEdit ? `Editing ${service.name}` : `Assign ${service.name} to a client.`}</DialogDescription>
                    </div>
                </div>
            </DialogHeader>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto touch-pan-y">
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-6 pt-2">
                <div className="space-y-6">
                    <FormField
                        control={form.control}
                        name="priceCharged"
                        render={({ field }) => (
                            <FormItem>
                            <div className="flex justify-between items-center">
                                <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">Price Charged (PKR)</FormLabel>
                                <span className="text-[9px] font-bold text-muted-foreground bg-muted/50 px-2 rounded-full border border-border/40">Catalog Price: {formatCurrency(service.price, currency)}</span>
                            </div>
                            <FormControl><Input type="number" {...field} className="h-11 rounded-xl font-bold text-primary" /></FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Client Selection</Label>
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
                                            <span className="text-xs font-bold text-center">Existing Lead/Owner</span>
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
                                            <span className="text-xs font-bold text-center">External Client</span>
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
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2">
                                        <Hash className="h-3 w-3" /> Lead Selection & Quick Serial Search
                                    </FormLabel>
                                    <Popover open={leadPopoverOpen} onOpenChange={setLeadPopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    className={cn(
                                                        "w-full justify-between h-11 rounded-xl font-bold text-left",
                                                        !field.value && "text-muted-foreground font-normal"
                                                    )}
                                                >
                                                    <span className="truncate">
                                                        {field.value
                                                            ? applicableLeads.find((l) => l.id === field.value)?.name
                                                            : "Search by Name or Number..."}
                                                    </span>
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent 
                                            className="w-[--radix-popover-trigger-width] p-0 rounded-2xl overflow-hidden shadow-2xl border-none bg-background"
                                            onWheel={(e) => e.stopPropagation()}
                                            align="start"
                                        >
                                            <div className="bg-muted/40 p-2 border-b">
                                                <Tabs value={activePrefixTab} onValueChange={setActivePrefixTab} className="w-full">
                                                    <TabsList className="grid grid-cols-5 h-10 bg-background/50 rounded-xl p-1 gap-1">
                                                        <TabsTrigger 
                                                            value="All" 
                                                            className="text-[10px] font-black uppercase rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
                                                        >
                                                            All
                                                        </TabsTrigger>
                                                        {availablePrefixes.map(p => (
                                                            <TabsTrigger 
                                                                key={p} 
                                                                value={p} 
                                                                className="text-[10px] font-black uppercase rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
                                                            >
                                                                {p}
                                                            </TabsTrigger>
                                                        ))}
                                                    </TabsList>
                                                </Tabs>
                                            </div>
                                            <Command className="bg-transparent" shouldFilter={true}>
                                                <div className="flex items-center px-3 border-b bg-background">
                                                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-40" />
                                                    <CommandInput 
                                                        placeholder={currentSearchPlaceholder} 
                                                        className="h-11 bg-transparent w-full focus:ring-0 border-none" 
                                                    />
                                                </div>
                                                <CommandList className="max-h-64 overflow-y-auto">
                                                    <CommandEmpty className="py-8 text-center text-xs font-bold text-muted-foreground uppercase opacity-40">No matches found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {applicableLeads.map((l) => (
                                                            <CommandItem
                                                                value={l.searchStr}
                                                                key={l.id}
                                                                onSelect={() => {
                                                                    form.setValue("leadId", l.id);
                                                                    setLeadPopoverOpen(false);
                                                                }}
                                                                className="flex items-center justify-between py-3 px-4 cursor-pointer hover:bg-primary/5 transition-colors"
                                                            >
                                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                                    <div className={cn(
                                                                        "h-4 w-4 rounded-full border-2 flex items-center justify-center transition-all",
                                                                        l.id === field.value ? "border-primary bg-primary" : "border-muted-foreground/30"
                                                                    )}>
                                                                        {l.id === field.value && <Check className="h-2.5 w-2.5 text-white" />}
                                                                    </div>
                                                                    <div className="flex flex-col min-w-0">
                                                                        <span className="font-bold text-sm truncate">{l.name}</span>
                                                                        <span className="text-[9px] font-black text-muted-foreground uppercase flex items-center gap-1 opacity-60">
                                                                            {l.type === 'Buyer' ? <User className="h-2.5 w-2.5"/> : <Building2 className="h-2.5 w-2.5"/>} {l.type}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <Badge variant="outline" className="font-mono text-[10px] font-black bg-primary/5 text-primary border-primary/20 shrink-0">
                                                                    {l.serial}
                                                                </Badge>
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
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
                                                <FormItem className="w-20">
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
            </form>
            </Form>
        </div>
        <div className="p-6 pt-0 shrink-0 border-t bg-background">
            <DialogFooter className="pt-4 flex gap-2">
                <Button type="button" variant="ghost" onClick={() => setIsOpen(false)} className="rounded-xl h-11 px-6 font-bold flex-1 sm:flex-none">Cancel</Button>
                <Button type="submit" disabled={isLoading} className="rounded-xl h-11 px-8 glowing-btn font-black flex-1 sm:flex-none" onClick={form.handleSubmit(onSubmit)}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
                    {logToEdit ? 'Update' : 'Confirm Sale'}
                </Button>
            </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
