
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
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase/provider';
import { collection, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { useProfile } from '@/context/profile-context';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useMemoFirebase } from '@/firebase/hooks';
import { Trash2, Plus, Tag as TagIcon, X, Info, Edit2, RotateCcw } from 'lucide-react';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Tag } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface ManageTagsDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const tagColors = [
    { name: 'Blue', class: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' },
    { name: 'Emerald', class: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' },
    { name: 'Amber', class: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' },
    { name: 'Purple', class: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800' },
    { name: 'Red', class: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' },
    { name: 'Indigo', class: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800' },
    { name: 'Pink', class: 'bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/30 dark:text-pink-400 dark:border-pink-800' },
    { name: 'Orange', class: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800' },
    { name: 'Gray', class: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700' },
];

const formSchema = z.object({
  name: z.string().min(1, 'Tag name is required').max(20, 'Tag name too long'),
});

export function ManageTagsDialog({ isOpen, setIsOpen }: ManageTagsDialogProps) {
  const { profile } = useProfile();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectedColor, setSelectedColor] = useState(tagColors[0].class);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);

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
    
    // Check for duplicates if not editing current tag
    if (!editingTag && tags?.some(t => t.name.toLowerCase() === values.name.toLowerCase())) {
        toast({ title: "Tag already exists", variant: 'destructive' });
        return;
    }

    try {
        if (editingTag) {
            const tagRef = doc(firestore, 'agencies', profile.agency_id, 'tags', editingTag.id);
            await updateDoc(tagRef, {
                name: values.name,
                color: selectedColor
            });
            toast({ title: "Tag Updated" });
            setEditingTag(null);
        } else {
            await addDoc(collection(firestore, 'agencies', profile.agency_id, 'tags'), {
                name: values.name,
                color: selectedColor,
                agency_id: profile.agency_id,
                createdAt: new Date().toISOString(),
            });
            toast({ title: "Tag Created" });
        }
        form.reset();
    } catch (error) {
        toast({ title: "Error", description: "Could not save tag.", variant: 'destructive' });
    }
  };

  const handleEditClick = (tag: Tag) => {
    setEditingTag(tag);
    form.setValue('name', tag.name);
    setSelectedColor(tag.color);
  };

  const cancelEdit = () => {
    setEditingTag(null);
    form.reset({ name: '' });
    setSelectedColor(tagColors[0].class);
  };

  const handleDeleteTag = async (tagId: string) => {
    if (!profile.agency_id) return;
    try {
        await deleteDoc(doc(firestore, 'agencies', profile.agency_id, 'tags', tagId));
        toast({ title: "Tag Deleted" });
        if (editingTag?.id === tagId) cancelEdit();
    } catch (error) {
        toast({ title: "Error", description: "Could not delete tag.", variant: 'destructive' });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <div className="p-6 pb-2">
            <DialogHeader>
              <DialogTitle className="font-headline flex items-center gap-2"><TagIcon className="h-5 w-5" /> Manage Agency Tags</DialogTitle>
              <DialogDescription>
                {editingTag ? `Updating tag: ${editingTag.name}` : 'Create custom tags or manage existing status labels.'}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                    <div className="flex gap-2 items-end">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem className="flex-1">
                                    <FormLabel>{editingTag ? 'Update Tag Name' : 'New Tag Name'}</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. Interested, Hot Lead, Follow Up" {...field} className="h-9" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {editingTag ? (
                            <div className="flex gap-1 mb-[2px]">
                                <Button type="button" variant="outline" size="icon" onClick={cancelEdit} className="h-9 w-9"><X className="h-4 w-4" /></Button>
                                <Button type="submit" className="h-9 px-4">Update</Button>
                            </div>
                        ) : (
                            <Button type="submit" size="icon" className="mb-[2px] h-9 w-9"><Plus className="h-4 w-4" /></Button>
                        )}
                    </div>
                    <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                            {tagColors.map((color) => (
                                <button
                                    key={color.name}
                                    type="button"
                                    onClick={() => setSelectedColor(color.class)}
                                    className={cn(
                                        "h-6 w-6 rounded-full border-2 transition-all",
                                        color.class.split(' ')[0],
                                        selectedColor === color.class ? "border-primary scale-125" : "border-transparent"
                                    )}
                                    title={color.name}
                                />
                            ))}
                        </div>
                    </div>
                </form>
            </Form>
        </div>

        <Separator />

        <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-3">
                <h4 className="text-sm font-bold uppercase tracking-wider flex items-center justify-between">
                    Agency Tags
                    <span className="text-[10px] text-muted-foreground font-normal bg-muted px-2 py-0.5 rounded-full">Labels & Filters</span>
                </h4>
                <div className="rounded-xl border p-4 bg-muted/5 min-h-[150px]">
                    {isLoading ? <p className="text-center text-muted-foreground py-10">Loading tags...</p> : 
                    tags && tags.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {tags.map(tag => (
                                <Badge 
                                    key={tag.id} 
                                    className={cn(
                                        "px-3 py-1 flex items-center gap-2 pr-1 rounded-lg transition-all group", 
                                        tag.color,
                                        editingTag?.id === tag.id && "ring-2 ring-primary ring-offset-2"
                                    )}
                                >
                                    <span className="cursor-default">{tag.name}</span>
                                    <div className="flex items-center gap-0.5 ml-1">
                                        <button 
                                            onClick={() => handleEditClick(tag)}
                                            className="h-5 w-5 flex items-center justify-center rounded-full hover:bg-black/10 transition-colors"
                                        >
                                            <Edit2 className="h-3 w-3" />
                                        </button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <button className="h-5 w-5 flex items-center justify-center rounded-full hover:bg-black/10 transition-colors">
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle className="font-headline">Delete Tag?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Are you sure you want to delete the "{tag.name}" tag? This will remove it from all leads. This action cannot be undone.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteTag(tag.id)} className="bg-destructive text-white hover:bg-destructive/90">Delete Permanently</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </Badge>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                            <Info className="h-8 w-8 mb-2 opacity-20" />
                            <p className="text-sm text-center max-w-[200px]">No agency tags created yet. Add statuses like "Interested" here.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>

        <DialogFooter className="p-4 border-t bg-muted/5">
          <Button variant="secondary" onClick={() => setIsOpen(false)} className="rounded-full px-6">Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
