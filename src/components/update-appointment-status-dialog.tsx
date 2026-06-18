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
import { Textarea } from './ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { Appointment, AppointmentStatus } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface UpdateAppointmentStatusDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  appointment: Appointment;
  newStatus: AppointmentStatus;
  onUpdate: (appointmentId: string, status: AppointmentStatus, notes?: string) => void;
}

const formSchema = z.object({
  notes: z.string().optional(),
});

type StatusFormValues = z.infer<typeof formSchema>;

export function UpdateAppointmentStatusDialog({
  isOpen,
  setIsOpen,
  appointment,
  newStatus,
  onUpdate,
}: UpdateAppointmentStatusDialogProps) {
  const { toast } = useToast();
  const form = useForm<StatusFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { notes: '' }
  });

  const onSubmit = (data: StatusFormValues) => {
    onUpdate(appointment.id, newStatus, data.notes);
    toast({
      title: 'Appointment Updated!',
      description: `Appointment with ${appointment.contactName} has been marked as ${newStatus}.`,
    });
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md bg-background">
        <DialogHeader>
          <DialogTitle className="font-headline text-foreground">Update Appointment Status</DialogTitle>
          <DialogDescription>
            Mark appointment with {appointment.contactName} as {newStatus}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason / Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder={`Add any notes for marking this appointment as ${newStatus}...`} className="bg-background" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Update Status</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
