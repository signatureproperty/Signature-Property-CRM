
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, MoreHorizontal, PlayCircle, CheckCheck, RotateCcw, Eye, DollarSign } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { Property, EditingStatus, RecordingPaymentStatus, InboxMessage } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, doc, updateDoc, query, where, addDoc } from 'firebase/firestore';
import { useMemoFirebase } from '@/firebase/hooks';
import { useProfile } from '@/context/profile-context';
import { useSearch } from '../layout';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { PropertyDetailsDialog } from '@/components/property-details-dialog';
import { ConfirmCashPaymentDialog } from '@/components/confirm-cash-payment-dialog';

export default function EditingPage() {
    const { toast } = useToast();
    const firestore = useFirestore();
    const { profile } = useProfile();
    const { searchQuery, setSearchQuery } = useSearch();
    const [propertyForDetails, setPropertyForDetails] = useState<Property | null>(null);
    const [propertyForPayment, setPropertyForPayment] = useState<Property | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [isPaymentOpen, setIsPaymentOpen] = useState(false);
    const isMobile = useIsMobile();

    const propertiesQuery = useMemoFirebase(() => 
        profile.agency_id && profile.user_id
            ? query(
                collection(firestore, 'agencies', profile.agency_id, 'properties'), 
                where('assignedTo', 'array-contains', profile.user_id),
                where('is_recorded', '==', true)
            ) 
            : null, 
        [firestore, profile.agency_id, profile.user_id]
    );
    const { data: properties, isLoading } = useCollection<Property>(propertiesQuery);

    const filteredProperties = useMemo(() => {
        if (!properties) return [];
        if (!searchQuery) return properties;

        const lowercasedQuery = searchQuery.toLowerCase();
        return properties.filter(prop => 
            prop.serial_no.toLowerCase().includes(lowercasedQuery) ||
            prop.auto_title.toLowerCase().includes(lowercasedQuery) ||
            prop.address.toLowerCase().includes(lowercasedQuery)
        );
    }, [properties, searchQuery]);
    
    const handleStatusUpdate = async (property: Property, status: EditingStatus) => {
        if (!profile.agency_id) return;
        try {
            const propRef = doc(firestore, 'agencies', profile.agency_id, 'properties', property.id);
            await updateDoc(propRef, { editing_status: status });
            
            toast({
                title: `Status set to "${status}"`,
            });
            
        } catch (error) {
            console.error("Error updating editing status:", error);
            toast({ title: "Error", description: "Could not update status.", variant: "destructive" });
        }
    };

    const handleCashPaymentConfirm = (property: Property) => {
        setPropertyForPayment(property);
        setIsPaymentOpen(true);
    };

    const handleSaveCashPayment = async (property: Property, amount: number) => {
        if (!profile.agency_id) return;
        try {
            const propRef = doc(firestore, 'agencies', profile.agency_id, 'properties', property.id);
            await updateDoc(propRef, {
                recording_payment_status: 'Paid Online', // Marking as paid
                recording_payment_amount: amount,
                recording_payment_date: new Date().toISOString(),
            });

            // Create an inbox message for the admin
            const inboxMessage: Omit<InboxMessage, 'id'> = {
                type: 'payment_confirmation',
                fromUserId: profile.user_id,
                fromUserName: profile.name,
                message: `Cash payment of PKR ${amount.toLocaleString()} received for property ${property.serial_no}.`,
                propertyId: property.id,
                propertySerial: property.serial_no,
                isRead: false,
                createdAt: new Date().toISOString(),
                agency_id: profile.agency_id,
            };
            await addDoc(collection(firestore, 'agencies', profile.agency_id, 'inboxMessages'), inboxMessage);

            toast({
                title: 'Payment Confirmed',
                description: `Cash payment of ${amount} for ${property.serial_no} has been recorded. Admin has been notified.`,
            });
        } catch (error) {
            toast({ title: 'Error', description: 'Could not save payment.', variant: 'destructive' });
        } finally {
            setIsPaymentOpen(false);
            setPropertyForPayment(null);
        }
    }
    
    const handleRevertToRecording = async (property: Property) => {
        if (!profile.agency_id) return;
        try {
            const propRef = doc(firestore, 'agencies', profile.agency_id, 'properties', property.id);
            await updateDoc(propRef, { is_recorded: false, editing_status: 'In Editing' });
            toast({
                title: 'Sent back to Recording',
                description: `${property.serial_no} is now in the recording queue.`,
            });
        } catch (error) {
            console.error("Error reverting to recording:", error);
            toast({ title: "Error", description: "Could not update property.", variant: "destructive" });
        }
    }
    
    const handleRowClick = (property: Property) => {
        setPropertyForDetails(property);
        setIsDetailsOpen(true);
    };


    const statusConfig: Record<EditingStatus, { color: string, icon: React.ElementType }> = {
        'In Editing': { color: 'bg-yellow-500/80 hover:bg-yellow-500', icon: PlayCircle },
        'Complete': { color: 'bg-green-600/80 hover:bg-green-600', icon: CheckCheck },
    };
    
    const renderTable = (propertiesToList: Property[]) => (
        <Card>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Serial No</TableHead>
                            <TableHead>Property</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {propertiesToList.map(prop => {
                            const currentStatus = prop.editing_status || 'In Editing';
                            const Icon = statusConfig[currentStatus].icon;
                            return (
                                <TableRow key={prop.id} onClick={() => handleRowClick(prop)} className="cursor-pointer">
                                    <TableCell><Badge variant="outline">{prop.serial_no}</Badge></TableCell>
                                    <TableCell className="font-medium">{prop.auto_title}</TableCell>
                                    <TableCell>
                                        <Badge className={cn(statusConfig[currentStatus].color)}>
                                            <Icon className="mr-1 h-3 w-3" />
                                            {currentStatus}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon"><MoreHorizontal /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent>
                                                <DropdownMenuItem onSelect={() => handleRowClick(prop)}><Eye className="mr-2" /> View Details</DropdownMenuItem>
                                                {prop.recording_payment_status === 'Pending Cash' && (
                                                    <DropdownMenuItem onSelect={() => handleCashPaymentConfirm(prop)}>
                                                        <DollarSign className="mr-2" /> Confirm Cash Payment
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem onSelect={() => handleStatusUpdate(prop, 'In Editing')}>
                                                    <PlayCircle className="mr-2" /> Mark as In Editing
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onSelect={() => handleStatusUpdate(prop, 'Complete')}>
                                                     <CheckCheck className="mr-2" /> Mark as Complete
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onSelect={() => handleRevertToRecording(prop)}>
                                                    <RotateCcw className="mr-2" /> Re-send to Recording
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );

    const renderCards = (propertiesToList: Property[]) => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {propertiesToList.map(prop => {
                 const currentStatus = prop.editing_status || 'In Editing';
                 const Icon = statusConfig[currentStatus].icon;
                return (
                    <Card key={prop.id} className="flex flex-col hover:shadow-lg transition-shadow cursor-pointer" onClick={() => handleRowClick(prop)}>
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <Badge variant="outline">{prop.serial_no}</Badge>
                                <Badge className={cn(statusConfig[currentStatus].color)}>
                                    <Icon className="mr-1 h-3 w-3" />
                                    {currentStatus}
                                </Badge>
                            </div>
                            <CardTitle className="pt-2 font-bold font-headline text-base">{prop.auto_title}</CardTitle>
                        </CardHeader>
                         <CardContent className="flex-1">
                            {prop.recording_payment_status === 'Pending Cash' && (
                                <Button size="sm" className="w-full mt-2" onClick={(e) => { e.stopPropagation(); handleCashPaymentConfirm(prop); }}>
                                    <DollarSign className="mr-2" /> Confirm Cash Payment
                                </Button>
                            )}
                        </CardContent>
                        <CardFooter className="mt-auto flex justify-end">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2" onClick={(e) => e.stopPropagation()}>
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                    <DropdownMenuItem onSelect={() => handleRowClick(prop)}><Eye className="mr-2" /> View Details</DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => handleStatusUpdate(prop, 'In Editing')}>
                                        <PlayCircle className="mr-2" /> Mark as In Editing
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => handleStatusUpdate(prop, 'Complete')}>
                                        <CheckCheck className="mr-2" /> Mark as Complete
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => handleRevertToRecording(prop)}>
                                        <RotateCcw className="mr-2" /> Re-send to Recording
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </CardFooter>
                    </Card>
                )
            })}
        </div>
    );

    return (
        <>
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight font-headline flex items-center gap-2"><Edit /> Video Editing Queue</h1>
                <p className="text-muted-foreground">Manage the editing status of your recorded videos.</p>
            </div>
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Search by SN, Title, or Address..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
            {isLoading ? (
                <div className="text-center py-10 text-muted-foreground">Loading editing queue...</div>
            ) : filteredProperties.length > 0 ? (
                isMobile ? renderCards(filteredProperties) : renderTable(filteredProperties)
            ) : (
                <div className="text-center py-20 text-muted-foreground bg-card rounded-lg">No recorded videos in the editing queue.</div>
            )}
        </div>
        {propertyForDetails && (
            <PropertyDetailsDialog
                property={propertyForDetails}
                isOpen={isDetailsOpen}
                setIsOpen={setIsDetailsOpen}
            />
        )}
        {propertyForPayment && (
            <ConfirmCashPaymentDialog
                isOpen={isPaymentOpen}
                setIsOpen={setIsPaymentOpen}
                property={propertyForPayment}
                onConfirm={handleSaveCashPayment}
            />
        )}
        </>
    );
}
