'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Video, Check, MoreHorizontal, XCircle, Eye, Circle, Clock, CheckCircle as CheckCircleIcon } from 'lucide-react';
import type { Property, RecordingPaymentStatus, InboxMessage } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, doc, updateDoc, query, where, addDoc, arrayRemove } from 'firebase/firestore';
import { useMemoFirebase } from '@/firebase/hooks';
import { useProfile } from '@/context/profile-context';
import { useSearch } from '../layout';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { CannotRecordDialog } from '@/components/cannot-record-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { PropertyDetailsDialog } from '@/components/property-details-dialog';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


const paymentStatusConfig: Record<RecordingPaymentStatus, { color: string; label: string; icon: React.FC<any>, borderColor: string; }> = {
    'Unpaid': { color: 'bg-orange-500', label: 'Unpaid', icon: Circle, borderColor: 'border-orange-500/50' },
    'Paid Online': { color: 'bg-green-500', label: 'Paid Online', icon: CheckCircleIcon, borderColor: 'border-green-500/50' },
    'Pending Cash': { color: 'bg-purple-500', label: 'Pending Cash', icon: Clock, borderColor: 'border-purple-500/50' },
};


export default function RecordingPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const isMobile = useIsMobile();
  const { profile } = useProfile();
  const { searchQuery, setSearchQuery } = useSearch();
  const [propertyForReason, setPropertyForReason] = useState<Property | null>(null);
  const [propertyForDetails, setPropertyForDetails] = useState<Property | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('all');

  const propertiesQuery = useMemoFirebase(() => 
    profile.agency_id && profile.user_id
        ? query(
            collection(firestore, 'agencies', profile.agency_id, 'properties'), 
            where('assignedTo', 'array-contains', profile.user_id),
            where('is_recorded', '==', false)
          ) 
        : null, 
    [firestore, profile.agency_id, profile.user_id]
  );
  const { data: properties, isLoading } = useCollection<Property>(propertiesQuery);

  const filteredProperties = useMemo(() => {
    if (!properties) return [];

    let filteredByTab = properties;
    if (activeTab !== 'all') {
        filteredByTab = properties.filter(prop => (prop.recording_payment_status || 'Unpaid') === activeTab);
    }
    
    if (!searchQuery) return filteredByTab;

    const lowercasedQuery = searchQuery.toLowerCase();
    return filteredByTab.filter(prop => 
        prop.serial_no.toLowerCase().includes(lowercasedQuery) ||
        prop.auto_title.toLowerCase().includes(lowercasedQuery) ||
        prop.address.toLowerCase().includes(lowercasedQuery)
    );
  }, [properties, searchQuery, activeTab]);

  const handleMarkAsRecorded = async (property: Property) => {
    if (!profile.agency_id) return;
    try {
      const propRef = doc(firestore, 'agencies', profile.agency_id, 'properties', property.id);
      await updateDoc(propRef, {
        is_recorded: true,
        editing_status: 'In Editing' // Set initial status for next stage
      });
      toast({
        title: "Marked as Recorded",
        description: `${property.serial_no} has been moved to the editing queue.`,
      });
    } catch (error) {
      console.error("Error marking as recorded:", error);
      toast({ title: "Error", description: "Could not update property status.", variant: "destructive" });
    }
  };

  const handleCannotRecord = (property: Property) => {
      setPropertyForReason(property);
  }

  const handleSaveReason = async (property: Property, reason: string) => {
      if (!profile.agency_id) return;
      try {
          const propRef = doc(firestore, 'agencies', profile.agency_id, 'properties', property.id);
          // For recorders, we remove them from the array
          await updateDoc(propRef, {
              recording_notes: reason,
              assignedTo: arrayRemove(profile.user_id)
          });

          // Create an inbox message for the admin
          const inboxMessage: Omit<InboxMessage, 'id'> = {
              type: 'cannot_record',
              fromUserId: profile.user_id,
              fromUserName: profile.name,
              message: reason,
              propertyId: property.id,
              propertySerial: property.serial_no,
              isRead: false,
              createdAt: new Date().toISOString(),
              agency_id: profile.agency_id,
          };
          await addDoc(collection(firestore, 'agencies', profile.agency_id, 'inboxMessages'), inboxMessage);

          toast({
              title: "Reason Submitted",
              description: `Reason for ${property.serial_no} has been sent to the admin.`,
          });
          setPropertyForReason(null);
      } catch (error) {
           console.error("Error saving reason:", error);
           toast({ title: "Error", description: "Could not save reason.", variant: "destructive" });
      }
  }

  const handleRowClick = (property: Property) => {
      setPropertyForDetails(property);
      setIsDetailsOpen(true);
  }
  
  const renderTable = (propertiesToList: Property[]) => (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Serial No</TableHead>
              <TableHead>Property</TableHead>
              <TableHead>Area</TableHead>
              <TableHead>Payment Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {propertiesToList.map(prop => {
                const paymentStatus = prop.recording_payment_status || 'Unpaid';
                const statusInfo = paymentStatusConfig[paymentStatus];
                return (
                    <TableRow 
                        key={prop.id} 
                        onClick={() => handleRowClick(prop)} 
                        className={cn("cursor-pointer border-l-4", statusInfo.borderColor)}
                    >
                        <TableCell>
                            <Badge variant="outline">{prop.serial_no}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{prop.auto_title}</TableCell>
                        <TableCell>{prop.area}</TableCell>
                        <TableCell>
                             <Badge className={cn(statusInfo.color, 'text-white flex items-center gap-1.5')}>
                                <statusInfo.icon className="h-3 w-3" />
                                {statusInfo.label}
                             </Badge>
                        </TableCell>
                        <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon"><MoreHorizontal /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuItem onSelect={() => handleRowClick(prop) as any}>
                                        <Eye className="mr-2 h-4 w-4" /> View Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => handleMarkAsRecorded(prop) as any}>
                                        <Check className="mr-2 h-4 w-4" /> Mark as Recorded
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => handleCannotRecord(prop) as any} className="text-destructive focus:bg-destructive/10">
                                        <XCircle className="mr-2 h-4 w-4" /> Cannot Record
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
            const paymentStatus = prop.recording_payment_status || 'Unpaid';
            const statusInfo = paymentStatusConfig[paymentStatus];
            return (
                <Card 
                    key={prop.id} 
                    className={cn(
                        "flex flex-col hover:shadow-lg transition-shadow cursor-pointer border-l-4",
                        statusInfo.borderColor
                    )} 
                    onClick={() => handleRowClick(prop)}
                >
                    <CardHeader>
                        <div className="flex justify-between items-start">
                             <div className="flex items-center gap-2">
                                <Badge variant="outline">{prop.serial_no}</Badge>
                            </div>
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 -mt-2 -mr-2" onClick={(e) => e.stopPropagation()}>
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                    <DropdownMenuItem onSelect={() => handleMarkAsRecorded(prop) as any}>
                                        <Check className="mr-2 h-4 w-4" />
                                        Mark as Recorded
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => handleCannotRecord(prop) as any} className="text-destructive focus:bg-destructive/10">
                                        <XCircle className="mr-2 h-4 w-4" />
                                        Cannot Record
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                        <CardTitle className="pt-2 font-bold font-headline text-base">{prop.auto_title}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1">
                        <p className="text-sm text-muted-foreground">{prop.area}</p>
                         <Badge className={cn("mt-2 text-white flex items-center gap-1.5", statusInfo.color)}>
                            <statusInfo.icon className="h-3 w-3" />
                            {statusInfo.label}
                        </Badge>
                    </CardContent>
                    <CardFooter>
                         <Button variant="outline" className="w-full" onClick={(e) => {e.stopPropagation(); handleRowClick(prop)}}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                        </Button>
                    </CardFooter>
                </Card>
            )
        })}
    </div>
  );
  
  const renderContent = (properties: Property[]) => {
      if (isLoading) {
        return <div className="text-center py-10 text-muted-foreground">Loading pending recordings...</div>
      }
      if (properties.length === 0) {
        return (
          <div className="text-center py-20 text-muted-foreground bg-card rounded-lg">
            No pending recordings found for this category.
          </div>
        )
      }
      return isMobile ? renderCards(properties) : renderTable(properties);
  }

  return (
    <>
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline flex items-center gap-2"><Video /> Pending Recordings</h1>
        <p className="text-muted-foreground">Properties assigned to you for video recording.</p>
      </div>

       <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
          <div className="flex justify-between items-center gap-4">
              <TabsList className="grid grid-cols-4 w-full max-w-lg">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="Unpaid">Unpaid</TabsTrigger>
                <TabsTrigger value="Pending Cash">Pending Cash</TabsTrigger>
                <TabsTrigger value="Paid Online">Paid</TabsTrigger>
              </TabsList>
          </div>

          <TabsContent value="all" className="mt-6">
            {renderContent(filteredProperties)}
          </TabsContent>
          <TabsContent value="Unpaid" className="mt-6">
            {renderContent(filteredProperties)}
          </TabsContent>
          <TabsContent value="Pending Cash" className="mt-6">
            {renderContent(filteredProperties)}
          </TabsContent>
          <TabsContent value="Paid Online" className="mt-6">
            {renderContent(filteredProperties)}
          </TabsContent>
      </Tabs>
    </div>
    {propertyForReason && (
        <CannotRecordDialog 
            isOpen={!!propertyForReason}
            setIsOpen={() => setPropertyForReason(null)}
            property={propertyForReason}
            onSave={handleSaveReason}
        />
    )}
     {propertyForDetails && (
        <PropertyDetailsDialog
            property={propertyForDetails}
            isOpen={isDetailsOpen}
            setIsOpen={setIsDetailsOpen}
        />
    )}
    </>
  );
}
