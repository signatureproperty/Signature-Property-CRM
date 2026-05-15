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
import type { User, Property, Buyer } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { Shield, User as UserIcon, Camera, PlayCircle, CheckCheck, VideoOff, Sigma, Building2, Users, Wallet, Key, Landmark, ShieldAlert } from 'lucide-react';
import { useMemo } from 'react';
import { Card, CardContent } from './ui/card';
import { Separator } from './ui/separator';
import { cn } from '@/lib/utils';
import { ScrollArea } from './ui/scroll-area';

interface TeamMemberDetailsDialogProps {
  member: User;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  properties: Property[];
  buyers: Buyer[];
}

const roleConfig: Record<string, { icon: React.ReactNode, color: string }> = {
    Admin: { icon: <Shield className="h-4 w-4" />, color: 'bg-red-500/10 text-red-500' },
    Agent: { icon: <UserIcon className="h-4 w-4" />, color: 'bg-green-500/10 text-green-500' },
    'Video Recorder': { icon: <Camera className="h-4 w-4" />, color: 'bg-orange-500/10 text-orange-500' },
    'Super Admin': { icon: <ShieldAlert className="h-4 w-4" />, color: 'bg-purple-500/10 text-purple-500' },
};

const StatCard = ({ icon, label, value, subLabel, colorClass }: { icon: React.ReactNode, label: string, value: number, subLabel?: string, colorClass?: string }) => (
    <Card className="overflow-hidden border-none bg-muted/30">
        <CardContent className="p-4 flex items-center gap-4">
            <div className={`p-3 rounded-xl ${colorClass || 'bg-background text-muted-foreground'} shadow-sm`}>
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-2xl font-black font-headline leading-tight">{value}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">{label}</div>
                {subLabel && <div className="text-[9px] font-medium text-primary/70">{subLabel}</div>}
            </div>
        </CardContent>
    </Card>
);

export function TeamMemberDetailsDialog({
  member,
  isOpen,
  setIsOpen,
  properties,
  buyers,
}: TeamMemberDetailsDialogProps) {

    const stats = useMemo(() => {
        const uid = member.user_id || member.id;
        
        // Properties assigned to this member
        const assignedProperties = properties.filter(p => 
            Array.isArray(p.assignedTo) ? p.assignedTo.includes(uid) : p.assignedTo === uid
        );
        
        // Buyers assigned to this member
        const assignedBuyers = buyers.filter(b => b.assignedTo === uid);

        if (member.role === 'Video Recorder') {
            return {
                totalAssigned: assignedProperties.length,
                pendingRecording: assignedProperties.filter(p => !p.is_recorded).length,
                inEditing: assignedProperties.filter(p => p.is_recorded && p.editing_status === 'In Editing').length,
                editingComplete: assignedProperties.filter(p => p.editing_status === 'Complete').length,
            };
        }

        // Agent stats
        return {
            totalProperties: assignedProperties.length,
            saleProperties: assignedProperties.filter(p => !p.is_for_rent).length,
            rentProperties: assignedProperties.filter(p => p.is_for_rent).length,
            totalBuyers: assignedBuyers.length,
            saleBuyers: assignedBuyers.filter(b => b.listing_type !== 'For Rent').length,
            rentBuyers: assignedBuyers.filter(b => b.listing_type === 'For Rent').length,
        };

    }, [member, properties, buyers]);

  if (!member) return null;

  const isRecorder = member.role === 'Video Recorder';
  const isAgentOrAdmin = member.role === 'Agent' || member.role === 'Admin' || member.role === 'Super Admin';

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden rounded-2xl max-h-[90vh] flex flex-col">
        <div className="p-8 pb-4 bg-gradient-to-br from-primary/5 via-background to-background shrink-0">
          <DialogHeader className="items-center text-center space-y-4">
             <div className="relative">
                <Avatar className="h-28 w-28 border-4 border-background shadow-xl">
                    <AvatarImage src={member.avatar} className="object-cover" />
                    <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                        {member.name?.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                    <Badge className={cn("shadow-md font-bold px-3 border-0", roleConfig[member.role]?.color)}>
                        {roleConfig[member.role]?.icon}
                        <span className="ml-1.5">{member.role}</span>
                    </Badge>
                </div>
             </div>
             
             <div className="space-y-1">
                <DialogTitle className="text-3xl font-black font-headline tracking-tight">{member.name}</DialogTitle>
                <DialogDescription className="text-sm font-medium opacity-70">
                    {member.email}
                </DialogDescription>
             </div>
          </DialogHeader>
        </div>

        <Separator className="opacity-50" />

        <ScrollArea className="flex-1 overflow-y-auto px-8 py-6">
          <div className="space-y-8 pb-4">
            {isRecorder && (
                <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Camera className="h-3.5 w-3.5" /> Video Recording Performance
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <StatCard icon={<Sigma className="h-5 w-5" />} label="Total Assigned" value={(stats as any).totalAssigned} colorClass="bg-blue-500/10 text-blue-600" />
                        <StatCard icon={<VideoOff className="h-5 w-5" />} label="Pending" value={(stats as any).pendingRecording} colorClass="bg-red-500/10 text-red-600" />
                        <StatCard icon={<PlayCircle className="h-5 w-5" />} label="In Editing" value={(stats as any).inEditing} colorClass="bg-amber-500/10 text-amber-600" />
                        <StatCard icon={<CheckCheck className="h-5 w-5" />} label="Complete" value={(stats as any).editingComplete} colorClass="bg-green-500/10 text-green-600" />
                    </div>
                </div>
            )}

            {isAgentOrAdmin && (
                <div className="space-y-8">
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <Building2 className="h-3.5 w-3.5" /> Properties Portfolio
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <StatCard 
                                icon={<Landmark className="h-5 w-5" />} 
                                label="Grand Total" 
                                value={(stats as any).totalProperties} 
                                colorClass="bg-primary/10 text-primary"
                            />
                            <StatCard 
                                icon={<Wallet className="h-5 w-5" />} 
                                label="For Sale" 
                                value={(stats as any).saleProperties} 
                                subLabel="Active Listings"
                                colorClass="bg-sky-500/10 text-sky-600"
                            />
                            <StatCard 
                                icon={<Key className="h-5 w-5" />} 
                                label="For Rent" 
                                value={(stats as any).rentProperties} 
                                subLabel="Available Portions"
                                colorClass="bg-emerald-500/10 text-emerald-600"
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <Users className="h-3.5 w-3.5" /> Client Management
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <StatCard 
                                icon={<Users className="h-5 w-5" />} 
                                label="Total Leads" 
                                value={(stats as any).totalBuyers} 
                                colorClass="bg-indigo-500/10 text-indigo-600"
                            />
                            <StatCard 
                                icon={<Landmark className="h-5 w-5" />} 
                                label="Sale Buyers" 
                                value={(stats as any).saleBuyers} 
                                subLabel="Buying Leads"
                                colorClass="bg-violet-500/10 text-violet-600"
                            />
                            <StatCard 
                                icon={<Key className="h-5 w-5" />} 
                                label="Rent Buyers" 
                                value={(stats as any).rentBuyers} 
                                subLabel="Rental Inquiries"
                                colorClass="bg-teal-500/10 text-teal-600"
                            />
                        </div>
                    </div>
                </div>
            )}

            {!isRecorder && !isAgentOrAdmin && (
                 <div className="py-12 text-center">
                    <p className="text-muted-foreground font-medium">Statistics for this role will be available soon.</p>
                </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="p-6 border-t bg-muted/20 shrink-0">
          <Button className="w-full sm:w-auto rounded-full px-8 h-10 font-bold" variant="secondary" onClick={() => setIsOpen(false)}>
            Close Overview
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
