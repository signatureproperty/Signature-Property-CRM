
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
import { Edit, ArrowRight } from 'lucide-react';
import type { ActivityNotification } from '@/lib/types';
import { useEffect } from 'react';
import { Badge } from './ui/badge';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

interface NotificationActivityDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  notification: ActivityNotification;
  onClose: () => void;
}

export function NotificationActivityDialog({
  isOpen,
  setIsOpen,
  notification,
  onClose,
}: NotificationActivityDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { activity } = notification;

  useEffect(() => {
    if (!isOpen) {
        onClose();
    }
  }, [isOpen, onClose]);
  
  const handleGoToPage = () => {
    setIsOpen(false);
    let path = '/';
    if (activity.action.includes('assigned')) {
        path = '/recording';
    } else {
        path = activity.targetType === 'Buyer' ? '/buyers' : '/properties';
    }
    router.push(path);
  }

  const handleViewRemark = () => {
    setIsOpen(false);
    if (activity.targetType === 'Buyer' && activity.targetId) {
        router.push(`/buyers?openRemark=${activity.targetId}`);
    } else if (activity.targetType === 'Property' && activity.targetId) {
        router.push(`/properties?openRemark=${activity.targetId}`);
    } else {
        const path = activity.targetType === 'Buyer' ? '/buyers' : '/properties';
        router.push(path);
    }
  }

  const getButtonText = () => {
    if (activity.action.includes('assigned')) {
        return "Go to Recording";
    }
    return `Go to ${activity.targetType}s`;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md max-h-[70vh] sm:max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="font-headline">{notification.title}</DialogTitle>
          <DialogDescription>
            A team member updated a lead's status.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                 <div className="flex items-center justify-center rounded-full h-10 w-10 bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-300">
                    <Edit className="h-5 w-5" />
                </div>
                <div>
                    <p className="font-semibold">{activity.userName}</p>
                    <Badge variant="outline">{activity.targetType}</Badge>
                </div>
            </div>
             <div className="flex items-start text-sm">
                <p className="font-semibold">{activity.target}</p>
            </div>
            {activity.details && (
              <div className="flex items-center gap-2 text-sm pt-3 border-t">
                  <Badge variant="secondary">{activity.details.from}</Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="default">{activity.details.to}</Badge>
              </div>
            )}
        </div>
        <DialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={handleGoToPage}>{getButtonText()}</Button>
            {activity.targetType === 'Buyer' && activity.targetId && (
                <Button variant="default" onClick={handleViewRemark} className="bg-primary text-white">
                    View Remark
                </Button>
            )}
            <Button onClick={() => setIsOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
