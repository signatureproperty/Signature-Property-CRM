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
import { CalendarCheck, MessageSquare, Phone, User } from 'lucide-react';
import type { FollowUpNotification } from '@/lib/types';
import { useEffect } from 'react';
import { Badge } from './ui/badge';
import { useRouter } from 'next/navigation';
import { formatPhoneNumber } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface NotificationFollowupDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  notification: FollowUpNotification;
  onClose: () => void;
}

export function NotificationFollowupDialog({
  isOpen,
  setIsOpen,
  notification,
  onClose,
}: NotificationFollowupDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { followUp } = notification;

  useEffect(() => {
    if (!isOpen) {
        onClose();
    }
  }, [isOpen, onClose]);
  
  const handleGoToFollowups = () => {
    setIsOpen(false);
    router.push('/follow-ups');
  }

  const handleWhatsAppClick = (e: React.MouseEvent) => {
      e.stopPropagation(); 
      if (followUp.buyerPhone) {
        const formattedPhone = formatPhoneNumber(followUp.buyerPhone).replace('+', '');
        const whatsappUrl = `https://wa.me/${formattedPhone}`;
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      } else {
        toast({
            title: "Phone Number Not Available",
            variant: "destructive",
        });
      }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md max-h-[70vh] sm:max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="font-headline">{notification.title}</DialogTitle>
          <DialogDescription>
            Reminder to follow up with a buyer.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                 <div className="flex items-center justify-center rounded-full h-10 w-10 bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300">
                    <User className="h-5 w-5" />
                </div>
                <div>
                    <p className="font-semibold">{followUp.buyerName}</p>
                    <p className="text-xs text-muted-foreground">{followUp.propertyInterest}</p>
                </div>
            </div>
             <div className="flex items-start text-sm">
                <Phone className="mr-2 mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{followUp.buyerPhone || 'No phone number'}</p>
            </div>
            <div className="flex items-start text-sm">
                <MessageSquare className="mr-2 mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{followUp.notes}</p>
            </div>
            <div className="flex items-center text-sm pt-3 border-t">
                <CalendarCheck className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>Next Reminder: {new Date(followUp.nextReminderDate).toLocaleDateString()}</span>
            </div>
        </div>
        <DialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={handleGoToFollowups}>Go to Follow-ups</Button>
            <div className="flex gap-2">
                <Button variant="secondary" onClick={handleWhatsAppClick}><MessageSquare className="mr-2 h-4 w-4" /> WhatsApp</Button>
                <Button onClick={() => setIsOpen(false)}>Close</Button>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
