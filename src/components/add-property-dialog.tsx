'use client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AddSalePropertyForm } from './add-sale-property-form';
import { AddRentPropertyForm } from './add-rent-property-form';
import { AlertCircle } from 'lucide-react';
import type { Property, ListingType } from '@/lib/types';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useProfile } from '@/context/profile-context';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';

interface AddPropertyDialogProps {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    onSave: (property: Omit<Property, 'id'> & { id?: string }) => void;
    propertyToEdit: Property | null;
    allProperties: Property[];
    listingType: ListingType;
    limitReached: boolean;
}

export function AddPropertyDialog({ isOpen, setIsOpen, onSave, propertyToEdit, allProperties, listingType, limitReached }: AddPropertyDialogProps) {
    const { profile } = useProfile();
    const [localListingType, setLocalListingType] = useState<ListingType>(listingType);

    useEffect(() => {
        if (isOpen) {
            setLocalListingType(propertyToEdit?.listing_type || listingType);
        }
    }, [isOpen, listingType, propertyToEdit]);

    const totalSaleProperties = useMemo(() => {
        return allProperties.filter(p => p.listing_type === 'For Sale').length;
    }, [allProperties]);

    const totalRentProperties = useMemo(() => {
        return allProperties.filter(p => p.listing_type === 'For Rent').length;
    }, [allProperties]);

    if (limitReached && !propertyToEdit) {
        const isAgent = profile.role === 'Agent';
        return (
             <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><AlertCircle className="text-destructive" /> Limit Reached</DialogTitle>
                        <DialogDescription>
                            {isAgent 
                                ? "You have reached your personal limit for adding new properties. You can still receive unlimited assigned properties from your agency."
                                : "You have reached your property limit for the current plan. To add more properties, please upgrade your plan."
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
      <DialogContent className="sm:max-w-4xl max-h-[95vh] overflow-hidden flex flex-col p-0">
        <div className="p-6 pb-2">
            <DialogHeader>
            <DialogTitle className="font-headline text-2xl">
                {propertyToEdit ? 'Edit Property' : `Add New Property`}
            </DialogTitle>
            <DialogDescription>
                {propertyToEdit ? 'Update the details for this property.' : `Fill in the details to add a new lead to your CRM.`}
            </DialogDescription>
            </DialogHeader>

            {!propertyToEdit && (
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
            {localListingType === 'For Sale' ? (
            <AddSalePropertyForm setDialogOpen={setIsOpen} onSave={onSave} propertyToEdit={propertyToEdit} totalProperties={totalSaleProperties} />
            ) : (
            <AddRentPropertyForm setDialogOpen={setIsOpen} onSave={onSave} propertyToEdit={propertyToEdit} totalProperties={totalRentProperties} />
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
