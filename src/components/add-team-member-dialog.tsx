
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { AddTeamMemberForm } from './add-team-member-form';
import type { User } from '@/lib/types';
import { useState } from 'react';

interface AddTeamMemberDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  memberToEdit?: User | null;
}

export function AddTeamMemberDialog({ isOpen, setIsOpen, memberToEdit }: AddTeamMemberDialogProps) {
  const [selectedRole, setSelectedRole] = useState(memberToEdit?.role || 'Agent');

  const getTitle = () => {
    if (memberToEdit) return 'Edit Team Member';
    if (selectedRole === 'Video Recorder') return 'Create New Account';
    return 'Invite New Member';
  }

  const getDescription = () => {
    if (memberToEdit) return "Update the member's details below.";
    if (selectedRole === 'Video Recorder') return "Create a new account for your Video Recorder. They can log in with this email and password.";
    return 'Fill in the details to invite a new member to your agency.';
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline">
            {getTitle()}
          </DialogTitle>
          <DialogDescription>
            {getDescription()}
          </DialogDescription>
        </DialogHeader>
        <AddTeamMemberForm 
            setDialogOpen={setIsOpen} 
            memberToEdit={memberToEdit}
            onRoleChange={setSelectedRole}
        />
      </DialogContent>
    </Dialog>
  );
}
