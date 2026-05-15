'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useProfile } from '@/context/profile-context';

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email(),
  subject: z.string().min(1, 'Subject is required'),
  message: z.string().min(10, 'Message must be at least 10 characters long.'),
});

type TicketFormValues = z.infer<typeof formSchema>;

export function SubmitTicketForm() {
  const { toast } = useToast();
  const { profile } = useProfile();

  const form = useForm<TicketFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: profile.name || '',
      email: 'contact@signaturecrm.pk',
      subject: '',
      message: '',
    },
  });

  function onSubmit(values: TicketFormValues) {
    console.log('Ticket Submitted:', values);
    toast({
      title: 'Ticket Submitted Successfully!',
      description: 'Our support team has received your request and will get back to you shortly.',
    });
    form.reset({
        ...form.getValues(),
        subject: '',
        message: ''
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Your Name</FormLabel>
                <FormControl>
                    <Input {...field} readOnly className="bg-muted/50" />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Your Email</FormLabel>
                <FormControl>
                    <Input {...field} readOnly className="bg-muted/50" />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>
        
        <FormField
          control={form.control}
          name="subject"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Subject</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g., Issue with adding a new buyer" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Describe your issue</FormLabel>
              <FormControl>
                <Textarea {...field} rows={6} placeholder="Please provide as much detail as possible..." />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="flex justify-end pt-2">
            <Button type="submit">Submit Ticket</Button>
        </div>
      </form>
    </Form>
  );
}