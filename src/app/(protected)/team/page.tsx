'use client';

import { useState, useMemo, Suspense, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MoreVertical, PlusCircle, Trash2, Edit, User, Shield, Camera, MoreHorizontal, UserCog, Mail, Phone, CalendarDays, ShieldAlert, AlertCircle, Loader2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AddTeamMemberDialog } from '@/components/add-team-member-dialog';
import type { User as TeamMember, UserRole, Property, Buyer, PlanName } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useProfile } from '@/context/profile-context';
import { useFirestore } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useMemoFirebase } from '@/firebase/hooks';
import { collection, doc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { TeamMemberDetailsDialog } from '@/components/team-member-details-dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const roleConfig: Record<UserRole, { icon: React.ReactNode, color: string }> = {
    Admin: { icon: <Shield className="h-4 w-4" />, color: 'bg-red-500/10 text-red-500' },
    Agent: { icon: <User className="h-4 w-4" />, color: 'bg-green-500/10 text-green-500' },
    'Video Recorder': { icon: <Camera className="h-4 w-4" />, color: 'bg-orange-500/10 text-orange-500' },
    'Super Admin': { icon: <ShieldAlert className="h-4 w-4" />, color: 'bg-purple-500/10 text-purple-500' },
};

const planLimits = {
    Basic: { properties: 25, buyers: 25, team: 1 },
    Standard: { properties: 1000, buyers: 1000, team: 10 },
    Premium: { properties: 2500, buyers: 2500, team: 30 },
};

function TeamPageContent() {
    const isMobile = useIsMobile();
    const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
    const [memberToEdit, setMemberToEdit] = useState<TeamMember | null>(null);
    const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const { toast } = useToast();
    const { profile } = useProfile();
    const firestore = useFirestore();

    const teamMembersQuery = useMemoFirebase(() => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'teamMembers') : null, [profile.agency_id, firestore]);
    const { data: teamMembers, isLoading: isMembersLoading } = useCollection<TeamMember>(teamMembersQuery);

    const propertiesQuery = useMemoFirebase(() => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'properties') : null, [profile.agency_id, firestore]);
    const { data: properties } = useCollection<Property>(propertiesQuery);
    
    const buyersQuery = useMemoFirebase(() => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'buyers') : null, [profile.agency_id, firestore]);
    const { data: buyers } = useCollection<Buyer>(buyersQuery);

    const currentPlan = (profile?.planName as PlanName) || 'Basic';
    const limit = planLimits[currentPlan]?.team || 0;
    const currentCount = teamMembers ? teamMembers.filter(m => m.role !== 'Admin').length : 0;
    const progress = limit === Infinity ? 100 : Math.min(100, (currentCount / limit) * 100);

    // --- Automatic Cleanup of Ghost Records ---
    useEffect(() => {
        if (!isMembersLoading && teamMembers && profile.role === 'Admin' && profile.agency_id) {
            const corruptedRecords = teamMembers.filter(m => !m.name || !m.email);
            if (corruptedRecords.length > 0) {
                console.log(`Cleaning up ${corruptedRecords.length} corrupted team records...`);
                const batch = writeBatch(firestore);
                corruptedRecords.forEach(m => {
                    const ref = doc(firestore, 'agencies', profile.agency_id, 'teamMembers', m.id);
                    batch.delete(ref);
                });
                batch.commit().then(() => {
                    console.log("Cleanup complete.");
                }).catch(err => console.error("Cleanup failed:", err));
            }
        }
    }, [teamMembers, isMembersLoading, profile.role, profile.agency_id, firestore]);

    const handleEdit = (member: TeamMember) => {
        setMemberToEdit(member);
        setIsAddMemberOpen(true);
    };

    const handleDelete = async (member: TeamMember) => {
        if (!profile.agency_id || !member.id) {
            toast({ title: 'Error', description: 'Could not find a valid record ID to delete.', variant: 'destructive' });
            return;
        }
        
        try {
            const memberRef = doc(firestore, 'agencies', profile.agency_id, 'teamMembers', member.id);
            await deleteDoc(memberRef);
            
            toast({
                title: 'Member Removed',
                description: `${member.name || 'Record'} has been permanently deleted.`,
                variant: 'destructive',
            });
        } catch (error: any) {
            console.error("Deletion error:", error);
            toast({ title: 'Deletion Failed', description: error.message, variant: 'destructive' });
        }
    };

    const handleCardClick = (member: TeamMember) => {
        if (!member.name && !member.email) return; 
        setSelectedMember(member);
        setIsDetailsOpen(true);
    };

    const sortedTeamMembers = useMemo(() => {
        if (!teamMembers) return [];
        
        // Safety Filter: STRICT filtering for valid members only.
        const validMembers = teamMembers.filter(m => m.id && m.name && m.email);

        const roleOrder: Record<string, number> = { 'Super Admin': 0, Admin: 1, Agent: 2, 'Video Recorder': 3 };
        return [...validMembers].sort((a, b) => {
            return (roleOrder[a.role] || 4) - (roleOrder[b.role] || 4);
        });
    }, [teamMembers]);

    const isLoading = isMembersLoading;

    const renderTable = () => (
        <Card className="p-0 overflow-hidden border-none shadow-xl">
        <Table>
            <TableHeader className="bg-muted/50">
                <TableRow>
                    <TableHead className="py-4">Member Info</TableHead>
                    <TableHead className="py-4">Role</TableHead>
                    <TableHead className="py-4">Status</TableHead>
                    <TableHead className="py-4">Joined Date</TableHead>
                    <TableHead className="text-right py-4 pr-6">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {sortedTeamMembers.map(member => {
                    const config = roleConfig[member.role] || roleConfig.Agent;
                    const isOwner = member.id === profile.user_id;
                    const status = (member.role === 'Admin' || member.role === 'Super Admin' || member.status === 'Active') ? 'Active' : 'Pending';
                    
                    const joinedSource = member.joinedAt || member.invitedAt;
                    let joinedDateStr = 'N/A';
                    if (joinedSource) {
                        try {
                            const date = joinedSource?.toDate ? joinedSource.toDate() : new Date(joinedSource);
                            joinedDateStr = format(date, 'PP');
                        } catch (e) {
                            joinedDateStr = 'N/A';
                        }
                    }
                    
                    return (
                        <TableRow key={member.id} onClick={() => handleCardClick(member)} className={cn('cursor-pointer hover:bg-accent/50 transition-colors group')}>
                            <TableCell className="font-medium py-4">
                                <div className="flex items-center gap-3">
                                    <Avatar className={cn("h-10 w-10 border border-primary/20")}>
                                        <AvatarImage src={member.avatar} />
                                        <AvatarFallback className={cn("bg-primary/5 text-primary text-xs font-bold")}>
                                            {member.name?.split(' ').map(n => n[0]).join('') || 'U'}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col">
                                        <p className={cn("font-bold group-hover:text-primary transition-colors")}>
                                            {member.name}
                                        </p>
                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Mail className="h-3 w-3" /> {member.email}
                                        </p>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell><Badge variant="outline" className={config.color}>{config.icon} <span className="ml-1.5">{member.role}</span></Badge></TableCell>
                            <TableCell>
                                <Badge variant={status === 'Active' ? 'success' : 'secondary'} className="capitalize">{status}</Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm flex items-center gap-2 py-8"><CalendarDays className="h-4 w-4" /> {joinedDateStr}</TableCell>
                            <TableCell className="text-right py-4 pr-6" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="rounded-full">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="glass-card">
                                        <DropdownMenuItem onSelect={() => handleCardClick(member) as any}>
                                            <MoreHorizontal className="mr-2 h-4 w-4" /> View Stats
                                        </DropdownMenuItem>
                                        {!isOwner && (
                                            <>
                                                <DropdownMenuItem onSelect={() => handleEdit(member) as any}>
                                                    <Edit className="mr-2 h-4 w-4" /> Edit Role
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onSelect={() => handleDelete(member) as any} className="text-destructive focus:bg-destructive focus:text-white font-bold">
                                                    <Trash2 className="mr-2 h-4 w-4" /> Remove Member
                                                </DropdownMenuItem>
                                            </>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    )
                })}
            </TableBody>
        </Table>
        </Card>
    );

    const renderCards = () => (
        <div className="space-y-4">
        {sortedTeamMembers.map(member => {
            const config = roleConfig[member.role] || roleConfig.Agent;
            const isOwner = member.id === profile.user_id;
            const status = (member.role === 'Admin' || member.role === 'Super Admin' || member.status === 'Active') ? 'Active' : 'Pending';

            const joinedSource = member.joinedAt || member.invitedAt;
            let joinedDateStr = 'N/A';
            if (joinedSource) {
                try {
                    const date = joinedSource?.toDate ? joinedSource.toDate() : new Date(joinedSource);
                    joinedDateStr = format(date, 'PP');
                } catch (e) {
                    joinedDateStr = 'N/A';
                }
            }

            return (
                <Card 
                    key={member.id} 
                    className={cn(
                        "flex flex-col hover:shadow-lg transition-all duration-300 cursor-pointer border-l-4 border-l-primary/40"
                    )}
                    onClick={() => handleCardClick(member)}
                >
                    <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
                        <Badge variant="outline" className={cn("text-[10px] font-bold", config.color)}>
                            {config.icon} <span className="ml-1.5">{member.role}</span>
                        </Badge>
                         <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2" onClick={(e) => e.stopPropagation()}>
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="glass-card">
                                 <DropdownMenuItem onSelect={() => handleCardClick(member) as any}>View Stats</DropdownMenuItem>
                                 {!isOwner && (
                                    <>
                                        <DropdownMenuItem onSelect={() => handleEdit(member) as any}>
                                            <Edit className="mr-2 h-4 w-4" /> Edit Role
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => handleDelete(member) as any} className="text-destructive font-bold">
                                            <Trash2 className="mr-2 h-4 w-4" /> Remove Member
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </CardHeader>
                    <CardContent className="p-4 pt-2">
                        <div className="flex items-center gap-3">
                            <Avatar className={cn("h-12 w-12 border-2 border-background shadow-md")}>
                                <AvatarImage src={member.avatar} />
                                <AvatarFallback className={cn("bg-primary/5 text-primary text-sm font-bold")}>
                                    {member.name?.split(' ').map(n => n[0]).join('') || '?'}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col min-w-0">
                                <CardTitle className={cn("text-lg font-bold font-headline truncate")}>
                                    {member.name}
                                </CardTitle>
                                <div className="text-xs text-muted-foreground truncate">{member.email}</div>
                            </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                           <Badge variant={status === 'Active' ? 'success' : 'secondary'} className="text-[9px] uppercase font-black tracking-widest">{status}</Badge>
                           <div className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                               <CalendarDays className="h-3 w-3" /> Joined: {joinedDateStr}
                           </div>
                        </div>
                    </CardContent>
                </Card>
            )
        })}
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight font-headline flex items-center gap-3">
                        <UserCog className="h-8 w-8 text-primary" /> Team Management
                    </h1>
                    <p className="text-muted-foreground font-medium">
                        Manage your agency experts and track their performance.
                    </p>
                </div>
                <div className="flex justify-end ml-auto w-full md:w-auto">
                    <Button className="rounded-full glowing-btn px-6 font-bold w-full md:w-auto" onClick={() => { setMemberToEdit(null); setIsAddMemberOpen(true); }}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Team Member
                    </Button>
                </div>
            </div>

            <Card className="bg-primary/5 border-primary/20 shadow-none">
                <CardContent className="p-5">
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Agency Capacity</span>
                            <span className="text-sm font-bold text-muted-foreground">{currentCount} of {limit === Infinity ? 'Unlimited' : limit} Agent Seats Used</span>
                        </div>
                        <Badge variant="outline" className="bg-background font-bold">{Math.round(progress)}%</Badge>
                    </div>
                    <Progress value={progress} className="h-2.5 bg-background" indicatorClassName="bg-gradient-to-r from-primary to-blue-500" />
                </CardContent>
            </Card>

            {isLoading ? (
                <div className="text-center py-20 text-muted-foreground">
                    <div className="flex flex-col items-center gap-4">
                        <Progress value={45} className="w-64 h-1 animate-pulse" />
                        <span className="text-sm font-medium">Loading agency team...</span>
                    </div>
                </div>
            ) : !sortedTeamMembers || sortedTeamMembers.length === 0 ? (
                 <Card className="flex items-center justify-center h-64 border-dashed border-2 bg-muted/5">
                    <div className="text-center space-y-4">
                        <div className="bg-background p-4 rounded-full w-fit mx-auto shadow-sm">
                            <UserCog className="h-8 w-8 text-muted-foreground/40" />
                        </div>
                        <div>
                            <p className="text-lg font-bold">Your team is empty</p>
                            <p className="text-muted-foreground text-sm">Start building your agency by inviting your first agent.</p>
                        </div>
                    </div>
                </Card>
            ) : (
                isMobile ? renderCards() : renderTable()
            )}

            <AddTeamMemberDialog 
                isOpen={isAddMemberOpen} 
                setIsOpen={setIsAddMemberOpen} 
                memberToEdit={memberToEdit}
            />

            {selectedMember && (
                <TeamMemberDetailsDialog 
                    isOpen={isDetailsOpen}
                    setIsOpen={setIsDetailsOpen}
                    member={selectedMember}
                    properties={properties || []}
                    buyers={buyers || []}
                />
            )}
        </div>
    );
}

export default function TeamPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-screen"><Progress value={30} className="w-48" /></div>}>
            <TeamPageContent />
        </Suspense>
    );
}
