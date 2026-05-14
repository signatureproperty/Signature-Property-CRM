'use client';

import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFirestore } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy, doc, updateDoc, deleteDoc, arrayUnion } from 'firebase/firestore';
import { useProfile } from '@/context/profile-context';
import { useMemoFirebase } from '@/firebase/hooks';
import type { InboxMessage, Property, Buyer } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Mail, AlertTriangle, Banknote, Check, Trash2, RotateCcw, Eye, X, MessageSquareText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { PropertyDetailsDialog } from '@/components/property-details-dialog';
import { BuyerDetailsDialog } from '@/components/buyer-details-dialog';


const MessageItem = ({ message, onMessageClick, isDemo = false }: { message: InboxMessage, onMessageClick: (message: InboxMessage) => void, isDemo?: boolean }) => {

    const getIcon = () => {
        switch(message.type) {
            case 'cannot_record':
                return <AlertTriangle className="h-5 w-5 text-red-500" />;
            case 'payment_confirmation':
                return <Banknote className="h-5 w-5 text-green-500" />;
            case 'lead_update':
                return <MessageSquareText className="h-5 w-5 text-primary" />;
            default:
                return <Mail className="h-5 w-5 text-muted-foreground" />;
        }
    }

    return (
        <div 
            className={cn("flex items-start gap-4 p-4 border-b transition-colors cursor-pointer hover:bg-accent/50", !message.isRead && "bg-primary/5", isDemo && "opacity-50 pointer-events-none")}
            onClick={() => !isDemo && onMessageClick(message)}
        >
            <div className="flex-shrink-0 pt-1">
                {getIcon()}
            </div>
            <div className="flex-1">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2">
                             <p className="font-semibold">{message.fromUserName}</p>
                             {message.buyerSerial && <Badge variant="outline" className="text-[10px]">{message.buyerSerial}</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{message.message}</p>
                    </div>
                     <p className="text-xs text-muted-foreground whitespace-nowrap">{formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}</p>
                </div>
            </div>
        </div>
    );
};


export default function InboxPage() {
    const { profile } = useProfile();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [selectedMessage, setSelectedMessage] = useState<InboxMessage | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    
    const [propertyForDetails, setPropertyForDetails] = useState<Property | null>(null);
    const [isPropertyDialogOpen, setIsPropertyDialogOpen] = useState(false);

    const [buyerForDetails, setBuyerForDetails] = useState<Buyer | null>(null);
    const [isBuyerDialogOpen, setIsBuyerDialogOpen] = useState(false);


    const inboxQuery = useMemoFirebase(
        () => profile.agency_id 
            ? query(collection(firestore, 'agencies', profile.agency_id, 'inboxMessages'), orderBy('createdAt', 'desc')) 
            : null,
        [profile.agency_id, firestore]
    );
    const { data: messages, isLoading } = useCollection<InboxMessage>(inboxQuery);
    
    const propertiesQuery = useMemoFirebase(
        () => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'properties') : null,
        [profile.agency_id, firestore]
    );
    const { data: properties } = useCollection<Property>(propertiesQuery);

    const buyersQuery = useMemoFirebase(
        () => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'buyers') : null,
        [profile.agency_id, firestore]
    );
    const { data: buyers } = useCollection<Buyer>(buyersQuery);

    
    const unreadCannotRecord = useMemo(() => messages?.filter(m => m.type === 'cannot_record' && !m.isRead).length || 0, [messages]);
    const unreadPayments = useMemo(() => messages?.filter(m => m.type === 'payment_confirmation' && !m.isRead).length || 0, [messages]);
    const unreadLeadUpdates = useMemo(() => messages?.filter(m => m.type === 'lead_update' && !m.isRead).length || 0, [messages]);
    
    const cannotRecordMessages = useMemo(() => messages?.filter(m => m.type === 'cannot_record') || [], [messages]);
    const paymentMessages = useMemo(() => messages?.filter(m => m.type === 'payment_confirmation') || [], [messages]);
    const leadUpdateMessages = useMemo(() => messages?.filter(m => m.type === 'lead_update') || [], [messages]);

    const handleMessageClick = async (message: InboxMessage) => {
        setSelectedMessage(message);
        setIsDialogOpen(true);
        if (!message.isRead && profile.agency_id) {
            const messageRef = doc(firestore, 'agencies', profile.agency_id, 'inboxMessages', message.id);
            await updateDoc(messageRef, { isRead: true });
        }
    }
    
    const handleReassign = async () => {
        if (!selectedMessage || !selectedMessage.propertyId || !selectedMessage.fromUserId || !profile.agency_id) return;
        
        try {
            const propRef = doc(firestore, 'agencies', profile.agency_id, 'properties', selectedMessage.propertyId);
            await updateDoc(propRef, { assignedTo: arrayUnion(selectedMessage.fromUserId) });
            
            const msgRef = doc(firestore, 'agencies', profile.agency_id, 'inboxMessages', selectedMessage.id);
            await deleteDoc(msgRef);

            toast({ title: "Property Re-assigned", description: `${selectedMessage.propertySerial} has been re-assigned for recording.`});
            setIsDialogOpen(false);
        } catch (error) {
            toast({ title: "Error", description: "Could not re-assign property.", variant: "destructive" });
        }
    };

    const handleDelete = async () => {
        if (!selectedMessage || !profile.agency_id) return;
        try {
            const msgRef = doc(firestore, 'agencies', profile.agency_id, 'inboxMessages', selectedMessage.id);
            await deleteDoc(msgRef);
            toast({ title: "Notification Deleted", variant: "destructive"});
            setIsDialogOpen(false);
        } catch (error) {
             toast({ title: "Error", description: "Could not delete notification.", variant: "destructive" });
        }
    };
    
    const handleViewDetails = () => {
        if (selectedMessage?.propertyId) {
            const property = properties?.find(p => p.id === selectedMessage.propertyId);
            if (property) {
                setPropertyForDetails(property);
                setIsPropertyDialogOpen(true);
                setIsDialogOpen(false);
            }
        } else if (selectedMessage?.buyerId) {
            const buyer = buyers?.find(b => b.id === selectedMessage.buyerId);
            if (buyer) {
                setBuyerForDetails(buyer);
                setIsBuyerDialogOpen(true);
                setIsDialogOpen(false);
            }
        } else {
            toast({ title: "Details not available", variant: "destructive" });
        }
    };

    const getDialogTitle = () => {
        if (!selectedMessage) return "";
        switch(selectedMessage.type) {
            case 'cannot_record': return "Cannot Record Report";
            case 'payment_confirmation': return "Payment Confirmation";
            case 'lead_update': return `Lead Update: ${selectedMessage.buyerSerial || ''}`;
            default: return "Notification";
        }
    }


    return (
        <>
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight font-headline flex items-center gap-2">
                        <Mail/> Inbox
                    </h1>
                    <p className="text-muted-foreground">
                        Internal notifications and messages from your team.
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Team Notifications</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Tabs defaultValue="lead_update">
                            <TabsList className="px-6 border-b w-full justify-start rounded-none h-12">
                                <TabsTrigger value="lead_update" className="gap-2">Lead Updates <Badge variant="secondary" className="h-5 px-1.5">{unreadLeadUpdates}</Badge></TabsTrigger>
                                <TabsTrigger value="cannot_record" className="gap-2">Cannot Record <Badge variant="secondary" className="h-5 px-1.5">{unreadCannotRecord}</Badge></TabsTrigger>
                                <TabsTrigger value="payments" className="gap-2">Payments <Badge variant="secondary" className="h-5 px-1.5">{unreadPayments}</Badge></TabsTrigger>
                            </TabsList>
                            
                            <TabsContent value="lead_update">
                                {isLoading ? <p className="p-6 text-muted-foreground">Loading messages...</p> : 
                                leadUpdateMessages.length > 0 ? (
                                    leadUpdateMessages.map(msg => <MessageItem key={msg.id} message={msg} onMessageClick={handleMessageClick} />)
                                ) : (
                                    <p className="p-10 text-center text-muted-foreground">No lead updates found.</p>
                                )
                                }
                            </TabsContent>

                            <TabsContent value="cannot_record">
                                {isLoading ? <p className="p-6 text-muted-foreground">Loading messages...</p> : 
                                cannotRecordMessages.length > 0 ? (
                                    cannotRecordMessages.map(msg => <MessageItem key={msg.id} message={msg} onMessageClick={handleMessageClick} />)
                                ) : (
                                    <p className="p-10 text-center text-muted-foreground">No "Cannot Record" notifications found.</p>
                                )
                                }
                            </TabsContent>
                            
                            <TabsContent value="payments">
                            {isLoading ? <p className="p-6 text-muted-foreground">Loading messages...</p> : 
                                paymentMessages.length > 0 ? (
                                    paymentMessages.map(msg => <MessageItem key={msg.id} message={msg} onMessageClick={handleMessageClick}/>)
                                ) : (
                                    <p className="p-10 text-center text-muted-foreground">No payment confirmation notifications found.</p>
                                )
                                }
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </div>
            
            {selectedMessage && (
                 <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{getDialogTitle()}</DialogTitle>
                            <DialogDescription>
                                From: {selectedMessage.fromUserName}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                            <p className="text-sm whitespace-pre-wrap"><span className="font-bold block mb-1">Message:</span> {selectedMessage.message}</p>
                            <p className="text-xs text-muted-foreground pt-2 border-t">{formatDistanceToNow(new Date(selectedMessage.createdAt), { addSuffix: true })}</p>
                        </div>
                        <DialogFooter className="flex-col sm:flex-row sm:justify-end gap-2">
                            <div className="flex w-full sm:w-auto justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={handleViewDetails}>
                                    <Eye className="h-4 w-4 sm:mr-2" />
                                    <span>View {selectedMessage.buyerId ? 'Lead' : 'Property'}</span>
                                </Button>
                                {selectedMessage.type === 'cannot_record' && (
                                     <Button variant="outline" size="sm" onClick={handleReassign}>
                                        <RotateCcw className="h-4 w-4 mr-2"/>
                                        <span>Re-assign</span>
                                     </Button>
                                )}
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" size="sm">
                                            <Trash2 className="h-4 w-4 sm:mr-2"/>
                                            <span className="hidden sm:inline">Delete</span>
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>This will permanently delete this notification.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleDelete}>Confirm</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                                <Button variant="secondary" onClick={() => setIsDialogOpen(false)} size="sm">
                                    <X className="h-4 w-4 sm:mr-2" />
                                    <span className="hidden sm:inline">Close</span>
                                </Button>
                            </div>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
             {propertyForDetails && (
                <PropertyDetailsDialog
                    property={propertyForDetails}
                    isOpen={isPropertyDialogOpen}
                    setIsOpen={setIsPropertyDialogOpen}
                />
            )}
            {buyerForDetails && (
                <BuyerDetailsDialog
                    buyer={buyerForDetails}
                    isOpen={isBuyerDialogOpen}
                    setIsOpen={setIsBuyerDialogOpen}
                />
            )}
        </>
    );
}

const Badge = ({ children, variant = "default", className }: { children: React.ReactNode, variant?: "default" | "outline" | "secondary", className?: string }) => {
    const variants = {
        default: "bg-primary text-primary-foreground",
        outline: "border border-border text-muted-foreground",
        secondary: "bg-muted text-muted-foreground"
    };
    return (
        <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium", variants[variant], className)}>
            {children}
        </span>
    );
}