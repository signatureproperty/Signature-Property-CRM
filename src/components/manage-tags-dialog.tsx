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
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase/provider';
import { collection, addDoc, deleteDoc, doc, updateDoc, writeBatch, query, where, getDocs } from 'firebase/firestore';
import { useProfile } from '@/context/profile-context';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useMemoFirebase } from '@/firebase/hooks';
import { Trash2, Plus, Tag as TagIcon, X, Info, Edit2, RotateCcw, Users2 } from 'lucide-react';
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
  const { data: allTags, isLoading } = useCollection<Tag>(tagsQuery);

  const tags = useMemo(() => {
    if (!allTags) return [];
    if (profile.role === 'Agent') {
      return allTags.filter(t => t.createdBy === profile.user_id);
    }
    return allTags;
  }, [allTags, profile.role, profile.user_id]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '' }
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!profile.agency_id) return;
    
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
            const tagData: any = {
                name: values.name,
                color: selectedColor,
                agency_id: profile.agency_id,
                createdAt: new Date().toISOString(),
            };
            if (profile.role === 'Agent') {
                tagData.createdBy = profile.user_id;
            }
            await addDoc(collection(firestore, 'agencies', profile.agency_id, 'tags'), tagData);
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
        const tagDoc = tags?.find((t: Tag) => t.id === tagId);
        const tagName = tagDoc?.name;
        
        await deleteDoc(doc(firestore, 'agencies', profile.agency_id, 'tags', tagId));
        
        if (tagName) {
            const buyersRef = collection(firestore, 'agencies', profile.agency_id, 'buyers');
            const q = query(buyersRef, where('tags', 'array-contains', tagName));
            const snapshot = await getDocs(q);
            
            if (!snapshot.empty) {
                const batch = writeBatch(firestore);
                snapshot.docs.forEach(buyerDoc => {
                    const buyerData = buyerDoc.data();
                    const updatedTags = (buyerData.tags || []).filter((t: string) => t !== tagName);
                    batch.update(buyerDoc.ref, { tags: updatedTags });
                });
                await batch.commit();
            }
        }
        
        toast({ title: "Tag Deleted", description: tagName ? `"${tagName}" removed from all leads` : "Tag deleted" });
        if (editingTag?.id === tagId) cancelEdit();
    } catch (error) {
        toast({ title: "Error", description: "Could not delete tag.", variant: 'destructive' });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <div className="p-6 pb-0">
            <DialogHeader>
              <DialogTitle className="font-headline flex items-center gap-2 text-2xl font-black">
                <TagIcon className="h-6 w-6 text-primary" /> {profile.role === 'Agent' ? 'My Tags' : 'Manage Agency Tags'}
              </DialogTitle>
              <DialogDescription className="font-medium text-muted-foreground flex items-center gap-1.5">
                <Users2 className="h-4 w-4" /> {profile.role === 'Agent' ? 'These tags are visible to you and the agency.' : 'Agency tags are shared with the entire team.'}
              </DialogDescription>
            </DialogHeader>

            <div className="bg-primary/5 p-5 rounded-2xl border border-primary/10 mt-4">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="flex gap-2 items-end">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem className="flex-1">
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">{editingTag ? 'Update Tag Name' : profile.role === 'Agent' ? 'Create New Tag' : 'Create New Agency Tag'}</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. Hot Lead, Urgent, Follow Up" {...field} className="h-11 rounded-xl bg-background border-border/60" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            {editingTag ? (
                                <div className="flex gap-1">
                                    <Button type="button" variant="outline" size="icon" onClick={cancelEdit} className="h-11 w-11 rounded-xl"><X className="h-4 w-4" /></Button>
                                    <Button type="submit" className="h-11 px-6 rounded-xl font-bold">Update</Button>
                                </div>
                            ) : (
                                <Button type="submit" className="h-11 px-6 rounded-xl font-bold glowing-btn">
                                    <Plus className="h-4 w-4 mr-2" /> Add Tag
                                </Button>
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
                                            "h-7 w-7 rounded-full border-2 transition-all shadow-sm",
                                            color.class.split(' ')[0],
                                            selectedColor === color.class ? "border-primary scale-110 ring-2 ring-primary/20" : "border-transparent opacity-60 hover:opacity-100"
                                        )}
                                        title={color.name}
                                    />
                                ))}
                            </div>
                        </div>
                    </form>
                </Form>
            </div>
        </div>

        <Separator className="mt-6" />

        <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center justify-between">
                    {profile.role === 'Agent' ? 'My Tags' : 'Agency Tags'}
                    <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full lowercase font-bold">{tags?.length || 0} active tags</span>
                </h4>
                <div className="rounded-2xl border border-dashed p-6 bg-muted/5 min-h-[200px]">
                    {isLoading ? <div className="flex justify-center py-20"><Plus className="animate-spin h-8 w-8 opacity-20" /></div> : 
                    tags && tags.length > 0 ? (
                        <div className="flex flex-wrap gap-3">
                            {tags.map(tag => (
                                <Badge 
                                    key={tag.id} 
                                    className={cn(
                                        "px-4 py-2 flex items-center gap-3 pr-2 rounded-xl transition-all shadow-sm border-none", 
                                        tag.color,
                                        editingTag?.id === tag.id && "ring-2 ring-primary ring-offset-2"
                                    )}
                                >
                                    <span className="font-bold text-sm">{tag.name}</span>
                                    <div className="flex items-center gap-1 ml-2 border-l border-current/20 pl-2">
                                        <button 
                                            onClick={() => handleEditClick(tag)}
                                            className="h-6 w-6 flex items-center justify-center rounded-lg hover:bg-black/10 transition-colors"
                                        >
                                            <Edit2 className="h-3.5 w-3.5" />
                                        </button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <button className="h-6 w-6 flex items-center justify-center rounded-lg hover:bg-red-500/20 text-red-600 transition-colors">
                                                    <X className="h-4 w-4" />
                                                </button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle className="font-headline text-2xl font-black tracking-tight">Delete Agency Tag?</AlertDialogTitle>
                                                    <AlertDialogDescription className="text-base">
                                                        The tag <strong className="text-foreground">"{tag.name}"</strong> will be removed from all Leads across the entire agency. This cannot be undone.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter className="mt-6">
                                                    <AlertDialogCancel className="rounded-xl font-bold">Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteTag(tag.id)} className="bg-destructive text-white hover:bg-destructive/90 rounded-xl font-bold px-8">Delete Permanently</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </Badge>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                            <TagIcon className="h-12 w-12 mb-3 opacity-10" />
                            <p className="text-sm font-bold opacity-60">{profile.role === 'Agent' ? 'You have not created any tags yet.' : 'No custom tags found for this agency.'}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>

        <DialogFooter className="p-6 border-t bg-muted/5 shrink-0">
          <Button variant="secondary" onClick={() => setIsOpen(false)} className="rounded-xl h-11 px-8 font-bold w-full sm:w-auto">Close Manager</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
