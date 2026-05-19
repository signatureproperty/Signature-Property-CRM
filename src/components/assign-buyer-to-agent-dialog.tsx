'use client';

import { useState, useMemo } from 'react';
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
import type { User, Buyer, Property } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Check, Users, Sparkles, Home } from 'lucide-react';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { formatCurrency, formatUnit } from '@/lib/formatters';
import { useCurrency, Currency } from '@/context/currency-context';
import { cn } from '@/lib/utils';

interface AssignBuyerToAgentDialogProps {
  buyer: Buyer;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export function AssignBuyerToAgentDialog({ buyer, isOpen, setIsOpen }: AssignBuyerToAgentDialogProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { profile } = useProfile();
  const { currency } = useCurrency();
  const firestore = useFirestore();

  const teamQuery = useMemoFirebase(() => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'teamMembers') : null, [profile.agency_id, firestore]);
  const { data: teamMembers } = useCollection<User>(teamQuery);
  const activeAgents = teamMembers?.filter(m => m.status === 'Active' && (m.role === 'Agent' || m.role === 'Admin')) || [];

  const propertiesQuery = useMemoFirebase(() => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'properties') : null, [profile.agency_id, firestore]);
  const { data: allProperties } = useCollection<Property>(propertiesQuery);

  // Matching Logic: Find properties that match this buyer's specs
  const matchingProperties = useMemo(() => {
    if (!allProperties) return [];
    
    return allProperties.filter(property => {
        if (property.is_deleted || property.status !== 'Available') return false;
        
        const listingMatch = (buyer.listing_type || 'For Sale') === property.listing_type;
        const typeMatch = buyer.property_type_preference?.toLowerCase() === property.property_type.toLowerCase();
        const areaMatch = buyer.area_preference?.toLowerCase().includes(property.area.toLowerCase());
        
        const propDemand = formatUnit(property.demand_amount, property.demand_unit);
        const buyerMin = formatUnit(buyer.budget_min_amount || 0, buyer.budget_min_unit || 'Thousand');
        const buyerMax = formatUnit(buyer.budget_max_amount || 0, buyer.budget_max_unit || 'Lacs');
        const budgetMatch = propDemand >= (buyerMin * 0.9) && propDemand <= (buyerMax * 1.1);

        return listingMatch && typeMatch && (areaMatch || budgetMatch);
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [allProperties, buyer]);

  const handleToggleProperty = (id: string) => {
    setSelectedPropertyIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleAssign = async () => {
    if (!selectedAgentId || !profile.agency_id) return;
    
    setIsSubmitting(true);
    const agent = activeAgents.find(a => (a.user_id || a.id) === selectedAgentId);
    
    try {
        const batch = writeBatch(firestore);
        
        // 1. Assign Buyer to Agent (Exclusive)
        const buyerRef = doc(firestore, 'agencies', profile.agency_id, 'buyers', buyer.id);
        batch.update(buyerRef, { assignedTo: selectedAgentId });

        // 2. Assign selected Properties to Agent (Properties shared)
        selectedPropertyIds.forEach(propId => {
            const propRef = doc(firestore, 'agencies', profile.agency_id, 'properties', propId);
            batch.update(propRef, { assignedTo: arrayUnion(selectedAgentId) });
        });

        // 3. Log Activity
        const logRef = doc(collection(firestore, 'agencies', profile.agency_id, 'activityLogs'));
        batch.set(logRef, {
            userName: profile.name,
            action: `assigned buyer ${buyer.name} and ${selectedPropertyIds.length} recommended properties to ${agent?.name}`,
            target: buyer.name,
            targetType: 'Buyer',
            timestamp: new Date().toISOString(),
            agency_id: profile.agency_id,
            assignedToId: selectedAgentId,
            assignedToName: agent?.name
        });

        await batch.commit();
        toast({ title: "Assignment Complete", description: `Buyer and ${selectedPropertyIds.length} properties assigned to ${agent?.name}.` });
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
                        <Users className="h-6 w-6" />
                    </div>
                    <div>
                        <DialogTitle className="font-headline text-2xl font-black">Assign Lead</DialogTitle>
                        <DialogDescription className="font-medium">Assign <strong>{buyer.name}</strong> to an agent with recommended inventory.</DialogDescription>
                    </div>
                </div>
            </DialogHeader>
        </div>

        <div className="flex-1 overflow-hidden px-6 space-y-6">
            <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Step 1: Select Closing Agent</label>
                <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                    <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-border/60">
                        <SelectValue placeholder="Choose an expert for this buyer..." />
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
                        <Sparkles className="h-3 w-3 text-primary" /> Step 2: Select Matching Inventory ({matchingProperties.length} found)
                    </label>
                    {matchingProperties.length > 0 && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 text-[10px] font-bold"
                            onClick={() => setSelectedPropertyIds(selectedPropertyIds.length === matchingProperties.length ? [] : matchingProperties.map(p => p.id))}
                        >
                            {selectedPropertyIds.length === matchingProperties.length ? 'Deselect All' : 'Select All'}
                        </Button>
                    )}
                </div>

                <div className="flex-1 border rounded-2xl bg-muted/5 overflow-hidden">
                    <ScrollArea className="h-[40vh]">
                        <div className="p-2 space-y-2">
                            {matchingProperties.length > 0 ? matchingProperties.map(prop => (
                                <div 
                                    key={prop.id}
                                    className={cn(
                                        "flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer group",
                                        selectedPropertyIds.includes(prop.id) ? "bg-primary/5 border-primary shadow-sm" : "hover:bg-accent border-transparent"
                                    )}
                                    onClick={() => handleToggleProperty(prop.id)}
                                >
                                    <Checkbox 
                                        checked={selectedPropertyIds.includes(prop.id)} 
                                        onCheckedChange={() => handleToggleProperty(prop.id)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="mt-1"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-bold text-sm truncate">{prop.auto_title}</span>
                                            <Badge variant="outline" className="font-mono text-[9px] font-black">{prop.serial_no}</Badge>
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                                            <span>{prop.area}</span>
                                            <span className="text-primary">{formatCurrency(formatUnit(prop.demand_amount, prop.demand_unit), currency as Currency)}</span>
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div className="py-20 text-center opacity-40">
                                    <Home className="h-10 w-10 mx-auto mb-2" />
                                    <p className="text-xs font-bold uppercase">No matching available inventory found.</p>
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
                Complete Assignment
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
