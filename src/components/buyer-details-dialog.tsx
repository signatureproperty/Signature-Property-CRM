'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Buyer, PriceUnit, SizeUnit } from '@/lib/types';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { 
  Home, 
  Tag, 
  Wallet, 
  Ruler, 
  Phone, 
  Mail, 
  FileText, 
  CalendarDays, 
  History, 
  Trash2,
  Briefcase,
  MapPin,
  Clock,
  User,
  MessageSquareText,
  Calendar,
  Check,
  Undo2,
  Loader2
} from 'lucide-react';
import { useCurrency } from '@/context/currency-context';
import { formatCurrency, formatUnit } from '@/lib/formatters';
import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
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
import { useFirestore } from '@/firebase/provider';
import { doc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useProfile } from '@/context/profile-context';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';

interface BuyerDetailsDialogProps {
  buyer: Buyer;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const DetailBox = ({ icon, label, value, className }: { icon: React.ReactNode, label: string, value: React.ReactNode, className?: string }) => {
    const isLongText = typeof value === 'string' && value.length > 25;

    return (
        <div className={cn("flex flex-col gap-1 p-3 rounded-xl bg-muted/5 border border-border/20", className)}>
            <div className="flex items-center gap-2 text-muted-foreground">
                <span className="text-primary/60">{icon}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
            </div>
            {isLongText ? (
                <Popover>
                    <PopoverTrigger asChild>
                        <div className="text-sm font-semibold truncate text-foreground cursor-pointer hover:text-primary transition-colors">
                            {value}
                        </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-4 rounded-2xl shadow-2xl border-none bg-background/95 backdrop-blur-md z-[110]">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-primary/60">
                                {icon}
                                <p className="text-[10px] font-black uppercase tracking-widest">{label}</p>
                            </div>
                            <p className="text-sm font-bold leading-relaxed text-foreground whitespace-pre-wrap">{value}</p>
                        </div>
                    </PopoverContent>
                </Popover>
            ) : (
                <div className="text-sm font-semibold truncate text-foreground">
                    {value || 'N/A'}
                </div>
            )}
        </div>
    );
};

const statusVariant = {
    'New': 'bg-blue-600',
    'Interested': 'bg-emerald-600',
    'Not Interested': 'bg-red-600',
    'Follow Up': 'bg-purple-600',
    'Visited Property': 'bg-orange-600',
    'Deal Closed': 'bg-slate-800',
    'Deal Lost': 'bg-gray-500',
} as const;

export function BuyerDetailsDialog({
  buyer,
  isOpen,
  setIsOpen,
}: BuyerDetailsDialogProps) {
  const { currency } = useCurrency();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { profile } = useProfile();
  const [isReleasing, setIsReleasing] = useState(false);
  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
  const [returnDetails, setReturnDetails] = useState({
      area_preference: '',
      budget_max_amount: 0,
      notes: ''
  });

  // Mark notes as read when details are viewed
  useEffect(() => {
    if (isOpen && buyer?.timeline_notes && profile.agency_id) {
        const unreadNotes = buyer.timeline_notes.filter(n => !n.readBy?.includes(profile.user_id));
        if (unreadNotes.length > 0) {
            const updatedNotes = buyer.timeline_notes.map(n => ({
                ...n,
                readBy: Array.from(new Set([...(n.readBy || []), profile.user_id]))
            }));
            const buyerRef = doc(firestore, 'agencies', profile.agency_id, 'buyers', buyer.id);
            updateDoc(buyerRef, { timeline_notes: updatedNotes });
        }
    }
  }, [isOpen, buyer?.timeline_notes, profile.user_id, profile.agency_id, firestore, buyer?.id]);

  useEffect(() => {
      if (isReturnDialogOpen && buyer) {
          setReturnDetails({
              area_preference: buyer.area_preference || '',
              budget_max_amount: buyer.budget_max_amount || 0,
              notes: buyer.notes || ''
          });
      }
  }, [isReturnDialogOpen, buyer]);

  const formatBudget = (minAmount?: number, minUnit?: PriceUnit, maxAmount?: number, maxUnit?: PriceUnit) => {
    if (!minAmount || !minUnit) return 'N/A';
    const minVal = formatUnit(minAmount, minUnit);
    if (!maxAmount || !maxUnit || (minAmount === maxAmount && minUnit === maxUnit)) {
      return formatCurrency(minVal, currency);
    }
    const maxVal = formatUnit(maxAmount, maxUnit);
    return `${formatCurrency(minVal, currency)} - ${formatCurrency(maxVal, currency)}`;
  };

  const formatSize = (minAmount?: number, minUnit?: SizeUnit, maxAmount?: number, maxUnit?: SizeUnit) => {
    if (!minAmount || !minUnit) return 'N/A';
    if (!maxAmount || !maxUnit || (minAmount === maxAmount && minUnit === maxUnit)) {
        return `${minAmount} ${minUnit}`;
    }
    return `${minAmount} - ${maxAmount} ${maxUnit}`;
  };

  const handleClearHistory = async () => {
    if (!buyer.agency_id) return;
    try {
        const buyerRef = doc(firestore, 'agencies', buyer.agency_id, 'buyers', buyer.id);
        await updateDoc(buyerRef, { sharedProperties: [] });
        toast({ title: "History Cleared" });
    } catch (error) {
        toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleReleaseLead = async () => {
    if (!profile.agency_id) return;
    setIsReleasing(true);
    try {
        const buyerRef = doc(firestore, 'agencies', profile.agency_id, 'buyers', buyer.id);
        
        const hasChanges = 
            returnDetails.area_preference !== buyer.area_preference ||
            returnDetails.budget_max_amount !== (buyer.budget_max_amount || 0) ||
            returnDetails.notes !== (buyer.notes || '');

        const updateData: any = { 
            assignedTo: null,
            area_preference: returnDetails.area_preference,
            budget_max_amount: returnDetails.budget_max_amount,
            notes: returnDetails.notes
        };

        await updateDoc(buyerRef, updateData);
        
        // Log activity
        const activityLogRef = collection(firestore, 'agencies', profile.agency_id, 'activityLogs');
        const actionText = hasChanges 
            ? 'updated details and returned the lead back to agency pool' 
            : 'returned the lead back to agency pool';

        await addDoc(activityLogRef, {
            userName: profile.name,
            action: actionText,
            target: buyer.name,
            targetType: 'Buyer',
            timestamp: new Date().toISOString(),
            agency_id: profile.agency_id,
        });

        toast({ title: hasChanges ? "Lead Details Updated & Returned" : "Lead Returned to Pool" });
        setIsReturnDialogOpen(false);
        setIsOpen(false);
    } catch (error) {
        toast({ title: "Error", variant: "destructive" });
    } finally {
        setIsReleasing(false);
    }
  };

  if (!buyer) return null;

  const isAssignedToMe = buyer.assignedTo === profile.user_id;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-3xl p-0 overflow-hidden rounded-2xl max-h-[95vh] flex flex-col">
          <div className="p-6 pb-2 shrink-0">
            <DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Badge variant="outline" className="font-mono text-[10px] bg-background">
                            {buyer.serial_no}
                        </Badge>
                        <Badge className={cn("text-[10px] font-bold px-2 py-0.5 text-white border-0", statusVariant[buyer.status as keyof typeof statusVariant] || 'bg-primary')}>
                            {buyer.status}
                        </Badge>
                        {buyer.is_investor && (
                            <Badge className="bg-indigo-600 text-white border-0 text-[10px] font-bold px-2 py-0.5">Investor</Badge>
                        )}
                    </div>
                </div>
                
                <div className="space-y-1">
                  <DialogTitle className="font-headline text-2xl font-extrabold tracking-tight">
                    {buyer.name}
                  </DialogTitle>
                  <DialogDescription className="flex items-center gap-3 text-sm font-medium">
                    <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5 text-primary" /> {new Date(buyer.created_at).toLocaleDateString()}</span>
                    <span className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5 text-primary" /> {buyer.listing_type || 'For Sale'}</span>
                  </DialogDescription>
                </div>

                <div className="flex items-center gap-4 py-2 px-4 bg-primary/5 rounded-xl border border-primary/10 w-fit">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase text-primary/60 tracking-wider">Budget Range</span>
                        <span className="text-xl font-black text-primary">
                            {formatBudget(buyer.budget_min_amount, buyer.budget_min_unit, buyer.budget_max_amount, buyer.budget_max_unit)}
                        </span>
                    </div>
                </div>
            </div>
          </DialogHeader>
        </div>

        <Separator className="my-2 opacity-50 shrink-0" />

        <ScrollArea className="flex-1 overflow-y-auto px-6">
          <div className="space-y-8 pb-8">
            
            <div className="space-y-3">
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <User className="h-3.5 w-3.5" /> Contact Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <DetailBox icon={<Phone className="h-3.5 w-3.5" />} label="Phone Number" value={buyer.phone} />
                  <DetailBox icon={<Mail className="h-3.5 w-3.5" />} label="Email Address" value={buyer.email || 'Not provided'} />
                </div>
            </div>

            <div className="space-y-3">
                <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5" /> Requirements
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <DetailBox icon={<MapPin className="h-3.5 w-3.5" />} label="Area Preference" value={buyer.area_preference || 'Any'} />
                  <DetailBox icon={<Tag className="h-3.5 w-3.5" />} label="Property Type" value={buyer.property_type_preference} />
                  <DetailBox icon={<Ruler className="h-3.5 w-3.5" />} label="Size Preference" value={formatSize(buyer.size_min_value, buyer.size_min_unit, buyer.size_max_value, buyer.size_max_unit)} />
                  <DetailBox icon={<Home className="h-3.5 w-3.5" />} label="City" value={buyer.city} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5" /> Requirements Note
                    </h3>
                    <div className="p-4 rounded-xl bg-muted/5 border border-border/20 text-sm">
                    {buyer.notes || 'No extra requirements specified.'}
                    </div>
                </div>

                <div className="space-y-3">
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <MessageSquareText className="h-3.5 w-3.5" /> Latest Update
                    </h3>
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 text-sm italic">
                    {buyer.timeline_notes && buyer.timeline_notes.length > 0 
                        ? buyer.timeline_notes[buyer.timeline_notes.length - 1].text 
                        : 'No lead updates yet.'}
                    </div>
                </div>
            </div>

            {buyer.timeline_notes && buyer.timeline_notes.length > 0 && (
                 <div className="space-y-3">
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <History className="h-3.5 w-3.5" /> Remarks History & Tracking
                    </h3>
                    <div className="space-y-3">
                        {buyer.timeline_notes.slice().reverse().map((note) => {
                            const otherPartySeen = note.readBy?.some(uid => uid !== note.authorId);
                            return (
                                <div key={note.id} className="p-3 rounded-lg border bg-card/50">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-xs">{note.authorName}</span>
                                            <Badge variant="outline" className="text-[9px] uppercase h-4 px-1">{note.authorRole}</Badge>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {otherPartySeen && <span className="text-[9px] text-emerald-500 font-bold flex items-center gap-0.5"><Check className="h-2.5 w-2.5"/> Seen</span>}
                                            <span className="text-[10px] text-muted-foreground">{format(new Date(note.timestamp), 'MMM d, p')}</span>
                                        </div>
                                    </div>
                                    <p className="text-sm">{note.text}</p>
                                </div>
                            );
                        })}
                    </div>
                 </div>
            )}

            {buyer.sharedProperties && buyer.sharedProperties.length > 0 && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <History className="h-3.5 w-3.5" /> Shared Properties History
                    </h3>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold text-destructive hover:bg-destructive/10">
                            <Trash2 className="mr-1 h-3 w-3" /> Clear History
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Clear History?</AlertDialogTitle>
                          <AlertDialogDescription>This will clear the list of properties you've shared with this buyer.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleClearHistory} className="bg-destructive text-destructive-foreground">Confirm</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                </div>
                <div className="border border-border/20 rounded-xl overflow-hidden bg-muted/5">
                  <Table>
                    <TableHeader className="bg-muted/10">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-[10px] uppercase font-bold h-9">Property</TableHead>
                        <TableHead className="text-[10px] uppercase font-bold h-9 text-right">Shared On</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {buyer.sharedProperties.sort((a,b) => new Date(b.sharedAt).getTime() - new Date(a.sharedAt).getTime()).map((prop, index) => (
                        <TableRow key={index} className="border-border/20">
                          <TableCell className="py-2">
                            <div className="text-sm font-medium">{prop.propertyTitle}</div>
                            <div className="text-[10px] font-mono text-muted-foreground">{prop.propertySerialNo}</div>
                          </TableCell>
                          <TableCell className="text-right py-2 text-xs text-muted-foreground">
                            {new Date(prop.sharedAt).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="p-6 border-t bg-muted/5 shrink-0 flex flex-row items-center justify-between sm:justify-between gap-4">
            <div className="flex-1">
                {isAssignedToMe && (
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="rounded-full h-10 gap-2 text-destructive border-destructive/20 hover:bg-destructive/10 font-bold px-6"
                        onClick={() => setIsReturnDialogOpen(true)}
                    >
                        <Undo2 className="h-4 w-4" /> Return Lead
                    </Button>
                )}
            </div>
            <Button variant="secondary" className="rounded-full h-10 px-10 font-bold" onClick={() => setIsOpen(false)}>
                Close
            </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Lead & Verification Dialog */}
      <Dialog open={isReturnDialogOpen} onOpenChange={setIsReturnDialogOpen}>
          <DialogContent className="sm:max-w-md border-none shadow-3xl rounded-[2rem] overflow-hidden">
              <DialogHeader>
                  <div className="mx-auto bg-destructive/10 w-12 h-12 rounded-full flex items-center justify-center mb-2">
                    <Undo2 className="text-destructive h-6 w-6" />
                  </div>
                  <DialogTitle className="text-center font-headline text-2xl font-black tracking-tight">Return Lead to Pool</DialogTitle>
                  <DialogDescription className="text-center font-medium">
                      Before returning <strong>{buyer.name}</strong>, please verify and update their requirements so others can find better matches.
                  </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                  <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Update Area Preference</Label>
                      <Input 
                        value={returnDetails.area_preference}
                        onChange={e => setReturnDetails(prev => ({ ...prev, area_preference: e.target.value }))}
                        placeholder="e.g. DHA Phase 6, Gulberg"
                        className="h-11 rounded-xl bg-muted/30"
                      />
                  </div>
                  <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Verify Max Budget</Label>
                      <div className="relative">
                        <Input 
                            type="number"
                            value={returnDetails.budget_max_amount}
                            onChange={e => setReturnDetails(prev => ({ ...prev, budget_max_amount: Number(e.target.value) }))}
                            className="h-11 rounded-xl bg-muted/30 pl-10"
                        />
                        <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                      </div>
                  </div>
                  <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Final Feedback / Notes</Label>
                      <Textarea 
                        value={returnDetails.notes}
                        onChange={e => setReturnDetails(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="Why are you returning this lead? Any new info?"
                        className="rounded-xl bg-muted/30 min-h-[100px] resize-none"
                      />
                  </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                  <Button variant="ghost" onClick={() => setIsReturnDialogOpen(false)} className="rounded-xl font-bold flex-1">Cancel</Button>
                  <Button onClick={handleReleaseLead} disabled={isReleasing} className="rounded-xl font-bold bg-destructive text-white hover:bg-destructive/90 flex-1">
                      {isReleasing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                      Confirm & Return
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </>
  );
}