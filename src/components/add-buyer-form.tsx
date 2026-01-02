
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
import { Check, ChevronsUpDown } from 'lucide-react';

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


export function AddBuyerForm({ setDialogOpen, totalSaleBuyers, totalRentBuyers, buyerToEdit, onSave }: AddBuyerFormProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const { profile } = useProfile();
  const [countryCodePopoverOpen, setCountryCodePopoverOpen] = useState(false);
  
  const form = useForm<AddBuyerFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: getInitialFormValues('For Sale', totalSaleBuyers, totalRentBuyers, buyerToEdit, user?.uid)
  });

  const { reset, setValue, watch, control } = form;
  const watchedListingType = watch('listing_type');
  const watchedPropertyType = watch('property_type_preference');

  useEffect(() => {
    // Only update serial number for new buyers when listing type changes
    if (!buyerToEdit) {
        const serialPrefix = watchedListingType === 'For Rent' ? 'RB' : 'B';
        const nextSerialNum = watchedListingType === 'For Rent' ? totalRentBuyers + 1 : totalSaleBuyers + 1;
        setValue('serial_no', `${serialPrefix}-${nextSerialNum}`);
    }
  }, [watchedListingType, totalSaleBuyers, totalRentBuyers, setValue, buyerToEdit]);

  useEffect(() => {
    reset(getInitialFormValues(watchedListingType, totalSaleBuyers, totalRentBuyers, buyerToEdit, user?.uid));
  }, [buyerToEdit, totalSaleBuyers, totalRentBuyers, user, profile.agency_id, reset, watchedListingType]);

  function onSubmit(values: AddBuyerFormValues) {
     const finalPropertyType = values.property_type_preference === 'Other' && values.property_type_other
        ? values.property_type_other
        : values.property_type_preference;

     const buyerData = {
        ...buyerToEdit, // Keep original data like ID, created_at, etc.
        ...values, // Overwrite with new form values
        property_type_preference: finalPropertyType,
        phone: formatPhoneNumber(values.phone, values.country_code),
        serial_no: form.getValues('serial_no'), // Use the dynamically set serial number
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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <ScrollArea className="h-[60vh] pr-6 -mr-6">
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                    control={form.control}
                    name="serial_no"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Serial No</FormLabel>
                        <FormControl>
                            <Input {...field} value={field.value ?? ''} readOnly className="bg-muted/50" />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormItem>
                        <FormLabel>Date</FormLabel>
                        <Input value={new Date(form.getValues('created_at') || new Date()).toLocaleDateString()} readOnly className="bg-muted/50" />
                    </FormItem>
                </div>
                
                <Separator />
                <h4 className="text-sm font-medium text-muted-foreground">Contact Information</h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <FormField
                        control={form.control}
                        name="listing_type"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Buyer Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select buyer type" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                <SelectItem value="For Sale">For Sale</SelectItem>
                                <SelectItem value="For Rent">For Rent</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                    <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                            <Input {...field} placeholder="e.g. Ali Khan" />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                   
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <div className="flex gap-2">
                           <FormField
                            control={form.control}
                            name="country_code"
                            render={({ field }) => (
                                <FormItem className="w-1/3">
                                <Popover open={countryCodePopoverOpen} onOpenChange={setCountryCodePopoverOpen}>
                                    <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button
                                        variant="outline"
                                        role="combobox"
                                        className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                                        >
                                        {field.value || "Code"}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
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
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                            <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                                <FormItem className="flex-1">
                                    <FormControl>
                                        <Input {...field} placeholder="3001234567" />
                                    </FormControl>
                                </FormItem>
                            )}
                            />
                        </div>
                        <FormMessage>{form.formState.errors.phone?.message}</FormMessage>
                    </FormItem>
                    <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Email (Optional)</FormLabel>
                        <FormControl>
                            <Input type="email" {...field} value={field.value ?? ''} placeholder="buyer@example.com" />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>
                
                <Separator />
                <h4 className="text-sm font-medium text-muted-foreground">Buyer Requirements</h4>
                
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
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            className={cn(
                                                "w-full justify-between",
                                                !field.value && "text-muted-foreground"
                                            )}
                                        >
                                            {field.value
                                                ? punjabCities.find(
                                                    (city) => city === field.value
                                                )
                                                : "Select city"}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                    <Command>
                                        <CommandInput placeholder="Search city..." />
                                        <CommandList>
                                            <CommandEmpty>No city found.</CommandEmpty>
                                            <CommandGroup>
                                                {punjabCities.map((city) => (
                                                    <CommandItem
                                                        value={city}
                                                        key={city}
                                                        onSelect={() => {
                                                            form.setValue("city", city)
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                city === field.value
                                                                    ? "opacity-100"
                                                                    : "opacity-0"
                                                            )}
                                                        />
                                                        {city}
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
                    <FormField
                    control={form.control}
                    name="area_preference"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Area Preference</FormLabel>
                        <FormControl>
                            <Input {...field} value={field.value ?? ''} placeholder="e.g. DHA, Bahria, Gulberg" />
                        </FormControl>
                        <FormMessage />
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
                            <FormLabel>Property Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                            <FormControl>
                                <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {propertyTypes.map(type => (
                                    <SelectItem key={type} value={type}>{type}</SelectItem>
                                ))}
                            </SelectContent>
                            </Select>
                            <FormMessage />
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
                                <FormControl>
                                <Input placeholder="e.g. Penthouse" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <FormLabel>Size Preference</FormLabel>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                            <FormField control={form.control} name="size_min_value" render={({field}) => (
                                <FormItem><FormControl><Input type="number" {...field} value={field.value ?? 0} placeholder="Min" /></FormControl></FormItem>
                            )} />
                            <FormField control={form.control} name="size_min_unit" render={({field}) => (
                                <FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>
                                    {sizeUnits.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                </SelectContent></Select></FormItem>
                            )} />
                            <FormField control={form.control} name="size_max_value" render={({field}) => (
                                <FormItem><FormControl><Input type="number" {...field} value={field.value ?? 0} placeholder="Max" /></FormControl></FormItem>
                            )} />
                            <FormField control={form.control} name="size_max_unit" render={({field}) => (
                                <FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>
                                    {sizeUnits.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                </SelectContent></Select></FormItem>
                            )} />
                        </div>
                    </div>
                    <div>
                        <FormLabel>Budget Range</FormLabel>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                            <FormField control={form.control} name="budget_min_amount" render={({field}) => (
                                <FormItem><FormControl><Input type="number" {...field} value={field.value ?? 0} placeholder="Min" /></FormControl></FormItem>
                            )} />
                            <FormField control={form.control} name="budget_min_unit" render={({field}) => (
                                <FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>
                                    {priceUnits.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                </SelectContent></Select></FormItem>

                            )} />
                            <FormField control={form.control} name="budget_max_amount" render={({field}) => (
                                <FormItem><FormControl><Input type="number" {...field} value={field.value ?? 0} placeholder="Max" /></FormControl></FormItem>
                            )} />
                            <FormField control={form.control} name="budget_max_unit" render={({field}) => (
                                <FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>
                                    {priceUnits.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                </SelectContent></Select></FormItem>
                            )} />
                        </div>
                    </div>
                </div>

                <Separator />
                <h4 className="text-sm font-medium text-muted-foreground">Status & Notes</h4>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {buyerStatuses.map(status => (
                                <SelectItem key={status} value={status}>{status}</SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                     <FormField
                        control={form.control}
                        name="is_investor"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-start space-x-3 space-y-0 rounded-md border p-3 shadow-sm h-10 mt-8 bg-background">
                            <FormControl>
                                <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                                <FormLabel>
                                Mark as Investor
                                </FormLabel>
                            </div>
                            </FormItem>
                        )}
                    />
                </div>
                <FormField
                  control={form.control}
                  name="tags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tags</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. Urgent, VIP, Hot Lead" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Other Requirements / Notes</FormLabel>
                    <FormControl>
                        <Textarea {...field} value={field.value ?? ''} placeholder="Any specific requirements or notes..." />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
        </ScrollArea>
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" className="glowing-btn">{buyerToEdit ? 'Save Changes' : 'Save Buyer'}</Button>
        </div>
      </form>
    </Form>
  );
}
