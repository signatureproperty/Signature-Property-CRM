
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
import { Buyer, FollowUp } from '@/lib/types';
import { useEffect } from 'react';
import { Input } from './ui/input';

interface AddFollowUpDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  buyer: Buyer;
  existingFollowUp?: FollowUp | null;
  onSave: (buyerId: string, notes: string, nextReminderDate: string, nextReminderTime: string, existingFollowUp?: FollowUp | null) => void;
}

const formSchema = z.object({
  notes: z.string().min(1, "Follow-up notes are required."),
  nextReminderDate: z.string().min(1, "Reminder date is required."),
  nextReminderTime: z.string().min(1, "Reminder time is required."),
});

type FollowUpFormValues = z.infer<typeof formSchema>;

const getDefaultDateTime = () => {
    const date = new Date();
    date.setDate(date.getDate() + 3);
    const defaultDate = date.toISOString().split('T')[0];
    const defaultTime = '12:00';
    return { defaultDate, defaultTime };
}

export function AddFollowUpDialog({
  isOpen,
  setIsOpen,
  buyer,
  existingFollowUp,
  onSave,
}: AddFollowUpDialogProps) {
  const { defaultDate, defaultTime } = getDefaultDateTime();

  const form = useForm<FollowUpFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        notes: '',
        nextReminderDate: defaultDate,
        nextReminderTime: defaultTime,
    }
  });

  useEffect(() => {
    if (buyer) {
        const { defaultDate, defaultTime } = getDefaultDateTime();
        form.reset({ 
            notes: existingFollowUp?.notes || buyer.last_follow_up_note || '', 
            nextReminderDate: defaultDate,
            nextReminderTime: defaultTime,
        });
    }
  }, [buyer, existingFollowUp, form, isOpen, defaultDate, defaultTime]);

  const onSubmit = (data: FollowUpFormValues) => {
    onSave(buyer.id, data.notes, data.nextReminderDate, data.nextReminderTime, existingFollowUp);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md max-h-[70vh] sm:max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="font-headline">Schedule Follow-up</DialogTitle>
          <DialogDescription>
            {`Add notes for following up with ${buyer.name}.`}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <>
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes / Reason for Follow-up</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder={`e.g., Client requested more property options in DHA...`} rows={5} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                    control={form.control}
                    name="nextReminderDate"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Next Reminder Date</FormLabel>
                        <FormControl>
                            <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="nextReminderTime"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Next Reminder Time</FormLabel>
                        <FormControl>
                            <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>
              </>

            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Save Follow-up
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
