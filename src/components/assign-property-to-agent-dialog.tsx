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
import { ScrollArea } from './ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useProfile } from '@/context/profile-context';
import { useFirestore } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { doc, writeBatch, collection, arrayUnion } from 'firebase/firestore';
import { useMemoFirebase } from '@/firebase/hooks';
import type { User, Buyer, Property, Activity } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Check, Users, Sparkles, Building2 } from 'lucide-react';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { formatCurrency, formatUnit } from '@/lib/formatters';
import { useCurrency, Currency } from '@/context/currency-context';
import { cn } from '@/lib/utils';

interface AssignPropertyToAgentDialogProps {
  property: Property;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export function AssignPropertyToAgentDialog({ property, isOpen, setIsOpen }: AssignPropertyToAgentDialogProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [selectedBuyerIds, setSelectedBuyerIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { profile } = useProfile();
  const { currency } = useCurrency();
  const firestore = useFirestore();

  const teamQuery = useMemoFirebase(() => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'teamMembers') : null, [profile.agency_id, firestore]);
  const { data: teamMembers } = useCollection<User>(teamQuery);
  const activeAgents = useMemo(() => teamMembers?.filter(m => m.status === 'Active' && (m.role === 'Agent' || m.role === 'Admin')) || [], [teamMembers]);

  const buyersQuery = useMemoFirebase(() => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'buyers') : null, [profile.agency_id, firestore]);
  const { data: allBuyers } = useCollection<Buyer>(buyersQuery);

  // Matching Logic: Find unassigned buyers that match this property's specs
  const matchingBuyers = useMemo(() => {
    if (!allBuyers) return [];
    
    return allBuyers.filter(buyer => {
        if (buyer.is_deleted || buyer.assignedTo) return false;
        
        // Basic match criteria
        const listingMatch = (buyer.listing_type || 'For Sale') === property.listing_type;
        const typeMatch = buyer.property_type_preference?.toLowerCase() === property.property_type.toLowerCase();
        
        // Area Match (partial match in comma separated preferences)
        const areaMatch = buyer.area_preference?.toLowerCase().includes(property.area.toLowerCase());
        
        // Budget Match
        const propDemand = formatUnit(property.demand_amount, property.demand_unit);
        const buyerMin = formatUnit(buyer.budget_min_amount || 0, buyer.budget_min_unit || 'Thousand');
        const buyerMax = formatUnit(buyer.budget_max_amount || 0, buyer.budget_max_unit || 'Lacs');
        const budgetMatch = propDemand >= (buyerMin * 0.9) && propDemand <= (buyerMax * 1.1);

        return listingMatch && typeMatch && (areaMatch || budgetMatch);
    }).sort((a, b) => {
        // Sort by closest match (simple logic for now)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [allBuyers, property]);

  const handleToggleBuyer = (id: string) => {
    setSelectedBuyerIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleAssign = async () => {
    if (!selectedAgentId || !profile.agency_id) return;
    
    setIsSubmitting(true);
    const agent = activeAgents.find(a => (a.user_id || a.id) === selectedAgentId);
    
    try {
        const batch = writeBatch(firestore);
        
        // 1. Assign Property to Agent (Properties can have multiple agents)
        const propRef = doc(firestore, 'agencies', profile.agency_id, 'properties', property.id);
        batch.update(propRef, { assignedTo: arrayUnion(selectedAgentId) });

        // 2. Assign selected Buyers to Agent (Buyers are exclusive)
        selectedBuyerIds.forEach(buyerId => {
            const buyerRef = doc(firestore, 'agencies', profile.agency_id, 'buyers', buyerId);
            batch.update(buyerRef, { 
                assignedTo: selectedAgentId,
                status: 'Interested' // Automatically set to interested when assigned for a specific property
            });
        });

        // 3. Log Activity
        const logRef = doc(collection(firestore, 'agencies', profile.agency_id, 'activityLogs'));
        batch.set(logRef, {
            userName: profile.name,
            action: `assigned property ${property.serial_no} and ${selectedBuyerIds.length} matching buyers to ${agent?.name}`,
            target: property.auto_title,
            targetType: 'Property',
            timestamp: new Date().toISOString(),
            agency_id: profile.agency_id,
            assignedToId: selectedAgentId,
            assignedToName: agent?.name
        });

        await batch.commit();
        toast({ title: "Assignment Complete", description: `Property and ${selectedBuyerIds.length} buyers assigned to ${agent?.name}.` });
        setIsOpen(false);
    } catch (error) {
        toast({ title: "Assignment Failed", variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0">
        <div className="p-6 pb-2">
            <DialogHeader>
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-primary/10 text-primary shadow-inner">
                        <Building2 className="h-6 w-6" />
                    </div>
                    <div>
                        <DialogTitle className="font-headline text-2xl font-black">Assign Portfolio</DialogTitle>
                        <DialogDescription className="font-medium">Assign <strong>{property.serial_no}</strong> with its matching buyers.</DialogDescription>
                    </div>
                </div>
            </DialogHeader>
        </div>

        <div className="flex-1 overflow-hidden px-6 space-y-6">
            <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Step 1: Select Expert Agent</label>
                <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                    <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-border/60">
                        <SelectValue placeholder="Choose an agent to handle this lead..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl shadow-2xl border-none">
                        {activeAgents.map(agent => (
                            <SelectItem key={agent.user_id || agent.id} value={agent.user_id || agent.id}>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold">{agent.name}</span>
                                    <Badge variant="outline" className="text-[9px] uppercase tracking-tighter h-4 px-1">{agent.role}</Badge>
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60 flex items-center gap-2">
                        <Sparkles className="h-3 w-3 text-primary" /> Step 2: Select Matching Buyers ({matchingBuyers.length} available)
                    </label>
                    {matchingBuyers.length > 0 && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 text-[10px] font-bold"
                            onClick={() => setSelectedBuyerIds(selectedBuyerIds.length === matchingBuyers.length ? [] : matchingBuyers.map(b => b.id))}
                        >
                            {selectedBuyerIds.length === matchingBuyers.length ? 'Deselect All' : 'Select All'}
                        </Button>
                    )}
                </div>

                <div className="flex-1 border rounded-2xl bg-muted/5 overflow-hidden">
                    <ScrollArea className="h-[40vh]">
                        <div className="p-2 space-y-2">
                            {matchingBuyers.length > 0 ? matchingBuyers.map(buyer => (
                                <div 
                                    key={buyer.id}
                                    className={cn(
                                        "flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer group",
                                        selectedBuyerIds.includes(buyer.id) ? "bg-primary/5 border-primary shadow-sm" : "hover:bg-accent border-transparent"
                                    )}
                                    onClick={() => handleToggleBuyer(buyer.id)}
                                >
                                    <Checkbox 
                                        checked={selectedBuyerIds.includes(buyer.id)} 
                                        onCheckedChange={() => handleToggleBuyer(buyer.id)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="mt-1"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-bold text-sm truncate">{buyer.name}</span>
                                            <Badge variant="outline" className="font-mono text-[9px] font-black">{buyer.serial_no}</Badge>
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                                            <span>{buyer.area_preference || 'Any Area'}</span>
                                            <span className="text-primary">{formatCurrency(formatUnit(buyer.budget_min_amount || 0, buyer.budget_min_unit || 'Lacs'), currency as Currency)} - {formatCurrency(formatUnit(buyer.budget_max_amount || 0, buyer.budget_max_unit || 'Lacs'), currency as Currency)}</span>
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div className="py-20 text-center opacity-40">
                                    <Users className="h-10 w-10 mx-auto mb-2" />
                                    <p className="text-xs font-bold uppercase">No unassigned matching buyers found.</p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </div>
        </div>

        <DialogFooter className="p-6 border-t bg-muted/5 mt-4">
            <Button variant="ghost" onClick={() => setIsOpen(false)} className="rounded-xl h-11 px-6">Cancel</Button>
            <Button 
                onClick={handleAssign} 
                disabled={!selectedAgentId || isSubmitting} 
                className="rounded-xl h-11 px-10 font-bold glowing-btn flex-1 sm:flex-none"
            >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Assign {selectedBuyerIds.length > 0 ? `with ${selectedBuyerIds.length} Buyers` : 'Property Only'}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
