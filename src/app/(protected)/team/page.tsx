
'use client';

import { useState, useMemo, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MoreVertical, PlusCircle, Trash2, Edit, User, Shield, Camera, MoreHorizontal, UserCog } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AddTeamMemberDialog } from '@/components/add-team-member-dialog';
import type { User as TeamMember, UserRole, Property, Buyer, PlanName } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useProfile } from '@/context/profile-context';
import { useFirestore } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useMemoFirebase } from '@/firebase/hooks';
import { collection, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { TeamMemberDetailsDialog } from '@/components/team-member-details-dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';

const roleConfig: Record<UserRole, { icon: React.ReactNode, color: string }> = {
    Admin: { icon: <Shield className="h-4 w-4" />, color: 'bg-red-500/10 text-red-500' },
    Agent: { icon: <User className="h-4 w-4" />, color: 'bg-green-500/10 text-green-500' },
    'Video Recorder': { icon: <Camera className="h-4 w-4" />, color: 'bg-orange-500/10 text-orange-500' },
};

const planLimits = {
    Basic: { properties: 500, buyers: 500, team: 3 },
    Standard: { properties: 2500, buyers: 2500, team: 10 },
    Premium: { properties: Infinity, buyers: Infinity, team: Infinity },
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
    const progress = limit === Infinity ? 100 : (currentCount / limit) * 100;

    const handleEdit = (member: TeamMember) => {
        setMemberToEdit(member);
        setIsAddMemberOpen(true);
    };

    const handleDelete = async (member: TeamMember) => {
        if (!profile.agency_id || !member.id) return;
        
        const memberRef = doc(firestore, 'agencies', profile.agency_id, 'teamMembers', member.id);
        await deleteDoc(memberRef);
        
        toast({
            title: 'Member Removed',
            description: `${member.name || member.email} has been removed from the team.`,
            variant: 'destructive',
        });
    };

    const handleCardClick = (member: TeamMember) => {
        setSelectedMember(member);
        setIsDetailsOpen(true);
    };

    const sortedTeamMembers = useMemo(() => {
        if (!teamMembers) return [];
        const roleOrder: Record<string, number> = { Admin: 1, Agent: 2, 'Video Recorder': 3 };
        return [...teamMembers].sort((a, b) => {
            return (roleOrder[a.role] || 4) - (roleOrder[b.role] || 4);
        });
    }, [teamMembers]);

    const isLoading = isMembersLoading;

    const renderTable = () => (
        <Card className="p-0 overflow-hidden">
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {sortedTeamMembers.map(member => {
                    const config = roleConfig[member.role] || roleConfig.Agent;
                    const isOwner = member.id === profile.user_id;
                    const status = (member.role === 'Admin' || member.status === 'Active') ? 'Active' : 'Pending';
                    
                    return (
                        <TableRow key={member.id || member.email} onClick={() => handleCardClick(member)} className='cursor-pointer hover:bg-accent/50'>
                            <TableCell className="font-medium">
                                <div className="flex flex-col">
                                    <p className="font-bold">{member.name || 'Invitation Sent'}</p>
                                    <p className="text-xs text-muted-foreground">{member.email}</p>
                                </div>
                            </TableCell>
                            <TableCell><Badge variant="outline" className={config.color}>{config.icon} <span className="ml-1.5">{member.role}</span></Badge></TableCell>
                            <TableCell>
                                <Badge variant={status === 'Active' ? 'success' : 'secondary'} className="capitalize">{status}</Badge>
                            </TableCell>
                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="rounded-full">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        {!isOwner && (
                                            <>
                                                <DropdownMenuItem onSelect={() => handleEdit(member)}>
                                                    <Edit className="mr-2 h-4 w-4" /> Edit Role
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onSelect={() => handleDelete(member)} className="text-destructive">
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
            const status = (member.role === 'Admin' || member.status === 'Active') ? 'Active' : 'Pending';

            return (
                <Card 
                    key={member.id || member.email} 
                    className="flex flex-col hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => handleCardClick(member)}
                >
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <Badge variant="outline" className={config.color}>{config.icon} <span className="ml-1.5">{member.role}</span></Badge>
                         <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2" onClick={(e) => e.stopPropagation()}>
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                 {!isOwner && (
                                    <>
                                        <DropdownMenuItem onSelect={() => handleEdit(member)}>
                                            <Edit className="mr-2 h-4 w-4" /> Edit Role
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => handleDelete(member)} className="text-destructive">
                                            <Trash2 className="mr-2 h-4 w-4" /> Remove Member
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-1">
                        <CardTitle className="text-lg font-bold font-headline">{member.name || 'Invitation Sent'}</CardTitle>
                        <CardDescription>{member.email}</CardDescription>
                        <div className="mt-2">
                           <Badge variant={status === 'Active' ? 'success' : 'secondary'} className="text-[10px] uppercase font-bold">{status}</Badge>
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
                    <h1 className="text-3xl font-bold tracking-tight font-headline flex items-center gap-2">
                        <UserCog /> Team Management
                    </h1>
                    <p className="text-muted-foreground">
                        Invite agents or create video recorder accounts for your agency.
                    </p>
                </div>
                <div className="flex justify-end ml-auto">
                    <Button className="rounded-full glowing-btn" onClick={() => { setMemberToEdit(null); setIsAddMemberOpen(true); }}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Team Member
                    </Button>
                </div>
            </div>

            <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Plan Usage (Agent Seats)</span>
                        <span className="text-sm font-bold">{currentCount} / {limit === Infinity ? 'Unlimited' : limit}</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                </CardContent>
            </Card>

            {isLoading ? (
                <div className="text-center py-20 text-muted-foreground">Loading team members...</div>
            ) : !sortedTeamMembers || sortedTeamMembers.length === 0 ? (
                 <Card className="flex items-center justify-center h-64 border-dashed bg-muted/20">
                    <div className="text-center">
                        <p className="text-lg font-medium">Your team is empty</p>
                        <p className="text-muted-foreground">Click "Add Team Member" to invite your first agent.</p>
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
                />
            )}
        </div>
    );
}

export default function TeamPage() {
    return (
        <Suspense fallback={<div className="text-center py-20 text-muted-foreground">Loading team...</div>}>
            <TeamPageContent />
        </Suspense>
    );
}
