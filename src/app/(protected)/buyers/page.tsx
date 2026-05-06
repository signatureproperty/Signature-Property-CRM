
'use client';
import { AddBuyerDialog } from '@/components/add-buyer-dialog';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuPortal, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { buyerStatuses } from '@/lib/data';
import { Badge } from '@/components/ui/badge';
import { Edit, MoreHorizontal, PlusCircle, Trash2, Phone, Home, Search, Filter, Wallet, Bookmark, Upload, Download, Ruler, Eye, CalendarPlus, UserCheck, Briefcase, Check, X, UserPlus, UserX, ChevronDown, MessageSquare, Sparkles, ChevronLeft, ChevronRight, DollarSign, ArrowUpDown } from 'lucide-react';
import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { Buyer, BuyerStatus, PriceUnit, SizeUnit, PropertyType, AppointmentContactType, Appointment, FollowUp, User, Activity, ListingType, PlanName, Property } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
import { collection, addDoc, setDoc, doc, deleteDoc, serverTimestamp, updateDoc, writeBatch, query, where, or } from 'firebase/firestore';
import { useMemoFirebase } from '@/firebase/hooks';
import { AddFollowUpDialog } from '@/components/add-follow-up-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { cn, formatPhoneNumber } from '@/lib/utils';
import React from 'react';
import { useUser } from '@/firebase/auth/use-user';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { PropertyRecommenderDialog } from '@/components/property-recommender-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';

const ITEMS_PER_PAGE = 50;

const planLimits = {
    Basic: { properties: 500, buyers: 500, team: 3 },
    Standard: { properties: 2500, buyers: 2500, team: 10 },
    Premium: { properties: Infinity, buyers: Infinity, team: Infinity },
};


const statusVariant = {
    'New': 'default',
    'Interested': 'default',
    'Not Interested': 'destructive',
    'Follow Up': 'default',
    'Visited Property': 'secondary',
    'Deal Closed': 'default',
    'Deal Lost': 'destructive',
    'Pending': 'default'
} as const;

function formatSize(minAmount?: number, minUnit?: SizeUnit, maxAmount?: number, maxUnit?: SizeUnit) {
    if (!minAmount || !minUnit) return 'N/A';
    if (!maxAmount || !maxUnit || (minAmount === maxAmount && minUnit === maxUnit)) return `${minAmount} ${minUnit}`;
    return `${minAmount} - ${maxAmount} ${minUnit}`;
}

interface Filters {
    status: BuyerStatus | 'All';
    area: string;
    minBudget: string;
    maxBudget: string;
    budgetUnit: PriceUnit | 'All';
    propertyType: PropertyType | 'All';
    minSize: string;
    maxSize: string;
    sizeUnit: SizeUnit | 'All';
    serialNoPrefix: 'All' | 'B' | 'RB';
    serialNo: string;
}

function BuyersPageContent() {
    const isMobile = useIsMobile();
    const router = useRouter();
    const pathname = usePathname();
    const { user } = useUser();
    const { profile } = useProfile();
    const searchParams = useSearchParams();
    const { searchQuery } = useSearch();
    const { isMoreMenuOpen } = useUI();
    const { toast } = useToast();
    const { currency } = useCurrency();
    const statusFilterFromURL = searchParams.get('status') as BuyerStatus | 'All' | null;
    const listingTypeFilterFromURL = searchParams.get('type') as ListingType | null;

    const firestore = useFirestore();
    const importInputRef = useRef<HTMLInputElement>(null);
    
    // Fetch all buyers for the agency
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

    const agentLeads = useMemo(() => {
        if (profile.role !== 'Agent' || !user?.uid || !allBuyers) {
            return [];
        }
        return allBuyers.filter(buyer => buyer.created_by === user.uid || buyer.assignedTo === user.uid);
    }, [profile.role, user?.uid, allBuyers]);

    const buyersToDisplay = useMemo(() => {
        if (profile.role === 'Admin') {
            return allBuyers;
        }
        if (profile.role === 'Agent') {
            return agentLeads;
        }
        return [];
    }, [profile.role, allBuyers, agentLeads]);
    
    
    const teamMembersQuery = useMemoFirebase(() => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'teamMembers') : null, [profile.agency_id, firestore]);
    const { data: teamMembers } = useCollection<User>(teamMembersQuery);

    const followUpsQuery = useMemoFirebase(() => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'followUps') : null, [profile.agency_id, firestore]);
    const { data: followUps, isLoading: isFollowUpsLoading } = useCollection<FollowUp>(followUpsQuery);

    const agencyPropertiesQuery = useMemoFirebase(() => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'properties') : null, [profile.agency_id, firestore]);
    const { data: allProperties } = useCollection<Property>(agencyPropertiesQuery);
    
    const activeTab = listingTypeFilterFromURL || 'For Sale';

    const assignableAgents = useMemo(() => {
        return teamMembers?.filter(m => m.status === 'Active' && (m.role === 'Admin' || m.role === 'Agent')) || [];
    }, [teamMembers]);
    
    const { totalSaleBuyers, totalRentBuyers } = useMemo(() => {
        if (!allBuyers) return { totalSaleBuyers: 0, totalRentBuyers: 0 };
        return {
            totalSaleBuyers: allBuyers.filter(b => !b.is_deleted && (!b.listing_type || b.listing_type === 'For Sale')).length,
            totalRentBuyers: allBuyers.filter(b => !b.is_deleted && b.listing_type === 'For Rent').length
        };
    }, [allBuyers]);

    const [isAddBuyerOpen, setIsAddBuyerOpen] = useState(false);
    const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
    const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [importType, setImportType] = useState<'For Sale' | 'For Rent' | null>(null);
    const [buyerToEdit, setBuyerToEdit] = useState<Buyer | null>(null);
    const [selectedBuyers, setSelectedBuyers] = useState<string[]>([]);
    const [buyerForFollowUp, setBuyerForFollowUp] = useState<Buyer | null>(null);
    const [buyerForRecommendation, setBuyerForRecommendation] = useState<Buyer | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [isAppointmentOpen, setIsAppointmentOpen] = useState(false);
    const [isFollowUpOpen, setIsFollowUpOpen] = useState(false);
    const [isRecommenderOpen, setIsRecommenderOpen] = useState(false);
    const [appointmentDetails, setAppointmentDetails] = useState<{ contactType: AppointmentContactType; contactName: string; contactSerialNo?: string; message: string; } | null>(null);
    const [filters, setFilters] = useState<Filters>({ status: 'All', area: '', minBudget: '', maxBudget: '', budgetUnit: 'All', propertyType: 'All', minSize: '', maxSize: '', sizeUnit: 'All', serialNoPrefix: 'All', serialNo: '' });
    const [activeStatusFilter, setActiveStatusFilter] = useState<BuyerStatus | 'All'>(statusFilterFromURL || 'All');
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedBuyerForDetails, setSelectedBuyerForDetails] = useState<Buyer | null>(null);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    // -- Limit Calculation --
    const isAgent = profile.role === 'Agent';
    const currentPlan = (profile?.planName as PlanName) || 'Basic';
    const agencyLimit = planLimits[currentPlan]?.buyers || 0;
    
    const myLeadsCount = useMemo(() => {
        if (!allBuyers || !user) return 0;
        return allBuyers.filter(b => b.created_by === user.uid && !b.is_deleted).length;
    }, [allBuyers, user]);

    const limit = isAgent ? Infinity : agencyLimit;
    const currentCount = isAgent ? myLeadsCount : (allBuyers?.filter(b => !b.is_deleted).length || 0);
    const progress = limit === Infinity ? 0 : (currentCount / limit) * 100;
    const isLimitReached = !isAgent && currentCount >= limit;


    const buyerFollowUp = useMemo(() => {
        if (!buyerForFollowUp || !followUps) return null;
        return followUps.find(fu => fu.buyerId === buyerForFollowUp.id);
    }, [buyerForFollowUp, followUps]);

    useEffect(() => {
        if (statusFilterFromURL) {
            setActiveStatusFilter(statusFilterFromURL);
        } else {
            setActiveStatusFilter('All');
        }
    }, [statusFilterFromURL]);

    useEffect(() => {
        if (!isAddBuyerOpen) setBuyerToEdit(null);
    }, [isAddBuyerOpen]);
    
    // When the dialog closes, clear the selected buyer to ensure fresh data is loaded next time
    useEffect(() => {
        if (!isDetailsOpen) {
            setSelectedBuyerForDetails(null);
        }
    }, [isDetailsOpen]);

    // When the master list of buyers changes, update the selected buyer if it exists
    useEffect(() => {
        if (selectedBuyerForDetails && allBuyers) {
            const updatedBuyer = allBuyers.find(b => b.id === selectedBuyerForDetails.id);
            if (updatedBuyer) {
                setSelectedBuyerForDetails(updatedBuyer);
            }
        }
    }, [allBuyers, selectedBuyerForDetails]);
    
    const logActivity = async (action: string, target: string, targetType: Activity['targetType'], details: any = null) => {
        if (!profile.agency_id) return;
        const activityLogRef = collection(firestore, 'agencies', profile.agency_id, 'activityLogs');
        const newActivity: Omit<Activity, 'id'> = {
        userName: profile.name,
        action,
        target,
        targetType,
        details,
        timestamp: new Date().toISOString(),
        agency_id: profile.agency_id,
        };
        await addDoc(activityLogRef, newActivity);
    };


    const formatBudget = (minAmount?: number, minUnit?: PriceUnit, maxAmount?: number, maxUnit?: PriceUnit) => {
        if (!minAmount || !minUnit) return 'N/A';
        const minVal = formatUnit(minAmount, minUnit);
        if (!maxAmount || !maxUnit || (minAmount === maxAmount && minUnit === minUnit)) return formatCurrency(minVal, currency);
        const maxVal = formatUnit(maxAmount, maxUnit);
        return `${formatCurrency(minVal, currency)} - ${formatCurrency(maxVal, currency)}`;
    };

    const handleEdit = (buyer: Buyer) => {
        setBuyerToEdit(buyer);
        setIsAddBuyerOpen(true);
    };

    const handleDetailsClick = (buyer: Buyer) => {
        if (isMobile) return;
        setSelectedBuyerForDetails({ ...buyer });
        setIsDetailsOpen(true);
    };

    const handleSetAppointment = (buyer: Buyer) => {
        setAppointmentDetails({
            contactType: 'Buyer',
            contactName: buyer.name,
            contactSerialNo: buyer.serial_no,
            message: `Regarding buyer's interest in ${buyer.area_preference || 'general properties'}.`,
        });
        setIsAppointmentOpen(true);
    };

    const handleSaveAppointment = async (appointment: Appointment) => {
        if (!profile.agency_id) return;
        const { id, ...newAppointmentData } = appointment;
        await addDoc(collection(firestore, 'agencies', profile.agency_id, 'appointments'), newAppointmentData);
        await logActivity('scheduled an appointment for buyer', appointment.contactName || 'N/A', 'Appointment');
    };

    const handleDelete = async (buyer: Buyer) => {
        if (!profile.agency_id) return;

        const docRef = doc(firestore, 'agencies', profile.agency_id, 'buyers', buyer.id);
        await setDoc(docRef, { is_deleted: true }, { merge: true });
        toast({ title: "Buyer Moved to Trash", description: "You can restore them from the trash page." });
    };

    const handleBulkDelete = async () => {
        if (selectedBuyers.length === 0 || !profile.agency_id) return;
        const batch = writeBatch(firestore);
        selectedBuyers.forEach(buyerId => {
            const buyerRef = doc(firestore, 'agencies', profile.agency_id, 'buyers', buyerId);
            batch.update(buyerRef, { is_deleted: true });
        });
        await batch.commit();
        toast({
            title: `${selectedBuyers.length} Buyers Moved to Trash`,
            description: 'You can restore them from the trash page.',
        });
        setSelectedBuyers([]);
    };

    const handleFilterChange = (key: keyof Filters, value: string | BuyerStatus | PropertyType | PriceUnit | SizeUnit) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
    };

    const clearFilters = () => {
        setFilters({ status: 'All', area: '', minBudget: '', maxBudget: '', budgetUnit: 'All', propertyType: 'All', minSize: '', maxSize: '', sizeUnit: 'All', serialNoPrefix: 'All', serialNo: '' });
        setActiveStatusFilter('All');
        setIsFilterPopoverOpen(false);
    };
    
    const handleAssignAgent = async (buyer: Buyer, agentId: string | null) => {
        if (!profile.agency_id) return;
    
        const newAssignedTo = agentId === undefined ? null : agentId;
    
        const docRef = doc(firestore, 'agencies', profile.agency_id, 'buyers', buyer.id);
        await setDoc(docRef, { assignedTo: newAssignedTo }, { merge: true });
        
        const agentName = assignableAgents.find(a => a.id === newAssignedTo)?.name;
    
        toast({
            title: newAssignedTo ? 'Buyer Assigned' : 'Buyer Unassigned',
            description: newAssignedTo
            ? `Buyer ${buyer.name} assigned to ${agentName}.`
            : `Buyer ${buyer.name} has been unassigned.`
        });
    };

    const handleStatusChange = async (buyer: Buyer, newStatus: BuyerStatus) => {
        if (newStatus === 'Follow Up') {
            setBuyerForFollowUp(buyer);
            setIsFollowUpOpen(true);
        } else {
            if (!profile.agency_id) return;

            const docRef = doc(firestore, 'agencies', profile.agency_id, 'buyers', buyer.id);
            await setDoc(docRef, { status: newStatus }, { merge: true });
            
            await logActivity('updated the status', buyer.name, 'Buyer', { from: buyer.status, to: newStatus });

            if (buyer.status === 'Follow Up' && followUps && profile.agency_id) {
                const followUpToDelete = followUps.find(fu => fu.buyerId === buyer.id);
                if (followUpToDelete) await deleteDoc(doc(firestore, 'agencies', profile.agency_id, 'followUps', followUpToDelete.id));
            }
        }
    };

    const handleSaveFollowUp = async (buyerId: string, notes: string, nextReminderDate: string, nextReminderTime: string, existingFollowUp?: FollowUp | null) => {
        if (!profile.agency_id || !allBuyers) return;
        const buyer = allBuyers.find(b => b.id === buyerId);
        if (!buyer) return;

        const newFollowUpData: Partial<FollowUp> = {
            buyerId: buyer.id,
            buyerName: buyer.name,
            buyerPhone: buyer.phone,
            propertyInterest: buyer.area_preference || 'General',
            nextReminderDate: nextReminderDate,
            nextReminderTime: nextReminderTime,
            status: 'Scheduled',
            notes: notes,
            agency_id: profile.agency_id
        };

        const followUpsCollection = collection(firestore, 'agencies', profile.agency_id, 'followUps');
        const buyerDocRef = doc(firestore, 'agencies', profile.agency_id, 'buyers', buyerId);

        let action = 'scheduled a follow-up';
        if (existingFollowUp) {
            newFollowUpData.lastContactDate = existingFollowUp.nextReminderDate;
            newFollowUpData.lastContactTime = existingFollowUp.nextReminderTime;
            await setDoc(doc(followUpsCollection, existingFollowUp.id), newFollowUpData, { merge: true });
            action = 'rescheduled a follow-up';
        } else {
            newFollowUpData.lastContactDate = new Date().toISOString().split('T')[0];
            newFollowUpData.lastContactTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            await addDoc(followUpsCollection, newFollowUpData);
        }
        
        await logActivity(action, buyer.name, 'FollowUp');
        await setDoc(buyerDocRef, { status: 'Follow Up', last_follow_up_note: notes }, { merge: true });

        toast({ title: "Follow-up Scheduled", description: `A follow-up has been created for ${buyer.name}.` });
        setIsFollowUpOpen(false);
        setBuyerForFollowUp(null);
    };

    const handleSaveBuyer = async (buyerData: Omit<Buyer, 'id'> & { id?: string }) => {
        if (buyerToEdit) {
            if (!profile.agency_id || !buyerData.id) return;
            const docRef = doc(firestore, 'agencies', profile.agency_id, 'buyers', buyerData.id);
            await setDoc(docRef, buyerData, { merge: true });
            toast({ title: 'Buyer Updated' });
        } else {
            if (!profile.agency_id) return;
            const collectionRef = collection(firestore, 'agencies', profile.agency_id, 'buyers');
            const { id, ...restOfData } = buyerData;
            await addDoc(collectionRef, { ...restOfData, agency_id: profile.agency_id, created_by: user?.uid });
            await logActivity('added a new buyer', buyerData.name, 'Buyer');
            toast({ title: 'Buyer Added' });
        }
        setBuyerToEdit(null);
    };
    
    const handleWhatsAppChat = (e: React.MouseEvent, buyer: Buyer) => {
        e.stopPropagation();
        const phoneNumber = formatPhoneNumberForWhatsApp(buyer.phone, buyer.country_code);
        window.open(`https://wa.me/${phoneNumber}`, '_blank');
    };

    const filteredBuyers = useMemo(() => {
        if (!buyersToDisplay) return [];
        
        let buyers = buyersToDisplay.filter(b => !b.is_deleted);

        // Filter by active tab (For Sale/For Rent)
        buyers = buyers.filter(b => (b.listing_type || 'For Sale') === activeTab);
    
        if (activeStatusFilter !== 'All') {
            buyers = buyers.filter(b => b.status === activeStatusFilter);
        }
    
        if (searchQuery) {
            const lowercasedQuery = searchQuery.toLowerCase();
            const numericQuery = searchQuery.replace(/\D/g, '');
            buyers = buyers.filter(buyer =>
                buyer.name.toLowerCase().includes(lowercasedQuery) ||
                (buyer.area_preference && buyer.area_preference.toLowerCase().includes(lowercasedQuery)) ||
                buyer.serial_no.toLowerCase().includes(lowercasedQuery) ||
                (buyer.phone && buyer.phone.replace(/\D/g, '').includes(numericQuery))
            );
        }
    
        if (filters.area) {
            buyers = buyers.filter(b => b.area_preference && b.area_preference.toLowerCase().includes(filters.area.toLowerCase()));
        }
    
        if (filters.minBudget) {
            buyers = buyers.filter(b => b.budget_min_amount && b.budget_min_amount >= Number(filters.minBudget) && (filters.budgetUnit === 'All' || b.budget_min_unit === filters.budgetUnit));
        }
    
        if (filters.maxBudget) {
            buyers = buyers.filter(b => b.budget_max_amount && b.budget_max_amount <= Number(filters.maxBudget) && (filters.budgetUnit === 'All' || b.budget_max_unit === filters.budgetUnit));
        }
    
        if (filters.propertyType !== 'All') {
            buyers = buyers.filter(p => p.property_type_preference === filters.propertyType);
        }
    
        if (filters.minSize) {
            buyers = buyers.filter(p => p.size_min_value && p.size_min_value >= Number(filters.minSize) && (filters.sizeUnit === 'All' || p.size_min_unit === filters.sizeUnit));
        }
    
        if (filters.maxSize) {
            buyers = buyers.filter(p => p.size_max_value && p.size_max_value <= Number(filters.maxSize) && (filters.sizeUnit === 'All' || p.size_max_unit === filters.sizeUnit));
        }
    
        if (filters.serialNo && filters.serialNoPrefix !== 'All') {
            const fullSerialNo = `${filters.serialNoPrefix}-${filters.serialNo}`;
            buyers = buyers.filter(p => p.serial_no === fullSerialNo);
        }
    
        return buyers.sort((a, b) => {
            const aNum = parseInt(a.serial_no.split('-')[1] || '0', 10);
            const bNum = parseInt(b.serial_no.split('-')[1] || '0', 10);
            return sortOrder === 'asc' ? aNum - bNum : bNum - aNum;
        });
    }, [buyersToDisplay, activeTab, activeStatusFilter, searchQuery, filters, sortOrder]);


    const totalPages = Math.ceil(filteredBuyers.length / ITEMS_PER_PAGE);

    const paginatedBuyers = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredBuyers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredBuyers, currentPage]);

    useEffect(() => {
        setCurrentPage(1);
        setSelectedBuyers([]);
    }, [searchQuery, filters, activeTab, activeStatusFilter]);


    const handleTabChange = (value: string) => {
        const url = `${pathname}?type=${value}`;
        router.push(url);
        setActiveStatusFilter('All'); // Reset status filter on tab change
    };

    const handleAddBuyerClick = () => {
        if (user && !user.emailVerified) {
            toast({
                title: 'Email Verification Required',
                description: 'Please verify your email address to add new buyers.',
                variant: 'destructive',
            });
            return;
        }
        if (isLimitReached) {
            toast({
                title: "Buyer Limit Reached",
                description: `You have reached your limit of ${limit} buyers. Please upgrade your plan to add more.`,
                variant: "destructive",
            });
            return;
        }
        setIsAddBuyerOpen(true);
    };
    
    const sortBuyers = (buyersToSort: Buyer[]) => {
        return [...buyersToSort].filter(b => !b.is_deleted).sort((a, b) => {
            const aParts = a.serial_no.split('-');
            const bParts = b.serial_no.split('-');
            const aPrefix = aParts[0];
            const bPrefix = bParts[0];
            const aNum = parseInt(aParts[1], 10);
            const bNum = parseInt(bParts[1], 10);
            
            if (aPrefix < bPrefix) return -1;
            if (aPrefix > bPrefix) return 1;
            return aNum - bNum;
        });
    };

    const escapeCsvField = (field: any): string => {
        if (field === null || field === undefined) {
            return '""';
        }
        const stringField = String(field);
        if (/[",\n]/.test(stringField)) {
            return `"${stringField.replace(/"/g, '""')}"`;
        }
        return `"${stringField}"`;
    };

    const handleExport = (type: 'For Sale' | 'For Rent') => {
        if (!allBuyers || !user?.uid) return;

        let sourceBuyers = allBuyers;
        if (profile.role === 'Agent') {
            sourceBuyers = allBuyers.filter(b => b.created_by === user.uid);
        }

        const buyersToExport = sortBuyers(
            sourceBuyers.filter(b => {
                const listingType = b.listing_type || 'For Sale';
                return !b.is_deleted && listingType === type;
            })
        );

        if (buyersToExport.length === 0) {
            toast({ title: 'No Data', description: `There are no buyers for ${type.toLowerCase()} to export.`, variant: 'destructive' });
            return;
        }
        
        const headers = ['Sr No', 'Date', 'Number', 'Name', 'Email', 'City', 'Area', 'Property Type', 'Size', 'Budget', 'Status', 'Investor', 'Notes'];
        
        const csvContent = [
            headers.join(','),
            ...buyersToExport.map(b => {
                const budgetMin = b.budget_min_amount ? `${b.budget_min_amount} ${b.budget_min_unit}` : '';
                const budgetMax = b.budget_max_amount ? ` - ${b.budget_max_amount} ${b.budget_max_unit}` : '';
                const budget = budgetMin ? budgetMin + (budgetMax || '') : 'N/A';

                const sizeMin = b.size_min_value ? `${b.size_min_value} ${b.size_min_unit}` : '';
                const sizeMax = b.size_max_value ? ` - ${b.size_max_value} ${b.size_max_unit}` : '';
                const size = sizeMin ? sizeMin + (sizeMax || '') : 'N/A';

                const date = new Date(b.created_at);
                const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                const phoneNumber = b.phone.replace(b.country_code || '+92', '').replace(/\D/g, '');


                const row = [
                escapeCsvField(b.serial_no),
                escapeCsvField(formattedDate),
                escapeCsvField(phoneNumber),
                escapeCsvField(b.name),
                escapeCsvField(b.email || ''),
                escapeCsvField(b.city || ''),
                escapeCsvField(b.area_preference || ''),
                escapeCsvField(b.property_type_preference || ''),
                escapeCsvField(size),
                escapeCsvField(budget),
                escapeCsvField(b.status),
                escapeCsvField(b.is_investor ? 'Yes' : 'No'),
                escapeCsvField(b.notes || '')
                ];
                return row.join(',');
            })
        ].join('\n');
    
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `buyers-${type.toLowerCase().replace(' ', '-')}-${new Date().toISOString()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setIsExportDialogOpen(false);
    };

    const handleImportClick = (type: 'For Sale' | 'For Rent') => {
        setImportType(type);
        importInputRef.current?.click();
        setIsImportDialogOpen(false);
    };

    const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !profile.agency_id || !importType || !user?.uid) return;
    
        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target?.result;
            if (typeof text !== 'string') return;

            // Robust CSV parsing
            const parseCsvRow = (row: string): string[] => {
                const result: string[] = [];
                let currentField = '';
                let inQuotes = false;
                for (let i = 0; i < row.length; i++) {
                    const char = row[i];
                    if (char === '"') {
                        if (i + 1 < row.length && row[i+1] === '"') {
                            // It's an escaped quote
                            currentField += '"';
                            i++; // Skip the next quote
                        } else {
                        inQuotes = !inQuotes;
                        }
                    } else if (char === ',' && !inQuotes) {
                        result.push(currentField.trim());
                        currentField = '';
                    } else {
                        currentField += char;
                    }
                }
                result.push(currentField.trim());
                return result;
            };
            
            const rows = text.split('\n').map(row => row.trim()).filter(row => row);
            if (rows.length <= 1) {
            toast({ title: 'Empty File', description: 'The CSV file is empty or invalid.', variant: 'destructive' });
            return;
            }

            const listingTypeToImport: ListingType = importType;
            
            let myBuyers = allBuyers || [];
            if (profile.role === 'Agent') {
                myBuyers = myBuyers.filter(b => b.created_by === user.uid);
            }
            
            const totalSaleBuyersForImport = myBuyers.filter(b => !b.is_deleted && (!b.listing_type || b.listing_type === 'For Sale')).length;
            const totalRentBuyersForImport = myBuyers.filter(b => !b.is_deleted && b.listing_type === 'For Rent').length;
            
            let newBuyersCount = 0;
            let skippedCount = 0;
            let batch = writeBatch(firestore);
            const BATCH_SIZE = 499;

            for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row) continue;
            
            if (newBuyersCount > 0 && newBuyersCount % BATCH_SIZE === 0) {
                await batch.commit();
                batch = writeBatch(firestore);
            }
            
            const values = parseCsvRow(row);
            
            const [
                _serial, _date, number, name, email, city, area, property_type,
                size, budget, status, investor, notes
            ] = values;

            if (!number || number.trim() === '') {
                skippedCount++;
                continue;
            }
            newBuyersCount++;
            
            const parseRange = (rangeStr: string) => {
                if (!rangeStr || rangeStr.toLowerCase() === 'n/a') {
                    return { minVal: null, minUnit: null, maxVal: null, maxUnit: null };
                }
                const parts = rangeStr.split('-').map(s => s.trim());
                const [minValStr, minUnitStr] = parts[0]?.split(' ').filter(Boolean) || [];
                const [maxValStr, maxUnitStr] = parts.length > 1 ? (parts[1]?.split(' ').filter(Boolean) || []) : [];
            
                return {
                    minVal: parseFloat(minValStr) || null,
                    minUnit: (minUnitStr as SizeUnit | PriceUnit) || null,
                    maxVal: parseFloat(maxValStr) || null,
                    maxUnit: (maxUnitStr as SizeUnit | PriceUnit) || (minUnitStr as SizeUnit | PriceUnit) || null,
                };
            };
            
            const budgetData = parseRange(budget || '');
            const sizeData = parseRange(size || '');

            const currentTotal = listingTypeToImport === 'For Sale' ? totalSaleBuyersForImport : totalRentBuyersForImport;

            const newBuyer: Omit<Buyer, 'id'> = {
                serial_no: `${listingTypeToImport === 'For Rent' ? 'RB' : 'B'}-${currentTotal + newBuyersCount}`,
                name: name || 'N/A',
                phone: formatPhoneNumber(number || '', '+92'),
                country_code: '+92',
                email: email || '',
                status: (status as BuyerStatus) || 'New',
                area_preference: area || '',
                city: city || '',
                property_type_preference: (property_type as PropertyType) || "" as PropertyType,
                budget_min_amount: budgetData.minVal,
                budget_min_unit: budgetData.minUnit as PriceUnit || null,
                budget_max_amount: budgetData.maxVal,
                budget_max_unit: budgetData.maxUnit as PriceUnit || null,
                size_min_value: sizeData.minVal,
                size_min_unit: sizeData.minUnit as SizeUnit || null,
                size_max_value: sizeData.maxVal,
                size_max_unit: sizeData.maxUnit as SizeUnit || null,
                is_investor: (investor || '').toLowerCase() === 'yes',
                listing_type: listingTypeToImport,
                notes: notes || '',
                created_at: new Date().toISOString(),
                created_by: user.uid,
                agency_id: profile.agency_id,
            };
            batch.set(doc(collection(firestore, 'agencies', profile.agency_id, 'buyers')), newBuyer);
            }
            
            try {
            await batch.commit(); 
            toast({ 
                title: 'Import Complete', 
                description: `${newBuyersCount} new buyers have been added. ${skippedCount > 0 ? `${skippedCount} rows were skipped due to missing phone numbers.` : ''}` 
            });
            } catch (error) {
            console.error(error);
            toast({ title: 'Import Failed', description: 'An error occurred during import.', variant: 'destructive' });
            }
        };
        reader.readAsText(file);
        if (importInputRef.current) importInputRef.current.value = '';
        setImportType(null);
    };


    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedBuyers(paginatedBuyers.map(b => b.id));
        } else {
            setSelectedBuyers([]);
        }
    };
    
    const handleRecommendProperties = (buyer: Buyer) => {
        setBuyerForRecommendation(buyer);
        setIsRecommenderOpen(true);
    };

    const renderTable = (buyers: Buyer[]) => {
        if (isAgencyLoading) {
            return <p className="p-4 text-center">Loading buyers...</p>;
        }
        if (buyers.length === 0) {
            return <div className="text-center py-10 text-muted-foreground">No buyers found for the current filters.</div>;
        }
        
        return (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-10">
                            <Checkbox
                                checked={paginatedBuyers.length > 0 && selectedBuyers.length === paginatedBuyers.length}
                                onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                            />
                        </TableHead>
                        <TableHead>
                            <Button variant="ghost" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
                                Name
                                <ArrowUpDown className="ml-2 h-4 w-4" />
                            </Button>
                        </TableHead>
                        <TableHead>Area &amp; Type</TableHead>
                        <TableHead>Budget &amp; Size</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {buyers.map(buyer => (
                        <TableRow key={buyer.id}>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                    checked={selectedBuyers.includes(buyer.id)}
                                    onCheckedChange={(checked) => {
                                        setSelectedBuyers(prev =>
                                            checked ? [...prev, buyer.id] : prev.filter(id => id !== buyer.id)
                                        );
                                    }}
                                />
                            </TableCell>
                            <TableCell onClick={() => handleDetailsClick(buyer)} className="cursor-pointer">
                                <div className="font-bold font-headline text-base flex items-center gap-2">
                                    {buyer.name}
                                </div>
                                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                                    <Badge
                                        variant="default"
                                        className={cn(
                                        'font-mono',
                                        buyer.serial_no.startsWith('RB')
                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 hover:bg-emerald-100/80'
                                            : 'bg-primary/20 text-primary hover:bg-primary/30'
                                        )}
                                    >
                                        {buyer.serial_no}
                                    </Badge>
                                    <span>{buyer.phone}</span>
                                </div>
                            </TableCell>
                            <TableCell onClick={() => handleDetailsClick(buyer)} className="cursor-pointer">
                                <div className="flex flex-col text-sm">
                                    <span>{buyer.area_preference}</span>
                                    <span className="text-muted-foreground">{buyer.property_type_preference}</span>
                                </div>
                            </TableCell>
                            <TableCell onClick={() => handleDetailsClick(buyer)} className="cursor-pointer">
                                <div className="flex flex-col text-sm">
                                    <span>{formatBudget(buyer.budget_min_amount, buyer.budget_min_unit, buyer.budget_max_amount, buyer.budget_max_unit)}</span>
                                    <span className="text-muted-foreground">{formatSize(buyer.size_min_value, buyer.size_min_unit, buyer.size_max_value, buyer.size_max_unit)}</span>
                                </div>
                            </TableCell>
                            <TableCell onClick={() => handleDetailsClick(buyer)} className="cursor-pointer">
                                <div className="flex items-center gap-2">
                                    <Badge variant={statusVariant[buyer.status as keyof typeof statusVariant]} className={buyer.status === 'Interested' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : buyer.status === 'New' ? 'bg-green-600 hover:bg-green-700 text-white' : buyer.status === 'Not Interested' ? 'bg-red-600 hover:bg-red-700 text-white' : buyer.status === 'Deal Closed' ? 'bg-slate-800 hover:bg-slate-900 text-white' : ''}>{buyer.status}</Badge>
                                    {buyer.is_investor && (<Badge className="bg-blue-600 hover:bg-blue-700 text-white">Investor</Badge>)}
                                </div>
                            </TableCell>
                            <TableCell className="text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button aria-haspopup="true" size="icon" variant="ghost" className="rounded-full" onClick={(e) => e.stopPropagation()}>
                                            <MoreHorizontal className="h-4 w-4" />
                                            <span className="sr-only">Toggle menu</span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="glass-card">
                                        <DropdownMenuItem onSelect={(e) => { e.stopPropagation(); handleDetailsClick(buyer); }}><Eye />View Details</DropdownMenuItem>
                                        <DropdownMenuItem onSelect={(e) => { e.stopPropagation(); handleRecommendProperties(buyer); }}><Sparkles />Recommend Properties</DropdownMenuItem>
                                        {(profile.role !== 'Agent') && (<DropdownMenuItem onSelect={(e) => { e.stopPropagation(); handleEdit(buyer); }}><Edit />Edit Details</DropdownMenuItem>)}
                                        <DropdownMenuItem onSelect={(e) => handleWhatsAppChat(e, buyer)}><MessageSquare /> Chat on WhatsApp</DropdownMenuItem>
                                        <DropdownMenuItem onSelect={(e) => { e.stopPropagation(); handleSetAppointment(buyer); }}><CalendarPlus />Set Appointment</DropdownMenuItem>
                                         {profile.role !== 'Agent' && (<DropdownMenuSub>
                                            <DropdownMenuSubTrigger><UserPlus />Assign to</DropdownMenuSubTrigger>
                                            <DropdownMenuPortal>
                                                <DropdownMenuSubContent>
                                                    {buyer.assignedTo && <DropdownMenuItem onSelect={() => handleAssignAgent(buyer, null)}>Unassign</DropdownMenuItem>}
                                                    <DropdownMenuSeparator />
                                                    {assignableAgents.map((agent) => (
                                                        <DropdownMenuItem key={agent.id} onSelect={() => handleAssignAgent(buyer, agent.id)} disabled={buyer.assignedTo === agent.id}>
                                                        {agent.name} ({agent.role})
                                                        </DropdownMenuItem>
                                                    ))}
                                                </DropdownMenuSubContent>
                                            </DropdownMenuPortal>
                                        </DropdownMenuSub>)}
                                        <DropdownMenuSub>
                                            <DropdownMenuSubTrigger><Bookmark />Change Status</DropdownMenuSubTrigger>
                                            <DropdownMenuPortal>
                                                <DropdownMenuSubContent>
                                                    {buyerStatuses.map((status) => (
                                                        <DropdownMenuItem key={status} onSelect={(e) => { e.stopPropagation(); handleStatusChange(buyer, status); }} disabled={buyer.status === status}>
                                                            {status}
                                                        </DropdownMenuItem>
                                                    ))}
                                                </DropdownMenuSubContent>
                                            </DropdownMenuPortal>
                                        </DropdownMenu>
                                        {(profile.role !== 'Agent') && (<DropdownMenuItem onSelect={(e) => { e.stopPropagation(); handleDelete(buyer); }} className="text-destructive focus:text-destructive-foreground focus:bg-destructive"><Trash2 />Delete</DropdownMenuItem>)}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        );
    };

    const renderCards = (buyers: Buyer[]) => {
        if (isAgencyLoading) return <p className="p-4 text-center">Loading buyers...</p>;
        if (buyers.length === 0) return <div className="text-center py-10 text-muted-foreground">No buyers found for the current filters.</div>;
        return (
            <div className="space-y-4">
                {buyers.map(buyer => {
                    return (
                        <Card key={buyer.id}>
                        <CardHeader>
                            <CardTitle className="flex justify-between items-start">
                                <div className="flex items-start gap-2">
                                    <Checkbox
                                        checked={selectedBuyers.includes(buyer.id)}
                                        onCheckedChange={(checked) => {
                                            setSelectedBuyers(prev =>
                                                checked ? [...prev, buyer.id] : prev.filter(id => id !== buyer.id)
                                            );
                                        }}
                                        className="mt-1"
                                    />
                                    <div className="font-bold font-headline text-lg flex items-center gap-2">
                                        {buyer.name}
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <Badge variant={statusVariant[buyer.status as keyof typeof statusVariant]} className={`capitalize ${buyer.status === 'Interested' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : buyer.status === 'New' ? 'bg-green-600 hover:bg-green-700 text-white' : buyer.status === 'Not Interested' ? 'bg-red-600 hover:bg-red-700 text-white' : buyer.status === 'Deal Closed' ? 'bg-slate-800 hover:bg-slate-900 text-white' : ''}`}>{buyer.status}</Badge>
                                    {buyer.is_investor && (<Badge className="bg-blue-600 hover:bg-blue-700 text-white">Investor</Badge>)}
                                </div>
                            </CardTitle>
                            <div className="text-xs text-muted-foreground flex items-center gap-2 -mt-2 px-6">
                                <Badge
                                    variant="default"
                                    className={cn(
                                    'font-mono',
                                    buyer.serial_no.startsWith('RB')
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 hover:bg-emerald-100/80'
                                        : 'bg-primary/20 text-primary hover:bg-primary/30'
                                    )}
                                >
                                    {buyer.serial_no}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-4 text-sm">
                            <div className="flex items-center gap-2"><Home className="h-4 w-4 text-muted-foreground" /><div><p className="text-muted-foreground">Area</p><p className="font-medium">{buyer.area_preference}</p></div></div>
                            <div className="flex items-center gap-2"><Ruler className="h-4 w-4 text-muted-foreground" /><div><p className="text-muted-foreground">Size</p><p className="font-medium">{formatSize(buyer.size_min_value, buyer.size_min_unit, buyer.size_max_value, buyer.size_max_unit)}</p></div></div>
                            <div className="flex items-center gap-2"><Wallet className="h-4 w-4 text-muted-foreground" /><div><p className="text-muted-foreground">Budget</p><p className="font-medium">{formatBudget(buyer.budget_min_amount, buyer.budget_min_unit, buyer.budget_max_amount, buyer.budget_max_unit)}</p></div></div>
                            <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /><div><p className="text-muted-foreground">Phone</p><p className="font-medium">{buyer.phone}</p></div></div>
                        </CardContent>
                        <CardFooter className="flex justify-end">
                            <Sheet>
                                <SheetTrigger asChild>
                                    <Button aria-haspopup="true" size="icon" variant="ghost" className="rounded-full -mr-4 -mb-4">
                                        <MoreHorizontal className="h-4 w-4" />
                                        <span className="sr-only">Toggle menu</span>
                                    </Button>
                                </SheetTrigger>
                                <SheetContent side="bottom" className="w-full">
                                    <SheetHeader className="text-left mb-4">
                                        <SheetTitle>Actions for {buyer.serial_no}</SheetTitle>
                                    </SheetHeader>
                                    <div className="flex flex-col gap-2">
                                        <Button variant="outline" className="justify-start" onClick={(e) => { e.stopPropagation(); setSelectedBuyerForDetails(buyer); setIsDetailsOpen(true); }}><Eye />View Details</Button>
                                        <Button variant="outline" className="justify-start" onClick={(e) => { e.stopPropagation(); handleRecommendProperties(buyer); }}><Sparkles />Recommend Properties</Button>
                                        {(profile.role !== 'Agent') && (<Button variant="outline" className="justify-start" onClick={(e) => { e.stopPropagation(); handleEdit(buyer); }}><Edit />Edit Details</Button>)}
                                        <Button variant="outline" className="justify-start" onClick={(e) => handleWhatsAppChat(e, buyer)}><MessageSquare /> Chat on WhatsApp</Button>
                                        <Button variant="outline" className="justify-start" onClick={(e) => { e.stopPropagation(); handleSetAppointment(buyer); }}><CalendarPlus />Set Appointment</Button>
                                         {profile.role !== 'Agent' && (<DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" className="justify-start w-full"><UserPlus />Assign Agent</Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent side="top">
                                                {buyer.assignedTo && <DropdownMenuItem onSelect={() => handleAssignAgent(buyer, null)}>Unassign</DropdownMenuItem>}
                                                <DropdownMenuSeparator />
                                                {assignableAgents.map((agent) => (
                                                    <DropdownMenuItem key={agent.id} onSelect={() => handleAssignAgent(buyer, agent.id)} disabled={buyer.assignedTo === agent.id}>
                                                    {agent.name} ({agent.role})
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>)}
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" className="justify-start"><Bookmark />Change Status</Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent side="top">
                                                {buyerStatuses.map((status) => (
                                                    <DropdownMenuItem key={status} onSelect={(e) => { e.stopPropagation(); handleStatusChange(buyer, status); }} disabled={buyer.status === status}>
                                                        {status}
                                                    </DropdownMenuItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>

                                        {(profile.role !== 'Agent') && (
                                        <>
                                            <Separator />
                                            <Button variant="destructive" className="justify-start" onClick={(e) => { e.stopPropagation(); handleDelete(buyer); }}><Trash2 />Delete</Button>
                                        </>
                                        )}
                                    </div>
                                </SheetContent>
                            </Sheet>
                        </CardFooter>
                    </Card>
                    )
                })}
            </div>
        );
    };

    const renderPagination = () => (
      <div className="flex items-center justify-end space-x-2 py-4">
          <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
          </span>
          <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
          >
              <ChevronLeft className="h-4 w-4" />
              Previous
          </Button>
          <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
          >
              Next
              <ChevronRight className="h-4 w-4" />
          </Button>
      </div>
    );

    const renderContent = (buyers: Buyer[]) => {
        const content = isMobile ? renderCards(buyers) : (
            <Card>
                <CardContent className="p-0">
                    {renderTable(buyers)}
                </CardContent>
            </Card>
        );
        return (
            <div>
                {content}
                {totalPages > 1 && renderPagination()}
            </div>
        )
    };
    
    return (
        <TooltipProvider>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className='hidden md:block'>
                        <h1 className="text-3xl font-bold tracking-tight font-headline">Buyers</h1>
                        <p className="text-muted-foreground">
                            {profile.role === 'Agent' ? 'View your assigned buyer leads.' : 'Manage your buyer leads for sale and rent.'}
                        </p>
                    </div>
                    <div className="flex w-full md:w-auto items-center gap-2 flex-wrap">
                        {selectedBuyers.length > 0 && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" className="rounded-full">
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete ({selectedBuyers.length})
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will move {selectedBuyers.length} buyers to the trash. You can restore them later.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleBulkDelete}>Confirm</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                        {profile.role !== 'Agent' && (
                        <>
                        <Popover open={isFilterPopoverOpen} onOpenChange={setIsFilterPopoverOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="rounded-full">
                                    <Filter className="mr-2 h-4 w-4" />Filters
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80">
                                <div className="grid gap-4">
                                    <div className="space-y-2">
                                        <h4 className="font-medium leading-none">Advanced Filters</h4>
                                        <p className="text-sm text-muted-foreground">Refine your buyer search.</p>
                                    </div>
                                    <div className="grid gap-2">
                                        <div className="grid grid-cols-3 items-center gap-4">
                                            <Label>Serial No</Label>
                                            <div className="col-span-2 grid grid-cols-2 gap-2">
                                                <Select value={filters.serialNoPrefix} onValueChange={(value: 'All' | 'B' | 'RB') => handleFilterChange('serialNoPrefix', value)}>
                                                    <SelectTrigger className="h-8">
                                                        <SelectValue placeholder="Prefix" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="All">All</SelectItem>
                                                        <SelectItem value="B">B</SelectItem>
                                                        <SelectItem value="RB">RB</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <Input id="serialNo" placeholder="e.g. 1" type="number" value={filters.serialNo} onChange={e => handleFilterChange('serialNo', e.target.value)} className="h-8" />
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-3 items-center gap-4">
                                            <Label htmlFor="area">Area</Label>
                                            <Input id="area" value={filters.area} onChange={e => handleFilterChange('area', e.target.value)} className="col-span-2 h-8" />
                                        </div>
                                        <div className="grid grid-cols-3 items-center gap-4">
                                            <Label htmlFor="propertyType">Type</Label>
                                            <Select value={filters.propertyType} onValueChange={(value: PropertyType | 'All') => handleFilterChange('propertyType', value)}>
                                                <SelectTrigger className="col-span-2 h-8">
                                                    <SelectValue placeholder="Property Type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="All">All</SelectItem>
                                                    <SelectItem value="House">House</SelectItem>
                                                    <SelectItem value="Plot">Plot</SelectItem>
                                                    <SelectItem value="Flat">Flat</SelectItem>
                                                    <SelectItem value="Shop">Shop</SelectItem>
                                                    <SelectItem value="Commercial">Commercial</SelectItem>
                                                    <SelectItem value="Agricultural">Agricultural</SelectItem>
                                                    <SelectItem value="Other">Other</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid grid-cols-3 items-center gap-4">
                                            <Label>Budget</Label>
                                            <div className="col-span-2 grid grid-cols-2 gap-2">
                                                <Input id="minBudget" placeholder="Min" type="number" value={filters.minBudget} onChange={e => handleFilterChange('minBudget', e.target.value)} className="h-8" />
                                                <Input id="maxBudget" placeholder="Max" type="number" value={filters.maxBudget} onChange={e => handleFilterChange('maxBudget', e.target.value)} className="h-8" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 items-center gap-4">
                                            <Label></Label>
                                            <div className="col-span-2">
                                                <Select value={filters.budgetUnit} onValueChange={(value: PriceUnit | 'All') => handleFilterChange('budgetUnit', value)}>
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
                                        <div className="grid grid-cols-3 items-center gap-4">
                                            <Label>Size</Label>
                                            <div className="col-span-2 grid grid-cols-2 gap-2">
                                                <Input id="minSize" placeholder="Min" type="number" value={filters.minSize} onChange={e => handleFilterChange('minSize', e.target.value)} className="h-8" />
                                                <Input id="maxSize" placeholder="Max" type="number" value={filters.maxSize} onChange={e => handleFilterChange('maxSize', e.target.value)} className="h-8" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 items-center gap-4">
                                            <Label></Label>
                                            <div className="col-span-2">
                                                <Select value={filters.sizeUnit} onValueChange={(value: SizeUnit | 'All') => handleFilterChange('sizeUnit', value)}>
                                                    <SelectTrigger className="h-8">
                                                        <SelectValue placeholder="Unit" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="All">All Units</SelectItem>
                                                        <SelectItem value="Marla">Marla</SelectItem>
                                                        <SelectItem value="SqFt">SqFt</SelectItem>
                                                        <SelectItem value="Kanal">Kanal</SelectItem>
                                                        <SelectItem value="Acre">Acre</SelectItem>
                                                        <SelectItem value="Maraba">Maraba</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost" onClick={clearFilters}>Clear</Button>
                                        <Button onClick={() => setIsFilterPopoverOpen(false)}>Apply</Button>
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>
                        <Button variant="outline" className="rounded-full" onClick={() => setIsImportDialogOpen(true)}><Upload className="mr-2 h-4 w-4" />Import</Button>
                        <input type="file" ref={importInputRef} className="hidden" accept=".csv" onChange={handleImport} />
                        <Button variant="outline" className="rounded-full" onClick={() => setIsExportDialogOpen(true)}><Download className="mr-2 h-4 w-4" />Export</Button>
                        </>
                        )}
                    </div>
                </div>
                
                {profile.role === 'Admin' && (
                <Card>
                    <CardContent className="p-4">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-muted-foreground">Buyer Leads Usage</span>
                            <span className="text-sm font-bold">{currentCount} / {limit === Infinity ? 'Unlimited' : limit}</span>
                        </div>
                        <Progress value={progress} />
                    </CardContent>
                </Card>
                )}

                <div className="flex items-center justify-between gap-4">
                    <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                        <TabsList className='grid w-full grid-cols-2'>
                            <TabsTrigger value="For Sale">Sale Buyers</TabsTrigger>
                            <TabsTrigger value="For Rent">Rent Buyers</TabsTrigger>
                        </TabsList>
                    </Tabs>
                    {isMobile && (
                         <div className="flex items-center gap-2">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                        <Button variant="outline" className="ml-auto">
                                            {activeStatusFilter}
                                            <ChevronDown className="ml-2 h-4 w-4" />
                                        </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                        <DropdownMenuItem onSelect={() => setActiveStatusFilter('All')}>All</DropdownMenuItem>
                                        {buyerStatuses.map(status => (
                                            <DropdownMenuItem key={status} onSelect={() => setActiveStatusFilter(status)}>
                                                {status}
                                            </DropdownMenuItem>
                                        ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                        id="select-all-mobile"
                                        checked={paginatedBuyers.length > 0 && selectedBuyers.length === paginatedBuyers.length}
                                        onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                                />
                                <label
                                        htmlFor="select-all-mobile"
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                        Select All
                                </label>
                            </div>
                         </div>
                    )}
                </div>
                <Tabs value={activeTab} onValueChange={handleTabChange}>
                    <TabsContent value="For Sale" className="mt-4">
                        {renderContent(paginatedBuyers)}
                    </TabsContent>
                    <TabsContent value="For Rent" className="mt-4">
                        {renderContent(paginatedBuyers)}
                    </TabsContent>
                </Tabs>
            </div>
            <AddBuyerDialog
                isOpen={isAddBuyerOpen}
                setIsOpen={setIsAddBuyerOpen}
                totalSaleBuyers={totalSaleBuyers}
                totalRentBuyers={totalRentBuyers}
                buyerToEdit={buyerToEdit}
                onSave={handleSaveBuyer}
                limitReached={isLimitReached}
            />
            {buyerForFollowUp && (<AddFollowUpDialog isOpen={isFollowUpOpen} setIsOpen={setIsFollowUpOpen} buyer={buyerForFollowUp} existingFollowUp={buyerFollowUp} onSave={handleSaveFollowUp} />)}
            {appointmentDetails && (<SetAppointmentDialog isOpen={isAppointmentOpen} setIsOpen={setIsAppointmentOpen} onSave={handleSaveAppointment} appointmentDetails={appointmentDetails} />)}
            {selectedBuyerForDetails && (<BuyerDetailsDialog buyer={selectedBuyerForDetails} isOpen={isDetailsOpen} setIsOpen={setIsDetailsOpen} />)}
            {buyerForRecommendation && allProperties && (
                <PropertyRecommenderDialog
                    isOpen={isRecommenderOpen}
                    setIsOpen={setIsRecommenderOpen}
                    buyer={buyerForRecommendation}
                    properties={allProperties}
                />
            )}
            <AlertDialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Choose Export Type</AlertDialogTitle>
                    <AlertDialogDescription>
                        Select which type of buyers you would like to export to a CSV file.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleExport('For Sale')}>Export Sale Buyers</AlertDialogAction>
                    <AlertDialogAction onClick={() => handleExport('For Rent')}>Export Rent Buyers</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Choose Import Type</AlertDialogTitle>
                    <AlertDialogDescription>
                        Select the type of buyers you are importing from a CSV file.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleImportClick('For Sale')}>Import Sale Buyers</AlertDialogAction>
                    <AlertDialogAction onClick={() => handleImportClick('For Rent')}>Import Rent Buyers</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
             {profile.role !== 'Agent' && (
                <div className={cn("fixed bottom-24 right-4 md:bottom-8 md:right-8 z-50 transition-opacity", isMoreMenuOpen && "opacity-0 pointer-events-none")}>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                 <Button onClick={handleAddBuyerClick} className="rounded-full w-14 h-14 shadow-lg glowing-btn" size="icon">
                                    <PlusCircle className="h-6 w-6" />
                                    <span className="sr-only">Add Buyer</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left">Add Buyer</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            )}
        </TooltipProvider>
    );
}

export default function BuyersPage() {
    return (
        <Suspense fallback={<div>Loading buyers...</div>}>
            <BuyersPageContent />
        </Suspense>
    );
}
