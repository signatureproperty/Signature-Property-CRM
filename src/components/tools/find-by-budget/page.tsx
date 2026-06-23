'use client';

import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useForm } from 'react-hook-form';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Buyer, PriceUnit, Property, PropertyType, ListingType } from '@/lib/types';
import { formatCurrency, formatUnit, formatPhoneNumberForWhatsApp } from '@/lib/formatters';
import { useCurrency, Currency } from '@/context/currency-context';
import { Download, Share2, Check, Phone, Wallet, Home, DollarSign, FileText, Video, RotateCcw } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useFirestore } from '@/firebase/provider';
import { useProfile } from '@/context/profile-context';
import { useMemoFirebase } from '@/firebase/hooks';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { ChevronsUpDown } from 'lucide-react';
import { buyerStatuses } from '@/lib/data';

const propertyTypeValues = [
    'House', 'Flat', 'Farm House', 'Penthouse', 'Plot', 'Residential Plot', 'Commercial Plot', 'Agricultural Land', 'Industrial Land', 'Office', 'Shop', 'Warehouse', 'Factory', 'Building', 'Residential Property', 'Commercial Property', 'Semi Commercial'
];

type VideoLinkPlatform = 'tiktok' | 'youtube' | 'instagram' | 'facebook' | 'other';
type ShareStatus = 'idle' | 'confirming' | 'shared';

const formSchema = z.object({
  listing_type: z.enum(['For Sale', 'For Rent']).default('For Sale'),
  minBudget: z.coerce.number().min(0, 'Minimum budget must be positive').optional(),
  maxBudget: z.coerce.number().min(0, 'Maximum budget must be positive').optional(),
  budgetUnit: z.enum(['Lacs', 'Crore', 'Thousand']).default('Lacs'),
  area: z.string().optional(),
  status: z.string().optional(),
  propertyType: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function FindByBudgetPage() {
  const [foundBuyers, setFoundBuyers] = useState<Buyer[]>([]);
  const { currency } = useCurrency();
  const [propertyMessage, setPropertyMessage] = useState('');
  const [propertyToShare, setPropertyToShare] = useState<Property | null>(null);
  const [isShareMode, setIsShareMode] = useState(false);
  const { toast } = useToast();
  const [shareStatus, setShareStatus] = useState<Record<string, ShareStatus>>({});
  const isMobile = useIsMobile();
  const { profile } = useProfile();
  const firestore = useFirestore();

  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);

  const propertiesQuery = useMemoFirebase(
    () => (profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'properties') : null),
    [profile.agency_id, firestore]
  );
  const { data: allProperties } = useCollection<Property>(propertiesQuery);

  const buyersQuery = useMemoFirebase(
    () => (profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'buyers') : null),
    [profile.agency_id, firestore]
  );
  const { data: buyers } = useCollection<Buyer>(buyersQuery);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      listing_type: 'For Sale',
      minBudget: 0,
      maxBudget: 0,
      budgetUnit: 'Lacs',
      area: '',
      status: 'All',
      propertyType: 'All',
    },
  });

    useEffect(() => {
    if (buyers?.length) {
      try {
        const savedFilters = localStorage.getItem('findByBudgetFilters');
        const savedBuyersJSON = localStorage.getItem('findByBudgetResults');
        
        if (savedFilters) {
          form.reset(JSON.parse(savedFilters));
        }
        
        if (savedBuyersJSON) {
          setFoundBuyers(JSON.parse(savedBuyersJSON));
        }
      } catch (error) {
        console.error("Failed to load state from localStorage", error);
      }
    }
  }, [buyers, form]);
  
  const formatBuyerBudget = (buyer: Buyer) => {
    if (!buyer.budget_min_amount || !buyer.budget_min_unit) return 'N/A';
    const minVal = formatUnit(buyer.budget_min_amount, buyer.budget_min_unit);

    if (!buyer.budget_max_amount || !buyer.budget_max_unit || (buyer.budget_min_amount === buyer.budget_max_amount && buyer.budget_min_unit === buyer.budget_max_unit)) {
      return formatCurrency(minVal, currency);
    }
    const maxVal = formatUnit(buyer.budget_max_amount, buyer.budget_max_unit);
    return `${formatCurrency(minVal, currency)} - ${formatCurrency(maxVal, currency)}`;
  }

  function onSubmit(values: FormValues) {
    if (!values.area && (!values.minBudget || !values.maxBudget)) {
        toast({ title: 'Invalid Search', description: 'Please provide a budget range or an area to search.', variant: 'destructive'});
        return;
    }

    const searchMin = values.minBudget ? formatUnit(values.minBudget, values.budgetUnit) : 0;
    const searchMax = values.maxBudget ? formatUnit(values.maxBudget, values.budgetUnit) : Infinity;

    const filtered = (buyers || []).filter(buyer => {
        const buyerListingType = buyer.listing_type || 'For Sale';
        if (buyerListingType !== values.listing_type) {
            return false;
        }

        let budgetMatch = true;
        if (searchMin > 0 || searchMax < Infinity) {
            if (!buyer.budget_min_amount || !buyer.budget_max_amount || !buyer.budget_min_unit || !buyer.budget_max_unit) {
                budgetMatch = false;
            } else {
                const buyerMin = formatUnit(buyer.budget_min_amount, buyer.budget_min_unit);
                const buyerMax = formatUnit(buyer.budget_max_amount, buyer.budget_max_unit);
                budgetMatch = Math.max(searchMin, buyerMin) <= Math.min(searchMax, buyerMax);
            }
        }
        
        const areaMatch = !values.area || (buyer.area_preference && buyer.area_preference.toLowerCase().includes(values.area.toLowerCase()));
        const statusMatch = !values.status || values.status === 'All' || buyer.status === values.status;
        const propertyTypeMatch = !values.propertyType || values.propertyType === 'All' || buyer.property_type_preference === values.propertyType;

        return budgetMatch && areaMatch && statusMatch && propertyTypeMatch;
    });

    setFoundBuyers(filtered);
    localStorage.setItem('findByBudgetFilters', JSON.stringify(values));
    localStorage.setItem('findByBudgetResults', JSON.stringify(filtered));

    const initialStatus: Record<string, ShareStatus> = {};
    filtered.forEach(buyer => {
      initialStatus[buyer.id] = 'idle';
    });
    setShareStatus(initialStatus);
    setIsShareMode(false);
  }

  const handleReset = () => {
    form.reset({
        listing_type: 'For Sale',
        minBudget: 0,
        maxBudget: 0,
        budgetUnit: 'Lacs',
        area: '',
        status: 'All',
        propertyType: 'All'
    });
    setFoundBuyers([]);
    localStorage.removeItem('findByBudgetFilters');
    localStorage.removeItem('findByBudgetResults');
    toast({ title: 'Filters Reset', description: 'Search has been cleared.' });
  };

  const handleDownload = () => {
    const headers = ['Name', 'Phone', 'Budget', 'Area Preference', 'Notes'];
    const csvContent = [
      headers.join(','),
      ...foundBuyers.map(b => {
          const row = [
            `"${b.name}"`,
            `"${b.phone}"`,
            `"${formatBuyerBudget(b).replace(/,/g, '')}"`,
            `"${b.area_preference || 'N/A'}"`,
            `"${(b.notes || '').replace(/"/g, '""')}"`
          ];
          return row.join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `budget-buyers-${new Date().toISOString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const handleShareToBuyer = (buyer: Buyer) => {
    const phone = formatPhoneNumberForWhatsApp(buyer.phone, buyer.country_code);
    const encodedMessage = encodeURIComponent(propertyMessage);
    window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');
    toast({ title: 'Redirecting to WhatsApp...', description: `Confirm share for ${buyer.name} upon return.`});
    setShareStatus(prev => ({...prev, [buyer.id]: 'confirming'}));
  };
  
  const handleConfirmShare = async (buyerId: string, confirmed: boolean) => {
    if (confirmed && propertyToShare && profile.agency_id) {
        try {
            const buyerRef = doc(firestore, 'agencies', profile.agency_id, 'buyers', buyerId);
            await updateDoc(buyerRef, {
                sharedProperties: arrayUnion({
                    propertyId: propertyToShare.id,
                    propertySerialNo: propertyToShare.serial_no,
                    propertyTitle: propertyToShare.auto_title,
                    sharedAt: new Date().toISOString(),
                })
            });
            toast({ title: 'Shared property recorded!' });
        } catch (error) {
            console.error("Failed to record shared property:", error);
            toast({ title: "Failed to record share", variant: "destructive" });
            setShareStatus(prev => ({ ...prev, [buyerId]: 'idle' }));
            return;
        }
    }
    
    setShareStatus(prev => ({ ...prev, [buyerId]: confirmed ? 'shared' : 'idle' }));
  };


  const renderCards = () => (
    <ScrollArea className="h-64">
      <div className="p-4 space-y-4">
        {foundBuyers.map((buyer, index) => (
          <Card key={buyer.id}>
            <CardHeader>
              <CardTitle className="flex justify-between items-start text-sm">
                <span>{index + 1}. {buyer.name}</span>
                <Badge variant="outline">{buyer.serial_no}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex items-center gap-2"><Phone className="h-3 w-3 text-muted-foreground" /> {buyer.phone}</div>
              <div className="flex items-center gap-2"><Wallet className="h-3 w-3 text-muted-foreground" /> {formatBuyerBudget(buyer)}</div>
              <div className="flex items-center gap-2"><Home className="h-3 w-3 text-muted-foreground" /> {buyer.area_preference || 'N/A'}</div>
              <div className="flex items-start gap-2"><FileText className="h-3 w-3 text-muted-foreground mt-1" /> <p className="whitespace-pre-wrap">{buyer.notes || 'No notes.'}</p></div>
            </CardContent>
            {isShareMode && (
              <CardFooter className="justify-end pt-0">
                {shareStatus[buyer.id] === 'idle' && (
                  <Button size="sm" className="h-7 text-[10px]" onClick={() => handleShareToBuyer(buyer)}>
                    <Share2 className="mr-1 h-3 w-3" /> Share
                  </Button>
                )}
                 {shareStatus[buyer.id] === 'confirming' && (
                  <div className="flex gap-2 justify-end">
                    <span className="text-[10px] text-muted-foreground self-center">Shared?</span>
                    <Button size="sm" variant="destructive" className="h-7 px-2 text-[10px]" onClick={() => handleConfirmShare(buyer.id, false)}>No</Button>
                    <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700 h-7 px-2 text-[10px]" onClick={() => handleConfirmShare(buyer.id, true)}>Yes</Button>
                  </div>
                )}
                {shareStatus[buyer.id] === 'shared' && (
                  <div className="flex items-center justify-end gap-1 text-green-600 font-bold text-[10px]">
                    <Check className="h-3 w-3" /> Shared
                  </div>
                )}
              </CardFooter>
            )}
          </Card>
        ))}
      </div>
    </ScrollArea>
  );

  const renderTable = () => (
      <div className="overflow-x-auto">
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Budget</TableHead>
                    <TableHead>Area</TableHead>
                    <TableHead>Notes</TableHead>
                    {isShareMode && <TableHead className="text-right">Action</TableHead>}
                </TableRow>
            </TableHeader>
            <TableBody>
                {foundBuyers.map((buyer, index) => (
                    <TableRow key={buyer.id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{buyer.name}</TableCell>
                        <TableCell>{buyer.phone}</TableCell>
                        <TableCell>{formatBuyerBudget(buyer)}</TableCell>
                        <TableCell>{buyer.area_preference || 'N/A'}</TableCell>
                        <TableCell className="max-w-xs truncate">{buyer.notes || 'N/A'}</TableCell>
                        {isShareMode && (
                          <TableCell className="text-right">
                            {shareStatus[buyer.id] === 'idle' && (
                              <Button size="sm" onClick={() => handleShareToBuyer(buyer)}>
                                <Share2 className="mr-2 h-4 w-4" /> Share
                              </Button>
                            )}
                            {shareStatus[buyer.id] === 'confirming' && (
                               <div className="flex gap-2 justify-end items-center">
                                <span className="text-sm text-muted-foreground">Shared?</span>
                                <Button size="sm" variant="destructive" onClick={() => handleConfirmShare(buyer.id, false)}>No</Button>
                                <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => handleConfirmShare(buyer.id, true)}>Yes</Button>
                              </div>
                            )}
                            {shareStatus[buyer.id] === 'shared' && (
                              <div className="flex items-center justify-end gap-2 text-green-600 font-bold">
                                <Check className="h-5 w-5" /> Shared
                              </div>
                            )}
                          </TableCell>
                        )}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
      </div>
  );

  return (
    <>
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline flex items-center gap-2"><DollarSign/> Find By Budget</h1>
        <p className="text-muted-foreground">
          Find buyers by budget and area to quickly match them with properties.
        </p>
      </div>
      <Card>
        <CardHeader>
            <CardTitle>Find Buyers</CardTitle>
            <CardDescription>Enter a budget range and/or an area to find matching buyer leads.</CardDescription>
        </CardHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <CardContent>
                    <div className="space-y-4">
                    <FormField
                        control={form.control}
                        name="listing_type"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Buyer Listing Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue />
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="flex items-end gap-2 lg:col-span-2">
                        <FormField
                            control={form.control}
                            name="minBudget"
                            render={({ field }) => (
                            <FormItem className="flex-1">
                                <FormLabel>Min Budget</FormLabel>
                                <FormControl>
                                <Input type="number" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="maxBudget"
                            render={({ field }) => (
                            <FormItem className="flex-1">
                                <FormLabel>Max Budget</FormLabel>
                                <FormControl>
                                <Input type="number" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="budgetUnit"
                            render={({ field }) => (
                            <FormItem className="w-28">
                                <FormLabel>Unit</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                    </FormControl>
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
                        <FormField
                            control={form.control}
                            name="area"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Area Preference</FormLabel>
                                <FormControl>
                                <Input {...field} placeholder="e.g. DHA, Bahria" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <FormField
                            control={form.control}
                            name="status"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Buyer Status</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="All">All Statuses</SelectItem>
                                            {buyerStatuses.map(status => (
                                                <SelectItem key={status} value={status}>{status}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="propertyType"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Property Type</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="All">All Types</SelectItem>
                                            {propertyTypeValues.map(type => (
                                                <SelectItem key={type} value={type}>{type}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )}
                        />
                    </div>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={handleReset}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Reset
                    </Button>
                    <Button type="submit">Search</Button>
                </CardFooter>
            </form>
        </Form>
        {foundBuyers.length > 0 && (
          <div className="mt-6 space-y-4 p-6 border-t">
            <h4 className="font-semibold">Found {foundBuyers.length} Matching Buyers</h4>
            <div className="border rounded-md">
                {isMobile ? renderCards() : renderTable()}
            </div>
             <div className="flex justify-between items-center gap-2 pt-2">
                <Button variant="outline" onClick={handleDownload}><Download className="mr-2 h-4 w-4" /> Download List</Button>
                <Button onClick={() => setIsShareDialogOpen(true)}><Share2 className="mr-2 h-4 w-4"/> Share Detail</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
    <ShareDetailsDialog 
        isOpen={isShareDialogOpen} 
        setIsOpen={setIsShareDialogOpen}
        onSetMessage={(message, property) => {
            setPropertyMessage(message);
            setPropertyToShare(property);
        }}
        startSharing={() => setIsShareMode(true)}
        allProperties={allProperties || []}
        currency={currency}
    />
    </>
  );
}

interface ShareDetailsDialogProps {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    onSetMessage: (message: string, property: Property | null) => void;
    startSharing: () => void;
    allProperties: Property[];
    currency: Currency;
}

function ShareDetailsDialog({ isOpen, setIsOpen, onSetMessage, startSharing, allProperties, currency }: ShareDetailsDialogProps) {
    const [activeTab, setActiveTab] = useState('custom');
    const [customMessage, setCustomMessage] = useState('');
    const [propertySearch, setPropertySearch] = useState('');
    const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
    const [generatedMessage, setGeneratedMessage] = useState('');
    const [selectedLinks, setSelectedLinks] = useState<Record<VideoLinkPlatform, boolean>>({
        tiktok: false, youtube: false, instagram: false, facebook: false, other: false
    });

    const filteredProperties = useMemo(() => {
        if (!propertySearch) return [];
        const lowerQuery = propertySearch.toLowerCase();
        return allProperties.filter(p => 
            p.serial_no.toLowerCase().includes(lowerQuery) ||
            (p.auto_title && p.auto_title.toLowerCase().includes(lowerQuery)) ||
            (p.area && p.area.toLowerCase().includes(lowerQuery))
        ).slice(0, 10);
    }, [propertySearch, allProperties]);
    
    const availableLinks = useMemo(() => {
        if (!selectedProperty?.video_links) return [];
        return (Object.keys(selectedProperty.video_links) as VideoLinkPlatform[]).filter(key => !!selectedProperty.video_links![key as VideoLinkPlatform]);
    }, [selectedProperty]);

    useEffect(() => {
        if (selectedProperty) {
            const initialSelected: Record<VideoLinkPlatform, boolean> = {
                tiktok: !!selectedProperty.video_links?.tiktok,
                youtube: !!selectedProperty.video_links?.youtube,
                instagram: !!selectedProperty.video_links?.instagram,
                facebook: !!selectedProperty.video_links?.facebook,
                other: !!selectedProperty.video_links?.other
            };
            setSelectedLinks(initialSelected);
        }
    }, [selectedProperty]);

    useEffect(() => {
        if (selectedProperty) {
            const linksToShare = Object.entries(selectedLinks)
                .filter(([_, isSelected]) => isSelected)
                .map(([platform]) => {
                    const link = selectedProperty.video_links?.[platform as VideoLinkPlatform];
                    return link ? `${platform.charAt(0).toUpperCase() + platform.slice(1)}: ${link}` : null;
                })
                .filter(Boolean)
                .join('\n');
            const videoLinksSection = linksToShare ? `\n*Video Links:*\n${linksToShare}` : '';
            
            const demand = `${selectedProperty.demand_amount} ${selectedProperty.demand_unit}`;
            const utilities = [
                selectedProperty.meters?.gas && '- Gas',
                selectedProperty.meters?.electricity && '- Electricity',
                selectedProperty.meters?.water && '- Water'
            ].filter(Boolean).join('\n');

            if (selectedProperty.is_for_rent) {
                const rent = `${selectedProperty.demand_amount}${selectedProperty.demand_unit === 'Thousand' ? 'K' : ` ${selectedProperty.demand_unit}`}`;
                const rentDetails = `*RENT PROPERTY DETAILS* 🏡
Serial No: ${selectedProperty.serial_no}
Area: ${selectedProperty.area}
Type: ${selectedProperty.property_type}
Size/Marla: ${selectedProperty.size_value} ${selectedProperty.size_unit}
Portion: ${selectedProperty.storey || 'N/A'}
Demand: ${rent}

*Utilities:*
${utilities || 'N/A'}${videoLinksSection}`;
                setGeneratedMessage(rentDetails);
            } else {
                 const rentInBaseUnit = formatUnit(selectedProperty.potential_rent_amount || 0, selectedProperty.potential_rent_unit || 'Thousand');
                const potentialRent = selectedProperty.potential_rent_amount ? `Rs. ${formatCurrency(rentInBaseUnit, currency as Currency)}` : 'N/A';
                
                const saleDetails = `*PROPERTY DETAILS* 🏡
Serial No: ${selectedProperty.serial_no}
Area: ${selectedProperty.area}
Type: ${selectedProperty.property_type}
Size/Marla: ${selectedProperty.size_value} ${selectedProperty.size_unit}
Floor: ${selectedProperty.storey || 'N/A'}
Road Size: ${selectedProperty.road_size_ft ? `${selectedProperty.road_size_ft}ft` : 'N/A'}
Front/Length: ${selectedProperty.front_ft ? `${selectedProperty.front_ft}/${selectedProperty.length_ft || ''}` : 'N/A'}
Demand: ${demand}

*Financials:*
- Potential Rent: ${potentialRent.replace('RS ', 'Rs.')}

*Utilities:*
${utilities || 'N/A'}

*Documents:* ${selectedProperty.documents || 'N/A'}${videoLinksSection}`;
                setGeneratedMessage(saleDetails);
            }
        }
    }, [selectedProperty, selectedLinks, currency]);
    

    const handleSetMessage = () => {
        if (activeTab === 'custom') {
            onSetMessage(customMessage, null);
        } else {
            onSetMessage(generatedMessage, selectedProperty);
        }
        startSharing();
        setIsOpen(false);
    }
    
     const handleLinkSelectionChange = (platform: VideoLinkPlatform) => {
        setSelectedLinks(prev => ({ ...prev, [platform]: !prev[platform] }));
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Share Property Details</DialogTitle>
                    <DialogDescription>Create a message to share with the found buyers.</DialogDescription>
                </DialogHeader>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="custom">Custom Message</TabsTrigger>
                        <TabsTrigger value="property">From Property</TabsTrigger>
                    </TabsList>
                    <TabsContent value="custom" className="mt-4">
                        <Textarea 
                            value={customMessage}
                            onChange={(e) => setCustomMessage(e.target.value)}
                            rows={10}
                            placeholder="Type your custom message here..."
                        />
                    </TabsContent>
                    <TabsContent value="property" className="mt-4 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="prop-search">Search Property (by SN, Title, Area)</Label>
                            <Input id="prop-search" value={propertySearch} onChange={(e) => setPropertySearch(e.target.value)} />
                        </div>
                        {propertySearch && (
                            <ScrollArea className="h-40 border rounded-md">
                                <Command>
                                    <CommandList>
                                        <CommandEmpty>No properties found.</CommandEmpty>
                                        <CommandGroup>
                                            {filteredProperties.map(prop => (
                                                <CommandItem
                                                    key={prop.id}
                                                    onSelect={() => {
                                                        setSelectedProperty(prop);
                                                        setPropertySearch('');
                                                    }}
                                                >
                                                    <span>{prop.auto_title} ({prop.serial_no})</span>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </ScrollArea>
                        )}
                        {selectedProperty && (
                             <div className="p-4 border rounded-lg bg-muted/50 space-y-3">
                                <p><span className="font-semibold">Selected:</span> {selectedProperty.auto_title} ({selectedProperty.serial_no})</p>
                                {availableLinks.length > 0 && (
                                    <div>
                                        <Label className="font-semibold flex items-center gap-2 mb-2"><Video className="h-4 w-4" /> Include Video Links</Label>
                                        <div className="flex flex-wrap gap-x-4 gap-y-2">
                                            {availableLinks.map(platform => (
                                                <div key={platform} className="flex items-center space-x-2">
                                                    <Checkbox 
                                                        id={`share-${platform}`}
                                                        checked={selectedLinks[platform as VideoLinkPlatform]}
                                                        onCheckedChange={() => handleLinkSelectionChange(platform as VideoLinkPlatform)}
                                                    />
                                                    <Label htmlFor={`share-${platform}`} className="text-sm font-normal capitalize cursor-pointer">
                                                        {platform}
                                                    </Label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <Textarea readOnly value={generatedMessage} rows={8} />
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button onClick={handleSetMessage}>Set Message & Start Sharing</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
