
'use client';

import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, Home } from 'lucide-react';
import { Property, Buyer } from '@/lib/types';
import { useTheme } from 'next-themes';
import { format, subDays, subMonths, parseISO, eachDayOfInterval, eachMonthOfInterval, startOfMonth } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type TimeRange = '7d' | '30d' | '6m' | '12m' | 'all';


export const LeadsChart = ({ properties, buyers }: { properties: Property[], buyers: Buyer[] }) => {
   const { theme } = useTheme();
   const [timeRange, setTimeRange] = useState<TimeRange>('30d');

   const chartData = React.useMemo(() => {
    const now = new Date();
    let startDate: Date | null = null;
    let dataMap: { [key: string]: { newSaleProperties: number; newRentProperties: number; newSaleBuyers: number; newRentBuyers: number; } } = {};
    let dateFormat: string;
    let interval;

    switch (timeRange) {
        case '7d':
            startDate = subDays(now, 6);
            dateFormat = 'EEE'; // e.g., Mon
            interval = eachDayOfInterval({ start: startDate, end: now });
            break;
        case '30d':
            startDate = subDays(now, 29);
            dateFormat = 'd MMM'; // e.g., 25 Dec
            interval = eachDayOfInterval({ start: startDate, end: now });
            break;
        case '6m':
            startDate = subMonths(now, 5);
            dateFormat = "MMM '’'yy";
            interval = eachMonthOfInterval({ start: startOfMonth(startDate), end: now });
            break;
        case '12m':
            startDate = subMonths(now, 11);
            dateFormat = "MMM '’'yy";
            interval = eachMonthOfInterval({ start: startOfMonth(startDate), end: now });
            break;
        case 'all':
        default:
            dateFormat = "MMM '’'yy";
            const allDates = [
                ...properties.map(p => p.created_at),
                ...buyers.map(b => b.created_at)
            ].filter(Boolean).map(d => parseISO(d!));
            if (allDates.length === 0) return [];
            const firstDate = allDates.reduce((min, d) => d < min ? d : min, allDates[0]);
            interval = eachMonthOfInterval({ start: startOfMonth(firstDate), end: now });
            break;
    }
    
    interval.forEach(date => {
        const key = format(date, dateFormat);
        dataMap[key] = { newSaleProperties: 0, newRentProperties: 0, newSaleBuyers: 0, newRentBuyers: 0 };
    });
    
    properties.forEach((p) => {
        if (!p.created_at) return;
        const createdDate = parseISO(p.created_at);
        if (!startDate || createdDate >= startDate) {
            const key = format(createdDate, dateFormat);
            if (key in dataMap) {
                if (p.is_for_rent) dataMap[key].newRentProperties += 1;
                else dataMap[key].newSaleProperties += 1;
            }
        }
    });

    buyers.forEach((b) => {
        if (!b.created_at) return;
        const createdDate = parseISO(b.created_at);
        if (!startDate || createdDate >= startDate) {
            const key = format(createdDate, dateFormat);
            if (key in dataMap) {
                if (b.listing_type === 'For Rent') dataMap[key].newRentBuyers += 1;
                else dataMap[key].newSaleBuyers += 1;
            }
        }
    });

    return Object.keys(dataMap).map(key => ({
        month: key,
        ...dataMap[key]
    }));
    
  }, [properties, buyers, timeRange]);

  const ChartComponent = timeRange === '7d' || timeRange === '30d' ? BarChart : AreaChart;
  const ChartElement = timeRange === '7d' || timeRange === '30d' ? Bar : Area;


  return (
    <Card className="shadow-lg col-span-1">
      <CardHeader>
        <div className="flex justify-between items-center">
            <div>
              <CardTitle className="font-headline text-2xl font-bold flex items-center gap-2">
                <Users />
                Monthly Leads Growth
              </CardTitle>
              <CardDescription>New properties and buyers added.</CardDescription>
            </div>
             <Select value={timeRange} onValueChange={(v: TimeRange) => setTimeRange(v)}>
                <SelectTrigger className="w-[120px] h-8 text-xs font-bold rounded-full bg-muted/50">
                    <SelectValue placeholder="Range" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="7d">Last 7 Days</SelectItem>
                    <SelectItem value="30d">Last 30 Days</SelectItem>
                    <SelectItem value="6m">Last 6 Months</SelectItem>
                    <SelectItem value="12m">Last Year</SelectItem>
                    <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
            </Select>
        </div>
      </CardHeader>
      <CardContent className="h-[400px] w-full pt-6">
        <ResponsiveContainer width="100%" height="100%">
          <ChartComponent
            data={chartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 20 }}
          >
            <defs>
                <linearGradient id="colorSaleProps" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={theme === 'dark' ? '#3b82f6' : '#60a5fa'} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={theme === 'dark' ? '#3b82f6' : '#60a5fa'} stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorRentProps" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={theme === 'dark' ? '#f97316' : '#fb923c'} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={theme === 'dark' ? '#f97316' : '#fb923c'} stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorSaleBuyers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={theme === 'dark' ? '#8b5cf6' : '#a78bfa'} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={theme === 'dark' ? '#8b5cf6' : '#a78bfa'} stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorRentBuyers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={theme === 'dark' ? '#14b8a6' : '#2dd4bf'} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={theme === 'dark' ? '#14b8a6' : '#2dd4bf'} stopOpacity={0}/>
                </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={30} fontSize={12} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                    return (
                        <div className="bg-background/80 backdrop-blur-sm border p-3 rounded-lg shadow-lg">
                            <p className="font-bold text-lg mb-2">{label}</p>
                            {payload.map(pld => (
                                <p key={pld.dataKey} style={{ color: pld.stroke || pld.fill }}>
                                    {`${pld.name}: ${pld.value}`}
                                </p>
                            ))}
                        </div>
                    );
                }
                return null;
              }}
            />
             <Legend verticalAlign="bottom" wrapperStyle={{paddingTop: 20}} />
             <ChartElement type="monotone" dataKey="newSaleProperties" name="Sale Properties" stroke="#60a5fa" fill="url(#colorSaleProps)" strokeWidth={2} />
             <ChartElement type="monotone" dataKey="newRentProperties" name="Rent Properties" stroke="#fb923c" fill="url(#colorRentProps)" strokeWidth={2} />
             <ChartElement type="monotone" dataKey="newSaleBuyers" name="Sale Buyers" stroke="#a78bfa" fill="url(#colorSaleBuyers)" strokeWidth={2} />
             <ChartElement type="monotone" dataKey="newRentBuyers" name="Rent Buyers" stroke="#2dd4bf" fill="url(#colorRentBuyers)" strokeWidth={2} />
          </ChartComponent>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
