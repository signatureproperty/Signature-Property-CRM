'use client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AddBuyerForm } from './add-buyer-form';
import { PlusCircle, AlertCircle } from 'lucide-react';
import type { Buyer, ListingType } from '@/lib/types';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useProfile } from '@/context/profile-context';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';

interface AddBuyerDialogProps {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    totalSaleBuyers: number;
    totalRentBuyers: number;
    buyerToEdit?: Buyer | null;
    onSave: (buyer: Omit<Buyer, 'id'>) => void;
    limitReached: boolean;
}

export function AddBuyerDialog({ 
    isOpen, 
    setIsOpen, 
    totalSaleBuyers, 
    totalRentBuyers,
    buyerToEdit, 
    onSave,
    limitReached,
}: AddBuyerDialogProps) {
    const { profile } = useProfile();
    const [localListingType, setLocalListingType] = useState<ListingType>('For Sale');

    useEffect(() => {
        if (isOpen) {
            setLocalListingType(buyerToEdit?.listing_type || 'For Sale');
        }
    }, [isOpen, buyerToEdit]);

    if (limitReached && !buyerToEdit) {
        const isAgent = profile.role === 'Agent';
        return (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><AlertCircle className="text-destructive" /> Limit Reached</DialogTitle>
                        <DialogDescription>
                            {isAgent 
                                ? "You have reached your personal limit for adding new buyers. You can still receive unlimited assigned leads from your agency."
                                : "You have reached your buyer limit for the current plan. To add more buyers, please upgrade your plan."
                            }
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
                        {!isAgent && <Button asChild><Link href="/upgrade">Upgrade Plan</Link></Button>}
                    </div>
                </DialogContent>
            </Dialog>
        )
    }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-3xl max-h-[95vh] overflow-hidden flex flex-col p-0">
        <div className="p-6 pb-2">
            <DialogHeader>
              <DialogTitle className="font-headline text-2xl">{buyerToEdit ? 'Edit Buyer' : 'Add New Buyer'}</DialogTitle>
              <DialogDescription>
                {buyerToEdit ? 'Update the details for this buyer.' : 'Fill in the details for the new buyer lead.'}
              </DialogDescription>
            </DialogHeader>

            {!buyerToEdit && (
                <div className="mt-4 flex justify-center">
                    <Tabs value={localListingType} onValueChange={(v) => setLocalListingType(v as ListingType)} className="w-full max-w-md">
                        <TabsList className="grid w-full grid-cols-2 h-12 p-1 bg-muted/50 rounded-full">
                            <TabsTrigger value="For Sale" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold">For Sale</TabsTrigger>
                            <TabsTrigger value="For Rent" className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold">For Rent</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-2">
            <AddBuyerForm 
                setDialogOpen={setIsOpen} 
                totalSaleBuyers={totalSaleBuyers} 
                totalRentBuyers={totalRentBuyers} 
                buyerToEdit={buyerToEdit} 
                onSave={onSave}
                listingType={localListingType}
            />
        </div>
      </DialogContent>
    </Dialog>
  );
}
