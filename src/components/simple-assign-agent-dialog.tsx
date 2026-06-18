'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProfile } from '@/context/profile-context';
import { useFirestore } from '@/firebase/provider';
import { doc, updateDoc, collection, addDoc } from 'firebase/firestore';
import type { User, Buyer } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, Check } from 'lucide-react';
import { Badge } from './ui/badge';

interface SimpleAssignAgentDialogProps {
  buyer: Buyer;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  teamMembers: User[];
}

export function SimpleAssignAgentDialog({ buyer, isOpen, setIsOpen, teamMembers }: SimpleAssignAgentDialogProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string>(buyer.assignedTo || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { profile } = useProfile();
  const firestore = useFirestore();

  const activeAgents = teamMembers?.filter(m => m.status === 'Active' && (m.role === 'Agent' || m.role === 'Admin')) || [];

  const handleAssign = async () => {
    if (!selectedAgentId || !profile.agency_id) return;
    
    setIsSubmitting(true);
    const agent = activeAgents.find(a => (a.user_id || a.id) === selectedAgentId);
    
    try {
        const buyerRef = doc(firestore, 'agencies', profile.agency_id, 'buyers', buyer.id);
        await updateDoc(buyerRef, { assignedTo: selectedAgentId });

        const logRef = collection(firestore, 'agencies', profile.agency_id, 'activityLogs');
        await addDoc(logRef, {
            userName: profile.name,
            action: `directly assigned lead ${buyer.name} to ${agent?.name}`,
            target: buyer.name,
            targetType: 'Buyer',
            timestamp: new Date().toISOString(),
            agency_id: profile.agency_id,
            assignedToId: selectedAgentId,
            assignedToName: agent?.name
        });

        toast({ title: "Agent Assigned", description: `${buyer.name} is now with ${agent?.name}.` });
        setIsOpen(false);
    } catch (error) {
        console.error("Assignment error:", error);
        toast({ title: "Assignment Failed", variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md border-none shadow-3xl rounded-[2rem]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-xl text-primary">
                <UserPlus className="h-6 w-6" />
            </div>
            <div>
                <DialogTitle className="font-headline text-xl font-black">Direct Assignment</DialogTitle>
                <DialogDescription className="text-xs font-medium">
                    Assign <strong>{buyer.name}</strong> to a specific team member.
                </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="py-4">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60 mb-2 block">Choose Team Member</label>
            <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-border/60 hover:border-primary/40 transition-colors">
                    <SelectValue placeholder="Select an agent..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl shadow-2xl border-none">
                    {activeAgents.map(agent => (
                        <SelectItem key={agent.user_id || agent.id} value={agent.user_id || agent.id}>
                            <div className="flex items-center gap-2">
                                <span className="font-bold">{agent.name}</span>
                                <Badge variant="outline" className="text-[9px] uppercase font-bold border-primary/20 bg-primary/5 h-4 px-1.5">{agent.role}</Badge>
                            </div>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
        <DialogFooter className="gap-2 sm:gap-0 mt-4 border-t pt-6 bg-muted/5 -mx-6 px-6 pb-6">
          <Button variant="ghost" onClick={() => setIsOpen(false)} className="rounded-xl font-bold h-11 px-6">Cancel</Button>
          <Button onClick={handleAssign} disabled={!selectedAgentId || isSubmitting} className="glowing-btn rounded-xl px-10 h-11 font-black flex-1">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
            Assign Lead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
