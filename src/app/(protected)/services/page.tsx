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
    RefreshCw,
    Wallet,
    DollarSign,
    ListChecks,
    Check
} from 'lucide-react';
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
    DropdownMenuCheckboxItem
} from '@/components/ui/dropdown-menu';
import { AddServiceDialog } from '@/components/add-service-dialog';
import { AssignServiceDialog } from '@/components/assign-service-dialog';
import { UpdateServicePaymentDialog } from '@/components/update-service-payment-dialog';
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

const getPaymentBadge = (status?: string) => {
    switch (status) {
        case 'Paid': return <Badge className="bg-emerald-600/10 text-emerald-600 border-none font-black text-[9px] gap-1 px-2 py-0.5"><Check className="h-2.5 w-2.5"/> PAID</Badge>;
        case 'Partial': return <Badge className="bg-amber-600/10 text-amber-600 border-none font-black text-[9px] gap-1 px-2 py-0.5"><Clock className="h-2.5 w-2.5"/> PARTIAL</Badge>;
        default: return <Badge className="bg-destructive/10 text-destructive border-none font-black text-[9px] gap-1 px-2 py-0.5"><Wallet className="h-2.5 w-2.5"/> DUE</Badge>;
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
    const [isPaymentOpen, setIsPaymentOpen] = useState(false);
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [selectedLog, setSelectedLog] = useState<ProvidedService | null>(null);
    const [serviceSearch, setServiceSearch] = useState('');

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
        updateDoc(docRef, { status: newStatus }).catch(async () => {
            const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: { status: newStatus } } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
        });
        toast({ title: `Updating status to ${newStatus}...` });
    };

    const handleToggleTag = (log: ProvidedService, tagName: string) => {
        if (!profile.agency_id) return;
        const currentTags = log.tags || [];
        const newTags = currentTags.includes(tagName) ? currentTags.filter(t => t !== tagName) : [...currentTags, tagName];
        const docRef = doc(firestore, 'agencies', profile.agency_id, 'providedServices', log.id);
        updateDoc(docRef, { tags: newTags }).catch(() => {});
        toast({ title: "Tags updated." });
    };

    const handleDeleteService = (id: string) => {
        if (!profile.agency_id) return;
        const docRef = doc(firestore, 'agencies', profile.agency_id, 'services', id);
        deleteDoc(docRef).catch(() => {});
        toast({ title: "Deleting service definition..." });
    };

    const handleDeleteLog = (id: string) => {
        if (!profile.agency_id) return;
        const docRef = doc(firestore, 'agencies', profile.agency_id, 'providedServices', id);
        deleteDoc(docRef).catch(() => {
            toast({ title: "Deletion failed", variant: "destructive" });
        });
        toast({ title: "Removing entry from pipeline..." });
    };

    const handleClientClick = (log: ProvidedService) => {
        if (log.assignedToType === 'Lead' && log.leadId) {
            const buyer = buyers?.find(b => b.id === log.leadId);
            if (buyer) { setViewingBuyer(buyer); setIsBuyerOpen(true); }
        } else {
            setViewingExternal(log); setIsExternalOpen(true);
        }
    };

    const filteredServices = useMemo(() => {
        if (!services) return [];
        if (!serviceSearch) return services;
        return services.filter(s => s.name.toLowerCase().includes(serviceSearch.toLowerCase()) || s.category.toLowerCase().includes(serviceSearch.toLowerCase()));
    }, [services, serviceSearch]);

    const renderMobileLogs = () => (
        <div className="space-y-4">
            {providedServices?.map(log => (
                <Card key={log.id} className="border-none shadow-xl bg-card/60 backdrop-blur-sm overflow-hidden border-l-4 border-l-primary/40">
                    <CardContent className="p-5">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-0.5">{log.serviceName}</p>
                                <div className="flex items-center gap-2 cursor-pointer" onClick={() => handleClientClick(log)}>
                                    <span className="font-bold text-sm underline decoration-primary/20 underline-offset-4">{log.leadName || log.externalName}</span>
                                    <Badge variant="secondary" className="text-[8px] h-4 font-black">{log.assignedToType.toUpperCase()}</Badge>
                                </div>
                            </div>
                            {renderActionMenu(log)}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-[9px] font-black uppercase opacity-50">Status & Step</Label>
                                <Badge className={cn("rounded-lg border font-black gap-1.5 px-2 py-0.5 text-[9px] uppercase w-fit", getStatusColor(log.status))}>
                                    {getStatusIcon(log.status)} {log.status}
                                </Badge>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[9px] font-black uppercase opacity-50">Billing</Label>
                                <div className="flex flex-col">
                                    <span className="text-xs font-black text-primary">{formatCurrency(log.priceCharged, currency)}</span>
                                    {getPaymentBadge(log.paymentStatus)}
                                </div>
                            </div>
                        </div>
                        {log.tags && log.tags.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-1 border-t border-dashed pt-3">
                                {log.tags.map(t => <Badge key={t} variant="outline" className="text-[8px] bg-primary/5 border-primary/20 text-primary/70 font-bold px-1.5">{t}</Badge>)}
                            </div>
                        )}
                    </CardContent>
                </Card>
            ))}
        </div>
    );

    const renderActionMenu = (log: ProvidedService) => {
        const parentService = services?.find(s => s.id === log.serviceId);
        const statusOptions = ['Pending', ...(parentService?.customStatuses || []), 'Completed'];
        const tagOptions = parentService?.tags || [];

        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full shadow-sm border border-transparent group-hover:border-border"><MoreHorizontal className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-background w-56">
                    <DropdownMenuLabel className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5"><ListChecks className="h-3 w-3"/> Workflow Stage</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {statusOptions.map(opt => (
                        <DropdownMenuItem key={opt} onClick={() => handleUpdateStatus(log, opt)} className={cn("gap-2 font-bold", log.status === opt && "bg-primary/10 text-primary")}>
                            {getStatusIcon(opt)} {opt}
                        </DropdownMenuItem>
                    ))}
                    {tagOptions.length > 0 && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5"><Tag className="h-3 w-3"/> Apply Labels</DropdownMenuLabel>
                            {tagOptions.map(tag => (
                                <DropdownMenuCheckboxItem key={tag} checked={log.tags?.includes(tag)} onCheckedChange={() => handleToggleTag(log, tag)} className="font-bold text-xs">{tag}</DropdownMenuCheckboxItem>
                            ))}
                        </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5"><DollarSign className="h-3 w-3"/> Financials</DropdownMenuLabel>
                    <DropdownMenuItem className="gap-2 font-bold text-emerald-600" onClick={() => { setSelectedLog(log); setIsPaymentOpen(true); }}><DollarSign className="h-4 w-4" /> Record Payment</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive font-bold" onClick={() => handleDeleteLog(log.id)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Remove Entry
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        );
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight font-headline flex items-center gap-3">
                        <Sparkles className="h-8 w-8 text-primary" /> Agency Services
                    </h1>
                    <p className="text-muted-foreground font-medium">Create custom offerings and track delivery progress.</p>
                </div>
                <Button className="rounded-full glowing-btn px-6 font-bold w-full md:w-auto" onClick={() => { setSelectedService(null); setIsAddOpen(true); }}>
                    <Plus className="mr-2 h-4 w-4" /> New Service
                </Button>
            </div>

            <Tabs defaultValue="directory" className="w-full">
                <TabsList className="bg-muted/50 p-1 rounded-full grid grid-cols-2 max-w-sm mb-8 shadow-inner ring-1 ring-border/50">
                    <TabsTrigger value="directory" className="rounded-full font-bold">Service Directory</TabsTrigger>
                    <TabsTrigger value="logs" className="rounded-full font-bold">Service Pipeline</TabsTrigger>
                </TabsList>

                <TabsContent value="directory" className="space-y-6">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search catalog..." className="pl-10 rounded-full h-11 bg-card border-none shadow-sm ring-1 ring-border/50" value={serviceSearch} onChange={e => setServiceSearch(e.target.value)} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {isServicesLoading ? [1, 2, 3].map(i => <Card key={i} className="h-48 animate-pulse bg-muted/20 border-none" />) : 
                        filteredServices.length > 0 ? filteredServices.map(service => (
                            <Card key={service.id} className="border-none shadow-xl bg-card/60 backdrop-blur-sm overflow-hidden group hover:scale-[1.01] transition-all border-l-4 border-l-primary/40">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 uppercase text-[8px] font-black tracking-widest">{service.category}</Badge>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 opacity-0 group-hover:opacity-100"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                            <DropdownMenuContent align="end"><DropdownMenuItem onClick={() => { setSelectedService(service); setIsAddOpen(true); }}><Edit className="mr-2 h-4 w-4" /> Edit Definition</DropdownMenuItem><DropdownMenuItem className="text-destructive font-bold" onClick={() => handleDeleteService(service.id)}><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem></DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    <CardTitle className="text-lg font-black font-headline pt-1">{service.name}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="text-2xl font-black text-primary">{formatCurrency(service.price, currency)}</div>
                                    {service.tags && service.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {service.tags.map(t => <Badge key={t} variant="secondary" className="text-[8px] h-4 py-0 font-bold opacity-60">{t}</Badge>)}
                                        </div>
                                    )}
                                </CardContent>
                                <CardFooter className="bg-muted/5 p-4 border-t border-dashed">
                                    <Button className="w-full rounded-xl h-11 font-black bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all shadow-none gap-2" onClick={() => { setSelectedService(service); setIsAssignOpen(true); }}>
                                        <Zap className="h-4 w-4" /> ACTIVATE SERVICE
                                    </Button>
                                </CardFooter>
                            </Card>
                        )) : <div className="col-span-full py-20 text-center border-2 border-dashed rounded-[2rem] opacity-30 bg-muted/5"><Sparkles className="h-10 w-10 mx-auto mb-2" /><p className="font-bold uppercase tracking-widest text-xs">Catalog is empty</p></div>}
                    </div>
                </TabsContent>

                <TabsContent value="logs">
                    {isProvidedLoading ? <div className="p-20 text-center opacity-40"><RefreshCw className="animate-spin h-8 w-8 mx-auto mb-2" /> Loading records...</div> : 
                    providedServices && providedServices.length > 0 ? (
                        isMobile ? renderMobileLogs() : (
                            <Card className="border-none shadow-2xl rounded-[2rem] overflow-hidden bg-card/60 backdrop-blur-xl ring-1 ring-border/50">
                                <Table>
                                    <TableHeader className="bg-muted/10">
                                        <TableRow className="border-none">
                                            <TableHead className="font-black text-[10px] uppercase pl-6 py-4">Status & Step</TableHead>
                                            <TableHead className="font-black text-[10px] uppercase">Service & Labels</TableHead>
                                            <TableHead className="font-black text-[10px] uppercase">Client Info</TableHead>
                                            <TableHead className="font-black text-[10px] uppercase">Financials</TableHead>
                                            <TableHead className="font-black text-[10px] uppercase text-right">Provisioned</TableHead>
                                            <TableHead className="w-16"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {providedServices.map(log => (
                                            <TableRow key={log.id} className="group hover:bg-primary/5 transition-colors border-border/30">
                                                <TableCell className="pl-6">
                                                    <Badge className={cn("rounded-lg border font-black gap-1.5 px-2 py-0.5 text-[9px] uppercase", getStatusColor(log.status))}>
                                                        {getStatusIcon(log.status)} {log.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-bold text-sm">{log.serviceName}</div>
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {log.tags?.map(t => <Badge key={t} variant="outline" className="text-[8px] h-3.5 px-1 py-0 border-primary/20 text-primary/70 font-bold">{t}</Badge>)}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="cursor-pointer" onClick={() => handleClientClick(log)}>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-bold group-hover:text-primary transition-colors underline decoration-primary/10 underline-offset-4">{log.leadName || log.externalName}</span>
                                                        <Badge variant="secondary" className="text-[8px] h-4 font-black">{log.assignedToType.toUpperCase()}</Badge>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-black text-primary text-xs">{formatCurrency(log.priceCharged, currency)}</div>
                                                    <div className="mt-1">{getPaymentBadge(log.paymentStatus)}</div>
                                                </TableCell>
                                                <TableCell className="text-right text-[11px] font-bold text-muted-foreground">{format(new Date(log.created_at), 'PP')}</TableCell>
                                                <TableCell className="text-right pr-6">
                                                    {renderActionMenu(log)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Card>
                        )
                    ) : <div className="py-40 text-center opacity-30"><History className="h-12 w-12 mx-auto mb-2" /><p className="font-black uppercase text-xs tracking-widest">No service history yet</p></div>}
                </TabsContent>
            </Tabs>

            <AddServiceDialog isOpen={isAddOpen} setIsOpen={setIsAddOpen} serviceToEdit={selectedService} />
            {selectedService && <AssignServiceDialog isOpen={isAssignOpen} setIsOpen={setIsAssignOpen} service={selectedService} />}
            {selectedLog && <UpdateServicePaymentDialog isOpen={isPaymentOpen} setIsOpen={setIsPaymentOpen} log={selectedLog} />}
            {viewingBuyer && <BuyerDetailsDialog buyer={viewingBuyer} isOpen={isBuyerOpen} setIsOpen={setIsBuyerOpen} />}
            <Dialog open={isExternalOpen} onOpenChange={setIsExternalOpen}>
                <DialogContent className="sm:max-w-md border-none shadow-3xl rounded-[2rem] p-0 overflow-hidden">
                    <div className="p-8 pb-2"><DialogHeader><div className="flex items-center gap-3 mb-2"><div className="p-3 bg-orange-500/10 rounded-2xl text-orange-600"><User className="h-6 w-6" /></div><div><DialogTitle className="font-headline text-xl font-black">External Client Profile</DialogTitle></div></div></DialogHeader></div>
                    {viewingExternal && <div className="px-8 py-6 space-y-6"><div className="grid grid-cols-2 gap-4"><div className="p-4 rounded-2xl bg-muted/20 border border-border/40"><Label className="text-[9px] font-black uppercase tracking-widest opacity-60 flex items-center gap-1.5 mb-1"><User className="h-3 w-3" /> Client Name</Label><p className="font-bold text-sm">{viewingExternal.externalName}</p></div><div className="p-4 rounded-2xl bg-muted/20 border border-border/40"><Label className="text-[9px] font-black uppercase tracking-widest opacity-60 flex items-center gap-1.5 mb-1"><Phone className="h-3 w-3" /> Contact No</Label><p className="font-bold text-sm">{viewingExternal.externalPhone || 'N/A'}</p></div></div><div className="p-5 rounded-2xl bg-primary/5 border border-primary/10"><Label className="text-[9px] font-black uppercase tracking-widest text-primary opacity-70 flex items-center gap-1.5 mb-2"><FileText className="h-3 w-3" /> Requirements & Notes</Label><p className="text-sm font-bold leading-relaxed italic">"{viewingExternal.externalClientDetails || 'No additional details.'}"</p></div></div>}
                    <DialogFooter className="p-8 border-t bg-muted/5 mt-4"><Button variant="secondary" className="rounded-xl px-10 h-11 font-black w-full" onClick={() => setIsExternalOpen(false)}>Close Record</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
