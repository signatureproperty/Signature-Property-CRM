
'use client';
import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, UserPlus, DollarSign, Home, UserCheck, ArrowRight, ArrowUpRight, TrendingUp, Star, PhoneForwarded, CalendarDays, CheckCheck, XCircle, CheckCircle, Briefcase, Gem, Info, CalendarClock, CalendarPlus as AddToCalendarIcon, Video, VideoOff, Edit, PlayCircle, Loader2, Circle, Clock, ChevronsUpDown, Check } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useProfile } from '@/context/profile-context';
import { useFirestore } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useMemoFirebase } from '@/firebase/hooks';
import { collection, query, where, Timestamp, addDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';
import type { Property, Buyer, Appointment, FollowUp, User, PriceUnit, AppointmentContactType, AppointmentStatus, Activity, EditingStatus, ListingType } from '@/lib/types';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { subDays, isWithinInterval, parseISO, format } from 'date-fns';
import { useCurrency } from '@/context/currency-context';
import { formatCurrency, formatUnit, formatPhoneNumberForWhatsApp } from '@/lib/formatters';
import { PerformanceChart } from '@/components/performance-chart';
import { LeadsChart } from '@/components/leads-chart';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { UpcomingEvents } from '@/components/upcoming-events';
import { SetAppointmentDialog } from '@/components/set-appointment-dialog';
import { useToast } from '@/hooks/use-toast';
import { AddEventDialog, type EventDetails } from '@/components/add-event-dialog';
import { UpdateAppointmentStatusDialog } from '@/components/update-appointment-status-dialog';
import { AllEventsDialog } from '@/components/all-events-dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUser } from '@/firebase/auth/use-user';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { countryCodes } from '@/lib/data';


interface StatCardProps {
    title: string;
    value: number | string;
    change?: string;
    icon: React.ReactNode;
    color: string;
    href?: string;
    isLoading: boolean;
}

const StatCard = ({ title, value, change, icon, color, href, isLoading }: StatCardProps) => {
    const CardContentWrapper = href ? Link : 'div';

    if (isLoading) {
        return (
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium"><Skeleton className="h-4 w-24" /></CardTitle>
                    <Skeleton className="h-8 w-8 rounded-full" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-8 w-12" />
                    {change && <Skeleton className="h-3 w-20 mt-1" />}
                </CardContent>
            </Card>
        );
    }

    return (
        <CardContentWrapper href={href || ''} className={href ? "block hover:shadow-lg hover:-translate-y-1 transition-all rounded-lg" : "block"}>
            <Card className={href ? "h-full" : ""}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{title}</CardTitle>
                    <div className={cn("flex items-center justify-center rounded-full h-8 w-8", color)}>
                        {icon}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold">{value}</div>
                     {change && <p className={cn(
                        "text-xs text-muted-foreground",
                        change.startsWith('+') && "text-green-600",
                        change.startsWith('-') && "text-red-600"
                    )}>{change}</p>}
                </CardContent>
            </Card>
        </CardContentWrapper>
    );
};

const QuickAdd = () => {
    const [leadType, setLeadType] = useState<"Property" | "Buyer">("Property");
    const [listingType, setListingType] = useState<ListingType>("For Sale");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [countryCode, setCountryCode] = useState("+92");
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();
    const { profile } = useProfile();
    const { user } = useUser();
    const firestore = useFirestore();

    const propertiesQuery = useMemoFirebase(() => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'properties') : null, [profile.agency_id, firestore]);
    const { data: allProperties } = useCollection<Property>(propertiesQuery);
    
    const buyersQuery = useMemoFirebase(() => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'buyers') : null, [profile.agency_id, firestore]);
    const { data: allBuyers } = useCollection<Buyer>(buyersQuery);


    const handleSave = async () => {
        if (!phoneNumber) {
            toast({ title: "Phone number required", variant: "destructive" });
            return;
        }
        setIsLoading(true);

        try {
            if (leadType === 'Property') {
                const totalSale = allProperties?.filter(p => p.listing_type === 'For Sale').length || 0;
                const totalRent = allProperties?.filter(p => p.listing_type === 'For Rent').length || 0;
                const newProperty: Omit<Property, 'id'> = {
                    serial_no: listingType === 'For Sale' ? `P-${totalSale + 1}` : `RP-${totalRent + 1}`,
                    auto_title: `Pending Lead: ${phoneNumber}`,
                    owner_number: formatPhoneNumberForWhatsApp(phoneNumber, countryCode),
                    city: '', area: '', address: '',
                    property_type: 'House',
                    size_value: 0, size_unit: 'Marla',
                    demand_amount: 0, demand_unit: 'Lacs',
                    status: 'Pending',
                    created_at: new Date().toISOString(),
                    created_by: user!.uid,
                    agency_id: profile.agency_id,
                    listing_type: listingType,
                    is_for_rent: listingType === 'For Rent',
                    is_recorded: false,
                    country_code: countryCode,
                };
                await addDoc(collection(firestore, 'agencies', profile.agency_id, 'properties'), newProperty);
            } else { // Buyer
                const totalSale = allBuyers?.filter(b => (!b.listing_type || b.listing_type === 'For Sale')).length || 0;
                const totalRent = allBuyers?.filter(b => b.listing_type === 'For Rent').length || 0;
                const newBuyer: Omit<Buyer, 'id'> = {
                    serial_no: listingType === 'For Sale' ? `B-${totalSale + 1}` : `RB-${totalRent + 1}`,
                    name: `Pending Lead: ${phoneNumber}`,
                    phone: formatPhoneNumberForWhatsApp(phoneNumber, countryCode),
                    country_code: countryCode,
                    status: 'Pending',
                    listing_type: listingType,
                    created_at: new Date().toISOString(),
                    created_by: user!.uid,
                    agency_id: profile.agency_id,
                };
                await addDoc(collection(firestore, 'agencies', profile.agency_id, 'buyers'), newBuyer);
            }
            toast({ title: 'Quick Lead Saved!', description: `Details for ${phoneNumber} can be completed later.` });
            setPhoneNumber('');
            setCountryCode('+92');
        } catch (error) {
            console.error("Quick add failed:", error);
            toast({ title: "Failed to save lead", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Quick Add Lead</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-2">
                <Select value={leadType} onValueChange={(v) => setLeadType(v as any)}>
                    <SelectTrigger className="w-full sm:w-[150px]"><SelectValue/></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Property">Property</SelectItem>
                        <SelectItem value="Buyer">Buyer</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={listingType} onValueChange={(v) => setListingType(v as any)}>
                    <SelectTrigger className="w-full sm:w-[150px]"><SelectValue/></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="For Sale">For Sale</SelectItem>
                        <SelectItem value="For Rent">For Rent</SelectItem>
                    </SelectContent>
                </Select>
                <div className="flex gap-2 flex-1">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" className="w-1/3 justify-between">
                                {countryCode}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Command>
                                <CommandInput placeholder="Search code..." />
                                <CommandList>
                                    <CommandEmpty>No country found.</CommandEmpty>
                                    <CommandGroup>
                                        {countryCodes.map((c) => (
                                            <CommandItem
                                                key={c.code}
                                                value={c.dial_code}
                                                onSelect={(currentValue) => {
                                                    setCountryCode(currentValue);
                                                }}
                                            >
                                                <Check className={cn("mr-2 h-4 w-4", countryCode === c.dial_code ? "opacity-100" : "opacity-0")} />
                                                {c.dial_code} ({c.name})
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                    <Input
                        placeholder="Enter phone number..."
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        type="tel"
                        className="w-2/3 flex-1"
                    />
                </div>
                 <Button onClick={handleSave} disabled={isLoading} className="w-full sm:w-auto">
                    {isLoading ? <Loader2 className="animate-spin" /> : "Save Lead"}
                </Button>
            </CardContent>
        </Card>
    );
}



export default function OverviewPage() {
    const { profile, isLoading: isProfileLoading } = useProfile();
    const firestore = useFirestore();
    const { currency } = useCurrency();
    const { toast } = useToast();
    const [isAppointmentOpen, setIsAppointmentOpen] = useState(false);
    const [isEventOpen, setIsEventOpen] = useState(false);
    const [isAllEventsOpen, setIsAllEventsOpen] = useState(false);
    const [appointmentToUpdateStatus, setAppointmentToUpdateStatus] = useState<Appointment | null>(null);
    const [newStatus, setNewStatus] = useState<AppointmentStatus | null>(null);


    const [appointmentDetails, setAppointmentDetails] = useState<{
        contactType: AppointmentContactType;
        contactName: string;
        contactSerialNo?: string;
        message: string;
    } | null>(null);


    const canFetch = !isProfileLoading && profile.agency_id;
    const now = new Date();
    const last30DaysStart = subDays(now, 30);
    const isTrialing = !profile.planStartDate && profile.planName === 'Basic' && (profile.daysLeftInTrial !== undefined && profile.daysLeftInTrial > 0);

    const isAgent = profile.role === 'Agent';

    // --- Data Fetching ---
    const propertiesQuery = useMemoFirebase(() => {
        if (!canFetch) return null;
        if (profile.role === 'Video Recorder') {
             return query(collection(firestore, 'agencies', profile.agency_id, 'properties'), where('assignedTo', '==', profile.user_id));
        }
        if (isAgent) {
             return query(collection(firestore, 'agencies', profile.agency_id, 'properties'), where('created_by', '==', profile.user_id));
        }
        return collection(firestore, 'agencies', profile.agency_id, 'properties');
    }, [canFetch, firestore, profile.agency_id, profile.role, profile.user_id, isAgent]);
    const { data: properties, isLoading: isPropertiesLoading } = useCollection<Property>(propertiesQuery);
    
    const assignedPropertiesQuery = useMemoFirebase(() => {
        if (!canFetch || !isAgent) return null;
        return query(collection(firestore, 'agencies', profile.agency_id, 'properties'), where('assignedTo', '==', profile.user_id));
    }, [canFetch, firestore, profile.agency_id, isAgent, profile.user_id]);
    const { data: assignedProperties } = useCollection<Property>(assignedPropertiesQuery);

    const buyersQuery = useMemoFirebase(() => {
        if (!canFetch || profile.role === 'Video Recorder') return null;
        if (isAgent) {
            return query(collection(firestore, 'agencies', profile.agency_id, 'buyers'), where('created_by', '==', profile.user_id));
        }
        return collection(firestore, 'agencies', profile.agency_id, 'buyers');
    }, [canFetch, firestore, profile.agency_id, profile.role, profile.user_id, isAgent]);
    const { data: buyers, isLoading: isBuyersLoading } = useCollection<Buyer>(buyersQuery);
    
    const assignedBuyersQuery = useMemoFirebase(() => {
        if (!canFetch || !isAgent) return null;
        return query(collection(firestore, 'agencies', profile.agency_id, 'buyers'), where('assignedTo', '==', profile.user_id));
    }, [canFetch, firestore, profile.agency_id, isAgent, profile.user_id]);
    const { data: assignedBuyers } = useCollection<Buyer>(assignedBuyersQuery);
    
    const followUpsQuery = useMemoFirebase(() => (canFetch && profile.role !== 'Video Recorder') ? collection(firestore, 'agencies', profile.agency_id, 'followUps') : null, [canFetch, firestore, profile.agency_id, profile.role]);
    const { data: followUpsData, isLoading: isFollowUpsLoading } = useCollection<FollowUp>(followUpsQuery);
    
    const appointmentsQuery = useMemoFirebase(() => canFetch ? collection(firestore, 'agencies', profile.agency_id, 'appointments') : null, [canFetch, firestore, profile.agency_id]);
    const { data: allAppointments, isLoading: isAppointmentsLoading } = useCollection<Appointment>(appointmentsQuery);
    
    const teamMembersQuery = useMemoFirebase(() => canFetch && profile.role === 'Admin' ? collection(firestore, 'agencies', profile.agency_id, 'teamMembers') : null, [canFetch, firestore, profile.agency_id, profile.role]);
    const { data: teamMembers, isLoading: isTeamMembersLoading } = useCollection<User>(teamMembersQuery);

    // Agent specific data aggregations
    const agentAllProperties = useMemo(() => isAgent ? [...(properties || []), ...(assignedProperties || [])] : [], [isAgent, properties, assignedProperties]);
    const agentAllBuyers = useMemo(() => isAgent ? [...(buyers || []), ...(assignedBuyers || [])] : [], [isAgent, buyers, assignedBuyers]);
    const agentAppointments = useMemo(() => isAgent ? (allAppointments || []).filter(a => a.agentName === profile.name) : [], [isAgent, allAppointments, profile.name]);
    
    // Admin uses all data, Agent uses their aggregated data
    const finalProperties = isAgent ? agentAllProperties : properties;
    const finalBuyers = isAgent ? agentAllBuyers : buyers;
    const finalAppointments = isAgent ? agentAppointments : allAppointments;

    const isLoading = isProfileLoading || isPropertiesLoading || isBuyersLoading || isFollowUpsLoading || isAppointmentsLoading || (isAgent ? false : isTeamMembersLoading);

    const filterLast30Days = (item: { created_at?: string; sale_date?: string; rent_out_date?: string, invitedAt?: any; date?: string; status?: string; recording_payment_date?: string }) => {
        const dateString = item.rent_out_date || item.sale_date || item.created_at || item.date || item.recording_payment_date || (item.invitedAt instanceof Timestamp ? item.invitedAt.toDate().toISOString() : item.invitedAt);
        if (!dateString) return false;
        return isWithinInterval(parseISO(dateString), { start: last30DaysStart, end: now });
    };
    
    const logActivity = async (action: string, target: string, details: any = null) => {
        if (!profile.agency_id) return;
        const activityLogRef = collection(firestore, 'agencies', profile.agency_id, 'activityLogs');
        const newActivity: Omit<Activity, 'id'> = {
        userName: profile.name,
        action,
        target,
        targetType: 'Appointment',
        details,
        timestamp: new Date().toISOString(),
        agency_id: profile.agency_id,
        };
        await addDoc(activityLogRef, newActivity);
    };

    const handleSaveAppointment = async (appointment: Omit<Appointment, 'id' | 'status' | 'agency_id'>) => {
        if (!profile.agency_id) return;
        const collectionRef = collection(firestore, 'agencies', profile.agency_id, 'appointments');
        const newAppointment = {
            ...appointment,
            status: 'Scheduled',
            agency_id: profile.agency_id,
        };
        await addDoc(collectionRef, newAppointment);
        toast({ title: 'Appointment Saved!', description: `Appointment with ${appointment.contactName} has been scheduled.`});
    };
    
    const handleSaveEvent = async (event: EventDetails) => {
        if (!profile.agency_id) return;
         await handleSaveAppointment({
            contactName: event.title,
            contactType: 'Owner', // Generic type for events
            message: event.description || 'Custom Event',
            agentName: profile.name,
            date: event.date,
            time: event.time,
        });
        toast({ title: 'Event Saved to CRM!', description: `${event.title} has been added to your CRM calendar.`});
    };
    
    const handleAddAppointment = () => {
        setAppointmentDetails(null); // Clear previous details
        setIsAppointmentOpen(true);
    };

    const handleAddEvent = () => {
        setIsEventOpen(true);
    };

    const handleUpdateStatus = async (appointmentId: string, status: AppointmentStatus, notes?: string) => {
      if (!profile.agency_id) return;
      const appointment = allAppointments?.find(a => a.id === appointmentId);
      if (!appointment) return;

      const docRef = doc(firestore, 'agencies', profile.agency_id, 'appointments', appointmentId);
      await setDoc(docRef, { status, notes: notes || '' }, { merge: true });
      toast({ title: 'Appointment Updated', description: `Status has been changed to ${status}.` });
      await logActivity('updated appointment status', appointment.contactName, { from: appointment.status, to: status });
  };
  
  const handleOpenStatusUpdate = (appointment: Appointment, status: 'Completed' | 'Cancelled') => {
      setAppointmentToUpdateStatus(appointment);
      setNewStatus(status);
  };
  
  const handleDeleteAppointment = async (appointment: Appointment) => {
    if (!profile.agency_id) return;
    await deleteDoc(doc(firestore, 'agencies', profile.agency_id, 'appointments', appointment.id));
    toast({ title: 'Appointment Deleted', variant: 'destructive' });
    await logActivity('deleted an appointment', appointment.contactName);
  };

  const handleAddToCalendar = (e: React.MouseEvent, appointment: Appointment) => {
        e.stopPropagation();
        
        const startTimeStr = `${appointment.date}T${appointment.time}:00`;
        const startTime = new Date(startTimeStr);
        if (isNaN(startTime.getTime())) {
            toast({ title: 'Invalid Date/Time', description: 'Cannot add to calendar due to invalid appointment time.', variant: 'destructive' });
            return;
        }
        const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // Add 1 hour

        const formatDateForCalendar = (date: Date) => format(date, "yyyyMMdd'T'HHmmss");

        const details = `Appointment with ${appointment.contactName}.\nPurpose: ${appointment.message}\nAssigned Agent: ${appointment.agentName}`;
        
        let location = 'N/A';
        if(appointment.contactType === 'Owner' && properties) {
            const property = properties.find(p => p.serial_no === appointment.contactSerialNo);
            if(property) location = property.address;
        }

        const url = new URL('https://www.google.com/calendar/render');
        url.searchParams.set('action', 'TEMPLATE');
        url.searchParams.set('text', `Appointment: ${appointment.contactName}`);
        url.searchParams.set('dates', `${formatDateForCalendar(startTime)}/${formatDateForCalendar(endTime)}`);
        url.searchParams.set('details', details);
        url.searchParams.set('location', location);
        
        window.open(url.toString(), '_blank');
  };

    // --- Memoized Stats ---
    const stats = useMemo(() => {
        const totalProperties = finalProperties?.filter(p => !p.is_deleted && !p.is_for_rent).length || 0;
        const totalSaleBuyers = finalBuyers?.filter(b => !b.is_deleted && (!b.listing_type || b.listing_type === 'For Sale')).length || 0;
        const totalRentBuyers = finalBuyers?.filter(b => !b.is_deleted && b.listing_type === 'For Rent').length || 0;
        
        const soldInLast30Days = finalProperties?.filter(p => p.status === 'Sold' && p.sale_date && filterLast30Days(p)) || [];
        const revenue30d = soldInLast30Days.reduce((sum, prop) => sum + (prop.total_commission || 0), 0);
        
        const rentOutInLast30Days = finalProperties?.filter(p => p.status === 'Rent Out' && p.rent_out_date && filterLast30Days(p)) || [];
        const rentRevenue30d = rentOutInLast30Days.reduce((sum, prop) => sum + (prop.rent_total_commission || 0), 0);

        const paidVideos30d = finalProperties?.filter(p => p.recording_payment_status === 'Paid Online' && p.recording_payment_date && filterLast30Days(p)) || [];
        const recordingRevenue30d = paidVideos30d.reduce((sum, prop) => sum + (prop.recording_payment_amount || 0), 0);

        const propertiesForRent = finalProperties?.filter(p => p.status === 'Available' && p.is_for_rent).length || 0;

        const interestedBuyers = finalBuyers?.filter(b => b.status === 'Interested' && !b.is_deleted).length || 0;
        const followUpLeads = followUpsData?.length || 0;

        const appointments30d = finalAppointments?.filter(filterLast30Days).length || 0;
        const completedAppointments30d = finalAppointments?.filter(a => a.status === 'Completed' && filterLast30Days(a)).length || 0;
        const cancelledAppointments30d = finalAppointments?.filter(a => a.status === 'Cancelled' && filterLast30Days(a)).length || 0;
        const upcomingAppointments = finalAppointments?.filter(a => a.status === 'Scheduled' && new Date(a.date) >= now).length || 0;
        
        const newProperties30d = finalProperties?.filter(p => !p.is_for_rent && filterLast30Days(p)).length || 0;
        const newBuyers30d = finalBuyers?.filter(b => b.listing_type === 'For Sale' && filterLast30Days(b)).length || 0;
        const newRentBuyers30d = finalBuyers?.filter(b => b.listing_type === 'For Rent' && filterLast30Days(b)).length || 0;

        return {
            totalProperties,
            totalSaleBuyers,
            totalRentBuyers,
            revenue30d,
            rentRevenue30d,
            paidVideos30dCount: paidVideos30d.length,
            recordingRevenue30d,
            propertiesForRent,
            interestedBuyers,
            followUpLeads,
            appointments30d,
            completedAppointments30d,
            cancelledAppointments30d,
            upcomingAppointments,
            soldInLast30DaysCount: soldInLast30Days.length,
            rentOutInLast30DaysCount: rentOutInLast30Days.length,
            newProperties30d,
            newBuyers30d,
            newRentBuyers30d
        };
    }, [finalProperties, finalBuyers, followUpsData, finalAppointments, last30DaysStart, now]);

    const statCardsData: StatCardProps[] = [
        {
            title: "Sale Properties",
            value: stats.totalProperties,
            change: `+${stats.newProperties30d} in last 30 days`,
            icon: <Home className="h-4 w-4" />,
            color: "bg-sky-100 dark:bg-neutral-800 text-sky-600 dark:text-sky-300",
            href: "/properties?status=All%20(Sale)",
            isLoading
        },
        {
            title: "Sale Buyers",
            value: stats.totalSaleBuyers,
            change: `+${stats.newBuyers30d} in last 30 days`,
            icon: <Users className="h-4 w-4" />,
            color: "bg-indigo-100 dark:bg-neutral-800 text-indigo-600 dark:text-indigo-300",
            href: "/buyers?type=For+Sale",
            isLoading
        },
        {
            title: "Rent Properties",
            value: stats.propertiesForRent,
            change: "Currently available",
            icon: <Building2 className="h-4 w-4" />,
            color: "bg-orange-100 dark:bg-neutral-800 text-orange-600 dark:text-orange-300",
            href: "/properties?status=Available (Rent)",
            isLoading
        },
        {
            title: "Rent Buyers",
            value: stats.totalRentBuyers,
            change: `+${stats.newRentBuyers30d} new in 30 days`,
            icon: <Briefcase className="h-4 w-4" />,
            color: "bg-teal-100 dark:bg-neutral-800 text-teal-600 dark:text-teal-300",
            href: "/buyers?type=For+Rent",
            isLoading
        },
        {
            title: "Properties Sold (30d)",
            value: stats.soldInLast30DaysCount,
            change: `Total sales in last 30 days`,
            icon: <CheckCircle className="h-4 w-4" />,
            color: "bg-emerald-100 dark:bg-neutral-800 text-emerald-600 dark:text-emerald-300",
            href: "/reports",
            isLoading
        },
        {
            title: "Sale Revenue (30d)",
            value: formatCurrency(stats.revenue30d, currency, { notation: 'compact' }),
            change: `From ${stats.soldInLast30DaysCount} sales`,
            icon: <DollarSign className="h-4 w-4" />,
            color: "bg-emerald-100 dark:bg-neutral-800 text-emerald-600 dark:text-emerald-300",
            href: "/reports",
            isLoading
        },
        {
            title: 'Rent Outs (30d)',
            value: stats.rentOutInLast30DaysCount,
            change: 'Total rentals in last 30 days',
            icon: <CheckCircle className="h-4 w-4" />,
            color: 'bg-lime-100 dark:bg-neutral-800 text-lime-600 dark:text-lime-300',
            href: '/reports',
            isLoading
        },
        {
            title: "Rent Revenue (30d)",
            value: formatCurrency(stats.rentRevenue30d, currency, { notation: 'compact' }),
            change: "From new rentals",
            icon: <DollarSign className="h-4 w-4" />,
            color: "bg-lime-100 dark:bg-neutral-800 text-lime-600 dark:text-lime-300",
            href: "/reports",
            isLoading
        },
        {
            title: "Paid Videos (30d)",
            value: stats.paidVideos30dCount,
            change: "Completed video payments",
            icon: <Video className="h-4 w-4" />,
            color: "bg-rose-100 dark:bg-neutral-800 text-rose-600 dark:text-rose-300",
            isLoading
        },
        {
            title: "Recording Revenue (30d)",
            value: formatCurrency(stats.recordingRevenue30d, currency, { notation: 'compact' }),
            change: "From video services",
            icon: <DollarSign className="h-4 w-4" />,
            color: "bg-fuchsia-100 dark:bg-neutral-800 text-fuchsia-600 dark:text-fuchsia-300",
            isLoading
        },
        {
            title: "Interested Buyers",
            value: stats.interestedBuyers,
            change: `+${finalBuyers?.filter(b => b.status === 'Interested' && filterLast30Days(b)).length || 0} new leads this month`,
            icon: <Star className="h-4 w-4" />,
            color: "bg-amber-100 dark:bg-neutral-800 text-amber-600 dark:text-amber-300",
            href: "/buyers?status=Interested",
            isLoading
        },
        {
            title: "Follow-up Leads",
            value: stats.followUpLeads,
            change: "Leads requiring action",
            icon: <PhoneForwarded className="h-4 w-4" />,
            color: "bg-purple-100 dark:bg-neutral-800 text-purple-600 dark:text-purple-300",
            href: "/follow-ups",
            isLoading
        },
        {
            title: 'Appointments (30d)',
            value: stats.appointments30d,
            change: `${stats.upcomingAppointments} upcoming`,
            icon: <CalendarDays className="h-4 w-4" />,
            color: 'bg-cyan-100 dark:bg-neutral-800 text-cyan-600 dark:text-cyan-300',
            href: '/appointments',
            isLoading
        },
         {
            title: "Completed (30d)",
            value: stats.completedAppointments30d,
            change: "Completed appointments",
            icon: <CheckCheck className="h-4 w-4" />,
            color: "bg-green-100 dark:bg-neutral-800 text-green-600 dark:text-green-300",
            href: "/appointments",
            isLoading
        },
        {
            title: "Cancelled (30d)",
            value: stats.cancelledAppointments30d,
            change: "Cancelled appointments",
            icon: <XCircle className="h-4 w-4" />,
            color: "bg-red-100 dark:bg-neutral-800 text-red-600 dark:text-red-300",
            href: "/appointments",
            isLoading
        },
    ];

    if (profile.role === 'Video Recorder') {
        const assignedProperties = properties || [];
        const pendingCount = assignedProperties.filter(p => !p.is_recorded).length;
        const inEditing = assignedProperties.filter(p => p.is_recorded && p.editing_status === 'In Editing').length;
        const completedCount = assignedProperties.filter(p => p.is_recorded && p.editing_status === 'Complete' && p.recording_payment_status !== 'Unpaid').length;

        const unpaidCount = assignedProperties.filter(p => (p.recording_payment_status || 'Unpaid') === 'Unpaid').length;
        const paidOnlineCount = assignedProperties.filter(p => p.recording_payment_status === 'Paid Online').length;
        const pendingCashCount = assignedProperties.filter(p => p.recording_payment_status === 'Pending Cash').length;

        const videoRecorderStats: StatCardProps[] = [
            {
                title: "Pending Recordings",
                value: pendingCount,
                icon: <VideoOff className="h-4 w-4" />,
                color: "bg-red-100 dark:bg-neutral-800 text-red-600 dark:text-red-300",
                isLoading,
                href: "/recording",
            },
            {
                title: "In Editing",
                value: inEditing,
                icon: <PlayCircle className="h-4 w-4" />,
                color: "bg-yellow-100 dark:bg-neutral-800 text-yellow-600 dark:text-yellow-300",
                isLoading,
                href: "/editing",
            },
            {
                title: "Editing Complete",
                value: completedCount,
                icon: <CheckCheck className="h-4 w-4" />,
                color: "bg-green-100 dark:bg-neutral-800 text-green-600 dark:text-green-300",
                isLoading,
                href: "/editing",
            },
            {
                title: "Total Unpaid",
                value: unpaidCount,
                icon: <Circle className="h-4 w-4" />,
                color: "bg-orange-100 dark:bg-neutral-800 text-orange-600 dark:text-orange-300",
                isLoading,
                href: "/recording?tab=Unpaid",
            },
            {
                title: "Paid Online",
                value: paidOnlineCount,
                icon: <CheckCircle className="h-4 w-4" />,
                color: "bg-emerald-100 dark:bg-neutral-800 text-emerald-600 dark:text-emerald-300",
                isLoading,
                href: "/recording?tab=Paid Online",
            },
            {
                title: "Pending Cash",
                value: pendingCashCount,
                icon: <Clock className="h-4 w-4" />,
                color: "bg-purple-100 dark:bg-neutral-800 text-purple-600 dark:text-purple-300",
                isLoading,
                href: "/recording?tab=Pending Cash",
            },
        ];
        return (
             <div className="space-y-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight font-headline flex items-center gap-3"><Video/> Video Workflow</h1>
                    <p className="text-muted-foreground">Welcome, {profile.name}. Here are your assigned video recording tasks.</p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {videoRecorderStats.map(card => <StatCard key={card.title} {...card} />)}
                </div>
            </div>
        )
    }
    
    return (
        <div className="space-y-8">
            <QuickAdd />

            <div>
                <h1 className="text-3xl font-bold tracking-tight font-headline flex items-center gap-3"><TrendingUp/> Statistics</h1>
                <p className="text-muted-foreground">A quick overview of your performance and key metrics in the last 30 days.</p>
            </div>
            
            {profile.role === 'Admin' && isTrialing && profile.trialEndDate && (
                 <Alert className="max-w-2xl mx-auto bg-primary/10 border-primary/30">
                    <Info className="h-4 w-4" />
                    <AlertTitle className="font-bold">
                        {profile.daysLeftInTrial > 1 ? `${profile.daysLeftInTrial} Days Left in Your Trial` : 'Your trial ends today!'}
                    </AlertTitle>
                    <AlertDescription>
                        Your 30-day free trial of the Basic plan ends on {format(new Date(profile.trialEndDate), 'PPP')}.
                        <Link href="/upgrade" className="font-semibold text-primary underline ml-2">Upgrade now</Link> to keep your premium features.
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {statCardsData.map(card => <StatCard key={card.title} {...card} />)}
            </div>
            
            <UpcomingEvents 
                appointments={finalAppointments || []} 
                isLoading={isAppointmentsLoading}
                onAddAppointment={handleAddAppointment}
                onAddEvent={handleAddEvent}
                onUpdateStatus={handleOpenStatusUpdate}
                onDelete={handleDeleteAppointment}
                onAddToCalendar={handleAddToCalendar}
                onAllEventsClick={() => setIsAllEventsOpen(true)}
            />

            {profile.role === 'Admin' && isTrialing && (
                <Card className="mt-12 bg-gradient-to-r from-primary/90 to-blue-500/90 text-primary-foreground shadow-2xl">
                    <div className="flex flex-col md:flex-row items-center justify-between p-8 gap-6">
                        <div className="flex-shrink-0">
                            <Gem className="w-16 h-16 opacity-80" />
                        </div>
                        <div className="text-center md:text-left">
                            <h2 className="text-3xl font-bold font-headline">Unlock Your Agency's Full Potential</h2>
                            <p className="mt-2 max-w-2xl opacity-90">Upgrade to the Standard plan to access powerful tools, manage more leads, and collaborate with a larger team. Boost your productivity today!</p>
                        </div>
                        <div className="flex-shrink-0">
                            <Button asChild size="lg" className="bg-background text-primary hover:bg-background/90 font-bold text-lg px-8 py-6 rounded-full shadow-lg transition-transform hover:scale-105">
                                <Link href="/upgrade">
                                    Upgrade Now <ArrowRight className="ml-2" />
                                </Link>
                            </Button>
                        </div>
                    </div>
                </Card>
            )}

            <SetAppointmentDialog 
                isOpen={isAppointmentOpen}
                setIsOpen={setIsAppointmentOpen}
                onSave={(data) => handleSaveAppointment(data as any)}
                appointmentDetails={appointmentDetails}
            />
            <AddEventDialog 
                isOpen={isEventOpen}
                setIsOpen={setIsEventOpen}
                onSave={handleSaveEvent}
            />
             {appointmentToUpdateStatus && newStatus && (
                <UpdateAppointmentStatusDialog
                    isOpen={!!appointmentToUpdateStatus}
                    setIsOpen={() => setAppointmentToUpdateStatus(null)}
                    appointment={appointmentToUpdateStatus}
                    newStatus={newStatus}
                    onUpdate={handleUpdateStatus}
                />
            )}
             <AllEventsDialog
                isOpen={isAllEventsOpen}
                setIsOpen={setIsAllEventsOpen}
                appointments={allAppointments || []}
            />
        </div>
    );
}
