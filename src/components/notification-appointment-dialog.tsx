
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, User, Briefcase, Building, MessageSquare } from 'lucide-react';
import type { AppointmentNotification } from '@/lib/types';
import { useEffect } from 'react';
import { Badge } from './ui/badge';
import { useRouter } from 'next/navigation';

interface NotificationAppointmentDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  notification: AppointmentNotification;
  onClose: () => void;
}

export function NotificationAppointmentDialog({
  isOpen,
  setIsOpen,
  notification,
  onClose,
}: NotificationAppointmentDialogProps) {
  const router = useRouter();
  const { appointment } = notification;

  useEffect(() => {
    if (!isOpen) {
        onClose();
    }
  }, [isOpen, onClose]);
  
  const handleGoToAppointment = () => {
    setIsOpen(false);
    const params = appointment.contactType === 'Buyer' ? '?type=Buyer' : '?type=Owner';
    router.push(`/appointments${params}`);
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md max-h-[70vh] sm:max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="font-headline">{notification.title}</DialogTitle>
          <DialogDescription>
            Reminder for your upcoming appointment.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                 <div className={`flex items-center justify-center rounded-full h-10 w-10 ${appointment.contactType === 'Buyer' ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300' : 'bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-300'}`}>
                    {appointment.contactType === 'Buyer' ? <Briefcase className="h-5 w-5" /> : <Building className="h-5 w-5" />}
                </div>
                <div>
                    <p className="font-semibold">{appointment.contactName}</p>
                    <Badge variant="outline">{appointment.contactType}</Badge>
                </div>
            </div>
            <div className="flex items-start text-sm">
                <MessageSquare className="mr-2 mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{appointment.message}</p>
            </div>
            <div className="flex items-center text-sm pt-3 border-t">
                <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>{new Date(appointment.date).toLocaleDateString()}</span>
                <Clock className="ml-4 mr-2 h-4 w-4 text-muted-foreground" />
                <span>{appointment.time}</span>
            </div>
            <div className="flex items-center text-sm pt-2 border-t border-dashed">
                <User className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Agent:</span>
                <span className="ml-2 font-medium">{appointment.agentName}</span>
            </div>
        </div>
        <DialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={handleGoToAppointment}>Go to Appointments</Button>
            <Button onClick={() => setIsOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

