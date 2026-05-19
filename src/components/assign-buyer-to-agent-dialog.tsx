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

  // Smart Matching Logic: Find properties that match this buyer's requirements
  const matchingProperties = useMemo(() => {
    if (!allProperties || !buyer) return [];
    
    return allProperties.filter(property => {
        // Basic checks
        if (property.is_deleted || property.status !== 'Available') return false;
        
        // 1. Listing Type Match (Mandatory)
        const buyerListingType = buyer.listing_type || 'For Sale';
        const propertyListingType = property.is_for_rent ? 'For Rent' : 'For Sale';
        if (buyerListingType !== propertyListingType) return false;

        // 2. Property Type Match (Fuzzy)
        const buyerType = (buyer.property_type_preference || '').toLowerCase();
        const propType = (property.property_type || '').toLowerCase();
        // Exact match or includes (e.g. "Residential Plot" matches "Plot")
        const typeMatch = buyerType === propType || propType.includes(buyerType) || buyerType.includes(propType);
        if (!typeMatch) return false;
        
        // 3. Area Match (Fuzzy)
        // Check if property area exists as a substring in any of buyer's comma-separated preferences
        const buyerAreas = (buyer.area_preference || '').toLowerCase().split(',').map(a => a.trim()).filter(Boolean);
        const propArea = (property.area || '').toLowerCase();
        // If buyer didn't specify areas, we consider it a loose match
        const areaMatch = buyerAreas.length === 0 || buyerAreas.some(ba => propArea.includes(ba) || ba.includes(propArea));
        
        // 4. Budget Match (Naram logic: +/- 20% margin)
        const propDemand = formatUnit(property.demand_amount, property.demand_unit);
        const buyerMin = formatUnit(buyer.budget_min_amount || 0, buyer.budget_min_unit || 'Thousand');
        const buyerMax = formatUnit(buyer.budget_max_amount || 0, buyer.budget_max_unit || 'Lacs');
        
        // We accept properties that are slightly below min or slightly above max
        const minWithMargin = buyerMin * 0.8;
        const maxWithMargin = (buyerMax || buyerMin) * 1.2;
        const budgetMatch = (propDemand >= minWithMargin && propDemand <= maxWithMargin);

        // A property is a "good match" if it matches Type AND (Area OR Budget)
        // This follows the user's request for "thora bhtt oper niche"
        return typeMatch && (areaMatch || budgetMatch);
    }).sort((a, b) => {
        // Prioritize newer listings
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 border-none shadow-3xl">
        <div className="p-6 pb-2">
            <DialogHeader>
                <div className="flex items-center gap-4">
                    <div className="p-3.5 rounded-2xl bg-primary/10 text-primary shadow-inner">
                        <Users className="h-7 w-7" />
                    </div>
                    <div>
                        <DialogTitle className="font-headline text-2xl font-black tracking-tight">Assign Lead & Inventory</DialogTitle>
                        <DialogDescription className="font-medium">Matching <strong>{buyer.name}</strong> with relevant agency stock.</DialogDescription>
                    </div>
                </div>
            </DialogHeader>
        </div>

        <div className="flex-1 overflow-hidden px-6 space-y-6">
            <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Step 1: Select Closing Agent</label>
                <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                    <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-border/60 hover:border-primary/40 transition-colors">
                        <SelectValue placeholder="Choose an expert for this buyer..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl shadow-2xl border-none">
                        {activeAgents.map(agent => (
                            <SelectItem key={agent.user_id || agent.id} value={agent.user_id || agent.id}>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold">{agent.name}</span>
                                    <Badge variant="outline" className="text-[9px] uppercase tracking-tighter h-4 px-1.5 font-bold border-primary/20 bg-primary/5">{agent.role}</Badge>
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60 flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-primary" /> Step 2: Recommended Properties ({matchingProperties.length})
                    </label>
                    {matchingProperties.length > 0 && (
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 text-[10px] font-black text-primary hover:bg-primary/10"
                            onClick={() => setSelectedPropertyIds(selectedPropertyIds.length === matchingProperties.length ? [] : matchingProperties.map(p => p.id))}
                        >
                            {selectedPropertyIds.length === matchingProperties.length ? 'Deselect All' : 'Select All matching'}
                        </Button>
                    )}
                </div>

                <div className="flex-1 border rounded-2xl bg-muted/5 overflow-hidden ring-1 ring-border/50">
                    <ScrollArea className="h-[40vh]">
                        <div className="p-3 space-y-2.5">
                            {matchingProperties.length > 0 ? matchingProperties.map(prop => (
                                <div 
                                    key={prop.id}
                                    className={cn(
                                        "flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer group",
                                        selectedPropertyIds.includes(prop.id) ? "bg-primary/5 border-primary shadow-sm" : "hover:bg-accent border-transparent bg-background"
                                    )}
                                    onClick={() => handleToggleProperty(prop.id)}
                                >
                                    <Checkbox 
                                        checked={selectedPropertyIds.includes(prop.id)} 
                                        onCheckedChange={() => handleToggleProperty(prop.id)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="mt-1 h-5 w-5 rounded-md"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="font-bold text-sm truncate">{prop.auto_title}</span>
                                            <Badge variant="outline" className="font-mono text-[9px] font-black tracking-tighter bg-muted/50">{prop.serial_no}</Badge>
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-black uppercase tracking-widest">
                                            <span className="flex items-center gap-1"><Home className="h-3 w-3" /> {prop.area}</span>
                                            <span className="text-primary font-bold">{formatCurrency(formatUnit(prop.demand_amount, prop.demand_unit), currency as Currency)}</span>
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div className="py-20 text-center opacity-40">
                                    <Home className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                                    <p className="text-sm font-black uppercase tracking-widest">No matching stock found</p>
                                    <p className="text-[10px] font-medium mt-1">Try expanding buyer requirements to see suggestions.</p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </div>
        </div>

        <DialogFooter className="p-6 border-t bg-muted/5 mt-4 flex items-center justify-between sm:justify-between">
            <Button variant="ghost" onClick={() => setIsOpen(false)} className="rounded-xl h-12 px-8 font-bold">Cancel</Button>
            <Button 
                onClick={handleAssign} 
                disabled={!selectedAgentId || isSubmitting} 
                className="rounded-xl h-12 px-12 font-black glowing-btn min-w-[200px]"
            >
                {isSubmitting ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                    <Check className="mr-2 h-5 w-5" />
                )}
                Confirm Assignment
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
