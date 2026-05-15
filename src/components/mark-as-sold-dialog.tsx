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
import { Property, PriceUnit, User, Buyer, Activity } from '@/lib/types';
import { formatCurrency, formatUnit } from '@/lib/formatters';
import { useProfile } from '@/context/profile-context';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, addDoc, doc, writeBatch } from 'firebase/firestore';
import { useFirestore } from '@/firebase/provider';
import { useMemoFirebase } from '@/firebase/hooks';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';
import { Calculator, Check, ChevronsUpDown } from 'lucide-react';
import { useCurrency } from '@/context/currency-context';
import { Card, CardContent } from './ui/card';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from './ui/alert';

const priceUnitArray = ['Thousand', 'Lacs', 'Crore'] as const;

const formSchema = z.object({
  sold_price: z.coerce.number().positive("Sold price is required"),
  sold_price_unit: z.enum(['Lacs', 'Crore']),
  commission_from_buyer: z.coerce.number().min(0, "Commission cannot be negative").optional(),
  commission_from_buyer_unit: z.enum(['Thousand', 'Lacs', 'Crore']).default('Lacs'),
  commission_from_seller: z.coerce.number().min(0, "Commission cannot be negative").optional(),
  commission_from_seller_unit: z.enum(['Thousand', 'Lacs', 'Crore']).default('Lacs'),
  agent_commission_amount: z.coerce.number().min(0).optional(),
  agent_commission_unit: z.enum(['Thousand', 'Lacs', 'Crore']).default('Lacs'),
  agent_share_percentage: z.coerce.number().min(0).max(100).optional(),
  sale_date: z.string().refine(date => new Date(date).toString() !== 'Invalid Date', { message: 'Please select a valid date' }),
  sold_by_agent_id: z.string().min(1, "You must select the agent who sold the property."),
  buyerId: z.string().min(1, "You must select a buyer."),
});

type MarkAsSoldFormValues = z.infer<typeof formSchema>;

interface MarkAsSoldDialogProps {
  property: Property;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onUpdateProperty: (updatedProperty: Property) => void;
}

export function MarkAsSoldDialog({
  property,
  isOpen,
  setIsOpen,
  onUpdateProperty,
}: MarkAsSoldDialogProps) {
  const { toast } = useToast();
  const { profile } = useProfile();
  const { currency } = useCurrency();
  const firestore = useFirestore();

  const teamMembersQuery = useMemoFirebase(() => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'teamMembers') : null, [profile.agency_id, firestore]);
  const { data: teamMembers } = useCollection<User>(teamMembersQuery);
  const activeAgents = teamMembers?.filter(m => m.status === 'Active') || [];
  
  const buyersQuery = useMemoFirebase(() => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'buyers') : null, [profile.agency_id, firestore]);
  const { data: buyers } = useCollection<Buyer>(buyersQuery);
  
  const availableBuyers = useMemo(() => {
    return buyers?.filter(b => 
      b.status !== 'Deal Closed' && 
      !b.is_deleted && 
      (!b.listing_type || b.listing_type === 'For Sale')
    ) || [];
  }, [buyers]);


  const form = useForm<MarkAsSoldFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      sold_price: property.demand_amount,
      sold_price_unit: property.demand_unit as 'Lacs' | 'Crore',
      sale_date: new Date().toISOString().split('T')[0],
      commission_from_buyer_unit: 'Lacs',
      commission_from_seller_unit: 'Lacs',
      agent_commission_unit: 'Lacs',
    },
  });

  const watchFields = useWatch({ control: form.control });
  const { setValue } = form;

  const totalCommission = useMemo(() => {
      const buyerCommissionAmount = watchFields.commission_from_buyer || 0;
      const buyerCommissionUnit = (watchFields.commission_from_buyer_unit as PriceUnit) || 'Lacs';
      const sellerCommissionAmount = watchFields.commission_from_seller || 0;
      const sellerCommissionUnit = (watchFields.commission_from_seller_unit as PriceUnit) || 'Lacs';

      const buyerCommissionBase = formatUnit(buyerCommissionAmount, buyerCommissionUnit);
      const sellerCommissionBase = formatUnit(sellerCommissionAmount, sellerCommissionUnit);
      
      return buyerCommissionBase + sellerCommissionBase;
  }, [watchFields.commission_from_buyer, watchFields.commission_from_buyer_unit, watchFields.commission_from_seller, watchFields.commission_from_seller_unit]);
  
   useEffect(() => {
    const agentCommissionAmount = watchFields.agent_commission_amount || 0;
    const agentCommissionUnit = (watchFields.agent_commission_unit as PriceUnit) || 'Lacs';

    if (totalCommission > 0 && agentCommissionAmount > 0) {
      const agentCommissionBase = formatUnit(agentCommissionAmount, agentCommissionUnit);
      const percentage = (agentCommissionBase / totalCommission) * 100;
      setValue('agent_share_percentage', parseFloat(percentage.toFixed(2)));
    } else {
      setValue('agent_share_percentage', 0);
    }
  }, [watchFields.agent_commission_amount, watchFields.agent_commission_unit, totalCommission, setValue]);


  useEffect(() => {
    if (isOpen) {
        form.reset({
            sold_price: property.demand_amount,
            sold_price_unit: property.demand_unit as 'Lacs' | 'Crore',
            sale_date: new Date().toISOString().split('T')[0],
            sold_by_agent_id: '',
            commission_from_buyer: 0,
            commission_from_buyer_unit: 'Lacs',
            commission_from_seller: 0,
            commission_from_seller_unit: 'Lacs',
            agent_commission_amount: 0,
            agent_commission_unit: 'Lacs',
            agent_share_percentage: 0,
            buyerId: '',
        });
    }
  }, [isOpen, property, form]);

  const handleSoldExternally = async () => {
    if (!profile.agency_id) return;
    const batch = writeBatch(firestore);

    const propertyRef = doc(firestore, 'agencies', profile.agency_id, 'properties', property.id);
    batch.update(propertyRef, { status: 'Sold (External)', sold_externally_date: new Date().toISOString() });

    const activityLogRef = doc(collection(firestore, 'agencies', profile.agency_id, 'activityLogs'));
    const newActivity: Omit<Activity, 'id'> = {
      userName: profile.name,
      action: 'marked property as sold externally',
      target: property.serial_no,
      targetType: 'Property',
      details: null,
      timestamp: new Date().toISOString(),
      agency_id: profile.agency_id,
    };
    batch.set(activityLogRef, newActivity);
    
    await batch.commit();

    toast({
        title: 'Property Status Updated',
        description: `${property.serial_no} has been marked as "Sold (External)".`,
    });
    setIsOpen(false);
  };

  async function onSubmit(values: MarkAsSoldFormValues) {
    const agent = activeAgents.find(a => a.id === values.sold_by_agent_id);
    const buyer = availableBuyers.find(b => b.id === values.buyerId);
    if (!agent || !buyer) return;

    const soldPriceInBaseUnit = formatUnit(values.sold_price, values.sold_price_unit);

    const updatedProperty: Property = {
        ...property,
        status: 'Sold',
        sold_price: soldPriceInBaseUnit,
        sold_price_unit: values.sold_price_unit,
        sale_date: values.sale_date,
        sold_by_agent_id: values.sold_by_agent_id,
        buyerId: buyer.id,
        buyerName: buyer.name,
        buyerSerialNo: buyer.serial_no,
        commission_from_buyer: values.commission_from_buyer,
        commission_from_buyer_unit: values.commission_from_buyer_unit as PriceUnit,
        commission_from_seller: values.commission_from_seller,
        commission_from_seller_unit: values.commission_from_seller_unit as PriceUnit,
        total_commission: totalCommission,
        agent_commission_amount: values.agent_commission_amount,
        agent_commission_unit: values.agent_commission_unit as PriceUnit,
        agent_share_percentage: values.agent_share_percentage,
    };
    
    const batch = writeBatch(firestore);
    
    const propertyRef = doc(firestore, 'agencies', property.agency_id, 'properties', property.id);
    batch.set(propertyRef, updatedProperty);

    const buyerRef = doc(firestore, 'agencies', buyer.agency_id, 'buyers', buyer.id);
    batch.update(buyerRef, { status: 'Deal Closed' });

    if (profile.agency_id) {
        const activityLogRef = doc(collection(firestore, 'agencies', profile.agency_id, 'activityLogs'));
        const newActivity = {
            userName: profile.name,
            action: `marked property as "Sold" to ${buyer.name}`,
            target: `${property.serial_no} for ${formatCurrency(soldPriceInBaseUnit, currency)}`,
            targetType: 'Property',
            timestamp: new Date().toISOString(),
            agency_id: profile.agency_id,
            details: null,
        };
        batch.set(activityLogRef, newActivity);
    }
    
    await batch.commit();
    
    toast({
      title: 'Property Marked as Sold',
      description: `${property.auto_title} has been updated and buyer status is now Deal Closed.`,
    });
    setIsOpen(false);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-headline">Mark Property as Sold</DialogTitle>
          <DialogDescription>
            Enter the final sale details for: {property.auto_title}.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
          <AlertDescription>
            If this property was sold by another party, you can mark it as sold externally.
          </AlertDescription>
          <Button variant="outline" size="sm" className="mt-2" onClick={handleSoldExternally}>Sold by Other Party</Button>
        </Alert>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollArea className="h-[60vh] pr-4">
              <div className="space-y-6">
                <h4 className="text-sm font-medium text-muted-foreground">Sale Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid grid-cols-2 gap-2">
                        <FormField
                        control={form.control}
                        name="sold_price"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Final Sold Price</FormLabel>
                            <FormControl>
                                <Input type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <FormField
                        control={form.control}
                        name="sold_price_unit"
                        render={({ field }) => (
                            <FormItem className="self-end">
                            <FormLabel className="sr-only">Unit</FormLabel>
                            <FormControl>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger className="mt-8">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Lacs">Lacs</SelectItem>
                                        <SelectItem value="Crore">Crore</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                    </div>
                     <FormField
                        control={form.control}
                        name="sale_date"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Sale Date</FormLabel>
                                <FormControl>
                                    <Input type="date" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="sold_by_agent_id"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Sold by Agent</FormLabel>
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
                     <FormField
                        control={form.control}
                        name="buyerId"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                            <FormLabel>Sold to Buyer</FormLabel>
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
                                        ? availableBuyers.find((buyer) => buyer.id === field.value)?.name
                                        : "Select a buyer..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                <Command>
                                    <CommandInput placeholder="Search buyer..." />
                                    <CommandList>
                                    <CommandEmpty>No buyers found.</CommandEmpty>
                                    <CommandGroup>
                                        {availableBuyers.map((buyer) => (
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
                </div>

                <Separator />
                <h4 className="text-sm font-medium text-muted-foreground">Commission Details</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="grid grid-cols-2 gap-2">
                        <FormField control={form.control} name="commission_from_buyer" render={({field}) => (
                            <FormItem>
                            <FormLabel>From Buyer</FormLabel>
                            <FormControl><Input type="number" placeholder="e.g. 2" {...field} /></FormControl>
                            <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="commission_from_buyer_unit" render={({field}) => (
                            <FormItem className="self-end">
                            <FormLabel className="sr-only">Unit</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {priceUnitArray.map(unit => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )} />
                     </div>
                    <div className="grid grid-cols-2 gap-2">
                         <FormField control={form.control} name="commission_from_seller" render={({field}) => (
                            <FormItem>
                            <FormLabel>From Seller</FormLabel>
                            <FormControl><Input type="number" placeholder="e.g. 2" {...field} /></FormControl>
                            <FormMessage />
                            </FormItem>
                        )} />
                         <FormField control={form.control} name="commission_from_seller_unit" render={({field}) => (
                            <FormItem className="self-end">
                            <FormLabel className="sr-only">Unit</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {priceUnitArray.map(unit => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )} />
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid grid-cols-2 gap-2">
                        <FormField control={form.control} name="agent_commission_amount" render={({field}) => (
                            <FormItem>
                                <FormLabel>Agent's Commission</FormLabel>
                                <FormControl><Input type="number" {...field} placeholder="e.g. 2" /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                         <FormField control={form.control} name="agent_commission_unit" render={({field}) => (
                            <FormItem className="self-end">
                            <FormLabel className="sr-only">Unit</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {priceUnitArray.map(unit => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )} />
                    </div>
                    <FormField control={form.control} name="agent_share_percentage" render={({field}) => (
                        <FormItem>
                            <FormLabel>Agent's Share (%)</FormLabel>
                            <FormControl><Input type="number" {...field} readOnly className="bg-muted/50" /></FormControl>
                            <FormMessage />
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
                            <p className="font-bold text-lg">{formatCurrency(totalCommission, currency)}</p>
                        </div>
                    </CardContent>
               </Card>
               <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                    Cancel
                </Button>
                <Button type="submit">Save & Mark as Sold</Button>
               </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
