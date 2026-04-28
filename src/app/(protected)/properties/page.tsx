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
const AGENT_LEAD_LIMIT = Infinity;

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
  area: string[];
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
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isSoldOpen, setIsSoldOpen] = useState(false);
  const [isRentOutOpen, setIsRentOutOpen] = useState(false);
  const [isRecordVideoOpen, setIsRecordVideoOpen] = useState(false);
  const [isAddPropertyOpen, setIsAddPropertyOpen] = useState(false);
  const [isAppointmentOpen, setIsAppointmentOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [assignmentDetails, setAssignmentDetails] = useState<{ property: Property, agentId: string, agentName: string } | null>(null);

  const [appointmentDetails, setAppointmentDetails] = useState<{
    contactType: AppointmentContactType;
    contactName: string;
    contactSerialNo?: string;
    message: string;
  } | null>(null);
  const [propertyToEdit, setPropertyToEdit] = useState<Property | null>(null);
  const [filters, setFilters] = useState<Filters>({
    area: [],
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
  const [areaSearch, setAreaSearch] = useState('');
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

  const handleFilterChange = (key: keyof Filters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      area: [],
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
    setAreaSearch('');
  };

  const handleAssignUser = async (property: Property, agentId: string | null) => {
    if (!profile.agency_id) return;
    const member = activeTeamMembers.find(m => m.id === agentId);
    if (!member) {
      await updateDoc(doc(firestore, 'agencies', profile.agency_id, 'properties', property.id), { assignedTo: null });
      toast({ title: 'Property Unassigned' });
      return;
    }
    if (member.role === 'Video Recorder') {
      setAssignmentDetails({ property, agentId: member.id, agentName: member.name });
      setIsPaymentDialogOpen(true);
    } else {
      await assignToAgent(property, member.id, member.name);
    }
  };

  const assignToAgent = async (property: Property, agentId: string, agentName: string) => {
    if (!profile.agency_id) return;
    await updateDoc(doc(firestore, 'agencies', profile.agency_id, 'properties', property.id), { assignedTo: agentId });
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
    toast({ title: 'Properties Assigned', description: `${selectedProperties.length} properties have been assigned to ${agent.name}.` });
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
    if (searchQuery) {
      const lowercasedQuery = searchQuery.toLowerCase();
      const numericQuery = searchQuery.replace(/\D/g, '');
      baseProperties = baseProperties.filter((prop) =>
        (prop.auto_title && prop.auto_title.toLowerCase().includes(lowercasedQuery)) ||
        prop.address.toLowerCase().includes(lowercasedQuery) ||
        prop.area.toLowerCase().includes(lowercasedQuery) ||
        prop.serial_no.toLowerCase().includes(lowercasedQuery) ||
        (prop.owner_number && prop.owner_number.replace(/\D/g, '').includes(numericQuery)) ||
        (prop.video_links && Object.values(prop.video_links).some(link => link && link.includes(searchQuery)))
      );
    }
    if (filters.area.length > 0) {
      baseProperties = baseProperties.filter((p) => filters.area.includes(p.area));
    }
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
    const currentStatusFilter = statusFilterFromURL || 'All (Sale)';
    switch (currentStatusFilter) {
      case 'All (Sale)': baseProperties = baseProperties.filter(p => !p.is_for_rent); break;
      case 'Pending': baseProperties = baseProperties.filter(p => p.status === 'Pending'); break;
      case 'Available (Sale)': baseProperties = baseProperties.filter(p => p.status === 'Available' && !p.is_for_rent); break;
      case 'Sold': baseProperties = baseProperties.filter(p => p.status === 'Sold' && !p.is_for_rent); break;
      case 'Sold (External)': baseProperties = baseProperties.filter(p => p.status === 'Sold (External)'); break;
      case 'All (Rent)': baseProperties = baseProperties.filter(p => p.is_for_rent); break;
      case 'Available (Rent)': baseProperties = baseProperties.filter(p => p.status === 'Available' && p.is_for_rent); break;
      case 'Rent Out': baseProperties = baseProperties.filter(p => p.status === 'Rent Out'); break;
      case 'Recorded': baseProperties = baseProperties.filter(p => p.is_recorded || p.recording_payment_status === 'Paid Online'); break;
      default: baseProperties = baseProperties.filter(p => !p.is_for_rent); break;
    }
    return baseProperties.sort((a, b) => {
      const aNum = parseInt(a.serial_no.split('-')[1] || '0', 10);
      const bNum = parseInt(b.serial_no.split('-')[1] || '0', 10);
      return sortOrder === 'asc' ? aNum - bNum : bNum - aNum;
    });
  }, [searchQuery, filters, allProperties, statusFilterFromURL, profile.role, user?.uid, sortOrder, activeAgencyTab]);

  const totalPages = Math.ceil(filteredProperties.length / ITEMS_PER_PAGE);
  const paginatedProperties = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProperties.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredProperties, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedProperties([]);
  }, [searchQuery, filters, statusFilterFromURL, activeAgencyTab]);

  const handleRowClick = (prop: Property) => {
    setPropertyForDetails(prop);
    setIsDetailsOpen(true);
  };

  const handleOpenAddDialog = (type: ListingType) => {
    if (user && !user.emailVerified) {
      toast({ title: 'Email Verification Required', description: 'Please verify your email address to add new properties.', variant: 'destructive' });
      return;
    }
    if (isLimitReached) {
      toast({ title: isAgent ? "Personal Lead Limit Reached" : "Property Limit Reached", description: `You have reached your limit of ${limit} properties.`, variant: "destructive" });
      return;
    }
    setListingType(type);
    setPropertyToEdit(null);
    setIsAddPropertyOpen(true);
  };

  const handleMarkAsSold = (prop: Property) => { setPropertyForDetails(prop); setIsSoldOpen(true); };
  const handleMarkAsRentOut = (prop: Property) => { setPropertyForDetails(prop); setIsRentOutOpen(true); };
  const handleRecordVideo = (prop: Property) => { setPropertyForDetails(prop); setIsRecordVideoOpen(true); };
  const handleEdit = (prop: Property) => { setListingType(prop.is_for_rent ? 'For Rent' : 'For Sale'); setPropertyToEdit(prop); setIsAddPropertyOpen(true); };

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

  const handleUpdateProperty = async (updatedProperty: Property) => {
    if (!profile.agency_id) return;
    const docRef = doc(firestore, 'agencies', profile.agency_id, 'properties', updatedProperty.id);
    await updateDoc(docRef, { ...updatedProperty });
  };

  const handleMarkAsAvailableForRent = async (prop: Property) => {
    if (!profile.agency_id) return;
    const docRef = doc(firestore, 'agencies', profile.agency_id, 'properties', prop.id);
    await setDoc(docRef, { status: 'Available', rent_out_date: null, rented_by_agent_id: null }, { merge: true });
    toast({ title: 'Property Marked as Available for Rent' });
  };

  const handleMarkAsUnsold = async (prop: Property) => {
    if (!profile.agency_id) return;
    const docRef = doc(firestore, 'agencies', profile.agency_id, 'properties', prop.id);
    await setDoc(docRef, { status: 'Available', sold_price: null, sale_date: null }, { merge: true });
    toast({ title: 'Property Status Updated', description: `${prop.serial_no} marked as Available again.` });
  };

  const handleDelete = async (property: Property) => {
    if (!profile.agency_id) return;
    const docRef = doc(firestore, 'agencies', profile.agency_id, 'properties', property.id);
    await setDoc(docRef, { is_deleted: true }, { merge: true });
    toast({ title: 'Property Moved to Trash' });
  };

  const handleBulkDelete = async () => {
    if (selectedProperties.length === 0 || !profile.agency_id) return;
    const batch = writeBatch(firestore);
    selectedProperties.forEach(propId => {
      const docRef = doc(firestore, 'agencies', profile.agency_id, 'properties', propId);
      batch.update(docRef, { is_deleted: true });
    });
    await batch.commit();
    toast({ title: `${selectedProperties.length} Properties Moved to Trash` });
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
        await addDoc(collectionRef, { ...restOfData, created_by: profile.user_id, agency_id: profile.agency_id });
        toast({ title: 'Property Added' });
      }
    } catch (error) { toast({ title: "Save Failed", variant: 'destructive' }); }
    setPropertyToEdit(null);
  };

  const handleStatusChange = (status: string) => { router.push(`${pathname}?status=${encodeURIComponent(status)}`); };

  const handleExport = (type: 'For Sale' | 'For Rent') => {
    if (!allProperties || !user?.uid) return;
    const propertiesToExport = allProperties.filter(p => !p.is_deleted && (p.is_for_rent ? 'For Rent' : 'For Sale') === type);
    if (propertiesToExport.length === 0) { toast({ title: 'No Data', variant: 'destructive' }); return; }
    const csvContent = "data:text/csv;charset=utf-8,Sr No,Address,Area,Type,Demand\n" + propertiesToExport.map(p => `${p.serial_no},"${p.address}","${p.area}",${p.property_type},${p.demand_amount}`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `properties-${type.toLowerCase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsExportDialogOpen(false);
  };

  const handleImportClick = (type: 'For Sale' | 'For Rent') => { setImportType(type); importInputRef.current?.click(); setIsImportDialogOpen(false); };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !profile.agency_id) return;
    toast({ title: "Importing...", description: "File processing started." });
    if(importInputRef.current) importInputRef.current.value = '';
    setImportType(null);
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedProperties(checked ? paginatedProperties.map(p => p.id) : []);
  };

  const renderTable = (properties: Property[]) => {
    if (isAgencyLoading) return <p className="p-4 text-center">Loading properties...</p>;
    if (properties.length === 0) return <div className="text-center py-10 text-muted-foreground">No properties found.</div>;
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox checked={paginatedProperties.length > 0 && selectedProperties.length === paginatedProperties.length} onCheckedChange={(checked) => handleSelectAll(checked as boolean)} />
            </TableHead>
            <TableHead className="w-[350px]">
              <Button variant="ghost" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>Property <ArrowUpDown className="ml-2 h-4 w-4" /></Button>
            </TableHead>
            <TableHead>Type</TableHead><TableHead>Size</TableHead><TableHead>Demand</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {properties.map((prop, index) => (
            <motion.tr key={prop.id} className="hover:bg-accent/50 transition-colors cursor-pointer" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: index * 0.05 }} >
              <TableCell onClick={(e) => e.stopPropagation()}><Checkbox checked={selectedProperties.includes(prop.id)} onCheckedChange={(checked) => setSelectedProperties(prev => checked ? [...prev, prop.id] : prev.filter(id => id !== prop.id))} /></TableCell>
              <TableCell onClick={() => handleRowClick(prop)}>
                <div className="flex items-center gap-2 font-bold font-headline text-base">{prop.auto_title || `${prop.size_value} ${prop.size_unit} ${prop.property_type}`} {prop.is_recorded && <Video className="h-4 w-4 text-primary" />}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1"><Badge variant="default" className={cn('font-mono', prop.serial_no.startsWith('RP') ? 'bg-emerald-100 text-emerald-700' : 'bg-primary/20 text-primary')}>{prop.serial_no}</Badge><span className="truncate max-w-48">{prop.address}</span></div>
              </TableCell>
              <TableCell onClick={() => handleRowClick(prop)}>{prop.property_type}</TableCell>
              <TableCell onClick={() => handleRowClick(prop)}>{formatSize(prop.size_value, prop.size_unit)}</TableCell>
              <TableCell onClick={() => handleRowClick(prop)}>{formatDemand(prop.demand_amount, prop.demand_unit)}</TableCell>
              <TableCell onClick={() => handleRowClick(prop)}><Badge className={prop.status === 'Sold' ? 'bg-green-600' : 'bg-primary'}>{prop.status}</Badge></TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="rounded-full" onClick={(e) => e.stopPropagation()}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="glass-card">
                    <DropdownMenuItem onSelect={() => handleRowClick(prop)}><Eye />View Details</DropdownMenuItem>
                    <DropdownMenuItem onSelect={(e) => handleWhatsAppChat(e, prop)}><MessageSquare /> WhatsApp</DropdownMenuItem>
                    {profile.role !== 'Agent' && <DropdownMenuItem onSelect={() => handleEdit(prop)}><Edit />Edit</DropdownMenuItem>}
                    {profile.role !== 'Agent' && <DropdownMenuItem onSelect={() => handleDelete(prop)} className="text-destructive"><Trash2 />Delete</DropdownMenuItem>}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </motion.tr>
          ))}
        </TableBody>
      </Table>
    );
  };

  const renderCards = (properties: Property[]) => {
    return (
      <div className="space-y-4">
        {properties.map((prop, index) => (
          <motion.div key={prop.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: index * 0.05 }}>
            <Card>
              <CardHeader className="p-4 flex flex-row items-start justify-between">
                <div className="flex gap-2"><Checkbox checked={selectedProperties.includes(prop.id)} onCheckedChange={(checked) => setSelectedProperties(prev => checked ? [...prev, prop.id] : prev.filter(id => id !== prop.id))} /><div><CardTitle className="text-base">{prop.auto_title}</CardTitle><div className="text-xs text-muted-foreground mt-1">{prop.serial_no} • {prop.area}</div></div></div>
                <Badge>{prop.status}</Badge>
              </CardHeader>
              <CardFooter className="p-4 pt-0 flex justify-end"><Button variant="ghost" size="sm" onClick={() => handleRowClick(prop)}>View Details</Button></CardFooter>
            </Card>
          </motion.div>
        ))}
      </div>
    );
  };

  const renderPagination = () => (
    <div className="flex items-center justify-end space-x-2 py-4">
      <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
      <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /> Previous</Button>
      <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>Next <ChevronRight className="h-4 w-4" /></Button>
    </div>
  );

  const renderContent = (properties: Property[]) => {
    return (
      <div>
        {isMobile ? renderCards(properties) : <Card><CardContent className="p-0">{renderTable(properties)}</CardContent></Card>}
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
              <p className="text-muted-foreground">{profile.role === 'Agent' ? 'View your assigned properties.' : 'Manage your agency and personal properties.'}</p>
            </div>
            <div className="flex w-full md:w-auto items-center gap-2 flex-wrap">
              {isMobile && (
                <div className="flex w-full items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="outline" className="flex-1">{statusFilterFromURL || 'All (Sale)'} <ChevronDown className="ml-2 h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent>{propertyStatuses.map(status => <DropdownMenuItem key={status.value} onSelect={() => handleStatusChange(status.value)}>{status.label}</DropdownMenuItem>)}</DropdownMenuContent>
                  </DropdownMenu>
                  <div className="flex items-center space-x-2"><Checkbox checked={paginatedProperties.length > 0 && selectedProperties.length === paginatedProperties.length} onCheckedChange={(checked) => handleSelectAll(checked as boolean)} /><Label className="text-sm">All</Label></div>
                </div>
              )}
              {selectedProperties.length > 0 && profile.role !== 'Agent' && (
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="outline" className="rounded-full"><UserPlus className="mr-2 h-4 w-4" /> Assign</Button></DropdownMenuTrigger>
                    <DropdownMenuContent>{activeTeamMembers.map((member) => <DropdownMenuItem key={member.id} onSelect={() => handleBulkAssign(member.id)}>{member.name}</DropdownMenuItem>)}</DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="destructive" className="rounded-full" onClick={handleBulkDelete}><Trash2 className="mr-2 h-4 w-4" /> Delete ({selectedProperties.length})</Button>
                </div>
              )}
              {profile.role !== 'Agent' && (
                <>
                  <AlertDialog open={isFilterPopoverOpen} onOpenChange={setIsFilterPopoverOpen}>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="rounded-full"><Filter className="mr-2 h-4 w-4" /> Filters {filters.area.length > 0 && `(${filters.area.length})`}</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="max-w-md glass-card">
                      <AlertDialogHeader><AlertDialogTitle>Refine Property Search</AlertDialogTitle></AlertDialogHeader>
                      <div className="grid gap-4 py-4">
                        {/* 1. SERIAL NO */}
                        <div className="grid grid-cols-3 items-center gap-4">
                          <Label>Serial No</Label>
                          <div className="col-span-2 grid grid-cols-2 gap-2">
                            <Select value={filters.serialNoPrefix} onValueChange={(v: any) => handleFilterChange('serialNoPrefix', v)}>
                              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                              <SelectContent><SelectItem value="All">All</SelectItem><SelectItem value="P">P</SelectItem><SelectItem value="RP">RP</SelectItem></SelectContent>
                            </Select>
                            <Input placeholder="e.g. 1" type="number" value={filters.serialNo} onChange={e => handleFilterChange('serialNo', e.target.value)} className="h-8" />
                          </div>
                        </div>

                        {/* 2. AREA MULTI-SELECT (EXCEL STYLE) */}
                        <div className="grid grid-cols-3 items-center gap-4">
                          <Label>Area</Label>
                          <div className="col-span-2">
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-between font-normal h-8">
                                  {filters.area.length > 0 ? `${filters.area.length} Selected` : "Select Areas"}
                                  <ChevronDown className="h-4 w-4 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="p-0 w-[280px] shadow-2xl" align="start">
                                <div className="p-2 border-b bg-muted/30">
                                  <Input placeholder="Search area..." className="h-8" value={areaSearch} onChange={(e) => setAreaSearch(e.target.value)} />
                                </div>
                                <div className="max-h-[250px] overflow-y-auto p-2">
                                  {Array.from(new Set((allProperties || []).map(p => p.area))).filter(Boolean)
                                    .filter(a => a.toLowerCase().includes(areaSearch.toLowerCase())).sort().map((areaName) => (
                                      <div key={areaName} className="flex items-center space-x-2 p-2 hover:bg-accent rounded-md cursor-pointer">
                                        <Checkbox id={`area-${areaName}`} checked={filters.area.includes(areaName)} onCheckedChange={(c) => {
                                            const next = c ? [...filters.area, areaName] : filters.area.filter(a => a !== areaName);
                                            handleFilterChange('area', next);
                                          }} />
                                        <label htmlFor={`area-${areaName}`} className="text-sm flex-1 cursor-pointer">{areaName}</label>
                                      </div>
                                    ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                        </div>

                        {/* 3. TYPE */}
                        <div className="grid grid-cols-3 items-center gap-4">
                          <Label>Type</Label>
                          <Select value={filters.propertyType} onValueChange={(v) => handleFilterChange('propertyType', v)}>
                            <SelectTrigger className="col-span-2 h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>{propertyTypesForFilter.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>

                        {/* 4. SIZE */}
                        <div className="grid grid-cols-3 items-center gap-4">
                          <Label>Size</Label>
                          <div className="col-span-2 grid grid-cols-2 gap-2">
                            <Input placeholder="Min" type="number" value={filters.minSize} onChange={e => handleFilterChange('minSize', e.target.value)} className="h-8" />
                            <Input placeholder="Max" type="number" value={filters.maxSize} onChange={e => handleFilterChange('maxSize', e.target.value)} className="h-8" />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 items-center gap-4">
                          <Label></Label>
                          <div className="col-span-2">
                            <Select value={filters.sizeUnit} onValueChange={(v: any) => handleFilterChange('sizeUnit', v)}>
                              <SelectTrigger className="h-8"><SelectValue placeholder="Unit" /></SelectTrigger>
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

                        {/* 5. DEMAND */}
                        <div className="grid grid-cols-3 items-center gap-4">
                          <Label>Demand</Label>
                          <div className="col-span-2 grid grid-cols-2 gap-2">
                            <Input placeholder="Min" type="number" value={filters.minDemand} onChange={e => handleFilterChange('minDemand', e.target.value)} className="h-8" />
                            <Input placeholder="Max" type="number" value={filters.maxDemand} onChange={e => handleFilterChange('maxDemand', e.target.value)} className="h-8" />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 items-center gap-4">
                          <Label></Label>
                          <div className="col-span-2">
                            <Select value={filters.demandUnit} onValueChange={(v: any) => handleFilterChange('demandUnit', v)}>
                              <SelectTrigger className="h-8"><SelectValue placeholder="Unit" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="All">All Units</SelectItem>
                                <SelectItem value="Lacs">Lacs</SelectItem>
                                <SelectItem value="Crore">Crore</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                      <AlertDialogFooter>
                        <Button variant="ghost" onClick={clearFilters}>Clear All</Button>
                        <AlertDialogAction onClick={() => setIsFilterPopoverOpen(false)}>Apply</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button variant="outline" className="rounded-full" onClick={() => setIsImportDialogOpen(true)}><Upload className="mr-2 h-4 w-4" /> Import</Button>
                  <input type="file" ref={importInputRef} className="hidden" accept=".csv" onChange={handleImport} />
                  <Button variant="outline" className="rounded-full" onClick={() => setIsExportDialogOpen(true)}><Download className="mr-2 h-4 w-4" /> Export</Button>
                </>
              )}
            </div>
          </div>

          {profile.role !== 'Agent' && (
            <Card><CardContent className="p-4">
              <div className="flex justify-between items-center mb-2"><span className="text-sm font-medium">Property Leads Usage</span><span className="text-sm font-bold">{currentCount} / {limit === Infinity ? 'Unlimited' : limit}</span></div>
              <Progress value={progress} />
            </CardContent></Card>
          )}

          <div className="mt-4">{renderContent(paginatedProperties)}</div>
        </div>
      </TooltipProvider>

      {profile.role !== 'Agent' && (
        <div className={cn('fixed bottom-24 right-4 md:bottom-8 md:right-8 z-50', isMoreMenuOpen && 'opacity-0')}>
          <Popover open={isAddMenuOpen} onOpenChange={setIsAddMenuOpen}>
            <PopoverTrigger asChild><Button className="rounded-full w-14 h-14 shadow-lg glowing-btn" size="icon"><PlusCircle className="h-6 w-6" /></Button></PopoverTrigger>
            <PopoverContent className="w-40 p-2 mb-2"><div className="flex flex-col gap-2"><Button variant="ghost" onClick={() => handleOpenAddDialog('For Sale')}>For Sale</Button><Button variant="ghost" onClick={() => handleOpenAddDialog('For Rent')}>For Rent</Button></div></PopoverContent>
          </Popover>
        </div>
      )}

      <AddPropertyDialog isOpen={isAddPropertyOpen} setIsOpen={setIsAddPropertyOpen} propertyToEdit={propertyToEdit} allProperties={allProperties || []} onSave={handleSaveProperty} listingType={listingType} limitReached={isLimitReached} />
      {propertyForDetails && (
        <>
          <PropertyDetailsDialog property={propertyForDetails} isOpen={isDetailsOpen} setIsOpen={setIsDetailsOpen} />
          <MarkAsSoldDialog property={propertyForDetails} isOpen={isSoldOpen} setIsOpen={setIsSoldOpen} onUpdateProperty={handleUpdateProperty} />
          <MarkAsRentOutDialog property={propertyForDetails} isOpen={isRentOutOpen} setIsOpen={setIsRentOutOpen} onUpdateProperty={handleUpdateProperty} />
          <RecordVideoDialog property={propertyForDetails} isOpen={isRecordVideoOpen} setIsOpen={setIsRecordVideoOpen} onUpdateProperty={handleUpdateProperty} />
        </>
      )}
      <AlertDialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Export Data</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleExport('For Sale')}>Export Sale</AlertDialogAction><AlertDialogAction onClick={() => handleExport('For Rent')}>Export Rent</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </>
  );
}
