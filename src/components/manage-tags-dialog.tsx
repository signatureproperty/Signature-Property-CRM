
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
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase/provider';
import { collection, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { useProfile } from '@/context/profile-context';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useMemoFirebase } from '@/firebase/hooks';
import { Trash2, Plus, Tag as TagIcon, X } from 'lucide-react';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Tag } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

interface ManageTagsDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const tagColors = [
    { name: 'Red', class: 'bg-red-100 text-red-700 border-red-200' },
    { name: 'Blue', class: 'bg-blue-100 text-blue-700 border-blue-200' },
    { name: 'Green', class: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    { name: 'Yellow', class: 'bg-amber-100 text-amber-700 border-amber-200' },
    { name: 'Purple', class: 'bg-purple-100 text-purple-700 border-purple-200' },
    { name: 'Pink', class: 'bg-pink-100 text-pink-700 border-pink-200' },
    { name: 'Indigo', class: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
    { name: 'Orange', class: 'bg-orange-100 text-orange-700 border-orange-200' },
    { name: 'Gray', class: 'bg-gray-100 text-gray-700 border-gray-200' },
];

const formSchema = z.object({
  name: z.string().min(1, 'Tag name is required').max(20, 'Tag name too long'),
});

export function ManageTagsDialog({ isOpen, setIsOpen }: ManageTagsDialogProps) {
  const { profile } = useProfile();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectedColor, setSelectedColor] = useState(tagColors[0].class);

  const tagsQuery = useMemoFirebase(() => 
    profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'tags') : null,
    [profile.agency_id, firestore]
  );
  const { data: tags, isLoading } = useCollection<Tag>(tagsQuery);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '' }
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!profile.agency_id) return;
    
    // Check if tag already exists
    if (tags?.some(t => t.name.toLowerCase() === values.name.toLowerCase())) {
        toast({ title: "Tag already exists", variant: 'destructive' });
        return;
    }

    try {
        await addDoc(collection(firestore, 'agencies', profile.agency_id, 'tags'), {
            name: values.name,
            color: selectedColor,
            agency_id: profile.agency_id,
            createdAt: new Date().toISOString(),
        });
        form.reset();
        toast({ title: "Tag Created" });
    } catch (error) {
        toast({ title: "Error", description: "Could not create tag.", variant: 'destructive' });
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    if (!profile.agency_id) return;
    try {
        await deleteDoc(doc(firestore, 'agencies', profile.agency_id, 'tags', tagId));
        toast({ title: "Tag Deleted" });
    } catch (error) {
        toast({ title: "Error", description: "Could not delete tag.", variant: 'destructive' });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline flex items-center gap-2"><TagIcon className="h-5 w-5" /> Manage Tags</DialogTitle>
          <DialogDescription>Create custom tags to organize your leads.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <div className="flex gap-2 items-end">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem className="flex-1">
                                <FormLabel>New Tag Name</FormLabel>
                                <FormControl>
                                    <Input placeholder="e.g. Urgent" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <Button type="submit" size="icon" className="mb-[2px]"><Plus className="h-4 w-4" /></Button>
                </div>
                <div className="space-y-2">
                    <FormLabel>Select Color</FormLabel>
                    <div className="flex flex-wrap gap-2">
                        {tagColors.map((color) => (
                            <button
                                key={color.name}
                                type="button"
                                onClick={() => setSelectedColor(color.class)}
                                className={cn(
                                    "h-8 w-8 rounded-full border-2 transition-all",
                                    color.class.split(' ')[0], // Use the bg color part for the dot
                                    selectedColor === color.class ? "border-primary scale-110" : "border-transparent"
                                )}
                                title={color.name}
                            />
                        ))}
                    </div>
                </div>
            </form>
        </Form>

        <Separator className="my-4" />

        <div className="space-y-3">
            <h4 className="text-sm font-semibold">Existing Tags</h4>
            <ScrollArea className="h-48 rounded-md border p-4 bg-muted/20">
                {isLoading ? <p className="text-center text-muted-foreground py-10">Loading tags...</p> : 
                tags && tags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {tags.map(tag => (
                            <Badge 
                                key={tag.id} 
                                variant="outline" 
                                className={cn("px-3 py-1 flex items-center gap-2", tag.color)}
                            >
                                {tag.name}
                                <button onClick={() => handleDeleteTag(tag.id)} className="hover:text-destructive">
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-muted-foreground py-10">No custom tags yet.</p>
                )}
            </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => setIsOpen(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

