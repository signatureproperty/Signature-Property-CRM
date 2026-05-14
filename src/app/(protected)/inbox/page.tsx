'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useFirestore } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, doc, updateDoc, arrayUnion, writeBatch } from 'firebase/firestore';
import { useProfile } from '@/context/profile-context';
import { useMemoFirebase } from '@/firebase/hooks';
import type { InboxMessage, Property, Buyer, LeadNote } from '@/lib/types';
import { formatDistanceToNow, format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Mail, Send, User, Search, MessageSquare, ArrowLeft, Building2, Briefcase, Eye, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { PropertyDetailsDialog } from '@/components/property-details-dialog';
import { BuyerDetailsDialog } from '@/components/buyer-details-dialog';
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

interface ChatLead {
    id: string;
    type: 'Buyer' | 'Property';
    name: string;
    serial: string;
    lastMessage?: string;
    lastTimestamp?: string;
    isUnread?: boolean;
}

export default function InboxPage() {
    const { profile } = useProfile();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
    const [replyText, setReplyText] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    const [leadForDetails, setLeadForDetails] = useState<Buyer | Property | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    // Fetch all leads data to show in conversations
    const buyersQuery = useMemoFirebase(() => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'buyers') : null, [profile.agency_id, firestore]);
    const { data: buyers } = useCollection<Buyer>(buyersQuery);
    
    const propertiesQuery = useMemoFirebase(() => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'properties') : null, [profile.agency_id, firestore]);
    const { data: properties } = useCollection<Property>(propertiesQuery);

    // Group leads that have timeline notes
    const leadsWithChats = useMemo(() => {
        const leads: ChatLead[] = [];
        
        buyers?.forEach(b => {
            if (b.timeline_notes && b.timeline_notes.length > 0) {
                const last = b.timeline_notes[b.timeline_notes.length - 1];
                leads.push({
                    id: b.id,
                    type: 'Buyer',
                    name: b.name,
                    serial: b.serial_no,
                    lastMessage: last.text,
                    lastTimestamp: last.timestamp,
                    isUnread: b.timeline_notes.some(n => !n.readBy?.includes(profile.user_id))
                });
            }
        });

        properties?.forEach(p => {
            if (p.timeline_notes && p.timeline_notes.length > 0) {
                const last = p.timeline_notes[p.timeline_notes.length - 1];
                leads.push({
                    id: p.id,
                    type: 'Property',
                    name: p.auto_title,
                    serial: p.serial_no,
                    lastMessage: last.text,
                    lastTimestamp: last.timestamp,
                    isUnread: p.timeline_notes.some(n => !n.readBy?.includes(profile.user_id))
                });
            }
        });

        return leads
            .filter(l => !searchQuery || l.name.toLowerCase().includes(searchQuery.toLowerCase()) || l.serial.toLowerCase().includes(searchQuery.toLowerCase()))
            .sort((a, b) => new Date(b.lastTimestamp || 0).getTime() - new Date(a.lastTimestamp || 0).getTime());
    }, [buyers, properties, profile.user_id, searchQuery]);

    const activeLead = useMemo(() => {
        if (!selectedLeadId) return null;
        return buyers?.find(b => b.id === selectedLeadId) || properties?.find(p => p.id === selectedLeadId);
    }, [selectedLeadId, buyers, properties]);

    const messages = useMemo(() => {
        if (!activeLead) return [];
        return [...(activeLead.timeline_notes || [])].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }, [activeLead]);

    // Handle marking messages as read
    useEffect(() => {
        if (selectedLeadId && activeLead && profile.agency_id) {
            const unreadNotes = activeLead.timeline_notes?.filter(n => !n.readBy?.includes(profile.user_id));
            if (unreadNotes && unreadNotes.length > 0) {
                const updatedNotes = activeLead.timeline_notes?.map(n => ({
                    ...n,
                    readBy: Array.from(new Set([...(n.readBy || []), profile.user_id]))
                }));

                const isBuyer = 'serial_no' in activeLead && activeLead.serial_no.startsWith('B');
                const colName = isBuyer ? 'buyers' : 'properties';
                const leadRef = doc(firestore, 'agencies', profile.agency_id, colName, selectedLeadId);
                
                updateDoc(leadRef, { timeline_notes: updatedNotes });
            }
        }
    }, [selectedLeadId, activeLead, profile.user_id, profile.agency_id, firestore]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const handleSendMessage = async () => {
        if (!replyText.trim() || !profile.agency_id || !selectedLeadId || !activeLead) return;

        setIsSending(true);
        try {
            const note: LeadNote = {
                id: crypto.randomUUID(),
                text: replyText.trim(),
                authorId: profile.user_id,
                authorName: profile.name,
                authorRole: profile.role,
                timestamp: new Date().toISOString(),
                readBy: [profile.user_id]
            };

            const isBuyer = 'serial_no' in activeLead && activeLead.serial_no.startsWith('B');
            const colName = isBuyer ? 'buyers' : 'properties';
            const leadRef = doc(firestore, 'agencies', profile.agency_id, colName, selectedLeadId);
            
            await updateDoc(leadRef, {
                timeline_notes: arrayUnion(note)
            });

            setReplyText('');
        } catch (error) {
            console.error("Chat error:", error);
            toast({ title: "Failed to send", variant: "destructive" });
        } finally {
            setIsSending(false);
        }
    };

    const handleDeleteChat = async () => {
        if (!selectedLeadId || !activeLead || !profile.agency_id) return;
        
        try {
            const isBuyer = 'serial_no' in activeLead && activeLead.serial_no.startsWith('B');
            const colName = isBuyer ? 'buyers' : 'properties';
            const leadRef = doc(firestore, 'agencies', profile.agency_id, colName, selectedLeadId);
            
            await updateDoc(leadRef, { timeline_notes: [] });
            toast({ title: "Conversation Cleared" });
            setSelectedLeadId(null);
        } catch (error) {
            toast({ title: "Delete Failed", variant: "destructive" });
        }
    };

    const handleViewDetails = () => {
        if (activeLead) {
            setLeadForDetails(activeLead);
            setIsDetailsOpen(true);
        }
    };

    return (
        <div className="flex h-[calc(100vh-140px)] gap-6 overflow-hidden">
            {/* Sidebar: Lead Conversations */}
            <Card className={cn("w-full md:w-80 flex flex-col p-0 overflow-hidden", selectedLeadId && "hidden md:flex")}>
                <CardHeader className="p-4 border-b">
                    <CardTitle className="text-xl font-bold font-headline flex items-center gap-2">
                        <MessageSquare className="h-5 w-5 text-primary" /> Messages
                    </CardTitle>
                    <div className="relative mt-2">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input 
                            placeholder="Search leads..." 
                            className="pl-8 h-8 text-xs bg-muted/50 rounded-full" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <ScrollArea className="flex-1">
                    <div className="divide-y">
                        {leadsWithChats.length > 0 ? (
                            leadsWithChats.map(lead => (
                                <div 
                                    key={lead.id} 
                                    className={cn(
                                        "p-4 cursor-pointer transition-colors hover:bg-accent/50 group relative",
                                        selectedLeadId === lead.id ? "bg-primary/5 border-l-4 border-l-primary" : "border-l-4 border-l-transparent"
                                    )}
                                    onClick={() => setSelectedLeadId(lead.id)}
                                >
                                    {lead.isUnread && (
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-primary rounded-full ring-2 ring-background" />
                                    )}
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="flex items-center gap-2">
                                            {lead.type === 'Buyer' ? <Briefcase className="h-3 w-3 text-emerald-500" /> : <Building2 className="h-3 w-3 text-sky-500" />}
                                            <span className={cn("font-bold text-sm truncate max-w-[120px]", lead.isUnread && "text-primary")}>{lead.name}</span>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                            {lead.lastTimestamp ? formatDistanceToNow(new Date(lead.lastTimestamp), { addSuffix: true }) : ''}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <p className={cn("text-xs text-muted-foreground line-clamp-1 flex-1 pr-2", lead.isUnread && "font-bold text-foreground")}>
                                            {lead.lastMessage}
                                        </p>
                                        <Badge variant="outline" className="text-[9px] font-mono h-4 px-1">{lead.serial}</Badge>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-10 text-center text-muted-foreground opacity-50">
                                <Mail className="h-12 w-12 mx-auto mb-2" />
                                <p className="text-xs font-medium">No active chats.</p>
                                <p className="text-[10px]">Start a message from a Buyer or Property page.</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </Card>

            {/* Main Content: Active Chat */}
            <Card className={cn("flex-1 flex flex-col p-0 overflow-hidden", !selectedLeadId && "hidden md:flex")}>
                {activeLead ? (
                    <>
                        <div className="p-4 border-b flex items-center justify-between bg-card">
                            <div className="flex items-center gap-4">
                                <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSelectedLeadId(null)}>
                                    <ArrowLeft className="h-5 w-5" />
                                </Button>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold font-headline">{activeLead.name || (activeLead as any).auto_title}</h3>
                                        <Badge variant="outline" className="text-[10px] font-mono h-4">{(activeLead as any).serial_no}</Badge>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">
                                        {activeLead.status} • {(activeLead as any).listing_type || 'For Sale'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" className="rounded-full h-8 px-4 text-xs font-bold gap-2" onClick={handleViewDetails}>
                                    <Eye className="h-3.5 w-3.5" /> Detail
                                </Button>
                                {profile.role === 'Admin' && (
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="sm" className="rounded-full h-8 w-8 p-0 text-destructive hover:bg-destructive/10">
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Delete Chat History?</AlertDialogTitle>
                                                <AlertDialogDescription>This will clear all messages for this lead. This action cannot be undone.</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={handleDeleteChat} className="bg-destructive text-white">Delete</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                )}
                            </div>
                        </div>

                        <ScrollArea className="flex-1 p-4 bg-muted/5">
                            <div className="space-y-4">
                                {messages.map((msg, index) => {
                                    const isMe = msg.authorId === profile.user_id;
                                    return (
                                        <div key={msg.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                                            <div className="flex items-center gap-2 mb-1 px-1">
                                                {!isMe && <span className="text-[10px] font-bold text-muted-foreground">{msg.authorName} ({msg.authorRole})</span>}
                                                <span className="text-[10px] text-muted-foreground/60">{format(new Date(msg.timestamp), 'p')}</span>
                                            </div>
                                            <div className={cn(
                                                "max-w-[85%] md:max-w-[70%] p-3 rounded-2xl shadow-sm text-sm whitespace-pre-wrap leading-relaxed",
                                                isMe ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-card border rounded-tl-none"
                                            )}>
                                                {msg.text}
                                            </div>
                                        </div>
                                    );
                                })}
                                <div ref={scrollRef} />
                            </div>
                        </ScrollArea>

                        <div className="p-4 border-t bg-card">
                            <div className="flex gap-3">
                                <Input 
                                    placeholder="Type a message..." 
                                    className="rounded-full bg-muted/50 border-none focus-visible:ring-primary/20"
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                    disabled={isSending}
                                />
                                <Button 
                                    size="icon" 
                                    className="rounded-full h-10 w-10 flex-shrink-0 glowing-btn" 
                                    onClick={handleSendMessage}
                                    disabled={!replyText.trim() || isSending}
                                >
                                    <Send className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-40">
                        <MessageSquare className="h-16 w-16 mb-4 text-muted-foreground" />
                        <h3 className="text-xl font-bold">Select a conversation</h3>
                        <p className="max-w-xs text-sm mt-2">Real-time messenger grouped by client context.</p>
                    </div>
                )}
            </Card>

            {leadForDetails && 'serial_no' in leadForDetails && leadForDetails.serial_no.startsWith('B') && (
                <BuyerDetailsDialog buyer={leadForDetails as Buyer} isOpen={isDetailsOpen} setIsOpen={setIsDetailsOpen} />
            )}
            {leadForDetails && 'serial_no' in leadForDetails && (leadForDetails.serial_no.startsWith('P') || leadForDetails.serial_no.startsWith('RP')) && (
                <PropertyDetailsDialog property={leadForDetails as Property} isOpen={isDetailsOpen} setIsOpen={setIsDetailsOpen} />
            )}
        </div>
    );
}