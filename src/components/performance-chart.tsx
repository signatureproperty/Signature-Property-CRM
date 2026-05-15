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
import { TrendingUp } from 'lucide-react';
import { Property } from '@/lib/types';
import { useTheme } from 'next-themes';
import { format, subDays, subMonths, parseISO, eachDayOfInterval, eachMonthOfInterval, startOfMonth } from 'date-fns';
import { useCurrency } from '@/context/currency-context';
import { formatCurrency } from '@/lib/formatters';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


type TimeRange = '7d' | '30d' | '6m' | '12m' | 'all';

export const PerformanceChart = ({ properties }: { properties: Property[] }) => {
   const { theme } = useTheme();
   const { currency } = useCurrency();
   const [timeRange, setTimeRange] = useState<TimeRange>('30d');

   const chartData = React.useMemo(() => {
    const now = new Date();
    let startDate: Date | null = null;
    let dataMap: { [key: string]: { salesRevenue: number, rentRevenue: number } } = {};
    let dateFormat: string;
    let interval;

    switch (timeRange) {
        case '7d':
            startDate = subDays(now, 6);
            dateFormat = 'EEE';
            interval = eachDayOfInterval({ start: startDate, end: now });
            break;
        case '30d':
            startDate = subDays(now, 29);
            dateFormat = 'd MMM';
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
            const allDates = properties
                .map(p => p.sale_date || p.rent_out_date)
                .filter(Boolean)
                .map(d => parseISO(d!));
            if (allDates.length === 0) return [];
            const firstDate = allDates.reduce((min, d) => d < min ? d : min, allDates[0]);
            interval = eachMonthOfInterval({ start: startOfMonth(firstDate), end: now });
            break;

    }
    
    interval.forEach(date => {
        const key = format(date, dateFormat);
        dataMap[key] = { salesRevenue: 0, rentRevenue: 0 };
    });

    const saleProperties = properties.filter((p) => p.status === 'Sold' && p.sale_date && p.total_commission);
    const rentProperties = properties.filter((p) => p.status === 'Rent Out' && p.rent_out_date && p.rent_total_commission);

    saleProperties.forEach((p) => {
        const saleDate = parseISO(p.sale_date!);
        if (!startDate || saleDate >= startDate) {
            const key = format(saleDate, dateFormat);
            if (key in dataMap) {
                dataMap[key].salesRevenue += p.total_commission!;
            }
        }
    });

    rentProperties.forEach((p) => {
        const rentDate = parseISO(p.rent_out_date!);
        if (!startDate || rentDate >= startDate) {
            const key = format(rentDate, dateFormat);
            if (key in dataMap) {
                dataMap[key].rentRevenue += p.rent_total_commission!;
            }
        }
    });
    
    return Object.keys(dataMap).map(key => ({
        month: key,
        salesRevenue: dataMap[key].salesRevenue,
        rentRevenue: dataMap[key].rentRevenue,
    }));
    
  }, [properties, timeRange]);

  const isBar = timeRange === '7d' || timeRange === '30d';


  return (
    <Card className="shadow-lg col-span-1">
      <CardHeader>
        <div className="flex justify-between items-center">
            <div>
              <CardTitle className="font-headline text-2xl font-bold flex items-center gap-2">
                <TrendingUp />
                Monthly Revenue
              </CardTitle>
              <CardDescription>Revenue from sales and rentals.</CardDescription>
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
          {isBar ? (
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis
                tickFormatter={(value) => formatCurrency(value as number, currency, { notation: 'compact' })}
                tickLine={false}
                axisLine={false}
                width={80}
                fontSize={12}
              />
              <Tooltip />
              <Legend verticalAlign="bottom" wrapperStyle={{paddingTop: 20}} />
              <Bar dataKey="salesRevenue" name="Sales Revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="rentRevenue" name="Rent Revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <AreaChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 20 }}
            >
              <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorRent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#16a34a" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0}/>
                  </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis
                tickFormatter={(value) => formatCurrency(value as number, currency, { notation: 'compact' })}
                tickLine={false}
                axisLine={false}
                width={80}
                fontSize={12}
              />
              <Tooltip />
              <Legend verticalAlign="bottom" wrapperStyle={{paddingTop: 20}} />
              <Area type="monotone" dataKey="salesRevenue" name="Sales Revenue" stroke="#2563eb" fill="url(#colorSales)" strokeWidth={2} />
              <Area type="monotone" dataKey="rentRevenue" name="Rent Revenue" stroke="#16a34a" fill="url(#colorRent)" strokeWidth={2} />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};