
'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  MoreHorizontal,
  Trash2,
  Edit,
  Video,
  CheckCircle,
  Eye,
  Filter,
  Upload,
  Download,
  Search,
  MapPin,
  Tag,
  Wallet,
  VideoOff,
  PlusCircle,
  CalendarPlus,
  Briefcase,
  Home,
  Building,
  ArchiveRestore,
  PackagePlus,
  PackageCheck,
  RotateCcw,
  ChevronDown,
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  ArrowUpDown,
  Link as LinkIcon,
  FileArchive,
  UserPlus,
  Circle,
  Clock,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { AddPropertyDialog } from '@/components/add-property-dialog';
import { Input } from '@/components/ui/input';
import type { Property, PropertyType, SizeUnit, PriceUnit, AppointmentContactType, Appointment, ListingType, PlanName, PropertyStatus, User, Activity, RecordingPaymentStatus } from '@/lib/types';
import { useState, useMemo, useEffect, useRef } from 'react';
import { PropertyDetailsDialog } from '@/components/property-details-dialog';
import { MarkAsSoldDialog } from '@/components/mark-as-sold-dialog';
import { MarkAsRentOutDialog } from '@/components/mark-as-rent-out-dialog';
import { RecordVideoDialog } from '@/components/record-video-dialog';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useSearch, useUI } from '../layout';
import { SetAppointmentDialog } from '@/components/set-appointment-dialog';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/context/currency-context';
import { formatCurrency, formatUnit, formatPhoneNumberForWhatsApp } from '@/lib/formatters';
import { useProfile } from '@/context/profile-context';
import { useFirestore } from '@/firebase/provider';
import { collection, addDoc, setDoc, doc, writeBatch, updateDoc } from 'firebase/firestore';
import { useMemoFirebase } from '@/firebase/hooks';
import { cn, formatPhoneNumber } from '@/lib/utils';
import { AddSalePropertyForm } from '@/components/add-sale-property-form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUser } from '@/firebase/auth/use-user';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { motion } from 'framer-motion';
import { useCollection } from '@/firebase/firestore/use-collection';
import { SetRecordingPaymentDialog } from '@/components/set-recording-payment-dialog';

const ITEMS_PER_PAGE = 50;
const AGENT_LEAD_LIMIT = Infinity; // Limit removed for agents

const planLimits = {
  Basic: { properties: 500, buyers: 500, team: 3 },
  Standard: { properties: 2500, buyers: 2500, team: 10 },
  Premium: { properties: Infinity, buyers: Infinity, team: Infinity },
};

const paymentStatusConfig: Record<RecordingPaymentStatus, { icon: React.FC<any>; color: string; label: string }> = {
  'Unpaid': { icon: Circle, color: 'text-orange-500', label: 'Unpaid Recording' },
  'Paid Online': { icon: CheckCircle, color: 'text-green-500', label: 'Paid Recording' },
  'Pending Cash': { icon: Clock, color: 'text-purple-500', label: 'Pending Cash' },
};


function formatSize(value: number, unit: string) {
  return `${value} ${unit}`;
}

interface Filters {
  area: string;
  propertyType: PropertyType | 'All' | 'Other';
  otherPropertyType: string;
  minSize: string;
  maxSize: string;
  sizeUnit: SizeUnit | 'All';
  minDemand: string;
  maxDemand: string;
  demandUnit: PriceUnit | 'All';
  serialNoPrefix: 'All' | 'P' | 'RP';
  serialNo: string;
  videoLink: string;
}

const propertyStatuses = [
  { value: 'All (Sale)', label: 'All (Sale)' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Available (Sale)', label: 'Available (Sale)' },
  { value: 'Sold', label: 'Sold' },
  { value: 'Sold (External)', label: 'Sold (External)' },
  { value: 'All (Rent)', label: 'All (Rent)' },
  { value: 'Available (Rent)', label: 'Available (Rent)' },
  { value: 'Rent Out', label: 'Rent Out' },
  { value: 'Recorded', label: 'Recorded' },
];

const propertyTypesForFilter: (PropertyType | 'All' | 'Other')[] = [
  'All', 'House', 'Flat', 'Farm House', 'Penthouse', 'Plot', 'Residential Plot', 'Commercial Plot', 'Agricultural Land', 'Industrial Land', 'Office', 'Shop', 'Warehouse', 'Factory', 'Building', 'Residential Property', 'Commercial Property', 'Semi Commercial', 'Other'
];


export default function PropertiesPage() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const { profile } = useProfile();
  const { searchQuery } = useSearch();
  const { isMoreMenuOpen } = useUI();
  const { toast } = useToast();
  const { currency } = useCurrency();
  const firestore = useFirestore();

  const statusFilterFromURL = searchParams.get('status');
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importType, setImportType] = useState<'For Sale' | 'For Rent' | null>(null);

  const agencyPropertiesQuery = useMemoFirebase(
    () => (profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'properties') : null),
    [profile.agency_id, firestore]
  );
  const { data: allProperties, isLoading: isAgencyLoading } = useCollection<Property>(agencyPropertiesQuery);

  const teamMembersQuery = useMemoFirebase(() => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'teamMembers') : null, [profile.agency_id, firestore]);
  const { data: teamMembers } = useCollection<User>(teamMembersQuery);

  const [activeAgencyTab, setActiveAgencyTab] = useState(profile.agencies?.[0]?.agency_id);

  useEffect(() => {
    if (isMobile && profile.role === 'Agent' && !activeAgencyTab && profile.agencies && profile.agencies.length > 0) {
      setActiveAgencyTab(profile.agencies[0].agency_id);
    }
  }, [profile.agencies, activeAgencyTab, isMobile, profile.role]);



  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isTagsDialogOpen, setIsTagsDialogOpen] = useState(false);

  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isSoldOpen, setIsSoldOpen] = useState(false);
  const [isRentOutOpen, setIsRentOutOpen] = useState(false);
  const [isRecordVideoOpen, setIsRecordVideoOpen] = useState(false);
  const [isAddPropertyOpen, setIsAddPropertyOpen] = useState(false);
  const [isAppointmentOpen, setIsAppointmentOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [assignmentDetails, setAssignmentDetails] = useState<{ property: Property, agentId: string, agentName: string } | null>(null);
  const [activePaymentTab, setActivePaymentTab] = useState<string>('all');


  const [appointmentDetails, setAppointmentDetails] = useState<{
    contactType: AppointmentContactType;
    contactName: string;
    contactSerialNo?: string;
    message: string;
  } | null>(null);
  const [propertyToEdit, setPropertyToEdit] = useState<Property | null>(null);
  const [filters, setFilters] = useState<Filters>({
    area: '',
    propertyType: 'All',
    otherPropertyType: '',
    minSize: '',
    maxSize: '',
    sizeUnit: 'All',
    minDemand: '',
    maxDemand: '',
    demandUnit: 'All',
    serialNoPrefix: 'All',
    serialNo: '',
    videoLink: '',
  });
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [propertyForDetails, setPropertyForDetails] = useState<Property | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [listingType, setListingType] = useState<ListingType>('For Sale');

  const isAgent = profile.role === 'Agent';
  const currentPlan = (profile?.planName as PlanName) || 'Basic';
  const agencyLimit = planLimits[currentPlan]?.properties || 0;

  const myLeadsCount = useMemo(() => {
    if (!allProperties || !user) return 0;
    return allProperties.filter(p => p.created_by === user.uid).length;
  }, [allProperties, user]);

  const limit = isAgent ? AGENT_LEAD_LIMIT : agencyLimit;
  const currentCount = isAgent ? myLeadsCount : (allProperties?.length || 0);
  const progress = limit === Infinity ? 100 : (currentCount / limit) * 100;
  const isLimitReached = currentCount >= limit;

  const activeTeamMembers = useMemo(() => {
    return teamMembers?.filter(m => m.status === 'Active') || [];
  }, [teamMembers]);

  useEffect(() => {
    if (!isAddPropertyOpen) {
      setPropertyToEdit(null);
    }
  }, [isAddPropertyOpen]);

  const formatDemand = (amount: number, unit: PriceUnit) => {
    const valueInPkr = formatUnit(amount, unit);
    return formatCurrency(valueInPkr, currency);
  };

  const handleFilterChange = (key: keyof Filters, value: string | PropertyType | 'Other' | SizeUnit | PriceUnit) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      area: '',
      propertyType: 'All',
      otherPropertyType: '',
      minSize: '',
      maxSize: '',
      sizeUnit: 'All',
      minDemand: '',
      maxDemand: '',
      demandUnit: 'All',
      serialNoPrefix: 'All',
      serialNo: '',
      videoLink: '',
    });
    setIsFilterPopoverOpen(false);
  };

  const handleAssignUser = async (property: Property, agentId: string | null) => {
    if (!profile.agency_id) return;

    const member = activeTeamMembers.find(m => m.id === agentId);
    if (!member) {
      // Unassigning
      await updateDoc(doc(firestore, 'agencies', profile.agency_id, 'properties', property.id), { assignedTo: null });
      toast({ title: 'Property Unassigned' });
      return;
    }

    if (member.role === 'Video Recorder') {
      setAssignmentDetails({ property, agentId: member.id, agentName: member.name });
      setIsPaymentDialogOpen(true);
    } else {
      // Direct assignment for Agent/Admin
      await assignToAgent(property, member.id, member.name);
    }
  };

  const assignToAgent = async (property: Property, agentId: string, agentName: string) => {
    if (!profile.agency_id) return;
    await updateDoc(doc(firestore, 'agencies', profile.agency_id, 'properties', property.id), { assignedTo: agentId });
    // Log activity
    const activityLogRef = collection(firestore, 'agencies', profile.agency_id, 'activityLogs');
    const newActivity: Omit<Activity, 'id'> = {
      userName: profile.name,
      action: `assigned property to ${agentName}`,
      target: property.auto_title,
      targetType: 'Property',
      details: null,
      timestamp: new Date().toISOString(),
      agency_id: profile.agency_id,
    };
    await addDoc(activityLogRef, newActivity);
    toast({ title: 'Property Assigned', description: `${property.serial_no} assigned to ${agentName}.` });
  };

  const handleConfirmPaymentAndAssign = async (property: Property, agentId: string, paymentDetails: any) => {
    if (!profile.agency_id) return;
    const agent = activeTeamMembers.find(m => m.id === agentId);
    if (!agent) return;

    const batch = writeBatch(firestore);

    const propRef = doc(firestore, 'agencies', profile.agency_id, 'properties', property.id);
    batch.update(propRef, {
      assignedTo: agentId,
      is_recorded: false,
      editing_status: 'In Editing',
      ...paymentDetails
    });

    const activityLogRef = collection(firestore, 'agencies', profile.agency_id, 'activityLogs');
    const newActivity: Omit<Activity, 'id'> = {
      userName: profile.name,
      action: `assigned property for recording to ${agent.name}`,
      target: property.auto_title,
      targetType: 'Property',
      details: { from: 'Available', to: 'Pending Recording' },
      timestamp: new Date().toISOString(),
      agency_id: profile.agency_id,
    };
    batch.set(doc(activityLogRef), newActivity);

    await batch.commit();
    toast({ title: 'Property Assigned for Recording', description: `${property.serial_no} assigned to ${agent.name}.` });
  };


  const handleBulkAssign = async (agentId: string) => {
    if (selectedProperties.length === 0 || !agentId || !profile.agency_id) return;

    const agent = activeTeamMembers.find(m => m.id === agentId);
    if (!agent) {
      toast({ title: 'Agent not found', variant: 'destructive' });
      return;
    }

    const batch = writeBatch(firestore);
    let updates: Partial<Property> = { assignedTo: agentId };

    if (agent.role === 'Video Recorder') {
      updates.is_recorded = false;
      updates.editing_status = 'In Editing';
    }

    selectedProperties.forEach(propId => {
      const docRef = doc(firestore, 'agencies', profile.agency_id, 'properties', propId);
      batch.update(docRef, updates);
    });

    await batch.commit();

    // Log the bulk activity
    const activityLogRef = collection(firestore, 'agencies', profile.agency_id, 'activityLogs');
    const newActivity: Omit<Activity, 'id'> = {
      userName: profile.name,
      action: `assigned ${selectedProperties.length} properties to ${agent.name}`,
      target: `Multiple Properties`,
      targetType: 'Property',
      details: null,
      timestamp: new Date().toISOString(),
      agency_id: profile.agency_id,
      assignedToId: agentId,
      assignedToName: agent.name,
    };
    await addDoc(activityLogRef, newActivity);

    toast({
      title: 'Properties Assigned',
      description: `${selectedProperties.length} properties have been assigned to ${agent.name}.`
    });

    setSelectedProperties([]);
  };

  const handleRevertPayment = async (prop: Property) => {
    if (!profile.agency_id) return;
    const docRef = doc(firestore, 'agencies', profile.agency_id, 'properties', prop.id);
    await updateDoc(docRef, {
      recording_payment_status: 'Unpaid',
      recording_payment_amount: null,
      recording_payment_date: null,
    });
    toast({ title: 'Payment Reverted', description: `${prop.serial_no} is now marked as Unpaid.` });
  };

  const filteredProperties = useMemo(() => {
    if (!allProperties) return [];

    let baseProperties = allProperties.filter(p => !p.is_deleted);

    if (profile.role === 'Agent' && user?.uid && activeAgencyTab) {
      baseProperties = baseProperties.filter(p => p.assignedTo === user.uid && p.agency_id === activeAgencyTab);
    }

    // 1. Primary Filter: Search Query
    if (searchQuery) {
      const lowercasedQuery = searchQuery.toLowerCase();
      const numericQuery = searchQuery.replace(/\D/g, '');

      baseProperties = baseProperties.filter(
        (prop) =>
          (prop.auto_title && prop.auto_title.toLowerCase().includes(lowercasedQuery)) ||
          prop.address.toLowerCase().includes(lowercasedQuery) ||
          prop.area.toLowerCase().includes(lowercasedQuery) ||
          prop.serial_no.toLowerCase().includes(lowercasedQuery) ||
          (prop.owner_number && prop.owner_number.replace(/\D/g, '').includes(numericQuery)) ||
          (prop.video_links && Object.values(prop.video_links).some(link => link && link.includes(searchQuery)))
      );
    }

    // 2. Secondary Filter: Advanced Filters Popover
    if (filters.area) baseProperties = baseProperties.filter((p) => p.area.toLowerCase().includes(filters.area.toLowerCase()));

    if (filters.propertyType !== 'All') {
      if (filters.propertyType === 'Other') {
        if (filters.otherPropertyType) {
          baseProperties = baseProperties.filter((p) => p.property_type.toLowerCase().includes(filters.otherPropertyType.toLowerCase()));
        }
      } else {
        baseProperties = baseProperties.filter((p) => p.property_type === filters.propertyType);
      }
    }

    if (filters.minSize) baseProperties = baseProperties.filter((p) => p.size_value >= Number(filters.minSize) && (filters.sizeUnit === 'All' || p.size_unit === filters.sizeUnit));
    if (filters.maxSize) baseProperties = baseProperties.filter((p) => p.size_value <= Number(filters.maxSize) && (filters.sizeUnit === 'All' || p.size_unit === filters.sizeUnit));
    if (filters.minDemand) baseProperties = baseProperties.filter((p) => p.demand_amount >= Number(filters.minDemand) && (filters.demandUnit === 'All' || p.demand_unit === filters.demandUnit));
    if (filters.maxDemand) baseProperties = baseProperties.filter((p) => p.demand_amount <= Number(filters.maxDemand) && (filters.demandUnit === 'All' || p.demand_unit === filters.demandUnit));
    if (filters.serialNo && filters.serialNoPrefix !== 'All') {
      const fullSerialNo = `${filters.serialNoPrefix}-${filters.serialNo}`;
      baseProperties = baseProperties.filter(p => p.serial_no === fullSerialNo);
    }
    if (filters.videoLink) {
      baseProperties = baseProperties.filter(p => p.video_links && Object.values(p.video_links).some(link => link && link.includes(filters.videoLink)));
    }


    // 3. Final Filter: URL Status Param & Payment Tab
    const currentStatusFilter = statusFilterFromURL || 'All (Sale)';

    switch (currentStatusFilter) {
      case 'All (Sale)':
        baseProperties = baseProperties.filter(p => !p.is_for_rent);
        break;
      case 'Pending':
        baseProperties = baseProperties.filter(p => p.status === 'Pending');
        break;
      case 'Available (Sale)':
        baseProperties = baseProperties.filter(p => p.status === 'Available' && !p.is_for_rent);
        break;
      case 'Sold':
        baseProperties = baseProperties.filter(p => p.status === 'Sold' && !p.is_for_rent);
        break;
      case 'Sold (External)':
        baseProperties = baseProperties.filter(p => p.status === 'Sold (External)');
        break;
      case 'All (Rent)':
        baseProperties = baseProperties.filter(p => p.is_for_rent);
        break;
      case 'Available (Rent)':
        baseProperties = baseProperties.filter(p => p.status === 'Available' && p.is_for_rent);
        break;
      case 'Rent Out':
        baseProperties = baseProperties.filter(p => p.status === 'Rent Out');
        break;
      case 'Recorded':
        baseProperties = baseProperties.filter(p => p.is_recorded || p.recording_payment_status === 'Paid Online');
        break;
      default:
        baseProperties = baseProperties.filter(p => !p.is_for_rent);
        break;
    }

    // 4. Payment Status Tab Filter
    if (activePaymentTab !== 'all') {
      baseProperties = baseProperties.filter(prop => {
        const status = prop.recording_payment_status || 'Unpaid';
        if (activePaymentTab === 'Paid') {
          return status === 'Paid Online';
        }
        if (activePaymentTab === 'Pending') {
          return status === 'Pending Cash';
        }
        return status === 'Unpaid' && activePaymentTab === 'Unpaid';
      });
    }

    // 5. Sorting
    return baseProperties.sort((a, b) => {
      const aNum = parseInt(a.serial_no.split('-')[1] || '0', 10);
      const bNum = parseInt(b.serial_no.split('-')[1] || '0', 10);
      return sortOrder === 'asc' ? aNum - bNum : bNum - aNum;
    });

  }, [searchQuery, filters, allProperties, statusFilterFromURL, profile.role, user?.uid, sortOrder, activeAgencyTab, activePaymentTab]);

  const totalPages = Math.ceil(filteredProperties.length / ITEMS_PER_PAGE);

  const paginatedProperties = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProperties.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredProperties, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedProperties([]);
  }, [searchQuery, filters, statusFilterFromURL, activeAgencyTab, activePaymentTab]);


  const handleRowClick = (prop: Property) => {
    setPropertyForDetails(prop);
    setIsDetailsOpen(true);
  };

  const handleOpenAddDialog = (type: ListingType) => {
    if (user && !user.emailVerified) {
      toast({
        title: 'Email Verification Required',
        description: 'Please verify your email address to add new properties.',
        variant: 'destructive',
      });
      return;
    }
    if (isLimitReached) {
      toast({
        title: isAgent ? "Personal Lead Limit Reached" : "Property Limit Reached",
        description: `You have reached your limit of ${limit} properties. ${isAgent ? 'You can still receive unlimited assigned leads.' : 'Please upgrade your plan to add more.'}`,
        variant: "destructive",
      });
      return;
    }
    setListingType(type);
    setPropertyToEdit(null);
    setIsAddPropertyOpen(true);
  }

  const handleMarkAsSold = (prop: Property) => {
    setPropertyForDetails(prop);
    setIsSoldOpen(true);
  };

  const handleMarkAsRentOut = (prop: Property) => {
    setPropertyForDetails(prop);
    setIsRentOutOpen(true);
  };

  const handleRecordVideo = (prop: Property) => {
    setPropertyForDetails(prop);
    setIsRecordVideoOpen(true);
  };

  const handleEdit = (prop: Property) => {
    setListingType(prop.is_for_rent ? 'For Rent' : 'For Sale');
    setPropertyToEdit(prop);
    setIsAddPropertyOpen(true);
  };

  const handleSetAppointment = (prop: Property) => {
    setAppointmentDetails({
      contactType: 'Owner',
      contactName: `Owner of ${prop.serial_no}`,
      contactSerialNo: prop.serial_no,
      message: `Regarding property: ${prop.auto_title} (${prop.address})`,
    });
    setIsAppointmentOpen(true);
  };

  const handleWhatsAppChat = (e: React.MouseEvent, prop: Property) => {
    e.stopPropagation();
    const phoneNumber = formatPhoneNumberForWhatsApp(prop.owner_number, prop.country_code);
    window.open(`https://wa.me/${phoneNumber}`, '_blank');
  };

  const handleSaveAppointment = async (appointment: Appointment) => {
    if (!profile.agency_id) return;
    const collectionRef = collection(firestore, 'agencies', profile.agency_id, 'appointments');
    await addDoc(collectionRef, appointment);
  };

  const handleUnmarkRecorded = async (prop: Property) => {
    if (!profile.agency_id) return;
    const docRef = doc(firestore, 'agencies', profile.agency_id, 'properties', prop.id);
    await setDoc(docRef, { is_recorded: false, video_links: {} }, { merge: true });
  };

  const handleUpdateProperty = async (updatedProperty: Property) => {
    if (!profile.agency_id) return;
    const docRef = doc(firestore, 'agencies', profile.agency_id, 'properties', updatedProperty.id);
    await updateDoc(docRef, { ...updatedProperty });
  };

  const handleMarkAsAvailableForRent = async (prop: Property) => {
    if (!profile.agency_id) return;
    const docRef = doc(firestore, 'agencies', profile.agency_id, 'properties', prop.id);
    await setDoc(docRef, {
      status: 'Available',
      rent_out_date: null,
      rented_by_agent_id: null,
      rent_total_commission: null,
      rent_agent_share: null
    }, { merge: true });
    toast({ title: 'Property Marked as Available for Rent' });
  };

  const handleMarkAsUnsold = async (prop: Property) => {
    if (!profile.agency_id) return;

    const docRef = doc(firestore, 'agencies', profile.agency_id, 'properties', prop.id);
    await setDoc(docRef, {
      status: 'Available',
      sold_price: null,
      sold_price_unit: null,
      sale_date: null,
      sold_by_agent_id: null,
      buyerId: null,
      buyerName: null,
      buyerSerialNo: null,
      commission_from_buyer: null,
      commission_from_buyer_unit: null,
      commission_from_seller: null,
      commission_from_seller_unit: null,
      total_commission: null,
      agent_commission_amount: null,
      agent_commission_unit: null,
      agent_share_percentage: null,
    }, { merge: true });
    toast({ title: 'Property Status Updated', description: `${prop.serial_no} marked as Available again.` });
  };

  const handleDelete = async (property: Property) => {
    if (!profile.agency_id) return;
    const docRef = doc(firestore, 'agencies', profile.agency_id, 'properties', property.id);
    await setDoc(docRef, { is_deleted: true }, { merge: true });
    toast({
      title: 'Property Moved to Trash',
      description: 'You can restore it from the trash page.',
    });
  };

  const handleBulkDelete = async () => {
    if (selectedProperties.length === 0 || !profile.agency_id) return;

    const batch = writeBatch(firestore);
    selectedProperties.forEach(propId => {
      const docRef = doc(firestore, 'agencies', profile.agency_id, 'properties', propId);
      batch.update(docRef, { is_deleted: true });
    });

    await batch.commit();
    toast({
      title: `${selectedProperties.length} Properties Moved to Trash`,
      description: 'You can restore them from the trash page.',
    });
    setSelectedProperties([]);
  };

  const handleSaveProperty = async (propertyData: Omit<Property, 'id'> & { id?: string }) => {
    if (!profile.agency_id) return;

    try {
      if (propertyToEdit && propertyData.id) {
        const docRef = doc(firestore, 'agencies', profile.agency_id, 'properties', propertyData.id);
        await setDoc(docRef, propertyData, { merge: true });
        toast({ title: 'Property Updated' });
      } else {
        const collectionRef = collection(firestore, 'agencies', profile.agency_id, 'properties');
        const { id, ...restOfData } = propertyData;
        await addDoc(collectionRef, {
          ...restOfData,
          created_by: profile.user_id,
          agency_id: profile.agency_id
        });
        toast({ title: 'Property Added' });
      }
    } catch (error) {
      console.error("Error saving property: ", error);
      toast({ title: "Save Failed", description: "Could not save the property.", variant: 'destructive' });
    }
    setPropertyToEdit(null);
  };

  const handleStatusChange = (status: string) => {
    const url = `${pathname}?status=${encodeURIComponent(status)}`;
    router.push(url);
  };

  const sortProperties = (propertiesToSort: Property[]) => {
    return [...propertiesToSort].filter(p => !p.is_deleted).sort((a, b) => {
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
    if (!allProperties || !user?.uid) return;

    let sourceProperties = allProperties;
    // If user is an agent, only export their own leads
    if (profile.role === 'Agent') {
      sourceProperties = allProperties.filter(p => p.created_by === user.uid);
    }

    const propertiesToExport = sortProperties(
      sourceProperties.filter(p => {
        const listingType = p.is_for_rent ? 'For Rent' : 'For Sale';
        return !p.is_deleted && listingType === type;
      })
    );

    if (propertiesToExport.length === 0) {
      toast({ title: 'No Data', description: `You have no properties for ${type.toLowerCase()} to export.`, variant: 'destructive' });
      return;
    }

    const baseHeaders = ['Sr No', 'Video Record', 'Date', 'Number', 'City', 'Area', 'Address', 'Property Type', 'Size', 'Storey', 'Utilities', 'Status'];
    const saleHeaders = [...baseHeaders, 'Road Size', 'Potential Rent', 'Front', 'Length', 'Demand', 'Documents', 'TikTok Link', 'YouTube Link', 'Instagram Link', 'Facebook Link', 'Other Link'];
    const rentHeaders = [...baseHeaders, 'Rent', 'TikTok Link', 'YouTube Link', 'Instagram Link', 'Facebook Link', 'Other Link'];
    const headers = type === 'For Sale' ? saleHeaders : rentHeaders;

    const csvContent = [
      headers.join(','),
      ...propertiesToExport.map(p => {
        const demandValue = p.demand_unit === 'Crore' ? `${p.demand_amount} Cr` : p.demand_unit === 'Lacs' ? `${p.demand_amount} Lacs` : `${p.demand_amount} K`;
        const potentialRentValue = p.potential_rent_amount ? `${p.potential_rent_amount}${p.potential_rent_unit === 'Thousand' ? 'K' : ` ${p.potential_rent_unit}`}` : '';
        const utilities = [
          p.meters?.electricity && 'Electricity',
          p.meters?.gas && 'Gas',
          p.meters?.water && 'Water'
        ].filter(Boolean).join('/');

        const date = new Date(p.created_at);
        const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

        const phoneNumber = p.owner_number.replace(p.country_code || '+92', '').replace(/\D/g, '');

        const baseRow = [
          escapeCsvField(p.serial_no),
          escapeCsvField(p.is_recorded ? 'Yes' : 'No'),
          escapeCsvField(formattedDate),
          escapeCsvField(phoneNumber),
          escapeCsvField(p.city),
          escapeCsvField(p.area),
          escapeCsvField(p.address),
          escapeCsvField(p.property_type),
          escapeCsvField(`${p.size_value} ${p.size_unit}`),
          escapeCsvField(p.storey || ''),
          escapeCsvField(utilities),
          escapeCsvField(p.status)
        ];

        if (type === 'For Sale') {
          return [
            ...baseRow,
            escapeCsvField(p.road_size_ft ? `${p.road_size_ft} ft` : ''),
            escapeCsvField(potentialRentValue),
            escapeCsvField(p.front_ft || ''),
            escapeCsvField(p.length_ft || ''),
            escapeCsvField(demandValue),
            escapeCsvField(p.documents || ''),
            escapeCsvField(p.video_links?.tiktok || ''),
            escapeCsvField(p.video_links?.youtube || ''),
            escapeCsvField(p.video_links?.instagram || ''),
            escapeCsvField(p.video_links?.facebook || ''),
            escapeCsvField(p.video_links?.other || '')
          ].join(',');
        } else { // For Rent
          return [
            ...baseRow,
            escapeCsvField(demandValue),
            escapeCsvField(p.video_links?.tiktok || ''),
            escapeCsvField(p.video_links?.youtube || ''),
            escapeCsvField(p.video_links?.instagram || ''),
            escapeCsvField(p.video_links?.facebook || ''),
            escapeCsvField(p.video_links?.other || '')
          ].join(',');
        }
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `properties-${type.toLowerCase().replace(' ', '-')}-${new Date().toISOString()}.csv`);
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
    if (!file || !profile.agency_id || !importType || !allProperties || !user?.uid) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result;
      if (typeof text !== 'string') return;

      const parseCsvRow = (row: string): string[] => {
        const result: string[] = [];
        let currentField = '';
        let inQuotes = false;
        for (let i = 0; i < row.length; i++) {
          const char = row[i];
          if (char === '"') {
            if (i + 1 < row.length && row[i + 1] === '"') {
              currentField += '"';
              i++;
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

      const rows = text.split('\n').filter(row => row.trim() !== '');
      if (rows.length <= 1) {
        toast({ title: 'Empty File', description: 'The CSV file is empty or invalid.', variant: 'destructive' });
        return;
      }

      const listingTypeToImport: ListingType = importType;

      let myProperties = allProperties;
      if (profile.role === 'Agent') {
        myProperties = allProperties.filter(p => p.created_by === user.uid);
      }

      const totalSaleProperties = myProperties.filter(p => !p.is_deleted && !p.is_for_rent).length;
      const totalRentProperties = myProperties.filter(p => !p.is_deleted && p.is_for_rent).length;

      const BATCH_SIZE = 499;
      let batch = writeBatch(firestore);
      let newPropertiesCount = 0;
      let skippedCount = 0;

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;

        if (newPropertiesCount > 0 && newPropertiesCount % BATCH_SIZE === 0) {
          await batch.commit();
          batch = writeBatch(firestore);
        }

        const values = parseCsvRow(row);
        let newProperty: Omit<Property, 'id'>;

        if (listingTypeToImport === 'For Sale') {
          const [
            _serial, video_recorded, _date, number, city, area, address, property_type, size, storey, utilities, status,
            road_size_ft, potential_rent, front_ft, length_ft, demand, documents,
            tiktok, youtube, instagram, facebook, other
          ] = values;

          if (!number || number.trim() === '') {
            skippedCount++;
            continue;
          }
          newPropertiesCount++;

          const [size_value_str, size_unit_str] = size ? size.split(' ') : ['', ''];
          const [demand_amount_str, demand_unit_str] = demand ? demand.split(' ') : ['', ''];

          const parseOptionalNumber = (val: string | undefined): number | null => {
            if (!val || val.trim() === '') return null;
            const parsed = parseInt(val.replace(/\D/g, ''), 10);
            return isNaN(parsed) ? null : parsed;
          };

          const potentialRentLower = (potential_rent || '').toLowerCase();
          let potentialRentAmount: number | null = null;
          let potentialRentUnit: PriceUnit = 'Thousand';

          if (potentialRentLower.includes('lac')) {
            potentialRentAmount = parseFloat(potentialRentLower.replace('lac', '').trim()) || null;
            potentialRentUnit = 'Lacs';
          } else if (potentialRentLower.includes('cr')) {
            potentialRentAmount = parseFloat(potentialRentLower.replace('cr', '').trim()) || null;
            potentialRentUnit = 'Crore';
          } else {
            potentialRentAmount = parseOptionalNumber(potential_rent);
          }

          newProperty = {
            serial_no: `P-${totalSaleProperties + newPropertiesCount}`,
            auto_title: `${size || 'N/A'} ${property_type || ''} in ${area || ''}`.trim(),
            property_type: (property_type as PropertyType) || 'House',
            area: area || '',
            address: address || '',
            city: city || 'Lahore',
            size_value: parseFloat(size_value_str) || 0,
            size_unit: (size_unit_str as SizeUnit) || 'Marla',
            demand_amount: parseFloat(demand_amount_str) || 0,
            demand_unit: demand_unit_str?.endsWith('Cr') ? 'Crore' : 'Lacs',
            status: 'Available',
            owner_number: formatPhoneNumber(number, '+92'),
            country_code: '+92',
            listing_type: 'For Sale',
            is_for_rent: false,
            created_at: new Date().toISOString(),
            created_by: profile.user_id,
            agency_id: profile.agency_id,
            is_recorded: video_recorded?.toLowerCase() === 'yes',
            video_links: { tiktok: tiktok || '', youtube: youtube || '', instagram: instagram || '', facebook: facebook || '', other: other || '' },
            road_size_ft: parseOptionalNumber(road_size_ft),
            storey: storey || '',
            potential_rent_amount: potentialRentAmount,
            potential_rent_unit: potentialRentUnit,
            front_ft: parseOptionalNumber(front_ft),
            length_ft: parseOptionalNumber(length_ft),
            documents: documents || '',
            meters: {
              electricity: utilities?.includes('Electricity') || false,
              gas: utilities?.includes('Gas') || false,
              water: utilities?.includes('Water') || false,
            },
          };
        } else {
          const [
            _serial, video_recorded, _date, number, city, area, address, property_type, size,
            storey, utilities, status, rent,
            tiktok, youtube, instagram, facebook, other
          ] = values;

          if (!number || number.trim() === '') {
            skippedCount++;
            continue;
          }
          newPropertiesCount++;

          const [size_value_str, size_unit_str] = size ? size.split(' ') : ['', ''];
          const [demand_amount_str, demand_unit_str] = rent ? rent.split(' ') : ['', ''];

          newProperty = {
            serial_no: `RP-${totalRentProperties + newPropertiesCount}`,
            auto_title: `${size || 'N/A'} ${property_type || ''} for rent in ${area || ''}`.trim(),
            property_type: (property_type as PropertyType) || 'House',
            area: area || '',
            address: address || '',
            city: city || 'Lahore',
            size_value: parseFloat(size_value_str) || 0,
            size_unit: (size_unit_str as SizeUnit) || 'Marla',
            demand_amount: parseFloat(demand_amount_str) || 0,
            demand_unit: 'Thousand',
            status: 'Available',
            owner_number: formatPhoneNumber(number, '+92'),
            country_code: '+92',
            listing_type: 'For Rent',
            is_for_rent: true,
            created_at: new Date().toISOString(),
            created_by: profile.user_id,
            agency_id: profile.agency_id,
            is_recorded: video_recorded?.toLowerCase() === 'yes',
            video_links: { tiktok: tiktok || '', youtube: youtube || '', instagram: instagram || '', facebook: facebook || '', other: other || '' },
            storey: storey || '',
            meters: {
              electricity: utilities?.includes('Electricity') || false,
              gas: utilities?.includes('Gas') || false,
              water: utilities?.includes('Water') || false,
            },
          };
        }

        batch.set(doc(collection(firestore, 'agencies', profile.agency_id, 'properties')), newProperty);
      }

      try {
        await batch.commit();
        toast({
          title: 'Import Complete',
          description: `${newPropertiesCount} new properties have been added. ${skippedCount > 0 ? `${skippedCount} rows were skipped due to missing phone numbers.` : ''}`
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
      setSelectedProperties(paginatedProperties.map(p => p.id));
    } else {
      setSelectedProperties([]);
    }
  };

  const renderTable = (properties: Property[]) => {
    if (isAgencyLoading) {
      return <p className="p-4 text-center">Loading properties...</p>;
    }
    if (properties.length === 0) {
      return <div className="text-center py-10 text-muted-foreground">No properties found for the current filters.</div>;
    }

    const hasVideoLinks = (prop: Property) => prop.is_recorded && prop.video_links && Object.values(prop.video_links).some(link => !!link);

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={paginatedProperties.length > 0 && selectedProperties.length === paginatedProperties.length}
                onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
              />
            </TableHead>
            <TableHead className="w-[350px]">
              <Button variant="ghost" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
                Property
                <ArrowUpDown className="ml-2 h-4 w-4" />
              </Button>
            </TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Demand</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {properties.map((prop, index) => {
            const paymentStatus = prop.recording_payment_status;
            const paymentConfig = paymentStatus ? paymentStatusConfig[paymentStatus] : null;
            const Icon = paymentConfig?.icon;

            return (
              <motion.tr
                key={prop.id}
                className="hover:bg-accent/50 transition-colors cursor-pointer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedProperties.includes(prop.id)}
                    onCheckedChange={(checked) => {
                      setSelectedProperties(prev =>
                        checked ? [...prev, prop.id] : prev.filter(id => id !== prop.id)
                      );
                    }}
                  />
                </TableCell>
                <TableCell onClick={() => handleRowClick(prop)}>
                  <div className="flex items-center gap-2">
                    <span className="font-bold font-headline text-base flex items-center gap-2">
                      {prop.auto_title || `${prop.size_value} ${prop.size_unit} ${prop.property_type} in ${prop.area}`}
                      {hasVideoLinks(prop) && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Video className="h-4 w-4 text-primary" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Video is recorded</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {prop.uploaded_documents && prop.uploaded_documents.length > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <FileArchive className="h-4 w-4 text-primary" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Documents are uploaded</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                    <Badge
                      variant="default"
                      className={cn(
                        'font-mono',
                        prop.serial_no.startsWith('RP')
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 hover:bg-emerald-100/80'
                          : 'bg-primary/20 text-primary hover:bg-primary/30'
                      )}
                    >
                      {prop.serial_no}
                    </Badge>
                    <span className="truncate max-w-48">{prop.address}</span>
                  </div>
                </TableCell>
                <TableCell onClick={() => handleRowClick(prop)}>{prop.property_type}</TableCell>
                <TableCell onClick={() => handleRowClick(prop)}>{formatSize(prop.size_value, prop.size_unit)}</TableCell>
                <TableCell onClick={() => handleRowClick(prop)}>{formatDemand(prop.demand_amount, prop.demand_unit)}</TableCell>
                <TableCell onClick={() => handleRowClick(prop)}>
                  <div className="flex flex-col gap-1 items-start">
                    <div className="flex items-center gap-2">
                      {paymentConfig && Icon && (
                        <Tooltip>
                          <TooltipTrigger>
                            <Icon className={cn("h-4 w-4", paymentConfig.color)} />
                          </TooltipTrigger>
                          <TooltipContent><p>{paymentConfig.label}</p></TooltipContent>
                        </Tooltip>
                      )}
                      <Badge className={prop.status === 'Sold' ? 'bg-green-600 hover:bg-green-700 text-white' : prop.status === 'Rent Out' ? 'bg-blue-600 hover:bg-blue-700 text-white' : prop.status === 'Sold (External)' ? 'bg-slate-500 hover:bg-slate-600 text-white' : 'bg-primary text-primary-foreground'}>
                        {prop.status}
                      </Badge>
                    </div>
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
                      <DropdownMenuItem onSelect={(e) => { e.stopPropagation(); handleRowClick(prop); }}><Eye />View Details</DropdownMenuItem>
                      <DropdownMenuItem onSelect={(e) => handleWhatsAppChat(e, prop)}><MessageSquare /> Chat on WhatsApp</DropdownMenuItem>
                      <DropdownMenuItem onSelect={(e) => { e.stopPropagation(); handleSetAppointment(prop); }}><CalendarPlus />Set Appointment</DropdownMenuItem>

                      {profile.role !== 'Agent' && (
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger><UserPlus /> Assign to</DropdownMenuSubTrigger>
                          <DropdownMenuPortal>
                            <DropdownMenuSubContent>
                              {prop.assignedTo && <DropdownMenuItem onSelect={() => handleAssignUser(prop, null)}>Unassign</DropdownMenuItem>}
                              <DropdownMenuSeparator />
                              {activeTeamMembers.map((member) => (
                                <DropdownMenuItem key={member.id} onSelect={() => handleAssignUser(prop, member.id)} disabled={prop.assignedTo === member.id}>
                                  {member.name} ({member.role})
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuSubContent>
                          </DropdownMenuPortal>
                        </DropdownMenuSub>
                      )}

                      {prop.recording_payment_status === 'Paid Online' && profile.role !== 'Agent' && (
                        <DropdownMenuItem onSelect={(e) => { e.stopPropagation(); handleRevertPayment(prop); }} className="text-destructive focus:text-destructive-foreground focus:bg-destructive/10"><RotateCcw />Revert to Unpaid</DropdownMenuItem>
                      )}
                      {prop.is_for_rent && prop.status === 'Available' && (
                        <DropdownMenuItem onSelect={(e) => { e.stopPropagation(); handleMarkAsRentOut(prop); }}><ArchiveRestore />Mark as Rent Out</DropdownMenuItem>
                      )}
                      {prop.is_for_rent && prop.status === 'Rent Out' && (
                        <DropdownMenuItem onSelect={(e) => { e.stopPropagation(); handleMarkAsAvailableForRent(prop); }}><RotateCcw />Mark as Available</DropdownMenuItem>
                      )}
                      {prop.status === 'Available' && !prop.is_for_rent && (
                        <DropdownMenuItem onSelect={(e) => { e.stopPropagation(); handleMarkAsSold(prop); }}><CheckCircle />Mark as Sold</DropdownMenuItem>
                      )}
                      {(prop.status === 'Sold' || prop.status === 'Sold (External)') && profile.role !== 'Agent' && (
                        <DropdownMenuItem onSelect={(e) => { e.stopPropagation(); handleMarkAsUnsold(prop); }}><RotateCcw />Mark as Unsold</DropdownMenuItem>
                      )}
                      {profile.role !== 'Agent' && (
                        <DropdownMenuItem onSelect={(e) => { e.stopPropagation(); handleEdit(prop); }}><Edit />Edit Details</DropdownMenuItem>
                      )}

                      {profile.role !== 'Agent' && (
                        <DropdownMenuItem onSelect={(e) => { e.stopPropagation(); handleRecordVideo(prop); }}><Video />Mark as Recorded</DropdownMenuItem>
                      )}

                      {profile.role !== 'Agent' && (
                        <DropdownMenuItem onSelect={(e) => { e.stopPropagation(); handleDelete(prop); }} className="text-destructive focus:text-destructive-foreground focus:bg-destructive"><Trash2 />Delete</DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </motion.tr>
            )
          })}
        </TableBody>
      </Table>
    );
  };

  const renderCards = (properties: Property[]) => {
    if (isAgencyLoading) return <p className="p-4 text-center">Loading properties...</p>;
    if (properties.length === 0) return <div className="text-center py-10 text-muted-foreground">No properties found for the current filters.</div>;

    const hasVideoLinks = (prop: Property) => prop.is_recorded && prop.video_links && Object.values(prop.video_links).some(link => !!link);

    return (
      <div className="space-y-4">
        {properties.map((prop, index) => {
          const paymentStatus = prop.recording_payment_status;
          const paymentConfig = paymentStatus ? paymentStatusConfig[paymentStatus] : null;
          const Icon = paymentConfig?.icon;

          return (
            <motion.div
              key={prop.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex items-start gap-2">
                      <Checkbox
                        checked={selectedProperties.includes(prop.id)}
                        onCheckedChange={(checked) => {
                          setSelectedProperties(prev =>
                            checked ? [...prev, prop.id] : prev.filter(id => id !== prop.id)
                          );
                        }}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <CardTitle className="font-bold font-headline text-base flex items-center gap-2">
                          {prop.auto_title || `${prop.size_value} ${prop.size_unit} ${prop.property_type} in ${prop.area}`}
                          {hasVideoLinks(prop) && <Video className="h-4 w-4 text-primary" />}
                        </CardTitle>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 pt-1">
                          <Badge
                            variant="default"
                            className={cn(
                              'font-mono',
                              prop.serial_no.startsWith('RP')
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 hover:bg-emerald-100/80'
                                : 'bg-primary/20 text-primary hover:bg-primary/30'
                            )}
                          >
                            {prop.serial_no}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      <div className="flex items-center gap-2">
                        {paymentConfig && Icon && (
                          <Tooltip>
                            <TooltipTrigger>
                              <Icon className={cn("h-4 w-4", paymentConfig.color)} />
                            </TooltipTrigger>
                            <TooltipContent><p>{paymentConfig.label}</p></TooltipContent>
                          </Tooltip>
                        )}
                        <Badge className={cn("flex-shrink-0", prop.status === 'Sold' ? 'bg-green-600 hover:bg-green-700 text-white' : prop.status === 'Rent Out' ? 'bg-blue-600 hover:bg-blue-700 text-white' : prop.status === 'Sold (External)' ? 'bg-slate-500 hover:bg-slate-600 text-white' : 'bg-primary text-primary-foreground')}>
                          {prop.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2"><Tag className="h-4 w-4 text-muted-foreground" /><div><p className="text-muted-foreground">Type</p><p className="font-medium">{prop.property_type}</p></div></div>
                  <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /><div><p className="text-muted-foreground">Size</p><p className="font-medium">{formatSize(prop.size_value, prop.size_unit)}</p></div></div>
                  <div className="flex items-center gap-2"><Wallet className="h-4 w-4 text-muted-foreground" /><div><p className="text-muted-foreground">Demand</p><p className="font-medium">{formatDemand(prop.demand_amount, prop.demand_unit)}</p></div></div>
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
                        <SheetTitle>Actions for {prop.serial_no}</SheetTitle>
                      </SheetHeader>
                      <div className="flex flex-col gap-2">
                        <Button variant="outline" className="justify-start" onClick={(e) => { e.stopPropagation(); handleRowClick(prop); }}><Eye />View Details</Button>
                        <Button variant="outline" className="justify-start" onClick={(e) => handleWhatsAppChat(e, prop)}><MessageSquare /> Chat on WhatsApp</Button>
                        <Button variant="outline" className="justify-start" onClick={(e) => { e.stopPropagation(); handleSetAppointment(prop); }}><CalendarPlus />Set Appointment</Button>
                        {profile.role !== 'Agent' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" className="justify-start w-full"><UserPlus /> Assign to</Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="top">
                              <DropdownMenuItem onSelect={() => handleAssignUser(prop, null)} disabled={!prop.assignedTo}>Unassign</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {activeTeamMembers.map((member) => (
                                <DropdownMenuItem key={member.id} onSelect={() => handleAssignUser(prop, member.id)} disabled={prop.assignedTo === member.id}>
                                  {member.name} ({member.role})
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        {prop.recording_payment_status === 'Paid Online' && profile.role !== 'Agent' && (
                          <Button variant="destructive" className="justify-start" onClick={(e) => { e.stopPropagation(); handleRevertPayment(prop); }}><RotateCcw />Revert to Unpaid</Button>
                        )}
                        {prop.is_for_rent && prop.status === 'Available' && (
                          <Button variant="outline" className="justify-start" onClick={(e) => { e.stopPropagation(); handleMarkAsRentOut(prop); }}><ArchiveRestore />Mark as Rent Out</Button>
                        )}
                        {prop.is_for_rent && prop.status === 'Rent Out' && profile.role !== 'Agent' && (
                          <Button variant="outline" className="justify-start" onClick={(e) => { e.stopPropagation(); handleMarkAsAvailableForRent(prop); }}><RotateCcw />Mark as Available</Button>
                        )}
                        {prop.status === 'Available' && !prop.is_for_rent && (
                          <Button variant="outline" className="justify-start" onClick={(e) => { e.stopPropagation(); handleMarkAsSold(prop); }}><CheckCircle />Mark as Sold</Button>
                        )}
                        {(prop.status === 'Sold' || prop.status === 'Sold (External)') && profile.role !== 'Agent' && (
                          <Button variant="outline" className="justify-start" onClick={(e) => { e.stopPropagation(); handleMarkAsUnsold(prop); }}><RotateCcw />Mark as Unsold</Button>
                        )}
                        {profile.role !== 'Agent' && (
                          <Button variant="outline" className="justify-start" onClick={(e) => { e.stopPropagation(); handleEdit(prop); }}><Edit />Edit Details</Button>
                        )}

                        {profile.role !== 'Agent' && (
                          <Button variant="outline" className="justify-start" onClick={(e) => { e.stopPropagation(); handleRecordVideo(prop); }}><Video />Mark as Recorded</Button>
                        )}

                        {profile.role !== 'Agent' && (
                          <>
                            <Separator />
                            <Button variant="destructive" className="justify-start" onClick={(e) => { e.stopPropagation(); handleDelete(prop); }}><Trash2 />Delete</Button>
                          </>
                        )}
                      </div>
                    </SheetContent>
                  </Sheet>
                </CardFooter>
              </Card>
            </motion.div>
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

  const renderContent = (properties: Property[]) => {
    const content = isMobile ? renderCards(properties) : <Card><CardContent className="p-0">{renderTable(properties)}</CardContent></Card>;
    return (
      <div>
        {content}
        {totalPages > 1 && renderPagination()}
      </div>
    )
  };

  return (
    <>
      <TooltipProvider>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="hidden md:block">
              <h1 className="text-3xl font-bold tracking-tight font-headline">Properties</h1>
              <p className="text-muted-foreground">
                {profile.role === 'Agent' ? 'View your assigned properties.' : 'Manage your agency and personal properties.'}
              </p>
            </div>
            <div className="flex w-full md:w-auto items-center gap-2 flex-wrap">
              {isMobile && (
                <div className="flex w-full items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="flex-1">
                        {statusFilterFromURL ? propertyStatuses.find(s => s.value === statusFilterFromURL)?.label : 'All (Sale)'}
                        <ChevronDown className="ml-2 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {propertyStatuses.map(status => (
                        <DropdownMenuItem key={status.value} onSelect={() => handleStatusChange(status.value)}>
                          {status.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="select-all-mobile"
                      checked={paginatedProperties.length > 0 && selectedProperties.length === paginatedProperties.length}
                      onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                    />
                    <Label htmlFor="select-all-mobile" className="text-sm font-medium leading-none">
                      All
                    </Label>
                  </div>
                </div>
              )}
              {selectedProperties.length > 0 && profile.role !== 'Agent' && (
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="rounded-full">
                        <UserPlus className="mr-2 h-4 w-4" />
                        Assign to Agent
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {activeTeamMembers.map((member) => (
                        <DropdownMenuItem key={member.id} onSelect={() => handleBulkAssign(member.id)}>
                          {member.name} ({member.role})
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="rounded-full">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete ({selectedProperties.length})
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will move {selectedProperties.length} properties to the trash. You can restore them later.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleBulkDelete}>Confirm</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
              {profile.role !== 'Agent' && (
                <>
                  <Popover open={isFilterPopoverOpen} onOpenChange={setIsFilterPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="rounded-full"><Filter className="mr-2 h-4 w-4" />Filters</Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <h4 className="font-medium leading-none">Filters</h4>
                          <p className="text-sm text-muted-foreground">Refine your property search.</p>
                        </div>
                        <div className="grid gap-2">
                          <div className="grid grid-cols-3 items-center gap-4">
                            <Label>Serial No</Label>
                            <div className="col-span-2 grid grid-cols-2 gap-2">
                              <Select value={filters.serialNoPrefix} onValueChange={(value: 'All' | 'P' | 'RP') => handleFilterChange('serialNoPrefix', value)}>
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="Prefix" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="All">All</SelectItem>
                                  <SelectItem value="P">P</SelectItem>
                                  <SelectItem value="RP">RP</SelectItem>
                                </SelectContent>
                              </Select>
                              <Input id="serialNo" placeholder="e.g. 1" type="number" value={filters.serialNo} onChange={e => handleFilterChange('serialNo', e.target.value)} className="h-8" />
                            </div>
                          </div>
                          <div className="grid grid-cols-3 items-center gap-4">
                            <Label htmlFor="area">Area</Label>
                            <Input id="area" value={filters.area} onChange={(e) => handleFilterChange('area', e.target.value)} className="col-span-2 h-8" />
                          </div>
                          <div className="grid grid-cols-3 items-center gap-4">
                            <Label htmlFor="videoLink" className="flex items-center gap-1"><LinkIcon className="h-3 w-3" />Video Link</Label>
                            <Input id="videoLink" value={filters.videoLink} onChange={(e) => handleFilterChange('videoLink', e.target.value)} className="col-span-2 h-8" />
                          </div>
                          <div className="grid grid-cols-3 items-center gap-4">
                            <Label htmlFor="propertyType">Type</Label>
                            <Select value={filters.propertyType} onValueChange={(value) => handleFilterChange('propertyType', value as PropertyType | 'All' | 'Other')}>
                              <SelectTrigger className="col-span-2 h-8">
                                <SelectValue placeholder="Property Type" />
                              </SelectTrigger>
                              <SelectContent>
                                {propertyTypesForFilter.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          {filters.propertyType === 'Other' && (
                            <div className="grid grid-cols-3 items-center gap-4">
                              <Label htmlFor="otherPropertyType" className="text-right pr-4">Custom</Label>
                              <Input
                                id="otherPropertyType"
                                value={filters.otherPropertyType}
                                onChange={(e) => handleFilterChange('otherPropertyType', e.target.value)}
                                className="col-span-2 h-8"
                                placeholder="Enter type..."
                              />
                            </div>
                          )}
                          <div className="grid grid-cols-3 items-center gap-4">
                            <Label>Size</Label>
                            <div className="col-span-2 grid grid-cols-2 gap-2">
                              <Input id="minSize" placeholder="Min" type="number" value={filters.minSize} onChange={(e) => handleFilterChange('minSize', e.target.value)} className="h-8" />
                              <Input id="maxSize" placeholder="Max" type="number" value={filters.maxSize} onChange={(e) => handleFilterChange('maxSize', e.target.value)} className="h-8" />
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
                          <div className="grid grid-cols-3 items-center gap-4">
                            <Label>Demand</Label>
                            <div className="col-span-2 grid grid-cols-2 gap-2">
                              <Input id="minDemand" placeholder="Min" type="number" value={filters.minDemand} onChange={(e) => handleFilterChange('minDemand', e.target.value)} className="h-8" />
                              <Input id="maxDemand" placeholder="Max" type="number" value={filters.maxDemand} onChange={(e) => handleFilterChange('maxDemand', e.target.value)} className="h-8" />
                            </div>
                          </div>
                          <div className="grid grid-cols-3 items-center gap-4">
                            <Label></Label>
                            <div className="col-span-2">
                              <Select value={filters.demandUnit} onValueChange={(value: PriceUnit | 'All') => handleFilterChange('demandUnit', value)}>
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="Unit" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="All">All Units</SelectItem>
                                  <SelectItem value="Lacs">Lacs</SelectItem>
                                  <SelectItem value="Crore">Crore</SelectItem>
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
                  <Button variant="outline" className="rounded-full" onClick={() => setIsTagsDialogOpen(true)}><Tag className="mr-2 h-4 w-4" />Tags</Button>
                </>
              )}
            </div>
          </div>

          {profile.role !== 'Agent' && (
            <Card>
              <CardContent className="p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-muted-foreground">{isAgent ? "My Property Leads Usage" : "Property Leads Usage"}</span>
                  <span className="text-sm font-bold">{currentCount} / {limit === Infinity ? 'Unlimited' : limit}</span>
                </div>
                <Progress value={progress} />
              </CardContent>
            </Card>
          )}

          {isAgent && profile.agencies && profile.agencies.length > 1 ? (
            <Tabs value={activeAgencyTab} onValueChange={setActiveAgencyTab}>
              <TabsList>
                {profile.agencies.map(agency => (
                  <TabsTrigger key={agency.agency_id} value={agency.agency_id}>
                    {agency.agency_name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          ) : null}

          <Tabs defaultValue="all" value={activePaymentTab} onValueChange={setActivePaymentTab}>
            <TabsList className="grid grid-cols-4 w-full max-w-lg">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="Unpaid">Unpaid</TabsTrigger>
              <TabsTrigger value="Pending">Pending</TabsTrigger>
              <TabsTrigger value="Paid">Paid</TabsTrigger>
            </TabsList>
          </Tabs>


          <div className="mt-4">
            {renderContent(paginatedProperties)}
          </div>

        </div>
      </TooltipProvider>

      {profile.role !== 'Agent' && (
        <div className={cn('fixed bottom-24 right-4 md:bottom-8 md:right-8 z-50 transition-opacity', isMoreMenuOpen && 'opacity-0 pointer-events-none')}>
          <Popover open={isAddMenuOpen} onOpenChange={setIsAddMenuOpen}>
            <PopoverTrigger asChild>
              <Button onClick={() => user && !user.emailVerified && handleOpenAddDialog('For Sale')} className="rounded-full w-14 h-14 shadow-lg glowing-btn" size="icon">
                <PlusCircle className="h-6 w-6" />
                <span className="sr-only">Add Property</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-40 p-2 mb-2">
              <div className="flex flex-col gap-2">
                <Button variant="ghost" onClick={() => { handleOpenAddDialog('For Sale'); setIsAddMenuOpen(false); }}>For Sale</Button>
                <Button variant="ghost" onClick={() => { handleOpenAddDialog('For Rent'); setIsAddMenuOpen(false); }}>For Rent</Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}

      <AddPropertyDialog
        isOpen={isAddPropertyOpen}
        setIsOpen={setIsAddPropertyOpen}
        propertyToEdit={propertyToEdit}
        allProperties={allProperties || []}
        onSave={handleSaveProperty}
        listingType={listingType}
        limitReached={isLimitReached}
      />

      {appointmentDetails && (
        <SetAppointmentDialog
          isOpen={isAppointmentOpen}
          setIsOpen={setIsAppointmentOpen}
          onSave={handleSaveAppointment}
          appointmentDetails={appointmentDetails}
        />
      )}

      {propertyForDetails && (
        <>
          <PropertyDetailsDialog property={propertyForDetails} isOpen={isDetailsOpen} setIsOpen={setIsDetailsOpen} />
          <MarkAsSoldDialog property={propertyForDetails} isOpen={isSoldOpen} setIsOpen={setIsSoldOpen} onUpdateProperty={handleUpdateProperty} />
          <MarkAsRentOutDialog property={propertyForDetails} isOpen={isRentOutOpen} setIsOpen={setIsRentOutOpen} onUpdateProperty={handleUpdateProperty} />
          <RecordVideoDialog property={propertyForDetails} isOpen={isRecordVideoOpen} setIsOpen={setIsRecordVideoOpen} onUpdateProperty={handleUpdateProperty} />
        </>
      )}

      {assignmentDetails && (
        <SetRecordingPaymentDialog
          isOpen={isPaymentDialogOpen}
          setIsOpen={setIsPaymentDialogOpen}
          property={assignmentDetails.property}
          agentId={assignmentDetails.agentId}
          agentName={assignmentDetails.agentName}
          onConfirm={handleConfirmPaymentAndAssign}
        />
      )}

      <AlertDialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Choose Export Type</AlertDialogTitle>
            <AlertDialogDescription>
              Select which type of properties you would like to export to a CSV file.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleExport('For Sale')}>Export Sale Properties</AlertDialogAction>
            <AlertDialogAction onClick={() => handleExport('For Rent')}>Export Rent Properties</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Choose Import Type</AlertDialogTitle>
            <AlertDialogDescription>
              Select the type of properties you are importing from a CSV file.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleImportClick('For Sale')}>Import Sale Properties</AlertDialogAction>
            <AlertDialogAction onClick={() => handleImportClick('For Rent')}>Import Rent Properties</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  );
}
