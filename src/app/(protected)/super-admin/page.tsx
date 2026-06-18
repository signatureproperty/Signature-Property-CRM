'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
    Building2, Users, DollarSign, Gem, Check, X, ShieldAlert, ExternalLink, 
    ArrowUpRight, Clock, Search, Filter, Loader2, Landmark
} from 'lucide-react';
import { useFirestore } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useMemoFirebase } from '@/firebase/hooks';
import { collection, doc, updateDoc, writeBatch, serverTimestamp, query, orderBy } from 'firebase/firestore';
import type { Agency, UpgradeRequest, PlanName } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function SuperAdminPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState('');
    const [isUpdating, setIsUpdating] = useState<string | null>(null);

    // Fetch all agencies
    const agenciesQuery = useMemoFirebase(() => collection(firestore, 'agencies'), [firestore]);
    const { data: agencies, isLoading: isAgenciesLoading } = useCollection<Agency>(agenciesQuery);

    // Fetch upgrade requests
    const upgradeRequestsQuery = useMemoFirebase(() => query(collection(firestore, 'upgradeRequests'), orderBy('createdAt', 'desc')), [firestore]);
    const { data: upgradeRequests, isLoading: isRequestsLoading } = useCollection<UpgradeRequest>(upgradeRequestsQuery);

    const filteredAgencies = useMemo(() => {
        if (!agencies) return [];
        if (!searchQuery) return agencies;
        return agencies.filter(a => 
            a.agencyName.toLowerCase().includes(searchQuery.toLowerCase()) || 
            a.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [agencies, searchQuery]);

    const handleApproveUpgrade = async (request: UpgradeRequest) => {
        setIsUpdating(request.id);
        try {
            const batch = writeBatch(firestore);

            // 1. Update Agency Plan
            const agencyRef = doc(firestore, 'agencies', request.agencyId);
            batch.update(agencyRef, {
                planName: request.requestedPlan,
                planStartDate: serverTimestamp(),
            });

            // 2. Update Request Status
            const requestRef = doc(firestore, 'upgradeRequests', request.id);
            batch.update(requestRef, {
                status: 'approved',
                reviewedAt: serverTimestamp(),
            });

            await batch.commit();
            toast({ title: 'Upgrade Approved', description: `${request.agencyName} is now on ${request.requestedPlan} plan.` });
        } catch (error) {
            toast({ title: 'Error', variant: 'destructive' });
        } finally {
            setIsUpdating(null);
        }
    };

    const handleRejectUpgrade = async (request: UpgradeRequest) => {
        setIsUpdating(request.id);
        try {
            const requestRef = doc(firestore, 'upgradeRequests', request.id);
            await updateDoc(requestRef, {
                status: 'rejected',
                reviewedAt: serverTimestamp(),
            });
            toast({ title: 'Upgrade Rejected' });
        } catch (error) {
            toast({ title: 'Error', variant: 'destructive' });
        } finally {
            setIsUpdating(null);
        }
    };

    return (
        <div className="space-y-10 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight font-headline flex items-center gap-3">
                        <ShieldAlert className="h-8 w-8 text-primary" /> Super Admin Control
                    </h1>
                    <p className="text-muted-foreground font-medium">Manage the entire Signature CRM platform.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-none shadow-sm bg-card/60 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Agencies</CardTitle>
                        <Building2 className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{agencies?.length || 0}</div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-card/60 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Pending Upgrades</CardTitle>
                        <Clock className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black">{upgradeRequests?.filter(r => r.status === 'pending').length || 0}</div>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="agencies" className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-md">
                    <TabsTrigger value="agencies">Agencies</TabsTrigger>
                    <TabsTrigger value="upgrades">Upgrade Requests</TabsTrigger>
                </TabsList>

                <TabsContent value="agencies" className="mt-6 space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Search by agency name or owner..." 
                                className="pl-10 rounded-full"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <Card className="border-none shadow-xl overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead>Agency Name</TableHead>
                                    <TableHead>Owner</TableHead>
                                    <TableHead>Plan</TableHead>
                                    <TableHead>Created At</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isAgenciesLoading ? (
                                    <TableRow><TableCell colSpan={5} className="text-center py-10">Loading agencies...</TableCell></TableRow>
                                ) : filteredAgencies.map(agency => (
                                    <TableRow key={agency.id}>
                                        <TableCell className="font-bold">{agency.agencyName}</TableCell>
                                        <TableCell>{agency.name}</TableCell>
                                        <TableCell>
                                            <Badge variant={agency.planName === 'Premium' ? 'default' : 'outline'}>
                                                {agency.planName || 'Basic'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {agency.createdAt?.toDate ? format(agency.createdAt.toDate(), 'PP') : 'N/A'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                                <ExternalLink className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                </TabsContent>

                <TabsContent value="upgrades" className="mt-6">
                    <Card className="border-none shadow-xl overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead>Agency</TableHead>
                                    <TableHead>Plan Requested</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Receipt</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isRequestsLoading ? (
                                    <TableRow><TableCell colSpan={6} className="text-center py-10">Loading requests...</TableCell></TableRow>
                                ) : upgradeRequests?.length === 0 ? (
                                    <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No upgrade requests yet.</TableCell></TableRow>
                                ) : upgradeRequests?.map(request => (
                                    <TableRow key={request.id}>
                                        <TableCell>
                                            <div className="font-bold">{request.agencyName}</div>
                                            <div className="text-[10px] text-muted-foreground uppercase">{request.userName}</div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className="bg-primary/10 text-primary">{request.requestedPlan} ({request.billingCycle})</Badge>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs font-bold">RS {request.amount.toLocaleString()}</TableCell>
                                        <TableCell>
                                            <Button asChild size="sm" variant="outline" className="h-7 text-[10px] uppercase font-bold">
                                                <a href={request.receiptUrl} target="_blank" rel="noopener noreferrer">View Receipt</a>
                                            </Button>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={request.status === 'approved' ? 'success' : request.status === 'rejected' ? 'destructive' : 'outline'}>
                                                {request.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {request.status === 'pending' ? (
                                                <div className="flex justify-end gap-2">
                                                    <Button 
                                                        size="sm" 
                                                        variant="ghost" 
                                                        className="h-8 w-8 p-0 text-red-500"
                                                        onClick={() => handleRejectUpgrade(request)}
                                                        disabled={!!isUpdating}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                    <Button 
                                                        size="sm" 
                                                        variant="ghost" 
                                                        className="h-8 w-8 p-0 text-green-500"
                                                        onClick={() => handleApproveUpgrade(request)}
                                                        disabled={!!isUpdating}
                                                    >
                                                        <Check className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] text-muted-foreground italic font-medium">Processed</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}