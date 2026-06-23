
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

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline">
            {memberToEdit ? 'Edit Team Member' : 'Invite New Member'}
          </DialogTitle>
          <DialogDescription>
            {memberToEdit ? "Update the member's details below." : 'Fill in the details to invite a new member to your agency.'}
          </DialogDescription>
        </DialogHeader>
        <AddTeamMemberForm 
            setDialogOpen={setIsOpen} 
            memberToEdit={memberToEdit}
            onRoleChange={() => {}}
        />
      </DialogContent>
    </Dialog>
  );
}
