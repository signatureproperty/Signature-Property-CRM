
'use client';
import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
    Building2, Users, DollarSign, Home, TrendingUp, Star, CalendarDays, 
    CheckCircle, Briefcase, Info, Video, PlayCircle, Gem, ArrowRight, 
    VideoOff, Circle, Clock, History, FilePlus, UserPlus, Edit, Check, X, ArrowUpRight,
    Plus
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useProfile } from '@/context/profile-context';
import { useFirestore } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useMemoFirebase } from '@/firebase/hooks';
import { collection, query, where, Timestamp, addDoc, doc, setDoc, deleteDoc, orderBy, limit } from 'firebase/firestore';
import type { Property, Buyer, Appointment, User, PriceUnit, AppointmentContactType, AppointmentStatus, Activity, ListingType } from '@/lib/types';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { subDays, isWithinInterval, parseISO, format, addDays } from 'date-fns';
import { useCurrency } from '@/context/currency-context';
import { formatCurrency, formatUnit } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { UpcomingEvents } from '@/components/upcoming-events';
import { SetAppointmentDialog } from '@/components/set-appointment-dialog';
import { useToast } from '@/hooks/use-toast';
import { AddEventDialog, type EventDetails } from '@/components/add-event-dialog';
import { UpdateAppointmentStatusDialog } from '@/components/update-appointment-status-dialog';
import { AllEventsDialog } from '@/components/all-events-dialog';
import { PerformanceChart } from '@/components/performance-chart';
import { LeadsChart } from '@/components/leads-chart';
import { SalesBreakdownChart } from '@/components/sales-breakdown-chart';
import { Badge } from '@/components/ui/badge';

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
            <Card className="border-none shadow-sm bg-card/50">
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
            <Card className="h-full border-none shadow-sm hover:shadow-md transition-shadow bg-card/60 backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground">{title}</CardTitle>
                    <div className={cn("flex items-center justify-center rounded-xl h-10 w-10 transition-transform group-hover:rotate-12", color)}>
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
    const isAgent = profile.role === 'Agent';

    // --- Data Fetching ---
    const propertiesQuery = useMemoFirebase(() => {
        if (!canFetch) return null;
        const ref = collection(firestore, 'agencies', profile.agency_id, 'properties');
        return isAgent ? query(ref, where('created_by', '==', profile.user_id)) : ref;
    }, [canFetch, firestore, profile.agency_id, isAgent, profile.user_id]);
    const { data: properties, isLoading: isPropertiesLoading } = useCollection<Property>(propertiesQuery);
    
    const buyersQuery = useMemoFirebase(() => {
        if (!canFetch) return null;
        const ref = collection(firestore, 'agencies', profile.agency_id, 'buyers');
        return isAgent ? query(ref, where('created_by', '==', profile.user_id)) : ref;
    }, [canFetch, firestore, profile.agency_id, isAgent, profile.user_id]);
    const { data: buyers, isLoading: isBuyersLoading } = useCollection<Buyer>(buyersQuery);
    
    const appointmentsQuery = useMemoFirebase(() => 
        canFetch ? collection(firestore, 'agencies', profile.agency_id, 'appointments') : null, 
    [canFetch, firestore, profile.agency_id]);
    const { data: allAppointments, isLoading: isAppointmentsLoading } = useCollection<Appointment>(appointmentsQuery);
    
    const activitiesQuery = useMemoFirebase(() => {
        if (!canFetch) return null;
        return query(
            collection(firestore, 'agencies', profile.agency_id, 'activityLogs'), 
            orderBy('timestamp', 'desc'),
            limit(5)
        );
    }, [canFetch, firestore, profile.agency_id]);
    const { data: activities, isLoading: isActivitiesLoading } = useCollection<Activity>(activitiesQuery);

    const isLoading = isProfileLoading || isPropertiesLoading || isBuyersLoading || isAppointmentsLoading;

    const stats = useMemo(() => {
        const activeProps = properties?.filter(p => !p.is_deleted) || [];
        const activeBuyers = buyers?.filter(b => !b.is_deleted) || [];

        const newProps30d = activeProps.filter(p => p.created_at && parseISO(p.created_at) >= last30DaysStart).length;
        const newBuyers30d = activeBuyers.filter(b => b.created_at && parseISO(b.created_at) >= last30DaysStart).length;

        const sold30d = activeProps.filter(p => p.status === 'Sold' && p.sale_date && parseISO(p.sale_date) >= last30DaysStart);
        const revenue30d = sold30d.reduce((sum, p) => sum + (p.total_commission || 0), 0);

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
            upcomingAppts: (allAppointments || []).filter(a => a.status === 'Scheduled' && new Date(a.date) >= now).length
        };
    }, [properties, buyers, allAppointments, last30DaysStart]);

    const statCards: StatCardProps[] = [
        { title: "Sale Properties", value: stats.totalProperties, change: `+${stats.newProps30d} new`, icon: <Home className="h-5 w-5" />, color: "bg-blue-500/10 text-blue-600", href: "/properties", isLoading },
        { title: "Sale Buyers", value: stats.totalBuyers, change: `+${stats.newBuyers30d} new`, icon: <Users className="h-5 w-5" />, color: "bg-indigo-500/10 text-indigo-600", href: "/buyers", isLoading },
        { title: "Rent Properties", value: stats.rentProperties, change: "Active", icon: <Building2 className="h-5 w-5" />, color: "bg-emerald-500/10 text-emerald-600", href: "/properties?listing_type=For+Rent", isLoading },
        { title: "Rent Buyers", value: stats.rentBuyers, change: "Active", icon: <Users className="h-5 w-5" />, color: "bg-teal-500/10 text-teal-600", href: "/buyers?listing_type=For+Rent", isLoading },
        { title: "Revenue (30d)", value: formatCurrency(stats.revenue, currency, { notation: 'compact' }), change: `From ${stats.soldCount} deals`, icon: <DollarSign className="h-5 w-5" />, color: "bg-amber-500/10 text-amber-600", href: "/reports", isLoading },
        { title: "Interested", value: stats.interested, change: "Hot leads", icon: <Star className="h-5 w-5" />, color: "bg-purple-500/10 text-purple-600", href: "/buyers?status=Interested", isLoading },
    ];

    if (profile.role === 'Video Recorder') {
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
                    <Button variant="outline" className="rounded-full" onClick={() => setIsAllEventsOpen(true)}>
                        <CalendarDays className="mr-2 h-4 w-4" /> Calendar
                    </Button>
                    <Button className="rounded-full glowing-btn" onClick={() => setIsAppointmentOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" /> New Appt
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {statCards.map(card => <StatCard key={card.title} {...card} />)}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2 space-y-8">
                    <PerformanceChart properties={properties || []} />
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
                        onUpdateStatus={(a, s) => { setAppointmentToUpdateStatus(a); setNewStatus(s); }}
                        onDelete={async (a) => {
                            if (!profile.agency_id) return;
                            await deleteDoc(doc(firestore, 'agencies', profile.agency_id, 'appointments', a.id));
                            toast({ title: 'Appointment Deleted' });
                        }}
                        onAddToCalendar={(e, a) => {
                            const start = format(new Date(`${a.date}T${a.time}`), "yyyyMMdd'T'HHmmss");
                            const end = format(addDays(new Date(`${a.date}T${a.time}`), 0), "yyyyMMdd'T'HHmmss"); // Set specific duration if needed
                            window.open(`https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(a.contactName)}&dates=${start}/${end}&details=${encodeURIComponent(a.message)}`, '_blank');
                        }}
                        onAllEventsClick={() => setIsAllEventsOpen(true)}
                    />

                    <Card className="border-none shadow-sm bg-card/60 backdrop-blur-sm rounded-2xl overflow-hidden">
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
                                                    {format(new Date(act.timestamp), 'p')}
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

            <SetAppointmentDialog isOpen={isAppointmentOpen} setIsOpen={setIsAppointmentOpen} onSave={async (a) => {
                if (!profile.agency_id) return;
                await addDoc(collection(firestore, 'agencies', profile.agency_id, 'appointments'), { ...a, agency_id: profile.agency_id, status: 'Scheduled' });
                toast({ title: 'Appointment Scheduled' });
            }} appointmentDetails={appointmentDetails} />
            
            <AddEventDialog isOpen={isEventOpen} setIsOpen={setIsEventOpen} onSave={async (e) => {
                if (!profile.agency_id) return;
                await addDoc(collection(firestore, 'agencies', profile.agency_id, 'appointments'), { 
                    contactName: e.title, contactType: 'Owner', message: e.description || 'Custom Event',
                    agentName: profile.name, date: e.date, time: e.time, status: 'Scheduled', agency_id: profile.agency_id
                });
                toast({ title: 'Event Created' });
            }} />

            {appointmentToUpdateStatus && newStatus && (
                <UpdateAppointmentStatusDialog
                    isOpen={!!appointmentToUpdateStatus}
                    setIsOpen={() => setAppointmentToUpdateStatus(null)}
                    appointment={appointmentToUpdateStatus}
                    newStatus={newStatus}
                    onUpdate={async (id, s, n) => {
                        if (!profile.agency_id) return;
                        await setDoc(doc(firestore, 'agencies', profile.agency_id, 'appointments', id), { status: s, notes: n || '' }, { merge: true });
                        toast({ title: `Marked as ${s}` });
                    }}
                />
            )}
            <AllEventsDialog isOpen={isAllEventsOpen} setIsOpen={setIsAllEventsOpen} appointments={allAppointments || []} />
        </div>
    );
}
