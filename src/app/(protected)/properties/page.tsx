
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
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AddPropertyDialog } from '@/components/add-property-dialog';
import { Input } from '@/components/ui/input';
import type { Property, PropertyType, SizeUnit, PriceUnit, ListingType, User, Activity, Tag } from '@/lib/types';
import { useState, useMemo, useEffect, Suspense } from 'react';
import { PropertyDetailsDialog } from '@/components/property-details-dialog';
import { MarkAsSoldDialog } from '@/components/mark-as-sold-dialog';
import { MarkAsRentOutDialog } from '@/components/mark-as-rent-out-dialog';
import { RecordVideoDialog } from '@/components/record-video-dialog';
import { Card, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
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
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useSearch } from '../layout';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/context/currency-context';
import { formatCurrency, formatUnit, formatPhoneNumberForWhatsApp } from '@/lib/formatters';
import { useProfile } from '@/context/profile-context';
import { useFirestore } from '@/firebase/provider';
import { collection, addDoc, setDoc, doc, writeBatch, updateDoc, query, where, or } from 'firebase/firestore';
import { useMemoFirebase } from '@/firebase/hooks';
import { cn } from '@/lib/utils';
import { useUser } from '@/firebase/auth/use-user';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { motion } from 'framer-motion';
import { useCollection } from '@/firebase/firestore/use-collection';
import { ManageTagsDialog } from '@/components/manage-tags-dialog';
import { EditPropertyTagsDialog } from '@/components/edit-property-tags-dialog';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

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
  { value: 'All', label: 'All', color: 'bg-gray-100 text-gray-700', listing: 'All' },
  { value: 'Available', label: 'Available', color: 'bg-emerald-100 text-emerald-700', listing: 'All' },
  { value: 'Sold', label: 'Sold', color: 'bg-green-100 text-green-700', listing: 'For Sale' },
  { value: 'Rent Out', label: 'Rent Out', color: 'bg-blue-100 text-blue-700', listing: 'For Rent' },
];

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
            return query(ref, or(where('created_by', '==', user.uid), where('assignedTo', '==', user.uid)));
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

  const [activeListingType, setActiveListingType] = useState<ListingType | 'All'>('All');
  const [activeStatus, setActiveStatus] = useState<string>('All');
  const [activeCustomTags, setActiveCustomTags] = useState<string[]>([]);

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

  const activeTeamMembers = useMemo(() => {
    return teamMembers?.filter(m => m.status === 'Active' && m.role === 'Agent') || [];
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
        baseProperties = baseProperties.filter(p => p.status === activeStatus);
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

  const handleBulkAssign = async (agentDocId: string) => {
    if (selectedProperties.length === 0 || !agentDocId || !profile.agency_id) return;
    
    const agent = activeTeamMembers.find(a => a.id === agentDocId);
    if(!agent) return;

    const actualAgentUid = agent.user_id || agent.id; // Use UID for invited agents
    const batch = writeBatch(firestore);
    const propertySerials: string[] = [];
    
    selectedProperties.forEach(propId => {
      const prop = allProperties?.find(p => p.id === propId);
      if(prop) propertySerials.push(prop.serial_no);
      
      const docRef = doc(firestore, 'agencies', profile.agency_id, 'properties', propId);
      batch.update(docRef, { assignedTo: actualAgentUid });
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

  const handleWhatsAppChat = (e: React.MouseEvent, prop: Property) => {
    e.stopPropagation();
    const phoneNumber = formatPhoneNumberForWhatsApp(prop.owner_number, prop.country_code);
    window.open(`https://wa.me/${phoneNumber}`, '_blank');
  };

  const handleDelete = async (property: Property) => {
    if (!profile.agency_id) return;
    const docRef = doc(firestore, 'agencies', profile.agency_id, 'properties', property.id);
    await updateDoc(docRef, { is_deleted: true });
    toast({ title: 'Property Moved to Trash' });
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
            <TableHead>Type</TableHead><TableHead>Size</TableHead><TableHead>Demand</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {properties.map((prop, index) => (
            <motion.tr key={prop.id} className="hover:bg-accent/50 transition-colors cursor-pointer" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: index * 0.05 }} >
              <TableCell onClick={(e) => e.stopPropagation()}><Checkbox checked={selectedProperties.includes(prop.id)} onCheckedChange={(checked) => setSelectedProperties(prev => checked ? [...prev, prop.id] : prev.filter(id => id !== prop.id))} /></TableCell>
              <TableCell onClick={() => handleRowClick(prop)}>
                <div className="flex items-center gap-2 font-bold font-headline text-base">{prop.auto_title || `${prop.size_value} ${prop.size_unit} ${prop.property_type}`} {prop.is_recorded && <Video className="h-4 w-4 text-primary" />}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                    <Badge variant="default" className={cn('font-mono text-[10px]', prop.serial_no.startsWith('RP') ? 'bg-emerald-100 text-emerald-700' : 'bg-primary/20 text-primary')}>{prop.serial_no}</Badge>
                    {prop.tags?.map(tagName => {
                        const tagObj = agencyTags?.find(t => t.name === tagName);
                        return <Badge key={tagName} variant="outline" className={cn("text-[9px] px-1 py-0", tagObj?.color || "bg-gray-100")}>{tagName}</Badge>
                    })}
                </div>
              </TableCell>
              <TableCell onClick={() => handleRowClick(prop)}>{prop.property_type}</TableCell>
              <TableCell onClick={() => handleRowClick(prop)}>{prop.size_value} {prop.size_unit}</TableCell>
              <TableCell onClick={() => handleRowClick(prop)}>{formatCurrency(formatUnit(prop.demand_amount, prop.demand_unit), currency)}</TableCell>
              <TableCell onClick={() => handleRowClick(prop)}><Badge className={cn("text-[10px] uppercase font-bold", statusOptions.find(o => o.value === prop.status)?.color || "bg-primary")}>{prop.status}</Badge></TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="rounded-full" onClick={(e) => e.stopPropagation()}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="glass-card">
                    <DropdownMenuItem onSelect={() => handleRowClick(prop)}><Eye />View Details</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => handleManageTags(prop)}><TagIcon />Edit Tags</DropdownMenuItem>
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
            <Card onClick={() => handleRowClick(prop)} className="cursor-pointer">
              <CardHeader className="p-4 flex flex-row items-start justify-between">
                <div className="flex gap-2"><Checkbox checked={selectedProperties.includes(prop.id)} onCheckedChange={(checked) => setSelectedProperties(prev => checked ? [...prev, prop.id] : prev.filter(id => id !== prop.id))} onClick={e => e.stopPropagation()} /><div><CardTitle className="text-base">{prop.auto_title}</CardTitle><div className="text-xs text-muted-foreground mt-1">{prop.serial_no} • {prop.area}</div></div></div>
                <Badge className={cn("text-[10px]", statusOptions.find(o => o.value === prop.status)?.color || "bg-primary")}>{prop.status}</Badge>
              </CardHeader>
              <CardFooter className="p-4 pt-0 flex justify-between items-center">
                 <div className="flex flex-wrap gap-1">
                    {prop.tags?.slice(0, 3).map(tagName => {
                         const tagObj = agencyTags?.find(t => t.name === tagName);
                         return <Badge key={tagName} variant="outline" className={cn("text-[8px]", tagObj?.color || "bg-gray-100")}>{tagName}</Badge>
                    })}
                 </div>
                 <Button variant="ghost" size="sm" onClick={() => handleRowClick(prop)}>View Details</Button>
              </CardFooter>
            </Card>
          </motion.div>
        ))}
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
                    <DropdownMenuContent>{activeTeamMembers.map((member) => <DropdownMenuItem key={member.id} onSelect={() => handleBulkAssign(member.id)}>{member.name}</DropdownMenuItem>)}</DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="destructive" className="rounded-full" onClick={handleBulkDelete}><Trash2 className="mr-2 h-4 w-4" /> Delete ({selectedProperties.length})</Button>
                </div>
              )}
              <AlertDialog open={isFilterPopoverOpen} onOpenChange={setIsFilterPopoverOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="rounded-full"><Filter className="mr-2 h-4 w-4" /> Filters {filters.area.length > 0 && `(${filters.area.length})`}</Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-md glass-card">
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
                            <PopoverContent className="p-0 w-[280px] shadow-2xl" align="start">
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

          {/* Smart Horizontal Filter Bar */}
          <Card className="border-none shadow-none bg-transparent">
            <ScrollArea className="w-full whitespace-nowrap pb-4">
              <div className="flex items-center gap-3">
                {/* 1. Listing Type Selection */}
                <div className="flex items-center gap-2 pr-4 border-r border-border/50">
                    <Badge variant={activeListingType === 'All' ? 'default' : 'outline'} className={cn("cursor-pointer px-4 py-1.5 rounded-full", activeListingType === 'All' ? "bg-primary" : "hover:bg-accent")} onClick={() => setActiveListingType('All')}>All Types</Badge>
                    <Badge variant={activeListingType === 'For Sale' ? 'default' : 'outline'} className={cn("cursor-pointer px-4 py-1.5 rounded-full bg-blue-50 text-blue-700 border-blue-100", activeListingType === 'For Sale' && "ring-2 ring-primary ring-offset-2")} onClick={() => setActiveListingType('For Sale')}>For Sale</Badge>
                    <Badge variant={activeListingType === 'For Rent' ? 'default' : 'outline'} className={cn("cursor-pointer px-4 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border-emerald-100", activeListingType === 'For Rent' && "ring-2 ring-primary ring-offset-2")} onClick={() => setActiveListingType('For Rent')}>For Rent</Badge>
                </div>

                {/* 2. Dynamic Status Section (Filters based on Sale/Rent) */}
                <div className="flex items-center gap-2 pr-4 border-r border-border/50">
                    {statusOptions.filter(opt => activeListingType === 'All' || opt.listing === 'All' || opt.listing === activeListingType).map(opt => (
                        <Badge 
                            key={opt.value}
                            variant={activeStatus === opt.value ? 'default' : 'outline'}
                            className={cn("cursor-pointer px-4 py-1.5 rounded-full transition-all", opt.color, activeStatus === opt.value && "ring-2 ring-primary ring-offset-2")}
                            onClick={() => setActiveStatus(opt.value)}
                        >{opt.label}</Badge>
                    ))}
                </div>

                {/* 3. Custom Tags (Filtered by Listing Type) */}
                <div className="flex items-center gap-2">
                    {agencyTags?.filter(tag => activeListingType === 'All' || !tag.listingType || tag.listingType === 'All' || tag.listingType === activeListingType).map(tag => (
                        <Badge 
                            key={tag.id}
                            variant={activeCustomTags.includes(tag.name) ? 'default' : 'outline'}
                            className={cn("cursor-pointer px-4 py-1.5 rounded-full transition-all", tag.color, activeCustomTags.includes(tag.name) && "ring-2 ring-primary ring-offset-2")}
                            onClick={() => handleToggleCustomTag(tag.name)}
                        >{tag.name}</Badge>
                    ))}
                    <Button variant="ghost" size="sm" className="rounded-full h-8 px-4 text-xs font-bold gap-2 text-primary hover:bg-primary/10" onClick={() => setIsManageTagsOpen(true)}><PlusCircle className="h-4 w-4" />Manage Tags</Button>
                </div>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </Card>

          <div className="mt-4">{isMobile ? renderCards(paginatedProperties) : <Card className="p-0">{renderTable(paginatedProperties)}</Card>}</div>
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
