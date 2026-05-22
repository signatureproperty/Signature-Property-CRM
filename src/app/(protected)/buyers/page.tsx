'use client';

import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { buyerStatuses } from '@/lib/data';
import { Badge } from '@/components/ui/badge';
import { Edit, MoreHorizontal, PlusCircle, Trash2, Wallet, Ruler, Eye, MessageSquare, ChevronLeft, ChevronRight, ArrowUpDown, Tag as TagIcon, MapPin, ChevronDown, UserPlus, UserMinus, CalendarPlus, Sparkles, MessageSquareText, Filter, User as UserIcon, Users, X } from 'lucide-react';
import { useState, useMemo, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { Buyer, PriceUnit, SizeUnit, PropertyType, Activity, ListingType, Tag, Appointment, Property } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter } from 'next/navigation';
import { useSearch } from '@/context/layout-context';
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
import { motion, AnimatePresence } from 'framer-motion';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import dynamic from 'next/dynamic';

// --- Lazy Loaded Components ---
const AddBuyerDialog = dynamic(() => import('@/components/add-buyer-dialog').then(mod => mod.AddBuyerDialog), { ssr: false });
const ManageTagsDialog = dynamic(() => import('@/components/manage-tags-dialog').then(mod => mod.ManageTagsDialog), { ssr: false });
const BuyerDetailsDialog = dynamic(() => import('@/components/buyer-details-dialog').then(mod => mod.BuyerDetailsDialog), { ssr: false });
const BuyerNotesDialog = dynamic(() => import('@/components/buyer-notes-dialog').then(mod => mod.BuyerNotesDialog), { ssr: false });
const EditBuyerTagsDialog = dynamic(() => import('@/components/edit-buyer-tags-dialog').then(mod => mod.EditBuyerTagsDialog), { ssr: false });
const SetAppointmentDialog = dynamic(() => import('@/components/set-appointment-dialog').then(mod => mod.SetAppointmentDialog), { ssr: false });
const PropertyRecommenderDialog = dynamic(() => import('@/components/property-recommender-dialog').then(mod => mod.PropertyRecommenderDialog), { ssr: false });
const AssignBuyerToAgentDialog = dynamic(() => import('@/components/assign-buyer-to-agent-dialog').then(mod => mod.AssignBuyerToAgentDialog), { ssr: false });
const SimpleAssignAgentDialog = dynamic(() => import('@/components/simple-assign-agent-dialog').then(mod => mod.SimpleAssignAgentDialog), { ssr: false });

const ITEMS_PER_PAGE = 50;

const statusVariant = {
    'New': 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
    'Interested': 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
    'Not Interested': 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
    'Follow Up': 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
    'Visited Property': 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
    'Deal Closed': 'bg-slate-800 text-white border-slate-700 dark:bg-slate-700 dark:border-slate-600',
    'Deal Lost': 'bg-gray-400 text-white border-gray-300 dark:bg-gray-600 dark:border-gray-500'
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
    const { data: teamMembers } = useCollection<any>(teamMembersQuery);

    const propertiesQuery = useMemoFirebase(() => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'properties') : null, [profile.agency_id, firestore]);
    const { data: properties } = useCollection<Property>(propertiesQuery);

    const tagsQuery = useMemoFirebase(() => 
        profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'tags') : null,
        [profile.agency_id, firestore]
    );
    const { data: agencyTags } = useCollection<Tag>(tagsQuery);

    const [activeListingType, setActiveListingType] = useState<ListingType | 'All'>('All');
    const [activeStatus, setActiveStatus] = useState<string>('All');
    const [activeCustomTags, setActiveCustomTags] = useState<string[]>([]);
    const [activeAgentFilter, setActiveAgentFilter] = useState<string>('All');

    const [isAddBuyerOpen, setIsAddBuyerOpen] = useState(false);
    const [isManageTagsOpen, setIsManageTagsOpen] = useState(false);
    const [isEditTagsOpen, setIsEditTagsOpen] = useState(false);
    const [isAppointmentOpen, setIsAppointmentOpen] = useState(false);
    const [isRecommenderOpen, setIsRecommenderOpen] = useState(false);
    const [isNotesOpen, setIsNotesOpen] = useState(false);
    const [isAssignOpen, setIsAssignOpen] = useState(false);
    const [isSimpleAssignOpen, setIsSimpleAssignOpen] = useState(false);

    const [buyerToEdit, setBuyerToEdit] = useState<Buyer | null>(null);
    const [selectedBuyers, setSelectedBuyers] = useState<string[]>([]);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [selectedBuyerForDetails, setSelectedBuyerForDetails] = useState<Buyer | null>(null);
    const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    const [isTypesExpanded, setIsTypesExpanded] = useState(false);
    const [isStatusExpanded, setIsStatusExpanded] = useState(false);
    const [isTagsExpanded, setIsTagsExpanded] = useState(false);

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

    const activeAgents = useMemo(() => {
        return teamMembers?.filter((m: any) => m.status === 'Active' && (m.role === 'Agent' || m.role === 'Admin')) || [];
    }, [teamMembers]);

    const buyerCounts = useMemo(() => {
        if (!allBuyers) return {};
        const activeBuyers = allBuyers.filter(b => !b.is_deleted);
        const counts: Record<string, number> = {
            'For Sale': activeBuyers.filter(b => (b.listing_type || 'For Sale') === 'For Sale').length,
            'For Rent': activeBuyers.filter(b => b.listing_type === 'For Rent').length,
            'All': activeBuyers.length
        };

        buyerStatuses.forEach(status => {
            counts[status] = activeBuyers.filter(b => b.status === status).length;
        });

        agencyTags?.forEach(tag => {
            counts[tag.name] = activeBuyers.filter(b => b.tags?.includes(tag.name)).length;
        });

        return counts;
    }, [allBuyers, agencyTags]);

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

    const handleNotesClick = (buyer: Buyer) => {
        setSelectedBuyerForDetails(buyer);
        setIsNotesOpen(true);
    };

    const handleAssignOpen = (buyer: Buyer) => {
        setSelectedBuyerForDetails(buyer);
        setIsAssignOpen(true);
    };

    const handleSimpleAssignOpen = (buyer: Buyer) => {
        setSelectedBuyerForDetails(buyer);
        setIsSimpleAssignOpen(true);
    };

    const handleUnassignAgent = async (buyer: Buyer) => {
        if (!profile.agency_id) return;
        try {
            const buyerRef = doc(firestore, 'agencies', profile.agency_id, 'buyers', buyer.id);
            await updateDoc(buyerRef, { assignedTo: null });
            
            await logActivity('unassigned agent from lead', buyer.name, 'Buyer');
            toast({ title: "Agent Unassigned", description: `Lead ${buyer.name} is now back in the pool.` });
        } catch (error) {
            toast({ title: "Action Failed", variant: 'destructive' });
        }
    };

    const handleManageTagsAction = (buyer: Buyer) => {
        setSelectedBuyerForDetails(buyer);
        setIsEditTagsOpen(true);
    };

    const handleSetAppointment = (buyer: Buyer) => {
        setSelectedBuyerForDetails(buyer);
        setIsAppointmentOpen(true);
    };

    const handleRecommendProperties = (buyer: Buyer) => {
        setSelectedBuyerForDetails(buyer);
        setIsRecommenderOpen(true);
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

    const handleSaveAppointment = async (appointment: Appointment) => {
        if (!profile.agency_id) return;
        try {
            const { id, ...newAppointmentData } = appointment;
            const collectionRef = collection(firestore, 'agencies', profile.agency_id, 'appointments');
            await addDoc(collectionRef, newAppointmentData);
            toast({ title: 'Appointment Set', description: `Appointment with ${appointment.contactName} has been scheduled.` });
        } catch (error) {
            toast({ title: "Error", description: "Could not set appointment.", variant: 'destructive' });
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
        
        const agent = activeAgents.find((a: any) => a.id === agentDocId);
        if(!agent) return;

        const actualAgentUid = agent.user_id || agent.id;
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

    const handleBulkUnassign = async () => {
        if (selectedBuyers.length === 0 || !profile.agency_id) return;
        const batch = writeBatch(firestore);
        const buyerNames: string[] = [];
        
        selectedBuyers.forEach(buyerId => {
            const buyer = allBuyers?.find(b => b.id === buyerId);
            if(buyer) buyerNames.push(buyer.name);
            const docRef = doc(firestore, 'agencies', profile.agency_id, 'buyers', buyerId);
            batch.update(docRef, { assignedTo: null });
        });

        const activityLogRef = doc(collection(firestore, 'agencies', profile.agency_id, 'activityLogs'));
        batch.set(activityLogRef, {
            userName: profile.name,
            action: `unassigned ${buyerNames.length} leads from all agents`,
            target: buyerNames.join(', '),
            targetType: 'Buyer',
            timestamp: new Date().toISOString(),
            agency_id: profile.agency_id,
        });

        await batch.commit();
        toast({ title: 'Leads Unassigned Successfully' });
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

    const handleWhatsAppChat = (e: any, buyer: Buyer) => {
        if (e && e.stopPropagation) e.stopPropagation();
        const phoneNumber = formatPhoneNumberForWhatsApp(buyer.phone, buyer.country_code);
        window.open(`https://wa.me/${phoneNumber}`, '_blank');
    };

    const formatBuyerBudgetInline = (buyer: Buyer) => {
        if (!buyer.budget_min_amount || !buyer.budget_min_unit) return 'N/A';
        const minVal = formatUnit(buyer.budget_min_amount, buyer.budget_min_unit);
        if (!buyer.budget_max_amount || !buyer.budget_max_unit || (buyer.budget_min_amount === buyer.budget_max_amount && buyer.budget_min_unit === buyer.budget_max_unit)) {
            return formatCurrency(minVal, currency);
        }
        const maxVal = formatUnit(buyer.budget_max_amount, buyer.budget_max_unit);
        return `${formatCurrency(minVal, currency)} - ${formatCurrency(maxVal, currency)}`;
    }

    const getTagColor = (tagName: string) => {
        const tagObj = agencyTags?.find(t => t.name === tagName);
        if (tagObj) return tagObj.color;
        return (statusVariant as any)[tagName] || 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
    };

    const filteredBuyers = useMemo(() => {
        if (!allBuyers) return [];
        let buyers = allBuyers.filter(b => !b.is_deleted);
        
        if (activeListingType !== 'All') {
            buyers = buyers.filter(b => (b.listing_type || 'For Sale') === activeListingType);
        }
        if (activeStatus !== 'All') {
            buyers = buyers.filter(b => b.status === activeStatus || b.tags?.includes(activeStatus));
        }
        if (activeCustomTags.length > 0) {
            buyers = buyers.filter(b => activeCustomTags.every(tag => b.tags?.includes(tag)));
        }

        if (activeAgentFilter !== 'All') {
            buyers = buyers.filter(b => b.assignedTo === activeAgentFilter);
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
            const dateA = a.last_remark_at ? new Date(a.last_remark_at).getTime() : 0;
            const dateB = b.last_remark_at ? new Date(b.last_remark_at).getTime() : 0;
            
            if (dateA !== dateB) {
                return dateB - dateA; // Recent remarks first
            }

            const aNum = parseInt(a.serial_no.split('-')[1] || '0', 10);
            const bNum = parseInt(b.serial_no.split('-')[1] || '0', 10);
            return sortOrder === 'asc' ? aNum - bNum : bNum - aNum;
        });
    }, [allBuyers, activeListingType, activeStatus, activeCustomTags, activeAgentFilter, searchQuery, sortOrder, filters]);

    const anySelectedIsAssigned = useMemo(() => {
        return selectedBuyers.some(id => {
            const buyer = allBuyers?.find(b => b.id === id);
            return !!buyer?.assignedTo;
        });
    }, [selectedBuyers, allBuyers]);

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
                        <TableHead>Budget (Max)</TableHead>
                        <TableHead>Handled By</TableHead>
                        <TableHead>Status / Tags</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {buyers.map(buyer => {
                        const areas = buyer.area_preference?.split(',').map(a => a.trim()).filter(Boolean) || [];
                        const displayedAreas = areas.length > 2 
                            ? areas.slice(0, 2).join(', ') + '...' 
                            : areas.join(', ') || 'N/A';
                        
                        // Show pulse if there are unread notes
                        const hasUnreadNotes = buyer.timeline_notes?.some(n => !n.readBy?.includes(profile.user_id));
                            
                        return (
                            <TableRow key={buyer.id} className="cursor-pointer hover:bg-accent/50" onClick={() => handleDetailsClick(buyer)}>
                                <TableCell onClick={e => e.stopPropagation()}><Checkbox checked={selectedBuyers.includes(buyer.id)} onCheckedChange={(c) => setSelectedBuyers(p => c ? [...p, buyer.id] : p.filter(id => id !== buyer.id))} /></TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <div className="font-bold text-base font-headline">{buyer.name}</div>
                                        {hasUnreadNotes && (
                                            <span className="relative flex h-2 w-2">
                                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex gap-1 mt-1">
                                        <Badge variant="outline" className={cn("text-[10px] border-primary/20", (buyer.serial_no || '').startsWith('RB') ? "bg-emerald-100 text-emerald-700" : "bg-primary/10 text-primary")}>{buyer.serial_no}</Badge>
                                        <span className="text-[10px] text-muted-foreground">{buyer.phone}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <div className="text-sm font-medium cursor-pointer hover:text-primary transition-colors" onClick={e => e.stopPropagation()}>{displayedAreas}</div>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-80 p-4 rounded-xl shadow-2xl border-none z-[100]" onClick={e => e.stopPropagation()}>
                                            <div className="space-y-2">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-primary/60 flex items-center gap-2">
                                                    <MapPin className="h-3 w-3" /> Area Preference
                                                </p>
                                                <p className="text-sm font-bold leading-relaxed text-foreground">{buyer.area_preference || 'N/A'}</p>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                    <div className="text-xs text-muted-foreground">{buyer.property_type_preference}</div>
                                </TableCell>
                                <TableCell>
                                    <div className="text-sm font-bold text-primary">
                                        {buyer.budget_max_amount ? formatCurrency(formatUnit(buyer.budget_max_amount, buyer.budget_max_unit || 'Lacs'), currency) : formatBuyerBudgetInline(buyer)}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {buyer.assignedTo ? (
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-primary">{teamMembers?.find(m => (m.user_id || m.id) === buyer.assignedTo)?.name || 'Unknown Agent'}</span>
                                            <span className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter">Active Lead</span>
                                        </div>
                                    ) : (
                                        <Badge variant="outline" className="text-[9px] uppercase font-black border-dashed opacity-40 px-2 py-0">Unassigned</Badge>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-1 items-center">
                                        <Badge className={cn("text-[10px] font-bold", getTagColor(buyer.status))}>{buyer.status}</Badge>
                                        {buyer.tags?.filter(t => t !== buyer.status).map(tagName => (
                                            <Badge key={tagName} className={cn("text-[10px] font-bold", getTagColor(tagName))}>{tagName}</Badge>
                                        ))}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal /></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="bg-background w-52">
                                            <DropdownMenuItem onSelect={() => handleDetailsClick(buyer) as any}><Eye className="mr-2 h-4 w-4" /> View Details</DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => handleNotesClick(buyer) as any}><MessageSquareText className="mr-2 h-4 w-4" /> Remarks Update</DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => handleRecommendProperties(buyer) as any}><Sparkles className="mr-2 h-4 w-4" /> Recommended Properties</DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => handleManageTagsAction(buyer) as any}><TagIcon className="mr-2 h-4 w-4" /> Edit Tags</DropdownMenuItem>
                                            <DropdownMenuItem onSelect={(e: any) => handleWhatsAppChat(e, buyer) as any}><MessageSquare className="mr-2 h-4 w-4" /> WhatsApp Chat</DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => handleSetAppointment(buyer) as any}><CalendarPlus className="mr-2 h-4 w-4" /> Set Appointment</DropdownMenuItem>
                                            
                                            {profile.role === 'Admin' && (
                                                <>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem onSelect={() => handleSimpleAssignOpen(buyer)} className="font-bold text-primary">
                                                        <UserPlus className="mr-2 h-4 w-4" /> Direct Assign Agent
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onSelect={() => handleAssignOpen(buyer)}>
                                                        <Sparkles className="mr-2 h-4 w-4" /> Smart Assign (Inventory)
                                                    </DropdownMenuItem>
                                                    {buyer.assignedTo && (
                                                        <DropdownMenuItem onSelect={() => handleUnassignAgent(buyer)} className="text-destructive font-bold">
                                                            <UserMinus className="mr-2 h-4 w-4" /> Unassign Agent
                                                        </DropdownMenuItem>
                                                    )}
                                                </>
                                            )}
                                            {profile.role === 'Admin' && (
                                                <DropdownMenuItem onSelect={() => handleEdit(buyer) as any}><Edit className="mr-2 h-4 w-4" /> Edit Details</DropdownMenuItem>
                                            )}
                                            {profile.role === 'Admin' && (
                                                <DropdownMenuItem onSelect={() => handleDelete(buyer) as any} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete Buyer</DropdownMenuItem>
                                            )}
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
            {buyers.map(buyer => {
                const hasUnreadNotes = buyer.timeline_notes?.some(n => !n.readBy?.includes(profile.user_id));

                return (
                <Card key={buyer.id} className="overflow-hidden border-l-4 border-l-primary/40 bg-background">
                    <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between space-y-0">
                        <div className="flex gap-3">
                            <Checkbox 
                                checked={selectedBuyers.includes(buyer.id)} 
                                onClick={e => e.stopPropagation()} 
                                onCheckedChange={(c) => setSelectedBuyers(p => c ? [...p, buyer.id] : p.filter(id => id !== buyer.id))} 
                            />
                            <div onClick={() => handleDetailsClick(buyer)} className="cursor-pointer">
                                <div className="flex items-center gap-2">
                                    <CardTitle className="text-base font-bold font-headline">{buyer.name}</CardTitle>
                                    {hasUnreadNotes && (
                                        <span className="relative flex h-2 w-2">
                                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className="text-[10px] bg-background font-mono">{buyer.serial_no}</Badge>
                                    <span className="text-[10px] text-muted-foreground">{buyer.phone}</span>
                                </div>
                            </div>
                        </div>
                        <Badge className={cn("text-[9px] font-bold px-2", getTagColor(buyer.status))}>
                            {buyer.status}
                        </Badge>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 cursor-pointer" onClick={() => handleDetailsClick(buyer)}>
                        <div className="grid grid-cols-2 gap-y-2 gap-x-4 mt-2">
                            <div className="flex items-center gap-1.5 text-xs">
                                <TagIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="font-medium">{buyer.property_type_preference}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs">
                                <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="font-medium">{formatSize(buyer.size_min_value, buyer.size_min_unit, buyer.size_max_value, buyer.size_max_unit)}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs col-span-2 mt-1">
                                <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="font-bold text-primary">Budget: {formatBuyerBudgetInline(buyer)}</span>
                            </div>
                        </div>
                        
                        <div className="mt-4 pt-3 border-t border-dashed flex items-center justify-between">
                             <div className="flex items-center gap-2">
                                <UserIcon className="h-3.5 w-3.5 text-primary/60" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-foreground">
                                    {buyer.assignedTo ? (teamMembers?.find(m => (m.user_id || m.id) === buyer.assignedTo)?.name || 'Assigned') : 'Agency Pool'}
                                </span>
                            </div>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground italic cursor-pointer hover:text-primary transition-colors" onClick={e => e.stopPropagation()}>
                                        <MapPin className="h-3 w-3" />
                                        <span className="truncate max-w-[100px]">{buyer.area_preference || 'No area'}</span>
                                    </div>
                                </PopoverTrigger>
                                <PopoverContent className="w-80 p-4 rounded-xl shadow-2xl border-none z-[110]" onClick={e => e.stopPropagation()}>
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-primary/60 flex items-center gap-2">
                                            <MapPin className="h-3 w-3" /> Area Preference
                                        </p>
                                        <p className="text-sm font-bold leading-relaxed text-foreground">{buyer.area_preference || 'N/A'}</p>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>
                        
                        <div className="flex flex-wrap gap-1 mt-3">
                             {buyer.tags?.filter(t => t !== buyer.status).map(tagName => (
                                <Badge key={tagName} className={cn("text-[8px] px-1.5 py-0 font-bold", getTagColor(tagName))}>{tagName}</Badge>
                            ))}
                        </div>
                    </CardContent>
                    <CardFooter className="p-2 bg-muted/20 border-t justify-between items-center">
                        <Button variant="ghost" size="sm" className="h-8 gap-2 text-[10px] font-bold" onClick={() => handleNotesClick(buyer)}>
                            <MessageSquareText className="h-3.5 w-3.5" />
                            Remarks
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full p-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-background w-52">
                                <DropdownMenuItem onSelect={() => handleDetailsClick(buyer) as any}><Eye className="mr-2 h-4 w-4" /> View Details</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => handleRecommendProperties(buyer) as any}><Sparkles className="mr-2 h-4 w-4" /> Recommended Properties</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => handleManageTagsAction(buyer) as any}><TagIcon className="mr-2 h-4 w-4" /> Edit Tags</DropdownMenuItem>
                                <DropdownMenuItem onSelect={(e: any) => handleWhatsAppChat(e as any, buyer) as any}><MessageSquare className="mr-2 h-4 w-4" /> WhatsApp Chat</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => handleSetAppointment(buyer) as any}><CalendarPlus className="mr-2 h-4 w-4" /> Set Appointment</DropdownMenuItem>
                                
                                {profile.role === 'Admin' && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onSelect={() => handleSimpleAssignOpen(buyer)} className="font-bold text-primary">
                                            <UserPlus className="mr-2 h-4 w-4" /> Direct Assign Agent
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => handleAssignOpen(buyer)}>
                                            <Sparkles className="mr-2 h-4 w-4" /> Smart Assign (Inventory)
                                        </DropdownMenuItem>
                                        {buyer.assignedTo && (
                                            <DropdownMenuItem onSelect={() => handleUnassignAgent(buyer)} className="text-destructive font-bold">
                                                <UserMinus className="mr-2 h-4 w-4" /> Unassign Agent
                                            </DropdownMenuItem>
                                        )}
                                    </>
                                )}
                                {profile.role === 'Admin' && (
                                    <DropdownMenuItem onSelect={() => handleEdit(buyer) as any}><Edit className="mr-2 h-4 w-4" /> Edit Details</DropdownMenuItem>
                                )}
                                {profile.role === 'Admin' && (
                                    <DropdownMenuItem onSelect={() => handleDelete(buyer) as any} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete Buyer</DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </CardFooter>
                </Card>
                );
            })}
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="hidden md:block">
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
                                <DropdownMenuContent className="bg-background">
                                {activeAgents.map((member: any) => (
                                    <DropdownMenuItem key={member.id} onSelect={() => handleBulkAssign(member.id) as any}>
                                    {member.name}
                                    </DropdownMenuItem>
                                ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                            {anySelectedIsAssigned && (
                                <Button variant="outline" className="rounded-full text-destructive border-destructive/20 hover:bg-destructive/5" onClick={handleBulkUnassign}>
                                    <UserMinus className="mr-2 h-4 w-4" /> Unassign ({selectedBuyers.length})
                                </Button>
                            )}
                            <Button variant="destructive" className="rounded-full" onClick={handleBulkDelete}>
                                <Trash2 className="mr-2 h-4 w-4" /> Delete ({selectedBuyers.length})
                            </Button>
                        </div>
                    )}
                    <AlertDialog open={isFilterPopoverOpen} onOpenChange={setIsFilterPopoverOpen}>
                        <AlertDialogTrigger asChild>
                            <Button variant="outline" className="rounded-full"><Filter className="mr-2 h-4 w-4" /> Filters {filters.area.length > 0 ? `(${filters.area.length})` : ''}</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="max-w-md bg-background">
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
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                        <ScrollArea className="flex-1 whitespace-nowrap pb-4">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 pr-4 border-r border-border/50">
                                    <Badge 
                                        variant={activeListingType === 'All' ? 'default' : 'outline'} 
                                        className={cn("cursor-pointer px-4 py-1.5 rounded-full flex items-center gap-1", activeListingType === 'All' ? "bg-primary" : "hover:bg-accent")} 
                                        onClick={() => {
                                            setActiveListingType('All');
                                            setIsTypesExpanded(!isTypesExpanded);
                                        }}
                                    >
                                        All Types ({buyerCounts['All'] || 0}) {isTypesExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                    </Badge>
                                    <AnimatePresence>
                                        {isTypesExpanded && (
                                            <motion.div 
                                                initial={{ opacity: 0, x: -10 }} 
                                                animate={{ opacity: 1, x: 0 }} 
                                                exit={{ opacity: 0, x: -10 }}
                                                transition={{ duration: 0.15 }}
                                                className="flex items-center gap-2"
                                            >
                                                <Badge variant={activeListingType === 'For Sale' ? 'default' : 'outline'} className={cn("cursor-pointer px-4 py-1.5 rounded-full bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800", activeListingType === 'For Sale' && "ring-2 ring-primary ring-offset-2")} onClick={() => setActiveListingType('For Sale')}>For Sale ({buyerCounts['For Sale'] || 0})</Badge>
                                                <Badge variant={activeListingType === 'For Rent' ? 'default' : 'outline'} className={cn("cursor-pointer px-4 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800", activeListingType === 'For Rent' && "ring-2 ring-primary ring-offset-2")} onClick={() => setActiveListingType('For Rent')}>For Rent ({buyerCounts['For Rent'] || 0})</Badge>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                                <div className="flex items-center gap-2 pr-4 border-r border-border/50">
                                    <Badge 
                                        variant={activeStatus === 'All' ? 'default' : 'outline'} 
                                        className={cn("cursor-pointer px-4 py-1.5 rounded-full flex items-center gap-1", activeStatus === 'All' ? "bg-primary" : "hover:bg-accent")} 
                                        onClick={() => {
                                            setActiveStatus('All');
                                            setIsStatusExpanded(!isStatusExpanded);
                                        }}
                                    >
                                        All Status {isStatusExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                    </Badge>
                                    <AnimatePresence>
                                        {isStatusExpanded && (
                                            <motion.div 
                                                initial={{ opacity: 0, x: -10 }} 
                                                animate={{ opacity: 1, x: 0 }} 
                                                exit={{ opacity: 0, x: -10 }}
                                                transition={{ duration: 0.15 }}
                                                className="flex items-center gap-2"
                                            >
                                                {buyerStatuses.map(status => (
                                                    <Badge 
                                                        key={status} 
                                                        variant={activeStatus === status ? 'default' : 'outline'} 
                                                        className={cn(
                                                            "cursor-pointer px-4 py-1.5 rounded-full transition-all", 
                                                            (statusVariant as any)[status],
                                                            activeStatus === status && "ring-2 ring-primary ring-offset-2"
                                                        )} 
                                                        onClick={() => setActiveStatus(status)}
                                                    >
                                                        {status} ({buyerCounts[status] || 0})
                                                    </Badge>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge 
                                        variant={activeCustomTags.length === 0 ? 'default' : 'outline'} 
                                        className={cn("cursor-pointer px-4 py-1.5 rounded-full flex items-center gap-1", activeCustomTags.length === 0 ? "bg-primary" : "hover:bg-accent")} 
                                        onClick={() => {
                                            setActiveCustomTags([]);
                                            setIsTagsExpanded(!isTagsExpanded);
                                        }}
                                    >
                                        All Tags {isTagsExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                    </Badge>
                                    <AnimatePresence>
                                        {isTagsExpanded && (
                                            <motion.div 
                                                initial={{ opacity: 0, x: -10 }} 
                                                animate={{ opacity: 1, x: 0 }} 
                                                exit={{ opacity: 0, x: -10 }}
                                                transition={{ duration: 0.15 }}
                                                className="flex items-center gap-2"
                                            >
                                                {agencyTags?.map(tag => (
                                                    <Badge key={tag.id} variant={activeCustomTags.includes(tag.name) ? 'default' : 'outline'} className={cn("cursor-pointer px-4 py-1.5 rounded-full transition-all", tag.color, activeCustomTags.includes(tag.name) && "ring-2 ring-primary ring-offset-2")} onClick={() => handleToggleCustomTag(tag.name)}>{tag.name} ({buyerCounts[tag.name] || 0})</Badge>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                            <ScrollBar orientation="horizontal" />
                        </ScrollArea>
                        <div className="pb-4">
                            <Button variant="ghost" size="sm" className="rounded-full h-8 px-4 text-xs font-bold gap-2 text-primary hover:bg-primary/10 shadow-sm border border-primary/20" onClick={() => setIsManageTagsOpen(true)}>
                                <PlusCircle className="h-4 w-4" />
                                <span className="hidden md:inline">Manage </span>Tags
                            </Button>
                        </div>
                    </div>

                    {/* --- Agent Selection Filter --- */}
                    <div className="flex items-center gap-3 pb-2">
                        <div className="flex items-center gap-2 bg-card/60 backdrop-blur-sm border border-primary/10 rounded-full px-4 py-1.5 shadow-sm">
                            <Users className="h-4 w-4 text-primary" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Assigned Agent:</span>
                            <Select value={activeAgentFilter} onValueChange={setActiveAgentFilter}>
                                <SelectTrigger className="h-7 border-none bg-transparent focus:ring-0 text-xs font-bold w-[180px] p-0 shadow-none">
                                    <SelectValue placeholder="All Agency Inventory" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl shadow-2xl border-none">
                                    <SelectItem value="All" className="font-bold">All Agency Leads</SelectItem>
                                    {activeAgents.map((agent: any) => (
                                        <SelectItem key={agent.id} value={agent.user_id || agent.id}>
                                            {agent.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {activeAgentFilter !== 'All' && (
                            <Button variant="ghost" size="sm" onClick={() => setActiveAgentFilter('All')} className="h-8 rounded-full text-[10px] font-black uppercase tracking-tighter hover:bg-destructive/10 hover:text-destructive">
                                <X className="h-3 w-3 mr-1" /> Clear Filter
                            </Button>
                        )}
                    </div>
                </div>
            </Card>

            <div className="mt-4">{isMobile ? renderCards(paginatedBuyers) : <Card className="p-0 overflow-hidden bg-background">{renderTable(paginatedBuyers)}</Card>}</div>
            
            {totalPages > 1 && (
                <div className="flex justify-end items-center gap-2 py-4">
                    <span className="text-xs text-muted-foreground">Page {currentPage} of {totalPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /></Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight className="h-4 w-4" /></Button>
                </div>
            )}

            {isAddBuyerOpen && (
                <AddBuyerDialog isOpen={isAddBuyerOpen} setIsOpen={setIsAddBuyerOpen} totalSaleBuyers={allBuyers?.filter(b => !b.is_deleted && (b.listing_type || 'For Sale') === 'For Sale').length || 0} totalRentBuyers={allBuyers?.filter(b => !b.is_deleted && b.listing_type === 'For Rent').length || 0} buyerToEdit={buyerToEdit} onSave={handleSaveBuyer} limitReached={false} />
            )}
            
            {isManageTagsOpen && (
                <ManageTagsDialog isOpen={isManageTagsOpen} setIsOpen={setIsManageTagsOpen} />
            )}
            
            {selectedBuyerForDetails && (
                <>
                    {isDetailsOpen && <BuyerDetailsDialog buyer={selectedBuyerForDetails} isOpen={isDetailsOpen} setIsOpen={setIsDetailsOpen} />}
                    {isNotesOpen && <BuyerNotesDialog buyer={selectedBuyerForDetails} isOpen={isNotesOpen} setIsOpen={setIsNotesOpen} />}
                    {isEditTagsOpen && <EditBuyerTagsDialog buyer={selectedBuyerForDetails} isOpen={isEditTagsOpen} setIsOpen={setIsEditTagsOpen} />}
                    {isAssignOpen && <AssignBuyerToAgentDialog buyer={selectedBuyerForDetails} isOpen={isAssignOpen} setIsOpen={setIsAssignOpen} />}
                    {isSimpleAssignOpen && <SimpleAssignAgentDialog buyer={selectedBuyerForDetails} isOpen={isSimpleAssignOpen} setIsOpen={setIsSimpleAssignOpen} teamMembers={teamMembers || []} />}
                    {isAppointmentOpen && (
                        <SetAppointmentDialog 
                            isOpen={isAppointmentOpen}
                            setIsOpen={setIsAppointmentOpen}
                            onSave={handleSaveAppointment}
                            appointmentDetails={{
                                contactType: 'Buyer',
                                contactName: selectedBuyerForDetails.name,
                                contactSerialNo: selectedBuyerForDetails.serial_no,
                                message: `Appointment with buyer ${selectedBuyerForDetails.name} for property viewing.`
                            }}
                        />
                    )}
                    {isRecommenderOpen && (
                        <PropertyRecommenderDialog 
                            buyer={selectedBuyerForDetails}
                            properties={properties || []}
                            isOpen={isRecommenderOpen}
                            setIsOpen={setIsRecommenderOpen}
                        />
                    )}
                </>
            )}
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
