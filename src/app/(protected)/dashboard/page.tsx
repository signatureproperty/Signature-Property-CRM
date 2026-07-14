'use client';
import React, { useMemo, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
    Building2, Users, DollarSign, Home, TrendingUp, Star, CalendarDays, 
    CheckCircle, Video, PlayCircle, Gem, ArrowRight, 
    VideoOff, Circle, Clock, History, FilePlus, UserPlus, Edit, ArrowUpRight,
    Plus, MessageSquareText, Calendar, MapPin, User, MessageSquare, Eye,
    Briefcase, Trash2, Undo2, Wallet
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useProfile } from '@/context/profile-context';
import { useFirestore } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useMemoFirebase } from '@/firebase/hooks';
import { collection, query, where, addDoc, doc, setDoc, deleteDoc, orderBy, limit, or, updateDoc, arrayRemove } from 'firebase/firestore';
import type { Property, Buyer, Appointment, AppointmentContactType, Activity, LeadNote, ProvidedService } from '@/lib/types';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { subDays, parseISO, format, formatDistanceToNow } from 'date-fns';
import { useCurrency } from '@/context/currency-context';
import { formatCurrency } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UpcomingEvents } from '@/components/upcoming-events';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { AppLoader } from '@/components/ui/loader';

// --- Lazy Loaded Components ---
const SetAppointmentDialog = dynamic(() => import('@/components/set-appointment-dialog').then(mod => mod.SetAppointmentDialog), { ssr: false });
const AddEventDialog = dynamic(() => import('@/components/add-event-dialog').then(mod => mod.AddEventDialog), { ssr: false });
const AllEventsDialog = dynamic(() => import('@/components/all-events-dialog').then(mod => mod.AllEventsDialog), { ssr: false });
const PerformanceChart = dynamic(() => import('@/components/performance-chart').then(mod => mod.PerformanceChart), { 
    ssr: false, 
    loading: () => <Skeleton className="h-[400px] w-full rounded-2xl" /> 
});
const LeadsChart = dynamic(() => import('@/components/leads-chart').then(mod => mod.LeadsChart), { 
    ssr: false,
    loading: () => <Skeleton className="h-[400px] w-full rounded-2xl" />
});
const SalesBreakdownChart = dynamic(() => import('@/components/sales-breakdown-chart').then(mod => mod.SalesBreakdownChart), { 
    ssr: false,
    loading: () => <Skeleton className="h-[400px] w-full rounded-2xl" />
});
const BuyerNotesDialog = dynamic(() => import('@/components/buyer-notes-dialog').then(mod => mod.BuyerNotesDialog), { ssr: false });
const PropertyNotesDialog = dynamic(() => import('@/components/property-notes-dialog').then(mod => mod.PropertyNotesDialog), { ssr: false });
const BuyerDetailsDialog = dynamic(() => import('@/components/buyer-details-dialog').then(mod => mod.BuyerDetailsDialog), { ssr: false });
const PropertyDetailsDialog = dynamic(() => import('@/components/property-details-dialog').then(mod => mod.PropertyDetailsDialog), { ssr: false });

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
    const CardContentWrapper = (href ? Link : 'div') as any;

    if (isLoading) {
        return (
            <Card className="border-none shadow-md bg-card/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground"><Skeleton className="h-3 w-20" /></CardTitle>
                    <Skeleton className="h-8 w-8 rounded-full" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-7 w-16" />
                    {change && <Skeleton className="h-3 w-24 mt-2" />}
                </CardContent>
            </Card>
        );
    }

    return (
        <CardContentWrapper href={href || ''} className={cn("block transition-all rounded-2xl group", href && "hover:scale-[1.02]")}>
            <Card className="h-full border border-primary/10 shadow-xl hover:shadow-2xl transition-all duration-300 bg-card/60 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground">{title}</CardTitle>
                    <div className={cn("flex items-center justify-center rounded-xl h-10 w-10 shadow-inner transition-transform group-hover:rotate-12", color)}>
                        {icon}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-black font-headline tracking-tight">{value}</div>
                     {change && (
                        <p className={cn(
                            "text-[10px] font-bold mt-1 flex items-center gap-1",
                            change.startsWith('+') ? "text-emerald-500" : "text-muted-foreground"
                        )}>
                            {change.startsWith('+') && <ArrowUpRight className="h-3 w-3" />}
                            {change}
                        </p>
                     )}
                </CardContent>
            </Card>
        </CardContentWrapper>
    );
};

const getActionIcon = (action: string) => {
    if (action.includes('added a new property')) return <FilePlus className="h-3.5 w-3.5" />;
    if (action.includes('added a new buyer')) return <UserPlus className="h-3.5 w-3.5" />;
    if (action.includes('updated the status')) return <Edit className="h-3.5 w-3.5" />;
    if (action.includes('marked property as "Sold"')) return <CheckCircle className="h-3.5 w-3.5" />;
    return <Circle className="h-3.5 w-3.5" />;
};

export default function OverviewPage() {
    const { profile, isLoading: isProfileLoading } = useProfile();
    const firestore = useFirestore();
    const { currency } = useCurrency();
    const { toast } = useToast();
    
    const [isAppointmentOpen, setIsAppointmentOpen] = useState(false);
    const [isEventOpen, setIsEventOpen] = useState(false);
    const [isAllEventsOpen, setIsAllEventsOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Details state
    const [selectedApptForDetails, setSelectedApptForDetails] = useState<Appointment | null>(null);
    const [isLeadDetailsOpen, setIsLeadDetailsOpen] = useState(false);
    const [selectedLeadForFullDetails, setSelectedLeadForFullDetails] = useState<Buyer | Property | null>(null);

    // Remarks management
    const [selectedLead, setSelectedLead] = useState<Buyer | Property | null>(null);
    const [isRemarksOpen, setIsRemarksOpen] = useState(false);

    const [appointmentDetails, setAppointmentDetails] = useState<{
        contactType: AppointmentContactType;
        contactName: string;
        contactSerialNo?: string;
        message: string;
    } | null>(null);

    const canFetch = !isProfileLoading && profile.agency_id;
    const now = new Date();
    const last30DaysStart = subDays(now, 30);
    
    const isAgent = profile.role === 'Agent';
    const isRecorder = profile.role === 'Video Recorder';

    // --- Data Fetching ---
    const teamMembersQuery = useMemoFirebase(() => canFetch ? collection(firestore, 'agencies', profile.agency_id, 'teamMembers') : null, [canFetch, firestore, profile.agency_id]);
    const { data: teamMembers } = useCollection<any>(teamMembersQuery);

    const propertiesQuery = useMemoFirebase(() => {
        if (!canFetch) return null;
        const ref = collection(firestore, 'agencies', profile.agency_id, 'properties');
        
        if (isAgent) {
            return query(ref, or(where('created_by', '==', profile.user_id), where('assignedTo', 'array-contains', profile.user_id)));
        }
        
        if (isRecorder) {
            return query(ref, where('assignedTo', 'array-contains', profile.user_id));
        }

        return ref;
    }, [canFetch, firestore, profile.agency_id, isAgent, isRecorder, profile.user_id]);
    const { data: properties, isLoading: isPropertiesLoading } = useCollection<Property>(propertiesQuery);
    
    const buyersQuery = useMemoFirebase(() => {
        if (!canFetch) return null;
        const ref = collection(firestore, 'agencies', profile.agency_id, 'buyers');
        
        if (isAgent) {
            return query(ref, or(where('created_by', '==', profile.user_id), where('assignedTo', '==', profile.user_id)));
        }

        return ref;
    }, [canFetch, firestore, profile.agency_id, isAgent, profile.user_id]);
    const { data: buyers, isLoading: isBuyersLoading } = useCollection<Buyer>(buyersQuery);
    
    const appointmentsQuery = useMemoFirebase(() => {
        if (!canFetch) return null;
        const ref = collection(firestore, 'agencies', profile.agency_id, 'appointments');
        if (isAgent) {
            return query(ref, where('agentName', '==', profile.name));
        }
        return ref;
    }, [canFetch, firestore, profile.agency_id, isAgent, profile.name]);
    const { data: allAppointments, isLoading: isAppointmentsLoading } = useCollection<Appointment>(appointmentsQuery);
    
    const activitiesQuery = useMemoFirebase(() => {
        if (!canFetch) return null;
        return query(
            collection(firestore, 'agencies', profile.agency_id, 'activityLogs'), 
            orderBy('timestamp', 'desc'),
            limit(5)
        );
    }, [canFetch, firestore, profile.agency_id]);
    const { data: activities, isLoading: isActivitiesLoading } = useCollection<any>(activitiesQuery);

    const providedServicesQuery = useMemoFirebase(() => 
        canFetch ? collection(firestore, 'agencies', profile.agency_id, 'providedServices') : null,
        [canFetch, firestore, profile.agency_id]
    );
    const { data: providedServices } = useCollection<ProvidedService>(providedServicesQuery);

    const isLoading = isProfileLoading || isPropertiesLoading || isBuyersLoading || isAppointmentsLoading;

    // Collect all remarks from both properties and buyers
    const latestRemarks = useMemo(() => {
        const allRemarks: any[] = [];
        
        buyers?.forEach(b => {
            b.timeline_notes?.forEach(n => {
                allRemarks.push({ ...n, leadName: b.name, leadSerial: b.serial_no, leadType: 'Buyer', leadData: b });
            });
        });

        properties?.forEach(p => {
            p.timeline_notes?.forEach(n => {
                allRemarks.push({ ...n, leadName: p.auto_title, leadSerial: p.serial_no, leadType: 'Property', leadData: p });
            });
        });

        return allRemarks.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5);
    }, [buyers, properties]);

    const handleRemarkClick = (remark: any) => {
        setSelectedLead(remark.leadData);
        setIsRemarksOpen(true);
    };

    const handleDeleteRemark = async (remark: any) => {
        if (!profile.agency_id) return;
        const collectionName = remark.leadType === 'Buyer' ? 'buyers' : 'properties';
        const leadRef = doc(firestore, 'agencies', profile.agency_id, collectionName, remark.leadData.id);
        
        const noteToRemove: LeadNote = {
            id: remark.id,
            text: remark.text,
            authorId: remark.authorId,
            authorName: remark.authorName,
            authorRole: remark.authorRole,
            timestamp: remark.timestamp,
            readBy: remark.readBy
        };

        updateDoc(leadRef, {
            timeline_notes: arrayRemove(noteToRemove)
        }).then(() => {
            toast({ title: "Remark Deleted" });
        }).catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
              path: leadRef.path,
              operation: 'update',
              requestResourceData: { timeline_notes: 'arrayRemove' },
            });
            errorEmitter.emit('permission-error', permissionError);
        });
    };

    const handleViewLeadFromAppointment = () => {
        if (!selectedApptForDetails || !selectedApptForDetails.contactSerialNo) return;
        
        const serial = selectedApptForDetails.contactSerialNo.toUpperCase();
        let lead: Buyer | Property | undefined;
        
        if (serial.startsWith('B') || serial.startsWith('RB')) {
            lead = buyers?.find(b => b.serial_no === serial);
        } else {
            lead = properties?.find(p => p.serial_no === serial);
        }

        if (lead) {
            setSelectedLeadForFullDetails(lead);
            setIsLeadDetailsOpen(true);
        } else {
            toast({ title: "Lead not found", description: "Could not find record for this serial number.", variant: 'destructive' });
        }
    };

    const stats = useMemo(() => {
        const activeProps = properties?.filter(p => !p.is_deleted) || [];
        const activeBuyers = buyers?.filter(b => !b.is_deleted) || [];

        const newProps30d = activeProps.filter(p => p.created_at && parseISO(p.created_at) >= last30DaysStart).length;
        const newBuyers30d = activeBuyers.filter(b => b.created_at && parseISO(b.created_at) >= last30DaysStart).length;

        const sold30d = activeProps.filter(p => p.status === 'Sold' && p.sale_date && parseISO(p.sale_date) >= last30DaysStart);
        const revenue30d = sold30d.reduce((sum, p) => sum + (p.total_commission || 0), 0);

        // Current month services
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const currentMonthName = format(now, 'MMMM');
        const monthServices = (providedServices || []).filter(s => s.created_at && parseISO(s.created_at) >= currentMonthStart);
        const monthServiceRevenue = monthServices.reduce((sum, s) => sum + (s.amountPaid || 0), 0);
        const monthServiceDue = monthServices.filter(s => s.paymentStatus !== 'Paid').reduce((sum, s) => sum + (s.priceCharged - (s.amountPaid || 0)), 0);

        return {
            totalProperties: activeProps.filter(p => !p.is_for_rent).length,
            totalBuyers: activeBuyers.filter(b => b.listing_type !== 'For Rent').length,
            rentProperties: activeProps.filter(p => p.is_for_rent && p.status === 'Available').length,
            rentBuyers: activeBuyers.filter(b => b.listing_type === 'For Rent').length,
            soldCount: sold30d.length,
            revenue: revenue30d,
            newProps30d,
            newBuyers30d,
            interested: activeBuyers.filter(b => b.status === 'Interested').length,
            upcomingAppts: (allAppointments || []).filter(a => a.status === 'Scheduled' && new Date(a.date) >= now).length,
            returnedLeads: activeBuyers.filter(b => b.tags?.includes('Returned') && !b.assignedTo).length,
            serviceRevenue: (providedServices || []).reduce((sum, s) => sum + (s.amountPaid || 0), 0),
            serviceRevenueCount: (providedServices || []).filter(s => s.paymentStatus === 'Paid').length,
            serviceDue: (providedServices || []).filter(s => s.paymentStatus !== 'Paid').reduce((sum, s) => sum + (s.priceCharged - (s.amountPaid || 0)), 0),
            serviceDueCount: (providedServices || []).filter(s => s.paymentStatus !== 'Paid').length,
            monthServiceCount: monthServices.length,
            monthServiceRevenue,
            monthServiceDue,
            currentMonthName,
        };
    }, [properties, buyers, allAppointments, providedServices, last30DaysStart, now]);

    const statCards: StatCardProps[] = [
        { title: "Sale Properties", value: stats.totalProperties, change: `+${stats.newProps30d} new`, icon: <Home className="h-5 w-5" />, color: "bg-blue-500/10 text-blue-600", href: "/properties", isLoading },
        { title: "Sale Buyers", value: stats.totalBuyers, change: `+${stats.newBuyers30d} new`, icon: <Users className="h-5 w-5" />, color: "bg-indigo-500/10 text-indigo-600", href: "/buyers", isLoading },
        { title: "Rent Properties", value: stats.rentProperties, change: "Active", icon: <Building2 className="h-5 w-5" />, color: "bg-emerald-500/10 text-emerald-600", href: "/properties?listing_type=For+Rent", isLoading },
        { title: "Rent Buyers", value: stats.rentBuyers, change: "Active", icon: <Users className="h-5 w-5" />, color: "bg-teal-500/10 text-teal-600", href: "/buyers?listing_type=For+Rent", isLoading },
        { title: "Interested", value: stats.interested, change: "Hot leads", icon: <Star className="h-5 w-5" />, color: "bg-purple-500/10 text-purple-600", href: "/buyers?status=Interested", isLoading },
    ];

    if (!isAgent) {
        statCards.splice(4, 0, { title: "Revenue (30d)", value: formatCurrency(stats.revenue, currency, { notation: 'compact' }), change: `From ${stats.soldCount} deals`, icon: <DollarSign className="h-5 w-5" />, color: "bg-amber-500/10 text-amber-600", href: "/reports", isLoading });
        statCards.splice(5, 0, { title: "Services Revenue", value: formatCurrency(stats.serviceRevenue, currency, { notation: 'compact' }), change: `${stats.currentMonthName}: ${formatCurrency(stats.monthServiceRevenue, currency, { notation: 'compact' })}`, icon: <Briefcase className="h-5 w-5" />, color: "bg-cyan-500/10 text-cyan-600", href: "/services", isLoading });
        statCards.splice(6, 0, { title: "Due Payments", value: formatCurrency(stats.serviceDue, currency, { notation: 'compact' }), change: `${stats.currentMonthName}: ${formatCurrency(stats.monthServiceDue, currency, { notation: 'compact' })}`, icon: <Wallet className="h-5 w-5" />, color: "bg-rose-500/10 text-rose-600", href: "/services", isLoading });
        statCards.splice(7, 0, { title: "Services Sold", value: stats.monthServiceCount, change: `${stats.currentMonthName} total`, icon: <CheckCircle className="h-5 w-5" />, color: "bg-violet-500/10 text-violet-600", href: "/services", isLoading });
    }

    if (!isAgent && !isRecorder) {
        statCards.push({
            title: "Returned Leads",
            value: stats.returnedLeads,
            change: "From Agents",
            icon: <Undo2 className="h-5 w-5" />,
            color: "bg-red-500/10 text-red-600",
            href: "/buyers?status=Returned",
            isLoading
        });
    }

    if (!mounted) {
        return (
            <div className="flex h-[calc(100vh-140px)] items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <AppLoader />
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Loading Workspace...</p>
                </div>
            </div>
        );
    }

    if (isRecorder) {
        const assigned = properties || [];
        const recorderStats: StatCardProps[] = [
            { title: "Pending", value: assigned.filter(p => !p.is_recorded).length, icon: <VideoOff className="h-5 w-5" />, color: "bg-red-500/10 text-red-600", isLoading, href: "/recording" },
            { title: "In Editing", value: assigned.filter(p => p.is_recorded && p.editing_status === 'In Editing').length, icon: <PlayCircle className="h-5 w-5" />, color: "bg-yellow-500/10 text-yellow-600", isLoading, href: "/editing" },
            { title: "Paid Online", value: assigned.filter(p => p.recording_payment_status === 'Paid Online').length, icon: <CheckCircle className="h-5 w-5" />, color: "bg-emerald-500/10 text-emerald-600", isLoading, href: "/recording?tab=Paid Online" },
            { title: "Pending Cash", value: assigned.filter(p => p.recording_payment_status === 'Pending Cash').length, icon: <Clock className="h-5 w-5" />, color: "bg-purple-500/10 text-purple-600", isLoading, href: "/recording?tab=Pending Cash" },
        ];
        return (
             <div className="space-y-8 animate-fade-in">
                <div>
                    <h1 className="text-3xl font-black tracking-tight font-headline flex items-center gap-3">Workflow Dashboard</h1>
                    <p className="text-muted-foreground font-medium">Hello, {profile.name}. Here is your recording queue.</p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {recorderStats.map(card => <StatCard key={card.title} {...card} />)}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-10 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight font-headline flex items-center gap-3">
                        <TrendingUp className="h-8 w-8 text-primary" /> Overview
                    </h1>
                    <p className="text-muted-foreground font-medium">Your agency's performance at a glance.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" className="rounded-full shadow-sm" onClick={() => setIsAllEventsOpen(true)}>
                        <CalendarDays className="mr-2 h-4 w-4" /> Full Calendar
                    </Button>
                    <Button className="rounded-full glowing-btn" onClick={() => { setAppointmentDetails(null); setIsAppointmentOpen(true); }}>
                        <Plus className="mr-2 h-4 w-4" /> New Appt
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {statCards.map(card => <StatCard key={card.title} {...card} />)}
            </div>

            {/* Dashboard Content filtered by Role */}
            {!isAgent ? (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                    <div className="xl:col-span-2 space-y-8">
                        <PerformanceChart properties={properties || []} />
                        
                        {/* Latest Remarks Section */}
                        <Card className="border-none shadow-xl bg-card/60 backdrop-blur-sm rounded-2xl overflow-hidden">
                            <CardHeader className="pb-3 border-b border-border/30">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                        <MessageSquareText className="h-4 w-4 text-primary" /> Latest Lead Remarks
                                    </CardTitle>
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Real-time Feed</span>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <ScrollArea className="h-[300px]">
                                    {latestRemarks.length > 0 ? (
                                        <div className="divide-y divide-border/30">
                                            {latestRemarks.map((remark) => (
                                                <div 
                                                    key={remark.id} 
                                                    className="p-4 hover:bg-primary/5 transition-colors cursor-pointer group"
                                                    onClick={() => handleRemarkClick(remark)}
                                                >
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="font-bold text-xs">{remark.authorName}</span>
                                                                <Badge variant="outline" className="text-[9px] uppercase h-4 px-1">{remark.authorRole}</Badge>
                                                                <span className="text-[10px] text-muted-foreground ml-auto">
                                                                    {mounted ? formatDistanceToNow(new Date(remark.timestamp), { addSuffix: true }) : '...'}
                                                                </span>
                                                                {profile.role === 'Admin' && (
                                                                    <Button 
                                                                        size="icon" 
                                                                        variant="ghost" 
                                                                        className="h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                                                                        onClick={(e) => { e.stopPropagation(); handleDeleteRemark(remark); }}
                                                                    >
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                            <p className="text-sm text-foreground mb-2 leading-relaxed line-clamp-2">"{remark.text}"</p>
                                                            <div className="inline-flex items-center gap-1.5 text-[10px] font-black text-primary hover:underline uppercase tracking-wider">
                                                                {remark.leadType === 'Buyer' ? <Briefcase className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
                                                                {remark.leadSerial}: {remark.leadName}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground opacity-40">
                                            <MessageSquareText className="h-10 w-10 mb-2" />
                                            <p className="text-xs font-bold uppercase tracking-widest">No remarks yet</p>
                                        </div>
                                    )}
                                </ScrollArea>
                            </CardContent>
                        </Card>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <LeadsChart properties={properties || []} buyers={buyers || []} />
                            <SalesBreakdownChart properties={properties || []} />
                        </div>
                    </div>

                    <div className="space-y-8">
                        <UpcomingEvents 
                            appointments={allAppointments || []} 
                            isLoading={isAppointmentsLoading}
                            onAddAppointment={() => setIsAppointmentOpen(true)}
                            onAddEvent={() => setIsEventOpen(true)}
                            onUpdateStatus={async (a, s) => { 
                                if (!profile.agency_id) return;
                                await setDoc(doc(firestore, 'agencies', profile.agency_id, 'appointments', a.id), { status: s }, { merge: true });
                                toast({ title: `Marked as ${s}` });
                            }}
                            onDelete={async (a) => {
                                if (!profile.agency_id) return;
                                await deleteDoc(doc(firestore, 'agencies', profile.agency_id, 'appointments', a.id));
                                toast({ title: 'Appointment Deleted' });
                            }}
                            onAddToCalendar={(e, a) => {
                                const start = format(new Date(`${a.date}T${a.time}`), "yyyyMMdd'T'HHmmss");
                                const end = format(new Date(`${a.date}T${a.time}`), "yyyyMMdd'T'HHmmss"); 
                                window.open(`https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(a.contactName)}&dates=${start}/${end}&details=${encodeURIComponent(a.message)}`, '_blank');
                            }}
                            onAllEventsClick={() => setIsAllEventsOpen(true)}
                            onViewDetails={(a) => setSelectedApptForDetails(a)}
                        />

                        <Card className="border-none shadow-xl bg-card/60 backdrop-blur-sm rounded-2xl overflow-hidden">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                    <History className="h-4 w-4 text-primary" /> Recent Actions
                                </CardTitle>
                                <Link href="/activities" className="text-[10px] font-bold text-primary hover:underline">VIEW ALL</Link>
                            </CardHeader>
                            <CardContent className="p-0">
                                {isActivitiesLoading ? (
                                    <div className="p-4 space-y-4">
                                        {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
                                    </div>
                                ) : !activities || activities.length === 0 ? (
                                    <p className="text-center text-xs text-muted-foreground py-10">No recent activity.</p>
                                ) : (
                                    <div className="divide-y divide-border/30">
                                        {activities.map(act => (
                                            <div key={act.id} className="p-4 flex items-start gap-3 hover:bg-accent/30 transition-colors">
                                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                                                    {getActionIcon(act.action)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold truncate">
                                                        {act.userName} <span className="font-normal text-muted-foreground">{act.action}</span>
                                                    </p>
                                                    <p className="text-[10px] font-medium text-primary/80 truncate mt-0.5">{act.target}</p>
                                                    <p className="text-[9px] text-muted-foreground mt-1 uppercase font-bold tracking-tighter">
                                                        {mounted ? format(new Date(act.timestamp), 'p') : '...'}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            ) : (
                /* Simplified Agent View: Only Planner and Welcome Card */
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2">
                        <UpcomingEvents 
                            appointments={allAppointments || []} 
                            isLoading={isAppointmentsLoading}
                            onAddAppointment={() => setIsAppointmentOpen(true)}
                            onAddEvent={() => setIsEventOpen(true)}
                            onUpdateStatus={async (a, s) => { 
                                if (!profile.agency_id) return;
                                await setDoc(doc(firestore, 'agencies', profile.agency_id, 'appointments', a.id), { status: s }, { merge: true });
                                toast({ title: `Marked as ${s}` });
                            }}
                            onDelete={async (a) => {
                                if (!profile.agency_id) return;
                                await deleteDoc(doc(firestore, 'agencies', profile.agency_id, 'appointments', a.id));
                                toast({ title: 'Appointment Deleted' });
                            }}
                            onAddToCalendar={(e, a) => {
                                const start = format(new Date(`${a.date}T${a.time}`), "yyyyMMdd'T'HHmmss");
                                const end = format(new Date(`${a.date}T${a.time}`), "yyyyMMdd'T'HHmmss"); 
                                window.open(`https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(a.contactName)}&dates=${start}/${end}&details=${encodeURIComponent(a.message)}`, '_blank');
                            }}
                            onAllEventsClick={() => setIsAllEventsOpen(true)}
                            onViewDetails={(a) => setSelectedApptForDetails(a)}
                        />
                    </div>
                    <div className="space-y-6">
                        <Card className="border-none shadow-xl bg-gradient-to-br from-primary/10 to-blue-500/10 p-8 rounded-3xl border-primary/20">
                            <h3 className="text-2xl font-black font-headline mb-3 text-primary tracking-tight">Welcome, {profile.name}!</h3>
                            <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                                This is your personalized workspace. Stay updated with your daily planner and manage your assigned leads efficiently.
                            </p>
                            <Button asChild variant="outline" className="mt-6 w-full rounded-xl font-bold bg-background/50 border-primary/20 hover:bg-primary/5">
                                <Link href="/appointments">Manage All Appointments</Link>
                            </Button>
                        </Card>

                        <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md rounded-2xl p-6 text-center">
                            <div className="h-12 w-12 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-3 text-emerald-600">
                                <CheckCircle className="h-6 w-6" />
                            </div>
                            <h4 className="font-bold text-sm">Personal Goal</h4>
                            <p className="text-xs text-muted-foreground mt-1">Focus on following up with your "Interested" buyers today.</p>
                            <Button asChild size="sm" variant="link" className="mt-2 text-xs font-bold text-primary p-0">
                                <Link href="/buyers?status=Interested">View Interested Buyers <ArrowRight className="h-3 w-3 ml-1" /></Link>
                            </Button>
                        </Card>
                    </div>
                </div>
            )}

            {profile.role === 'Admin' && (
                <Card className="bg-gradient-to-br from-primary to-blue-600 text-primary-foreground border-none shadow-2xl rounded-[2rem] overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform duration-500">
                        <Gem className="h-48 w-48" />
                    </div>
                    <div className="p-10 md:p-14 relative z-10 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
                        <div className="space-y-4">
                            <h2 className="text-4xl font-black font-headline tracking-tighter leading-tight">Scale Your Real Estate <br/> Empire with Premium</h2>
                            <p className="max-w-xl text-primary-foreground/80 font-medium text-lg">
                                Standard plan offers unlimited leads, full team collaboration, and advanced financial analytics to boost your agency performance.
                            </p>
                        </div>
                        <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90 rounded-full px-12 h-16 font-black text-xl shadow-xl transition-all hover:scale-105 active:scale-95">
                            <Link href="/upgrade">Upgrade Now <ArrowRight className="ml-2 h-6 w-6" /></Link>
                        </Button>
                    </div>
                </Card>
            )}

            {isAppointmentOpen && (
                <SetAppointmentDialog 
                    isOpen={isAppointmentOpen} 
                    setIsOpen={setIsAppointmentOpen} 
                    onSave={async (a) => {
                        if (!profile.agency_id) return;
                        await addDoc(collection(firestore, 'agencies', profile.agency_id, 'appointments'), { ...a, agency_id: profile.agency_id, status: 'Scheduled' });
                        const assignedAgent = teamMembers?.find(m => m.name === a.agentName);
                        if (assignedAgent && (assignedAgent.user_id || assignedAgent.id) !== profile.user_id) {
                            await addDoc(collection(firestore, 'agencies', profile.agency_id, 'activityLogs'), {
                                userName: profile.name,
                                action: 'assigned an appointment',
                                target: a.contactName,
                                targetType: 'Appointment',
                                timestamp: new Date().toISOString(),
                                agency_id: profile.agency_id,
                                assignedToId: assignedAgent.user_id || assignedAgent.id,
                                assignedToName: assignedAgent.name
                            });
                        }
                        toast({ title: 'Appointment Scheduled' });
                    }} 
                    appointmentDetails={appointmentDetails ?? undefined} 
                />
            )}
            
            {isEventOpen && (
                <AddEventDialog isOpen={isEventOpen} setIsOpen={setIsEventOpen} onSave={async (e) => {
                    if (!profile.agency_id) return;
                    await addDoc(collection(firestore, 'agencies', profile.agency_id, 'appointments'), { 
                        contactName: e.title, contactType: 'Owner', message: e.description || 'Custom Event',
                        agentName: profile.name, date: e.date, time: e.time, status: 'Scheduled', agency_id: profile.agency_id
                    });
                    toast({ title: 'Event Created' });
                }} />
            )}

            {isAllEventsOpen && (
                <AllEventsDialog isOpen={isAllEventsOpen} setIsOpen={setIsAllEventsOpen} appointments={allAppointments || []} />
            )}

            {selectedApptForDetails && (
                <Dialog open={!!selectedApptForDetails} onOpenChange={() => setSelectedApptForDetails(null)}>
                    <DialogContent className="sm:max-w-md bg-background">
                        <DialogHeader>
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "p-3 rounded-2xl",
                                    selectedApptForDetails.contactType === 'Buyer' ? "bg-sky-500/10 text-sky-600" : "bg-purple-500/10 text-purple-600"
                                )}>
                                    {selectedApptForDetails.contactType === 'Buyer' ? <Briefcase className="h-6 w-6" /> : <Building2 className="h-6 w-6" />}
                                </div>
                                <div>
                                    <DialogTitle className="text-xl font-black font-headline">{selectedApptForDetails.contactName}</DialogTitle>
                                    <DialogDescription className="font-bold flex items-center gap-2">
                                        <Calendar className="h-3 w-3" /> {mounted ? format(parseISO(selectedApptForDetails.date), 'PPPP') : '...'}
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>
                        <div className="space-y-6 py-4">
                            <div className="flex items-center gap-6 px-1">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest block">Time</span>
                                    <span className="font-bold flex items-center gap-1.5"><Clock className="h-4 w-4 text-primary" /> {selectedApptForDetails.time}</span>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest block">Agent</span>
                                    <span className="font-bold flex items-center gap-1.5"><User className="h-4 w-4 text-primary" /> {selectedApptForDetails.agentName}</span>
                                </div>
                                <div className="space-y-1 ml-auto">
                                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest block text-right">Status</span>
                                    <Badge variant={selectedApptForDetails.status === 'Scheduled' ? 'secondary' : 'default'} className="uppercase text-[9px] font-black">{selectedApptForDetails.status}</Badge>
                                </div>
                            </div>
                            
                            <Separator />
                            
                            <div className="space-y-2">
                                <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                                    <MessageSquare className="h-3 w-3" /> Purpose & Message
                                </span>
                                <div className="p-4 bg-muted/20 rounded-2xl border border-border/40 text-sm font-medium leading-relaxed">
                                    {selectedApptForDetails.message}
                                </div>
                            </div>

                            {selectedApptForDetails.contactSerialNo && (
                                <Button 
                                    className="w-full rounded-2xl h-12 glowing-btn gap-2"
                                    onClick={handleViewLeadFromAppointment}
                                >
                                    <Eye className="h-4 w-4" /> View Full File ({selectedApptForDetails.contactSerialNo})
                                </Button>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {isLeadDetailsOpen && selectedLeadForFullDetails && (
                <>
                    { 'serial_no' in selectedLeadForFullDetails && (selectedLeadForFullDetails.serial_no.startsWith('B') || selectedLeadForFullDetails.serial_no.startsWith('RB')) ? (
                        <BuyerDetailsDialog 
                            buyer={selectedLeadForFullDetails as Buyer} 
                            isOpen={isLeadDetailsOpen} 
                            setIsOpen={setIsLeadDetailsOpen} 
                        />
                    ) : (
                        <PropertyDetailsDialog 
                            property={selectedLeadForFullDetails as Property} 
                            isOpen={isLeadDetailsOpen} 
                            setIsOpen={setIsLeadDetailsOpen} 
                        />
                    )}
                </>
            )}

            {selectedLead && isRemarksOpen && (
                <>
                    { 'serial_no' in selectedLead && (selectedLead.serial_no.startsWith('B') || selectedLead.serial_no.startsWith('RB')) ? (
                        <BuyerNotesDialog 
                            buyer={selectedLead as Buyer} 
                            isOpen={isRemarksOpen} 
                            setIsOpen={setIsRemarksOpen} 
                        />
                    ) : (
                        <PropertyNotesDialog 
                            property={selectedLead as Property} 
                            isOpen={isRemarksOpen} 
                            setIsOpen={setIsRemarksOpen} 
                        />
                    )}
                </>
            )}
        </div>
    );
}
