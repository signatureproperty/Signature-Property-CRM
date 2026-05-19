
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
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { ScrollArea } from './ui/scroll-area';
import { Property, LeadNote, InboxMessage } from '@/lib/types';
import { useProfile } from '@/context/profile-context';
import { useFirestore } from '@/firebase/provider';
import { doc, updateDoc, arrayUnion, collection, addDoc, arrayRemove } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { MessageSquareText, Send, User, Clock, Calendar, Check, Eye, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';
import { PropertyDetailsDialog } from './property-details-dialog';
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
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

interface PropertyNotesDialogProps {
  property: Property;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export function PropertyNotesDialog({
  property,
  isOpen,
  setIsOpen,
}: PropertyNotesDialogProps) {
  const { profile } = useProfile();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [newNote, setNewNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Mark all notes as read by current user when dialog opens
  useEffect(() => {
    if (isOpen && property.timeline_notes && profile.agency_id) {
        const unreadNotes = property.timeline_notes.filter(n => !n.readBy?.includes(profile.user_id));
        if (unreadNotes.length > 0) {
            const updatedNotes = property.timeline_notes.map(n => ({
                ...n,
                readBy: Array.from(new Set([...(n.readBy || []), profile.user_id]))
            }));
            const propRef = doc(firestore, 'agencies', profile.agency_id, 'properties', property.id);
            updateDoc(propRef, { timeline_notes: updatedNotes });
        }
    }
  }, [isOpen, property.timeline_notes, profile.user_id, profile.agency_id, firestore, property.id]);

  const handleAddNote = async () => {
    if (!newNote.trim() || !profile.agency_id) return;

    setIsSaving(true);
    try {
        const timestamp = new Date().toISOString();
        const note: LeadNote = {
            id: crypto.randomUUID(),
            text: newNote.trim(),
            authorId: profile.user_id,
            authorName: profile.name,
            authorRole: profile.role,
            timestamp: timestamp,
            readBy: [profile.user_id]
        };

        const propRef = doc(firestore, 'agencies', profile.agency_id, 'properties', property.id);
        await updateDoc(propRef, {
            timeline_notes: arrayUnion(note),
            last_remark_at: timestamp
        });

        setNewNote('');
        toast({ title: "Remark Added" });
    } catch (error) {
        console.error("Error adding note:", error);
        toast({ title: "Failed to add remark", variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };

  const handleClearNotes = async () => {
    if (!profile.agency_id) return;
    setIsSaving(true);
    try {
        const propRef = doc(firestore, 'agencies', profile.agency_id, 'properties', property.id);
        await updateDoc(propRef, {
            timeline_notes: [],
            last_remark_at: null
        });
        toast({ title: "Remarks Cleared" });
    } catch (error) {
        console.error("Error clearing notes:", error);
        toast({ title: "Failed to clear remarks", variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };

  const handleDeleteNote = async (note: LeadNote) => {
    if (!profile.agency_id) return;
    const propRef = doc(firestore, 'agencies', profile.agency_id, 'properties', property.id);
    
    updateDoc(propRef, {
        timeline_notes: arrayRemove(note)
    }).then(() => {
        toast({ title: "Remark Deleted" });
    }).catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: propRef.path,
          operation: 'update',
          requestResourceData: { timeline_notes: 'arrayRemove' },
        });
        errorEmitter.emit('permission-error', permissionError);
    });
  };

  const sortedNotes = [...(property.timeline_notes || [])].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <>
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <div className="p-6 pb-2">
            <DialogHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-full text-primary">
                            <MessageSquareText className="h-6 w-6" />
                        </div>
                        <div>
                            <DialogTitle className="font-headline text-xl">Property Remarks</DialogTitle>
                            <DialogDescription>
                                Updates for <strong>{property.auto_title}</strong> ({property.serial_no}).
                            </DialogDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {profile.role === 'Admin' && sortedNotes.length > 0 && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 rounded-full gap-2 text-destructive hover:bg-destructive/10 font-bold px-3">
                                        <Trash2 className="h-3.5 w-3.5" /> Clear All
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="font-headline text-2xl font-black">Clear All Remarks?</AlertDialogTitle>
                                        <AlertDialogDescription className="text-base font-medium">
                                            This will permanently delete the entire update history for <strong>{property.serial_no}</strong>. This action cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="mt-6 gap-2">
                                        <AlertDialogCancel className="rounded-xl font-bold">Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleClearNotes} className="bg-destructive text-white hover:bg-destructive/90 rounded-xl font-bold px-8">Confirm & Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                        <Button variant="outline" size="sm" className="rounded-full h-8 gap-2 font-bold px-3" onClick={() => setIsDetailsOpen(true)}>
                            <Eye className="h-3.5 w-3.5" /> File
                        </Button>
                    </div>
                </div>
            </DialogHeader>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col px-6">
            <div className="flex-1 overflow-hidden border rounded-xl bg-muted/5">
                <ScrollArea className="h-[40vh] p-4">
                    {sortedNotes.length > 0 ? (
                        <div className="space-y-6 relative before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-[2px] before:bg-border/50">
                            {sortedNotes.map((note) => {
                                const otherPartySeen = note.readBy?.some(uid => uid !== note.authorId);
                                return (
                                    <div key={note.id} className="relative pl-10 group">
                                        <div className="absolute left-0 top-1 h-9 w-9 rounded-full bg-background border flex items-center justify-center z-10 shadow-sm">
                                            <User className={cn("h-4 w-4", note.authorRole === 'Admin' ? "text-primary" : "text-muted-foreground")} />
                                        </div>
                                        <div className="bg-card border rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow relative">
                                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-sm">{note.authorName}</span>
                                                    <Badge variant="outline" className="text-[9px] uppercase tracking-tighter h-4 px-1.5 font-bold">
                                                        {note.authorRole}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-medium">
                                                    {otherPartySeen && (
                                                        <span className="text-emerald-500 font-bold flex items-center gap-0.5">
                                                            <Check className="h-3 w-3" /> Seen
                                                        </span>
                                                    )}
                                                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {format(new Date(note.timestamp), 'MMM d')}</span>
                                                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {format(new Date(note.timestamp), 'p')}</span>
                                                    {profile.role === 'Admin' && (
                                                        <button 
                                                            onClick={() => handleDeleteNote(note)}
                                                            className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 p-1 text-muted-foreground hover:text-destructive"
                                                            title="Delete this remark"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                                                {note.text}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-40">
                            <MessageSquareText className="h-12 w-12 mb-2" />
                            <p className="text-sm font-medium">No remarks yet.</p>
                            <p className="text-xs">Post an update about this property below.</p>
                        </div>
                    )}
                </ScrollArea>
            </div>

            <div className="py-4 space-y-3">
                <div className="relative">
                    <Textarea 
                        placeholder="Add a property remark..." 
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        className="min-h-[100px] resize-none pr-12 rounded-xl focus-visible:ring-primary/20 bg-background"
                        disabled={isSaving}
                    />
                    <Button 
                        size="icon" 
                        className="absolute bottom-3 right-3 rounded-full h-8 w-8 shadow-lg glowing-btn" 
                        onClick={handleAddNote}
                        disabled={!newNote.trim() || isSaving}
                    >
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>

        <DialogFooter className="p-4 bg-muted/30 border-t flex justify-end">
          <Button variant="secondary" className="rounded-full px-6" onClick={() => setIsOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {isDetailsOpen && (
        <PropertyDetailsDialog 
            property={property} 
            isOpen={isDetailsOpen} 
            setIsOpen={setIsDetailsOpen} 
        />
    )}
    </>
  );
}
