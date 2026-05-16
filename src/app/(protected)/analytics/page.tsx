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
    Activity,
    LineChart
} from 'lucide-react';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    BarChart, Bar, Cell, PieChart, Pie, Legend 
} from 'recharts';
import { useProfile } from '@/context/profile-context';
import { useFirestore } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useMemoFirebase } from '@/firebase/hooks';
import { collection, query, where } from 'firebase/firestore';
import { Property, Buyer, Appointment, User, PriceUnit } from '@/lib/types';
import { format, subDays, parseISO, isWithinInterval, startOfMonth, eachMonthOfInterval, subMonths } from 'date-fns';
import { formatCurrency, formatUnit } from '@/lib/formatters';
import { useCurrency } from '@/context/currency-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

type TimeRange = '7d' | '30d' | '6m' | '12m' | 'all';

export default function AnalyticsPage() {
    const { profile } = useProfile();
    const firestore = useFirestore();
    const { currency } = useCurrency();
    const [timeRange, setTimeRange] = useState<TimeRange>('30d');

    // Data Fetching
    const propsQuery = useMemoFirebase(() => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'properties') : null, [profile.agency_id, firestore]);
    const { data: properties } = useCollection<Property>(propsQuery);

    const buyersQuery = useMemoFirebase(() => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'buyers') : null, [profile.agency_id, firestore]);
    const { data: buyers } = useCollection<Buyer>(buyersQuery);

    const teamQuery = useMemoFirebase(() => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'teamMembers') : null, [profile.agency_id, firestore]);
    const { data: teamMembers } = useCollection<User>(teamQuery);

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

    // 1. Overview Calculations
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

    // 2. Growth Chart Data
    const growthData = useMemo(() => {
        if (!properties || !buyers) return [];
        const now = new Date();
        const start = timeRange === '6m' ? subMonths(now, 5) : subMonths(now, 11);
        const interval = eachMonthOfInterval({ start: startOfMonth(start), end: now });

        return interval.map(date => {
            const monthLabel = format(date, 'MMM yy');
            const propCount = properties.filter(p => p.created_at && format(parseISO(p.created_at), 'MMM yy') === monthLabel).length;
            const buyerCount = buyers.filter(b => b.created_at && format(parseISO(b.created_at), 'MMM yy') === monthLabel).length;
            return { name: monthLabel, Properties: propCount, Buyers: buyerCount };
        });
    }, [properties, buyers, timeRange]);

    // 3. Property Type Data
    const typeData = useMemo(() => {
        if (!properties) return [];
        const counts: Record<string, number> = {};
        properties.forEach(p => { counts[p.property_type] = (counts[p.property_type] || 0) + 1; });
        return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 8);
    }, [properties]);

    // 4. Team Performance
    const agentStats = useMemo(() => {
        if (!teamMembers || !properties || !buyers) return [];
        return teamMembers.map(member => {
            const uid = member.user_id || member.id;
            const assignedProps = properties.filter(p => Array.isArray(p.assignedTo) ? p.assignedTo.includes(uid) : p.assignedTo === uid);
            const soldByAgent = properties.filter(p => p.sold_by_agent_id === uid || p.rented_by_agent_id === uid);
            const revenue = soldByAgent.reduce((acc, p) => {
                if (p.status === 'Sold') return acc + formatUnit(p.agent_commission_amount || 0, p.agent_commission_unit || 'Thousand');
                if (p.status === 'Rent Out') return acc + formatUnit(p.rent_agent_share || 0, p.rent_agent_share_unit || 'Thousand');
                return acc;
            }, 0);

            return {
                id: uid,
                name: member.name,
                role: member.role,
                avatar: member.avatar,
                leads: buyers.filter(b => b.assignedTo === uid).length,
                properties: assignedProps.length,
                deals: soldByAgent.length,
                revenue
            };
        }).sort((a, b) => b.revenue - a.revenue);
    }, [teamMembers, properties, buyers]);

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
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Inventory Value</CardTitle>
                        <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-600"><Activity className="h-4 w-4" /></div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{stats?.activeListings}</div>
                        <p className="text-[10px] text-muted-foreground mt-1 font-bold flex items-center gap-1">Current Active Stock</p>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="bg-muted/50 p-1 rounded-full w-full lg:w-auto grid grid-cols-4 lg:inline-flex">
                    <TabsTrigger value="overview" className="rounded-full px-6">Overview</TabsTrigger>
                    <TabsTrigger value="properties" className="rounded-full px-6">Properties</TabsTrigger>
                    <TabsTrigger value="buyers" className="rounded-full px-6">Buyers</TabsTrigger>
                    <TabsTrigger value="team" className="rounded-full px-6">Team Stats</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-8 mt-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <Card className="lg:col-span-2 border-none shadow-2xl rounded-2xl overflow-hidden bg-card/60 backdrop-blur-xl">
                            <CardHeader>
                                <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-primary" /> Inventory vs Leads Growth
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="h-[400px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={growthData}>
                                        <defs>
                                            <linearGradient id="colorProp" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8}/>
                                                <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                                            </linearGradient>
                                            <linearGradient id="colorBuy" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={10} fontStyle="bold" />
                                        <YAxis axisLine={false} tickLine={false} fontSize={10} fontStyle="bold" />
                                        <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
                                        <Legend verticalAlign="top" align="right" />
                                        <Area type="monotone" dataKey="Properties" stroke="#2563eb" fillOpacity={1} fill="url(#colorProp)" strokeWidth={3} />
                                        <Area type="monotone" dataKey="Buyers" stroke="#10b981" fillOpacity={1} fill="url(#colorBuy)" strokeWidth={3} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card className="border-none shadow-2xl rounded-2xl bg-card/60 backdrop-blur-xl">
                            <CardHeader>
                                <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-primary" /> Stock Distribution
                                </CardTitle>
                                <CardDescription>Top 8 Property Types</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[400px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={typeData} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} strokeOpacity={0.1} />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} fontSize={9} fontStyle="black" width={80} />
                                        <Tooltip cursor={{ fill: 'transparent' }} />
                                        <Bar dataKey="value" fill="#2563eb" radius={[0, 4, 4, 0]}>
                                            {typeData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="team" className="mt-6">
                    <Card className="border-none shadow-2xl rounded-2xl overflow-hidden bg-card/60 backdrop-blur-xl">
                        <CardHeader className="border-b border-border/20 bg-muted/20">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-lg font-black uppercase tracking-widest flex items-center gap-2">
                                        <Award className="h-5 w-5 text-primary" /> Team Performance Leaderboard
                                    </CardTitle>
                                    <CardDescription>Ranking based on revenue and conversions.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow>
                                        <TableHead className="font-black text-[10px] uppercase">Agent</TableHead>
                                        <TableHead className="font-black text-[10px] uppercase text-center">Assigned Leads</TableHead>
                                        <TableHead className="font-black text-[10px] uppercase text-center">Managed Props</TableHead>
                                        <TableHead className="font-black text-[10px] uppercase text-center">Deals Closed</TableHead>
                                        <TableHead className="font-black text-[10px] uppercase text-right">Commission Earned</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {agentStats.map((agent, i) => (
                                        <TableRow key={agent.id} className="group hover:bg-primary/5 transition-colors">
                                            <TableCell className="font-bold py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="relative">
                                                        <div className={cn(
                                                            "absolute -top-2 -left-2 h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-background",
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
                                            <TableCell className="text-center font-bold text-muted-foreground">{agent.leads}</TableCell>
                                            <TableCell className="text-center font-bold text-muted-foreground">{agent.properties}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-black">{agent.deals} Deals</Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="font-black text-primary">{formatCurrency(agent.revenue, currency)}</div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="properties" className="mt-6">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <Card className="border-none shadow-xl rounded-2xl bg-card/60 backdrop-blur-xl">
                            <CardHeader>
                                <CardTitle className="text-sm font-black uppercase tracking-wider">Inventory Status</CardTitle>
                            </CardHeader>
                            <CardContent className="h-[350px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { name: 'Available', value: properties.filter(p => p.status === 'Available').length },
                                                { name: 'Sold', value: properties.filter(p => p.status === 'Sold').length },
                                                { name: 'Rent Out', value: properties.filter(p => p.status === 'Rent Out').length },
                                                { name: 'Sold (Ext)', value: properties.filter(p => p.status === 'Sold (External)').length },
                                            ]}
                                            cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value"
                                        >
                                            {COLORS.map((color, index) => <Cell key={`cell-${index}`} fill={color} />)}
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                        <Card className="border-none shadow-xl rounded-2xl bg-card/60 backdrop-blur-xl">
                            <CardHeader>
                                <CardTitle className="text-sm font-black uppercase tracking-wider">Listing Type</CardTitle>
                            </CardHeader>
                            <CardContent className="h-[350px] flex items-center justify-center">
                                <div className="space-y-6 w-full max-w-[250px]">
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs font-bold uppercase tracking-wider opacity-60">
                                            <span>For Sale</span>
                                            <span>{properties.filter(p => !p.is_for_rent).length}</span>
                                        </div>
                                        <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-blue-600 rounded-full" 
                                                style={{ width: `${(properties.filter(p => !p.is_for_rent).length / properties.length) * 100}%` }} 
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs font-bold uppercase tracking-wider opacity-60">
                                            <span>For Rent</span>
                                            <span>{properties.filter(p => p.is_for_rent).length}</span>
                                        </div>
                                        <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-emerald-500 rounded-full" 
                                                style={{ width: `${(properties.filter(p => p.is_for_rent).length / properties.length) * 100}%` }} 
                                            />
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                     </div>
                </TabsContent>

                <TabsContent value="buyers" className="mt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <Card className="border-none shadow-xl rounded-2xl bg-card/60 backdrop-blur-xl">
                            <CardHeader>
                                <CardTitle className="text-sm font-black uppercase tracking-wider">Buyer Intentions</CardTitle>
                            </CardHeader>
                            <CardContent className="h-[350px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { name: 'Interested', value: buyers.filter(b => b.status === 'Interested').length },
                                                { name: 'New', value: buyers.filter(b => b.status === 'New').length },
                                                { name: 'Follow Up', value: buyers.filter(b => b.status === 'Follow Up').length },
                                                { name: 'Visited', value: buyers.filter(b => b.status === 'Visited Property').length },
                                                { name: 'Closed', value: buyers.filter(b => b.status === 'Deal Closed').length },
                                            ]}
                                            cx="50%" cy="50%" outerRadius={110} dataKey="value" label
                                        >
                                            {COLORS.map((color, index) => <Cell key={`cell-${index}`} fill={color} />)}
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                        <Card className="border-none shadow-xl rounded-2xl bg-card/60 backdrop-blur-xl overflow-hidden flex flex-col">
                            <CardHeader className="bg-primary text-primary-foreground">
                                <CardTitle className="text-sm font-black uppercase tracking-wider">Conversion Summary</CardTitle>
                            </CardHeader>
                            <CardContent className="flex-1 flex flex-col items-center justify-center gap-6 py-10">
                                <div className="text-center">
                                    <div className="text-6xl font-black mb-1">{buyers.filter(b => b.status === 'Deal Closed').length}</div>
                                    <p className="text-xs font-black uppercase tracking-wider opacity-60">Total Conversions</p>
                                </div>
                                <Separator className="w-32 bg-primary-foreground/20" />
                                <div className="text-center">
                                    <div className="text-4xl font-black mb-1 text-red-500">{buyers.filter(b => b.status === 'Deal Lost').length}</div>
                                    <p className="text-xs font-black uppercase tracking-wider opacity-60">Leads Lost</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}