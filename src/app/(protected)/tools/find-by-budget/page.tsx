'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
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
import { Download, Share2, Check, Phone, Wallet, Home, DollarSign, FileText, Video, RotateCcw, Search, ChevronDown, CheckSquare, ListChecks, X, SlidersHorizontal } from 'lucide-react';
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
import { collection, doc, updateDoc, arrayUnion, query, where, or } from 'firebase/firestore';
import { useFirestore } from '@/firebase/provider';
import { useProfile } from '@/context/profile-context';
import { useMemoFirebase } from '@/firebase/hooks';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { buyerStatuses } from '@/lib/data';
import { useUser } from '@/firebase/auth/use-user';

const propertyTypeValues = [
    'House', 'Flat', 'Farm House', 'Penthouse', 'Plot', 'Residential Plot', 'Commercial Plot', 'Agricultural Land', 'Industrial Land', 'Office', 'Shop', 'Warehouse', 'Factory', 'Building', 'Residential Property', 'Commercial Property', 'Semi Commercial'
];

type VideoLinkPlatform = 'tiktok' | 'youtube' | 'instagram' | 'facebook' | 'other';
type ShareStatus = 'idle' | 'confirming' | 'shared';

const formSchema = z.object({
  listing_type: z.enum(['For Sale', 'For Rent']).default('For Sale'),
  minBudget: z.coerce.number().min(0).optional(),
  maxBudget: z.coerce.number().min(0).optional(),
  budgetUnit: z.enum(['Lacs', 'Crore', 'Thousand']).default('Lacs'),
  area: z.array(z.string()).default([]),
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
  const { user } = useUser();
  const firestore = useFirestore();

  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [areaSearch, setAreaSearch] = useState('');

  const propertiesQuery = useMemoFirebase(() => {
      if (!profile.agency_id || !user) return null;
      return collection(firestore, 'agencies', profile.agency_id, 'properties');
  }, [profile.agency_id, firestore]);
  const { data: allProperties } = useCollection<Property>(propertiesQuery);

  const buyersQuery = useMemoFirebase(() => {
      if (!profile.agency_id || !user) return null;
      const ref = collection(firestore, 'agencies', profile.agency_id, 'buyers');
      
      if (profile.role === 'Agent') {
          return query(ref, 
            or(
                where('assignedTo', '==', user.uid),
                where('created_by', '==', user.uid)
            )
          );
      }
      return ref;
  }, [profile.agency_id, profile.role, user, firestore]);
  const { data: buyers } = useCollection<Buyer>(buyersQuery);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      listing_type: 'For Sale',
      minBudget: 0,
      maxBudget: 0,
      budgetUnit: 'Lacs',
      area: [],
      status: 'All',
      propertyType: 'All',
    },
  });

  const { setValue, watch } = form;
  const watchedAreas = watch('area');

  const uniqueAreas = useMemo(() => {
    if (!buyers) return [];
    const areas = new Set<string>();
    buyers.forEach(b => {
      if (b.area_preference) {
        b.area_preference.split(',').forEach(a => {
          const trimmed = a.trim();
          if (trimmed) areas.add(trimmed);
        });
      }
    });
    return Array.from(areas).sort();
  }, [buyers]);

  const filteredAreas = useMemo(() => {
    return uniqueAreas.filter(a => a.toLowerCase().includes(areaSearch.toLowerCase()));
  }, [uniqueAreas, areaSearch]);

  const toggleArea = useCallback((area: string) => {
    const current = form.getValues('area') || [];
    const next = current.includes(area)
      ? current.filter(a => a !== area)
      : [...current, area];
    form.setValue('area', next);
  }, [form]);

  const handleSelectAllAreas = () => {
    if (watchedAreas.length === uniqueAreas.length) {
        form.setValue('area', []);
    } else {
        form.setValue('area', [...uniqueAreas]);
    }
  };

  useEffect(() => {
    if (buyers) {
      try {
        const savedFilters = localStorage.getItem('findByBudgetFilters');
        const savedBuyersJSON = localStorage.getItem('findByBudgetResults');
        
        if (savedFilters) {
          form.reset(JSON.parse(savedFilters));
        }
        
        if (savedBuyersJSON) {
          const cachedResults = JSON.parse(savedBuyersJSON) as Buyer[];
          // Validation: Ensure the cached results belong to the current accessible pool (Crucial for Agents)
          const validResults = cachedResults.filter(cr => buyers.some(b => b.id === cr.id));
          setFoundBuyers(validResults);
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
    if (values.area.length === 0 && (!values.minBudget || !values.maxBudget)) {
        toast({ title: 'Invalid Search', description: 'Please provide a budget range or select an area to search.', variant: 'destructive'});
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
        
        const buyerAreas = buyer.area_preference?.split(',').map(a => a.trim().toLowerCase()).filter(Boolean) || [];
        const filterAreas = values.area.map(a => a.toLowerCase());
        const areaMatch = filterAreas.length === 0 || filterAreas.some(fa => buyerAreas.some(ba => ba.includes(fa) || fa.includes(ba)));

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
        area: [],
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
    <ScrollArea className="h-[500px]">
      <div className="p-4 space-y-4">
        {foundBuyers.map((buyer, index) => (
          <Card key={buyer.id} className="border-l-4 border-l-primary/40 bg-background hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="flex justify-between items-start text-base font-bold font-headline">
                <span>{index + 1}. {buyer.name}</span>
                <Badge variant="outline" className="font-mono text-[10px] bg-muted/30">{buyer.serial_no}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex items-center gap-2 font-medium"><Phone className="h-3.5 w-3.5 text-primary/60" /> {buyer.phone}</div>
              <div className="flex items-center gap-2 font-bold text-primary"><Wallet className="h-3.5 w-3.5 opacity-60" /> {formatBuyerBudget(buyer)}</div>
              <div className="flex items-center gap-2"><Home className="h-3.5 w-3.5 text-muted-foreground" /> {buyer.area_preference || 'N/A'}</div>
              <div className="flex items-start gap-2 pt-1 border-t border-dashed mt-2">
                <FileText className="h-3.5 w-3.5 text-muted-foreground mt-0.5" /> 
                <p className="whitespace-pre-wrap text-muted-foreground italic line-clamp-2">{buyer.notes || 'No notes.'}</p>
              </div>
            </CardContent>
            {isShareMode && (
              <CardFooter className="justify-end pt-0 border-t bg-muted/5 p-2">
                {shareStatus[buyer.id] === 'idle' && (
                  <Button size="sm" className="h-8 text-xs font-bold rounded-lg px-4" onClick={() => handleShareToBuyer(buyer)}>
                    <Share2 className="mr-2 h-3 w-3" /> Share
                  </Button>
                )}
                 {shareStatus[buyer.id] === 'confirming' && (
                  <div className="flex gap-2 justify-end items-center">
                    <span className="text-[10px] font-black uppercase text-muted-foreground mr-1">Shared?</span>
                    <Button size="sm" variant="destructive" className="h-7 px-3 rounded-lg text-[10px] font-bold" onClick={() => handleConfirmShare(buyer.id, false)}>NO</Button>
                    <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700 h-7 px-3 rounded-lg text-[10px] font-bold" onClick={() => handleConfirmShare(buyer.id, true)}>YES</Button>
                  </div>
                )}
                {shareStatus[buyer.id] === 'shared' && (
                  <div className="flex items-center justify-end gap-1.5 text-green-600 font-black text-[10px] uppercase tracking-wider pr-2">
                    <Check className="h-3.5 w-3.5" /> Shared successfully
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
            <TableHeader className="bg-muted/30">
                <TableRow>
                    <TableHead className="w-12 font-black text-[10px] uppercase">#</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">Name</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">Phone</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">Budget</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">Area Preference</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">Notes</TableHead>
                    {isShareMode && <TableHead className="text-right font-black text-[10px] uppercase">WhatsApp Action</TableHead>}
                </TableRow>
            </TableHeader>
            <TableBody>
                {foundBuyers.map((buyer, index) => (
                    <TableRow key={buyer.id} className="hover:bg-primary/5 transition-colors">
                        <TableCell className="text-xs font-bold text-muted-foreground">{index + 1}</TableCell>
                        <TableCell>
                            <div className="font-bold font-headline">{buyer.name}</div>
                            <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{buyer.serial_no}</div>
                        </TableCell>
                        <TableCell className="text-xs font-medium">{buyer.phone}</TableCell>
                        <TableCell className="text-xs font-black text-primary">{formatBuyerBudget(buyer)}</TableCell>
                        <TableCell className="text-xs font-medium max-w-[150px] truncate">{buyer.area_preference || 'N/A'}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground italic">{buyer.notes || 'N/A'}</TableCell>
                        {isShareMode && (
                          <TableCell className="text-right">
                            {shareStatus[buyer.id] === 'idle' && (
                              <Button size="sm" onClick={() => handleShareToBuyer(buyer)} className="glowing-btn h-8 rounded-lg font-bold text-[10px]">
                                <Share2 className="mr-2 h-3 w-3" /> SHARE TO WA
                              </Button>
                            )}
                            {shareStatus[buyer.id] === 'confirming' && (
                               <div className="flex gap-2 justify-end items-center">
                                <span className="text-[10px] font-black text-muted-foreground uppercase mr-1">Shared?</span>
                                <Button size="sm" variant="destructive" className="h-7 rounded-lg text-[10px] font-bold" onClick={() => handleConfirmShare(buyer.id, false)}>NO</Button>
                                <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700 h-7 rounded-lg text-[10px] font-bold" onClick={() => handleConfirmShare(buyer.id, true)}>YES</Button>
                              </div>
                            )}
                            {shareStatus[buyer.id] === 'shared' && (
                              <div className="flex items-center justify-end gap-2 text-green-600 font-black text-[10px] uppercase pr-2">
                                <Check className="h-4 w-4" /> SHARED
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
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-3xl font-black tracking-tight font-headline flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-primary" /> Find By Budget
            </h1>
            <p className="text-muted-foreground font-medium">
            Match buyers with properties using advanced budget and area filters.
            </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
            <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">1</div>
                <h3 className="font-bold text-lg flex items-center gap-2"><SlidersHorizontal className="h-5 w-5" /> Search Criteria</h3>
            </div>

            <Card className="shadow-xl border-none bg-card/60 backdrop-blur-sm">
                <CardContent className="pt-6">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="listing_type"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel className="text-xs font-black uppercase tracking-widest opacity-60">Lead Interest</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                        <SelectTrigger className="h-11 rounded-xl bg-background border-border/60">
                                            <SelectValue />
                                        </SelectTrigger>
                                        </FormControl>
                                        <SelectContent className="rounded-xl border-none shadow-xl">
                                        <SelectItem value="For Sale">Buying (For Sale)</SelectItem>
                                        <SelectItem value="For Rent">Renting (For Rent)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="space-y-3">
                                <Label className="text-xs font-black uppercase tracking-widest opacity-60">Budget Range</Label>
                                <div className="flex gap-2">
                                    <FormField
                                        control={form.control}
                                        name="minBudget"
                                        render={({ field }) => (
                                        <FormItem className="flex-1">
                                            <FormControl>
                                                <Input type="number" placeholder="Min" className="h-11 rounded-xl bg-background border-border/60" {...field} />
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
                                            <FormControl>
                                                <Input type="number" placeholder="Max" className="h-11 rounded-xl bg-background border-border/60" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                        )}
                                    />
                                </div>
                                <FormField
                                    control={form.control}
                                    name="budgetUnit"
                                    render={({ field }) => (
                                    <FormItem>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="h-11 rounded-xl bg-background border-border/60">
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="rounded-xl border-none shadow-xl">
                                                <SelectItem value="Thousand">Thousand</SelectItem>
                                                <SelectItem value="Lacs">Lacs</SelectItem>
                                                <SelectItem value="Crore">Crore</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                    )}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs font-black uppercase tracking-widest opacity-60">Area Preference</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full justify-between h-11 mt-1.5 bg-background rounded-xl border-border/60 font-normal">
                                            {watchedAreas.length > 0 ? (
                                                <span className="font-bold text-primary truncate">{watchedAreas.length} Selected</span>
                                            ) : "Search Areas..."}
                                            <ChevronDown className="h-4 w-4 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="p-0 w-[300px] shadow-2xl bg-background border-none rounded-2xl overflow-hidden" align="start">
                                        <div className="p-3 border-b bg-muted/30">
                                            <div className="relative">
                                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input 
                                                    placeholder="Search area name..." 
                                                    className="h-10 pl-9 rounded-lg bg-background border-none ring-1 ring-border focus-visible:ring-primary/40" 
                                                    value={areaSearch} 
                                                    onChange={(e) => setAreaSearch(e.target.value)} 
                                                />
                                            </div>
                                        </div>
                                        <div className="p-2 border-b bg-muted/5 flex items-center justify-between">
                                            <span className="text-[10px] font-black uppercase text-muted-foreground pl-1">Selection Options</span>
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-7 text-[10px] font-black uppercase text-primary hover:bg-primary/10 gap-1.5"
                                                onClick={(e) => { e.preventDefault(); handleSelectAllAreas(); }}
                                            >
                                                <ListChecks className="h-3 w-3" />
                                                {watchedAreas.length === uniqueAreas.length ? 'Deselect All' : 'Select All'}
                                            </Button>
                                        </div>
                                        <ScrollArea className="h-[250px] overflow-y-auto" onWheel={(e) => e.stopPropagation()}>
                                            <div className="p-2 space-y-1">
                                                {filteredAreas.length > 0 ? (
                                                    filteredAreas.map((areaName) => (
                                                        <div 
                                                            key={areaName} 
                                                            className={cn(
                                                                "flex items-center space-x-3 p-2.5 rounded-xl cursor-pointer transition-all",
                                                                watchedAreas.includes(areaName) ? "bg-primary/5 text-primary" : "hover:bg-accent"
                                                            )}
                                                            onClick={() => toggleArea(areaName)}
                                                        >
                                                            <Checkbox 
                                                                id={`filter-area-${areaName}`} 
                                                                checked={watchedAreas.includes(areaName)}
                                                                onCheckedChange={() => toggleArea(areaName)}
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                            <label 
                                                                htmlFor={`filter-area-${areaName}`} 
                                                                className="text-sm flex-1 cursor-pointer truncate font-bold"
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    toggleArea(areaName);
                                                                }}
                                                            >
                                                                {areaName}
                                                            </label>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="py-10 text-center text-sm text-muted-foreground">
                                                        No matching areas.
                                                    </div>
                                                )}
                                            </div>
                                        </ScrollArea>
                                        {watchedAreas.length > 0 && (
                                            <div className="p-2 border-t bg-muted/10 flex justify-between items-center">
                                                <span className="text-[10px] font-black uppercase text-muted-foreground pl-2">{watchedAreas.length} Selected</span>
                                                <Button variant="ghost" size="sm" className="h-8 text-[10px] font-black uppercase text-primary hover:bg-primary/10" onClick={() => setValue('area', [])}>
                                                    Clear All
                                                </Button>
                                            </div>
                                        )}
                                    </PopoverContent>
                                </Popover>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="status"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-black uppercase tracking-widest opacity-60">Status</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="h-11 rounded-xl bg-background border-border/60">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="rounded-xl border-none shadow-xl">
                                                    <SelectItem value="All">All Status</SelectItem>
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
                                            <FormLabel className="text-xs font-black uppercase tracking-widest opacity-60">Type</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="h-11 rounded-xl bg-background border-border/60">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="rounded-xl border-none shadow-xl">
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

                            <div className="flex gap-2 pt-2">
                                <Button type="button" variant="outline" onClick={handleReset} className="flex-1 h-12 rounded-xl font-bold">
                                    <RotateCcw className="mr-2 h-4 w-4" /> Reset
                                </Button>
                                <Button type="submit" className="flex-[2] h-12 rounded-xl font-bold glowing-btn">
                                    Search Buyers
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">2</div>
                    <h3 className="font-bold text-lg flex items-center gap-2"><CheckSquare className="h-5 w-5" /> Search Results</h3>
                </div>
                {foundBuyers.length > 0 && (
                     <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="rounded-lg h-9 font-bold" onClick={handleDownload}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
                        <Button size="sm" className="rounded-lg h-9 font-bold glowing-btn" onClick={() => setIsShareDialogOpen(true)}><Share2 className="mr-2 h-4 w-4"/> Share Property</Button>
                    </div>
                )}
            </div>

            {foundBuyers.length > 0 ? (
                <Card className="shadow-2xl border-none overflow-hidden bg-card/60 backdrop-blur-sm rounded-2xl">
                    <CardContent className="p-0">
                        {isMobile ? renderCards() : renderTable()}
                    </CardContent>
                </Card>
            ) : (
                <div className="flex flex-col items-center justify-center h-[500px] border-2 border-dashed rounded-3xl opacity-40 bg-muted/5">
                    <Search className="h-16 w-16 mb-4 text-muted-foreground" />
                    <p className="text-xl font-black uppercase tracking-widest">No matching leads</p>
                    <p className="text-sm font-medium mt-1">Adjust filters and click "Search" to find buyers.</p>
                </div>
            )}
        </div>
      </div>
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
    const [activeTab, setActiveTab] = useState('property');
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
        if (!selectedProperty?.is_recorded || !selectedProperty.video_links) return [];
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
            <DialogContent className="sm:max-w-xl max-h-[70vh] sm:max-h-[90vh] border-none shadow-2xl rounded-3xl overflow-hidden bg-background">
                <DialogHeader>
                    <DialogTitle className="font-headline text-2xl font-black tracking-tight">Share Property Details</DialogTitle>
                    <DialogDescription className="font-medium">Create a message to share with matching buyer leads.</DialogDescription>
                </DialogHeader>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
                    <TabsList className="grid w-full grid-cols-2 rounded-full h-12 p-1 bg-muted/50">
                        <TabsTrigger value="property" className="rounded-full font-bold">Pick Property</TabsTrigger>
                        <TabsTrigger value="custom" className="rounded-full font-bold">Custom Msg</TabsTrigger>
                    </TabsList>
                    <TabsContent value="custom" className="mt-6">
                        <Textarea 
                            value={customMessage}
                            onChange={(e) => setCustomMessage(e.target.value)}
                            rows={10}
                            placeholder="Type your custom message here..."
                            className="rounded-2xl bg-muted/30 border-border/60 focus-visible:ring-primary/20 p-4"
                        />
                    </TabsContent>
                    <TabsContent value="property" className="mt-6 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="prop-search" className="text-[10px] font-black uppercase tracking-widest opacity-60">Search Property (by SN, Title, Area)</Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input id="prop-search" value={propertySearch} onChange={(e) => setPropertySearch(e.target.value)} className="h-11 pl-10 rounded-xl bg-muted/30 border-border/60" placeholder="e.g. P-10 or DHA" />
                            </div>
                        </div>
                        {propertySearch && (
                            <ScrollArea className="h-48 border rounded-2xl bg-background shadow-inner">
                                <div className="p-2 space-y-1">
                                    {filteredProperties.length > 0 ? (
                                        filteredProperties.map(prop => (
                                            <Button
                                                key={prop.id}
                                                variant="ghost"
                                                className="w-full justify-start text-xs h-10 rounded-lg hover:bg-primary/5 hover:text-primary font-bold"
                                                onClick={() => {
                                                    setSelectedProperty(prop);
                                                    setPropertySearch('');
                                                }}
                                            >
                                                <Badge variant="outline" className="mr-2 font-mono text-[9px] uppercase px-1.5">{prop.serial_no}</Badge>
                                                <span className="truncate">{prop.auto_title}</span>
                                            </Button>
                                        ))
                                    ) : (
                                        <p className="text-center text-xs text-muted-foreground p-10 font-medium">No properties found matching your search.</p>
                                    )}
                                </div>
                            </ScrollArea>
                        )}
                        {selectedProperty && (
                             <div className="p-5 border rounded-2xl bg-primary/5 space-y-4 border-primary/20 animate-fade-in">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-primary">Selected Inventory</p>
                                        <p className="font-bold text-sm">{selectedProperty.auto_title}</p>
                                    </div>
                                    <Badge variant="outline" className="bg-background font-mono px-2 py-0.5">{selectedProperty.serial_no}</Badge>
                                </div>
                                {availableLinks.length > 0 && (
                                    <div className="bg-background/60 p-3 rounded-xl border border-border/40">
                                        <Label className="font-black text-[10px] uppercase tracking-widest flex items-center gap-2 mb-3 opacity-70"><Video className="h-3 w-3" /> Include Video Links</Label>
                                        <div className="flex flex-wrap gap-x-4 gap-y-2">
                                            {availableLinks.map(platform => (
                                                <div key={platform} className="flex items-center space-x-2">
                                                    <Checkbox 
                                                        id={`share-${platform}`}
                                                        checked={selectedLinks[platform as VideoLinkPlatform]}
                                                        onCheckedChange={() => handleLinkSelectionChange(platform as VideoLinkPlatform)}
                                                    />
                                                    <Label htmlFor={`share-${platform}`} className="text-xs font-bold capitalize cursor-pointer opacity-80">
                                                        {platform}
                                                    </Label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <Textarea readOnly value={generatedMessage} rows={8} className="text-xs font-mono bg-background/80 border-border/40" />
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
                <DialogFooter className="mt-6 gap-2">
                    <Button variant="outline" onClick={() => setIsOpen(false)} className="rounded-xl h-11 px-6">Cancel</Button>
                    <Button onClick={handleSetMessage} className="rounded-xl h-11 px-8 glowing-btn">
                        Set Message & Start Matching
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
