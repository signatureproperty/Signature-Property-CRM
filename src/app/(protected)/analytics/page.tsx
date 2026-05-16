'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
    TrendingUp, 
    Building2, 
    Users, 
    DollarSign, 
    BarChart3, 
    Target,
    Award,
    ArrowUpRight,
    Activity as ActivityIcon,
    ChevronRight,
    History,
    MessageSquare,
    CheckCircle,
    Calendar,
    Clock,
    Zap
} from 'lucide-react';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    BarChart, Bar, Cell
} from 'recharts';
import { useProfile } from '@/context/profile-context';
import { useFirestore } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useMemoFirebase } from '@/firebase/hooks';
import { collection, query, orderBy } from 'firebase/firestore';
import { Property, Buyer, Appointment, User, Activity } from '@/lib/types';
import { format, parseISO, isAfter, subMonths, subDays, startOfMonth, eachMonthOfInterval } from 'date-fns';
import { formatCurrency, formatUnit } from '@/lib/formatters';
import { useCurrency } from '@/context/currency-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

type TimeRange = '7d' | '30d' | '6m' | '12m' | 'all';

export default function AnalyticsPage() {
    const { profile } = useProfile();
    const firestore = useFirestore();
    const { currency } = useCurrency();
    const [timeRange, setTimeRange] = useState<TimeRange>('30d');
    const [selectedAgentForReport, setSelectedAgentForReport] = useState<any | null>(null);

    // --- Data Fetching ---
    const propsQuery = useMemoFirebase(() => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'properties') : null, [profile.agency_id, firestore]);
    const { data: properties } = useCollection<Property>(propsQuery);

    const buyersQuery = useMemoFirebase(() => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'buyers') : null, [profile.agency_id, firestore]);
    const { data: buyers } = useCollection<Buyer>(buyersQuery);

    const teamQuery = useMemoFirebase(() => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'teamMembers') : null, [profile.agency_id, firestore]);
    const { data: teamMembers } = useCollection<User>(teamQuery);

    const apptsQuery = useMemoFirebase(() => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'appointments') : null, [profile.agency_id, firestore]);
    const { data: appointments } = useCollection<Appointment>(apptsQuery);

    const activityQuery = useMemoFirebase(() => profile.agency_id ? query(collection(firestore, 'agencies', profile.agency_id, 'activityLogs'), orderBy('timestamp', 'desc')) : null, [profile.agency_id, firestore]);
    const { data: activities } = useCollection<Activity>(activityQuery);

    // --- Helpers ---
    const filteredByTime = (dateStr?: string) => {
        if (!dateStr) return false;
        if (timeRange === 'all') return true;
        const date = parseISO(dateStr);
        const now = new Date();
        let start;
        if (timeRange === '7d') start = subDays(now, 7);
        else if (timeRange === '30d') start = subDays(now, 30);
        else if (timeRange === '6m') start = subMonths(now, 6);
        else start = subMonths(now, 12);
        return date >= start;
    };

    // --- Overview Calculations ---
    const stats = useMemo(() => {
        if (!properties || !buyers) return null;
        const soldProps = properties.filter(p => p.status === 'Sold' && !p.is_for_rent);
        const rentProps = properties.filter(p => p.status === 'Rent Out');
        
        const totalRevenue = soldProps.reduce((acc, p) => acc + (p.total_commission || 0), 0) + 
                             rentProps.reduce((acc, p) => acc + (p.rent_total_commission || 0), 0);

        const newLeads = buyers.filter(b => filteredByTime(b.created_at)).length;
        const newListings = properties.filter(p => filteredByTime(p.created_at)).length;

        return {
            totalRevenue,
            newLeads,
            newListings,
            conversionRate: buyers.length > 0 ? ((buyers.filter(b => b.status === 'Deal Closed').length / buyers.length) * 100).toFixed(1) : 0,
            activeListings: properties.filter(p => p.status === 'Available').length
        };
    }, [properties, buyers, timeRange]);

    // --- Chart Data ---
    const revenueGrowthData = useMemo(() => {
        if (!properties) return [];
        const now = new Date();
        const start = subMonths(now, 5);
        const months = eachMonthOfInterval({ start, end: now });
        
        return months.map(m => {
            const monthStr = format(m, 'MMM');
            const monthStart = startOfMonth(m);
            const nextMonth = new Date(m);
            nextMonth.setMonth(nextMonth.getMonth() + 1);

            const monthRevenue = properties.filter(p => {
                const date = parseISO(p.sale_date || p.rent_out_date || '');
                return date >= monthStart && date < nextMonth && (p.status === 'Sold' || p.status === 'Rent Out');
            }).reduce((acc, p) => acc + (p.total_commission || p.rent_total_commission || 0), 0);

            return { name: monthStr, revenue: monthRevenue };
        });
    }, [properties]);

    const leadActivityTrend = useMemo(() => {
        if (!activities) return [];
        const now = new Date();
        const days = Array.from({ length: 7 }, (_, i) => subDays(now, 6 - i));
        
        return days.map(d => {
            const dayStr = format(d, 'EEE');
            const count = activities.filter(act => {
                const date = parseISO(act.timestamp);
                return date.toDateString() === d.toDateString();
            }).length;
            return { day: dayStr, count };
        });
    }, [activities]);

    const propertyChartData = useMemo(() => {
        if (!properties) return [];
        const counts: Record<string, number> = {};
        properties.forEach(p => {
            const type = p.property_type || 'Other';
            counts[type] = (counts[type] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [properties]);

    const appointmentChartData = useMemo(() => {
        if (!appointments) return [];
        const statusCounts: Record<string, number> = { Scheduled: 0, Completed: 0, Cancelled: 0 };
        appointments.forEach(a => {
            if (statusCounts[a.status] !== undefined) statusCounts[a.status]++;
        });
        return Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
    }, [appointments]);

    // --- Team Performance ---
    const agentStats = useMemo(() => {
        if (!teamMembers || !properties || !buyers || !activities) return [];
        const lastMonth = subMonths(new Date(), 1);

        return teamMembers.map(member => {
            const uid = member.user_id || member.id;
            const assignedProps = properties.filter(p => Array.isArray(p.assignedTo) ? p.assignedTo.includes(uid) : p.assignedTo === uid);
            const assignedBuyers = buyers.filter(b => b.assignedTo === uid);
            const soldByAgent = properties.filter(p => p.sold_by_agent_id === uid || p.rented_by_agent_id === uid);
            
            const revenue = soldByAgent.reduce((acc, p) => {
                if (p.status === 'Sold') return acc + formatUnit(p.agent_commission_amount || 0, p.agent_commission_unit || 'Thousand');
                if (p.status === 'Rent Out') return acc + formatUnit(p.rent_agent_share || 0, p.rent_agent_share_unit || 'Thousand');
                return acc;
            }, 0);

            const assignedLastMonthCount = activities.filter(act => 
                act.assignedToId === uid && 
                act.action.includes('assigned') && 
                isAfter(parseISO(act.timestamp), lastMonth)
            ).length;

            const statusChangesLastMonth = activities.filter(act => 
                act.userName === member.name && 
                act.action.includes('updated') && 
                isAfter(parseISO(act.timestamp), lastMonth)
            );

            let totalRemarksCount = 0;
            const leadsWithRemarks: any[] = [];
            [...properties, ...buyers].forEach(lead => {
                const remarks = lead.timeline_notes?.filter(n => n.authorId === uid) || [];
                if (remarks.length > 0) {
                    totalRemarksCount += remarks.length;
                    leadsWithRemarks.push({
                        serial: lead.serial_no,
                        name: (lead as any).name || (lead as any).auto_title,
                        count: remarks.length,
                        latest: remarks[remarks.length - 1]
                    });
                }
            });

            return {
                id: uid,
                name: member.name,
                role: member.role,
                avatar: member.avatar,
                leads: assignedBuyers.length,
                properties: assignedProps.length,
                deals: soldByAgent.length,
                revenue,
                assignedLastMonth: assignedLastMonthCount,
                statusChanges: statusChangesLastMonth,
                totalRemarks: totalRemarksCount,
                leadsWithRemarks: leadsWithRemarks.sort((a,b) => b.count - a.count)
            };
        }).sort((a, b) => b.revenue - a.revenue);
    }, [teamMembers, properties, buyers, activities]);

    if (!properties || !buyers) {
        return <div className="flex h-screen items-center justify-center">Loading Data Analytics...</div>;
    }

    return (
        <div className="space-y-8 pb-20 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight font-headline flex items-center gap-3">
                        <BarChart3 className="h-8 w-8 text-primary" /> Agency Analytics
                    </h1>
                    <p className="text-muted-foreground font-medium">Visual insights into your real estate empire.</p>
                </div>
                <Select value={timeRange} onValueChange={(v: any) => setTimeRange(v)}>
                    <SelectTrigger className="w-[180px] rounded-full bg-card shadow-sm border-primary/20">
                        <SelectValue placeholder="Select Range" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="7d">Last 7 Days</SelectItem>
                        <SelectItem value="30d">Last 30 Days</SelectItem>
                        <SelectItem value="6m">Last 6 Months</SelectItem>
                        <SelectItem value="all">All Time</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* --- KPI Row --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-none shadow-xl bg-card/60 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Revenue</CardTitle>
                        <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600"><DollarSign className="h-4 w-4" /></div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{formatCurrency(stats?.totalRevenue || 0, currency, { notation: 'compact' })}</div>
                        <p className="text-[10px] text-muted-foreground mt-1 font-bold flex items-center gap-1"><ArrowUpRight className="h-3 w-3 text-emerald-500" /> Lifetime Earnings</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-xl bg-card/60 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Lead Conversion</CardTitle>
                        <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600"><Target className="h-4 w-4" /></div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{stats?.conversionRate}%</div>
                        <p className="text-[10px] text-muted-foreground mt-1 font-bold">Leads Closed</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-xl bg-card/60 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">New Inventory</CardTitle>
                        <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600"><Zap className="h-4 w-4" /></div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">+{stats?.newListings}</div>
                        <p className="text-[10px] text-muted-foreground mt-1 font-bold">In selected range</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-xl bg-card/60 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Active Load</CardTitle>
                        <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-600"><CheckCircle className="h-4 w-4" /></div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{stats?.activeListings}</div>
                        <p className="text-[10px] text-muted-foreground mt-1 font-bold">Unsold Properties</p>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="bg-muted/50 p-1 rounded-full w-full lg:w-auto grid grid-cols-5 lg:inline-flex mb-8">
                    <TabsTrigger value="overview" className="rounded-full px-6">Overview</TabsTrigger>
                    <TabsTrigger value="team" className="rounded-full px-6">Team Stats</TabsTrigger>
                    <TabsTrigger value="properties" className="rounded-full px-6">Properties</TabsTrigger>
                    <TabsTrigger value="buyers" className="rounded-full px-6">Buyers</TabsTrigger>
                    <TabsTrigger value="appointments" className="rounded-full px-6">Schedule</TabsTrigger>
                </TabsList>

                {/* --- Overview Tab --- */}
                <TabsContent value="overview" className="space-y-8 animate-in fade-in zoom-in-95 duration-300">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <Card className="lg:col-span-2 border-none shadow-2xl rounded-3xl overflow-hidden bg-card/60 backdrop-blur-xl">
                            <CardHeader>
                                <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-primary" /> Monthly Revenue Trend
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="h-[350px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={revenueGrowthData}>
                                        <defs>
                                            <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                                                <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} tickFormatter={(v) => formatCurrency(v, currency, { notation: 'compact' })} />
                                        <Tooltip />
                                        <Area type="monotone" dataKey="revenue" stroke="#2563eb" fillOpacity={1} fill="url(#colorRev)" strokeWidth={3} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card className="border-none shadow-2xl rounded-3xl bg-card/60 backdrop-blur-xl">
                            <CardHeader>
                                <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
                                    <ActivityIcon className="h-4 w-4 text-primary" /> Activity Pulse
                                </CardTitle>
                                <CardDescription>Last 7 days system actions</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[350px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={leadActivityTrend}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
                                        <Tooltip />
                                        <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={30} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                         <Card className="border-none shadow-2xl rounded-3xl bg-card/60 backdrop-blur-xl">
                            <CardHeader>
                                <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-primary" /> Inventory Type Breakdown
                                </CardTitle>
                                <CardDescription>Types with highest volume shown first.</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[350px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={propertyChartData.slice(0, 10)} layout="vertical" margin={{ left: 40, right: 40 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} strokeOpacity={0.1} />
                                        <XAxis type="number" hide />
                                        <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} width={120} />
                                        <Tooltip />
                                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                                            {propertyChartData.map((_, index) => (
                                                <Cell key={`bar-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card className="border-none shadow-2xl rounded-3xl bg-card/60 backdrop-blur-xl">
                            <CardHeader>
                                <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Users className="h-4 w-4 text-primary" /> Buyer Status
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="h-[350px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={buyers?.reduce((acc: any[], b) => {
                                        const idx = acc.findIndex(i => i.name === b.status);
                                        if (idx > -1) acc[idx].value++; else acc.push({ name: b.status, value: 1 });
                                        return acc;
                                    }, [])}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 800 }} />
                                        <Tooltip />
                                        <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                                             {buyers?.map((_, i) => <Cell key={`c-${i}`} fill={COLORS[i % COLORS.length]} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* --- Team Performance Tab --- */}
                <TabsContent value="team" className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <Card className="border-none shadow-2xl rounded-3xl overflow-hidden bg-card/60 backdrop-blur-xl">
                        <CardHeader className="border-b border-border/20 bg-muted/20">
                            <CardTitle className="text-lg font-black uppercase tracking-widest flex items-center gap-2">
                                <Award className="h-5 w-5 text-primary" /> Team Performance Leaderboard
                            </CardTitle>
                            <CardDescription>Performance ranking based on revenue and activity frequency.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow>
                                            <TableHead className="font-black text-[10px] uppercase">Agent</TableHead>
                                            <TableHead className="font-black text-[10px] uppercase text-center">Assignments (30d)</TableHead>
                                            <TableHead className="font-black text-[10px] uppercase text-center">Status Updates</TableHead>
                                            <TableHead className="font-black text-[10px] uppercase text-center">Total Remarks</TableHead>
                                            <TableHead className="font-black text-[10px] uppercase text-right">Revenue</TableHead>
                                            <TableHead className="text-right"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {agentStats.map((agent) => (
                                            <TableRow key={agent.id} className="group hover:bg-primary/5 transition-colors">
                                                <TableCell className="font-bold py-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-11 w-11 rounded-2xl overflow-hidden border-2 border-primary/20 shadow-lg">
                                                            <img src={agent.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${agent.name}`} alt="" className="h-full w-full object-cover" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-black font-headline">{agent.name}</span>
                                                            <Badge variant="outline" className="w-fit text-[9px] h-4 py-0 font-bold uppercase tracking-tighter opacity-70">{agent.role}</Badge>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center font-bold">{agent.assignedLastMonth}</TableCell>
                                                <TableCell className="text-center font-bold">{agent.statusChanges.length}</TableCell>
                                                <TableCell className="text-center font-bold">{agent.totalRemarks}</TableCell>
                                                <TableCell className="text-right font-black text-primary">{formatCurrency(agent.revenue, currency)}</TableCell>
                                                <TableCell className="text-right pr-6">
                                                    <Button size="sm" variant="ghost" className="rounded-full h-9 text-[10px] font-black uppercase tracking-widest gap-2 hover:bg-primary hover:text-white transition-all shadow-sm" onClick={() => setSelectedAgentForReport(agent)}>
                                                        View Report <ChevronRight className="h-3 w-3" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- Schedule Tab --- */}
                <TabsContent value="appointments" className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <Card className="lg:col-span-2 border-none shadow-2xl rounded-3xl overflow-hidden bg-card/60 backdrop-blur-xl">
                            <CardHeader>
                                <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">Appointment Funnel</CardTitle>
                            </CardHeader>
                            <CardContent className="h-[400px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={appointmentChartData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 800 }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                                        <Tooltip />
                                        <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={60}>
                                            {appointmentChartData.map((_, i) => <Cell key={`apt-${i}`} fill={COLORS[i % COLORS.length]} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                        <Card className="border-none shadow-2xl rounded-3xl bg-card/60 backdrop-blur-xl">
                             <CardHeader>
                                <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">Upcoming Snapshot</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {appointments?.filter(a => a.status === 'Scheduled').slice(0, 6).map(a => (
                                        <div key={a.id} className="flex items-center gap-3 p-4 rounded-2xl bg-muted/20 border border-border/40 hover:border-primary/30 transition-all">
                                            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner"><Calendar className="h-5 w-5" /></div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-black truncate">{a.contactName}</p>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5 mt-0.5"><Clock className="h-3 w-3" /> {a.date} @ {a.time}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {appointments?.filter(a => a.status === 'Scheduled').length === 0 && (
                                        <p className="text-center py-20 text-xs font-bold text-muted-foreground uppercase opacity-40">No upcoming meetings</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* --- Properties Analysis --- */}
                <TabsContent value="properties" className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <Card className="border-none shadow-2xl rounded-3xl overflow-hidden bg-card/60 backdrop-blur-xl">
                        <CardHeader>
                            <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">Property Type Distribution</CardTitle>
                            <CardDescription>Breakdown of all listings currently in system.</CardDescription>
                        </CardHeader>
                        <CardContent className="h-[600px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={propertyChartData} layout="vertical" margin={{ left: 20, right: 40 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} strokeOpacity={0.1} />
                                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={120} tick={{ fontSize: 10, fontWeight: 800 }} />
                                    <Tooltip />
                                    <Bar dataKey="value" fill="#f59e0b" radius={[0, 6, 6, 0]} barSize={25}>
                                        {propertyChartData.map((_, index) => (
                                            <Cell key={`prop-bar-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- Buyers Metrics --- */}
                <TabsContent value="buyers" className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <Card className="border-none shadow-2xl rounded-3xl overflow-hidden bg-card/60 backdrop-blur-xl h-[500px] flex items-center justify-center">
                        <div className="text-center space-y-4 max-w-sm">
                            <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
                                <Users className="h-10 w-10" />
                            </div>
                            <h3 className="text-xl font-black font-headline">Buyer Behavior Analysis</h3>
                            <p className="text-sm text-muted-foreground font-medium">Advanced buyer intent and preference mapping is currently being processed for your account.</p>
                        </div>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* --- Agent Detailed Report Dialog --- */}
            <Dialog open={!!selectedAgentForReport} onOpenChange={() => setSelectedAgentForReport(null)}>
                <DialogContent className="sm:max-w-4xl max-h-[95vh] flex flex-col p-0 overflow-hidden border-none shadow-3xl bg-background rounded-[2.5rem]">
                    {selectedAgentForReport && (
                        <>
                            <div className="p-10 pb-6 shrink-0 bg-gradient-to-br from-primary/15 via-background to-background relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-8 opacity-5">
                                    <Award className="h-40 w-40" />
                                </div>
                                <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                                    <div className="h-28 w-28 rounded-[2rem] overflow-hidden border-4 border-background shadow-2xl ring-4 ring-primary/10">
                                        <img src={selectedAgentForReport.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${selectedAgentForReport.name}`} alt="" className="h-full w-full object-cover" />
                                    </div>
                                    <div className="text-center md:text-left flex-1">
                                        <div className="text-4xl font-black font-headline tracking-tighter leading-none mb-2">{selectedAgentForReport.name}</div>
                                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                                            <Badge className="font-black text-[10px] uppercase tracking-widest px-3 h-6 bg-primary">{selectedAgentForReport.role}</Badge>
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/40 px-2 py-1 rounded-md">Agent ID: {selectedAgentForReport.id.substring(0, 8)}</span>
                                        </div>
                                    </div>
                                    <div className="bg-card/80 backdrop-blur-md p-6 rounded-3xl border border-primary/10 shadow-xl text-center min-w-[200px]">
                                        <div className="text-3xl font-black text-primary leading-none mb-1">{formatCurrency(selectedAgentForReport.revenue, currency, { notation: 'compact' })}</div>
                                        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Revenue Generated</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-6 mt-10">
                                    <div className="p-5 rounded-3xl bg-background/60 border border-border/40 shadow-sm text-center">
                                        <div className="text-2xl font-black text-foreground">{selectedAgentForReport.assignedLastMonth}</div>
                                        <div className="text-[9px] font-black uppercase text-muted-foreground tracking-widest mt-1">Assigned (30d)</div>
                                    </div>
                                    <div className="p-5 rounded-3xl bg-background/60 border border-border/40 shadow-sm text-center">
                                        <div className="text-2xl font-black text-foreground">{selectedAgentForReport.statusChanges.length}</div>
                                        <div className="text-[9px] font-black uppercase text-muted-foreground tracking-widest mt-1">Status Updates</div>
                                    </div>
                                    <div className="p-5 rounded-3xl bg-background/60 border border-border/40 shadow-sm text-center">
                                        <div className="text-2xl font-black text-foreground">{selectedAgentForReport.totalRemarks}</div>
                                        <div className="text-[9px] font-black uppercase text-muted-foreground tracking-widest mt-1">Total Remarks</div>
                                    </div>
                                </div>
                            </div>

                            <Separator className="opacity-40" />

                            <div className="flex-1 overflow-hidden">
                                <ScrollArea className="h-full">
                                    <div className="px-10 py-8 space-y-12 pb-10">
                                        {/* Timeline Section */}
                                        <section className="space-y-6">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                                                    <History className="h-4 w-4" /> Performance Timeline
                                                </h3>
                                                <span className="text-[10px] font-bold text-muted-foreground">Historical Status Changes</span>
                                            </div>
                                            <div className="space-y-4 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-[2px] before:bg-border/30">
                                                {selectedAgentForReport.statusChanges.length > 0 ? selectedAgentForReport.statusChanges.map((act: Activity) => (
                                                    <div key={act.id} className="relative pl-12 group">
                                                        <div className="absolute left-0 top-2 h-10 w-10 rounded-2xl bg-background border border-orange-500/20 flex items-center justify-center z-10 shadow-sm group-hover:scale-110 transition-transform">
                                                            <ActivityIcon className="h-5 w-5 text-orange-500" />
                                                        </div>
                                                        <div className="bg-muted/5 border border-border/60 p-5 rounded-3xl shadow-sm hover:border-primary/20 transition-all">
                                                            <div className="flex flex-wrap items-center justify-between mb-3 gap-2">
                                                                <span className="font-black text-sm text-foreground">{act.target}</span>
                                                                <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-1 rounded-md">{format(parseISO(act.timestamp), 'PPp')}</span>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <Badge variant="secondary" className="text-[9px] font-bold bg-muted/40 uppercase tracking-widest">{act.details?.from}</Badge>
                                                                <ChevronRight className="h-3 w-3 text-muted-foreground opacity-40" />
                                                                <Badge className="text-[9px] font-black bg-emerald-600 text-white uppercase tracking-widest">{act.details?.to}</Badge>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )) : (
                                                    <div className="flex flex-col items-center justify-center py-16 opacity-30">
                                                        <History className="h-10 w-10 mb-2" />
                                                        <p className="text-[10px] font-black uppercase">No Status History</p>
                                                    </div>
                                                )}
                                            </div>
                                        </section>

                                        {/* Remarks Section */}
                                        <section className="space-y-6">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                                                    <MessageSquare className="h-4 w-4" /> Recent Lead Feedback
                                                </h3>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                {selectedAgentForReport.leadsWithRemarks.length > 0 ? selectedAgentForReport.leadsWithRemarks.map((lead: any) => (
                                                    <div key={lead.serial} className="p-6 rounded-[2rem] border border-border/40 bg-muted/5 group hover:border-primary/30 hover:bg-primary/5 transition-all flex flex-col">
                                                        <div className="flex items-center justify-between mb-4">
                                                            <div className="min-w-0">
                                                                <span className="text-[9px] font-black text-primary uppercase block mb-1 tracking-widest">{lead.serial}</span>
                                                                <div className="text-sm font-black font-headline truncate">{lead.name}</div>
                                                            </div>
                                                            <Badge variant="secondary" className="h-7 rounded-xl font-black text-[9px] bg-primary/10 text-primary border-none px-3">{lead.count} REMARKS</Badge>
                                                        </div>
                                                        <div className="p-5 rounded-2xl bg-background/80 shadow-inner text-xs font-medium text-muted-foreground leading-relaxed flex-1 italic relative">
                                                            <span className="text-2xl absolute top-2 left-2 text-primary/10 font-black">"</span>
                                                            {lead.latest.text}
                                                            <div className="mt-4 text-[9px] font-black text-right uppercase opacity-60 border-t pt-2">{format(parseISO(lead.latest.timestamp), 'MMM d, p')}</div>
                                                        </div>
                                                    </div>
                                                )) : (
                                                    <div className="col-span-2 flex flex-col items-center justify-center py-16 opacity-30 border-2 border-dashed rounded-3xl">
                                                        <MessageSquare className="h-10 w-10 mb-2" />
                                                        <p className="text-[10px] font-black uppercase">No Active Remarks</p>
                                                    </div>
                                                )}
                                            </div>
                                        </section>
                                    </div>
                                </ScrollArea>
                            </div>

                            <DialogFooter className="p-8 border-t bg-muted/10 shrink-0 flex justify-end">
                                <Button variant="secondary" className="rounded-2xl px-10 font-black uppercase text-[10px] tracking-[0.2em] h-12 shadow-md hover:scale-105 transition-transform" onClick={() => setSelectedAgentForReport(null)}>Close Report</Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
