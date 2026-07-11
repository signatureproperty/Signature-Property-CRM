'use client';
import React, { useMemo } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Building2,
  CalendarDays,
  DollarSign,
  Star,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { subDays, isWithinInterval, parseISO } from 'date-fns';
import { useCurrency } from '@/context/currency-context';
import { formatCurrency } from '@/lib/formatters';
import { Property, Buyer, Appointment } from '@/lib/types';
import { useFirestore } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection } from 'firebase/firestore';
import { useMemoFirebase } from '@/firebase/hooks';
import { useProfile } from '@/context/profile-context';
import { Skeleton } from '@/components/ui/skeleton';

type KpiData = {
  id: string;
  title: string;
  value: string;
  icon: React.ElementType;
  color: string;
  change: string;
};

const calculateKpis = (
  properties: Property[] | null,
  buyers: Buyer[] | null,
  appointments: Appointment[] | null,
  currency: string,
  agentId?: string
): KpiData[] => {
  const now = new Date();
  const last30Days = subDays(now, 30);

  const getChange = (current: number, previous: number) => {
    if (previous === 0) {
      return current > 0 ? `+${current}` : 'No change';
    }
    const change = current - previous;
    if (change === 0) {
      return 'No change';
    }
    const percentageChange = (change / previous) * 100;
    return `${percentageChange > 0 ? '+' : ''}${percentageChange.toFixed(0)}%`;
  };

  const safeProperties = properties || [];
  const safeBuyers = buyers || [];
  const safeAppointments = appointments || [];

  const propertiesInLast30Days = safeProperties.filter(p => p.created_at && isWithinInterval(parseISO(p.created_at), { start: last30Days, end: now })).length;
  const previousPropertiesCount = safeProperties.length - propertiesInLast30Days;

  const buyersInLast30Days = safeBuyers.filter(b => b.created_at && isWithinInterval(parseISO(b.created_at), { start: last30Days, end: now })).length;
  const previousBuyersCount = safeBuyers.length - buyersInLast30Days;

  const soldInLast30Days = safeProperties.filter(p => p.status === 'Sold' && p.sale_date && isWithinInterval(parseISO(p.sale_date), { start: last30Days, end: now }));
  const totalSoldCount = safeProperties.filter(p => p.status === 'Sold').length;
  const previousSoldCount = totalSoldCount - soldInLast30Days.length;

  const revenueInLast30Days = soldInLast30Days.reduce((acc, p) => acc + (p.total_commission || 0), 0);
  const totalRevenue = safeProperties.filter(p => p.status === 'Sold' && p.total_commission).reduce((acc, p) => acc + (p.total_commission || 0), 0);
  const previousRevenue = totalRevenue - revenueInLast30Days;

  const kpis: KpiData[] = [
    {
      id: 'total-properties',
      title: 'Total Properties',
      value: safeProperties.length.toString(),
      icon: Building2,
      color: 'bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-300',
      change: getChange(propertiesInLast30Days, previousPropertiesCount),
    },
    {
      id: 'total-buyers',
      title: 'Total Buyers',
      value: safeBuyers.length.toString(),
      icon: Users,
      color: 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300',
      change: getChange(buyersInLast30Days, previousBuyersCount),
    },
    {
      id: 'properties-sold',
      title: 'Properties Sold (30d)',
      value: soldInLast30Days.length.toString(),
      icon: DollarSign,
      color: 'bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300',
      change: getChange(soldInLast30Days.length, previousSoldCount),
    },
    {
      id: 'interested-buyers',
      title: 'Interested Buyers',
      value: safeBuyers.filter((b: any) => b.status === 'Interested').length.toString(),
      icon: Star,
      color: 'bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-300',
      change: `+${safeBuyers.filter(b => b.status === 'Interested' && b.created_at && isWithinInterval(parseISO(b.created_at), { start: last30Days, end: now })).length} new`,
    },
    {
      id: 'appointments-month',
      title: 'Appointments (30d)',
      value: safeAppointments.filter((a: any) => a.date && isWithinInterval(parseISO(a.date), { start: last30Days, end: now })).length.toString(),
      icon: CalendarDays,
      color: 'bg-cyan-100 dark:bg-cyan-900 text-cyan-600 dark:text-cyan-300',
      change: `${safeAppointments.filter((a: any) => a.status === 'Scheduled' && a.date && new Date(a.date) >= now).length} upcoming`,
    },
  ];

  if (!agentId) {
    kpis.push({
      id: 'monthly-revenue',
      title: 'Revenue (30d)',
      value: formatCurrency(revenueInLast30Days, currency as any, { notation: 'compact' }),
      icon: DollarSign,
      color: 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300',
      change: getChange(revenueInLast30Days, previousRevenue),
    });
  }

  return kpis;
};

const KpiGrid = ({ kpiData, isLoading }: { kpiData: KpiData[], isLoading: boolean }) => {
  const dataToShow = (isLoading || kpiData.length === 0) ? Array(9).fill({}) : kpiData;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {dataToShow.map((kpi, i) => (
        isLoading ?
          <Card key={i}><CardHeader className="pb-2"><Skeleton className="h-4 w-2/3" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /><Skeleton className="h-3 w-1/3 mt-1" /></CardContent></Card> :
          <Card key={kpi.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
              <div className={cn("flex items-center justify-center rounded-full h-8 w-8", kpi.color)}>
                <kpi.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <p className={cn(
                "text-xs text-muted-foreground",
                kpi.change.startsWith('+') && "text-green-600",
                kpi.change.startsWith('-') && "text-red-600"
              )}>
                {kpi.change}
              </p>
            </CardContent>
          </Card>
      ))}
    </div>
  );
};

export default function DashboardPage() {
  const { currency } = useCurrency();
  const firestore = useFirestore();
  const { profile, isLoading: isProfileLoading } = useProfile();

  const canFetchData = !isProfileLoading && profile.agency_id && profile.agency_id.trim() !== '';

  const isAgent = profile.role === 'Agent';

  const propertiesQuery = useMemoFirebase(() => canFetchData ? collection(firestore, 'agencies', profile.agency_id, 'properties') : null, [canFetchData, profile, firestore]);
  const { data: properties, isLoading: pLoading } = useCollection<Property>(propertiesQuery);

  const buyersQuery = useMemoFirebase(() => canFetchData ? collection(firestore, 'agencies', profile.agency_id, 'buyers') : null, [canFetchData, profile, firestore]);
  const { data: buyers, isLoading: bLoading } = useCollection<Buyer>(buyersQuery);

  const appointmentsQuery = useMemoFirebase(() => canFetchData ? collection(firestore, 'agencies', profile.agency_id, 'appointments') : null, [canFetchData, profile, firestore]);
  const { data: appointments, isLoading: aLoading } = useCollection<Appointment>(appointmentsQuery);

  const isLoading = pLoading || bLoading || aLoading;

  const kpiData = useMemo(() => calculateKpis(
    properties,
    buyers,
    appointments,
    currency,
    isAgent ? profile.user_id : undefined,
  ), [properties, buyers, appointments, currency, isAgent, profile.user_id]);

  return (
    <div className="flex flex-col gap-8">
      <div className='space-y-4'>
        <h2 className="text-2xl font-bold tracking-tight font-headline">
          {isAgent ? 'My Stats' : 'Agency Stats'}
        </h2>
        <KpiGrid kpiData={kpiData} isLoading={isLoading} />
      </div>
    </div>
  );
}
