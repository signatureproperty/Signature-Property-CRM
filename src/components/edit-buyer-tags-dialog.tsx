'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useFirestore } from '@/firebase/provider';
import { doc, updateDoc } from 'firebase/firestore';
import { useProfile } from '@/context/profile-context';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useMemoFirebase } from '@/firebase/hooks';
import { collection } from 'firebase/firestore';
import { Tag, Buyer, BuyerStatus } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';
import { buyerStatuses } from '@/lib/data';
import { Users2, Tag as TagIcon } from 'lucide-react';

interface EditBuyerTagsDialogProps {
  buyer: Buyer;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const statusVariant = {
    'New': 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
    'Interested': 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
    'Not Interested': 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
    'Follow Up': 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
    'Visited Property': 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
    'Deal Closed': 'bg-slate-800 text-white border-slate-700 dark:bg-slate-700 dark:border-slate-600',
    'Deal Lost': 'bg-gray-400 text-white border-gray-300 dark:bg-gray-600 dark:border-gray-500'
} as const;

export function EditBuyerTagsDialog({ buyer, isOpen, setIsOpen }: EditBuyerTagsDialogProps) {
  const { profile } = useProfile();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectedTags, setSelectedTags] = useState<string[]>(buyer.tags || []);

  const tagsQuery = useMemoFirebase(() => 
    profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'tags') : null,
    [profile.agency_id, firestore]
  );
  const { data: allAgencyTags } = useCollection<Tag>(tagsQuery);

  const agencyTags = useMemo(() => {
    if (!allAgencyTags) return [];
    if (profile.role === 'Agent') {
      return allAgencyTags.filter(t => t.createdBy === profile.user_id);
    }
    return allAgencyTags;
  }, [allAgencyTags, profile.role, profile.user_id]);

  const allAvailableTags = useMemo(() => {
    const statusTags = buyerStatuses.map(status => ({
        id: `status-${status}`,
        name: status,
        color: statusVariant[status as keyof typeof statusVariant],
        isStatus: true
    }));

    const customTags = (agencyTags || []).map(tag => ({
        ...tag,
        isStatus: false
    }));

    const filteredCustom = customTags.filter(ct => !buyerStatuses.includes(ct.name as any));

    return [...statusTags, ...filteredCustom];
  }, [agencyTags]);

  useEffect(() => {
    if (isOpen) {
        setSelectedTags(buyer.tags || []);
    }
  }, [isOpen, buyer.tags]);

  const handleToggleTag = (tagName: string) => {
    setSelectedTags(prev => 
        prev.includes(tagName) 
            ? prev.filter(t => t !== tagName) 
            : [...prev, tagName]
    );
  };

  const handleSave = async () => {
    if (!profile.agency_id) return;
    
    let newMainStatus: BuyerStatus = buyer.status;
    const selectedStatuses = selectedTags.filter(tag => buyerStatuses.includes(tag as any)) as BuyerStatus[];
    
    if (selectedStatuses.length > 0) {
        const nonNewStatus = selectedStatuses.find(s => s !== 'New');
        newMainStatus = nonNewStatus || 'New';
    }

    try {
        const buyerRef = doc(firestore, 'agencies', profile.agency_id, 'buyers', buyer.id);
        await updateDoc(buyerRef, { 
            tags: selectedTags,
            status: newMainStatus
        });
        toast({ title: "Buyer Tags Updated" });
        setIsOpen(false);
    } catch (error) {
        toast({ title: "Error", description: "Could not update tags.", variant: 'destructive' });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md rounded-3xl p-0 overflow-hidden">
        <div className="p-6 pb-2">
            <DialogHeader>
              <DialogTitle className="font-headline text-2xl font-black tracking-tight flex items-center gap-2">
                <TagIcon className="h-6 w-6 text-primary" /> Labels & Tags
              </DialogTitle>
              <DialogDescription className="font-medium flex items-center gap-1.5">
                <Users2 className="h-4 w-4 opacity-60" /> Shared Agency Library
              </DialogDescription>
            </DialogHeader>
        </div>

        <ScrollArea className="h-96 px-6 py-2">
            <div className="grid gap-3 pb-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60 mb-1">Select Tags to Apply</p>
                {allAvailableTags.length > 0 ? (
                    allAvailableTags.map(tag => (
                        <div 
                            key={tag.id} 
                            className={cn(
                                "flex items-center space-x-4 p-3.5 rounded-2xl border transition-all cursor-pointer",
                                selectedTags.includes(tag.name) ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:bg-accent/50"
                            )}
                            onClick={() => handleToggleTag(tag.name)}
                        >
                            <Checkbox 
                                id={`edit-tag-${tag.id}`} 
                                checked={selectedTags.includes(tag.name)}
                                onCheckedChange={() => handleToggleTag(tag.name)}
                                onClick={(e) => e.stopPropagation()}
                                className="h-5 w-5 rounded-md"
                            />
                            <Label 
                                htmlFor={`edit-tag-${tag.id}`} 
                                className="flex-1 cursor-pointer font-bold flex items-center justify-between"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <Badge className={cn("px-3 py-1 text-[11px] font-black shadow-sm border-none", tag.color)}>
                                    {tag.name}
                                </Badge>
                                {tag.isStatus && <span className="text-[9px] text-muted-foreground uppercase font-black tracking-tighter bg-muted px-2 py-0.5 rounded-md">Status</span>}
                            </Label>
                        </div>
                    ))
                ) : (
                    <div className="py-20 text-center text-muted-foreground opacity-40">
                        <TagIcon className="h-10 w-10 mx-auto mb-2" />
                        <p className="text-xs font-bold uppercase">No tags available.</p>
                    </div>
                )}
            </div>
        </ScrollArea>

        <DialogFooter className="p-6 border-t bg-muted/5 shrink-0 flex gap-2">
          <Button variant="ghost" onClick={() => setIsOpen(false)} className="rounded-xl h-11 px-6 font-bold">Cancel</Button>
          <Button onClick={handleSave} className="glowing-btn px-10 h-11 rounded-xl font-bold flex-1">Apply Selection</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
