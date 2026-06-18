'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Check, Clock, PlusCircle, User, Briefcase, Building, MessageSquare, MoreHorizontal, Edit, Trash2, XCircle, Eye, CalendarPlus as AddToCalendarIcon, CheckCircle2 } from 'lucide-react';
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
import { useIsMobile } from '@/hooks/use-is-mobile';
import { BuyerDetailsDialog } from '@/components/buyer-details-dialog';
import { PropertyDetailsDialog } from '@/components/property-details-dialog';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

function AppointmentsPageContent() {
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
        const docRef = doc(collection(firestore, 'agencies', profile.agency_id, 'appointments'), appointment.id);
        await setDoc(docRef, appointment, { merge: true });
        toast({ title: 'Appointment Updated' });
        await logActivity('updated appointment', appointment.contactName);
    } else {
        const { id, ...newAppointmentData } = appointment;
        const collectionRef = collection(firestore, 'agencies', profile.agency_id, 'appointments');
        await addDoc(collectionRef, { ...newAppointmentData, status: 'Scheduled' });
        toast({ title: 'Appointment Set' });
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
    } else {
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
      toast({ title: `Appointment ${status}` });
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
          toast({ title: 'Invalid Date/Time', variant: 'destructive' });
          return;
      }
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
      const formatDateStr = (date: Date) => format(date, "yyyyMMdd'T'HHmmss");
      const url = new URL('https://www.google.com/calendar/render');
      url.searchParams.set('action', 'TEMPLATE');
      url.searchParams.set('text', `Appointment: ${appointment.contactName}`);
      url.searchParams.set('dates', `${formatDateStr(startTime)}/${formatDateStr(endTime)}`);
      url.searchParams.set('details', appointment.message);
      window.open(url.toString(), '_blank');
  };

  const sortedAppointments = useMemo(() => {
    if (!appointmentsData) return [];
    const all = appointmentsData.filter(a => {
        if (profile.role === 'Agent') return a.agentName === profile.name;
        return true;
    });
    // primary view: scheduled first, then others
    return [...all].sort((a, b) => {
        if (a.status === 'Scheduled' && b.status !== 'Scheduled') return -1;
        if (a.status !== 'Scheduled' && b.status === 'Scheduled') return 1;
        return parseISO(b.date).getTime() - parseISO(a.date).getTime();
    });
  }, [appointmentsData, profile]);

  const formatTimeStr = (time24: string) => {
    if (!time24) return '';
    try {
        const [hours, minutes] = time24.split(':');
        const date = new Date();
        date.setHours(parseInt(hours));
        date.setMinutes(parseInt(minutes));
        return format(date, 'p'); 
    } catch { return time24; }
  };

  return (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight font-headline flex items-center gap-3">
            <Calendar className="h-8 w-8 text-primary" /> Schedule & Tasks
          </h1>
          <p className="text-muted-foreground font-medium">
            Manage your daily meetings and client interactions.
          </p>
        </div>
        <Button className="rounded-full glowing-btn font-bold px-6" onClick={() => { setAppointmentToEdit(null); setIsAppointmentOpen(true); }}>
            <PlusCircle className="mr-2 h-4 w-4" />
            New Appointment
        </Button>
      </div>

      <div className="grid gap-6">
        {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-40">
                <PlusCircle className="h-10 w-10 animate-spin mb-4" />
                <p className="font-bold uppercase tracking-widest text-xs">Loading Schedule...</p>
            </div>
        ) : sortedAppointments.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {sortedAppointments.map((appt) => (
                    <Card key={appt.id} className={cn(
                        "relative group overflow-hidden border-l-4 transition-all duration-300 hover:shadow-2xl bg-card/60 backdrop-blur-sm",
                        appt.status === 'Scheduled' ? "border-l-primary" : appt.status === 'Completed' ? "border-l-emerald-500 opacity-80" : "border-l-destructive opacity-70"
                    )}>
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 border-primary/20 bg-primary/5">
                                    {appt.contactType === 'Buyer' ? 'Meeting with Buyer' : 'Meeting with Owner'}
                                </Badge>
                                <Badge className={cn(
                                    "text-[9px] font-black uppercase px-2",
                                    appt.status === 'Scheduled' ? "bg-primary" : appt.status === 'Completed' ? "bg-emerald-600" : "bg-destructive"
                                )}>
                                    {appt.status}
                                </Badge>
                            </div>
                            <CardTitle className="text-xl font-black font-headline pt-4 flex items-center gap-2">
                                {appt.contactName}
                                {appt.status === 'Completed' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="p-3 rounded-xl bg-muted/20 border border-border/40">
                                <p className="text-xs font-medium leading-relaxed italic">"{appt.message}"</p>
                            </div>
                            <div className="flex items-center justify-between text-xs pt-2">
                                <div className="flex items-center gap-4">
                                    <span className="flex items-center gap-1.5 font-bold"><Calendar className="h-3.5 w-3.5 text-primary" /> {format(parseISO(appt.date), 'MMM d, yyyy')}</span>
                                    <span className="flex items-center gap-1.5 font-bold"><Clock className="h-3.5 w-3.5 text-primary" /> {formatTimeStr(appt.time)}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground pt-2 border-t border-dashed">
                                <User className="h-3 w-3" /> Agent: <span className="text-foreground">{appt.agentName}</span>
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-end gap-2 border-t pt-4 bg-muted/5">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 rounded-full font-bold text-[10px] uppercase tracking-tighter">
                                        Actions <MoreHorizontal className="ml-1 h-3 w-3" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48 bg-background">
                                    <DropdownMenuItem onSelect={() => handleViewDetails(appt) as any}><Eye className="mr-2 h-4 w-4"/> View File</DropdownMenuItem>
                                    <DropdownMenuItem onSelect={(e: any) => handleWhatsAppChat(e, appt) as any}><MessageSquare className="mr-2 h-4 w-4"/> WhatsApp Chat</DropdownMenuItem>
                                    {appt.status === 'Scheduled' && (
                                        <>
                                            <DropdownMenuItem onSelect={(e: any) => handleAddToCalendar(e, appt) as any}><AddToCalendarIcon className="mr-2 h-4 w-4"/> Sync Calendar</DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => handleOpenStatusUpdate(appt, 'Completed') as any} className="text-emerald-600"><Check className="mr-2 h-4 w-4" /> Mark Completed</DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => handleOpenStatusUpdate(appt, 'Cancelled') as any} className="text-destructive"><XCircle className="mr-2 h-4 w-4" /> Mark Cancelled</DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => handleReschedule(appt) as any}><Edit className="mr-2 h-4 w-4" /> Reschedule</DropdownMenuItem>
                                        </>
                                    )}
                                    <DropdownMenuItem onSelect={() => handleDeleteAppointment(appt) as any} className="text-destructive font-bold"><Trash2 className="mr-2 h-4 w-4" /> Delete Task</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        ) : (
            <div className="flex flex-col items-center justify-center py-32 text-center border-2 border-dashed rounded-[2rem] opacity-30 bg-muted/5">
                <Calendar className="h-16 w-16 mb-4" />
                <p className="text-xl font-black uppercase tracking-widest">No Active Appointments</p>
                <p className="text-sm font-medium mt-1">Start by scheduling your first meeting.</p>
            </div>
        )}
      </div>

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

        {contactForDetails && (
             (contactForDetails as any).serial_no.startsWith('B') || (contactForDetails as any).serial_no.startsWith('RB') ? (
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
        <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
            <AppointmentsPageContent />
        </Suspense>
    );
}
