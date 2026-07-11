'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Checkbox } from './ui/checkbox';
import { ScrollArea } from './ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useProfile } from '@/context/profile-context';
import { useFirestore } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { useMemoFirebase } from '@/firebase/hooks';
import type { User, Buyer, Activity } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Badge } from './ui/badge';

interface AssignBuyerDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export function AssignBuyerDialog({ isOpen, setIsOpen }: AssignBuyerDialogProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [selectedBuyerIds, setSelectedBuyerIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { profile } = useProfile();
  const firestore = useFirestore();

  const teamMembersQuery = useMemoFirebase(
    () => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'teamMembers') : null,
    [firestore, profile.agency_id]
  );
  const { data: teamMembers } = useCollection<User>(teamMembersQuery);
  const activeAgents = useMemo(() => teamMembers?.filter(m => m.status === 'Active') || [], [teamMembers]);

  const buyersQuery = useMemoFirebase(
    () => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'buyers') : null,
    [firestore, profile.agency_id]
  );
  const { data: allBuyers } = useCollection<Buyer>(buyersQuery);
  
  const unassignedBuyers = useMemo(() => allBuyers?.filter(b => !b.assignedTo && !b.is_deleted) || [], [allBuyers]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedAgentId('');
      setSelectedBuyerIds([]);
      setIsLoading(false);
    }
  }, [isOpen]);

  const handleAssign = async () => {
    if (!selectedAgentId || selectedBuyerIds.length === 0 || !profile.agency_id) {
      toast({
        title: 'Selection Missing',
        description: 'Please select an agent and at least one buyer.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const agent = activeAgents.find(a => a.id === selectedAgentId);
    if (!agent) {
        setIsLoading(false);
        toast({ title: 'Agent not found', variant: 'destructive' });
        return;
    }
    
    try {
        const batch = writeBatch(firestore);
        const activityLogRef = collection(firestore, 'agencies', profile.agency_id, 'activityLogs');
        let buyerNames: string[] = [];

        selectedBuyerIds.forEach(buyerId => {
            const buyer = unassignedBuyers.find(b => b.id === buyerId);
            if (buyer) {
                buyerNames.push(buyer.name);
                const buyerRef = doc(firestore, 'agencies', profile.agency_id, 'buyers', buyerId);
                batch.update(buyerRef, { assignedTo: selectedAgentId });
            }
        });
        
        const newActivity: Omit<Activity, 'id'> = {
            userName: profile.name,
            userAvatar: profile.avatar,
            action: `assigned ${buyerNames.length} buyer(s) to ${agent.name}`,
            target: buyerNames.join(', '),
            targetType: 'Buyer',
            details: null,
            timestamp: new Date().toISOString(),
            agency_id: profile.agency_id,
        };
        batch.set(doc(activityLogRef), newActivity);

        await batch.commit();

        toast({
            title: 'Buyers Assigned!',
            description: `${selectedBuyerIds.length} buyer(s) have been assigned to ${agent.name}.`,
        });
        setIsOpen(false);
    } catch (error) {
        console.error("Error assigning buyers: ", error);
        toast({ title: 'Assignment Failed', description: 'An error occurred. Please try again.', variant: 'destructive'});
    } finally {
        setIsLoading(false);
    }
  };

  const handleBuyerSelection = (buyerId: string) => {
    setSelectedBuyerIds(prev =>
      prev.includes(buyerId) ? prev.filter(id => id !== buyerId) : [...prev, buyerId]
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-lg max-h-[70vh] sm:max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="font-headline">Assign Buyers to Agent</DialogTitle>
          <DialogDescription>
            Select an agent and choose which available buyers to assign to them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Agent</label>
            <Select onValueChange={setSelectedAgentId} value={selectedAgentId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an agent..." />
              </SelectTrigger>
              <SelectContent>
                {activeAgents.map(agent => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Select Buyers</label>
            <p className="text-xs text-muted-foreground">Only unassigned buyers are shown.</p>
             <Command className="rounded-lg border shadow-sm">
                <CommandInput placeholder="Search for buyers..." />
                <ScrollArea className="h-64">
                    <CommandList>
                        <CommandEmpty>No buyers found.</CommandEmpty>
                        <CommandGroup>
                            {unassignedBuyers.map(buyer => (
                            <CommandItem
                                key={buyer.id}
                                onSelect={() => handleBuyerSelection(buyer.id)}
                                className="flex items-center justify-between"
                            >
                                <div className="flex items-center gap-2">
                                     <Checkbox
                                        checked={selectedBuyerIds.includes(buyer.id)}
                                        onCheckedChange={() => handleBuyerSelection(buyer.id)}
                                    />
                                    <div>
                                        <p className="font-medium">{buyer.name}</p>
                                        <p className="text-xs text-muted-foreground">{buyer.area_preference}</p>
                                    </div>
                                </div>
                               <Badge variant="outline">{buyer.serial_no}</Badge>
                            </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </ScrollArea>
            </Command>
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={isLoading || !selectedAgentId || selectedBuyerIds.length === 0}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Assign {selectedBuyerIds.length > 0 ? selectedBuyerIds.length : ''} Selected Buyer(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
