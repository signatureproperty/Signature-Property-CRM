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
import { doc, addDoc, collection } from 'firebase/firestore';
import { useProfile } from '@/context/profile-context';
import { useToast } from '@/hooks/use-toast';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useMemoFirebase } from '@/firebase/hooks';
import { Loader2, Zap, User, UserPlus, Phone, Check, ChevronsUpDown, Building2, Search, Filter } from 'lucide-react';
import type { Service, Buyer, Property } from '@/lib/types';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { countryCodes } from '@/lib/data';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { formatPhoneNumber } from '@/lib/utils';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';

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
  const [leadPopoverOpen, setLeadPopoverOpen] = useState(false);
  const [activePrefixTab, setActivePrefixTab] = useState<string>('All');

  // Fetch Buyers
  const buyersQuery = useMemoFirebase(() => 
    profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'buyers') : null,
    [profile.agency_id, firestore]
  );
  const { data: buyers } = useCollection<Buyer>(buyersQuery);

  // Fetch Properties
  const propertiesQuery = useMemoFirebase(() => 
    profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'properties') : null,
    [profile.agency_id, firestore]
  );
  const { data: properties } = useCollection<Property>(propertiesQuery);

  // Combine and Filter Leads based on Service target and Tabs
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
                searchStr: `${b.name} ${b.serial_no} ${numPart}`.toLowerCase() 
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
                searchStr: `${p.auto_title} ${p.serial_no} ${numPart}`.toLowerCase()
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

  useEffect(() => {
    if (isOpen) {
        form.reset({
            priceCharged: service.price,
            assignedToType: 'Lead',
            leadId: '',
            externalName: '',
            country_code: '+92',
            externalPhone: '',
            externalClientDetails: '',
        });
        setActivePrefixTab('All');
    }
  }, [isOpen, service, form]);

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

    const colRef = collection(firestore, 'agencies', profile.agency_id, 'providedServices');
    const providedData = {
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
        status: 'Pending',
        agency_id: profile.agency_id,
        created_at: new Date().toISOString(),
        paymentStatus: 'Pending',
        amountPaid: 0,
    };

    addDoc(colRef, providedData).catch(async () => {
        const permissionError = new FirestorePermissionError({
            path: colRef.path,
            operation: 'create',
            requestResourceData: providedData,
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
    });

    // Log Activity
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
                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">Lead Lookup (Proper Serial Search)</FormLabel>
                                    <Popover open={leadPopoverOpen} onOpenChange={setLeadPopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    className={cn(
                                                        "w-full justify-between h-11 rounded-xl font-bold",
                                                        !field.value && "text-muted-foreground font-normal"
                                                    )}
                                                >
                                                    {field.value
                                                        ? applicableLeads.find((l) => l.id === field.value)?.name.substring(0, 30) + '...'
                                                        : "Search by Name or Number..."}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent 
                                            className="w-[--radix-popover-trigger-width] p-0 rounded-2xl overflow-hidden shadow-2xl border-none"
                                            onWheel={(e) => e.stopPropagation()}
                                        >
                                            <div className="bg-muted/30 p-2 border-b">
                                                <Tabs value={activePrefixTab} onValueChange={setActivePrefixTab}>
                                                    <TabsList className="grid grid-cols-5 h-9 bg-background/50 rounded-lg p-1">
                                                        <TabsTrigger 
                                                            value="All" 
                                                            className="text-[9px] font-black uppercase rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                                                        >
                                                            All
                                                        </TabsTrigger>
                                                        {availablePrefixes.map(p => (
                                                            <TabsTrigger 
                                                                key={p} 
                                                                value={p} 
                                                                className="text-[9px] font-black uppercase rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                                                            >
                                                                {p}
                                                            </TabsTrigger>
                                                        ))}
                                                    </TabsList>
                                                </Tabs>
                                            </div>
                                            <Command className="bg-background">
                                                <CommandInput placeholder="Type Name or Just Numbers..." className="h-11" />
                                                <CommandList>
                                                    <CommandEmpty className="py-6 text-center text-xs font-bold text-muted-foreground uppercase opacity-40">No matching records found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {applicableLeads.map((l) => (
                                                            <CommandItem
                                                                value={l.searchStr}
                                                                key={l.id}
                                                                onSelect={() => {
                                                                    form.setValue("leadId", l.id);
                                                                    setLeadPopoverOpen(false);
                                                                }}
                                                                className="flex items-center justify-between py-3 cursor-pointer"
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <Check
                                                                        className={cn(
                                                                            "h-4 w-4 text-primary",
                                                                            l.id === field.value ? "opacity-100" : "opacity-0"
                                                                        )}
                                                                    />
                                                                    <div className="flex flex-col">
                                                                        <span className="font-bold text-sm line-clamp-1">{l.name}</span>
                                                                        <span className="text-[9px] font-black text-muted-foreground uppercase flex items-center gap-1 opacity-60">
                                                                            {l.type === 'Buyer' ? <User className="h-2.5 w-2.5"/> : <Building2 className="h-2.5 w-2.5"/>} {l.type}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <Badge variant="outline" className="font-mono text-[9px] font-black bg-primary/5 text-primary border-primary/20">{l.serial}</Badge>
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
