'use client';

import { useForm } from 'react-hook-form';
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
import type { Buyer, PriceUnit, PropertyType, SizeUnit, ListingType } from '@/lib/types';
import { Separator } from './ui/separator';
import { buyerStatuses, punjabCities, countryCodes } from '@/lib/data';
import { Checkbox } from './ui/checkbox';
import { useUser } from '@/firebase/auth/use-user';
import { useProfile } from '@/context/profile-context';
import { formatPhoneNumber } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, Hash, Calendar, User, Phone, MapPin, Building, Ruler, Wallet, Tag } from 'lucide-react';

const propertyTypeValues = [
    'House', 'Flat', 'Farm House', 'Penthouse', 'Plot', 'Residential Plot', 'Commercial Plot', 'Agricultural Land', 'Industrial Land', 'Office', 'Shop', 'Warehouse', 'Factory', 'Building', 'Residential Property', 'Commercial Property', 'Semi Commercial', 'Other'
] as const;

const sizeUnits: SizeUnit[] = ['Marla', 'SqFt', 'Kanal', 'Acre', 'Maraba'];
const priceUnits: PriceUnit[] = ['Thousand', 'Lacs', 'Crore'];

const formSchema = z.object({
  id: z.string().optional(),
  serial_no: z.string().optional(),
  listing_type: z.enum(['For Sale', 'For Rent']),
  name: z.string().optional(),
  country_code: z.string().default('+92'),
  phone: z.string().min(1, 'Phone number is required'),
  email: z.string().optional().or(z.literal('')),
  status: z.string().default('New'),
  is_investor: z.boolean().optional().default(false),
  city: z.string().optional(),
  area_preference: z.string().optional(),
  property_type_preference: z.string().optional(),
  property_type_other: z.string().optional(),
  size_min_value: z.coerce.number().optional().nullable(),
  size_min_unit: z.enum(['Marla', 'SqFt', 'Kanal', 'Acre', 'Maraba']).optional(),
  size_max_value: z.coerce.number().optional().nullable(),
  size_max_unit: z.enum(['Marla', 'SqFt', 'Kanal', 'Acre', 'Maraba']).optional(),
  budget_min_amount: z.coerce.number().optional().nullable(),
  budget_min_unit: z.enum(['Thousand', 'Lacs', 'Crore']).optional(),
  budget_max_amount: z.coerce.number().optional().nullable(),
  budget_max_unit: z.enum(['Thousand', 'Lacs', 'Crore']).optional(),
  notes: z.string().optional(),
  tags: z.string().optional(),
});

type AddBuyerFormValues = z.infer<typeof formSchema>;

interface AddBuyerFormProps {
  setDialogOpen: (open: boolean) => void;
  totalSaleBuyers: number;
  totalRentBuyers: number;
  buyerToEdit?: Buyer | null;
  onSave: (buyer: any) => void;
  listingType: ListingType;
}

export function AddBuyerForm({ setDialogOpen, totalSaleBuyers, totalRentBuyers, buyerToEdit, onSave, listingType }: AddBuyerFormProps) {
  const { user } = useUser();
  const { profile } = useProfile();
  const [countryCodePopoverOpen, setCountryCodePopoverOpen] = useState(false);
  
  const form = useForm<AddBuyerFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        id: buyerToEdit?.id || '',
        name: buyerToEdit?.name || '',
        listing_type: listingType,
        country_code: buyerToEdit?.country_code || '+92',
        phone: buyerToEdit?.phone ? (buyerToEdit.phone.startsWith('+') ? buyerToEdit.phone : buyerToEdit.phone) : '',
        email: buyerToEdit?.email || '',
        city: buyerToEdit?.city || 'Lahore',
        area_preference: buyerToEdit?.area_preference || '',
        property_type_preference: buyerToEdit?.property_type_preference || 'House',
        property_type_other: '',
        notes: buyerToEdit?.notes || '',
        status: buyerToEdit?.status || 'New',
        is_investor: buyerToEdit?.is_investor || false,
        serial_no: buyerToEdit?.serial_no || (listingType === 'For Rent' ? `RB-${totalRentBuyers + 1}` : `B-${totalSaleBuyers + 1}`),
        size_min_unit: buyerToEdit?.size_min_unit || 'Marla',
        size_max_unit: buyerToEdit?.size_max_unit || 'Marla',
        budget_min_unit: buyerToEdit?.budget_min_unit || 'Lacs',
        budget_max_unit: buyerToEdit?.budget_max_unit || 'Lacs',
        size_min_value: buyerToEdit?.size_min_value ?? 0,
        size_max_value: buyerToEdit?.size_max_value ?? 0,
        budget_min_amount: buyerToEdit?.budget_min_amount ?? 0,
        budget_max_amount: buyerToEdit?.budget_max_amount ?? 0,
        tags: buyerToEdit?.tags?.join(', ') || 'New',
    }
  });

  const { setValue, watch } = form;
  const watchedPropertyType = watch('property_type_preference');

  useEffect(() => {
    if (!buyerToEdit) {
        setValue('listing_type', listingType);
        const serialPrefix = listingType === 'For Rent' ? 'RB' : 'B';
        const nextSerialNum = listingType === 'For Rent' ? totalRentBuyers + 1 : totalSaleBuyers + 1;
        setValue('serial_no', `${serialPrefix}-${nextSerialNum}`);
    }
  }, [listingType, totalSaleBuyers, totalRentBuyers, setValue, buyerToEdit]);

  function onSubmit(values: AddBuyerFormValues) {
     const finalPropertyType = values.property_type_preference === 'Other' && values.property_type_other
        ? values.property_type_other
        : values.property_type_preference;

     const tagsArray = values.tags?.split(',').map(tag => tag.trim()).filter(Boolean) || [];
     if (!buyerToEdit && values.status === 'New' && !tagsArray.includes('New')) {
        tagsArray.push('New');
     }

     const formattedPhone = formatPhoneNumber(values.phone, values.country_code);

     const buyerData = {
        ...values,
        id: buyerToEdit?.id || values.id || '',
        name: values.name?.trim() || values.serial_no || 'Unnamed Lead',
        property_type_preference: finalPropertyType,
        phone: formattedPhone,
        created_at: buyerToEdit?.created_at || new Date().toISOString(),
        created_by: buyerToEdit?.created_by || user?.uid || '',
        agency_id: buyerToEdit?.agency_id || profile.agency_id || '',
        tags: tagsArray,
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
                    <FormLabel className="flex items-center gap-2 text-xs text-muted-foreground uppercase"><Hash className="h-3.5 w-3.5" /> Serial No</FormLabel>
                    <FormControl>
                        <Input {...field} value={field.value ?? ''} readOnly className="bg-muted/50 h-9 font-mono" />
                    </FormControl>
                    </FormItem>
                )}
                />
                <FormItem>
                    <FormLabel className="flex items-center gap-2 text-xs text-muted-foreground uppercase"><Calendar className="h-3.5 w-3.5" /> Date Added</FormLabel>
                    <Input value={new Date(buyerToEdit?.created_at || new Date()).toLocaleDateString()} readOnly className="bg-muted/50 h-9" />
                </FormItem>
            </div>
            
            <Separator />
            
            <div className="space-y-4">
                <h4 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider text-primary"><User className="h-4 w-4" /> Contact Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Buyer Name (Optional)</FormLabel>
                        <FormControl>
                            <Input {...field} placeholder="e.g. Ahmed Khan" className="h-9" />
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
                                        <Button variant="outline" role="combobox" className="w-full justify-between h-9 px-2">
                                        {field.value || "+92"}
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
                                    <FormMessage />
                                </FormItem>
                            )}
                            />
                        </div>
                    </FormItem>
                </div>
            </div>

            <Separator />
            
            <div className="space-y-4">
                <h4 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider text-primary"><MapPin className="h-4 w-4" /> Requirements</h4>
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
                        <FormLabel>Area Preference</FormLabel>
                        <FormControl>
                            <Input {...field} value={field.value ?? ''} placeholder="e.g. DHA Phase 6" className="h-9" />
                        </FormControl>
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
                            <FormControl><SelectTrigger className="h-9"><SelectValue placeholder="Select type..." /></SelectTrigger></FormControl>
                            <SelectContent>{propertyTypeValues.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
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
                                <FormLabel>Custom Type</FormLabel>
                                <FormControl><Input placeholder="e.g. Penthouse" {...field} className="h-9" /></FormControl>
                            </FormItem>
                            )}
                        />
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <FormLabel className="flex items-center gap-2 text-xs font-bold uppercase"><Ruler className="h-3.5 w-3.5" /> Size Preference</FormLabel>
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
                        <FormLabel className="flex items-center gap-2 text-xs font-bold uppercase"><Wallet className="h-3.5 w-3.5" /> Budget Range</FormLabel>
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
                <h4 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider text-primary"><Tag className="h-4 w-4" /> Status & Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Buyer Status</FormLabel>
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
                            <FormItem className="flex flex-row items-center justify-start space-x-3 space-y-0 rounded-md border p-2 h-9 bg-background">
                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            <div className="space-y-1 leading-none"><FormLabel className="cursor-pointer text-xs uppercase font-bold">Investor</FormLabel></div>
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
                      <FormControl><Input {...field} placeholder="e.g. Urgent, Hot Lead" className="h-9" /></FormControl>
                    </FormItem>
                  )}
                />
            </div>

            <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
                <FormItem>
                <FormLabel className="text-xs font-bold uppercase text-muted-foreground">Other Requirements / Notes</FormLabel>
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
