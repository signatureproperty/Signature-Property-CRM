
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Appointment } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Card, CardContent } from './ui/card';
import { Calendar, Clock, Briefcase, Building, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface AllEventsDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  appointments: Appointment[];
}

const EventItem = ({ appt }: { appt: Appointment }) => {
    const router = useRouter();

    const getIcon = (appt: Appointment) => {
        if (appt.contactType === 'Buyer') return <Briefcase className="h-5 w-5" />;
        if (appt.contactType === 'Owner' && appt.contactSerialNo) return <Building className="h-5 w-5" />;
        return <Users className="h-5 w-5" />; // Generic event
    };

    const getIconBgColor = (appt: Appointment) => {
        if (appt.contactType === 'Buyer') return 'bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-300';
        if (appt.contactType === 'Owner' && appt.contactSerialNo) return 'bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-300';
        return 'bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300'; // Generic event
    }

    const handleGoToAppointment = () => {
        router.push(`/appointments`);
    }
    
    const isClientAppointment = appt.contactType === 'Buyer' || (appt.contactType === 'Owner' && appt.contactSerialNo);

    return (
        <Card>
            <CardContent className="p-3 flex items-start gap-4">
                <div className={`flex items-center justify-center rounded-full h-10 w-10 flex-shrink-0 ${getIconBgColor(appt)}`}>
                    {getIcon(appt)}
                </div>
                <div className="flex-1">
                    <p className="font-semibold">{appt.contactName}</p>
                    <p className="text-xs text-muted-foreground">{appt.message}</p>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-4">
                        <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /> {appt.date}</span>
                        <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> {appt.time}</span>
                    </div>
                </div>
                {isClientAppointment && (
                    <Button size="sm" variant="outline" onClick={handleGoToAppointment}>Go to Appointments</Button>
                )}
            </CardContent>
        </Card>
    );
};


export function AllEventsDialog({
  isOpen,
  setIsOpen,
  appointments,
}: AllEventsDialogProps) {
  
  const scheduled = appointments.filter(a => a.status === 'Scheduled').sort((a,b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());
  const completed = appointments.filter(a => a.status === 'Completed').sort((a,b) => new Date(`${b.date}T${b.time}`).getTime() - new Date(`${a.date}T${a.time}`).getTime());
  const cancelled = appointments.filter(a => a.status === 'Cancelled').sort((a,b) => new Date(`${b.date}T${b.time}`).getTime() - new Date(`${a.date}T${a.time}`).getTime());
  

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-xl max-h-[70vh] sm:max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="font-headline">All Events & Appointments</DialogTitle>
          <DialogDescription>
            A complete list of your scheduled, completed, and cancelled events.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="scheduled" className="pt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="scheduled">Scheduled ({scheduled.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled ({cancelled.length})</TabsTrigger>
          </TabsList>
          
          <ScrollArea className="h-96 mt-4">
              <div className="pr-4">
                <TabsContent value="scheduled" className="space-y-3">
                  {scheduled.length > 0 ? scheduled.map(appt => <EventItem key={appt.id} appt={appt} />) : <p className="text-center text-muted-foreground pt-10">No scheduled events.</p>}
                </TabsContent>
                <TabsContent value="completed" className="space-y-3">
                    {completed.length > 0 ? completed.map(appt => <EventItem key={appt.id} appt={appt} />) : <p className="text-center text-muted-foreground pt-10">No completed events.</p>}
                </TabsContent>
                <TabsContent value="cancelled" className="space-y-3">
                   {cancelled.length > 0 ? cancelled.map(appt => <EventItem key={appt.id} appt={appt} />) : <p className="text-center text-muted-foreground pt-10">No cancelled events.</p>}
                </TabsContent>
              </div>
          </ScrollArea>
        </Tabs>
        
      </DialogContent>
    </Dialog>
  );
}
