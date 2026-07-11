'use client';
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Property, User, PriceUnit, Buyer } from '@/lib/types';
import { formatCurrency, formatUnit } from '@/lib/formatters';
import { useProfile } from '@/context/profile-context';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { useFirestore } from '@/firebase/provider';
import { useMemoFirebase } from '@/firebase/hooks';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';
import { Calculator, Check, ChevronsUpDown } from 'lucide-react';
import { useCurrency, Currency } from '@/context/currency-context';
import { Card, CardContent } from './ui/card';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  rent_out_date: z.string().refine(date => new Date(date).toString() !== 'Invalid Date', { message: 'Please select a valid date' }),
  rented_by_agent_id: z.string().min(1, "You must select the agent."),
  buyerId: z.string().optional(),
  final_rent_amount: z.coerce.number().positive("Final rent amount is required."),
  final_rent_unit: z.enum(['Thousand', 'Lacs', 'Crore']).default('Thousand'),
  rent_commission_from_tenant: z.coerce.number().min(0).optional(),
  rent_commission_from_tenant_unit: z.enum(['Thousand', 'Lacs', 'Crore']).default('Thousand'),
  rent_commission_from_owner: z.coerce.number().min(0).optional(),
  rent_commission_from_owner_unit: z.enum(['Thousand', 'Lacs', 'Crore']).default('Thousand'),
  rent_agent_share: z.coerce.number().min(0).optional(),
  rent_agent_share_unit: z.enum(['Thousand', 'Lacs', 'Crore']).default('Thousand'),
  tenant_name: z.string().min(1, 'Tenant name is required.'),
  tenant_phone: z.string().min(1, 'Tenant phone number is required.'),
  tenant_cnic: z.string().optional(),
  tenant_family_members: z.coerce.number().min(0).optional(),
});

type MarkAsRentOutFormValues = z.infer<typeof formSchema>;

interface MarkAsRentOutDialogProps {
  property: Property;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onUpdateProperty: (updatedProperty: Property) => void;
}

export function MarkAsRentOutDialog({
  property,
  isOpen,
  setIsOpen,
  onUpdateProperty,
}: MarkAsRentOutDialogProps) {
  const { toast } = useToast();
  const { profile } = useProfile();
  const { currency } = useCurrency();
  const firestore = useFirestore();

  const teamMembersQuery = useMemoFirebase(() => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'teamMembers') : null, [profile.agency_id, firestore]);
  const { data: teamMembers } = useCollection<User>(teamMembersQuery);
  const activeAgents = teamMembers?.filter(m => m.status === 'Active') || [];
  
  const buyersQuery = useMemoFirebase(() => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'buyers') : null, [profile.agency_id, firestore]);
  const { data: buyers } = useCollection<Buyer>(buyersQuery);
  
  const availableRentBuyers = useMemo(() => {
    return buyers?.filter(b => 
      b.status !== 'Deal Closed' && 
      !b.is_deleted && 
      b.listing_type === 'For Rent'
    ) || [];
  }, [buyers]);

  const form = useForm<MarkAsRentOutFormValues>({
    resolver: zodResolver(formSchema),
  });

  const watchFields = useWatch({ control: form.control });

  const totalCommission = useMemo(() => {
      const tenantCommission = formatUnit(watchFields.rent_commission_from_tenant || 0, (watchFields.rent_commission_from_tenant_unit as PriceUnit) || 'Thousand');
      const ownerCommission = formatUnit(watchFields.rent_commission_from_owner || 0, (watchFields.rent_commission_from_owner_unit as PriceUnit) || 'Thousand');
      return tenantCommission + ownerCommission;
  }, [watchFields.rent_commission_from_tenant, watchFields.rent_commission_from_tenant_unit, watchFields.rent_commission_from_owner, watchFields.rent_commission_from_owner_unit]);


  useEffect(() => {
    if (isOpen) {
        form.reset({
            rent_out_date: property.rent_out_date || new Date().toISOString().split('T')[0],
            rented_by_agent_id: property.rented_by_agent_id || '',
            buyerId: property.buyerId || '',
            final_rent_amount: property.final_rent_amount || property.demand_amount,
            final_rent_unit: (property.final_rent_unit || property.demand_unit) as PriceUnit,
            rent_commission_from_tenant: property.rent_commission_from_tenant || 0,
            rent_commission_from_tenant_unit: (property.rent_commission_from_tenant_unit as PriceUnit) || 'Thousand',
            rent_commission_from_owner: property.rent_commission_from_owner || 0,
            rent_commission_from_owner_unit: (property.rent_commission_from_owner_unit as PriceUnit) || 'Thousand',
            rent_agent_share: property.rent_agent_share || 0,
            rent_agent_share_unit: (property.rent_agent_share_unit as PriceUnit) || 'Thousand',
            tenant_name: property.tenant_name || '',
            tenant_phone: property.tenant_phone || '',
            tenant_cnic: property.tenant_cnic || '',
            tenant_family_members: property.tenant_family_members || 0,
        });
    }
  }, [isOpen, property, form]);

  async function onSubmit(values: MarkAsRentOutFormValues) {
    const buyer = values.buyerId ? availableRentBuyers.find(b => b.id === values.buyerId) : null;
    
    const updatedProperty: Property = {
        ...property,
        status: 'Rent Out',
        rent_out_date: values.rent_out_date,
        rented_by_agent_id: values.rented_by_agent_id,
        buyerId: buyer?.id || null,
        buyerName: buyer?.name || null,
        buyerSerialNo: buyer?.serial_no || null,
        final_rent_amount: values.final_rent_amount,
        final_rent_unit: values.final_rent_unit as PriceUnit,
        rent_commission_from_tenant: values.rent_commission_from_tenant,
        rent_commission_from_tenant_unit: values.rent_commission_from_tenant_unit as PriceUnit,
        rent_commission_from_owner: values.rent_commission_from_owner,
        rent_commission_from_owner_unit: values.rent_commission_from_owner_unit as PriceUnit,
        rent_total_commission: totalCommission,
        rent_agent_share: values.rent_agent_share,
        rent_agent_share_unit: values.rent_agent_share_unit as PriceUnit,
        tenant_name: values.tenant_name,
        tenant_phone: values.tenant_phone,
        tenant_cnic: values.tenant_cnic,
        tenant_family_members: values.tenant_family_members,
    };
    
    const batch = writeBatch(firestore);
    const propertyRef = doc(firestore, 'agencies', property.agency_id, 'properties', property.id);
    batch.set(propertyRef, updatedProperty, { merge: true });

    if (buyer) {
      const buyerRef = doc(firestore, 'agencies', buyer.agency_id, 'buyers', buyer.id);
      batch.update(buyerRef, { status: 'Deal Closed' });
    }

    if (profile.agency_id) {
        const activityLogRef = doc(collection(firestore, 'agencies', profile.agency_id, 'activityLogs'));
        const newActivity = {
            userName: profile.name,
            action: `marked property as "Rent Out"`,
            target: property.serial_no,
            targetType: 'Property',
            timestamp: new Date().toISOString(),
            agency_id: profile.agency_id,
            details: null,
        };
        batch.set(activityLogRef, newActivity);
    }
    
    await batch.commit();

    toast({
      title: 'Property Marked as Rent Out',
      description: `${property.auto_title} has been updated.`,
    });
    setIsOpen(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] sm:max-h-[95vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="font-headline">Mark Property as Rent Out</DialogTitle>
          <DialogDescription>
            Enter the final rental details for: {property.auto_title}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollArea className="h-[60vh] pr-4">
              <div className="space-y-6">
                <h4 className="text-sm font-medium text-muted-foreground">Rental Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="rent_out_date"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Rent Out Date</FormLabel>
                                <FormControl>
                                    <Input type="date" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="rented_by_agent_id"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Rented by Agent</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select an agent..." />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {activeAgents.map(agent => (
                                            <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="buyerId"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                            <FormLabel>Rented To</FormLabel>
                            <Popover>
                                <PopoverTrigger asChild>
                                <FormControl>
                                    <Button
                                    variant="outline"
                                    role="combobox"
                                    className={cn(
                                        "w-full justify-between",
                                        !field.value && "text-muted-foreground"
                                    )}
                                    >
                                    {field.value
                                        ? availableRentBuyers.find((buyer) => buyer.id === field.value)?.name
                                        : "Select a tenant..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                <Command>
                                    <CommandInput placeholder="Search tenant..." />
                                    <CommandList>
                                    <CommandEmpty>No tenants found.</CommandEmpty>
                                    <CommandGroup>
                                        {availableRentBuyers.map((buyer) => (
                                        <CommandItem
                                            value={buyer.name}
                                            key={buyer.id}
                                            onSelect={() => {
                                                form.setValue("buyerId", buyer.id)
                                            }}
                                        >
                                            <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                buyer.id === field.value ? "opacity-100" : "opacity-0"
                                            )}
                                            />
                                            {buyer.name} ({buyer.serial_no})
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
                     <div className="grid grid-cols-2 gap-2">
                        <FormField
                            control={form.control}
                            name="final_rent_amount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Final Rent Amount</FormLabel>
                                    <FormControl>
                                        <Input type="number" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="final_rent_unit"
                            render={({ field }) => (
                                <FormItem className="self-end">
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="Thousand">Thousand</SelectItem>
                                            <SelectItem value="Lacs">Lacs</SelectItem>
                                            <SelectItem value="Crore">Crore</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )}
                        />
                    </div>
                </div>

                <Separator />
                <h4 className="text-sm font-medium text-muted-foreground">Tenant Details</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <FormField
                        control={form.control}
                        name="tenant_name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Tenant Name</FormLabel>
                                <FormControl><Input {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="tenant_phone"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Tenant Phone</FormLabel>
                                <FormControl><Input {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="tenant_cnic"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Tenant CNIC</FormLabel>
                                <FormControl><Input {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="tenant_family_members"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Family Members</FormLabel>
                                <FormControl><Input type="number" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>


                <Separator />
                <h4 className="text-sm font-medium text-muted-foreground">Commission Details (PKR)</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid grid-cols-2 gap-2">
                        <FormField control={form.control} name="rent_commission_from_tenant" render={({field}) => (
                            <FormItem>
                            <FormLabel>From Tenant</FormLabel>
                            <FormControl><Input type="number" placeholder="e.g. 10000" {...field} /></FormControl>
                            <FormMessage />
                            </FormItem>
                        )} />
                         <FormField control={form.control} name="rent_commission_from_tenant_unit" render={({field}) => (
                            <FormItem className="self-end">
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="Thousand">Thousand</SelectItem>
                                        <SelectItem value="Lacs">Lacs</SelectItem>
                                        <SelectItem value="Crore">Crore</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )} />
                    </div>
                     <div className="grid grid-cols-2 gap-2">
                        <FormField control={form.control} name="rent_commission_from_owner" render={({field}) => (
                            <FormItem>
                            <FormLabel>From Owner</FormLabel>
                            <FormControl><Input type="number" placeholder="e.g. 10000" {...field} /></FormControl>
                            <FormMessage />
                            </FormItem>
                        )} />
                         <FormField control={form.control} name="rent_commission_from_owner_unit" render={({field}) => (
                            <FormItem className="self-end">
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="Thousand">Thousand</SelectItem>
                                        <SelectItem value="Lacs">Lacs</SelectItem>
                                        <SelectItem value="Crore">Crore</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )} />
                     </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                     <FormField control={form.control} name="rent_agent_share" render={({field}) => (
                        <FormItem>
                        <FormLabel>Agent's Share</FormLabel>
                        <FormControl><Input type="number" placeholder="e.g. 5000" {...field} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )} />
                     <FormField control={form.control} name="rent_agent_share_unit" render={({field}) => (
                        <FormItem className="self-end">
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="Thousand">Thousand</SelectItem>
                                    <SelectItem value="Lacs">Lacs</SelectItem>
                                    <SelectItem value="Crore">Crore</SelectItem>
                                </SelectContent>
                            </Select>
                        </FormItem>
                    )} />
                </div>
              </div>
            </ScrollArea>
            <div className="flex justify-between items-center gap-2 pt-6 border-t mt-6">
               <Card className="flex-1">
                    <CardContent className="p-3">
                        <div className="flex items-center gap-2">
                            <Calculator className="text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Total Commission:</p>
                            <p className="font-bold text-lg">{formatCurrency(totalCommission, currency as Currency)}</p>
                        </div>
                    </CardContent>
               </Card>
               <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                    Cancel
                </Button>
                <Button type="submit">Save & Mark as Rent Out</Button>
               </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
