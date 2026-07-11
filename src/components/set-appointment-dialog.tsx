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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Appointment, AppointmentContactType, User, Buyer, Property } from '@/lib/types';
import { useEffect, useState, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { Textarea } from './ui/textarea';
import { useProfile } from '@/context/profile-context';
import { useFirestore } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection } from 'firebase/firestore';
import { useMemoFirebase } from '@/firebase/hooks';
import { cn } from '@/lib/utils';

interface SetAppointmentDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onSave: (appointment: Appointment) => void;
  appointmentToEdit?: Appointment | null;
  appointmentDetails?: {
    contactType: AppointmentContactType;
    contactName: string;
    contactSerialNo?: string;
    message: string;
  };
}

const formSchema = z.object({
  id: z.string().optional(),
  contactType: z.enum(['Buyer', 'Owner']),
  contactSerialNo: z.string().optional(),
  contactName: z.string().min(1, 'Contact name is required'),
  agentName: z.string().min(1, "Please select an agent."),
  message: z.string().min(1, 'Message is required'),
  date: z.string().min(1, 'Date is required'),
  time: z.string().min(1, 'Time is required'),
});

type AppointmentFormValues = z.infer<typeof formSchema>;

export function SetAppointmentDialog({
  isOpen,
  setIsOpen,
  onSave,
  appointmentDetails,
  appointmentToEdit,
}: SetAppointmentDialogProps) {
  const { toast } = useToast();
  const { profile } = useProfile();
  const firestore = useFirestore();

  const teamMembersQuery = useMemoFirebase(() => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'teamMembers') : null, [profile.agency_id, firestore]);
  const { data: teamMembers } = useCollection<User>(teamMembersQuery);

  const buyersQuery = useMemoFirebase(() => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'buyers') : null, [profile.agency_id, firestore]);
  const { data: buyers } = useCollection<Buyer>(buyersQuery);
  
  const propertiesQuery = useMemoFirebase(() => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'properties') : null, [profile.agency_id, firestore]);
  const { data: properties } = useCollection<Property>(propertiesQuery);

  const assignableMembers = useMemo(() => {
    if (!teamMembers) return [];
    return teamMembers.filter(m => m.status === 'Active' && (m.role === 'Agent' || m.role === 'Admin'));
  }, [teamMembers]);


  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(formSchema),
  });

  const { reset, setValue } = form;
  const watchedSerialNo = useWatch({ control: form.control, name: 'contactSerialNo' });


  useEffect(() => {
    if (!watchedSerialNo) return;

    const serial = watchedSerialNo.toUpperCase();
    
    if (serial.startsWith('B-') || serial.startsWith('RB-')) {
        const buyer = buyers?.find(b => b.serial_no === serial);
        if (buyer) {
            setValue('contactType', 'Buyer');
            setValue('contactName', buyer.name);
        }
    } else if (serial.startsWith('P-') || serial.startsWith('RP-')) {
        const property = properties?.find(p => p.serial_no === serial);
        if (property) {
            setValue('contactType', 'Owner');
            setValue('contactName', `Owner of ${serial}`);
        }
    }
  }, [watchedSerialNo, buyers, properties, setValue]);


  useEffect(() => {
    if (isOpen) {
      if (appointmentToEdit) {
         reset({
            id: appointmentToEdit.id,
            contactType: appointmentToEdit.contactType,
            contactName: appointmentToEdit.contactName,
            contactSerialNo: appointmentToEdit.contactSerialNo || 'B-',
            message: appointmentToEdit.message,
            agentName: appointmentToEdit.agentName,
            date: appointmentToEdit.date,
            time: appointmentToEdit.time,
        });
      } else {
        reset({
            contactType: appointmentDetails?.contactType || 'Buyer',
            contactName: appointmentDetails?.contactName || '',
            contactSerialNo: appointmentDetails?.contactSerialNo || 'B-',
            message: appointmentDetails?.message || '',
            agentName: '',
            date: '',
            time: '',
        });
      }
    }
  }, [isOpen, appointmentDetails, appointmentToEdit, reset]);

  const onSubmit = (data: AppointmentFormValues) => {
    const isEditing = !!appointmentToEdit;
    
    // Cleanup serial no if it's just a prefix or empty
    let finalSerial = data.contactSerialNo || '';
    if (finalSerial.endsWith('-')) {
        finalSerial = '';
    }

    const appointmentData: Appointment = {
      ...data,
      contactSerialNo: finalSerial,
      id: isEditing ? (appointmentToEdit as Appointment).id : new Date().toISOString(),
      status: 'Scheduled',
      agency_id: profile.agency_id,
    };
  
    onSave(appointmentData);
    setIsOpen(false);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md max-h-[80vh] sm:max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <div className="p-6 pb-2 shrink-0">
          <DialogHeader>
            <DialogTitle className="font-headline">{appointmentToEdit ? 'Reschedule Appointment' : 'Set New Appointment'}</DialogTitle>
            <DialogDescription>
              {appointmentToEdit ? 'Update the details for this appointment.' : 'Fill in the details to schedule a new appointment.'}
            </DialogDescription>
          </DialogHeader>
        </div>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-y-auto px-6 pb-4 grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="contactType"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Contact Type</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select type" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="Buyer">Buyer</SelectItem>
                                        <SelectItem value="Owner">Property Owner</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="contactSerialNo"
                        render={({ field }) => {
                            const val = field.value || 'B-';
                            const parts = val.split('-');
                            const prefix = parts[0];
                            const num = parts.slice(1).join('-');
                            
                            return (
                                <FormItem>
                                    <FormLabel>Contact Serial No.</FormLabel>
                                    <div className="flex gap-1">
                                        <Select 
                                            value={prefix || 'B'} 
                                            onValueChange={(newPrefix) => field.onChange(`${newPrefix}-${num}`)}
                                        >
                                            <FormControl>
                                                <SelectTrigger className="w-[85px] h-10 px-2 font-bold bg-muted/30">
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="B">B</SelectItem>
                                                <SelectItem value="RB">RB</SelectItem>
                                                <SelectItem value="P">P</SelectItem>
                                                <SelectItem value="RP">RP</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <div className="flex-1 relative">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">-</span>
                                            <FormControl>
                                                <Input 
                                                    className="pl-6 h-10 font-bold" 
                                                    placeholder="Number" 
                                                    value={num}
                                                    onChange={(e) => field.onChange(`${prefix}-${e.target.value}`)}
                                                />
                                            </FormControl>
                                        </div>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            );
                        }}
                    />
                </div>
                 <FormField
                    control={form.control}
                    name="contactName"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                                <Input {...field} value={field.value ?? ''} placeholder="e.g. Ahmed Hassan" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="agentName"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Assign to Agent</FormLabel>
                             <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select an agent..." />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {assignableMembers.map(member => (
                                        <SelectItem key={member.id} value={member.name}>{member.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Message / Purpose</FormLabel>
                            <FormControl>
                                <Textarea {...field} value={field.value ?? ''} placeholder="e.g. Meeting at property location..." />
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
                                    <Input {...field} value={field.value ?? ''} type="date" />
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
                                    <Input {...field} value={field.value ?? ''} type="time" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                 <DialogFooter className="pt-4 shrink-0 border-t">
                 <Button
                    type="button"
                    variant="ghost"
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsOpen(false);
                    }}
                    >
                    Cancel
                    </Button>
                    <Button
                    type="submit"
                    className="glowing-btn"
                    >
                    Save Appointment
                    </Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
