
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
  CheckCircle,
  Eye,
  Filter,
  Search,
  MapPin,
  Tag,
  Wallet,
  PlusCircle,
  CalendarPlus,
  Briefcase,
  Home,
  Building,
  ArchiveRestore,
  PackagePlus,
  RotateCcw,
  ChevronDown,
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  ArrowUpDown,
  Link as LinkIcon,
  UserPlus,
  Sparkles,
  Ruler,
  MessageSquareText,
  UserMinus,
  User as UserIcon,
  Users,
  X,
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
import type { Property, PropertyType, SizeUnit, PriceUnit, AppointmentContactType, Appointment, ListingType, PlanName, PropertyStatus, User, Activity } from '@/lib/types';
import { useState, useMemo, useEffect, useRef } from 'react';
import { PropertyDetailsDialog } from '@/components/property-details-dialog';
import { MarkAsSoldDialog } from '@/components/mark-as-sold-dialog';
import { MarkAsRentOutDialog } from '@/components/mark-as-rent-out-dialog';

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
import { useSearch, useUI } from '@/context/layout-context';
import { SetAppointmentDialog } from '@/components/set-appointment-dialog';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/context/currency-context';
import { formatCurrency, formatUnit, formatPhoneNumberForWhatsApp } from '@/lib/formatters';
import { useProfile } from '@/context/profile-context';
import { useFirestore } from '@/firebase/provider';
import { collection, addDoc, setDoc, doc, writeBatch, updateDoc } from 'firebase/firestore';
import { useMemoFirebase } from '@/firebase/hooks';
import { cn, formatPhoneNumber } from '@/lib/utils';
import { PhoneValidationBadge } from '@/components/phone-validation-badge';
import { AddSalePropertyForm } from '@/components/add-sale-property-form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUser } from '@/firebase/auth/use-user';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { motion } from 'framer-motion';
import { useCollection } from '@/firebase/firestore/use-collection';

import { AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import type { Tag as TagType } from '@/lib/types';

const ManageTagsDialog = dynamic(() => import('@/components/manage-tags-dialog').then(mod => mod.ManageTagsDialog), { ssr: false });
const EditPropertyTagsDialog = dynamic(() => import('@/components/edit-property-tags-dialog').then(mod => mod.EditPropertyTagsDialog), { ssr: false });
const AssignPropertyToAgentDialog = dynamic(() => import('@/components/assign-property-to-agent-dialog').then(mod => mod.AssignPropertyToAgentDialog), { ssr: false });
const SimpleAssignPropertyAgentDialog = dynamic(() => import('@/components/simple-assign-property-agent-dialog').then(mod => mod.SimpleAssignPropertyAgentDialog), { ssr: false });
const PropertyNotesDialog = dynamic(() => import('@/components/property-notes-dialog').then(mod => mod.PropertyNotesDialog), { ssr: false });

const ITEMS_PER_PAGE = 50;
const AGENT_LEAD_LIMIT = Infinity; // Limit removed for agents

const planLimits = {
  Basic: { properties: 500, buyers: 500, team: 3 },
  Standard: { properties: 2500, buyers: 2500, team: 10 },
  Premium: { properties: Infinity, buyers: Infinity, team: Infinity },
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

const statusVariant = {
    'New': 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
    'Pending': 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
    'Available': 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
    'Sold': 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
    'Sold (External)': 'bg-slate-400 text-white border-slate-300 dark:bg-slate-600 dark:border-slate-500',
    'Rent Out': 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
} as const;

const propertyStatuses = [
  { value: 'All (Sale)', label: 'All (Sale)' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Available (Sale)', label: 'Available (Sale)' },
  { value: 'Sold', label: 'Sold' },
  { value: 'Sold (External)', label: 'Sold (External)' },
  { value: 'All (Rent)', label: 'All (Rent)' },
  { value: 'Available (Rent)', label: 'Available (Rent)' },
  { value: 'Rent Out', label: 'Rent Out' },
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
    if (statusFilterFromURL) setActiveStatus(statusFilterFromURL);
  }, [profile.agencies, activeAgencyTab, isMobile, profile.role, statusFilterFromURL]);



  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isEditTagsOpen, setIsEditTagsOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isSimpleAssignOpen, setIsSimpleAssignOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);

  const [isManageTagsOpen, setIsManageTagsOpen] = useState(false);
  const [activeListingType, setActiveListingType] = useState<'All' | 'For Sale' | 'For Rent'>('All');
  const [activeStatus, setActiveStatus] = useState<string>('All');
  const [activeCustomTags, setActiveCustomTags] = useState<string[]>([]);
  const [activeAgentFilter, setActiveAgentFilter] = useState<string>('All');
  const [isTypesExpanded, setIsTypesExpanded] = useState(false);
  const [isStatusExpanded, setIsStatusExpanded] = useState(false);
  const [isTagsExpanded, setIsTagsExpanded] = useState(false);

  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isSoldOpen, setIsSoldOpen] = useState(false);
  const [isRentOutOpen, setIsRentOutOpen] = useState(false);
  const [isAddPropertyOpen, setIsAddPropertyOpen] = useState(false);
  const [isAppointmentOpen, setIsAppointmentOpen] = useState(false);



  const [appointmentDetails, setAppointmentDetails] = useState<{
    contactType: AppointmentContactType;
    contactName: string;
    contactSerialNo?: string;
    message: string;
  } | null>(null);
  const [propertyToEdit, setPropertyToEdit] = useState<Property | null>(null);
  const tagsQuery = useMemoFirebase(() =>
    profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'tags') : null,
    [profile.agency_id, firestore]
  );
  const { data: allAgencyTags } = useCollection<TagType>(tagsQuery);

  const agencyTags = useMemo(() => {
    if (!allAgencyTags) return [];
    if (profile.role === 'Agent') {
      return allAgencyTags.filter(t => t.createdBy === profile.user_id);
    }
    return allAgencyTags;
  }, [allAgencyTags, profile.role, profile.user_id]);

  const allAreas = useMemo(() => {
    if (!allProperties) return [];
    const areas = new Set<string>();
    allProperties.forEach((p) => { if (p.area) areas.add(p.area); });
    return Array.from(areas).sort((a, b) => a.localeCompare(b));
  }, [allProperties]);

  const [areaSearch, setAreaSearch] = useState('');

  const filteredAreas = useMemo(() => {
    return allAreas.filter(a => a.toLowerCase().includes(areaSearch.toLowerCase()));
  }, [allAreas, areaSearch]);

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
  const nonDeletedCount = allProperties?.filter(p => !p.is_deleted).length || 0;
  const currentCount = isAgent ? myLeadsCount : nonDeletedCount;
  const progress = limit === Infinity ? 100 : (currentCount / limit) * 100;
  const isLimitReached = currentCount >= limit;

  const activeTeamMembers = useMemo(() => {
    return teamMembers?.filter(m => m.status === 'Active') || [];
  }, [teamMembers]);

  const activeAgents = useMemo(() => {
    return activeTeamMembers?.filter(m => m.role === 'Agent' || m.role === 'Admin') || [];
  }, [activeTeamMembers]);

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
    setIsFilterPopoverOpen(false);
  };

  const handleAssignUser = async (property: Property, agentId: string | null) => {
    if (!profile.agency_id) return;

    const member = activeTeamMembers.find(m => m.id === agentId);
    if (!member) {
      await updateDoc(doc(firestore, 'agencies', profile.agency_id, 'properties', property.id), { assignedTo: null });
      toast({ title: 'Property Unassigned' });
      return;
    }

    await assignToAgent(property, member.id, member.name);
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


  const handleBulkAssign = async (agentId: string) => {
    if (selectedProperties.length === 0 || !agentId || !profile.agency_id) return;

    const agent = activeTeamMembers.find(m => m.id === agentId);
    if (!agent) {
      toast({ title: 'Agent not found', variant: 'destructive' });
      return;
    }

    const batch = writeBatch(firestore);
    const updates: Partial<Property> = { assignedTo: agentId };

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

  const filteredProperties = useMemo(() => {
    if (!allProperties) return [];

    let baseProperties = allProperties.filter(p => !p.is_deleted);

    if (profile.role === 'Agent' && user?.uid && activeAgencyTab) {
      baseProperties = baseProperties.filter(p => (p.assignedTo === user.uid || p.created_by === user.uid) && p.agency_id === activeAgencyTab);
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
    if (filters.area.length > 0) baseProperties = baseProperties.filter((p) => filters.area.includes(p.area));

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


    // 3. Final Filter: URL Status Param (only when no badge filters active)
    if (activeListingType === 'All' && activeStatus === 'All') {
      const currentStatusFilter = statusFilterFromURL || 'All (Sale)';
      switch (currentStatusFilter) {
        case 'All (Sale)':
          baseProperties = baseProperties.filter(p => !p.is_for_rent);
          break;
        case 'Pending':
          baseProperties = baseProperties.filter(p => p.status === 'Pending' || p.tags?.includes('Pending'));
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
        default:
          baseProperties = baseProperties.filter(p => !p.is_for_rent);
          break;
      }
    }

    // 4. Tag Filter
    if (activeCustomTags.length > 0) {
      baseProperties = baseProperties.filter(p =>
        p.tags && activeCustomTags.some(tag => p.tags!.includes(tag))
      );
    }

    // 5. Listing Type Filter (badge)
    if (activeListingType !== 'All') {
      baseProperties = baseProperties.filter(p =>
        activeListingType === 'For Rent' ? p.is_for_rent : !p.is_for_rent
      );
    }

    // 6. Status Filter (badge) — checks both status field AND tags
    if (activeStatus !== 'All') {
      baseProperties = baseProperties.filter(p => p.status === activeStatus || p.tags?.includes(activeStatus));
    }

    // 7. Agent Filter
    if (activeAgentFilter !== 'All') {
      baseProperties = baseProperties.filter(p => p.assignedTo === activeAgentFilter);
    }

    // 8. Sorting
    return baseProperties.sort((a, b) => {
      const aNum = parseInt(a.serial_no.split('-')[1] || '0', 10);
      const bNum = parseInt(b.serial_no.split('-')[1] || '0', 10);
      return sortOrder === 'asc' ? aNum - bNum : bNum - aNum;
    });

  }, [searchQuery, filters, allProperties, statusFilterFromURL, profile.role, user?.uid, sortOrder, activeAgencyTab, activeListingType, activeStatus, activeCustomTags, activeAgentFilter]);

  const nonDeletedProperties = useMemo(() => {
    if (!allProperties) return [];
    const seen = new Set();
    return allProperties.filter(p => {
      if (p.is_deleted || seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [allProperties]);

  const allPropertyCounts = useMemo(() => {
    const props = nonDeletedProperties;
    const counts: Record<string, number> = { 'All': props.length, 'For Sale': 0, 'For Rent': 0 };
    props.forEach(p => {
      if (p.is_for_rent) counts['For Rent']++;
      else counts['For Sale']++;
      const s = p.status;
      counts[s] = (counts[s] || 0) + 1;
      if (p.tags) p.tags.forEach(t => { counts[t] = (counts[t] || 0) + 1; });
    });
    return counts;
  }, [nonDeletedProperties]);

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

  const handleEditTags = (prop: Property) => {
    setPropertyForDetails(prop);
    setIsEditTagsOpen(true);
  };

  const handleAssignOpen = (prop: Property) => {
    setPropertyForDetails(prop);
    setIsAssignOpen(true);
  };

  const handleSimpleAssignOpen = (prop: Property) => {
    setPropertyForDetails(prop);
    setIsSimpleAssignOpen(true);
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

  const getTagColor = (tagName: string) => {
    const tagObj = agencyTags?.find(t => t.name === tagName);
    if (tagObj) return tagObj.color;
    return (statusVariant as any)[tagName] || 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
  };

  const handleNotesClick = (prop: Property) => {
    setPropertyForDetails(prop);
    setIsNotesOpen(true);
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

  const handleToggleCustomTag = (tagName: string) => {
    setActiveCustomTags(prev =>
      prev.includes(tagName) ? prev.filter(t => t !== tagName) : [...prev, tagName]
    );
  };

  const handleStatusChange = (status: string) => {
    setActiveStatus(status);
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

  const smartCleanValue = (val: string | undefined): string => {
    if (!val || val.trim() === '') return '';
    let cleaned = val.trim();
    // Handle Excel ="..." format
    if (cleaned.startsWith('=')) {
      const match = cleaned.match(/="(.+?)"/);
      if (match) return match[1].trim();
    }
    // Handle Excel scientific notation for numbers
    if (/^\d*\.?\d+E[+-]\d+$/i.test(cleaned)) {
      const parsed = parseFloat(cleaned);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed.toString();
      }
    }
    return cleaned;
  };

  const buildColumnMap = (headers: string[]): Record<string, number> => {
    const aliases: Record<string, string[]> = {
      number: ['number', 'phone', 'mobile', 'contact', 'phone number', 'owner phone', 'owner number', 'cell', 'tel', 'telephone'],
      serial: ['sr no', 'serial', 'serial no', 's.no', 'sr#', 'id', 's no', 'sno'],
      date: ['date', 'created date', 'created at', 'timestamp', 'entry date'],
      city: ['city', 'location', 'sector'],
      area: ['area', 'society', 'phase', 'sector area', 'locality'],
      address: ['address', 'full address', 'location address', 'street address'],
      property_type: ['property type', 'type', 'property type', 'prop type', 'type of property', 'category'],
      size: ['size', 'area size', 'lot size', 'plot size', 'land size', 'dimensions'],
      storey: ['storey', 'floor', 'story', 'levels', 'floors'],
      utilities: ['utilities', 'meters', 'amenities', 'utility'],
      status: ['status', 'property status', 'listing status'],
      road_size: ['road size', 'road', 'road width', 'road size ft', 'road_size_ft'],
      potential_rent: ['potential rent', 'rent potential', 'expected rent', 'potential rent', 'rent'],
      front: ['front', 'front ft', 'frontage', 'front_ft'],
      length: ['length', 'depth', 'length ft', 'length_ft'],
      demand: ['demand', 'price', 'asking price', 'expected price', 'amount', 'cost', 'value', 'total demand'],
      documents: ['documents', 'docs', 'papers', 'document'],
      video_recorded: ['video recorded', 'video', 'recorded', 'video record'],
      tiktok: ['tiktok', 'tiktok link', 'tiktok url'],
      youtube: ['youtube', 'youtube link', 'youtube url'],
      instagram: ['instagram', 'instagram link', 'instagram url'],
      facebook: ['facebook', 'facebook link', 'facebook url'],
      other: ['other', 'other link', 'other url', 'website'],
    };

    const map: Record<string, number> = {};
    headers.forEach((h, idx) => {
      const key = h.toLowerCase().trim();
      for (const [field, fieldAliases] of Object.entries(aliases)) {
        if (fieldAliases.includes(key)) {
          map[field] = idx;
          break;
        }
      }
    });
    return map;
  };

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
            <TableHead>Status / Tags</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {properties.map((prop, index) => {
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
                    {prop.owner_number && <PhoneValidationBadge phone={prop.owner_number} />}
                    <span className="truncate max-w-48">{prop.address}</span>
                  </div>
                </TableCell>
                <TableCell onClick={() => handleRowClick(prop)}>{prop.property_type}</TableCell>
                <TableCell onClick={() => handleRowClick(prop)}>{formatSize(prop.size_value, prop.size_unit)}</TableCell>
                <TableCell onClick={() => handleRowClick(prop)}>{formatDemand(prop.demand_amount, prop.demand_unit)}</TableCell>
                <TableCell onClick={() => handleRowClick(prop)}>
                  <div className="flex flex-col gap-1 items-start">
                    <div className="flex items-center gap-2">
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
                    <DropdownMenuContent align="end" className="bg-background w-52">
                      <DropdownMenuItem onSelect={(e) => { e.stopPropagation(); handleRowClick(prop); }}><Eye className="mr-2 h-4 w-4" /> View Details</DropdownMenuItem>
                      <DropdownMenuItem onSelect={(e) => { e.stopPropagation(); handleWhatsAppChat(e as unknown as React.MouseEvent, prop); }}><MessageSquare className="mr-2 h-4 w-4" /> WhatsApp Chat</DropdownMenuItem>
                      <DropdownMenuItem onSelect={(e) => { e.stopPropagation(); handleSetAppointment(prop); }}><CalendarPlus className="mr-2 h-4 w-4" /> Set Appointment</DropdownMenuItem>
                      <DropdownMenuItem onSelect={(e) => { e.stopPropagation(); handleNotesClick(prop); }}><MessageSquareText className="mr-2 h-4 w-4" /> Remarks</DropdownMenuItem>

                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={(e) => { e.stopPropagation(); handleEdit(prop); }}><Edit className="mr-2 h-4 w-4" /> Edit Details</DropdownMenuItem>

                      {prop.status === 'Available' && !prop.is_for_rent && (
                        <DropdownMenuItem onSelect={(e) => { e.stopPropagation(); handleMarkAsSold(prop); }}><CheckCircle className="mr-2 h-4 w-4" /> Mark as Sold</DropdownMenuItem>
                      )}
                      {prop.status === 'Available' && prop.is_for_rent && (
                        <DropdownMenuItem onSelect={(e) => { e.stopPropagation(); handleMarkAsRentOut(prop); }}><ArchiveRestore className="mr-2 h-4 w-4" /> Mark as Rent Out</DropdownMenuItem>
                      )}
                      {prop.status === 'Rent Out' && (
                        <DropdownMenuItem onSelect={(e) => { e.stopPropagation(); handleMarkAsAvailableForRent(prop); }}><RotateCcw className="mr-2 h-4 w-4" /> Mark as Available</DropdownMenuItem>
                      )}
                      {(prop.status === 'Sold' || prop.status === 'Sold (External)') && (
                        <DropdownMenuItem onSelect={(e) => { e.stopPropagation(); handleMarkAsUnsold(prop); }}><RotateCcw className="mr-2 h-4 w-4" /> Mark as Unsold</DropdownMenuItem>
                      )}

                      <DropdownMenuSeparator />

                      <DropdownMenuItem onSelect={(e) => { e.stopPropagation(); handleEditTags(prop); }}><Tag className="mr-2 h-4 w-4" /> Edit Tags</DropdownMenuItem>

                      <DropdownMenuSeparator />

                      {profile.role === 'Admin' && (
                        <>
                          <DropdownMenuItem onSelect={(e) => { e.stopPropagation(); handleSimpleAssignOpen(prop); }} className="font-bold text-primary"><UserPlus className="mr-2 h-4 w-4" /> Direct Assign Agent</DropdownMenuItem>
                          <DropdownMenuItem onSelect={(e) => { e.stopPropagation(); handleAssignOpen(prop); }}><Sparkles className="mr-2 h-4 w-4" /> Smart Assign (Buyers)</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={(e) => { e.stopPropagation(); handleDelete(prop); }} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                        </>
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

    return (
      <div className="space-y-4">
        {properties.map((prop, index) => {
          const hasUnreadNotes = prop.timeline_notes?.some(n => !n.readBy?.includes(profile.user_id));

          return (
            <motion.div
              key={prop.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <Card className="overflow-hidden border-l-4 border-l-primary/40 bg-background">
                <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between space-y-0">
                  <div className="flex gap-3">
                    <Checkbox
                      checked={selectedProperties.includes(prop.id)}
                      onClick={e => e.stopPropagation()}
                      onCheckedChange={(c) => setSelectedProperties(p => c ? [...p, prop.id] : p.filter(id => id !== prop.id))}
                    />
                    <div onClick={() => handleRowClick(prop)} className="cursor-pointer">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-bold font-headline">{prop.auto_title}</CardTitle>
                        {hasUnreadNotes && (
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          variant="default"
                          className={cn(
                            'font-mono text-[10px] bg-background',
                            prop.serial_no.startsWith('RP')
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                              : 'bg-primary/20 text-primary'
                          )}
                        >
                          {prop.serial_no}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{prop.area}</span>
                      </div>
                    </div>
                  </div>
                  <Badge className={cn("text-[9px] font-bold px-2", getTagColor(prop.status))}>
                    {prop.status}
                  </Badge>
                </CardHeader>
                <CardContent className="p-4 pt-0 cursor-pointer" onClick={() => handleRowClick(prop)}>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 mt-2">
                    <div className="flex items-center gap-1.5 text-xs">
                      <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">{prop.property_type}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">{formatSize(prop.size_value, prop.size_unit)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs col-span-2 mt-1">
                      <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-bold text-primary">{formatDemand(prop.demand_amount, prop.demand_unit)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Popover>
                      <PopoverTrigger asChild>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground italic cursor-pointer hover:text-primary transition-colors" onClick={e => e.stopPropagation()}>
                          <MapPin className="h-3 w-3" />
                          <span className="truncate max-w-[100px]">{prop.address || prop.area || 'No location'}</span>
                        </div>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-4 rounded-xl shadow-2xl border-none z-[110]" onClick={e => e.stopPropagation()}>
                        <div className="space-y-2">
                          <p className="text-[10px] font-black uppercase tracking-widest text-primary/60 flex items-center gap-2">
                            <MapPin className="h-3 w-3" /> Location
                          </p>
                          <p className="text-sm font-bold leading-relaxed text-foreground">{prop.address || prop.area || 'N/A'}</p>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="flex flex-wrap gap-1 mt-3">
                    {prop.tags?.filter(t => t !== prop.status).map(tagName => (
                      <Badge key={tagName} className={cn("text-[8px] px-1.5 py-0 font-bold", getTagColor(tagName))}>{tagName}</Badge>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="p-2 bg-muted/20 border-t justify-between items-center">
                  <Button variant="ghost" size="sm" className="h-8 gap-2 text-[10px] font-bold" onClick={() => handleNotesClick(prop)}>
                    <MessageSquareText className="h-3.5 w-3.5" />
                    Remarks
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button aria-haspopup="true" size="icon" variant="ghost" className="rounded-full" onClick={(e) => e.stopPropagation()}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-background w-52">
                      <DropdownMenuItem onSelect={(e) => { e.stopPropagation(); handleRowClick(prop); }}><Eye className="mr-2 h-4 w-4" /> View Details</DropdownMenuItem>
                      <DropdownMenuItem onSelect={(e) => { e.stopPropagation(); handleWhatsAppChat(e as unknown as React.MouseEvent, prop); }}><MessageSquare className="mr-2 h-4 w-4" /> WhatsApp Chat</DropdownMenuItem>
                      <DropdownMenuItem onSelect={(e) => { e.stopPropagation(); handleSetAppointment(prop); }}><CalendarPlus className="mr-2 h-4 w-4" /> Set Appointment</DropdownMenuItem>
                      <DropdownMenuItem onSelect={(e) => { e.stopPropagation(); handleNotesClick(prop); }}><MessageSquareText className="mr-2 h-4 w-4" /> Remarks</DropdownMenuItem>

                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={(e) => { e.stopPropagation(); handleEdit(prop); }}><Edit className="mr-2 h-4 w-4" /> Edit Details</DropdownMenuItem>

                      {prop.status === 'Available' && !prop.is_for_rent && (
                        <DropdownMenuItem onSelect={(e) => { e.stopPropagation(); handleMarkAsSold(prop); }}><CheckCircle className="mr-2 h-4 w-4" /> Mark as Sold</DropdownMenuItem>
                      )}
                      {prop.status === 'Available' && prop.is_for_rent && (
                        <DropdownMenuItem onSelect={(e) => { e.stopPropagation(); handleMarkAsRentOut(prop); }}><ArchiveRestore className="mr-2 h-4 w-4" /> Mark as Rent Out</DropdownMenuItem>
                      )}
                      {prop.status === 'Rent Out' && (
                        <DropdownMenuItem onSelect={(e) => { e.stopPropagation(); handleMarkAsAvailableForRent(prop); }}><RotateCcw className="mr-2 h-4 w-4" /> Mark as Available</DropdownMenuItem>
                      )}
                      {(prop.status === 'Sold' || prop.status === 'Sold (External)') && (
                        <DropdownMenuItem onSelect={(e) => { e.stopPropagation(); handleMarkAsUnsold(prop); }}><RotateCcw className="mr-2 h-4 w-4" /> Mark as Unsold</DropdownMenuItem>
                      )}

                      <DropdownMenuSeparator />

                      <DropdownMenuItem onSelect={(e) => { e.stopPropagation(); handleEditTags(prop); }}><Tag className="mr-2 h-4 w-4" /> Edit Tags</DropdownMenuItem>

                      <DropdownMenuSeparator />

                      {profile.role === 'Admin' && (
                        <>
                          <DropdownMenuItem onSelect={(e) => { e.stopPropagation(); handleSimpleAssignOpen(prop); }} className="font-bold text-primary"><UserPlus className="mr-2 h-4 w-4" /> Direct Assign Agent</DropdownMenuItem>
                          <DropdownMenuItem onSelect={(e) => { e.stopPropagation(); handleAssignOpen(prop); }}><Sparkles className="mr-2 h-4 w-4" /> Smart Assign (Buyers)</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={(e) => { e.stopPropagation(); handleDelete(prop); }} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
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
            <div className="flex w-full md:w-auto items-center gap-2 flex-wrap justify-end ml-auto">
              {isMobile && (
                <div className="flex items-center gap-2">
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
                        <UserPlus className="h-4 w-4" />
                        <span className="hidden md:inline ml-2">Assign to Agent</span>
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
                        <Trash2 className="h-4 w-4" />
                        <span className="hidden md:inline ml-2">Delete ({selectedProperties.length})</span>
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
              <>
                <Popover open={isFilterPopoverOpen} onOpenChange={setIsFilterPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="rounded-full"><Filter className="h-4 w-4" /><span className="hidden md:inline ml-2">Filters</span></Button>
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
                        <div className="grid grid-cols-3 items-start gap-4">
                          <Label className="mt-1">Area</Label>
                          <div className="col-span-2">
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full justify-between h-8 text-sm">
                                  {filters.area.length > 0 ? (
                                    <span className="font-medium text-primary">{filters.area.length} Area{filters.area.length > 1 ? 's' : ''} Selected</span>
                                  ) : (
                                    <span className="text-muted-foreground">Search Areas...</span>
                                  )}
                                  <ChevronDown className="h-4 w-4 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="p-0 w-[280px]" align="start">
                                <div className="p-2 border-b">
                                  <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                      placeholder="Search area..."
                                      className="h-9 pl-8 text-sm"
                                      value={areaSearch}
                                      onChange={(e) => setAreaSearch(e.target.value)}
                                    />
                                  </div>
                                </div>
                                <div className="p-1.5 border-b flex items-center justify-between">
                                  <span className="text-[10px] font-semibold uppercase text-muted-foreground px-1">Areas</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-[10px] font-semibold uppercase"
                                    onClick={() => {
                                      setFilters(prev => ({
                                        ...prev,
                                        area: prev.area.length === allAreas.length ? [] : [...allAreas],
                                      }))
                                    }}
                                  >
                                    {filters.area.length === allAreas.length ? 'Deselect All' : 'Select All'}
                                  </Button>
                                </div>
                                <ScrollArea className="max-h-[200px] p-1">
                                  {filteredAreas.length > 0 ? (
                                    <div className="space-y-0.5">
                                      {filteredAreas.map((areaName) => (
                                        <div
                                          key={areaName}
                                          className={cn(
                                            "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm",
                                            filters.area.includes(areaName) ? "bg-primary/5 text-primary" : "hover:bg-accent"
                                          )}
                                          onClick={() => {
                                            setFilters(prev => ({
                                              ...prev,
                                              area: prev.area.includes(areaName)
                                                ? prev.area.filter(a => a !== areaName)
                                                : [...prev.area, areaName],
                                            }))
                                          }}
                                        >
                                          <Checkbox
                                            checked={filters.area.includes(areaName)}
                                            className="pointer-events-none"
                                          />
                                          <span className="truncate">{areaName}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="py-8 text-center text-sm text-muted-foreground">No matching areas.</div>
                                  )}
                                </ScrollArea>
                                {filters.area.length > 0 && (
                                  <div className="p-1.5 border-t flex justify-between items-center">
                                    <span className="text-[10px] font-semibold uppercase text-muted-foreground px-1">{filters.area.length} Selected</span>
                                    <Button variant="ghost" size="sm" className="h-7 text-[10px] font-semibold uppercase" onClick={() => setFilters(prev => ({ ...prev, area: [] }))}>
                                      Clear All
                                    </Button>
                                  </div>
                                )}
                              </PopoverContent>
                            </Popover>
                          </div>
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

                <Button className="rounded-full glowing-btn px-3 md:px-6" onClick={() => { setListingType('For Sale'); setIsAddPropertyOpen(true); }}>
                  <PlusCircle className="h-4 w-4" />
                  <span className="hidden md:inline ml-2">Add Property</span>
                </Button>
              </>
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
                          onClick={() => { setActiveListingType('All'); setIsTypesExpanded(!isTypesExpanded); }}
                        >
                          All Types ({allPropertyCounts['All'] || 0}) {isTypesExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
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
                              <Badge variant={activeListingType === 'For Sale' ? 'default' : 'outline'} className={cn("cursor-pointer px-4 py-1.5 rounded-full bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800", activeListingType === 'For Sale' && "ring-2 ring-primary ring-offset-2")} onClick={() => setActiveListingType('For Sale')}>For Sale ({allPropertyCounts['For Sale'] || 0})</Badge>
                              <Badge variant={activeListingType === 'For Rent' ? 'default' : 'outline'} className={cn("cursor-pointer px-4 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800", activeListingType === 'For Rent' && "ring-2 ring-primary ring-offset-2")} onClick={() => setActiveListingType('For Rent')}>For Rent ({allPropertyCounts['For Rent'] || 0})</Badge>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <div className="flex items-center gap-2 pr-4 border-r border-border/50">
                        <Badge
                          variant={activeStatus === 'All' ? 'default' : 'outline'}
                          className={cn("cursor-pointer px-4 py-1.5 rounded-full flex items-center gap-1", activeStatus === 'All' ? "bg-primary" : "hover:bg-accent")}
                          onClick={() => { setActiveStatus('All'); setIsStatusExpanded(!isStatusExpanded); }}
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
                              {['Pending', 'Available', 'Sold', 'Sold (External)', 'Available (Rent)', 'Rent Out'].map(status => (
                                <Badge
                                  key={status}
                                  variant={activeStatus === status ? 'default' : 'outline'}
                                  className={cn("cursor-pointer px-4 py-1.5 rounded-full transition-all", activeStatus === status && "ring-2 ring-primary ring-offset-2")}
                                  onClick={() => setActiveStatus(status)}
                                >
                                  {status} ({allPropertyCounts[status] || 0})
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
                          onClick={() => { setActiveCustomTags([]); setIsTagsExpanded(!isTagsExpanded); }}
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
                                <Badge key={tag.id} variant={activeCustomTags.includes(tag.name) ? 'default' : 'outline'} className={cn("cursor-pointer px-4 py-1.5 rounded-full transition-all", tag.color, activeCustomTags.includes(tag.name) && "ring-2 ring-primary ring-offset-2")} onClick={() => handleToggleCustomTag(tag.name)}>{tag.name} ({allPropertyCounts[tag.name] || 0})</Badge>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                  <div className="pb-4">
                    <Button variant="ghost" size="sm" className="rounded-full h-8 w-8 p-0 text-primary hover:bg-primary/10 shadow-sm border border-primary/20" onClick={() => setIsManageTagsOpen(true)}>
                      <PlusCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

          {profile.role === 'Admin' && (
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
          )}

          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-muted-foreground">{isAgent ? "My Property Leads Usage" : "Property Leads Usage"}</span>
                <span className="text-sm font-bold">{currentCount} / {limit === Infinity ? 'Unlimited' : limit}</span>
              </div>
              <Progress value={progress} />
            </CardContent>
          </Card>

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

          <div className="mt-4">
            {renderContent(paginatedProperties)}
          </div>

        </div>
      </TooltipProvider>

      {isManageTagsOpen && (
        <ManageTagsDialog isOpen={isManageTagsOpen} setIsOpen={setIsManageTagsOpen} />
      )}

      {propertyForDetails && isEditTagsOpen && (
        <EditPropertyTagsDialog property={propertyForDetails} isOpen={isEditTagsOpen} setIsOpen={setIsEditTagsOpen} />
      )}

      {propertyForDetails && isAssignOpen && (
        <AssignPropertyToAgentDialog property={propertyForDetails} isOpen={isAssignOpen} setIsOpen={setIsAssignOpen} />
      )}

      {propertyForDetails && isSimpleAssignOpen && (
        <SimpleAssignPropertyAgentDialog property={propertyForDetails} isOpen={isSimpleAssignOpen} setIsOpen={setIsSimpleAssignOpen} teamMembers={activeTeamMembers} />
      )}

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
          <PropertyNotesDialog property={propertyForDetails} isOpen={isNotesOpen} setIsOpen={setIsNotesOpen} />
        </>
      )}

    </>
  );
}
