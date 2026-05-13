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
import { collection, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { useProfile } from '@/context/profile-context';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useMemoFirebase } from '@/firebase/hooks';
import { Trash2, Plus, Tag as TagIcon, X, Info } from 'lucide-react';
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
import { buyerStatuses } from '@/lib/data';

interface ManageTagsDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const tagColors = [
    { name: 'Blue', class: 'bg-blue-100 text-blue-700 border-blue-200' },
    { name: 'Emerald', class: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    { name: 'Amber', class: 'bg-amber-100 text-amber-700 border-amber-200' },
    { name: 'Purple', class: 'bg-purple-100 text-purple-700 border-purple-200' },
    { name: 'Red', class: 'bg-red-100 text-red-700 border-red-200' },
    { name: 'Indigo', class: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
    { name: 'Pink', class: 'bg-pink-100 text-pink-700 border-pink-200' },
    { name: 'Orange', class: 'bg-orange-100 text-orange-700 border-orange-200' },
    { name: 'Gray', class: 'bg-gray-100 text-gray-700 border-gray-200' },
];

const defaultPropertyStatuses = ['Available', 'Sold', 'Rent Out', 'Pending'];
const allDefaults = Array.from(new Set([...buyerStatuses, ...defaultPropertyStatuses])).sort();

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

  const handleAddDefault = async (name: string) => {
    if (!profile.agency_id) return;
    if (tags?.some(t => t.name.toLowerCase() === name.toLowerCase())) {
        toast({ title: `Tag "${name}" already in list.` });
        return;
    }
    try {
        await addDoc(collection(firestore, 'agencies', profile.agency_id, 'tags'), {
            name: name,
            color: tagColors[0].class, // Default blue for status tags
            agency_id: profile.agency_id,
            createdAt: new Date().toISOString(),
        });
        toast({ title: "Added to Agency Tags" });
    } catch (error) {
        toast({ title: "Error", variant: 'destructive' });
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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <div className="p-6 pb-2">
            <DialogHeader>
              <DialogTitle className="font-headline flex items-center gap-2"><TagIcon className="h-5 w-5" /> Manage Agency Tags</DialogTitle>
              <DialogDescription>Create custom tags or add default statuses as manageable tags.</DialogDescription>
            </DialogHeader>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                    <div className="flex gap-2 items-end">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem className="flex-1">
                                    <FormLabel>New Custom Tag</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g. Hot Lead" {...field} className="h-9" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" size="icon" className="mb-[2px] h-9 w-9"><Plus className="h-4 w-4" /></Button>
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

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-8">
            {/* Custom/Agency Tags Section */}
            <div className="space-y-3">
                <h4 className="text-sm font-bold uppercase tracking-wider flex items-center justify-between">
                    Agency Tags
                    <span className="text-[10px] text-muted-foreground font-normal bg-muted px-2 py-0.5 rounded-full">Used for filtering & labels</span>
                </h4>
                <div className="rounded-xl border p-4 bg-muted/5 min-h-[100px]">
                    {isLoading ? <p className="text-center text-muted-foreground py-10">Loading tags...</p> : 
                    tags && tags.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {tags.map(tag => (
                                <Badge 
                                    key={tag.id} 
                                    variant="outline" 
                                    className={cn("px-3 py-1 flex items-center gap-2 pr-1 rounded-lg transition-all hover:pr-1", tag.color)}
                                >
                                    {tag.name}
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
                                </Badge>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-20 text-muted-foreground">
                            <Info className="h-5 w-5 mb-2 opacity-20" />
                            <p className="text-xs">No custom agency tags created yet.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Default Statuses Section */}
            <div className="space-y-3">
                <h4 className="text-sm font-bold uppercase tracking-wider">Default Status Tags</h4>
                <p className="text-xs text-muted-foreground">Click "+" to add these to your Agency Tags so you can customize or remove them.</p>
                <div className="flex flex-wrap gap-2 p-4 border border-dashed rounded-xl bg-muted/5">
                    {allDefaults.map(name => {
                        const isAdded = tags?.some(t => t.name === name);
                        return (
                            <Badge 
                                key={name} 
                                variant="outline" 
                                className={cn(
                                    "px-3 py-1 flex items-center gap-2 rounded-lg transition-all",
                                    isAdded ? "opacity-30 grayscale pointer-events-none" : "hover:bg-primary/5 cursor-pointer border-primary/20 text-primary"
                                )}
                                onClick={() => !isAdded && handleAddDefault(name)}
                            >
                                {name}
                                {!isAdded && <Plus className="h-3 w-3" />}
                                {isAdded && <Check className="h-3 w-3" />}
                            </Badge>
                        );
                    })}
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

// Helper icons
function Check({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="20 6 9 17 4 12"/></svg>
    )
}
