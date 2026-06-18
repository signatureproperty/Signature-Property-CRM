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
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { Textarea } from './ui/textarea';
import { useEffect } from 'react';
import { EventDetails } from '@/lib/types';

interface AddEventDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onSave: (event: EventDetails) => void;
}

const formSchema = z.object({
  title: z.string().min(1, 'Event title is required'),
  date: z.string().min(1, 'Date is required'),
  time: z.string().min(1, 'Time is required'),
  description: z.string().default(''),
});

type EventFormValues = z.infer<typeof formSchema>;


export function AddEventDialog({
  isOpen,
  setIsOpen,
  onSave,
}: AddEventDialogProps) {
  
  const form = useForm<EventFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        title: '',
        date: new Date().toISOString().split('T')[0],
        time: '12:00',
        description: ''
    }
  });
  
  useEffect(() => {
    if (isOpen) {
        form.reset({
            title: '',
            date: new Date().toISOString().split('T')[0],
            time: '12:00',
            description: ''
        });
    }
  }, [isOpen, form]);

  const onSubmit = (data: EventFormValues) => {
    onSave({
        ...data,
        description: data.description || ''
    });
    setIsOpen(false);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline">Add New Event</DialogTitle>
          <DialogDescription>
            Create a custom event to track in your CRM calendar.
          </DialogDescription>
        </DialogHeader>
         <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
                <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Event Title</FormLabel>
                            <FormControl>
                                <Input {...field} placeholder="e.g., Team Meeting" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Description (Optional)</FormLabel>
                            <FormControl>
                                <Textarea {...field} placeholder="e.g., Discuss quarterly targets..." />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="date"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Date</FormLabel>
                                <FormControl>
                                    <Input {...field} type="date" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="time"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Time</FormLabel>
                                <FormControl>
                                    <Input {...field} type="time" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                <DialogFooter className="pt-4">
                <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsOpen(false)}
                    >
                    Cancel
                    </Button>
                    <Button
                    type="submit"
                    >
                    Add Event
                    </Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
