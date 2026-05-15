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
  Eye,
  Filter,
  Search,
  Tag as TagIcon,
  PlusCircle,
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  ArrowUpDown,
  UserPlus,
  ChevronDown,
  Building,
  Ruler,
  Wallet,
  CalendarPlus,
  Share2,
  Check,
  MessageSquareText,
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
} from '@/components/ui/dropdown-menu';
import { AddPropertyDialog } from '@/components/add-property-dialog';
import { Input } from '@/components/ui/input';
import type { Property, PropertyType, SizeUnit, PriceUnit, ListingType, User, Activity, Tag, Appointment } from '@/lib/types';
import { useState, useMemo, useEffect, Suspense } from 'react';
import { PropertyDetailsDialog } from '@/components/property-details-dialog';
import { MarkAsSoldDialog } from '@/components/mark-as-sold-dialog';
import { MarkAsRentOutDialog } from '@/components/mark-as-rent-out-dialog';
import { RecordVideoDialog } from '@/components/record-video-dialog';
import { Card, CardHeader, CardTitle, CardFooter, CardContent } from '@/components/ui/card';
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
import { TooltipProvider } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { useRouter } from 'next/navigation';
import { useSearch } from '../layout';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatUnit, formatPhoneNumberForWhatsApp } from '@/lib/formatters';
import { useCurrency } from '@/context/currency-context';
import { useProfile } from '@/context/profile-context';
import { useFirestore } from '@/firebase/provider';
import { collection, addDoc, setDoc, doc, writeBatch, updateDoc, query, where, or, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useMemoFirebase } from '@/firebase/hooks';
import { cn } from '@/lib/utils';
import { useUser } from '@/firebase/auth/use-user';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { motion, AnimatePresence } from 'framer-motion';
import { useCollection } from '@/firebase/firestore/use-collection';
import { ManageTagsDialog } from '@/components/manage-tags-dialog';
import { EditPropertyTagsDialog } from '@/components/edit-property-tags-dialog';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { SetAppointmentDialog } from '@/components/set-appointment-dialog';
import { SharePropertyDialog } from '@/components/share-property-dialog';
import { PropertyNotesDialog } from '@/components/property-notes-dialog';

const ITEMS_PER_PAGE = 50;

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

const statusOptions = [
  { value: 'Available', label: 'Available', color: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800', listing: 'All' },
  { value: 'Sold', label: 'Sold', color: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800', listing: 'For Sale' },
  { value: 'Rent Out', label: 'Rent Out', color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800', listing: 'For Rent' },
];

const statusVariant = {
  'Available': 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
  'Sold': 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
  'Rent Out': 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
  'Sold (External)': 'bg-slate-400 text-white border-slate-300 dark:bg-slate-600 dark:border-slate-500'
} as const;

const propertyTypesForFilter: (PropertyType | 'All' | 'Other')[] = [
  'All', 'House', 'Flat', 'Farm House', 'Penthouse', 'Plot', 'Residential Plot', 'Commercial Plot', 'Agricultural Land', 'Industrial Land', 'Office', 'Shop', 'Warehouse', 'Factory', 'Building', 'Residential Property', 'Commercial Property', 'Semi Commercial', 'Other'
];

function PropertiesPageContent() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const { user } = useUser();
  const { profile } = useProfile();
  const { searchQuery } = useSearch();
  const { toast } = useToast();
  const { currency } = useCurrency();
  const firestore = useFirestore();

  const agencyPropertiesQuery = useMemoFirebase(
    () => {
        if(!profile.agency_id) return null;
        const ref = collection(firestore, 'agencies', profile.agency_id, 'properties');
        if(profile.role === 'Agent' && user?.uid) {
            return query(ref, or(where('created_by', '==', user.uid), where('assignedTo', 'array-contains', user.uid)));
        }
        return ref;
    },
    [profile.agency_id, firestore, profile.role, user?.uid]
  );
  const { data: allProperties, isLoading: isAgencyLoading } = useCollection<Property>(agencyPropertiesQuery);

  const teamMembersQuery = useMemoFirebase(() => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'teamMembers') : null, [profile.agency_id, firestore]);
  const { data: teamMembers } = useCollection<User>(teamMembersQuery);

  const tagsQuery = useMemoFirebase(() => 
    profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'tags') : null,
    [profile.agency_id, firestore]
  );
  const { data: agencyTags } = useCollection<Tag>(tagsQuery);

  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isSoldOpen, setIsSoldOpen] = useState(false);
  const [isRentOutOpen, setIsRentOutOpen] = useState(false);
  const [isRecordVideoOpen, setIsRecordVideoOpen] = useState(false);
  const [isAddPropertyOpen, setIsAddPropertyOpen] = useState(false);
  const [isManageTagsOpen, setIsManageTagsOpen] = useState(false);
  const [isEditTagsOpen, setIsEditTagsOpen] = useState(false);
  const [isAppointmentOpen, setIsAppointmentOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);

  const [activeListingType, setActiveListingType] = useState<ListingType | 'All'>('All');
  const [activeStatus, setActiveStatus] = useState<string>('All');
  const [activeCustomTags, setActiveCustomTags] = useState<string[]>([]);

  const [isTypesExpanded, setIsTypesExpanded] = useState(false);
  const [isStatusExpanded, setIsStatusExpanded] = useState(false);
  const [isTagsExpanded, setIsTagsExpanded] = useState(false);

  const [propertyToEdit, setPropertyToEdit] = useState<Property | null>(null);
  const [propertyForDetails, setPropertyForDetails] = useState<Property | null>(null);
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
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const assignableMembers = useMemo(() => {
    return teamMembers?.filter(m => m.status === 'Active' && m.role !== 'Admin') || [];
  }, [teamMembers]);

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

  const handleToggleCustomTag = (tagName: string) => {
    setActiveCustomTags(prev => 
        prev.includes(tagName) ? prev.filter(t => t !== tagName) : [...prev, tagName]
    );
  };

  const getTagColor = (tagName: string) => {
    const tagObj = agencyTags?.find(t => t.name === tagName);
    if (tagObj) return tagObj.color;
    return (statusVariant as any)[tagName] || 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700';
  };

  useEffect(() => {
    if (activeListingType === 'For Sale' && activeStatus === 'Rent Out') setActiveStatus('All');
    if (activeListingType === 'For Rent' && activeStatus === 'Sold') setActiveStatus('All');
    setActiveCustomTags([]);
  }, [activeListingType, activeStatus]);

  const filteredProperties = useMemo(() => {
    if (!allProperties) return [];
    let baseProperties = allProperties.filter(p => !p.is_deleted);
    
    if (activeListingType !== 'All') {
        baseProperties = baseProperties.filter(p => p.listing_type === activeListingType);
    }
    if (activeStatus !== 'All') {
        baseProperties = baseProperties.filter(p => p.status === activeStatus || p.tags?.includes(activeStatus));
    }
    if (activeCustomTags.length > 0) {
        baseProperties = baseProperties.filter(p => 
            activeCustomTags.every(tag => p.tags?.includes(tag))
        );
    }

    if (searchQuery) {
      const lowercasedQuery = searchQuery.toLowerCase();
      baseProperties = baseProperties.filter((prop) =>
        (prop.auto_title && prop.auto_title.toLowerCase().includes(lowercasedQuery)) ||
        prop.address.toLowerCase().includes(lowercasedQuery) ||
        prop.area.toLowerCase().includes(lowercasedQuery) ||
        prop.serial_no.toLowerCase().includes(lowercasedQuery)
      );
    }

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

    if (filters.minSize) baseProperties = baseProperties.filter(p => p.size_value >= Number(filters.minSize));
    if (filters.maxSize) baseProperties = baseProperties.filter(p => p.size_value <= Number(filters.maxSize));
    if (filters.sizeUnit !== 'All') baseProperties = baseProperties.filter(p => p.size_unit === filters.sizeUnit);

    if (filters.minDemand) {
        baseProperties = baseProperties.filter(p => {
            const val = formatUnit(p.demand_amount, p.demand_unit);
            const filterVal = formatUnit(Number(filters.minDemand), filters.demandUnit as PriceUnit || 'Lacs');
            return val >= filterVal;
        });
    }
    if (filters.maxDemand) {
        baseProperties = baseProperties.filter(p => {
            const val = formatUnit(p.demand_amount, p.demand_unit);
            const filterVal = formatUnit(Number(filters.maxDemand), filters.demandUnit as PriceUnit || 'Lacs');
            return val <= filterVal;
        });
    }

    if (filters.serialNo && filters.serialNoPrefix !== 'All') {
      const fullSerialNo = `${filters.serialNoPrefix}-${filters.serialNo}`;
      baseProperties = baseProperties.filter((p) => p.serial_no === fullSerialNo);
    }
    
    return baseProperties.sort((a, b) => {
      // Sort by last_remark_at first
      const dateA = a.last_remark_at ? new Date(a.last_remark_at).getTime() : 0;
      const dateB = b.last_remark_at ? new Date(b.last_remark_at).getTime() : 0;
      
      if (dateA !== dateB) {
          return dateB - dateA;
      }

      const aNum = parseInt(a.serial_no.split('-')[1] || '0', 10);
      const bNum = parseInt(b.serial_no.split('-')[1] || '0', 10);
      return sortOrder === 'asc' ? aNum - bNum : bNum - aNum;
    });
  }, [searchQuery, filters, allProperties, activeListingType, activeStatus, activeCustomTags, sortOrder]);

  const totalPages = Math.ceil(filteredProperties.length / ITEMS_PER_PAGE);
  const paginatedProperties = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProperties.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredProperties, currentPage]);

  const handleRowClick = (prop: Property) => {
    setPropertyForDetails(prop);
    setIsDetailsOpen(true);
  };

  const handleManageTags = (prop: Property) => {
    setPropertyForDetails(prop);
    setIsEditTagsOpen(true);
  };

  const handleSetAppointment = (prop: Property) => {
    setPropertyForDetails(prop);
    setIsAppointmentOpen(true);
  };

  const handleShare = (prop: Property) => {
    setPropertyForDetails(prop);
    setIsShareOpen(true);
  };

  const handleNotesClick = (prop: Property) => {
      setPropertyForDetails(prop);
      setIsNotesOpen(true);
  };

  const handleMarkAsSoldOrRent = (prop: Property) => {
    setPropertyForDetails(prop);
    if (prop.is_for_rent) {
      setIsRentOutOpen(true);
    } else {
      setIsSoldOpen(true);
    }
  };

  const handleEdit = (prop: Property) => { setPropertyToEdit(prop); setIsAddPropertyOpen(true); };

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

  const handleAssignAgent = async (propId: string, agentUid: string, agentName: string) => {
    if (!profile.agency_id) return;
    try {
      const propRef = doc(firestore, 'agencies', profile.agency_id, 'properties', propId);
      const prop = allProperties?.find(p => p.id === propId);
      if (!prop) return;

      let currentAssigned = prop.assignedTo;
      if (!Array.isArray(currentAssigned)) {
          currentAssigned = currentAssigned ? [currentAssigned] : [];
      }

      const isAlreadyAssigned = currentAssigned.includes(agentUid);

      if (isAlreadyAssigned) {
        await updateDoc(propRef, { assignedTo: arrayRemove(agentUid) });
        toast({ title: `Unassigned from ${agentName}` });
      } else {
        await updateDoc(propRef, { assignedTo: arrayUnion(agentUid) });
        toast({ title: `Assigned to ${agentName}` });
        
        if(profile.agency_id) {
            const activityLogRef = collection(firestore, 'agencies', profile.agency_id, 'activityLogs');
            await addDoc(activityLogRef, {
                userName: profile.name,
                action: `assigned property to ${agentName}`,
                target: prop.serial_no,
                targetType: 'Property',
                timestamp: new Date().toISOString(),
                agency_id: profile.agency_id,
                assignedToId: agentUid,
                assignedToName: agentName
            });
        }
      }
    } catch (error) {
      toast({ title: "Assignment Failed", variant: 'destructive' });
    }
  };

  const handleBulkAssign = async (agentDocId: string) => {
    if (selectedProperties.length === 0 || !agentDocId || !profile.agency_id) return;
    
    const agent = assignableMembers.find(a => a.id === agentDocId);
    if(!agent) return;

    const actualAgentUid = agent.user_id || agent.id;
    const batch = writeBatch(firestore);
    const propertySerials: string[] = [];
    
    selectedProperties.forEach(propId => {
      const prop = allProperties?.find(p => p.id === propId);
      if(prop) propertySerials.push(prop.serial_no);
      
      const docRef = doc(firestore, 'agencies', profile.agency_id, 'properties', propId);
      batch.update(docRef, { assignedTo: arrayUnion(actualAgentUid) });
    });
    
    const activityLogRef = doc(collection(firestore, 'agencies', profile.agency_id, 'activityLogs'));
    batch.set(activityLogRef, {
        userName: profile.name,
        action: `assigned ${propertySerials.length} properties to ${agent.name}`,
        target: propertySerials.join(', '),
        targetType: 'Property',
        timestamp: new Date().toISOString(),
        agency_id: profile.agency_id,
        assignedToId: actualAgentUid,
        assignedToName: agent.name
    });

    await batch.commit();
    toast({ title: 'Properties Assigned Successfully' });
    setSelectedProperties([]);
  };

  const handleBulkDelete = async () => {
    if (selectedProperties.length === 0 || !profile.agency_id) return;
    const batch = writeBatch(firestore);
    selectedProperties.forEach(propId => {
      const docRef = doc(firestore, 'agencies', profile.agency_id, 'properties', propId);
      batch.update(docRef, { is_deleted: true });
    });
    await batch.commit();
    toast({ title: 'Properties Moved to Trash' });
    setSelectedProperties([]);
  };

  const handleWhatsAppChat = (e: any, prop: Property) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const phoneNumber = formatPhoneNumberForWhatsApp(prop.owner_number, prop.country_code);
    window.open(`https://wa.me/${phoneNumber}`, '_blank');
  };

  const handleDelete = async (property: Property) => {
    if (!profile.agency_id) return;
    const docRef = doc(firestore, 'agencies', profile.agency_id, 'properties', property.id);
    await updateDoc(docRef, { is_deleted: true });
    toast({ title: 'Property Moved to Trash' });
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

  const renderTable = (properties: Property[]) => {
    if (isAgencyLoading) return <p className="p-4 text-center">Loading properties...</p>;
    if (properties.length === 0) return <div className="text-center py-10 text-muted-foreground">No properties found.</div>;
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox checked={paginatedProperties.length > 0 && selectedProperties.length === paginatedProperties.length} onCheckedChange={(checked) => setSelectedProperties(checked ? paginatedProperties.map(p => p.id) : [])} />
            </TableHead>
            <TableHead className="w-[350px]">
              <Button variant="ghost" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>Property <ArrowUpDown className="ml-2 h-4 w-4" /></Button>
            </TableHead>
            <TableHead>Type</TableHead><TableHead>Size</TableHead><TableHead>Demand</TableHead><TableHead>Status / Tags</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {properties.map((prop, index) => {
            const hasUnreadNotes = prop.timeline_notes?.some(n => !n.readBy?.includes(profile.user_id));
            return (
            <motion.tr key={prop.id} className="hover:bg-accent/50 transition-colors cursor-pointer" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: index * 0.02 }} >
              <TableCell onClick={(e) => e.stopPropagation()}><Checkbox checked={selectedProperties.includes(prop.id)} onCheckedChange={(checked) => setSelectedProperties(prev => checked ? [...prev, prop.id] : prev.filter(id => id !== prop.id))} /></TableCell>
              <TableCell onClick={() => handleRowClick(prop)}>
                <div className="flex items-center gap-2 font-bold font-headline text-base">
                    {prop.auto_title || `${prop.size_value} ${prop.size_unit} ${prop.property_type}`} 
                    {prop.is_recorded && <Video className="h-4 w-4 text-primary" />}
                    {hasUnreadNotes && (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                        </span>
                    )}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                    <Badge variant="default" className={cn('font-mono text-[10px]', (prop.serial_no || '').startsWith('RP') ? 'bg-emerald-100 text-emerald-700' : 'bg-primary/20 text-primary')}>{prop.serial_no}</Badge>
                </div>
              </TableCell>
              <TableCell onClick={() => handleRowClick(prop)}>{prop.property_type}</TableCell>
              <TableCell onClick={() => handleRowClick(prop)}>{prop.size_value} {prop.size_unit}</TableCell>
              <TableCell onClick={() => handleRowClick(prop)}>{formatCurrency(formatUnit(prop.demand_amount, prop.demand_unit), currency)}</TableCell>
              <TableCell onClick={() => handleRowClick(prop)}>
                <div className="flex flex-wrap gap-1 items-center">
                    <Badge className={cn("text-[10px] font-bold", getTagColor(prop.status))}>{prop.status}</Badge>
                    {prop.tags?.filter(t => t !== prop.status).map(tagName => (
                        <Badge key={tagName} className={cn("text-[10px] font-bold", getTagColor(tagName))}>{tagName}</Badge>
                    ))}
                </div>
              </TableCell>
              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="rounded-full"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-background">
                    <DropdownMenuItem onSelect={() => handleRowClick(prop)}><Eye className="mr-2 h-4 w-4" />View Details</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleNotesClick(prop)}><MessageSquareText className="mr-2 h-4 w-4" /> Remarks Update</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleShare(prop)}><Share2 className="mr-2 h-4 w-4" />Share Details</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleManageTags(prop)}><TagIcon className="mr-2 h-4 w-4" />Edit Tags</DropdownMenuItem>
                    <DropdownMenuItem onSelect={(e) => handleWhatsAppChat(e, prop)}><MessageSquare className="mr-2 h-4 w-4" /> WhatsApp</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleSetAppointment(prop)}><CalendarPlus className="mr-2 h-4 w-4" /> Set Appointment</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleMarkAsSoldOrRent(prop)}><Check className="mr-2 h-4 w-4" /> {prop.is_for_rent ? 'Mark as Rent Out' : 'Mark as Sold'}</DropdownMenuItem>
                    
                    {profile.role === 'Admin' && (
                        <>
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger><UserPlus className="mr-2 h-4 w-4" /> Assign to...</DropdownMenuSubTrigger>
                                <DropdownMenuPortal>
                                    <DropdownMenuSubContent className="bg-background">
                                        {assignableMembers.map(member => {
                                            const isAssigned = Array.isArray(prop.assignedTo) 
                                                ? prop.assignedTo.includes(member.user_id || member.id)
                                                : prop.assignedTo === (member.user_id || member.id);
                                            return (
                                                <DropdownMenuItem key={member.id} onSelect={() => handleAssignAgent(prop.id, member.user_id || member.id, member.name)}>
                                                    <div className="flex items-center justify-between w-full">
                                                        {member.name}
                                                        {isAssigned && <Check className="h-4 w-4 ml-2" />}
                                                    </div>
                                                </DropdownMenuItem>
                                            );
                                        })}
                                    </DropdownMenuSubContent>
                                </DropdownMenuPortal>
                            </DropdownMenuSub>
                        </>
                    )}
                    <DropdownMenuItem onSelect={() => handleEdit(prop)}><Edit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                    {profile.role === 'Admin' && (
                        <DropdownMenuItem onSelect={() => handleDelete(prop)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </motion.tr>
          )})}
        </TableBody>
      </Table>
    );
  };

  const renderCards = (properties: Property[]) => {
    return (
      <div className="space-y-4">
        {properties.map((prop, index) => {
          const hasUnreadNotes = prop.timeline_notes?.some(n => !n.readBy?.includes(profile.user_id));
          return (
          <motion.div key={prop.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: index * 0.02 }}>
            <Card className="overflow-hidden border-l-4 border-l-primary/40 bg-background">
              <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between space-y-0">
                <div className="flex gap-3">
                  <Checkbox 
                    checked={selectedProperties.includes(prop.id)} 
                    onCheckedChange={(checked) => setSelectedProperties(prev => checked ? [...prev, prop.id] : prev.filter(id => id !== prop.id))} 
                    onClick={e => e.stopPropagation()} 
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
                       <Badge variant="outline" className="text-[10px] bg-background font-mono">{prop.serial_no}</Badge>
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
                        <Building className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">{prop.property_type}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                        <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">{prop.size_value} {prop.size_unit}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs col-span-2 mt-1">
                        <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-bold text-primary">{formatCurrency(formatUnit(prop.demand_amount, prop.demand_unit), currency)}</span>
                        {prop.potential_rent_amount ? (
                            <Badge variant="secondary" className="text-[9px] h-4 bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800 ml-2">
                                Rent: {formatCurrency(formatUnit(prop.potential_rent_amount, prop.potential_rent_unit || 'Thousand'), currency)}
                            </Badge>
                        ) : null}
                    </div>
                </div>
                 <div className="flex flex-wrap gap-1 mt-4">
                    {prop.tags?.filter(t => t !== prop.status).slice(0, 5).map(tagName => (
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
                    <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-background w-48">
                    <DropdownMenuItem onSelect={() => handleRowClick(prop)}><Eye className="mr-2 h-4 w-4" />View Details</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleShare(prop)}><Share2 className="mr-2 h-4 w-4" />Share Details</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleManageTags(prop)}><TagIcon className="mr-2 h-4 w-4" />Edit Tags</DropdownMenuItem>
                    <DropdownMenuItem onSelect={(e) => handleWhatsAppChat(e as any, prop)}><MessageSquare className="mr-2 h-4 w-4" /> WhatsApp Chat</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleSetAppointment(prop)}><CalendarPlus className="mr-2 h-4 w-4" /> Set Appointment</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleMarkAsSoldOrRent(prop)}><Check className="mr-2 h-4 w-4" /> {prop.is_for_rent ? 'Mark as Rent Out' : 'Mark as Sold'}</DropdownMenuItem>
                    
                    {profile.role === 'Admin' && (
                        <>
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger><UserPlus className="mr-2 h-4 w-4" /> Assign to...</DropdownMenuSubTrigger>
                                <DropdownMenuPortal>
                                    <DropdownMenuSubContent className="bg-background">
                                        {assignableMembers.map(member => {
                                            const isAssigned = Array.isArray(prop.assignedTo) 
                                                ? prop.assignedTo.includes(member.user_id || member.id)
                                                : prop.assignedTo === (member.user_id || member.id);
                                            return (
                                                <DropdownMenuItem key={member.id} onSelect={() => handleAssignAgent(prop.id, member.user_id || member.id, member.name)}>
                                                    <div className="flex items-center justify-between w-full">
                                                        {member.name}
                                                        {isAssigned && <Check className="h-4 w-4 ml-2" />}
                                                    </div>
                                                </DropdownMenuItem>
                                            );
                                        })}
                                    </DropdownMenuSubContent>
                                </DropdownMenuPortal>
                            </DropdownMenuSub>
                        </>
                    )}
                    <DropdownMenuItem onSelect={() => handleEdit(prop)}><Edit className="mr-2 h-4 w-4" />Edit Details</DropdownMenuItem>
                    {profile.role === 'Admin' && (
                        <DropdownMenuItem onSelect={() => handleDelete(prop)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Delete Property</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardFooter>
            </Card>
          </motion.div>
        )})}
      </div>
    );
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
            <div className="flex w-full md:w-auto items-center gap-2 flex-wrap justify-end ml-auto">
              {selectedProperties.length > 0 && profile.role !== 'Agent' && (
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="outline" className="rounded-full"><UserPlus className="mr-2 h-4 w-4" /> Assign</Button></DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-background">{assignableMembers.map((member) => <DropdownMenuItem key={member.id} onSelect={() => handleBulkAssign(member.id)}>{member.name}</DropdownMenuItem>)}</DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="destructive" className="rounded-full" onClick={handleBulkDelete}><Trash2 className="mr-2 h-4 w-4" /> Delete ({selectedProperties.length})</Button>
                </div>
              )}
              <AlertDialog open={isFilterPopoverOpen} onOpenChange={setIsFilterPopoverOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="rounded-full"><Filter className="mr-2 h-4 w-4" /> Filters {filters.area.length > 0 ? `(${filters.area.length})` : ''}</Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-md bg-background">
                  <AlertDialogHeader><AlertDialogTitle>Refine Property Search</AlertDialogTitle></AlertDialogHeader>
                  <div className="grid gap-4 py-4">
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
                    <div className="grid grid-cols-3 items-center gap-4">
                        <Label>Area</Label>
                        <div className="col-span-2">
                        <Popover>
                            <PopoverTrigger asChild><Button variant="outline" className="w-full justify-between h-8">{filters.area.length > 0 ? `${filters.area.length} Selected` : "Select Areas"}<ChevronDown className="h-4 w-4 opacity-50" /></Button></PopoverTrigger>
                            <PopoverContent className="p-0 w-[280px] shadow-2xl bg-background" align="start">
                            <div className="p-2 border-b bg-muted/30"><Input placeholder="Search area..." className="h-8" value={areaSearch} onChange={(e) => setAreaSearch(e.target.value)} /></div>
                            <div className="max-h-[250px] overflow-y-auto p-2">
                                {Array.from(new Set((allProperties || []).map(p => p.area))).filter(Boolean).filter(a => a.toLowerCase().includes(areaSearch.toLowerCase())).sort().map((areaName) => (
                                    <div key={areaName} className="flex items-center space-x-2 p-2 hover:bg-accent rounded-md cursor-pointer"><Checkbox id={`area-${areaName}`} checked={filters.area.includes(areaName)} onCheckedChange={(c) => handleFilterChange('area', c ? [...filters.area, areaName] : filters.area.filter(a => a !== areaName))} /><label htmlFor={`area-${areaName}`} className="text-sm flex-1 cursor-pointer">{areaName}</label></div>
                                ))}
                            </div>
                            </PopoverContent>
                        </Popover>
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
                        <Label>Size</Label>
                        <div className="col-span-2 grid grid-cols-2 gap-2">
                            <Input placeholder="Min" type="number" value={filters.minSize} onChange={e => handleFilterChange('minSize', e.target.value)} className="h-8" />
                            <Input placeholder="Max" type="number" value={filters.maxSize} onChange={e => handleFilterChange('maxSize', e.target.value)} className="h-8" />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                        <Label></Label>
                        <div className="col-span-2">
                            <Select value={filters.sizeUnit} onValueChange={(value: any) => handleFilterChange('sizeUnit', value)}>
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
                            <Input placeholder="Min" type="number" value={filters.minDemand} onChange={e => handleFilterChange('minDemand', e.target.value)} className="h-8" />
                            <Input placeholder="Max" type="number" value={filters.maxDemand} onChange={e => handleFilterChange('maxDemand', e.target.value)} className="h-8" />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                        <Label></Label>
                        <div className="col-span-2">
                            <Select value={filters.demandUnit} onValueChange={(value: any) => handleFilterChange('demandUnit', value)}>
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
              {profile.role !== 'Agent' && (
                <Button className="rounded-full glowing-btn" onClick={() => { setIsAddPropertyOpen(true); setPropertyToEdit(null); }}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Property
                </Button>
              )}
            </div>
          </div>

          <Card className="border-none shadow-none bg-transparent">
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
                                All Types {isTypesExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
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
                                        <Badge variant={activeListingType === 'For Sale' ? 'default' : 'outline'} className={cn("cursor-pointer px-4 py-1.5 rounded-full bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800", activeListingType === 'For Sale' && "ring-2 ring-primary ring-offset-2")} onClick={() => setActiveListingType('For Sale')}>For Sale</Badge>
                                        <Badge variant={activeListingType === 'For Rent' ? 'default' : 'outline'} className={cn("cursor-pointer px-4 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800", activeListingType === 'For Rent' && "ring-2 ring-primary ring-offset-2")} onClick={() => setActiveListingType('For Rent')}>For Rent</Badge>
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
                                        {statusOptions.filter(opt => activeListingType === 'All' || opt.listing === 'All' || opt.listing === activeListingType).map(opt => (
                                            <Badge 
                                                key={opt.value}
                                                variant={activeStatus === opt.value ? 'default' : 'outline'}
                                                className={cn("cursor-pointer px-4 py-1.5 rounded-full transition-all", opt.color, activeStatus === opt.value && "ring-2 ring-primary ring-offset-2")}
                                                onClick={() => setActiveStatus(opt.value)}
                                            >{opt.label}</Badge>
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
                                        {agencyTags?.filter(tag => activeListingType === 'All' || !tag.listingType || tag.listingType === 'All' || tag.listingType === activeListingType).map(tag => (
                                            <Badge 
                                                key={tag.id}
                                                variant={activeCustomTags.includes(tag.name) ? 'default' : 'outline'}
                                                className={cn("cursor-pointer px-4 py-1.5 rounded-full transition-all", tag.color, activeCustomTags.includes(tag.name) && "ring-2 ring-primary ring-offset-2")}
                                                onClick={() => handleToggleCustomTag(tag.name)}
                                            >{tag.name}</Badge>
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
          </Card>

          <div className="mt-4">{isMobile ? renderCards(paginatedProperties) : <Card className="p-0 overflow-hidden bg-background">{renderTable(paginatedProperties)}</Card>}</div>
          {totalPages > 1 && (
            <div className="flex items-center justify-end space-x-2 py-4">
                <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /> Previous</Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>Next <ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
        </div>
      </TooltipProvider>

      <AddPropertyDialog isOpen={isAddPropertyOpen} setIsOpen={setIsAddPropertyOpen} propertyToEdit={propertyToEdit} allProperties={allProperties || []} onSave={handleSaveProperty} listingType={activeListingType === 'For Rent' ? 'For Rent' : 'For Sale'} limitReached={false} />
      
      <ManageTagsDialog isOpen={isManageTagsOpen} setIsOpen={setIsManageTagsOpen} />
      
      {propertyForDetails && (
        <>
          <PropertyDetailsDialog property={propertyForDetails} isOpen={isDetailsOpen} setIsOpen={setIsDetailsOpen} />
          <EditPropertyTagsDialog property={propertyForDetails} isOpen={isEditTagsOpen} setIsOpen={setIsEditTagsOpen} />
          <MarkAsSoldDialog property={propertyForDetails} isOpen={isSoldOpen} setIsOpen={setIsSoldOpen} onUpdateProperty={() => {}} />
          <MarkAsRentOutDialog property={propertyForDetails} isOpen={isRentOutOpen} setIsOpen={setIsRentOutOpen} onUpdateProperty={() => {}} />
          <RecordVideoDialog property={propertyForDetails} isOpen={isRecordVideoOpen} setIsOpen={setIsRecordVideoOpen} onUpdateProperty={() => {}} />
          <SharePropertyDialog property={propertyForDetails} isOpen={isShareOpen} setIsOpen={setIsShareOpen} />
          <PropertyNotesDialog property={propertyForDetails} isOpen={isNotesOpen} setIsOpen={setIsNotesOpen} />
          <SetAppointmentDialog 
              isOpen={isAppointmentOpen}
              setIsOpen={setIsAppointmentOpen}
              onSave={handleSaveAppointment}
              appointmentDetails={{
                  contactType: 'Owner',
                  contactName: `Owner of ${propertyForDetails.serial_no}`,
                  contactSerialNo: propertyForDetails.serial_no,
                  message: `Discussing ${propertyForDetails.listing_type} terms for ${propertyForDetails.serial_no}.`
              }}
          />
        </>
      )}
    </>
  );
}

export default function PropertiesPage() {
  return (
    <Suspense fallback={<div>Loading properties...</div>}>
      <PropertiesPageContent />
    </Suspense>
  )
}