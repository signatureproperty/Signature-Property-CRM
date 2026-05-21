
'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useFirestore } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, doc, deleteDoc, updateDoc, query, orderBy, addDoc } from 'firebase/firestore';
import { useProfile } from '@/context/profile-context';
import { useMemoFirebase } from '@/firebase/hooks';
import { 
    Sparkles, 
    Plus, 
    Zap, 
    History, 
    MoreHorizontal, 
    Edit, 
    Trash2, 
    CheckCircle, 
    Clock, 
    PlayCircle,
    User,
    Tag,
    Search,
    Phone,
    FileText,
    Info,
    RefreshCw
} from 'lucide-react';
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import { AddServiceDialog } from '@/components/add-service-dialog';
import { AssignServiceDialog } from '@/components/assign-service-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { useCurrency } from '@/context/currency-context';
import { formatCurrency } from '@/lib/formatters';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { BuyerDetailsDialog } from '@/components/buyer-details-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Buyer, ProvidedService, Service } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

const getStatusColor = (status: string) => {
    switch (status) {
        case 'Pending': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
        case 'Completed': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
        default: return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    }
};

const getStatusIcon = (status: string) => {
    switch (status) {
        case 'Pending': return <Clock className="h-3 w-3" />;
        case 'Completed': return <CheckCircle className="h-3 w-3" />;
        default: return <PlayCircle className="h-3 w-3" />;
    }
};

export default function ServicesPage() {
    const { profile } = useProfile();
    const { currency } = useCurrency();
    const firestore = useFirestore();
    const { toast } = useToast();
    const isMobile = useIsMobile();
    
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isAssignOpen, setIsAssignOpen] = useState(false);
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [serviceSearch, setServiceSearch] = useState('');

    // State for viewing details
    const [viewingBuyer, setViewingBuyer] = useState<Buyer | null>(null);
    const [isBuyerOpen, setIsBuyerOpen] = useState(false);
    const [viewingExternal, setViewingExternal] = useState<ProvidedService | null>(null);
    const [isExternalOpen, setIsExternalOpen] = useState(false);

    // --- Data Fetching ---
    const servicesQuery = useMemoFirebase(() => 
        profile.agency_id ? query(collection(firestore, 'agencies', profile.agency_id, 'services'), orderBy('created_at', 'desc')) : null,
        [profile.agency_id, firestore]
    );
    const { data: services, isLoading: isServicesLoading } = useCollection<Service>(servicesQuery);

    const providedQuery = useMemoFirebase(() => 
        profile.agency_id ? query(collection(firestore, 'agencies', profile.agency_id, 'providedServices'), orderBy('created_at', 'desc')) : null,
        [profile.agency_id, firestore]
    );
    const { data: providedServices, isLoading: isProvidedLoading } = useCollection<ProvidedService>(providedQuery);

    const buyersQuery = useMemoFirebase(() => 
        profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'buyers') : null,
        [profile.agency_id, firestore]
    );
    const { data: buyers } = useCollection<Buyer>(buyersQuery);

    const handleUpdateStatus = (log: ProvidedService, newStatus: string) => {
        if (!profile.agency_id) return;
        
        const docRef = doc(firestore, 'agencies', profile.agency_id, 'providedServices', log.id);
        
        // Update status Non-blocking
        updateDoc(docRef, { status: newStatus }).catch(async () => {
            const permissionError = new FirestorePermissionError({
                path: docRef.path,
                operation: 'update',
                requestResourceData: { status: newStatus },
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
        });
        
        // Log activity Non-blocking
        const activityColRef = collection(firestore, 'agencies', profile.agency_id, 'activityLogs');
        const targetName = (log.assignedToType === 'Lead' ? log.leadName : (log.externalName || log.externalClientDetails)) || 'Client';
        
        addDoc(activityColRef, {
            userName: profile.name,
            action: `updated status of "${log.serviceName}" to ${newStatus}`,
            target: targetName,
            targetType: 'Service',
            timestamp: new Date().toISOString(),
            agency_id: profile.agency_id,
            details: { from: log.status, to: newStatus }
        }).catch(() => {});

        toast({ title: `Updating to ${newStatus}...` });
    };

    const handleDeleteService = (id: string) => {
        if (!profile.agency_id) return;
        const docRef = doc(firestore, 'agencies', profile.agency_id, 'services', id);
        
        deleteDoc(docRef).catch(async () => {
            const permissionError = new FirestorePermissionError({
                path: docRef.path,
                operation: 'delete',
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
        });
        toast({ title: "Deleting service..." });
    };

    const handleClientClick = (log: ProvidedService) => {
        if (log.assignedToType === 'Lead' && log.leadId) {
            const buyer = buyers?.find(b => b.id === log.leadId);
            if (buyer) {
                setViewingBuyer(buyer);
                setIsBuyerOpen(true);
            }
        } else {
            setViewingExternal(log);
            setIsExternalOpen(true);
        }
    };

    const filteredServices = useMemo(() => {
        if (!services) return [];
        if (!serviceSearch) return services;
        return services.filter(s => 
            s.name.toLowerCase().includes(serviceSearch.toLowerCase()) || 
            s.category.toLowerCase().includes(serviceSearch.toLowerCase())
        );
    }, [services, serviceSearch]);

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight font-headline flex items-center gap-3">
                        <Sparkles className="h-8 w-8 text-primary" /> Agency Services
                    </h1>
                    <p className="text-muted-foreground font-medium">Manage custom agency offerings and workflows.</p>
                </div>
                <Button className="rounded-full glowing-btn px-6 font-bold" onClick={() => { setSelectedService(null); setIsAddOpen(true); }}>
                    <Plus className="mr-2 h-4 w-4" /> Create New Service
                </Button>
            </div>

            <Tabs defaultValue="directory" className="w-full">
                <TabsList className="bg-muted/50 p-1 rounded-full grid grid-cols-2 max-w-sm mb-8 shadow-inner">
                    <TabsTrigger value="directory" className="rounded-full font-bold data-[state=active]:shadow-md">Directory</TabsTrigger>
                    <TabsTrigger value="logs" className="rounded-full font-bold data-[state=active]:shadow-md">Service Logs</TabsTrigger>
                </TabsList>

                <TabsContent value="directory" className="space-y-6">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search services..." 
                            className="pl-10 rounded-full h-11 bg-card border-none shadow-sm ring-1 ring-border/50 focus-visible:ring-primary/20"
                            value={serviceSearch}
                            onChange={e => setServiceSearch(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {isServicesLoading ? (
                             [1, 2, 3].map(i => <Card key={i} className="h-48 animate-pulse bg-muted/20 border-none" />)
                        ) : filteredServices.length > 0 ? (
                            filteredServices.map(service => (
                                <Card key={service.id} className="border-none shadow-xl bg-card/60 backdrop-blur-sm overflow-hidden group hover:scale-[1.02] transition-all border-l-4 border-l-primary/40">
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-start">
                                            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 uppercase text-[9px] font-black tracking-widest">{service.category}</Badge>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 opacity-0 group-hover:opacity-100 transition-opacity"><MoreHorizontal className="h-4 w-4" /></Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="bg-background">
                                                    <DropdownMenuItem onClick={() => { setSelectedService(service); setIsAddOpen(true); }}><Edit className="mr-2 h-4 w-4" /> Edit Definition</DropdownMenuItem>
                                                    <DropdownMenuItem className="text-destructive font-bold" onClick={() => handleDeleteService(service.id)}><Trash2 className="mr-2 h-4 w-4" /> Delete Service</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                        <CardTitle className="text-xl font-black font-headline pt-2">{service.name}</CardTitle>
                                        <CardDescription className="line-clamp-2 min-h-[2.5rem] font-medium">{service.description || 'No description provided.'}</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-black text-primary">{formatCurrency(service.price, currency)}</div>
                                        {service.customStatuses && service.customStatuses.length > 0 && (
                                            <div className="mt-3 flex flex-wrap gap-1">
                                                {service.customStatuses.slice(0, 3).map(s => <Badge key={s} variant="secondary" className="text-[8px] h-4 py-0 font-bold opacity-60">{s}</Badge>)}
                                                {service.customStatuses.length > 3 && <span className="text-[8px] font-bold opacity-40">+{service.customStatuses.length - 3} more</span>}
                                            </div>
                                        )}
                                    </CardContent>
                                    <CardFooter className="bg-muted/5 p-4 border-t border-dashed">
                                        <Button className="w-full rounded-xl h-11 font-black bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all shadow-none gap-2" onClick={() => { setSelectedService(service); setIsAssignOpen(true); }}>
                                            <Zap className="h-4 w-4" /> SELL SERVICE
                                        </Button>
                                    </CardFooter>
                                </Card>
                            ))
                        ) : (
                            <div className="col-span-full py-20 text-center border-2 border-dashed rounded-[2.5rem] opacity-30 bg-muted/5">
                                <Sparkles className="h-12 w-12 mx-auto mb-3" />
                                <p className="font-black uppercase tracking-widest text-sm">No services found in your directory.</p>
                            </div>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="logs">
                    <Card className="border-none shadow-2xl rounded-[2rem] overflow-hidden bg-card/60 backdrop-blur-xl ring-1 ring-border/50">
                        <CardHeader className="bg-muted/30 pb-6">
                            <CardTitle className="flex items-center gap-2 font-headline text-xl font-black"><History className="h-5 w-5 text-primary" /> Active Service Logs</CardTitle>
                            <CardDescription className="font-medium">Track progress of every service assigned to clients.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            {isProvidedLoading ? (
                                <div className="p-20 text-center opacity-40"><RefreshCw className="animate-spin h-8 w-8 mx-auto mb-2" /> Loading logs...</div>
                            ) : providedServices && providedServices.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader className="bg-muted/10">
                                            <TableRow className="border-none">
                                                <TableHead className="font-black text-[10px] uppercase pl-6 py-4">Service Type</TableHead>
                                                <TableHead className="font-black text-[10px] uppercase">Client / Lead</TableHead>
                                                <TableHead className="font-black text-[10px] uppercase">Net Amount</TableHead>
                                                <TableHead className="font-black text-[10px] uppercase">Status Tracker</TableHead>
                                                <TableHead className="font-black text-[10px] uppercase text-right">Provisioned</TableHead>
                                                <TableHead className="w-20"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {providedServices.map(log => {
                                                const parentService = services?.find(s => s.id === log.serviceId);
                                                const customOptions = parentService?.customStatuses || [];
                                                const statusOptions = ['Pending', ...customOptions, 'Completed'];
                                                
                                                return (
                                                    <TableRow key={log.id} className="group hover:bg-primary/5 transition-colors border-border/30">
                                                        <TableCell className="font-bold pl-6">{log.serviceName}</TableCell>
                                                        <TableCell className="cursor-pointer" onClick={() => handleClientClick(log)}>
                                                            {log.assignedToType === 'Lead' ? (
                                                                <div className="flex items-center gap-2">
                                                                    <User className="h-3 w-3 text-primary" />
                                                                    <span className="text-sm font-bold group-hover:text-primary transition-colors underline underline-offset-4 decoration-primary/20 decoration-2">{log.leadName}</span>
                                                                    <Badge variant="secondary" className="text-[8px] h-4 font-black">LEAD</Badge>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-2">
                                                                    <User className="h-3 w-3 text-orange-500" />
                                                                    <span className="text-sm font-bold group-hover:text-orange-500 transition-colors underline underline-offset-4 decoration-orange-500/20 decoration-2">{log.externalName}</span>
                                                                    <Badge variant="outline" className="text-[8px] h-4 border-orange-500/20 text-orange-600 bg-orange-500/5 font-black">EXTERNAL</Badge>
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="font-black text-primary">{formatCurrency(log.priceCharged, currency)}</TableCell>
                                                        <TableCell>
                                                            <Badge className={cn("rounded-lg border font-black gap-1.5 px-3 py-1 text-[10px]", getStatusColor(log.status))}>
                                                                {getStatusIcon(log.status)}
                                                                {log.status.toUpperCase()}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right text-[11px] font-bold text-muted-foreground">{format(new Date(log.created_at), 'PP')}</TableCell>
                                                        <TableCell className="text-right pr-6">
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full shadow-sm border border-transparent group-hover:border-border"><MoreHorizontal className="h-4 w-4" /></Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="bg-background w-56">
                                                                    <DropdownMenuLabel className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Change Status</DropdownMenuLabel>
                                                                    <DropdownMenuSeparator />
                                                                    {statusOptions.map(opt => (
                                                                        <DropdownMenuItem 
                                                                            key={opt} 
                                                                            onClick={() => handleUpdateStatus(log, opt)}
                                                                            className={cn("gap-2 font-bold", log.status === opt && "bg-primary/10 text-primary")}
                                                                        >
                                                                            {getStatusIcon(opt)}
                                                                            {opt}
                                                                        </DropdownMenuItem>
                                                                    ))}
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuItem className="text-destructive font-bold"><Trash2 className="mr-2 h-4 w-4" /> Remove Log</DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <div className="py-40 text-center opacity-30">
                                    <History className="h-16 w-16 mx-auto mb-4" />
                                    <p className="font-black uppercase tracking-[0.2em] text-sm">No services provided yet</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <AddServiceDialog 
                isOpen={isAddOpen} 
                setIsOpen={setIsAddOpen} 
                serviceToEdit={selectedService} 
            />

            {selectedService && (
                <AssignServiceDialog 
                    isOpen={isAssignOpen} 
                    setIsOpen={setIsAssignOpen} 
                    service={selectedService} 
                />
            )}

            {/* View Buyer Lead Details */}
            {viewingBuyer && (
                <BuyerDetailsDialog 
                    buyer={viewingBuyer}
                    isOpen={isBuyerOpen}
                    setIsOpen={setIsBuyerOpen}
                />
            )}

            {/* View External Client Details */}
            <Dialog open={isExternalOpen} onOpenChange={setIsExternalOpen}>
                <DialogContent className="sm:max-w-md border-none shadow-3xl rounded-[2.5rem] p-0 overflow-hidden">
                    <div className="p-8 pb-2">
                        <DialogHeader>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-3 bg-orange-500/10 rounded-2xl text-orange-600">
                                    <User className="h-6 w-6" />
                                </div>
                                <div>
                                    <DialogTitle className="font-headline text-xl font-black">External Client Profile</DialogTitle>
                                    <DialogDescription className="text-xs font-medium">Service provided to a non-CRM lead.</DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>
                    </div>
                    {viewingExternal && (
                        <div className="px-8 py-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-2xl bg-muted/20 border border-border/40">
                                    <Label className="text-[9px] font-black uppercase tracking-widest opacity-60 flex items-center gap-1.5 mb-1"><User className="h-3 w-3" /> Client Name</Label>
                                    <p className="font-bold text-sm">{viewingExternal.externalName}</p>
                                </div>
                                <div className="p-4 rounded-2xl bg-muted/20 border border-border/40">
                                    <Label className="text-[9px] font-black uppercase tracking-widest opacity-60 flex items-center gap-1.5 mb-1"><Phone className="h-3 w-3" /> Contact No</Label>
                                    <p className="font-bold text-sm">{viewingExternal.externalPhone || 'N/A'}</p>
                                </div>
                            </div>
                            <div className="p-5 rounded-2xl bg-primary/5 border border-primary/10">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-primary opacity-70 flex items-center gap-1.5 mb-2"><FileText className="h-3 w-3" /> Requirements & Notes</Label>
                                <p className="text-sm font-bold leading-relaxed italic">"{viewingExternal.externalClientDetails || 'No additional details provided.'}"</p>
                            </div>
                        </div>
                    )}
                    <DialogFooter className="p-8 border-t bg-muted/5 mt-4">
                        <Button variant="secondary" className="rounded-xl px-10 h-11 font-black w-full sm:w-auto" onClick={() => setIsExternalOpen(false)}>Close Record</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

