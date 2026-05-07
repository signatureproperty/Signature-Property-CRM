
'use client';

import { AddBuyerDialog } from '@/components/add-buyer-dialog';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { buyerStatuses } from '@/lib/data';
import { Badge } from '@/components/ui/badge';
import { Edit, MoreHorizontal, PlusCircle, Trash2, Phone, Home, Filter, Wallet, Ruler, Eye, MessageSquare, ChevronLeft, ChevronRight, ArrowUpDown, Tag as TagIcon, Search, MapPin, Building, ChevronDown, UserPlus } from 'lucide-react';
import { useState, useMemo, useEffect, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { Buyer, BuyerStatus, PriceUnit, SizeUnit, PropertyType, User, Activity, ListingType, Tag } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useSearch } from '../layout';
import { BuyerDetailsDialog } from '@/components/buyer-details-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatUnit, formatPhoneNumberForWhatsApp } from '@/lib/formatters';
import { useCurrency } from '@/context/currency-context';
import { useProfile } from '@/context/profile-context';
import { useFirestore } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, addDoc, setDoc, doc, updateDoc, writeBatch, query, where, or } from 'firebase/firestore';
import { useMemoFirebase } from '@/firebase/hooks';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import React from 'react';
import { useUser } from '@/firebase/auth/use-user';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ManageTagsDialog } from '@/components/manage-tags-dialog';

const ITEMS_PER_PAGE = 50;

const statusVariant = {
    'New': 'bg-blue-100 text-blue-700 border-blue-200',
    'Interested': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'Not Interested': 'bg-red-100 text-red-700 border-red-200',
    'Follow Up': 'bg-purple-100 text-purple-700 border-purple-200',
    'Visited Property': 'bg-orange-100 text-orange-700 border-orange-200',
    'Deal Closed': 'bg-slate-800 text-white border-slate-700',
    'Deal Lost': 'bg-gray-400 text-white border-gray-300',
    'Pending': 'bg-amber-100 text-amber-700 border-amber-200'
} as const;

const propertyTypesForFilter: (PropertyType | 'All')[] = [
  'All', 'House', 'Flat', 'Farm House', 'Penthouse', 'Plot', 'Residential Plot', 'Commercial Plot', 'Agricultural Land', 'Industrial Land', 'Office', 'Shop', 'Warehouse', 'Factory', 'Building', 'Residential Property', 'Commercial Property', 'Semi Commercial'
];

interface Filters {
    area: string[];
    propertyType: PropertyType | 'All';
    minBudget: string;
    maxBudget: string;
    budgetUnit: PriceUnit | 'All';
    minSize: string;
    maxSize: string;
    sizeUnit: SizeUnit | 'All';
    serialNo: string;
    serialNoPrefix: 'All' | 'B' | 'RB';
}

function formatSize(minAmount?: number, minUnit?: SizeUnit, maxAmount?: number, maxUnit?: SizeUnit) {
    if (!minAmount || !minUnit) return 'N/A';
    if (!maxAmount || !maxUnit || (minAmount === maxAmount && minUnit === maxUnit)) return `${minAmount} ${minUnit}`;
    return `${minAmount} - ${maxAmount} ${minUnit}`;
}

function BuyersPageContent() {
    const isMobile = useIsMobile();
    const router = useRouter();
    const { user } = useUser();
    const { profile } = useProfile();
    const { searchQuery } = useSearch();
    const { toast } = useToast();
    const { currency } = useCurrency();
    
    const firestore = useFirestore();
    
    const allAgencyBuyersQuery = useMemoFirebase(() => {
        if (!profile.agency_id) return null;
        const buyersRef = collection(firestore, 'agencies', profile.agency_id, 'buyers');
        if (profile.role === 'Agent' && user?.uid) {
            return query(buyersRef, 
                or(
                    where('created_by', '==', user.uid),
                    where('assignedTo', '==', user.uid)
                )
            );
        }
        return query(buyersRef);
    }, [profile.agency_id, firestore, profile.role, user?.uid]);
    const { data: allBuyers, isLoading: isAgencyLoading } = useCollection<Buyer>(allAgencyBuyersQuery);

    const teamMembersQuery = useMemoFirebase(() => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'teamMembers') : null, [profile.agency_id, firestore]);
    const { data: teamMembers } = useCollection<User>(teamMembersQuery);

    const tagsQuery = useMemoFirebase(() => 
        profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'tags') : null,
        [profile.agency_id, firestore]
    );
    const { data: agencyTags } = useCollection<Tag>(tagsQuery);

    const [activeListingType, setActiveListingType] = useState<ListingType | 'All'>('All');
    const [activeStatus, setActiveStatus] = useState<string>('All');
    const [activeCustomTags, setActiveCustomTags] = useState<string[]>([]);

    const [isAddBuyerOpen, setIsAddBuyerOpen] = useState(false);
    const [isManageTagsOpen, setIsManageTagsOpen] = useState(false);
    const [buyerToEdit, setBuyerToEdit] = useState<Buyer | null>(null);
    const [selectedBuyers, setSelectedBuyers] = useState<string[]>([]);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [selectedBuyerForDetails, setSelectedBuyerForDetails] = useState<Buyer | null>(null);
    const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    const [filters, setFilters] = useState<Filters>({
        area: [],
        propertyType: 'All',
        minBudget: '',
        maxBudget: '',
        budgetUnit: 'All',
        minSize: '',
        maxSize: '',
        sizeUnit: 'All',
        serialNo: '',
        serialNoPrefix: 'All'
    });
    const [areaSearch, setAreaSearch] = useState('');

    const activeAgents = useMemo(() => {
        return teamMembers?.filter(m => m.status === 'Active' && m.role === 'Agent') || [];
    }, [teamMembers]);

    const handleFilterChange = (key: keyof Filters, value: any) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
    };

    const clearFilters = () => {
        setFilters({
            area: [],
            propertyType: 'All',
            minBudget: '',
            maxBudget: '',
            budgetUnit: 'All',
            minSize: '',
            maxSize: '',
            sizeUnit: 'All',
            serialNo: '',
            serialNoPrefix: 'All'
        });
        setAreaSearch('');
    };

    const logActivity = async (action: string, target: string, targetType: Activity['targetType'], details: any = null) => {
        if (!profile.agency_id) return;
        const activityLogRef = collection(firestore, 'agencies', profile.agency_id, 'activityLogs');
        await addDoc(activityLogRef, {
            userName: profile.name,
            action,
            target,
            targetType,
            details,
            timestamp: new Date().toISOString(),
            agency_id: profile.agency_id,
        });
    };

    const handleEdit = (buyer: Buyer) => {
        setBuyerToEdit(buyer);
        setIsAddBuyerOpen(true);
    };

    const handleDetailsClick = (buyer: Buyer) => {
        setSelectedBuyerForDetails(buyer);
        setIsDetailsOpen(true);
    };

    const handleSaveBuyer = async (buyerData: Omit<Buyer, 'id'> & { id?: string }) => {
        if (!profile.agency_id) return;
        if (buyerToEdit && buyerData.id) {
            const docRef = doc(firestore, 'agencies', profile.agency_id, 'buyers', buyerData.id);
            await setDoc(docRef, buyerData, { merge: true });
            toast({ title: 'Buyer Updated' });
        } else {
            const collectionRef = collection(firestore, 'agencies', profile.agency_id, 'buyers');
            const { id, ...restOfData } = buyerData;
            await addDoc(collectionRef, { ...restOfData, agency_id: profile.agency_id, created_by: user?.uid });
            await logActivity('added a new buyer', buyerData.name, 'Buyer');
            toast({ title: 'Buyer Added' });
        }
    };

    const handleDelete = async (buyer: Buyer) => {
        if (!profile.agency_id) return;
        const docRef = doc(firestore, 'agencies', profile.agency_id, 'buyers', buyer.id);
        await updateDoc(docRef, { is_deleted: true });
        toast({ title: "Buyer Moved to Trash" });
    };

    const handleBulkAssign = async (agentDocId: string) => {
        if (selectedBuyers.length === 0 || !agentDocId || !profile.agency_id) return;
        
        const agent = activeAgents.find(a => a.id === agentDocId);
        if(!agent) return;

        const actualAgentUid = agent.user_id || agent.id; // Use UID for invited agents
        const batch = writeBatch(firestore);
        const buyerNames: string[] = [];
        
        selectedBuyers.forEach(buyerId => {
            const buyer = allBuyers?.find(b => b.id === buyerId);
            if(buyer) buyerNames.push(buyer.name);
            
            const docRef = doc(firestore, 'agencies', profile.agency_id, 'buyers', buyerId);
            batch.update(docRef, { assignedTo: actualAgentUid });
        });
        
        const activityLogRef = doc(collection(firestore, 'agencies', profile.agency_id, 'activityLogs'));
        batch.set(activityLogRef, {
            userName: profile.name,
            action: `assigned ${buyerNames.length} leads to ${agent.name}`,
            target: buyerNames.join(', '),
            targetType: 'Buyer',
            timestamp: new Date().toISOString(),
            agency_id: profile.agency_id,
            assignedToId: actualAgentUid,
            assignedToName: agent.name
        });

        await batch.commit();
        toast({ title: 'Leads Assigned Successfully' });
        setSelectedBuyers([]);
    };

    const handleBulkDelete = async () => {
        if (selectedBuyers.length === 0 || !profile.agency_id) return;
        const batch = writeBatch(firestore);
        selectedBuyers.forEach(buyerId => {
            const docRef = doc(firestore, 'agencies', profile.agency_id, 'buyers', buyerId);
            batch.update(docRef, { is_deleted: true });
        });
        await batch.commit();
        toast({ title: 'Buyers Moved to Trash' });
        setSelectedBuyers([]);
    };

    const handleToggleCustomTag = (tagName: string) => {
        setActiveCustomTags(prev => 
            prev.includes(tagName) ? prev.filter(t => t !== tagName) : [...prev, tagName]
        );
    };

    const filteredBuyers = useMemo(() => {
        if (!allBuyers) return [];
        let buyers = allBuyers.filter(b => !b.is_deleted);
        
        if (activeListingType !== 'All') {
            buyers = buyers.filter(b => (b.listing_type || 'For Sale') === activeListingType);
        }
        if (activeStatus !== 'All') {
            buyers = buyers.filter(b => b.status === activeStatus);
        }
        if (activeCustomTags.length > 0) {
            buyers = buyers.filter(b => activeCustomTags.every(tag => b.tags?.includes(tag)));
        }

        if (searchQuery) {
            const lq = searchQuery.toLowerCase();
            buyers = buyers.filter(b => b.name.toLowerCase().includes(lq) || b.serial_no.toLowerCase().includes(lq) || b.phone.includes(lq));
        }

        if (filters.area.length > 0) buyers = buyers.filter(b => filters.area.some(a => b.area_preference?.includes(a)));
        if (filters.propertyType !== 'All') buyers = buyers.filter(b => b.property_type_preference === filters.propertyType);
        if (filters.minSize) buyers = buyers.filter(b => (b.size_min_value || 0) >= Number(filters.minSize));
        if (filters.maxSize) buyers = buyers.filter(b => (b.size_max_value || 0) <= Number(filters.maxSize));
        if (filters.sizeUnit !== 'All') buyers = buyers.filter(b => b.size_min_unit === filters.sizeUnit);
        
        if (filters.minBudget) {
            buyers = buyers.filter(b => {
                const val = formatUnit(b.budget_min_amount || 0, b.budget_min_unit || 'Lacs');
                const filterVal = formatUnit(Number(filters.minBudget), filters.budgetUnit as PriceUnit || 'Lacs');
                return val >= filterVal;
            });
        }
        if (filters.maxBudget) {
            buyers = buyers.filter(b => {
                const val = formatUnit(b.budget_max_amount || 0, b.budget_max_unit || 'Lacs');
                const filterVal = formatUnit(Number(filters.maxBudget), filters.budgetUnit as PriceUnit || 'Lacs');
                return val <= filterVal;
            });
        }
        if (filters.serialNo && filters.serialNoPrefix !== 'All') {
            const fullSerialNo = `${filters.serialNoPrefix}-${filters.serialNo}`;
            buyers = buyers.filter(b => b.serial_no === fullSerialNo);
        }

        return buyers.sort((a, b) => {
            const aNum = parseInt(a.serial_no.split('-')[1] || '0', 10);
            const bNum = parseInt(b.serial_no.split('-')[1] || '0', 10);
            return sortOrder === 'asc' ? aNum - bNum : bNum - aNum;
        });
    }, [allBuyers, activeListingType, activeStatus, activeCustomTags, searchQuery, sortOrder, filters]);

    const totalPages = Math.ceil(filteredBuyers.length / ITEMS_PER_PAGE);
    const paginatedBuyers = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredBuyers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredBuyers, currentPage]);

    const renderTable = (buyers: Buyer[]) => {
        if (isAgencyLoading) return <p className="p-4 text-center">Loading buyers...</p>;
        if (buyers.length === 0) return <div className="text-center py-10 text-muted-foreground">No buyers found.</div>;
        return (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-10">
                            <Checkbox checked={paginatedBuyers.length > 0 && selectedBuyers.length === paginatedBuyers.length} onCheckedChange={(c) => setSelectedBuyers(c ? paginatedBuyers.map(b => b.id) : [])} />
                        </TableHead>
                        <TableHead><Button variant="ghost" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>Name <ArrowUpDown className="ml-2 h-4 w-4" /></Button></TableHead>
                        <TableHead>Requirement</TableHead>
                        <TableHead>Budget</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {buyers.map(buyer => {
                        const areas = buyer.area_preference?.split(',').map(a => a.trim()).filter(Boolean) || [];
                        const displayedAreas = areas.length > 2 
                            ? areas.slice(0, 2).join(', ') + '...' 
                            : areas.join(', ') || 'N/A';
                            
                        return (
                            <TableRow key={buyer.id} className="cursor-pointer hover:bg-accent/50" onClick={() => handleDetailsClick(buyer)}>
                                <TableCell onClick={e => e.stopPropagation()}><Checkbox checked={selectedBuyers.includes(buyer.id)} onCheckedChange={(c) => setSelectedBuyers(p => c ? [...p, buyer.id] : p.filter(id => id !== buyer.id))} /></TableCell>
                                <TableCell>
                                    <div className="font-bold text-base font-headline">{buyer.name}</div>
                                    <div className="flex gap-1 mt-1">
                                        <Badge variant="outline" className={cn("text-[10px] border-primary/20", buyer.serial_no.startsWith('RB') ? "bg-emerald-100 text-emerald-700" : "bg-primary/10 text-primary")}>{buyer.serial_no}</Badge>
                                        <span className="text-[10px] text-muted-foreground">{buyer.phone}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="text-sm font-medium">{displayedAreas}</div>
                                    <div className="text-xs text-muted-foreground">{buyer.property_type_preference}</div>
                                </TableCell>
                                <TableCell>
                                    <div className="text-sm font-bold text-primary">{formatCurrency(formatUnit(buyer.budget_min_amount || 0, buyer.budget_min_unit || 'Lacs'), currency)}</div>
                                </TableCell>
                                <TableCell>
                                    <div className="text-xs text-muted-foreground">{formatSize(buyer.size_min_value, buyer.size_min_unit, buyer.size_max_value, buyer.size_max_unit)}</div>
                                </TableCell>
                                <TableCell><Badge className={cn("text-[10px] uppercase font-bold", statusVariant[buyer.status as keyof typeof statusVariant] || 'bg-primary')}>{buyer.status}</Badge></TableCell>
                                <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal /></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onSelect={() => handleDetailsClick(buyer)}><Eye /> View</DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => handleEdit(buyer)}><Edit /> Edit</DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => handleDelete(buyer)} className="text-destructive"><Trash2 /> Delete</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        );
    };

    const renderCards = (buyers: Buyer[]) => (
        <div className="space-y-4">
            {buyers.map(buyer => (
                <Card key={buyer.id} onClick={() => handleDetailsClick(buyer)} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader className="p-4 flex flex-row justify-between items-start">
                        <div className="flex gap-2">
                            <Checkbox checked={selectedBuyers.includes(buyer.id)} onClick={e => e.stopPropagation()} onCheckedChange={(c) => setSelectedBuyers(p => c ? [...p, buyer.id] : p.filter(id => id !== buyer.id))} />
                            <div>
                                <CardTitle className="text-base font-bold font-headline">{buyer.name}</CardTitle>
                                <div className="text-[10px] text-muted-foreground mt-1">{buyer.serial_no} • {buyer.phone}</div>
                            </div>
                        </div>
                        <Badge className={cn("text-[10px]", statusVariant[buyer.status as keyof typeof statusVariant])}>{buyer.status}</Badge>
                    </CardHeader>
                    <CardFooter className="p-4 pt-0 justify-between">
                        <div className="text-sm font-medium">{buyer.area_preference}</div>
                        <Button variant="ghost" size="sm">Details <ChevronRight className="ml-1 h-3 w-3" /></Button>
                    </CardFooter>
                </Card>
            ))}
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight">Buyers</h1>
                    <p className="text-muted-foreground">Manage and track your agency leads.</p>
                </div>
                <div className="flex w-full md:w-auto items-center gap-2 flex-wrap justify-end ml-auto">
                    {selectedBuyers.length > 0 && profile.role === 'Admin' && (
                        <div className="flex items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="rounded-full">
                                <UserPlus className="mr-2 h-4 w-4" /> Assign
                            </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                            {activeAgents.map((member) => (
                                <DropdownMenuItem key={member.id} onSelect={() => handleBulkAssign(member.id)}>
                                {member.name}
                                </DropdownMenuItem>
                            ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button variant="destructive" className="rounded-full" onClick={handleBulkDelete}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete ({selectedBuyers.length})
                        </Button>
                        </div>
                    )}
                    <AlertDialog open={isFilterPopoverOpen} onOpenChange={setIsFilterPopoverOpen}>
                        <AlertDialogTrigger asChild>
                            <Button variant="outline" className="rounded-full"><Filter className="mr-2 h-4 w-4" /> Filters {filters.area.length > 0 && `(${filters.area.length})`}</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="max-w-md glass-card">
                            <AlertDialogHeader><AlertDialogTitle>Refine Buyer Search</AlertDialogTitle></AlertDialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-3 items-center gap-4">
                                    <Label>Serial No</Label>
                                    <div className="col-span-2 grid grid-cols-2 gap-2">
                                        <Select value={filters.serialNoPrefix} onValueChange={(v: any) => handleFilterChange('serialNoPrefix', v)}>
                                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                            <SelectContent><SelectItem value="All">All</SelectItem><SelectItem value="B">B</SelectItem><SelectItem value="RB">RB</SelectItem></SelectContent>
                                        </Select>
                                        <Input placeholder="e.g. 1" type="number" value={filters.serialNo} onChange={e => handleFilterChange('serialNo', e.target.value)} className="h-8" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 items-center gap-4">
                                    <Label htmlFor="propertyType">Type</Label>
                                    <Select value={filters.propertyType} onValueChange={(value: any) => handleFilterChange('propertyType', value)}>
                                        <SelectTrigger className="col-span-2 h-8">
                                            <SelectValue placeholder="Property Type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {propertyTypesForFilter.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-3 items-center gap-4">
                                    <Label>Budget</Label>
                                    <div className="col-span-2 grid grid-cols-2 gap-2">
                                        <Input placeholder="Min" type="number" value={filters.minBudget} onChange={e => handleFilterChange('minBudget', e.target.value)} className="h-8" />
                                        <Input placeholder="Max" type="number" value={filters.maxBudget} onChange={e => handleFilterChange('maxBudget', e.target.value)} className="h-8" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 items-center gap-4">
                                    <Label></Label>
                                    <div className="col-span-2">
                                        <Select value={filters.budgetUnit} onValueChange={(value: any) => handleFilterChange('budgetUnit', value)}>
                                            <SelectTrigger className="h-8">
                                                <SelectValue placeholder="Unit" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="All">All Units</SelectItem>
                                                <SelectItem value="Thousand">Thousand</SelectItem>
                                                <SelectItem value="Lacs">Lacs</SelectItem>
                                                <SelectItem value="Crore">Crore</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <Button variant="ghost" onClick={clearFilters}>Clear All</Button>
                                <AlertDialogAction onClick={() => setIsFilterPopoverOpen(false)}>Apply</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    <Button className="rounded-full glowing-btn" onClick={() => { setBuyerToEdit(null); setIsAddBuyerOpen(true); }}><PlusCircle className="mr-2 h-4 w-4" /> Add Buyer</Button>
                </div>
            </div>

            <Card className="border-none shadow-none bg-transparent">
                <ScrollArea className="w-full whitespace-nowrap pb-4">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 pr-4 border-r border-border/50">
                            <Badge variant={activeListingType === 'All' ? 'default' : 'outline'} className={cn("cursor-pointer px-4 py-1.5 rounded-full", activeListingType === 'All' ? "bg-primary" : "hover:bg-accent")} onClick={() => setActiveListingType('All')}>All Types</Badge>
                            <Badge variant={activeListingType === 'For Sale' ? 'default' : 'outline'} className={cn("cursor-pointer px-4 py-1.5 rounded-full bg-blue-50 text-blue-700 border-blue-100", activeListingType === 'For Sale' && "ring-2 ring-primary ring-offset-2")} onClick={() => setActiveListingType('For Sale')}>For Sale</Badge>
                            <Badge variant={activeListingType === 'For Rent' ? 'default' : 'outline'} className={cn("cursor-pointer px-4 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border-emerald-100", activeListingType === 'For Rent' && "ring-2 ring-primary ring-offset-2")} onClick={() => setActiveListingType('For Rent')}>For Rent</Badge>
                        </div>
                        <div className="flex items-center gap-2 pr-4 border-r border-border/50">
                            <Badge 
                                variant={activeStatus === 'All' ? 'default' : 'outline'} 
                                className={cn("cursor-pointer px-4 py-1.5 rounded-full", activeStatus === 'All' ? "bg-primary" : "hover:bg-accent")} 
                                onClick={() => setActiveStatus('All')}
                            >
                                All Status
                            </Badge>
                            {buyerStatuses.map(status => (
                                <Badge 
                                    key={status} 
                                    variant={activeStatus === status ? 'default' : 'outline'} 
                                    className={cn(
                                        "cursor-pointer px-4 py-1.5 rounded-full transition-all", 
                                        statusVariant[status as keyof typeof statusVariant],
                                        activeStatus === status && "ring-2 ring-primary ring-offset-2"
                                    )} 
                                    onClick={() => setActiveStatus(status)}
                                >
                                    {status}
                                </Badge>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            {agencyTags?.map(tag => (
                                <Badge key={tag.id} variant={activeCustomTags.includes(tag.name) ? 'default' : 'outline'} className={cn("cursor-pointer px-4 py-1.5 rounded-full transition-all", tag.color, activeCustomTags.includes(tag.name) && "ring-2 ring-primary ring-offset-2")} onClick={() => handleToggleCustomTag(tag.name)}>{tag.name}</Badge>
                            ))}
                            <Button variant="ghost" size="sm" className="rounded-full h-8 px-4 text-xs font-bold gap-2 text-primary hover:bg-primary/10" onClick={() => setIsManageTagsOpen(true)}><PlusCircle className="h-4 w-4" />Manage Tags</Button>
                        </div>
                    </div>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </Card>

            <div className="mt-4">{isMobile ? renderCards(paginatedBuyers) : <Card className="p-0 overflow-hidden">{renderTable(paginatedBuyers)}</Card>}</div>
            
            {totalPages > 1 && (
                <div className="flex justify-end items-center gap-2 py-4">
                    <span className="text-xs text-muted-foreground">Page {currentPage} of {totalPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /></Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight className="h-4 w-4" /></Button>
                </div>
            )}

            <AddBuyerDialog isOpen={isAddBuyerOpen} setIsOpen={setIsAddBuyerOpen} totalSaleBuyers={allBuyers?.filter(b => !b.is_deleted && (b.listing_type || 'For Sale') === 'For Sale').length || 0} totalRentBuyers={allBuyers?.filter(b => !b.is_deleted && b.listing_type === 'For Rent').length || 0} buyerToEdit={buyerToEdit} onSave={handleSaveBuyer} limitReached={false} />
            {selectedBuyerForDetails && <BuyerDetailsDialog buyer={selectedBuyerForDetails} isOpen={isDetailsOpen} setIsOpen={setIsDetailsOpen} />}
            <ManageTagsDialog isOpen={isManageTagsOpen} setIsOpen={setIsManageTagsOpen} />
        </div>
    );
}

export default function BuyersPage() {
    return (
        <Suspense fallback={<div className="flex h-screen w-full items-center justify-center">Loading buyers...</div>}>
            <BuyersPageContent />
        </Suspense>
    );
}
