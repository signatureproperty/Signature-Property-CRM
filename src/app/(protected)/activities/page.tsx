'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { format, subDays } from 'date-fns';
import {
  FilePlus,
  UserPlus,
  Edit,
  CheckCircle,
  CalendarPlus,
  ArrowRight,
  Trash2,
  Check,
  X,
} from 'lucide-react';
import React, { useMemo, useState, useEffect } from 'react';
import { Activity } from '@/lib/types';
import { useFirestore } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where, orderBy, getDocs, writeBatch } from 'firebase/firestore';
import { useProfile } from '@/context/profile-context';
import { useMemoFirebase } from '@/firebase/hooks';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

const getActionIcon = (action: string) => {
  if (action.includes('added a new property')) return <FilePlus className="h-4 w-4" />;
  if (action.includes('added a new buyer')) return <UserPlus className="h-4 w-4" />;
  if (action.includes('updated the status')) return <Edit className="h-4 w-4" />;
  if (action.includes('marked property as "Sold"')) return <CheckCircle className="h-4 w-4" />;
  if (action.includes('scheduled an appointment')) return <CalendarPlus className="h-4 w-4" />;
  if (action.includes('accepted the invitation')) return <Check className="h-4 w-4 text-green-500" />;
  if (action.includes('rejected the invitation')) return <X className="h-4 w-4 text-red-500" />;
  return <Edit className="h-4 w-4" />;
};


export default function ActivitiesPage() {
  const firestore = useFirestore();
  const { profile } = useProfile();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activitiesQuery = useMemoFirebase(() => {
    if (!profile.agency_id) return null;
    const sevenDaysAgo = subDays(new Date(), 7);
    return query(
        collection(firestore, 'agencies', profile.agency_id, 'activityLogs'), 
        where('timestamp', '>=', sevenDaysAgo.toISOString()),
        orderBy('timestamp', 'desc')
    );
  }, [firestore, profile.agency_id]);

  const { data: activities, isLoading } = useCollection<Activity>(activitiesQuery);
  
  const sortedActivities = activities; // Already sorted by query

  const handleClearActivities = async () => {
    if (!profile.agency_id) {
        toast({ title: 'Error', description: 'Agency ID not found.', variant: 'destructive'});
        return;
    }
    const activityLogRef = collection(firestore, 'agencies', profile.agency_id, 'activityLogs');
    const querySnapshot = await getDocs(activityLogRef);
    const batch = writeBatch(firestore);
    querySnapshot.forEach(doc => batch.delete(doc.ref));
    
    try {
        await batch.commit();
        toast({ title: 'Activity Log Cleared', description: 'All activity records have been deleted.' });
    } catch (error) {
        toast({ title: 'Error', description: 'Could not clear activity log.', variant: 'destructive'});
        console.error("Error clearing activities: ", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold tracking-tight font-headline">
            Recent Activities
            </h1>
            <p className="text-muted-foreground">
            A log of all major actions taken within the last 7 days.
            </p>
        </div>
        {profile.role === 'Admin' && (
             <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={!activities || activities.length === 0}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all activity logs. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearActivities}>Confirm & Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flow-root">
          {isLoading && <div className="text-center py-20 text-muted-foreground">Loading activities...</div>}
          {!isLoading && (!sortedActivities || sortedActivities.length === 0) ? (
                <div className="text-center py-20 text-muted-foreground">
                    No activities recorded in the last 7 days.
                </div>
            ) : (
            <ul className="divide-y divide-border">
              {sortedActivities?.map((activity) => (
                <li key={activity.id} className="relative p-6 hover:bg-accent/50 transition-colors">
                  <div className="relative flex items-start gap-4">
                     <div className="absolute left-6 top-6 h-full w-px bg-border -translate-x-1/2" aria-hidden="true" />
                     <div className="relative flex h-10 w-10 flex-none items-center justify-center bg-card rounded-full ring-1 ring-border">
                       <div className="text-primary">
                         {getActionIcon(activity.action)}
                       </div>
                     </div>
                    <div className="flex-auto pt-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold">{activity.userName}</span>
                        <span className="text-muted-foreground text-sm">{activity.action}</span>
                      </div>
                      <p className="font-semibold text-primary">{activity.target}</p>

                      {activity.details && (
                        <div className="mt-2 flex items-center gap-2 text-sm">
                          <Badge variant="secondary">{activity.details.from}</Badge>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <Badge variant="default">{activity.details.to}</Badge>
                        </div>
                      )}
                      
                       <time dateTime={activity.timestamp} className="block flex-none text-xs text-muted-foreground mt-2">
                        {mounted ? format(new Date(activity.timestamp), "PPpp") : '...'}
                      </time>
                    </div>
                     <div className="absolute right-0 top-0 text-muted-foreground">
                        <Badge variant="outline">{activity.targetType}</Badge>
                     </div>
                  </div>
                </li>
              ))}
            </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
