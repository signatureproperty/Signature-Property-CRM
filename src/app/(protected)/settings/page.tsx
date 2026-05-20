'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCurrency } from '@/context/currency-context';
import type { Currency } from '@/context/currency-context';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { useProfile } from '@/context/profile-context';
import React, { useState, useEffect, useRef } from 'react';
import type { ProfileData } from '@/context/profile-context';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useTheme } from 'next-themes';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Download, Upload, Server, Eye, EyeOff, AlertTriangle, Loader2, Link as LinkIcon, ChevronsUpDown, Check, Building, FileSpreadsheet, FileUp, FileDown } from 'lucide-react';
import { ResetAccountDialog } from '@/components/reset-account-dialog';
import { useFirestore, useAuth } from '@/firebase/provider';
import { useUser } from '@/firebase/auth/use-user';
import { useGetCollection } from '@/firebase/firestore/use-get-collection';
import { collection, getDocs, writeBatch, doc, updateDoc } from 'firebase/firestore';
import { useMemoFirebase } from '@/firebase/hooks';
import { EmailAuthProvider, reauthenticateWithCredential, deleteUser, updatePassword, GoogleAuthProvider, reauthenticateWithPopup } from 'firebase/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { formatPhoneNumber } from '@/lib/utils';
import { countryCodes } from '@/lib/data';
import { AvatarCropDialog } from '@/components/avatar-crop-dialog';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import type { Buyer, Property } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { uploadToR2 } from '@/lib/r2-client';

const passwordFormSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required.'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters.'),
    confirmPassword: z.string()
}).refine(data => data.newPassword === data.confirmPassword, {
    message: "New passwords don't match",
    path: ['confirmPassword']
});

type PasswordFormValues = z.infer<typeof passwordFormSchema>;


export default function SettingsPage() {
  const { currency, setCurrency } = useCurrency();
  const { profile, setProfile, isLoading: isProfileLoading } = useProfile();
  const { user } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  
  const [localProfile, setLocalProfile] = useState<ProfileData>(profile);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isDeleteAgentDialogOpen, setDeleteAgentDialogOpen] = useState(false);
  const [isDeleteAgencyDialogOpen, setDeleteAgencyDialogOpen] = useState(false);
  
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPasswordUpdating, setIsPasswordUpdating] = useState(false);
  const [countryCode, setCountryCode] = useState('+92');
  const [countryCodePopoverOpen, setCountryCodePopoverOpen] = useState(false);
  
  const [isUploading, setIsUploading] = useState(false);
  const [isAvatarCropOpen, setIsAvatarCropOpen] = useState(false);
  const [tempAvatarPreview, setTempAvatarPreview] = useState<string | null>(null);

  const [isImporting, setIsImporting] = useState(false);
  const importBuyersInputRef = useRef<HTMLInputElement>(null);
  const importPropertiesInputRef = useRef<HTMLInputElement>(null);

  const [appointmentNotifications, setAppointmentNotifications] = useState(true);

  const signInProvider = user?.providerData[0]?.providerId;
  const isPasswordSignIn = signInProvider === 'password';


  const passwordForm = useForm<PasswordFormValues>({
      resolver: zodResolver(passwordFormSchema),
      defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' }
  });

  const agencyPropertiesQuery = useMemoFirebase(() => profile.agency_id && profile.agency_id !== 'master_control' ? collection(firestore, 'agencies', profile.agency_id, 'properties') : null, [profile.agency_id, firestore]);
  const { data: agencyProperties } = useGetCollection<Property>(agencyPropertiesQuery);

  const agencyBuyersQuery = useMemoFirebase(() => profile.agency_id && profile.agency_id !== 'master_control' ? collection(firestore, 'agencies', profile.agency_id, 'buyers') : null, [profile.agency_id, firestore]);
  const { data: agencyBuyers } = useGetCollection<Buyer>(agencyBuyersQuery);

  const agencyAppointmentsQuery = useMemoFirebase(() => profile.agency_id && profile.agency_id !== 'master_control' ? collection(firestore, 'agencies', profile.agency_id, 'appointments') : null, [profile.agency_id, firestore]);
  const { data: agencyAppointments } = useGetCollection(agencyAppointmentsQuery);

  const agencyTeamMembersQuery = useMemoFirebase(() => profile.agency_id && profile.agency_id !== 'master_control' ? collection(firestore, 'agencies', profile.agency_id, 'teamMembers') : null, [profile.agency_id, firestore]);
  const { data: agencyTeamMembers } = useGetCollection(agencyTeamMembersQuery);

  useEffect(() => {
    setMounted(true);
    if (!isProfileLoading) {
        const phone = profile.phone || '';
        const phoneHasPlus = phone.startsWith('+');
        
        if (phoneHasPlus) {
            const selectedCountry = countryCodes.find(c => phone.startsWith(c.dial_code));
            if (selectedCountry) {
                setCountryCode(selectedCountry.dial_code);
                setLocalProfile({ ...profile, phone: phone.substring(selectedCountry.dial_code.length) });
            } else {
                const code = phone.substring(0, phone.search(/\d{10}$/));
                setCountryCode(code || '+92');
                setLocalProfile({ ...profile, phone: phone.substring(code.length) });
            }
        } else {
            setCountryCode('+92');
            setLocalProfile(profile);
        }
    }

    const savedAppointmentSetting = localStorage.getItem('notifications_appointments_enabled');
    setAppointmentNotifications(savedAppointmentSetting !== 'false');
  }, [profile, isProfileLoading]);


  useEffect(() => {
    localStorage.setItem('notifications_appointments_enabled', String(appointmentNotifications));
  }, [appointmentNotifications]);

  const handleAvatarUpdate = async (dataUrl: string) => {
    if (!user) return;
    
    setTempAvatarPreview(dataUrl); // Show immediate local preview
    setIsUploading(true);

    try {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        
        // Define path in R2
        const fileName = `${user.uid}_${Date.now()}.webp`;
        const filePath = `avatars/${fileName}`;
        
        // Upload to Cloudflare R2
        const downloadURL = await uploadToR2(blob, filePath);

        const batch = writeBatch(firestore);
        
        // 1. Update global user profile
        const userDocRef = doc(firestore, 'users', user.uid);
        batch.update(userDocRef, { avatar: downloadURL });

        // 2. Update Agency-specific records if applicable
        if (profile.agency_id && profile.agency_id !== 'master_control') {
            const teamMemberRef = doc(firestore, 'agencies', profile.agency_id, 'teamMembers', user.uid);
            batch.update(teamMemberRef, { avatar: downloadURL });
            
            // If the user is the Admin/Owner, update the agency root as well
            if (profile.role === 'Admin' || profile.role === 'Super Admin') {
                const agencyDocRef = doc(firestore, 'agencies', profile.agency_id);
                batch.update(agencyDocRef, { avatar: downloadURL });
            }
        }

        // 3. Update personal Agent record if applicable
        if (profile.role === 'Agent') {
            const agentDocRef = doc(firestore, 'agents', user.uid);
            batch.set(agentDocRef, { avatar: downloadURL }, { merge: true });
        }
        
        await batch.commit();
        
        // Update local context
        setProfile({ ...profile, avatar: downloadURL });
        toast({ title: 'Profile Picture Updated!' });
        
    } catch (error: any) {
        console.error('Avatar update error:', error);
        setTempAvatarPreview(null); // Revert on error
        toast({
            title: 'Update Failed',
            description: error.message || 'Could not update profile picture. Please try again.',
            variant: 'destructive',
        });
    } finally {
        setIsUploading(false);
        setIsAvatarCropOpen(false);
    }
};


  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSavingProfile(true);

    const fullPhoneNumber = localProfile.phone ? `${countryCode}${localProfile.phone.replace(/\D/g, '')}` : '';

    if (
        localProfile.name === profile.name &&
        localProfile.agencyName === profile.agencyName &&
        fullPhoneNumber === profile.phone
    ) {
        toast({ title: 'No Changes Detected', description: 'Your profile information is already up to date.'});
        setIsSavingProfile(false);
        return;
    }

    const isUserAdmin = profile.role === 'Admin' || profile.role === 'Super Admin';

    try {
        const batch = writeBatch(firestore);

        if (profile.agency_id && profile.agency_id !== 'master_control') {
            const teamMemberRef = doc(firestore, 'agencies', profile.agency_id, 'teamMembers', user.uid);
            batch.set(teamMemberRef, { name: localProfile.name, phone: fullPhoneNumber }, { merge: true });
        }

        const userDocRef = doc(firestore, 'users', user.uid);
        batch.set(userDocRef, { name: localProfile.name }, { merge: true });

        if (isUserAdmin && profile.agency_id && profile.agency_id !== 'master_control') {
            const agencyDocRef = doc(firestore, 'agencies', profile.agency_id);
            batch.set(agencyDocRef, { 
                agencyName: localProfile.agencyName, 
                name: localProfile.name, 
                phone: fullPhoneNumber 
            }, { merge: true });
        } else if (profile.role === 'Agent') {
            const agentDocRef = doc(firestore, 'agents', user.uid);
            batch.set(agentDocRef, { name: localProfile.name, phone: fullPhoneNumber }, { merge: true });
        }

        await batch.commit();

        setProfile({
            ...profile,
            name: localProfile.name,
            agencyName: localProfile.agencyName,
            phone: fullPhoneNumber
        });

        toast({
          title: 'Profile Updated',
          description: 'Your profile information has been saved successfully.',
        });
    } catch(error) {
         toast({ title: 'Error updating Profile', description: 'Could not Save Changes. Please try again.', variant: 'destructive'});
         console.error("Profile save error:", error);
    } finally {
        setIsSavingProfile(false);
    }
  };

  const handlePasswordChange = async (values: PasswordFormValues) => {
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
        toast({ title: "Error", description: "Not logged in or email not found.", variant: "destructive" });
        return;
    }
    
    setIsPasswordUpdating(true);
    const credential = EmailAuthProvider.credential(currentUser.email, values.currentPassword);
    
    try {
        await reauthenticateWithCredential(currentUser, credential);
        await updatePassword(currentUser, values.newPassword);
        toast({
            title: 'Password Updated',
            description: 'Your password has been changed successfully.',
        });
        passwordForm.reset();
    } catch (error: any) {
        console.error("Password change error:", error);
        toast({
            variant: 'destructive',
            title: 'Password Change Failed',
            description: error.code === 'auth/invalid-credential' ? 'Incorrect current password.' : 'An error occurred. Please try again.',
        });
    } finally {
        setIsPasswordUpdating(false);
    }
  };

  const handleBackup = () => {
    try {
        const dataToBackup = profile.role === 'Admin' ? {
            agencyProperties: agencyProperties || [],
            agencyBuyers: agencyBuyers || [],
            agencyAppointments: agencyAppointments || [],
            agencyTeamMembers: agencyTeamMembers || [],
            profile: profile || {},
        } : {
            profile: profile || {},
        }

        const blob = new Blob([JSON.stringify(dataToBackup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const date = new Date().toISOString().split('T')[0];
        a.download = `signaturecrm-backup-${date}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
            title: "Backup Successful",
            description: "Your data has been downloaded."
        });

    } catch (error) {
        console.error("Backup failed:", error);
        toast({
            title: "Backup Failed",
            description: "Could not create a backup. Please check console for errors.",
            variant: "destructive",
        });
    }
  };

  const handleRestore = () => {
    if (!restoreFile || !profile.agency_id) {
      toast({ title: 'No file or user session', variant: 'destructive' });
      return;
    }
  };

  const handleClearActivities = async () => {
    if (!profile.agency_id) {
        toast({ title: 'Error', description: 'Agency ID not found.', variant: 'destructive'});
        return;
    }
    const activityLogRef = collection(firestore, 'agencies', profile.agency_id, 'activityLogs');
    const querySnapshot = await getDocs(activityLogRef);
    const batch = writeBatch(firestore);
    querySnapshot.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    toast({ title: 'Activity Log Cleared', description: 'All activity records have been deleted.' });
  };
  
  const handleDeleteAgentAccount = async (password?: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
        if (isPasswordSignIn && currentUser.email && password) {
            const credential = EmailAuthProvider.credential(currentUser.email, password);
            await reauthenticateWithCredential(currentUser, credential);
        } else if (!isPasswordSignIn) {
            const provider = new GoogleAuthProvider();
            await reauthenticateWithPopup(currentUser, provider);
        }

        const batch = writeBatch(firestore);
        const agentDoc = doc(firestore, 'agents', currentUser.uid);
        batch.delete(agentDoc);

        const userDoc = doc(firestore, 'users', currentUser.uid);
        batch.delete(userDoc);
        
        if (profile.agency_id && profile.agency_id !== 'master_control') {
            const teamMemberDoc = doc(firestore, 'agencies', profile.agency_id, 'teamMembers', currentUser.uid);
            batch.delete(teamMemberDoc);
        }

        await batch.commit();
        await deleteUser(currentUser);
        
        toast({ title: "Account Deleted", description: "Your agent account has been permanently deleted." });
        window.location.href = '/login';
        
    } catch (error: any) {
        console.error("Agent account deletion error:", error);
        let description = 'An error occurred during deletion.';
        if (error.code === 'auth/invalid-credential') {
            description = 'Incorrect password.';
        } else if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
            description = 'Re-authentication cancelled. Account not deleted.';
        } else if (error.code === 'auth/requires-recent-login') {
            description = 'For security, please sign in again to delete your account.';
        }
        toast({ title: 'Deletion Failed', description, variant: 'destructive' });
        throw error;
    }
  };

  const handleDeleteAgencyAccount = async (password?: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser || !profile.agency_id || profile.agency_id === 'master_control') return;

    try {
        if (isPasswordSignIn && currentUser.email && password) {
            const credential = EmailAuthProvider.credential(currentUser.email, password);
            await reauthenticateWithCredential(currentUser, credential);
        } else if (!isPasswordSignIn) {
            const provider = new GoogleAuthProvider();
            await reauthenticateWithPopup(currentUser, provider);
        }

        const batch = writeBatch(firestore);
        const agencyId = profile.agency_id;
        
        const subCollections = ['properties', 'buyers', 'teamMembers', 'appointments', 'activityLogs'];
        for (const subCol of subCollections) {
            const querySnapshot = await getDocs(collection(firestore, 'agencies', agencyId, subCol));
            querySnapshot.forEach(doc => batch.delete(doc.ref));
        }

        const agencyDocRef = doc(firestore, 'agencies', agencyId);
        batch.delete(agencyDocRef);

        const userDocRef = doc(firestore, 'users', currentUser.uid);
        batch.delete(userDocRef);

        await batch.commit();
        await deleteUser(currentUser);
        
        toast({ title: "Agency Account Deleted", description: "Your agency and all its data have been permanently deleted." });
        window.location.href = '/login';
        
    } catch (error: any)
      {
        console.error("Agency account deletion error:", error);
        let description = 'An error occurred while deleting data.';
         if (error.code === 'auth/invalid-credential') {
            description = 'Incorrect password.';
        } else if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
            description = 'Re-authentication cancelled. Account not deleted.';
        } else if (error.code === 'auth/requires-recent-login') {
            description = 'For security, please sign in again to delete your account.';
        }
        toast({ title: 'Deletion Failed', description, variant: 'destructive' });
        throw error;
    }
  };
  
  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setLocalProfile(prev => ({...prev, [id]: value}));
  }

  const handleExportCSV = (type: 'Buyers' | 'Properties') => {
    const rawData = type === 'Buyers' ? agencyBuyers : agencyProperties;
    if (!rawData || rawData.length === 0) {
        toast({ title: `No ${type} to export.` });
        return;
    }

    const data = [...rawData]
        .filter(item => !item.is_deleted)
        .sort((a, b) => {
            const numA = parseInt(a.serial_no.split('-')[1] || '0', 10);
            const numB = parseInt(b.serial_no.split('-')[1] || '0', 10);
            return numA - numB;
        });

    let csvContent = "\ufeff"; // BOM for Excel UTF-8
    
    if (type === 'Buyers') {
        csvContent += "Serial,Name,Phone,Email,Status,Listing,Area,Type,Min Budget,Max Budget,Notes\n";
        data.forEach((b: any) => {
            const serial = `="${b.serial_no}"`;
            const name = `"${(b.name || '').replace(/"/g, '""')}"`;
            const phone = `="${b.phone || ''}"`;
            const email = `"${(b.email || '').replace(/"/g, '""')}"`;
            const status = `"${b.status || ''}"`;
            const listing = `"${b.listing_type || 'For Sale'}"`;
            const area = `"${(b.area_preference || '').replace(/"/g, '""')}"`;
            const propType = `"${b.property_type_preference || ''}"`;
            const minB = b.budget_min_amount || 0;
            const maxB = b.budget_max_amount || 0;
            const notes = `"${(b.notes || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`;
            
            csvContent += `${serial},${name},${phone},${email},${status},${listing},${area},${propType},${minB},${maxB},${notes}\n`;
        });
    } else {
        csvContent += "Serial,Title,Owner Phone,Area,Address,Type,Size,Unit,Demand,Demand Unit,Status\n";
        data.forEach((p: any) => {
            const serial = `="${p.serial_no}"`;
            const title = `"${(p.auto_title || '').replace(/"/g, '""')}"`;
            const phone = `="${p.owner_number || ''}"`;
            const area = `"${(p.area || '').replace(/"/g, '""')}"`;
            const address = `"${(p.address || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`;
            const typeVal = `"${p.property_type || ''}"`;
            const size = p.size_value || 0;
            const unit = `"${p.size_unit || ''}"`;
            const demand = p.demand_amount || 0;
            const demandUnit = `"${p.demand_unit || ''}"`;
            const status = `"${p.status || ''}"`;

            csvContent += `${serial},${title},${phone},${area},${address},${typeVal},${size},${unit},${demand},${demandUnit},${status}\n`;
        });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${profile.agencyName.replace(/\s+/g, '_')}_${type.toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: `${type} Exported Successfully` });
  }

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>, type: 'Buyers' | 'Properties') => {
    const file = e.target.files?.[0];
    if (!file || !profile.agency_id || profile.agency_id === 'master_control') return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
        const text = event.target?.result as string;
        const lines = text.split('\n');
        
        const batch = writeBatch(firestore);
        const collectionRef = collection(firestore, 'agencies', profile.agency_id, type.toLowerCase());
        
        let importCount = 0;

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const rowValues = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/); 
            
            const values = rowValues.map(v => {
                let val = v?.trim() || '';
                if (val.startsWith('=') && val.includes('"')) {
                    val = val.split('"')[1] || val;
                }
                return val.replace(/"/g, '').trim();
            });
            
            if (type === 'Buyers') {
                const [serial, name, phone, email, status, listing, area, propType, minB, maxB, notes] = values;
                if (!name || !phone) continue;
                
                const formattedPhone = formatPhoneNumber(phone);

                const newBuyerRef = doc(collectionRef);
                batch.set(newBuyerRef, {
                    serial_no: serial || `B-${(agencyBuyers?.length || 0) + i}`,
                    name,
                    phone: formattedPhone,
                    email: email || '',
                    status: status || 'New',
                    listing_type: listing || 'For Sale',
                    area_preference: area || '',
                    property_type_preference: propType || 'House',
                    budget_min_amount: Number(minB) || 0,
                    budget_max_amount: Number(maxB) || 0,
                    notes: notes || '',
                    agency_id: profile.agency_id,
                    created_by: profile.user_id,
                    created_at: new Date().toISOString(),
                    tags: [status || 'New'],
                    is_deleted: false
                });
            } else {
                const [serial, title, phone, area, address, typeVal, size, unit, demand, demandUnit, status] = values;
                if (!phone || !area) continue;

                const formattedPhone = formatPhoneNumber(phone);

                const newPropRef = doc(collectionRef);
                batch.set(newPropRef, {
                    serial_no: serial || `P-${(agencyProperties?.length || 0) + i}`,
                    auto_title: title || `${size} ${unit} ${typeVal} in ${area}`,
                    owner_number: formattedPhone,
                    area,
                    address: address || '',
                    property_type: typeVal || 'House',
                    size_value: Number(size) || 0,
                    size_unit: unit || 'Marla',
                    demand_amount: Number(demand) || 0,
                    demand_unit: demandUnit || 'Lacs',
                    status: status || 'New',
                    agency_id: profile.agency_id,
                    created_by: profile.user_id,
                    created_at: new Date().toISOString(),
                    is_for_rent: false,
                    listing_type: 'For Sale',
                    is_recorded: false,
                    tags: [status || 'New'],
                    is_deleted: false
                });
            }
            importCount++;
        }

        try {
            await batch.commit();
            toast({ title: 'Import Successful', description: `Imported ${importCount} ${type.toLowerCase()}.` });
        } catch (error) {
            toast({ title: 'Import Failed', description: 'Could not upload leads.', variant: 'destructive' });
        } finally {
            setIsImporting(false);
            if (e.target) e.target.value = '';
        }
    };
    reader.readAsText(file);
  }


  if (!mounted) {
    return null;
  }

  // Prevent flicker by not showing loader if profile already exists
  if (isProfileLoading && !profile.user_id) {
    return (
        <div className="flex h-screen items-center justify-center">
            <Loader2 className="animate-spin h-8 w-8 text-primary" />
        </div>
    );
  }

  return (
    <>
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-3xl font-black tracking-tight font-headline">Account Settings</h1>
            <p className="text-muted-foreground font-medium">Manage your {profile.role} profile and agency details.</p>
        </div>
      </div>

      <Card className="border-none shadow-xl bg-card/60 backdrop-blur-sm overflow-hidden">
        <CardHeader className="pb-4">
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Update your personal and agency identity.</CardDescription>
        </CardHeader>
        <form onSubmit={handleProfileSave}>
          <CardContent className="space-y-8">
             <div className="flex items-center gap-8">
                <div className="relative group">
                    <Avatar className="h-28 w-28 border-4 border-primary/20 shadow-2xl transition-transform hover:scale-105">
                        <AvatarImage 
                            src={tempAvatarPreview || profile.avatar} 
                            className="object-cover h-full w-full" 
                            key={profile.avatar}
                        />
                        <AvatarFallback className="bg-primary/5 text-primary text-2xl font-black">
                            {profile.name?.charAt(0)}
                        </AvatarFallback>
                    </Avatar>
                     <button 
                        type="button" 
                        onClick={() => setIsAvatarCropOpen(true)} 
                        className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-all text-white text-xs font-black uppercase tracking-widest"
                        disabled={isUploading}
                    >
                         {isUploading ? <Loader2 className="animate-spin h-6 w-6" /> : 'Change Image'}
                    </button>
                    {isUploading && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full">
                            <Loader2 className="animate-spin h-8 w-8 text-white" />
                        </div>
                    )}
                </div>
                <div className="space-y-1">
                    <h3 className="text-2xl font-black font-headline tracking-tight leading-none">{profile.name}</h3>
                    <p className="text-sm font-medium text-muted-foreground">{profile.agencyName}</p>
                    <Badge variant="outline" className="mt-1.5 uppercase text-[9px] font-black tracking-widest border-primary/30 bg-primary/5">{profile.role}</Badge>
                </div>
            </div>

            <Separator className="opacity-50" />

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest opacity-60">Full Name</Label>
                <Input id="name" value={localProfile.name || ''} onChange={handleProfileChange} className="h-11 rounded-xl bg-background/50" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agencyName" className="text-[10px] font-black uppercase tracking-widest opacity-60">Agency Name</Label>
                <Input
                  id="agencyName"
                  value={localProfile.agencyName || ''}
                  onChange={handleProfileChange}
                  disabled={profile.role === 'Agent'}
                  className="h-11 rounded-xl bg-background/50 disabled:opacity-50"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-[10px] font-black uppercase tracking-widest opacity-60">Contact Number</Label>
                 <div className="flex gap-2">
                    <Popover open={countryCodePopoverOpen} onOpenChange={setCountryCodePopoverOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" className="w-[100px] h-11 justify-between rounded-xl bg-background/50">
                            {countryCode}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[200px] p-0 rounded-2xl shadow-2xl border-none">
                            <Command>
                            <CommandInput placeholder="Search..." />
                            <CommandList>
                                <CommandEmpty>No country found.</CommandEmpty>
                                <CommandGroup>
                                {countryCodes.map((c) => (
                                    <CommandItem
                                    key={c.code}
                                    value={c.dial_code}
                                    onSelect={(v) => { setCountryCode(v); setCountryCodePopoverOpen(false); }}
                                    >
                                    <Check className={cn("mr-2 h-4 w-4", countryCode === c.dial_code ? "opacity-100" : "opacity-0")} />
                                    {c.dial_code} ({c.code})
                                    </CommandItem>
                                ))}
                                </CommandGroup>
                            </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                    <Input id="phone" value={localProfile.phone || ''} onChange={handleProfileChange} className="flex-1 h-11 rounded-xl bg-background/50" placeholder="3001234567" />
                  </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest opacity-60">Login Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="h-11 rounded-xl cursor-not-allowed bg-muted/40 border-none"
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="bg-muted/5 p-6 border-t">
            <Button type="submit" disabled={isSavingProfile} className="h-11 px-8 rounded-xl font-bold glowing-btn">
                {isSavingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Profile Changes
            </Button>
          </CardFooter>
        </form>
      </Card>
      
      {isPasswordSignIn && (
        <Card className="border-none shadow-xl bg-card/60 backdrop-blur-sm overflow-hidden">
            <CardHeader>
            <CardTitle>Account Security</CardTitle>
            <CardDescription>Secure your workspace by updating your password regularly.</CardDescription>
            </CardHeader>
            <Form {...passwordForm}>
                <form onSubmit={passwordForm.handleSubmit(handlePasswordChange)}>
                    <CardContent className="space-y-6">
                        <FormField
                            control={passwordForm.control}
                            name="currentPassword"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">Current Password</FormLabel>
                                <div className="relative">
                                <FormControl>
                                    <Input type={showCurrentPassword ? 'text' : 'password'} {...field} className="h-11 pr-12 rounded-xl bg-background/50" />
                                </FormControl>
                                <Button type="button" variant="ghost" size="icon" className="absolute inset-y-0 right-0 h-full px-3 text-muted-foreground" onClick={() => setShowCurrentPassword(!showCurrentPassword)}>{showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                                </div>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            <FormField
                                control={passwordForm.control}
                                name="newPassword"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">New Password</FormLabel>
                                    <div className="relative">
                                    <FormControl>
                                        <Input type={showNewPassword ? 'text' : 'password'} {...field} className="h-11 pr-12 rounded-xl bg-background/50" />
                                    </FormControl>
                                    <Button type="button" variant="ghost" size="icon" className="absolute inset-y-0 right-0 h-full px-3 text-muted-foreground" onClick={() => setShowNewPassword(!showNewPassword)}>{showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={passwordForm.control}
                                name="confirmPassword"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">Confirm New Password</FormLabel>
                                    <div className="relative">
                                    <FormControl>
                                        <Input type={showConfirmPassword ? 'text' : 'password'} {...field} className="h-11 pr-12 rounded-xl bg-background/50" />
                                    </FormControl>
                                    <Button type="button" variant="ghost" size="icon" className="absolute inset-y-0 right-0 h-full px-3 text-muted-foreground" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>{showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="bg-muted/5 p-6 border-t">
                        <Button type="submit" disabled={isPasswordUpdating} className="h-11 px-8 rounded-xl font-bold">
                            {isPasswordUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Update Security Key
                        </Button>
                    </CardFooter>
                </form>
            </Form>
        </Card>
      )}

      {(profile.role === 'Admin' || profile.role === 'Super Admin') && (
        <Card className="border-none shadow-xl bg-card/60 backdrop-blur-sm overflow-hidden">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-primary" /> Data Management</CardTitle>
                <CardDescription>Export your entire database or import inventory via CSV.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="p-5 rounded-2xl bg-muted/20 border border-border/40 space-y-4">
                        <h3 className="font-black text-[10px] uppercase tracking-widest text-primary flex items-center gap-2"><Building className="h-3 w-3" /> Property Inventory</h3>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" className="h-9 rounded-lg font-bold" onClick={() => handleExportCSV('Properties')}>
                                <FileDown className="mr-2 h-4 w-4" /> Export CSV
                            </Button>
                            <Button variant="outline" size="sm" className="h-9 rounded-lg font-bold" onClick={() => importPropertiesInputRef.current?.click()} disabled={isImporting}>
                                {isImporting ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <FileUp className="mr-2 h-3 w-3" />}
                                Import CSV
                            </Button>
                            <input type="file" ref={importPropertiesInputRef} className="hidden" accept=".csv" onChange={(e) => handleImportCSV(e, 'Properties')} />
                        </div>
                    </div>
                    <div className="p-5 rounded-2xl bg-muted/20 border border-border/40 space-y-4">
                        <h3 className="font-black text-[10px] uppercase tracking-widest text-indigo-600 flex items-center gap-2"><UserIcon className="h-3 w-3" /> Buyer Leads</h3>
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" className="h-9 rounded-lg font-bold" onClick={() => handleExportCSV('Buyers')}>
                                <FileDown className="mr-2 h-4 w-4" /> Export CSV
                            </Button>
                            <Button variant="outline" size="sm" className="h-9 rounded-lg font-bold" onClick={() => importBuyersInputRef.current?.click()} disabled={isImporting}>
                                {isImporting ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <FileUp className="mr-2 h-3 w-3" />}
                                Import CSV
                            </Button>
                            <input type="file" ref={importBuyersInputRef} className="hidden" accept=".csv" onChange={(e) => handleImportCSV(e, 'Buyers')} />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
      )}

      <Card className="border-none shadow-xl bg-card/60 backdrop-blur-sm overflow-hidden">
        <CardHeader>
          <CardTitle>Appearance & Preferences</CardTitle>
          <CardDescription>Customize how you interact with the Signature CRM interface.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
           <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest opacity-60">Visual Theme</Label>
              <RadioGroup
                value={theme}
                onValueChange={setTheme}
                className="grid grid-cols-3 gap-4"
              >
                {['light', 'dark', 'system'].map((t) => (
                    <div key={t} className="relative">
                        <RadioGroupItem value={t} id={`theme-${t}`} className="sr-only" />
                        <Label 
                            htmlFor={`theme-${t}`} 
                            className={cn(
                                "flex flex-col items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all hover:bg-primary/5",
                                theme === t ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border/60"
                            )}
                        >
                            {t === 'light' ? <Sun className="h-5 w-5 mb-2" /> : t === 'dark' ? <Moon className="h-5 w-5 mb-2" /> : <Server className="h-5 w-5 mb-2" />}
                            <span className="text-xs font-black uppercase tracking-tighter">{t}</span>
                        </Label>
                    </div>
                ))}
              </RadioGroup>
            </div>
            
            <Separator className="opacity-50" />
            
            <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-2">
              <div className="space-y-1.5">
                  <Label htmlFor="currency" className="text-[10px] font-black uppercase tracking-widest opacity-60">Primary Currency</Label>
                  <Select
                    value={currency}
                    onValueChange={(v: Currency) => setCurrency(v)}
                  >
                    <SelectTrigger id="currency" className="h-11 rounded-xl bg-background/50 border-border/60">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-2xl">
                      <SelectItem value="PKR">PKR - Pakistani Rupee (RS)</SelectItem>
                      <SelectItem value="USD">USD - US Dollar ($)</SelectItem>
                      <SelectItem value="AED">AED - UAE Dirham (AED)</SelectItem>
                    </SelectContent>
                  </Select>
              </div>

               <div className="space-y-1.5">
                <Label htmlFor="language" className="text-[10px] font-black uppercase tracking-widest opacity-60">Interface Language</Label>
                <Select defaultValue="en-us">
                  <SelectTrigger id="language" className="h-11 rounded-xl bg-background/50 border-border/60">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl">
                    <SelectItem value="en-us">English (Universal)</SelectItem>
                    <SelectItem value="ur-pk" disabled>Urdu (Coming Soon)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
        </CardContent>
      </Card>
      
       <Card className="border-none shadow-xl bg-card/60 backdrop-blur-sm overflow-hidden">
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Stay updated on team activities and client meetings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-2xl border border-border/60 p-5 bg-background/40">
                <div className="space-y-0.5">
                    <Label className="text-sm font-bold">Appointment Reminders</Label>
                    <p className="text-xs text-muted-foreground font-medium">Receive real-time alerts for scheduled viewings.</p>
                </div>
                <Switch checked={appointmentNotifications} onCheckedChange={setAppointmentNotifications} className="data-[state=checked]:bg-primary" />
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-border/60 p-5 bg-background/40">
                <div className="space-y-0.5">
                    <Label className="text-sm font-bold opacity-50">Lead Assignment Emails</Label>
                    <p className="text-xs text-muted-foreground font-medium">Auto-notified when a new buyer is assigned to you.</p>
                </div>
                <Switch defaultChecked disabled className="opacity-30 cursor-not-allowed" />
            </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-xl bg-card/60 backdrop-blur-sm overflow-hidden">
        <CardHeader>
            <CardTitle className="flex items-center gap-2"><LinkIcon className="h-5 w-5 text-primary" /> Connected Services</CardTitle>
            <CardDescription>Integrate external platforms with your CRM workflow.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 rounded-2xl border border-border/60 bg-background/40">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-muted rounded-xl flex items-center justify-center shadow-inner">
                        <svg width="24" height="24" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.35 12.16c0-1.53-.14-3.03-.4-4.5H12v2.73h5.24c-.24 1.74-1.3 3.23-2.94 4.22v2.28h2.95c1.72-1.58 2.7-3.9 2.7-6.73z"></path><path fill="#34A853" d="M12 22c3.27 0 6.02-1.08 8.02-2.92l-2.95-2.28c-1.08.73-2.45 1.16-4.07 1.16-3.13 0-5.78-2.1-6.73-4.96H2.2v2.36C4.14 19.83 7.8 22 12 22z"></path><path fill="#FBBC05" d="M5.27 13.75a7.1 7.1 0 0 1 0-3.5V7.89H2.2c-.68 1.35-1.05 2.85-1.05 4.36s.37 3.01 1.05 4.36l3.07-2.36z"></path><path fill="#EA4335" d="M12 5.04c1.77 0 3.35.61 4.6 1.8l2.6-2.6A11.5 11.5 0 0 0 12 2a11.95 11.95 0 0 0-9.8 5.89l3.07 2.36c.95-2.86 3.6-4.96 6.73-4.96z"></path></svg>
                    </div>
                    <div>
                        <h3 className="font-bold">Google Calendar Sync</h3>
                        <p className="text-xs text-muted-foreground font-medium">Schedule appointments directly to your phone's calendar.</p>
                    </div>
                </div>
                <Badge variant="outline" className="mt-3 sm:mt-0 font-bold uppercase tracking-widest text-[9px] border-emerald-500/30 text-emerald-600 bg-emerald-500/5">Active</Badge>
            </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-xl bg-card/60 backdrop-blur-sm overflow-hidden">
        <CardHeader>
            <CardTitle className="flex items-center gap-2"><Server className="h-5 w-5 text-primary" /> System Vault</CardTitle>
            <CardDescription>Manage backups and data recovery protocols.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="p-5 rounded-2xl bg-muted/20 border border-border/40">
                <h3 className="font-bold text-sm mb-1.5">Offline Data Backup</h3>
                <p className="text-xs text-muted-foreground font-medium mb-4">Export your entire agency structure including properties, buyers, and team activity to a JSON file.</p>
                <Button onClick={handleBackup} className="h-10 rounded-lg font-bold gap-2">
                    <Download className="h-4 w-4" /> Download Agency Backup
                </Button>
            </div>
             <div className="p-5 rounded-2xl bg-muted/20 border border-border/40">
                <h3 className="font-bold text-sm mb-1.5">System Restore</h3>
                <p className="text-xs text-muted-foreground font-medium mb-4">Overwrite all live Firestore data with an existing backup file. Proceed with extreme caution.</p>
                 <div className="flex flex-col sm:flex-row gap-3">
                    <Input 
                        id="restore-upload"
                        type="file"
                        accept=".json"
                        onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                        className="h-11 bg-background/50 border-border/60 rounded-xl"
                    />
                     <AlertDialog>
                      <AlertDialogTrigger asChild>
                         <Button variant="destructive" disabled={!restoreFile} className="h-11 px-8 rounded-xl font-bold gap-2">
                            <Upload className="h-4 w-4" /> Restore Vault
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="font-headline text-2xl font-black">Verify Data Overwrite?</AlertDialogTitle>
                          <AlertDialogDescription className="text-base">
                            Restoring will <span className="font-black text-destructive">WIPE OUT ALL LIVE DATA</span> and replace it with the backup content. This action is final.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="mt-6">
                          <AlertDialogCancel className="rounded-xl font-bold">Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleRestore} className="bg-destructive text-white rounded-xl font-bold px-8">Confirm Overwrite</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>
        </CardContent>
      </Card>

      {(profile.role === 'Admin' || profile.role === 'Super Admin') && (
        <Card className="border-2 border-destructive/20 shadow-xl bg-destructive/5 overflow-hidden">
            <CardHeader className="bg-destructive/10">
                <CardTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" /> Danger Zone</CardTitle>
                <CardDescription className="text-destructive/80 font-medium">Destructive actions that cannot be reversed. Access restricted to Admin only.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
                <div className="space-y-4">
                     <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 rounded-2xl bg-background/50 border border-destructive/10">
                        <div>
                            <h3 className="font-black text-sm text-foreground uppercase tracking-tight">Clear Activity Logs</h3>
                            <p className="text-xs text-muted-foreground font-medium">Delete all historical action records from the agency feed.</p>
                        </div>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" className="mt-3 sm:mt-0 h-9 px-6 rounded-lg font-bold">Clear Feed</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                                <AlertDialogHeader>
                                    <AlertDialogTitle className="font-headline text-2xl font-black">Clear Feed History?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-base">
                                        This deletes all event logs. Leads and listings remain untouched.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="mt-6">
                                    <AlertDialogCancel className="rounded-xl font-bold">Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleClearActivities} className="bg-destructive text-white rounded-xl font-bold px-8">Delete Logs</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 rounded-2xl bg-background/50 border border-destructive/10">
                        <div>
                            <h3 className="font-black text-sm text-foreground uppercase tracking-tight">Full System Reset</h3>
                            <p className="text-xs text-muted-foreground font-medium">Wipe properties, buyers, and team records. Login remains active.</p>
                        </div>
                        <AlertDialog>
                             <AlertDialogTrigger asChild>
                                <Button variant="destructive" className="mt-3 sm:mt-0 h-9 px-6 rounded-lg font-bold">Reset Database</Button>
                             </AlertDialogTrigger>
                             <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                                <AlertDialogHeader>
                                    <AlertDialogTitle className="font-headline text-2xl font-black text-destructive">Wipe All Agency Data?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-base">
                                        This will permanently delete every property, buyer, and team assignment. Your account will be like new.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="mt-6">
                                    <AlertDialogCancel className="rounded-xl font-bold">Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => setIsResetDialogOpen(true)} className="bg-destructive text-white rounded-xl font-bold px-8">Confirm Wipe</AlertDialogAction>
                                </AlertDialogFooter>
                             </AlertDialogContent>
                        </AlertDialog>
                    </div>
                     <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 rounded-2xl bg-destructive/10 border border-destructive/20">
                        <div>
                            <h3 className="font-black text-sm text-destructive uppercase tracking-tight">Permanent Account Deletion</h3>
                            <p className="text-xs text-destructive/80 font-medium">Destroy agency data and delete your auth user account forever.</p>
                        </div>
                        <Button variant="destructive" className="mt-3 sm:mt-0 h-9 px-6 rounded-lg font-bold" onClick={() => setDeleteAgencyDialogOpen(true)}>Delete Everything</Button>
                    </div>
                </div>
            </CardContent>
        </Card>
      )}

      {profile.role === 'Agent' && (
           <Card className="border-2 border-destructive/20 shadow-xl bg-destructive/5 overflow-hidden">
                <CardHeader className="bg-destructive/10">
                    <CardTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" /> Danger Zone</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                     <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 rounded-2xl bg-background/50 border border-destructive/10">
                        <div>
                            <h3 className="font-black text-sm text-foreground uppercase tracking-tight">Delete Agent Account</h3>
                            <p className="text-xs text-muted-foreground font-medium">Remove yourself from all agencies and delete your login profile.</p>
                        </div>
                        <Button variant="destructive" className="mt-3 sm:mt-0 h-9 px-6 rounded-lg font-bold" onClick={() => setDeleteAgentDialogOpen(true)}>Delete My Account</Button>
                    </div>
                </CardContent>
            </Card>
      )}

    </div>
    <ResetAccountDialog isOpen={isResetDialogOpen} setIsOpen={setIsResetDialogOpen} isPasswordRequired={isPasswordSignIn} />
    <DeleteConfirmationDialog 
        isOpen={isDeleteAgencyDialogOpen}
        setIsOpen={setDeleteAgencyDialogOpen}
        onConfirm={handleDeleteAgencyAccount}
        isPasswordRequired={isPasswordSignIn}
        title="Delete Agency Infrastructure?"
        description="This will permanently dismantle your entire agency data silo and delete your admin login. To confirm, enter your master key."
        nonPasswordDescription="This will dismantle your agency and delete your account. Type 'DELETE' to confirm."
    />
    <DeleteConfirmationDialog 
        isOpen={isDeleteAgentDialogOpen}
        setIsOpen={setDeleteAgentDialogOpen}
        onConfirm={handleDeleteAgentAccount}
        isPasswordRequired={isPasswordSignIn}
        title="Delete Personal Agent Account?"
        description="This will remove you from all agency team lists and delete your credentials. Enter password to finalize."
        nonPasswordDescription="Type 'DELETE' below to permanently destroy your agent profile."
    />
     <AvatarCropDialog
        isOpen={isAvatarCropOpen}
        setIsOpen={setIsAvatarCropOpen}
        onSave={handleAvatarUpdate}
        isSaving={isUploading}
    />
    </>
  );
}


function DeleteConfirmationDialog({ 
    isOpen, 
    setIsOpen, 
    onConfirm,
    isPasswordRequired,
    title,
    description,
    nonPasswordDescription,
}: { 
    isOpen: boolean, 
    setIsOpen: (open: boolean) => void, 
    onConfirm: (password?: string) => Promise<void>,
    isPasswordRequired: boolean,
    title: string,
    description: string,
    nonPasswordDescription: string
}) {
  const [password, setPassword] = useState('');
  const [confirmationText, setConfirmationText] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const canConfirm = isPasswordRequired ? password : confirmationText.toUpperCase() === 'DELETE';

  const handleConfirm = async () => {
    if (!isPasswordRequired && confirmationText.toUpperCase() !== 'DELETE') {
        setError('Please type DELETE to confirm.');
        return;
    }
    setError('');
    setIsLoading(true);
    try {
      await onConfirm(isPasswordRequired ? password : undefined);
      setIsOpen(false);
    } catch (e: any) {
       setError(e.message || 'An error occurred during deletion.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
        setPassword('');
        setConfirmationText('');
        setError('');
        setIsLoading(false);
    }
  }, [isOpen]);
  
  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogContent className="rounded-3xl border-none shadow-3xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive font-headline text-2xl font-black">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-base font-medium">
            {isPasswordRequired ? description : nonPasswordDescription}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3 py-2">
            {isPasswordRequired ? (
                <div className="space-y-1.5">
                    <Label htmlFor="delete-password">Confirm identity with password</Label>
                    <Input 
                        id="delete-password"
                        type="password"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setError(''); }}
                        placeholder="••••••••"
                        className="h-11 rounded-xl"
                    />
                </div>
            ) : (
                <div className="space-y-1.5">
                    <Label htmlFor="delete-confirm-text">Type DELETE to verify</Label>
                    <Input 
                        id="delete-confirm-text"
                        type="text"
                        value={confirmationText}
                        onChange={(e) => { setConfirmationText(e.target.value); setError(''); }}
                        placeholder="DELETE"
                        className="h-11 rounded-xl font-black"
                    />
                </div>
            )}
            {error && <p className="text-sm font-bold text-destructive animate-pulse">{error}</p>}
        </div>
        <AlertDialogFooter className="mt-4 gap-2">
          <Button variant="ghost" onClick={() => setIsOpen(false)} disabled={isLoading} className="rounded-xl font-bold h-11 px-6">Cancel</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isLoading || !canConfirm} className="rounded-xl font-bold h-11 px-8">
            {isLoading && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
            Confirm Deletion
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}