
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
import { useFirestore, useAuth, useStorage } from '@/firebase/provider';
import { useUser } from '@/firebase/auth/use-user';
import { useGetCollection } from '@/firebase/firestore/use-get-collection';
import { collection, getDocs, writeBatch, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadString, getDownloadURL, uploadBytes } from 'firebase/storage';
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
  const [mounted, setMounted] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isClearActivitiesDialogOpen, setIsClearActivitiesDialogOpen] = useState(false);
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

  const agencyPropertiesQuery = useMemoFirebase(() => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'properties') : null, [profile.agency_id, firestore]);
  const { data: agencyProperties } = useGetCollection<Property>(agencyPropertiesQuery);

  const agencyBuyersQuery = useMemoFirebase(() => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'buyers') : null, [profile.agency_id, firestore]);
  const { data: agencyBuyers } = useGetCollection<Buyer>(agencyBuyersQuery);

  const agencyAppointmentsQuery = useMemoFirebase(() => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'appointments') : null, [profile.agency_id, firestore]);
  const { data: agencyAppointments } = useGetCollection(agencyAppointmentsQuery);

  const agencyTeamMembersQuery = useMemoFirebase(() => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'teamMembers') : null, [profile.agency_id, firestore]);
  const { data: agencyTeamMembers } = useGetCollection(agencyTeamMembersQuery);

  useEffect(() => {
    setMounted(true);
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

    const savedAppointmentSetting = localStorage.getItem('notifications_appointments_enabled');
    setAppointmentNotifications(savedAppointmentSetting !== 'false');
  }, [profile]);


  useEffect(() => {
    localStorage.setItem('notifications_appointments_enabled', String(appointmentNotifications));
  }, [appointmentNotifications]);

  const handleAvatarUpdate = async (dataUrl: string) => {
    if (!user) return;
    setIsUploading(true);
    const storage = getStorage();

    try {
        const filePath = `avatars/${profile.agency_id}/${user.uid}.jpg`;
        const imageRef = storageRef(storage, filePath);
        
        // Convert data URL to blob for uploading
        const response = await fetch(dataUrl);
        const blob = await response.blob();

        // Upload the blob
        await uploadBytes(imageRef, blob);
        
        // Get the public URL
        const downloadURL = await getDownloadURL(imageRef);

        const batch = writeBatch(firestore);
        const isUserAdmin = profile.role === 'Admin';
  
        // Update Firestore document(s) with the URL
        if (isUserAdmin) {
            if (profile.agency_id) {
                const agencyDocRef = doc(firestore, 'agencies', profile.agency_id);
                batch.update(agencyDocRef, { avatar: downloadURL });
                const teamMemberRef = doc(firestore, 'agencies', profile.agency_id, 'teamMembers', user.uid);
                batch.update(teamMemberRef, { avatar: downloadURL });
            }
        } else { // It's an Agent
            if (profile.agency_id) {
                const teamMemberRef = doc(firestore, 'agencies', profile.agency_id, 'teamMembers', user.uid);
                batch.update(teamMemberRef, { avatar: downloadURL });
            }
            const agentDocRef = doc(firestore, 'agents', user.uid);
            batch.update(agentDocRef, { avatar: downloadURL });
        }
        
        await batch.commit();
        
        // Update local context
        setProfile({ ...profile, avatar: downloadURL });
  
        toast({ title: 'Profile Picture Updated!' });
    } catch (error: any) {
        console.error('Avatar update error:', error);
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

    const fullPhoneNumber = localProfile.phone ? `${countryCode}${localProfile.phone.replace(/\D/g, '')}` : '';

    if (
        localProfile.name === profile.name &&
        localProfile.agencyName === profile.agencyName &&
        fullPhoneNumber === profile.phone
    ) {
        toast({ title: 'No Changes Detected', description: 'Your profile information is already up to date.'});
        return;
    }

    const isUserAdmin = profile.role === 'Admin';

    try {
        const batch = writeBatch(firestore);

        // Common updates for all roles
        if (profile.agency_id) {
            const teamMemberRef = doc(firestore, 'agencies', profile.agency_id, 'teamMembers', user.uid);
            batch.update(teamMemberRef, { name: localProfile.name, phone: fullPhoneNumber });
        }

        const userDocRef = doc(firestore, 'users', user.uid);
        batch.update(userDocRef, { name: localProfile.name });

        if (isUserAdmin && profile.agency_id) {
            const agencyDocRef = doc(firestore, 'agencies', profile.agency_id);
            batch.update(agencyDocRef, { 
                agencyName: localProfile.agencyName, 
                name: localProfile.name, 
                phone: fullPhoneNumber 
            });
        } else if (profile.role === 'Agent') {
            const agentDocRef = doc(firestore, 'agents', user.uid);
            batch.update(agentDocRef, { name: localProfile.name, phone: fullPhoneNumber });
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
         toast({ title: 'Error updating Profile', description: 'Could not Save Changes.', variant: 'destructive'});
         console.error("Profile save error:", error);
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
        
        if (profile.agency_id) {
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
    if (!currentUser || !profile.agency_id) return;

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
    const data = type === 'Buyers' ? agencyBuyers : agencyProperties;
    if (!data || data.length === 0) {
        toast({ title: `No ${type} to export.` });
        return;
    }

    // Numerical sort based on the number part of the serial (e.g., B-1, B-2, B-10)
    const sortedData = [...data].sort((a, b) => {
        const numA = parseInt(a.serial_no.split('-')[1] || '0', 10);
        const numB = parseInt(b.serial_no.split('-')[1] || '0', 10);
        return numA - numB;
    });

    let csvContent = "";
    if (type === 'Buyers') {
        csvContent = "Serial,Name,Phone,Email,Status,Listing,Area,Type,Min Budget,Max Budget,Notes\n";
        sortedData.forEach((b: any) => {
            csvContent += `${b.serial_no},"${b.name}","${b.phone}",${b.email || ''},${b.status},${b.listing_type},"${b.area_preference || ''}","${b.property_type_preference || ''}",${b.budget_min_amount || 0},${b.budget_max_amount || 0},"${(b.notes || '').replace(/"/g, '""')}"\n`;
        });
    } else {
        csvContent = "Serial,Title,Owner Phone,Area,Address,Type,Size,Unit,Demand,Demand Unit,Status\n";
        sortedData.forEach((p: any) => {
            csvContent += `${p.serial_no},"${p.auto_title}","${p.owner_number}","${p.area}","${p.address}","${p.property_type}",${p.size_value},${p.size_unit},${p.demand_amount},${p.demand_unit},${p.status}\n`;
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
    if (!file || !profile.agency_id) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
        const text = event.target?.result as string;
        const lines = text.split('\n');
        const headers = lines[0].split(',');
        
        const batch = writeBatch(firestore);
        const collectionRef = collection(firestore, 'agencies', profile.agency_id, type.toLowerCase());
        
        let importCount = 0;

        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/); // Better CSV split that handles quotes
            
            if (type === 'Buyers') {
                const [serial, name, phone, email, status, listing, area, propType, minB, maxB, notes] = values.map(v => v?.replace(/"/g, '').trim());
                if (!name || !phone) continue;
                
                // Smart number formatting
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
                const [serial, title, phone, area, address, typeVal, size, unit, demand, demandUnit, status] = values.map(v => v?.replace(/"/g, '').trim());
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


  if (!mounted || isProfileLoading) {
    return null;
  }

  if (profile.role === 'Agent') {
      return (
          <>
            <div className="space-y-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight font-headline">Agent Settings</h1>
                    <p className="text-muted-foreground">Manage your personal profile and account settings.</p>
                </div>
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Building /> Agency Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">You are currently a member of:</p>
                        <p className="text-lg font-semibold">{profile.agencyName}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>My Profile</CardTitle></CardHeader>
                    <form onSubmit={handleProfileSave}>
                        <CardContent className="space-y-6">
                            <div className="flex items-center gap-6">
                                <div className="relative group">
                                    <Avatar className="h-24 w-24 border-4 border-primary/20">
                                        <AvatarImage src={profile.avatar} className="object-cover h-full w-full" />
                                        <AvatarFallback>{profile.name?.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                     <button type="button" onClick={() => setIsAvatarCropOpen(true)} className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-white text-sm font-semibold">
                                        {isUploading ? <Loader2 className="animate-spin" /> : 'Change'}
                                    </button>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold">{profile.name}</h3>
                                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                                </div>
                            </div>
                            <Separator />
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Your Name</Label>
                                    <Input id="name" value={localProfile.name || ''} onChange={handleProfileChange} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">Account Email</Label>
                                    <Input id="email" type="email" value={user?.email || ''} disabled className="cursor-not-allowed bg-muted/50" />
                                </div>
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="phone">Phone Number</Label>
                                <div className="flex gap-2">
                                    <Popover open={countryCodePopoverOpen} onOpenChange={setCountryCodePopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" role="combobox" className="w-1/3 justify-between">
                                            {countryCode || "Code"}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Command>
                                            <CommandInput placeholder="Search code..." />
                                            <CommandList>
                                                <CommandEmpty>No country found.</CommandEmpty>
                                                <CommandGroup>
                                                {countryCodes.map((c) => (
                                                    <CommandItem
                                                    key={c.code}
                                                    value={c.dial_code}
                                                    onSelect={(currentValue) => {
                                                        setCountryCode(currentValue === countryCode ? "" : currentValue);
                                                        setCountryCodePopoverOpen(false);
                                                    }}
                                                    >
                                                    <Check className={cn("mr-2 h-4 w-4", countryCode === c.dial_code ? "opacity-100" : "opacity-0")} />
                                                    {c.dial_code} ({c.name})
                                                    </CommandItem>
                                                ))}
                                                </CommandGroup>
                                            </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                    <Input id="phone" value={localProfile.phone || ''} onChange={handleProfileChange} className="flex-1" placeholder="3001234567" />
                                </div>
                            </div>
                        </CardContent>
                         <CardFooter className="border-t px-6 py-4"><Button>Save Changes</Button></CardFooter>
                    </form>
                </Card>
                {isPasswordSignIn && (
                    <Card>
                        <CardHeader><CardTitle>Security</CardTitle><CardDescription>Change your password.</CardDescription></CardHeader>
                        <Form {...passwordForm}>
                            <form onSubmit={passwordForm.handleSubmit(handlePasswordChange)}>
                                <CardContent className="space-y-4">
                                    <FormField
                                        control={passwordForm.control}
                                        name="currentPassword"
                                        render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Current Password</FormLabel>
                                            <div className="relative">
                                            <FormControl>
                                                <Input type={showCurrentPassword ? 'text' : 'password'} {...field} className="pr-10" />
                                            </FormControl>
                                            <Button type="button" variant="ghost" size="icon" className="absolute inset-y-0 right-0 h-full px-3 text-muted-foreground" onClick={() => setShowCurrentPassword(!showCurrentPassword)}>{showCurrentPassword ? <EyeOff /> : <Eye />}</Button>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                        )}
                                    />
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <FormField
                                            control={passwordForm.control}
                                            name="newPassword"
                                            render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>New Password</FormLabel>
                                                <div className="relative">
                                                <FormControl>
                                                    <Input type={showNewPassword ? 'text' : 'password'} {...field} className="pr-10" />
                                                </FormControl>
                                                <Button type="button" variant="ghost" size="icon" className="absolute inset-y-0 right-0 h-full px-3 text-muted-foreground" onClick={() => setShowNewPassword(!showNewPassword)}>{showNewPassword ? <EyeOff /> : <Eye />}</Button>
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
                                                <FormLabel>Confirm New Password</FormLabel>
                                                <div className="relative">
                                                <FormControl>
                                                    <Input type={showConfirmPassword ? 'text' : 'password'} {...field} className="pr-10" />
                                                </FormControl>
                                                <Button type="button" variant="ghost" size="icon" className="absolute inset-y-0 right-0 h-full px-3 text-muted-foreground" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>{showConfirmPassword ? <EyeOff /> : <Eye />}</Button>
                                                </div>
                                                <FormMessage />
                                            </FormItem>
                                            )}
                                        />
                                    </div>
                                </CardContent>
                                <CardFooter className="border-t px-6 py-4">
                                    <Button type="submit" disabled={isPasswordUpdating}>
                                        {isPasswordUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Update Password
                                    </Button>
                                </CardFooter>
                            </form>
                        </Form>
                    </Card>
                )}
                 <Card className="border-destructive">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-destructive"><AlertTriangle /> Danger Zone</CardTitle>
                        <CardDescription>This action is irreversible. Please proceed with caution.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-lg bg-destructive/10">
                            <div>
                                <h3 className="font-bold">Delete Account</h3>
                                <p className="text-sm text-destructive/80">Permanently delete your agent account and all related personal data.</p>
                            </div>
                            <Button variant="destructive" className="mt-2 sm:mt-0" onClick={() => setDeleteAgentDialogOpen(true)}>Delete My Account</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
            <DeleteConfirmationDialog 
                isOpen={isDeleteAgentDialogOpen}
                setIsOpen={setDeleteAgentDialogOpen}
                onConfirm={handleDeleteAgentAccount}
                isPasswordRequired={isPasswordSignIn}
                title="Delete Your Account"
                description="This action is permanent and cannot be undone. To confirm, please enter your password."
                nonPasswordDescription="This action is permanent and cannot be undone. To confirm, please type 'DELETE' in the box below."
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

  return (
    <>
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          Settings
        </h1>
        <p className="text-muted-foreground">
          Manage your account, profile, and app settings.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>
            Update your agency and personal details here.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleProfileSave}>
          <CardContent className="space-y-6">
             <div className="flex items-center gap-6">
                <div className="relative group">
                    <Avatar className="h-24 w-24 border-4 border-primary/20">
                        <AvatarImage src={profile.avatar} className="object-cover h-full w-full" />
                        <AvatarFallback>{profile.agencyName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                     <button type="button" onClick={() => setIsAvatarCropOpen(true)} className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-white text-sm font-semibold">
                         {isUploading ? <Loader2 className="animate-spin" /> : 'Change'}
                    </button>
                </div>
                <div>
                    <h3 className="text-lg font-bold">{profile.name}</h3>
                    <p className="text-sm text-muted-foreground">{profile.agencyName}</p>
                </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="agencyName">Agency Name</Label>
                <Input
                  id="agencyName"
                  value={localProfile.agencyName || ''}
                  onChange={handleProfileChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Your Name</Label>
                <Input id="name" value={localProfile.name || ''} onChange={handleProfileChange} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                 <div className="flex gap-2">
                    <Popover open={countryCodePopoverOpen} onOpenChange={setCountryCodePopoverOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" className="w-1/3 justify-between">
                            {countryCode || "Code"}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Command>
                            <CommandInput placeholder="Search code..." />
                            <CommandList>
                                <CommandEmpty>No country found.</CommandEmpty>
                                <CommandGroup>
                                {countryCodes.map((c) => (
                                    <CommandItem
                                    key={c.code}
                                    value={c.dial_code}
                                    onSelect={(currentValue) => {
                                        setCountryCode(currentValue === countryCode ? "" : currentValue);
                                        setCountryCodePopoverOpen(false);
                                    }}
                                    >
                                    <Check className={cn("mr-2 h-4 w-4", countryCode === c.dial_code ? "opacity-100" : "opacity-0")} />
                                    {c.dial_code} ({c.name})
                                    </CommandItem>
                                ))}
                                </CommandGroup>
                            </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                    <Input id="phone" value={localProfile.phone || ''} onChange={handleProfileChange} className="flex-1" placeholder="3001234567" />
                  </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Account Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="cursor-not-allowed bg-muted/50"
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t px-6 py-4">
            <Button>Save Changes</Button>
          </CardFooter>
        </form>
      </Card>
      
      {isPasswordSignIn && (
        <Card>
            <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>
                Change your password.
            </CardDescription>
            </CardHeader>
            <Form {...passwordForm}>
                <form onSubmit={passwordForm.handleSubmit(handlePasswordChange)}>
                    <CardContent className="space-y-4">
                        <FormField
                            control={passwordForm.control}
                            name="currentPassword"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Current Password</FormLabel>
                                <div className="relative">
                                <FormControl>
                                    <Input type={showCurrentPassword ? 'text' : 'password'} {...field} className="pr-10" />
                                </FormControl>
                                <Button type="button" variant="ghost" size="icon" className="absolute inset-y-0 right-0 h-full px-3 text-muted-foreground" onClick={() => setShowCurrentPassword(!showCurrentPassword)}>{showCurrentPassword ? <EyeOff /> : <Eye />}</Button>
                                </div>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <FormField
                                control={passwordForm.control}
                                name="newPassword"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>New Password</FormLabel>
                                    <div className="relative">
                                    <FormControl>
                                        <Input type={showNewPassword ? 'text' : 'password'} {...field} className="pr-10" />
                                    </FormControl>
                                    <Button type="button" variant="ghost" size="icon" className="absolute inset-y-0 right-0 h-full px-3 text-muted-foreground" onClick={() => setShowNewPassword(!showNewPassword)}>{showNewPassword ? <EyeOff /> : <Eye />}</Button>
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
                                    <FormLabel>Confirm New Password</FormLabel>
                                    <div className="relative">
                                    <FormControl>
                                        <Input type={showConfirmPassword ? 'text' : 'password'} {...field} className="pr-10" />
                                    </FormControl>
                                    <Button type="button" variant="ghost" size="icon" className="absolute inset-y-0 right-0 h-full px-3 text-muted-foreground" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>{showConfirmPassword ? <EyeOff /> : <Eye />}</Button>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="border-t px-6 py-4">
                        <Button type="submit" disabled={isPasswordUpdating}>
                            {isPasswordUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Update Password
                        </Button>
                    </CardFooter>
                </form>
            </Form>
        </Card>
      )}

      <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileSpreadsheet /> Data Management</CardTitle>
            <CardDescription>Import and Export your Properties and Buyers data via CSV.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Properties</h3>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleExportCSV('Properties')}>
                            <FileDown className="mr-2 h-4 w-4" /> Export CSV
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => importPropertiesInputRef.current?.click()} disabled={isImporting}>
                            {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
                            Import CSV
                        </Button>
                        <input type="file" ref={importPropertiesInputRef} className="hidden" accept=".csv" onChange={(e) => handleImportCSV(e, 'Properties')} />
                    </div>
                </div>
                <div className="space-y-4">
                    <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Buyers</h3>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleExportCSV('Buyers')}>
                            <FileDown className="mr-2 h-4 w-4" /> Export CSV
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => importBuyersInputRef.current?.click()} disabled={isImporting}>
                            {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
                            Import CSV
                        </Button>
                        <input type="file" ref={importBuyersInputRef} className="hidden" accept=".csv" onChange={(e) => handleImportCSV(e, 'Buyers')} />
                    </div>
                </div>
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Customize the look and feel of the application.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
           <div className="space-y-2">
              <Label>Theme</Label>
              <RadioGroup
                value={theme}
                onValueChange={setTheme}
                className="flex flex-col space-y-1"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="light" id="theme-light" />
                  <Label htmlFor="theme-light">Light</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="dark" id="theme-dark" />
                  <Label htmlFor="theme-dark">Dark</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="system" id="theme-system" />
                  <Label htmlFor="theme-system">System</Label>
                </div>
              </RadioGroup>
            </div>
            <Separator />
            <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-3">
              <Label htmlFor="currency" className="md:col-span-1">
                Currency
              </Label>
              <div className="md:col-span-2">
                <Select
                  value={currency}
                  onValueChange={(value: Currency) => setCurrency(value)}
                >
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PKR">PKR - Pakistani Rupee</SelectItem>
                    <SelectItem value="USD">USD - US Dollar</SelectItem>
                    <SelectItem value="AED">AED - UAE Dirham</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-2 text-xs text-muted-foreground">
                  This will change the currency symbol across the app.
                </p>
              </div>
            </div>
            <Separator />
             <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-3">
              <Label htmlFor="language" className="md:col-span-1">
                Language
              </Label>
              <div className="md:col-span-2">
                <Select defaultValue="en-us">
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en-us">English (United States)</SelectItem>
                    <SelectItem value="ur-pk" disabled>Urdu (Pakistan)</SelectItem>
                  </SelectContent>
                </Select>
                 <p className="mt-2 text-xs text-muted-foreground">
                  Choose your preferred language for the interface.
                </p>
              </div>
            </div>
        </CardContent>
      </Card>
      
       <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Manage how you receive notifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                    <Label>Appointment Reminders</Label>
                    <p className="text-xs text-muted-foreground">Receive in-app reminders for upcoming appointments.</p>
                </div>
                <Switch checked={appointmentNotifications} onCheckedChange={setAppointmentNotifications} />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                    <Label>Email for new leads</Label>
                    <p className="text-xs text-muted-foreground">Receive an email every time a new buyer is added.</p>
                </div>
                <Switch defaultChecked disabled />
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2"><LinkIcon /> Integrations</CardTitle>
            <CardDescription>
                Connect with third-party services to enhance your workflow.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-lg border">
                <div className="flex items-center gap-4">
                    <div className="h-10 w-10 bg-muted rounded-lg flex items-center justify-center">
                        <svg width="24" height="24" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.35 12.16c0-1.53-.14-3.03-.4-4.5H12v2.73h5.24c-.24 1.74-1.3 3.23-2.94 4.22v2.28h2.95c1.72-1.58 2.7-3.9 2.7-6.73z"></path><path fill="#34A853" d="M12 22c3.27 0 6.02-1.08 8.02-2.92l-2.95-2.28c-1.08.73-2.45 1.16-4.07 1.16-3.13 0-5.78-2.1-6.73-4.96H2.2v2.36C4.14 19.83 7.8 22 12 22z"></path><path fill="#FBBC05" d="M5.27 13.75a7.1 7.1 0 0 1 0-3.5V7.89H2.2c-.68 1.35-1.05 2.85-1.05 4.36s.37 3.01 1.05 4.36l3.07-2.36z"></path><path fill="#EA4335" d="M12 5.04c1.77 0 3.35.61 4.6 1.8l2.6-2.6A11.5 11.5 0 0 0 12 2a11.95 11.95 0 0 0-9.8 5.89l3.07 2.36c.95-2.86 3.6-4.96 6.73-4.96z"></path></svg>
                    </div>
                    <div>
                        <h3 className="font-bold">Google Calendar</h3>
                        <p className="text-sm text-muted-foreground">Use the "Add to Calendar" feature on appointments to sync them.</p>
                    </div>
                </div>
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2"><Server /> Backup & Restore</CardTitle>
            <CardDescription>
                Download a full backup of your data or restore it from a file.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div>
                <h3 className="font-semibold mb-2">Download Backup</h3>
                <p className="text-sm text-muted-foreground mb-4">
                    Download all your properties, buyers, and appointments into a single JSON file. Keep it safe!
                </p>
                <Button onClick={handleBackup}>
                    <Download className="mr-2 h-4 w-4" />
                    Download Full Backup
                </Button>
            </div>
            <Separator />
             <div>
                <h3 className="font-semibold mb-2">Restore from Backup</h3>
                <p className="text-sm text-muted-foreground mb-4">
                    Restore your data from a previously downloaded backup file. This will overwrite all current data in Firestore.
                </p>
                 <div className="flex flex-col sm:flex-row gap-4">
                    <Input 
                        id="restore-upload"
                        type="file"
                        accept=".json"
                        onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                        className="max-w-xs"
                    />
                     <AlertDialog>
                      <AlertDialogTrigger asChild>
                         <Button variant="destructive" disabled={!restoreFile}>
                            <Upload className="mr-2 h-4 w-4" />
                            Restore Backup
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. Restoring from a backup will
                            <span className="font-bold text-destructive"> permanently overwrite all existing data </span> 
                            in the application with the data from this file.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleRestore}>
                            Yes, Overwrite and Restore
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>
        </CardContent>
      </Card>

      {profile.role === 'Admin' && (
        <Card className="border-destructive">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive"><AlertTriangle /> Danger Zone</CardTitle>
                <CardDescription>
                    These actions are irreversible. Please proceed with caution.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                     <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-lg bg-destructive/10">
                        <div>
                            <h3 className="font-bold">Clear Activity Log</h3>
                            <p className="text-sm text-destructive/80">Permanently delete all activity log entries from the database.</p>
                        </div>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" className="mt-2 sm:mt-0">Clear Activities</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will permanently delete all activity logs for your agency. This action cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleClearActivities}>Confirm & Delete</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-lg bg-destructive/10">
                        <div>
                            <h3 className="font-bold">Reset Account</h3>
                            <p className="text-sm text-destructive/80">Permanently delete all CRM data including properties, buyers, and appointments. Your user account will not be deleted.</p>
                        </div>
                        <AlertDialog>
                             <AlertDialogTrigger asChild>
                                <Button variant="destructive" className="mt-2 sm:mt-0">Reset Account</Button>
                             </AlertDialogTrigger>
                             <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Are you sure you want to reset?</AlertDialogTitle></AlertDialogHeader>
                                <AlertDialogDescription>This will delete all CRM data. This action is final.</AlertDialogDescription>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => setIsResetDialogOpen(true)}>Confirm & Reset</AlertDialogAction>
                                </AlertDialogFooter>
                             </AlertDialogContent>
                        </AlertDialog>

                    </div>
                     <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-lg bg-destructive/10">
                        <div>
                            <h3 className="font-bold">Delete Agency Account</h3>
                            <p className="text-sm text-destructive/80">Permanently delete your agency, all CRM data, and your user account.</p>
                        </div>
                        <Button variant="destructive" className="mt-2 sm:mt-0" onClick={() => setDeleteAgencyDialogOpen(true)}>Delete Agency</Button>
                    </div>
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
        title="Delete Agency Account"
        description="This action will permanently delete your agency and all its data. To confirm, please enter your password."
        nonPasswordDescription="This action will permanently delete your agency and all its data. To confirm your identity, you will be prompted to sign in with Google again."
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
      // On success, the component might unmount due to navigation, but if not:
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
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive">{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {isPasswordRequired ? description : nonPasswordDescription}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
            {isPasswordRequired ? (
                <>
                    <Label htmlFor="delete-password">Password</Label>
                    <Input 
                        id="delete-password"
                        type="password"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setError(''); }}
                        placeholder="Enter your password"
                    />
                </>
            ) : (
                <>
                    <Label htmlFor="delete-confirm-text">Type DELETE to confirm</Label>
                    <Input 
                        id="delete-confirm-text"
                        type="text"
                        value={confirmationText}
                        onChange={(e) => { setConfirmationText(e.target.value); setError(''); }}
                        placeholder="DELETE"
                    />
                </>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <AlertDialogFooter>
          <Button variant="ghost" onClick={() => setIsOpen(false)} disabled={isLoading}>Cancel</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isLoading || !canConfirm}>
            {isLoading && <Loader2 className="animate-spin mr-2" />}
            Confirm & Delete
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
