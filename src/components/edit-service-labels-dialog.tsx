'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase/provider';
import { doc, updateDoc } from 'firebase/firestore';
import { useProfile } from '@/context/profile-context';
import { Check, Tag, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ProvidedService } from '@/lib/types';

const tagColors = [
    'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
    'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
    'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
    'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
    'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
    'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800',
    'bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/30 dark:text-pink-400 dark:border-pink-800',
    'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
    'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
];

function getTagColor(tagName: string) {
    let hash = 0;
    for (let i = 0; i < tagName.length; i++) {
        hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return tagColors[Math.abs(hash) % tagColors.length];
}

interface EditServiceLabelsDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  log: ProvidedService | null;
  availableTags: string[];
}

export function EditServiceLabelsDialog({ isOpen, setIsOpen, log, availableTags }: EditServiceLabelsDialogProps) {
  const { profile } = useProfile();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen && log) {
      setSelectedTags(log.tags || []);
    }
  }, [isOpen, log]);

  if (!log || !profile.agency_id) return null;

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleSave = async () => {
    const docRef = doc(firestore, 'agencies', profile.agency_id!, 'providedServices', log.id);
    await updateDoc(docRef, { tags: selectedTags });
    toast({ title: 'Labels updated' });
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md rounded-2xl p-0 gap-0 overflow-hidden max-h-[80vh] sm:max-h-[95vh] flex flex-col">
        <DialogHeader className="p-5 pb-3 shrink-0">
          <DialogTitle className="font-headline text-xl font-black flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" /> Edit Labels
          </DialogTitle>
          <DialogDescription className="text-xs font-medium">
            Select labels for <strong>{log.leadName || log.externalName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 pb-4 flex-1 overflow-y-auto">
          {availableTags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {availableTags.map(tag => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <Badge
                    key={tag}
                    variant="outline"
                    className={cn(
                        "cursor-pointer transition-all text-xs font-bold px-3 py-1.5 rounded-full border-2 select-none",
                        isSelected 
                            ? getTagColor(tag)
                            : "bg-background border-border/50 text-muted-foreground opacity-60 hover:opacity-100"
                    )}
                    onClick={() => toggleTag(tag)}
                  >
                    {isSelected && <Check className="h-3 w-3 mr-1" />}
                    {tag}
                    {isSelected && <X className="h-3 w-3 ml-1" />}
                  </Badge>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-6">No labels defined for this service.</p>
          )}
        </div>

        <div className="p-4 pt-0 shrink-0">
          <Button onClick={handleSave} className="w-full rounded-xl h-11 font-black glowing-btn">
            Save Labels
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
