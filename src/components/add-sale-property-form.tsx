'use client';

import { useEffect, useState } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from './ui/separator';
import type { Property, PropertyType, PriceUnit, PropertyStatus } from '@/lib/types';
import { useUser } from '@/firebase/auth/use-user';
import { useProfile } from '@/context/profile-context';
import { formatPhoneNumber } from '@/lib/utils';
import { punjabCities, countryCodes } from '@/lib/data';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, Calendar, Hash, MapPin, Building, Ruler, Wallet, FileText, UtilityPole } from 'lucide-react';

const propertyTypeValues = [
    'House', 'Flat', 'Farm House', 'Penthouse', 'Plot', 'Residential Plot', 'Commercial Plot', 'Agricultural Land', 'Industrial Land', 'Office', 'Shop', 'Warehouse', 'Factory', 'Building', 'Residential Property', 'Commercial Property', 'Semi Commercial', 'Other'
] as const;

const sizeUnitValues = ['Marla', 'SqFt', 'Kanal', 'Acre', 'Maraba'] as const;
const priceUnitValues = ['Lacs', 'Crore'] as const;
const potentialRentUnitValues = ['Thousand', 'Lacs', 'Crore'] as const;

const formSchema = z.object({
  serial_no: z.string().optional(),
  auto_title: z.string().optional(),
  country_code: z.string().default('+92'),
  owner_number: z.string().min(1, 'Owner number is required'),
  city: z.string().default('Lahore'),
  area: z.string().min(1, 'Area is required'),
  address: z.string().min(1, 'Address is required'),
  property_type: z.enum(propertyTypeValues),
  property_type_other: z.string().optional(),
  size_value: z.coerce.number().positive('Size must be positive'),
  size_unit: z.enum(sizeUnitValues).default('Marla'),
  road_size_ft: z.coerce.number().int().optional().nullable(),
  storey: z.string().optional(),
  meters: z.object({
    electricity: z.boolean().default(false),
    gas: z.boolean().default(false),
    water: z.boolean().default(false),
  }),
  potential_rent_amount: z.coerce.number().optional().nullable(),
  potential_rent_unit: z.enum(potentialRentUnitValues).optional(),
  front_ft: z.coerce.number().int().optional().nullable(),
  length_ft: z.coerce.number().int().optional().nullable(),
  demand_amount: z.coerce.number().positive('Demand must be positive'),
  demand_unit: z.enum(priceUnitValues).default('Lacs'),
  documents: z.string().optional(),
  message: z.string().optional(),
  tags: z.string().optional(),
  status: z.enum(['New', 'Available', 'Sold', 'Rent Out', 'Sold (External)']).default('New'),
});

type AddSalePropertyFormValues = z.infer<typeof formSchema>;

interface AddSalePropertyFormProps {
  setDialogOpen: (open: boolean) => void;
  onSave: (property: Omit<Property, 'id'> & { id?: string }) => void;
  propertyToEdit?: Property | null;
  totalProperties: number;
}

export function AddSalePropertyForm({
  setDialogOpen,
  onSave,
  propertyToEdit,
  totalProperties,
}: AddSalePropertyFormProps) {
  const { user } = useUser();
  const { profile } = useProfile();
  const [countryCodePopoverOpen, setCountryCodePopoverOpen] = useState(false);

  const isAgent = profile.role === 'Agent';
  const isEditing = !!propertyToEdit;
  const isPhoneRestricted = isAgent && isEditing;

  const form = useForm<AddSalePropertyFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        serial_no: propertyToEdit?.serial_no || `P-${totalProperties + 1}`,
        auto_title: propertyToEdit?.auto_title || '',
        country_code: propertyToEdit?.country_code || '+92',
        owner_number: propertyToEdit?.owner_number.replace(propertyToEdit.country_code || '+92', '') || '',
        city: propertyToEdit?.city || 'Lahore',
        area: propertyToEdit?.area || '',
        address: propertyToEdit?.address || '',
        property_type: propertyToEdit?.property_type && propertyTypeValues.includes(propertyToEdit.property_type as any) ? (propertyToEdit.property_type as any) : (propertyToEdit ? 'Other' : 'House'),
        property_type_other: propertyToEdit?.property_type && !propertyTypeValues.includes(propertyToEdit.property_type as any) ? propertyToEdit.property_type : '',
        size_value: propertyToEdit?.size_value || 0,
        size_unit: propertyToEdit?.size_unit || 'Marla',
        road_size_ft: propertyToEdit?.road_size_ft || 0,
        storey: propertyToEdit?.storey || '',
        meters: propertyToEdit?.meters || { electricity: false, gas: false, water: false },
        potential_rent_amount: propertyToEdit?.potential_rent_amount || 0,
        potential_rent_unit: propertyToEdit?.potential_rent_unit || 'Thousand',
        front_ft: propertyToEdit?.front_ft || 0,
        length_ft: propertyToEdit?.length_ft || 0,
        demand_amount: propertyToEdit?.demand_amount || 0,
        demand_unit: propertyToEdit?.demand_unit === 'Lacs' || propertyToEdit?.demand_unit === 'Crore' ? propertyToEdit.demand_unit : 'Lacs',
        documents: propertyToEdit?.documents || '',
        message: propertyToEdit?.message || '',
        tags: propertyToEdit?.tags?.join(', ') || 'New',
        status: propertyToEdit?.status || 'New',
    },
  });

  const { control, setValue } = form;

  const watchedFields = useWatch({
    control,
    name: ['size_value', 'size_unit', 'property_type', 'area', 'property_type_other'],
  });
  
  const watchedPropertyType = watchedFields[2];

  useEffect(() => {
    const [sizeValue, sizeUnit, propertyType, area, otherType] = watchedFields;
    const finalPropertyType = propertyType === 'Other' ? otherType : propertyType;

    if (sizeValue && sizeUnit && finalPropertyType && area) {
        const title = `${sizeValue} ${sizeUnit} ${finalPropertyType} in ${area}`;
        setValue('auto_title', title);
    }
  }, [watchedFields, setValue]);

  function onSubmit(values: AddSalePropertyFormValues) {
    const finalPropertyType = (values.property_type === 'Other' && values.property_type_other
        ? values.property_type_other
        : values.property_type) as PropertyType;

    const tagsArray = values.tags?.split(',').map(tag => tag.trim()).filter(Boolean) || [];
    if (!propertyToEdit && values.status === 'New' && !tagsArray.includes('New')) {
        tagsArray.push('New');
    }

    const propertyData: Omit<Property, 'id'> & { id?: string } = {
      ...propertyToEdit,
      ...values,
      listing_type: 'For Sale',
      is_for_rent: false,
      id: propertyToEdit?.id || '',
      serial_no: propertyToEdit?.serial_no || `P-${totalProperties + 1}`,
      status: values.status as PropertyStatus,
      created_at: propertyToEdit?.created_at || new Date().toISOString(),
      created_by: propertyToEdit?.created_by || user?.uid || '',
      agency_id: propertyToEdit?.agency_id || profile.agency_id || '',
      is_deleted: propertyToEdit?.is_deleted || false,
      owner_number: formatPhoneNumber(values.owner_number, values.country_code),
      property_type: finalPropertyType,
      demand_unit: (values.demand_unit as 'Lacs' | 'Crore' | 'Thousand') || 'Lacs',
      tags: tagsArray,
      is_recorded: propertyToEdit?.is_recorded ?? false,
      auto_title: values.auto_title || '',
      country_code: values.country_code || '+92',
      city: values.city || 'Lahore',
      area: values.area || '',
      address: values.address || '',
      size_value: values.size_value,
      size_unit: values.size_unit,
      road_size_ft: values.road_size_ft ?? 0,
      storey: values.storey || '',
      meters: values.meters,
      potential_rent_amount: values.potential_rent_amount ?? 0,
      potential_rent_unit: (values.potential_rent_unit as PriceUnit) || 'Thousand',
      front_ft: values.front_ft ?? 0,
      length_ft: values.length_ft ?? 0,
      demand_amount: values.demand_amount,
      documents: values.documents || '',
      message: values.message || '',
    };

    onSave(propertyData);
    setDialogOpen(false);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pb-6">
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <FormField
                control={control}
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
                <Input
                  value={propertyToEdit ? new Date(propertyToEdit.created_at).toLocaleDateString() : new Date().toLocaleDateString()}
                  readOnly
                  className="bg-muted/50 h-9"
                />
              </FormItem>
              <div className="col-span-2 hidden md:block"></div>
            </div>

            <FormField
              control={control}
              name="auto_title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-primary font-bold">Auto-Generated Title</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} readOnly placeholder="Title will appear here..." className="bg-primary/5 border-primary/20 h-10 font-medium" />
                  </FormControl>
                </FormItem>
              )}
            />

            <Separator />
            
            <div className="space-y-4">
                <h4 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider"><MapPin className="h-4 w-4" /> Location Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                        control={control}
                        name="city"
                        render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>City</FormLabel>
                            <Popover>
                            <PopoverTrigger asChild>
                                <FormControl>
                                <Button variant="outline" role="combobox" className={cn('w-full justify-between h-9', !field.value && 'text-muted-foreground')}>
                                    {field.value || 'Select city'}
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
                                        <CommandItem value={city} key={city} onSelect={() => form.setValue('city', city)}>
                                        <Check className={cn('mr-2 h-4 w-4', city === field.value ? 'opacity-100' : 'opacity-0')} />
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
                        control={control}
                        name="area"
                        render={({ field }) => (
                        <FormItem className="md:col-span-2">
                            <FormLabel>Area / Neighborhood</FormLabel>
                            <FormControl>
                            <Input placeholder="e.g. DHA Phase 5, Gulberg III" {...field} className="h-9" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
                <FormField
                    control={control}
                    name="address"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Street Address</FormLabel>
                        <FormControl>
                            <Input placeholder="Plot #, Street #, House #" {...field} className="h-9" />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            <Separator />

            <div className="space-y-4">
                <h4 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider"><Building className="h-4 w-4" /> Property Specification</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                            control={control}
                            name="property_type"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Type</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger className="h-9"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>{propertyTypeValues.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                                </Select>
                            </FormItem>
                            )}
                        />
                        {watchedPropertyType === 'Other' && (
                            <FormField
                                control={control}
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
                    
                    <div className="grid grid-cols-2 gap-2">
                        <FormField
                            control={control}
                            name="size_value"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Size</FormLabel>
                                <FormControl><Input type="number" placeholder="5" {...field} value={field.value ?? 0} className="h-9" /></FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={control}
                            name="size_unit"
                            render={({ field }) => (
                                <FormItem className="self-end">
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger className="h-9"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                    {sizeUnitValues.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                </FormItem>
                            )}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <FormField control={control} name="front_ft" render={({ field }) => (
                        <FormItem><FormLabel>Front (ft)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? 0} className="h-9" /></FormControl></FormItem>
                    )} />
                    <FormField control={control} name="length_ft" render={({ field }) => (
                        <FormItem><FormLabel>Length (ft)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? 0} className="h-9" /></FormControl></FormItem>
                    )} />
                    <FormField control={control} name="road_size_ft" render={({ field }) => (
                        <FormItem><FormLabel>Road (ft)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? 0} className="h-9" /></FormControl></FormItem>
                    )} />
                    <FormField control={control} name="storey" render={({ field }) => (
                        <FormItem><FormLabel>Storey</FormLabel><FormControl><Input placeholder="e.g. Double" {...field} value={field.value ?? ''} className="h-9" /></FormControl></FormItem>
                    )} />
                </div>
            </div>

            <Separator />

            <div className="space-y-4">
                <h4 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider"><Wallet className="h-4 w-4" /> Financials & Contact</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="grid grid-cols-2 gap-2">
                        <FormField
                            control={control}
                            name="demand_amount"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel className="text-primary font-bold">Asking Price</FormLabel>
                                <FormControl><Input type="number" {...field} value={field.value ?? 0} className="h-10 border-primary/30" /></FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={control}
                            name="demand_unit"
                            render={({ field }) => (
                                <FormItem className="self-end">
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger className="h-10 border-primary/30"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {priceUnitValues.map(unit => <SelectItem key={unit} value={unit}>{unit}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                </FormItem>
                            )}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <FormField
                            control={control}
                            name="potential_rent_amount"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Potential Rent</FormLabel>
                                <FormControl><Input type="number" {...field} value={field.value ?? 0} className="h-10" /></FormControl>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={control}
                            name="potential_rent_unit"
                            render={({ field }) => (
                                <FormItem className="self-end">
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger className="h-10"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {potentialRentUnitValues.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                </FormItem>
                            )}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormItem>
                        <FormLabel>Owner Phone Number</FormLabel>
                        <div className="flex gap-2">
                            <FormField
                            control={control}
                            name="country_code"
                            render={({ field }) => (
                                <FormItem className="w-24">
                                    <Popover open={!isPhoneRestricted && countryCodePopoverOpen} onOpenChange={setCountryCodePopoverOpen}>
                                        <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button variant="outline" role="combobox" className="w-full justify-between h-9" disabled={isPhoneRestricted}>
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
                                                <CommandItem value={country.dial_code} key={country.code} onSelect={() => { form.setValue("country_code", country.dial_code); setCountryCodePopoverOpen(false); }}>
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
                            control={control}
                            name="owner_number"
                            render={({ field }) => (
                                <FormItem className="flex-1">
                                <FormControl><Input placeholder="3001234567" {...field} className="h-9" disabled={isPhoneRestricted} /></FormControl>
                                </FormItem>
                            )}
                            />
                        </div>
                    </FormItem>
                </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <h4 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wider"><UtilityPole className="h-4 w-4" /> Meters</h4>
                    <div className="flex items-center gap-4 pt-2">
                        <FormField control={control} name="meters.electricity" render={({ field }) => (
                            <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">Electricity</FormLabel></FormItem>
                        )} />
                        <FormField control={control} name="meters.gas" render={({ field }) => (
                            <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">Gas</FormLabel></FormItem>
                        )} />
                        <FormField control={control} name="meters.water" render={({ field }) => (
                            <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">Water</FormLabel></FormItem>
                        )} />
                    </div>
                </div>
                <div className="space-y-2">
                    <FormLabel className="flex items-center gap-2 font-bold uppercase tracking-wider text-[10px] text-muted-foreground"><FileText className="h-3 w-3" /> Property Documents</FormLabel>
                    <FormField control={control} name="documents" render={({ field }) => (
                        <FormItem><FormControl><Input placeholder="e.g. Registry, NOC, Fard" {...field} value={field.value ?? ''} className="h-9" /></FormControl></FormItem>
                    )} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <FormField
                  control={control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Property Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="New">New</SelectItem>
                          <SelectItem value="Available">Available</SelectItem>
                          <SelectItem value="Sold">Sold</SelectItem>
                          <SelectItem value="Sold (External)">Sold By External</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name="tags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tags (comma separated)</FormLabel>
                      <FormControl><Input {...field} placeholder="e.g. Urgent, Hot" /></FormControl>
                    </FormItem>
                  )}
                />
            </div>

            <FormField
              control={control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-bold uppercase tracking-wider text-[10px] text-muted-foreground">General Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Add any extra notes about the property..." {...field} value={field.value ?? ''} rows={3} />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

        <div className="flex justify-end gap-2 pt-6 border-t sticky bottom-0 bg-background pb-2">
          <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button type="submit" className="glowing-btn px-8">
            {propertyToEdit ? 'Save Changes' : 'Save Property'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
