'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
    TrendingUp, 
    Building2, 
    Users, 
    DollarSign, 
    CalendarDays, 
    Briefcase, 
    PieChart as PieChartIcon, 
    BarChart3, 
    Target,
    Award,
    ArrowUpRight,
    ArrowDownRight,
    Activity as ActivityIcon,
    LineChart,
    Calendar,
    CheckCircle,
    XCircle,
    Clock,
    FileText,
    MessageSquare,
    Eye,
    ChevronRight,
    History
} from 'lucide-react';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    BarChart, Bar, Cell, PieChart, Pie, Legend 
} from 'recharts';
import { useProfile } from '@/context/profile-context';
import { useFirestore } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useMemoFirebase } from '@/firebase/hooks';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { Property, Buyer, Appointment, User, PriceUnit, Activity } from '@/lib/types';
import { format, subDays, parseISO, isWithinInterval, startOfMonth, eachMonthOfInterval, subMonths, isAfter } from 'date-fns';
import { formatCurrency, formatUnit } from '@/lib/formatters';
import { useCurrency } from '@/context/currency-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
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

    // Data Fetching
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

    // Helpers
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

    // Overview Calculations
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

    // Team Performance
    const agentStats = useMemo(() => {
        if (!teamMembers || !properties || !buyers || !activities) return [];
        const lastMonth = subMonths(new Date(), 1);

        return teamMembers.map(member => {
            const uid = member.user_id || member.id;
            const assignedProps = properties.filter(p => Array.isArray(p.assignedTo) ? p.assignedTo.includes(uid) : p.assignedTo === uid);
            const assignedBuyers = buyers.filter(b => b.assignedTo === uid);
            const soldByAgent = properties.filter(p => p.sold_by_agent_id === uid || p.rented_by_agent_id === uid);
            
            // Calculate revenue
            const revenue = soldByAgent.reduce((acc, p) => {
                if (p.status === 'Sold') return acc + formatUnit(p.agent_commission_amount || 0, p.agent_commission_unit || 'Thousand');
                if (p.status === 'Rent Out') return acc + formatUnit(p.rent_agent_share || 0, p.rent_agent_share_unit || 'Thousand');
                return acc;
            }, 0);

            // Detailed Report Data (Last Month)
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

            // Remarks counting
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
                // New detailed fields
                assignedLastMonth: assignedLastMonthCount,
                statusChanges: statusChangesLastMonth,
                totalRemarks: totalRemarksCount,
                leadsWithRemarks: leadsWithRemarks.sort((a,b) => b.count - a.count)
            };
        }).sort((a, b) => b.revenue - a.revenue);
    }, [teamMembers, properties, buyers, activities]);

    if (!properties || !buyers) return <div className="flex h-screen items-center justify-center">Loading Data Analytics...</div>;

    return (
        <div className="space-y-8 pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight font-headline flex items-center gap-3">
                        <BarChart3 className="h-8 w-8 text-primary" /> Agency Analytics
                    </h1>
                    <p className="text-muted-foreground font-medium">Detailed insights into your real estate operations.</p>
                </div>
                <Select value={timeRange} onValueChange={(v: any) => setTimeRange(v)}>
                    <SelectTrigger className="w-[180px] rounded-full bg-card shadow-sm border-primary/20">
                        <SelectValue placeholder="Select Range" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="7d">Last 7 Days</SelectItem>
                        <SelectItem value="30d">Last 30 Days</SelectItem>
                        <SelectItem value="6m">Last 6 Months</SelectItem>
                        <SelectItem value="12m">Last 12 Months</SelectItem>
                        <SelectItem value="all">All Time</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-none shadow-xl bg-card/60 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Revenue</CardTitle>
                        <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600"><DollarSign className="h-4 w-4" /></div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{formatCurrency(stats?.totalRevenue || 0, currency, { notation: 'compact' })}</div>
                        <p className="text-[10px] text-muted-foreground mt-1 font-bold flex items-center gap-1"><ArrowUpRight className="h-3 w-3 text-emerald-500" /> Agency Earnings</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-xl bg-card/60 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Conversion Rate</CardTitle>
                        <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600"><Target className="h-4 w-4" /></div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{stats?.conversionRate}%</div>
                        <p className="text-[10px] text-muted-foreground mt-1 font-bold flex items-center gap-1">Leads to Closed Deals</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-xl bg-card/60 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">New Listings</CardTitle>
                        <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600"><Building2 className="h-4 w-4" /></div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">+{stats?.newListings}</div>
                        <p className="text-[10px] text-muted-foreground mt-1 font-bold flex items-center gap-1">Added in selected range</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-xl bg-card/60 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Active Stock</CardTitle>
                        <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-600"><CheckCircle className="h-4 w-4" /></div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{stats?.activeListings}</div>
                        <p className="text-[10px] text-muted-foreground mt-1 font-bold flex items-center gap-1">Available inventory</p>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="bg-muted/50 p-1 rounded-full w-full lg:w-auto grid grid-cols-5 lg:inline-flex">
                    <TabsTrigger value="overview" className="rounded-full px-6">Overview</TabsTrigger>
                    <TabsTrigger value="properties" className="rounded-full px-6">Properties</TabsTrigger>
                    <TabsTrigger value="buyers" className="rounded-full px-6">Buyers</TabsTrigger>
                    <TabsTrigger value="appointments" className="rounded-full px-6">Appointments</TabsTrigger>
                    <TabsTrigger value="team" className="rounded-full px-6">Team Stats</TabsTrigger>
                </TabsList>

                <TabsContent value="team" className="mt-6">
                    <Card className="border-none shadow-2xl rounded-2xl overflow-hidden bg-card/60 backdrop-blur-xl">
                        <CardHeader className="border-b border-border/20 bg-muted/20">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-lg font-black uppercase tracking-widest flex items-center gap-2">
                                        <Award className="h-5 w-5 text-primary" /> Team Performance Leaderboard
                                    </CardTitle>
                                    <CardDescription>Ranking based on revenue and activity logs.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow>
                                        <TableHead className="font-black text-[10px] uppercase">Agent</TableHead>
                                        <TableHead className="font-black text-[10px] uppercase text-center">New Assignments (30d)</TableHead>
                                        <TableHead className="font-black text-[10px] uppercase text-center">Status Changes (30d)</TableHead>
                                        <TableHead className="font-black text-[10px] uppercase text-center">Total Remarks</TableHead>
                                        <TableHead className="font-black text-[10px] uppercase text-right">Commission Earned</TableHead>
                                        <TableHead className="font-black text-[10px] uppercase text-right"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {agentStats.map((agent, i) => (
                                        <TableRow key={agent.id} className="group hover:bg-primary/5 transition-colors">
                                            <TableCell className="font-bold py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="relative">
                                                        <div className={cn(
                                                            "absolute -top-2 -left-2 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-background shadow-md",
                                                            i === 0 ? "bg-amber-400 text-amber-900" : "bg-muted text-muted-foreground"
                                                        )}>
                                                            {i + 1}
                                                        </div>
                                                        <div className="h-10 w-10 rounded-xl overflow-hidden border-2 border-primary/20">
                                                            <img src={agent.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${agent.name}`} alt="" className="h-full w-full object-cover" />
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm">{agent.name}</span>
                                                        <Badge variant="outline" className="w-fit text-[9px] h-4 py-0 font-bold uppercase tracking-tighter">{agent.role}</Badge>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="secondary" className="font-black text-[10px] bg-blue-100 text-blue-700 border-0">{agent.assignedLastMonth} leads</Badge>
                                            </TableCell>
                                            <TableCell className="text-center font-bold text-muted-foreground">
                                                <div className="flex items-center justify-center gap-1">
                                                    <ActivityIcon className="h-3 w-3 text-orange-500" />
                                                    {agent.statusChanges.length} updates
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center font-bold text-muted-foreground">
                                                <div className="flex items-center justify-center gap-1">
                                                    <MessageSquare className="h-3 w-3 text-primary" />
                                                    {agent.totalRemarks} remarks
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="font-black text-primary">{formatCurrency(agent.revenue, currency)}</div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button 
                                                    size="sm" 
                                                    variant="ghost" 
                                                    className="rounded-full h-8 text-[10px] font-black uppercase tracking-widest gap-2"
                                                    onClick={() => setSelectedAgentForReport(agent)}
                                                >
                                                    View Report <ChevronRight className="h-3 w-3" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
                
                <TabsContent value="overview" className="space-y-8 mt-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <Card className="lg:col-span-2 border-none shadow-2xl rounded-2xl overflow-hidden bg-card/60 backdrop-blur-xl">
                            <CardHeader>
                                <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-primary" /> Inventory vs Leads Growth
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="h-[400px]">
                                {/* Growth Chart content placeholder */}
                            </CardContent>
                        </Card>

                        <Card className="border-none shadow-2xl rounded-2xl bg-card/60 backdrop-blur-xl">
                            <CardHeader>
                                <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-primary" /> Stock Distribution
                                </CardTitle>
                                <CardDescription>Inventory breakdown</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[400px]">
                                {/* Property Types Chart placeholder */}
                            </CardContent>
                        </div>
                </TabsContent>
            </Tabs>

            {/* Agent Detailed Report Dialog */}
            <Dialog open={!!selectedAgentForReport} onOpenChange={() => setSelectedAgentForReport(null)}>
                <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                    {selectedAgentForReport && (
                        <>
                            <div className="p-8 pb-4 shrink-0 bg-gradient-to-br from-primary/10 via-background to-background">
                                <div className="flex items-center gap-5">
                                    <div className="h-20 w-20 rounded-3xl overflow-hidden border-4 border-background shadow-xl">
                                        <img src={selectedAgentForReport.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${selectedAgentForReport.name}`} alt="" className="h-full w-full object-cover" />
                                    </div>
                                    <div className="space-y-1">
                                        <DialogTitle className="text-2xl font-black font-headline tracking-tighter">{selectedAgentForReport.name}</DialogTitle>
                                        <div className="flex items-center gap-2">
                                            <Badge className="font-black text-[10px] uppercase tracking-widest">{selectedAgentForReport.role}</Badge>
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Agent Performance Report</span>
                                        </div>
                                    </div>
                                    <div className="ml-auto text-right">
                                        <div className="text-2xl font-black text-primary leading-none">{formatCurrency(selectedAgentForReport.revenue, currency)}</div>
                                        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Total Earnings</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4 mt-8">
                                    <div className="p-4 rounded-2xl bg-background border border-border/40 shadow-sm text-center">
                                        <div className="text-xl font-black">{selectedAgentForReport.assignedLastMonth}</div>
                                        <div className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter">Assigned (30d)</div>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-background border border-border/40 shadow-sm text-center">
                                        <div className="text-xl font-black">{selectedAgentForReport.statusChanges.length}</div>
                                        <div className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter">Status Updates</div>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-background border border-border/40 shadow-sm text-center">
                                        <div className="text-xl font-black">{selectedAgentForReport.totalRemarks}</div>
                                        <div className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter">Total Remarks</div>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            <ScrollArea className="flex-1 px-8 py-6">
                                <div className="space-y-10 pb-6">
                                    {/* Status Changes History */}
                                    <section className="space-y-4">
                                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                                            <History className="h-4 w-4" /> Status Change Timeline
                                        </h3>
                                        <div className="space-y-3 relative before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-[2px] before:bg-border/50">
                                            {selectedAgentForReport.statusChanges.length > 0 ? selectedAgentForReport.statusChanges.map((act: Activity) => (
                                                <div key={act.id} className="relative pl-10">
                                                    <div className="absolute left-0 top-1.5 h-9 w-9 rounded-full bg-background border border-orange-500/20 flex items-center justify-center z-10 shadow-sm">
                                                        <ActivityIcon className="h-4 w-4 text-orange-500" />
                                                    </div>
                                                    <div className="bg-card border border-border/60 p-4 rounded-2xl shadow-sm">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="font-bold text-sm text-foreground">{act.target}</span>
                                                            <span className="text-[10px] font-bold text-muted-foreground">{format(parseISO(act.timestamp), 'PPp')}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="outline" className="text-[10px] bg-muted/30">{act.details?.from}</Badge>
                                                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                                            <Badge className="text-[10px] bg-emerald-500">{act.details?.to}</Badge>
                                                        </div>
                                                    </div>
                                                </div>
                                            )) : (
                                                <p className="text-center text-xs text-muted-foreground py-10 opacity-60">No status updates recorded recently.</p>
                                            )}
                                        </div>
                                    </section>

                                    {/* Detailed Remarks */}
                                    <section className="space-y-4">
                                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                                            <MessageSquare className="h-4 w-4" /> Remarks & Lead Updates
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {selectedAgentForReport.leadsWithRemarks.length > 0 ? selectedAgentForReport.leadsWithRemarks.map((lead: any) => (
                                                <div key={lead.serial} className="p-4 rounded-2xl border border-border/40 bg-muted/5 group hover:border-primary/30 transition-all">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div>
                                                            <span className="text-[9px] font-black text-primary uppercase block mb-0.5">{lead.serial}</span>
                                                            <p className="text-sm font-bold truncate max-w-[150px]">{lead.name}</p>
                                                        </div>
                                                        <Badge variant="secondary" className="h-6 rounded-lg font-black text-[10px]">{lead.count} remarks</Badge>
                                                    </div>
                                                    <div className="p-3 rounded-xl bg-background text-[11px] italic text-muted-foreground leading-relaxed">
                                                        "{lead.latest.text}"
                                                        <div className="mt-2 text-[9px] font-black text-right uppercase opacity-60">{format(parseISO(lead.latest.timestamp), 'MMM d, p')}</div>
                                                    </div>
                                                </div>
                                            )) : (
                                                <p className="col-span-2 text-center text-xs text-muted-foreground py-10 opacity-60">No remarks found from this agent.</p>
                                            )}
                                        </div>
                                    </section>
                                </div>
                            </ScrollArea>

                            <DialogFooter className="p-6 border-t bg-muted/10 shrink-0">
                                <Button variant="secondary" className="rounded-full px-8 font-black uppercase text-[10px] tracking-widest h-10" onClick={() => setSelectedAgentForReport(null)}>Close Report</Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
