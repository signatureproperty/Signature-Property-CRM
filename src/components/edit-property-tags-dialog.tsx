
'use client';

import { useState, useEffect } from 'react';
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
          <DialogTitle>Manage Tags for {property.serial_no}</DialogTitle>
          <DialogDescription>Select the tags you want to apply to this property lead.</DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-64 mt-4 pr-4">
            <div className="grid gap-3">
                {agencyTags && agencyTags.length > 0 ? (
                    agencyTags.map(tag => (
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
                                className="flex-1 cursor-pointer font-medium flex items-center gap-2"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <Badge variant="outline" className={tag.color}>{tag.name}</Badge>
                            </Label>
                        </div>
                    ))
                ) : (
                    <p className="text-center text-muted-foreground py-10">No custom tags created yet. Go to Manage Tags to create some.</p>
                )}
            </div>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t">
          <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save Tags</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
