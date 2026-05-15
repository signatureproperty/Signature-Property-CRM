'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Check, Clock, PlusCircle, User, Briefcase, Building, MessageSquare, MoreHorizontal, Edit, Trash2, XCircle, Eye, CalendarPlus as AddToCalendarIcon } from 'lucide-react';
import { SetAppointmentDialog } from '@/components/set-appointment-dialog';
import { useState, useMemo, Suspense } from 'react';
import { Appointment, AppointmentStatus, Activity, Buyer, Property } from '@/lib/types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { UpdateAppointmentStatusDialog } from '@/components/update-appointment-status-dialog';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useFirestore } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, addDoc, setDoc, doc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useMemoFirebase } from '@/firebase/hooks';
import { useProfile } from '@/context/profile-context';
import { formatPhoneNumberForWhatsApp } from '@/lib/formatters';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { BuyerDetailsDialog } from '@/components/buyer-details-dialog';
import { PropertyDetailsDialog } from '@/components/property-details-dialog';
import { isWithinInterval, subDays, parseISO, format } from 'date-fns';


function AppointmentsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = (searchParams ? searchParams.get('tab') : 'buyer') || 'buyer';

  const firestore = useFirestore();
  const { profile } = useProfile();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const appointmentsQuery = useMemoFirebase(() => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'appointments') : null, [profile.agency_id, firestore]);
  const { data: appointmentsData, isLoading } = useCollection<Appointment>(appointmentsQuery);

  const buyersQuery = useMemoFirebase(() => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'buyers') : null, [profile.agency_id, firestore]);
  const { data: buyersData } = useCollection<Buyer>(buyersQuery);

  const propertiesQuery = useMemoFirebase(() => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'properties') : null, [profile.agency_id, firestore]);
  const { data: propertiesData } = useCollection<Property>(propertiesQuery);

  const [isAppointmentOpen, setIsAppointmentOpen] = useState(false);
  const [appointmentToEdit, setAppointmentToEdit] = useState<Appointment | null>(null);
  const [appointmentToUpdateStatus, setAppointmentToUpdateStatus] = useState<Appointment | null>(null);
  const [newStatus, setNewStatus] = useState<AppointmentStatus | null>(null);

  const [contactForDetails, setContactForDetails] = useState<Buyer | Property | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const logActivity = async (action: string, target: string, details: any = null) => {
    if (!profile.agency_id) return;
    const activityLogRef = collection(firestore, 'agencies', profile.agency_id, 'activityLogs');
    const newActivity: Omit<Activity, 'id'> = {
      userName: profile.name,
      action,
      target,
      targetType: 'Appointment',
      details,
      timestamp: new Date().toISOString(),
      agency_id: profile.agency_id,
    };
    await addDoc(activityLogRef, newActivity);
  };

  const handleSaveAppointment = async (appointment: Appointment) => {
    if (!profile.agency_id) return;
    
    if (appointmentToEdit) {
        // It's an update (reschedule)
        const docRef = doc(collection(firestore, 'agencies', profile.agency_id, 'appointments'), appointment.id);
        await setDoc(docRef, appointment, { merge: true });
        toast({ title: 'Appointment Rescheduled', description: `Appointment with ${appointment.contactName} has been updated.` });
        await logActivity('rescheduled appointment', appointment.contactName);
    } else {
        // It's a new appointment
        const { id, ...newAppointmentData } = appointment;
        const collectionRef = collection(firestore, 'agencies', profile.agency_id, 'appointments');
        await addDoc(collectionRef, newAppointmentData);
        toast({ title: 'Appointment Set', description: `Appointment with ${appointment.contactName} has been scheduled.` });
        await logActivity('set a new appointment', appointment.contactName);
    }
    setAppointmentToEdit(null);
  };

  const handleDeleteAppointment = async (appointment: Appointment) => {
    if (!profile.agency_id) return;
    await deleteDoc(doc(firestore, 'agencies', profile.agency_id, 'appointments', appointment.id));
    toast({ title: 'Appointment Deleted', variant: 'destructive' });
    await logActivity('deleted an appointment', appointment.contactName);
  };
  
  const handleReschedule = (appointment: Appointment) => {
    setAppointmentToEdit(appointment);
    setIsAppointmentOpen(true);
  };
  
  const handleOpenStatusUpdate = (appointment: Appointment, status: AppointmentStatus) => {
      setAppointmentToUpdateStatus(appointment);
      setNewStatus(status);
  };
  
  const handleViewDetails = (appointment: Appointment) => {
    const serial = appointment.contactSerialNo || '';
    if (serial.startsWith('B') || serial.startsWith('RB')) {
      const buyer = buyersData?.find(b => b.serial_no === serial);
      if (buyer) {
        setContactForDetails(buyer);
        setIsDetailsOpen(true);
      } else {
        toast({ title: 'Buyer not found', variant: 'destructive' });
      }
    } else { // Owner or Property
      const property = propertiesData?.find(p => p.serial_no === serial);
      if (property) {
        setContactForDetails(property);
        setIsDetailsOpen(true);
      } else {
        toast({ title: 'Property not found', variant: 'destructive' });
      }
    }
  };


  const handleUpdateStatus = async (appointmentId: string, status: AppointmentStatus, notes?: string) => {
      if (!profile.agency_id) return;
      const appointment = appointmentsData?.find(a => a.id === appointmentId);
      if (!appointment) return;

      const docRef = doc(firestore, 'agencies', profile.agency_id, 'appointments', appointmentId);
      await setDoc(docRef, { status, notes: notes || '' }, { merge: true });
      toast({ title: 'Appointment Updated', description: `Status has been changed to ${status}.` });
      await logActivity('updated appointment status', appointment.contactName, { from: appointment.status, to: status });
  };

  const handleWhatsAppChat = (e: any, appointment: Appointment) => {
    if (e && e.stopPropagation) e.stopPropagation();
    let phoneNumber = '';
    let countryCode = '+92';

    if (appointment.contactType === 'Buyer' && buyersData) {
        const buyer = buyersData.find(b => b.serial_no === appointment.contactSerialNo);
        if (buyer) {
            phoneNumber = buyer.phone;
            countryCode = buyer.country_code || '+92';
        }
    } else if (appointment.contactType === 'Owner' && propertiesData) {
        const property = propertiesData.find(p => p.serial_no === appointment.contactSerialNo);
        if (property) {
            phoneNumber = property.owner_number;
            countryCode = property.country_code || '+92';
        }
    }

    if (phoneNumber) {
        const formattedPhone = formatPhoneNumberForWhatsApp(phoneNumber, countryCode);
        window.open(`https://wa.me/${formattedPhone}`, '_blank');
    } else {
        toast({ title: 'Phone number not found', variant: 'destructive' });
    }
  };
  
    const handleAddToCalendar = (e: any, appointment: Appointment) => {
        if (e && e.stopPropagation) e.stopPropagation();
        
        const startTimeStr = `${appointment.date}T${appointment.time}:00`;
        const startTime = new Date(startTimeStr);
        if (isNaN(startTime.getTime())) {
            toast({ title: 'Invalid Date/Time', description: 'Cannot add to calendar due to invalid appointment time.', variant: 'destructive' });
            return;
        }
        const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // Add 1 hour

        const formatDateStr = (date: Date) => format(date, "yyyyMMdd'T'HHmmss");

        const details = `Appointment with ${appointment.contactName}.\nPurpose: ${appointment.message}\nAssigned Agent: ${appointment.agentName}`;
        
        let location = 'N/A';
        if(appointment.contactType === 'Owner' && propertiesData) {
            const property = propertiesData.find(p => p.serial_no === appointment.contactSerialNo);
            if(property) location = property.address;
        }

        const url = new URL('https://www.google.com/calendar/render');
        url.searchParams.set('action', 'TEMPLATE');
        url.searchParams.set('text', `Appointment: ${appointment.contactName}`);
        url.searchParams.set('dates', `${formatDateStr(startTime)}/${formatDateStr(endTime)}`);
        url.searchParams.set('details', details);
        url.searchParams.set('location', location);
        
        window.open(url.toString(), '_blank');
    };

  const statusConfig: { [key in AppointmentStatus]: { variant: 'default' | 'secondary' | 'destructive', icon?: React.ComponentType<{ className?: string }> } } = {
    Scheduled: { variant: 'secondary', icon: Clock },
    Completed: { variant: 'default', icon: Check },
    Cancelled: { variant: 'destructive', icon: XCircle },
  };

  const { buyerAppointments, ownerAppointments, historicalAppointments } = useMemo(() => {
    const allAppointments = (appointmentsData || []).filter(a => {
        if (profile.role === 'Agent') {
            return a.agentName === profile.name;
        }
        return true;
    });

    const now = new Date();
    const sevenDaysAgo = subDays(now, 7);

    const scheduled = allAppointments.filter(a => a.status === 'Scheduled');
    const historical = allAppointments.filter(a => 
        (a.status === 'Completed' || a.status === 'Cancelled') &&
        isWithinInterval(parseISO(a.date), { start: sevenDaysAgo, end: now })
    ).sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());
    
    const buyers = scheduled.filter(a => a.contactType === 'Buyer');
    const owners = scheduled.filter(a => a.contactType === 'Owner');
    
    return { buyerAppointments: buyers, ownerAppointments: owners, historicalAppointments: historical };
}, [appointmentsData, profile.role, profile.name]);


  const handleTabChange = (value: string) => {
    const url = `${pathname}?tab=${value}`;
    router.push(url);
  };
  
  const formatTimeStr = (time24: string) => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const date = new Date();
    date.setHours(parseInt(hours));
    date.setMinutes(parseInt(minutes));
    return format(date, 'p'); 
  };


  const renderAppointmentCard = (appt: Appointment) => {
    const currentStatus = statusConfig[appt.status];
    return(
        <Card key={appt.id} className="hover:shadow-primary/10 transition-shadow flex flex-col bg-background">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center rounded-full h-10 w-10 ${appt.contactType === 'Buyer' ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300' : 'bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-300'}`}>
                        {appt.contactType === 'Buyer' ? <Briefcase className="h-5 w-5" /> : <Building className="h-5 w-5" />}
                    </div>
                    <CardTitle className="text-base font-semibold font-headline">
                        {appt.contactName}
                    </CardTitle>
                </div>
            <Badge 
                variant={currentStatus.variant} 
                className={`capitalize ${appt.status === 'Completed' ? 'bg-green-600' : ''}`}
            >
                {currentStatus.icon && <currentStatus.icon className="mr-1 h-3 w-3" />}
                {appt.status}
            </Badge>
            </CardHeader>
            <CardContent className="space-y-3 flex-1">
            <div className="flex items-start text-sm min-h-[40px]">
                <MessageSquare className="mr-2 mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{appt.notes ? `[${appt.status}]: ${appt.notes}` : appt.message}</p>
            </div>
            <div className="flex items-center text-sm pt-3 border-t">
                <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>{new Date(appt.date).toLocaleDateString()}</span>
                <Clock className="ml-4 mr-2 h-4 w-4 text-muted-foreground" />
                <span>{formatTimeStr(appt.time)}</span>
            </div>
            <div className="flex items-center text-sm pt-2 border-t border-dashed">
                <User className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Agent:</span>
                <span className="ml-2 font-medium">{appt.agentName}</span>
            </div>
            </CardContent>
             <CardFooter className="flex justify-end border-t pt-4">
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                    <Button aria-haspopup="true" size="sm" variant="ghost">
                        Actions
                        <MoreHorizontal className="ml-2 h-4 w-4" />
                    </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-background">
                        <DropdownMenuItem onSelect={() => handleViewDetails(appt) as any}><Eye className="mr-2 h-4 w-4"/> View Contact Details</DropdownMenuItem>
                        <DropdownMenuItem onSelect={(e) => handleWhatsAppChat(e, appt) as any}><MessageSquare className="mr-2 h-4 w-4"/> Chat on WhatsApp</DropdownMenuItem>
                         {appt.status === 'Scheduled' && (
                          <DropdownMenuItem onSelect={(e) => handleAddToCalendar(e, appt) as any}><AddToCalendarIcon className="mr-2 h-4 w-4"/> Add to Calendar</DropdownMenuItem>
                         )}
                        {appt.status === 'Scheduled' && (
                            <>
                                <DropdownMenuItem onSelect={() => handleOpenStatusUpdate(appt, 'Completed') as any}>
                                    <Check className="mr-2 h-4 w-4" />
                                    Mark as Completed
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => handleOpenStatusUpdate(appt, 'Cancelled') as any}>
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Mark as Cancelled
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => handleReschedule(appt) as any}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Reschedule
                                </DropdownMenuItem>
                            </>
                        )}
                        <DropdownMenuItem onSelect={() => handleDeleteAppointment(appt) as any} className="text-destructive focus:text-destructive-foreground focus:bg-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </CardFooter>
        </Card>
    );
  }

  const renderAppointmentList = (appointments: Appointment[], emptyMessage: string) => (
     <div className="space-y-4">
        {isLoading ? <p className="text-muted-foreground text-center py-10">Loading...</p> : appointments.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {appointments.map(renderAppointmentCard)}
            </div>
        ) : (
            <Card className="flex items-center justify-center h-32 bg-background">
                <p className="text-muted-foreground">{emptyMessage}</p>
            </Card>
        )}
    </div>
  );


  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">
            Appointments
          </h1>
          <p className="text-muted-foreground">
            Manage and track all scheduled buyer and owner appointments.
          </p>
        </div>
        <Button className="glowing-btn" onClick={() => { setAppointmentToEdit(null); setIsAppointmentOpen(true); }}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Appointment
        </Button>
      </div>

      <Tabs defaultValue={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="buyer">Buyer</TabsTrigger>
                <TabsTrigger value="owner">Owner</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            <TabsContent value="buyer" className="mt-6">
                {renderAppointmentList(buyerAppointments, 'No buyer appointments scheduled.')}
            </TabsContent>
            <TabsContent value="owner" className="mt-6">
                 {renderAppointmentList(ownerAppointments, 'No owner appointments scheduled.')}
            </TabsContent>
            <TabsContent value="history" className="mt-6">
                 {renderAppointmentList(historicalAppointments, 'No completed or cancelled appointments in the last 7 days.')}
            </TabsContent>
        </Tabs>


       <SetAppointmentDialog 
            isOpen={isAppointmentOpen}
            setIsOpen={setIsAppointmentOpen}
            onSave={handleSaveAppointment}
            appointmentToEdit={appointmentToEdit}
        />
        {appointmentToUpdateStatus && newStatus && (
            <UpdateAppointmentStatusDialog
                isOpen={!!appointmentToUpdateStatus}
                setIsOpen={() => setAppointmentToUpdateStatus(null)}
                appointment={appointmentToUpdateStatus}
                newStatus={newStatus}
                onUpdate={handleUpdateStatus}
            />
        )}
        {contactForDetails && (contactForDetails as any).serial_no && (
             (contactForDetails as Buyer).serial_no.startsWith('B') || (contactForDetails as Buyer).serial_no.startsWith('RB') ? (
                <BuyerDetailsDialog
                    buyer={contactForDetails as Buyer}
                    isOpen={isDetailsOpen}
                    setIsOpen={setIsDetailsOpen}
                />
            ) : (
                <PropertyDetailsDialog
                    property={contactForDetails as Property}
                    isOpen={isDetailsOpen}
                    setIsOpen={setIsDetailsOpen}
                />
            )
        )}

    </div>
  );
}


export default function AppointmentsPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <AppointmentsPageContent />
        </Suspense>
    );
}
