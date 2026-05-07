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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState } from 'react';
import type { Buyer, BuyerStatus, PriceUnit, PropertyType, SizeUnit, ListingType } from '@/lib/types';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';
import { buyerStatuses, punjabCities, countryCodes } from '@/lib/data';
import { Checkbox } from './ui/checkbox';
import { useUser } from '@/firebase/auth/use-user';
import { useProfile } from '@/context/profile-context';
import { formatPhoneNumber } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, Hash, Calendar, User, Phone, MapPin, Building, Ruler, Wallet, Tag } from 'lucide-react';

const propertyTypes: (PropertyType | 'Other')[] = [
    'House', 'Flat', 'Farm House', 'Penthouse', 'Plot', 'Residential Plot', 'Commercial Plot', 'Agricultural Land', 'Industrial Land', 'Office', 'Shop', 'Warehouse', 'Factory', 'Building', 'Residential Property', 'Commercial Property', 'Semi Commercial', 'Other'
];
const sizeUnits: SizeUnit[] = ['Marla', 'SqFt', 'Kanal', 'Acre', 'Maraba'];
const priceUnits: PriceUnit[] = ['Thousand', 'Lacs', 'Crore'];


const formSchema = z.object({
  id: z.string().optional(),
  serial_no: z.string().optional(),
  listing_type: z.enum(['For Sale', 'For Rent']),
  name: z.string().min(1, 'Buyer name is required'),
  country_code: z.string().default('+92'),
  phone: z.string().min(1, 'Phone number is required'),
  email: z.string().email().optional().or(z.literal('')),
  status: z.enum(buyerStatuses).default('New'),
  is_investor: z.boolean().optional().default(false),
  city: z.string().optional(),
  area_preference: z.string().optional(),
  property_type_preference: z.enum(propertyTypes).optional(),
  property_type_other: z.string().optional(),
  size_min_value: z.coerce.number().optional().nullable(),
  size_min_unit: z.enum(sizeUnits).optional(),
  size_max_value: z.coerce.number().optional().nullable(),
  size_max_unit: z.enum(sizeUnits).optional(),
  budget_min_amount: z.coerce.number().optional().nullable(),
  budget_min_unit: z.enum(priceUnits).optional(),
  budget_max_amount: z.coerce.number().optional().nullable(),
  budget_max_unit: z.enum(priceUnits).optional(),
  notes: z.string().optional(),
  tags: z.string().optional(),
  created_at: z.string().optional(),
  created_by: z.string().optional(),
});

type AddBuyerFormValues = z.infer<typeof formSchema>;

interface AddBuyerFormProps {
  setDialogOpen: (open: boolean) => void;
  totalSaleBuyers: number;
  totalRentBuyers: number;
  buyerToEdit?: Buyer | null;
  onSave: (buyer: Omit<Buyer, 'id'> & { id?: string }) => void;
  listingType: ListingType;
}

const getInitialFormValues = (
    listingType: ListingType, 
    totalSaleBuyers: number, 
    totalRentBuyers: number, 
    buyerToEdit: Buyer | null | undefined, 
    userId?: string
): AddBuyerFormValues => {
    if (buyerToEdit) {
        const phoneWithoutCode = buyerToEdit.phone.replace(buyerToEdit.country_code || '+92', '');
        const isOtherType = buyerToEdit.property_type_preference ? !propertyTypes.includes(buyerToEdit.property_type_preference) : false;

        return {
            ...buyerToEdit,
            country_code: buyerToEdit.country_code || '+92',
            phone: phoneWithoutCode,
            property_type_preference: isOtherType ? 'Other' : (buyerToEdit.property_type_preference || undefined),
            property_type_other: isOtherType ? buyerToEdit.property_type_preference : '',
            size_min_unit: buyerToEdit.size_min_unit || 'Marla',
            size_max_unit: buyerToEdit.size_max_unit || 'Marla',
            budget_min_unit: buyerToEdit.budget_min_unit || 'Lacs',
            budget_max_unit: buyerToEdit.budget_max_unit || 'Lacs',
            name: buyerToEdit.name || '',
            email: buyerToEdit.email || '',
            city: buyerToEdit.city || '',
            area_preference: buyerToEdit.area_preference || '',
            notes: buyerToEdit.notes || '',
            size_min_value: buyerToEdit.size_min_value ?? 0,
            size_max_value: buyerToEdit.size_max_value ?? 0,
            budget_min_amount: buyerToEdit.budget_min_amount ?? 0,
            budget_max_amount: buyerToEdit.budget_max_amount ?? 0,
            is_investor: buyerToEdit.is_investor || false,
            listing_type: buyerToEdit.listing_type || 'For Sale',
            tags: buyerToEdit.tags?.join(', ') || '',
        };
    }

    const serialPrefix = listingType === 'For Rent' ? 'RB' : 'B';
    const nextSerialNum = listingType === 'For Rent' ? totalRentBuyers + 1 : totalSaleBuyers + 1;

    return {
        name: '',
        listing_type: listingType,
        country_code: '+92',
        phone: '',
        email: '',
        city: 'Lahore',
        area_preference: '',
        property_type_preference: undefined,
        property_type_other: '',
        notes: '',
        status: 'New',
        is_investor: false,
        serial_no: `${serialPrefix}-${nextSerialNum}`,
        size_min_unit: 'Marla',
        size_max_unit: 'Marla',
        budget_min_unit: 'Lacs',
        budget_max_unit: 'Lacs',
        size_min_value: 0,
        size_max_value: 0,
        budget_min_amount: 0,
        budget_max_amount: 0,
        created_at: new Date().toISOString(),
        created_by: userId || '',
        tags: '',
    };
};


export function AddBuyerForm({ setDialogOpen, totalSaleBuyers, totalRentBuyers, buyerToEdit, onSave, listingType }: AddBuyerFormProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const { profile } = useProfile();
  const [countryCodePopoverOpen, setCountryCodePopoverOpen] = useState(false);
  
  const form = useForm<AddBuyerFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: getInitialFormValues(listingType, totalSaleBuyers, totalRentBuyers, buyerToEdit, user?.uid)
  });

  const { reset, setValue, watch, control } = form;
  const watchedPropertyType = watch('property_type_preference');

  useEffect(() => {
    if (!buyerToEdit) {
        setValue('listing_type', listingType);
        const serialPrefix = listingType === 'For Rent' ? 'RB' : 'B';
        const nextSerialNum = listingType === 'For Rent' ? totalRentBuyers + 1 : totalSaleBuyers + 1;
        setValue('serial_no', `${serialPrefix}-${nextSerialNum}`);
    }
  }, [listingType, totalSaleBuyers, totalRentBuyers, setValue, buyerToEdit]);

  useEffect(() => {
    if (buyerToEdit) {
        reset(getInitialFormValues(listingType, totalSaleBuyers, totalRentBuyers, buyerToEdit, user?.uid));
    }
  }, [buyerToEdit, reset, listingType, totalSaleBuyers, totalRentBuyers, user]);

  function onSubmit(values: AddBuyerFormValues) {
     const finalPropertyType = values.property_type_preference === 'Other' && values.property_type_other
        ? values.property_type_other
        : values.property_type_preference;

     const buyerData = {
        ...buyerToEdit,
        ...values,
        property_type_preference: finalPropertyType,
        phone: formatPhoneNumber(values.phone, values.country_code),
        serial_no: values.serial_no || '',
        created_at: buyerToEdit?.created_at || new Date().toISOString(),
        is_deleted: buyerToEdit?.is_deleted || false,
        created_by: buyerToEdit?.created_by || user?.uid || '',
        agency_id: buyerToEdit?.agency_id || profile.agency_id || '',
        tags: values.tags?.split(',').map(tag => tag.trim()).filter(Boolean) || [],
    };
    onSave(buyerData);
    setDialogOpen(false);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <FormField
                control={form.control}
                name="serial_no"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel className="flex items-center gap-2"><Hash className="h-3.5 w-3.5" /> Serial No</FormLabel>
                    <FormControl>
                        <Input {...field} value={field.value ?? ''} readOnly className="bg-muted/50 h-9" />
                    </FormControl>
                    </FormItem>
                )}
                />
                <FormItem>
                    <FormLabel className="flex items-center gap-2"><Calendar className="h-3.5 w-3.5" /> Date Added</FormLabel>
                    <Input value={new Date(form.getValues('created_at') || new Date()).toLocaleDateString()} readOnly className="bg-muted/50 h-9" />
                </FormItem>
            </div>
            
            <Separator />
            
            <div className="space-y-4">
                <h4 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider"><User className="h-4 w-4" /> Contact Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Buyer Name</FormLabel>
                        <FormControl>
                            <Input {...field} placeholder="e.g. Ali Khan" className="h-9" />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                     <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <div className="flex gap-2">
                           <FormField
                            control={form.control}
                            name="country_code"
                            render={({ field }) => (
                                <FormItem className="w-24">
                                <Popover open={countryCodePopoverOpen} onOpenChange={setCountryCodePopoverOpen}>
                                    <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button variant="outline" role="combobox" className="w-full justify-between h-9">
                                        {field.value || "Code"}
                                        </Button>
                                    </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-64 p-0">
                                    <Command>
                                        <CommandInput placeholder="Search code..." />
                                        <CommandList>
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
                            name="phone"
                            render={({ field }) => (
                                <FormItem className="flex-1">
                                    <FormControl>
                                        <Input {...field} placeholder="3001234567" className="h-9" />
                                    </FormControl>
                                </FormItem>
                            )}
                            />
                        </div>
                    </FormItem>
                </div>
                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Email Address (Optional)</FormLabel>
                        <FormControl>
                            <Input type="email" {...field} value={field.value ?? ''} placeholder="buyer@example.com" className="h-9" />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            <Separator />
            
            <div className="space-y-4">
                <h4 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider"><MapPin className="h-4 w-4" /> Preference Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="city"
                        render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>City</FormLabel>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button variant="outline" role="combobox" className={cn("w-full justify-between h-9", !field.value && "text-muted-foreground")}>
                                            {field.value || "Select city"}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                    <Command>
                                        <CommandInput placeholder="Search city..." />
                                        <CommandList>
                                            <CommandGroup>
                                                {punjabCities.map((city) => (
                                                    <CommandItem value={city} key={city} onSelect={() => form.setValue("city", city)}>
                                                        <Check className={cn("mr-2 h-4 w-4", city === field.value ? "opacity-100" : "opacity-0")} />
                                                        {city}
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
                    name="area_preference"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Preferred Areas</FormLabel>
                        <FormControl>
                            <Input {...field} value={field.value ?? ''} placeholder="e.g. DHA, Bahria, Gulberg" className="h-9" />
                        </FormControl>
                        </FormMessage />
                        </FormItem>
                    )}
                    />
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="property_type_preference"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Preferred Property Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                            <FormControl><SelectTrigger className="h-9"><SelectValue placeholder="Select type..." /></SelectTrigger></FormControl>
                            <SelectContent>{propertyTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                            </Select>
                        </FormItem>
                        )}
                    />
                    {watchedPropertyType === 'Other' && (
                        <FormField
                            control={form.control}
                            name="property_type_other"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Custom Property Type</FormLabel>
                                <FormControl><Input placeholder="e.g. Penthouse" {...field} className="h-9" /></FormControl>
                            </FormItem>
                            )}
                        />
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <FormLabel className="flex items-center gap-2"><Ruler className="h-3.5 w-3.5" /> Size Range</FormLabel>
                        <div className="grid grid-cols-2 gap-2">
                            <FormField control={form.control} name="size_min_value" render={({field}) => (
                                <FormItem><FormControl><Input type="number" {...field} value={field.value ?? 0} placeholder="Min" className="h-9" /></FormControl></FormItem>
                            )} />
                            <FormField control={form.control} name="size_max_value" render={({field}) => (
                                <FormItem><FormControl><Input type="number" {...field} value={field.value ?? 0} placeholder="Max" className="h-9" /></FormControl></FormItem>
                            )} />
                            <FormField control={form.control} name="size_min_unit" render={({field}) => (
                                <FormItem className="col-span-2">
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger className="h-9"><SelectValue/></SelectTrigger></FormControl>
                                        <SelectContent>{sizeUnits.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <FormLabel className="flex items-center gap-2"><Wallet className="h-3.5 w-3.5" /> Budget Range</FormLabel>
                        <div className="grid grid-cols-2 gap-2">
                            <FormField control={form.control} name="budget_min_amount" render={({field}) => (
                                <FormItem><FormControl><Input type="number" {...field} value={field.value ?? 0} placeholder="Min" className="h-9" /></FormControl></FormItem>
                            )} />
                            <FormField control={form.control} name="budget_max_amount" render={({field}) => (
                                <FormItem><FormControl><Input type="number" {...field} value={field.value ?? 0} placeholder="Max" className="h-9" /></FormControl></FormItem>
                            )} />
                            <FormField control={form.control} name="budget_min_unit" render={({field}) => (
                                <FormItem className="col-span-2">
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger className="h-9"><SelectValue/></SelectTrigger></FormControl>
                                        <SelectContent>{priceUnits.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                        </div>
                    </div>
                </div>
            </div>

            <Separator />

            <div className="space-y-4">
                <h4 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider"><Tag className="h-4 w-4" /> Status & Tags</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Lead Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger className="h-9"><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>{buyerStatuses.map(status => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
                        </Select>
                        </FormItem>
                    )}
                    />
                     <FormField
                        control={form.control}
                        name="is_investor"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-start space-x-3 space-y-0 rounded-md border p-3 shadow-sm h-10 mt-8 bg-background">
                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            <div className="space-y-1 leading-none"><FormLabel className="cursor-pointer">Mark as Investor</FormLabel></div>
                            </FormItem>
                        )}
                    />
                </div>
                <FormField
                  control={form.control}
                  name="tags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Custom Tags (comma separated)</FormLabel>
                      <FormControl><Input {...field} placeholder="e.g. Urgent, VIP, Hot Lead" className="h-9" /></FormControl>
                    </FormItem>
                  )}
                />
            </div>

            <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
                <FormItem>
                <FormLabel className="font-bold uppercase tracking-wider text-[10px] text-muted-foreground">Other Requirements / Notes</FormLabel>
                <FormControl><Textarea {...field} value={field.value ?? ''} placeholder="Any specific requirements or notes..." rows={3} /></FormControl>
                </FormItem>
            )}
            />

        <div className="flex justify-end gap-2 pt-6 border-t sticky bottom-0 bg-background pb-2">
          <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button type="submit" className="glowing-btn px-8">{buyerToEdit ? 'Save Changes' : 'Save Buyer'}</Button>
        </div>
      </form>
    </Form>
  );
}
