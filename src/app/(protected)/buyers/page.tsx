
'use client';

import { AddBuyerDialog } from '@/components/add-buyer-dialog';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { buyerStatuses } from '@/lib/data';
import { Badge } from '@/components/ui/badge';
import { Edit, MoreHorizontal, PlusCircle, Trash2, Phone, Home, Filter, Wallet, Ruler, Eye, CalendarPlus, Check, X, MessageSquare, ChevronLeft, ChevronRight, ArrowUpDown, Tag as TagIcon } from 'lucide-react';
import { useState, useMemo, useEffect, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { Buyer, BuyerStatus, PriceUnit, SizeUnit, PropertyType, AppointmentContactType, Appointment, FollowUp, User, Activity, ListingType, Tag } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useSearch, useUI } from '../layout';
import { BuyerDetailsDialog } from '@/components/buyer-details-dialog';
import { SetAppointmentDialog } from '@/components/set-appointment-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatUnit, formatPhoneNumberForWhatsApp } from '@/lib/formatters';
import { useCurrency } from '@/context/currency-context';
import { useProfile } from '@/context/profile-context';
import { useFirestore } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, addDoc, setDoc, doc, updateDoc, writeBatch, query, where, or } from 'firebase/firestore';
import { useMemoFirebase } from '@/firebase/hooks';
import { AddFollowUpDialog } from '@/components/add-follow-up-dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { cn, formatPhoneNumber } from '@/lib/utils';
import React from 'react';
import { useUser } from '@/firebase/auth/use-user';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ManageTagsDialog } from '@/components/manage-tags-dialog';

const ITEMS_PER_PAGE = 50;

const statusVariant = {
    'New': 'bg-blue-100 text-blue-700',
    'Interested': 'bg-emerald-100 text-emerald-700',
    'Not Interested': 'bg-red-100 text-red-700',
    'Follow Up': 'bg-purple-100 text-purple-700',
    'Visited Property': 'bg-orange-100 text-orange-700',
    'Deal Closed': 'bg-slate-800 text-white',
    'Deal Lost': 'bg-gray-400 text-white',
    'Pending': 'bg-amber-100 text-amber-700'
} as const;

function formatSize(minAmount?: number, minUnit?: SizeUnit, maxAmount?: number, maxUnit?: SizeUnit) {
    if (!minAmount || !minUnit) return 'N/A';
    if (!maxAmount || !maxUnit || (minAmount === maxAmount && minUnit === maxUnit)) return `${minAmount} ${minUnit}`;
    return `${minAmount} - ${maxAmount} ${minUnit}`;
}

interface Filters {
    propertyType: PropertyType | 'All';
    minBudget: string;
    maxBudget: string;
    budgetUnit: PriceUnit | 'All';
    minSize: string;
    maxSize: string;
    sizeUnit: SizeUnit | 'All';
}

function BuyersPageContent() {
    const isMobile = useIsMobile();
    const router = useRouter();
    const pathname = usePathname();
    const { user } = useUser();
    const { profile } = useProfile();
    const searchParams = useSearchParams();
    const { searchQuery } = useSearch();
    const { toast } = useToast();
    const { currency } = useCurrency();
    
    const typeFilterFromURL = searchParams.get('type') as ListingType | null;

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

    const tagsQuery = useMemoFirebase(() => 
        profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'tags') : null,
        [profile.agency_id, firestore]
    );
    const { data: agencyTags } = useCollection<Tag>(tagsQuery);

    const [activeListingType, setActiveListingType] = useState<ListingType | 'All'>(typeFilterFromURL || 'For Sale');
    const [activeStatus, setActiveStatus] = useState<string>('All');
    const [activeCustomTags, setActiveCustomTags] = useState<string[]>([]);

    const [isAddBuyerOpen, setIsAddBuyerOpen] = useState(false);
    const [isManageTagsOpen, setIsManageTagsOpen] = useState(false);
    const [buyerToEdit, setBuyerToEdit] = useState<Buyer | null>(null);
    const [selectedBuyers, setSelectedBuyers] = useState<string[]>([]);
    const [buyerForFollowUp, setBuyerForFollowUp] = useState<Buyer | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [selectedBuyerForDetails, setSelectedBuyerForDetails] = useState<Buyer | null>(null);
    const [isAppointmentOpen, setIsAppointmentOpen] = useState(false);
    const [isFollowUpOpen, setIsFollowUpOpen] = useState(false);
    const [appointmentDetails, setAppointmentDetails] = useState<{ contactType: AppointmentContactType; contactName: string; contactSerialNo?: string; message: string; } | null>(null);
    const [filters, setFilters] = useState<Filters>({ propertyType: 'All', minBudget: '', maxBudget: '', budgetUnit: 'All', minSize: '', maxSize: '', sizeUnit: 'All' });
    const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

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

        return buyers.sort((a, b) => {
            const aNum = parseInt(a.serial_no.split('-')[1] || '0', 10);
            const bNum = parseInt(b.serial_no.split('-')[1] || '0', 10);
            return sortOrder === 'asc' ? aNum - bNum : bNum - aNum;
        });
    }, [allBuyers, activeListingType, activeStatus, activeCustomTags, searchQuery, sortOrder]);

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
                        <TableHead>Requirements</TableHead>
                        <TableHead>Budget & Size</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {buyers.map(buyer => (
                        <TableRow key={buyer.id} className="cursor-pointer hover:bg-accent/50" onClick={() => handleDetailsClick(buyer)}>
                            <TableCell onClick={e => e.stopPropagation()}><Checkbox checked={selectedBuyers.includes(buyer.id)} onCheckedChange={(c) => setSelectedBuyers(p => c ? [...p, buyer.id] : p.filter(id => id !== buyer.id))} /></TableCell>
                            <TableCell>
                                <div className="font-bold text-base font-headline">{buyer.name}</div>
                                <div className="flex gap-1 mt-1">
                                    <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">{buyer.serial_no}</Badge>
                                    <span className="text-[10px] text-muted-foreground">{buyer.phone}</span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="text-sm font-medium">{buyer.area_preference || 'N/A'}</div>
                                <div className="text-xs text-muted-foreground">{buyer.property_type_preference}</div>
                            </TableCell>
                            <TableCell>
                                <div className="text-sm font-bold text-primary">{formatCurrency(formatUnit(buyer.budget_min_amount || 0, buyer.budget_min_unit || 'Lacs'), currency)}</div>
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
                    ))}
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
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold font-headline tracking-tight">Buyers</h1>
                <Button className="rounded-full glowing-btn" onClick={() => { setBuyerToEdit(null); setIsAddBuyerOpen(true); }}><PlusCircle className="mr-2 h-4 w-4" /> Add Buyer</Button>
            </div>

            {/* Smart Horizontal Filter Bar */}
            <Card className="border-none shadow-none bg-transparent">
                <ScrollArea className="w-full whitespace-nowrap pb-4">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 pr-4 border-r border-border/50">
                            <Badge variant={activeListingType === 'All' ? 'default' : 'outline'} className={cn("cursor-pointer px-4 py-1.5 rounded-full", activeListingType === 'All' ? "bg-primary" : "hover:bg-accent")} onClick={() => setActiveListingType('All')}>All Types</Badge>
                            <Badge variant={activeListingType === 'For Sale' ? 'default' : 'outline'} className={cn("cursor-pointer px-4 py-1.5 rounded-full bg-blue-50 text-blue-700 border-blue-100", activeListingType === 'For Sale' && "ring-2 ring-primary ring-offset-2")} onClick={() => setActiveListingType('For Sale')}>For Sale</Badge>
                            <Badge variant={activeListingType === 'For Rent' ? 'default' : 'outline'} className={cn("cursor-pointer px-4 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border-emerald-100", activeListingType === 'For Rent' && "ring-2 ring-primary ring-offset-2")} onClick={() => setActiveListingType('For Rent')}>For Rent</Badge>
                        </div>
                        <div className="flex items-center gap-2 pr-4 border-r border-border/50">
                            <Badge variant={activeStatus === 'All' ? 'default' : 'outline'} className={cn("cursor-pointer px-4 py-1.5 rounded-full", activeStatus === 'All' ? "bg-primary" : "hover:bg-accent")} onClick={() => setActiveStatus('All')}>All Status</Badge>
                            {buyerStatuses.map(status => (
                                <Badge key={status} variant={activeStatus === status ? 'default' : 'outline'} className={cn("cursor-pointer px-4 py-1.5 rounded-full", activeStatus === status && "ring-2 ring-primary ring-offset-2")} onClick={() => setActiveStatus(status)}>{status}</Badge>
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
