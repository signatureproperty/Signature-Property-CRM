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
import { Tag, Property } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';

interface EditPropertyTagsDialogProps {
  property: Property;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const defaultPropertyStatuses = ['Available', 'Sold', 'Rent Out', 'Sold (External)', 'Pending'];

export function EditPropertyTagsDialog({ property, isOpen, setIsOpen }: EditPropertyTagsDialogProps) {
  const { profile } = useProfile();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectedTags, setSelectedTags] = useState<string[]>(property.tags || []);

  const tagsQuery = useMemoFirebase(() => 
    profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'tags') : null,
    [profile.agency_id, firestore]
  );
  const { data: agencyTags } = useCollection<Tag>(tagsQuery);

  // Combine default statuses with custom agency tags
  const allAvailableTags = useMemo(() => {
    const statusTags = defaultPropertyStatuses.map(status => ({
        id: `status-${status}`,
        name: status,
        color: 'bg-primary/10 text-primary border-primary/20',
        isStatus: true
    }));

    const customTags = (agencyTags || []).map(tag => ({
        ...tag,
        isStatus: false
    }));

    // Filter out custom tags that have the same name as statuses to avoid duplicates
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
    try {
        const propRef = doc(firestore, 'agencies', profile.agency_id, 'properties', property.id);
        await updateDoc(propRef, { tags: selectedTags });
        toast({ title: "Tags Updated" });
        setIsOpen(false);
    } catch (error) {
        toast({ title: "Error", description: "Could not update tags.", variant: 'destructive' });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline">Manage Tags for {property.serial_no}</DialogTitle>
          <DialogDescription>Select statuses or custom tags to apply to this property lead.</DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-80 mt-4 pr-4">
            <div className="grid gap-3">
                {allAvailableTags.length > 0 ? (
                    allAvailableTags.map(tag => (
                        <div 
                            key={tag.id} 
                            className={cn(
                                "flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-accent/50",
                                selectedTags.includes(tag.name) ? "border-primary bg-primary/5" : "border-border"
                            )}
                            onClick={() => handleToggleTag(tag.name)}
                        >
                            <Checkbox 
                                id={`edit-tag-${tag.id}`} 
                                checked={selectedTags.includes(tag.name)}
                                onCheckedChange={() => handleToggleTag(tag.name)}
                                onClick={(e) => e.stopPropagation()}
                            />
                            <Label 
                                htmlFor={`edit-tag-${tag.id}`} 
                                className="flex-1 cursor-pointer font-medium flex items-center justify-between"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <Badge variant="outline" className={cn("px-2 py-0.5", tag.color)}>
                                    {tag.name}
                                </Badge>
                                {tag.isStatus && <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Status</span>}
                            </Label>
                        </div>
                    ))
                ) : (
                    <p className="text-center text-muted-foreground py-10">No tags found.</p>
                )}
            </div>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t">
          <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} className="glowing-btn px-6">Save Tags</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
