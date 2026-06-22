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
import { Tag, Property, PropertyStatus } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';
import { Users2, Tag as TagIcon } from 'lucide-react';

interface EditPropertyTagsDialogProps {
  property: Property;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const defaultPropertyStatuses = ['New', 'Pending', 'Available', 'Sold', 'Rent Out', 'Sold (External)'];

const statusVariant = {
  'New': 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
  'Pending': 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
  'Available': 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
  'Sold': 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
  'Rent Out': 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
  'Sold (External)': 'bg-slate-400 text-white border-slate-300 dark:bg-slate-600 dark:border-slate-500'
} as const;

export function EditPropertyTagsDialog({ property, isOpen, setIsOpen }: EditPropertyTagsDialogProps) {
  const { profile } = useProfile();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectedTags, setSelectedTags] = useState<string[]>(property.tags || []);

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
    const statusTags = defaultPropertyStatuses.map(status => ({
        id: `status-${status}`,
        name: status,
        color: statusVariant[status as keyof typeof statusVariant] || 'bg-primary/10 text-primary border-primary/20',
        isStatus: true
    }));

    const customTags = (agencyTags || []).map(tag => ({
        ...tag,
        isStatus: false
    }));

    const filteredCustom = customTags.filter(ct => !defaultPropertyStatuses.includes(ct.name as any));

    return [...statusTags, ...filteredCustom];
  }, [agencyTags]);

  useEffect(() => {
    if (isOpen) {
        setSelectedTags(property.tags || []);
    }
  }, [isOpen, property.tags]);

  const handleToggleTag = (tagName: string) => {
    setSelectedTags(prev => 
        prev.includes(tagName) 
            ? prev.filter(t => t !== tagName) 
            : [...prev, tagName]
    );
  };

  const handleSave = async () => {
    if (!profile.agency_id) return;

    let newMainStatus: PropertyStatus = property.status;
    const selectedStatuses = selectedTags.filter(tag => defaultPropertyStatuses.includes(tag as any)) as PropertyStatus[];
    
    if (selectedStatuses.length > 0) {
        const priorityStatus = selectedStatuses.find(s => s !== 'New');
        newMainStatus = priorityStatus || 'New';
    }

    try {
        const propRef = doc(firestore, 'agencies', profile.agency_id, 'properties', property.id);
        await updateDoc(propRef, { 
            tags: selectedTags,
            status: newMainStatus
        });
        toast({ title: "Property Tags Updated" });
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
                <TagIcon className="h-6 w-6 text-primary" /> Label Management
              </DialogTitle>
              <DialogDescription className="font-medium flex items-center gap-1.5">
                <Users2 className="h-4 w-4 opacity-60" /> Shared Agency Library
              </DialogDescription>
            </DialogHeader>
        </div>

        <ScrollArea className="h-96 px-6 py-2">
            <div className="grid gap-3 pb-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60 mb-1">Select Labels for this Property</p>
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
                                id={`prop-tag-${tag.id}`} 
                                checked={selectedTags.includes(tag.name)}
                                onCheckedChange={() => handleToggleTag(tag.name)}
                                onClick={(e) => e.stopPropagation()}
                                className="h-5 w-5 rounded-md"
                            />
                            <Label 
                                htmlFor={`prop-tag-${tag.id}`} 
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
                        <p className="text-xs font-bold uppercase">No agency labels defined.</p>
                    </div>
                )}
            </div>
        </ScrollArea>

        <DialogFooter className="p-6 border-t bg-muted/5 shrink-0 flex gap-2">
          <Button variant="ghost" onClick={() => setIsOpen(false)} className="rounded-xl h-11 px-6 font-bold">Cancel</Button>
          <Button onClick={handleSave} className="glowing-btn px-10 h-11 rounded-xl font-bold flex-1">Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
