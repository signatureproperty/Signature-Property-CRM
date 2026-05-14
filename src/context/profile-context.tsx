'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserRole, PlanName } from '@/lib/types';
import { doc, Timestamp } from 'firebase/firestore';
import { useUser } from '@/firebase/auth/use-user';
import { useFirestore } from '@/firebase/provider';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useMemoFirebase } from '@/firebase/hooks';
import { addDays, differenceInDays } from 'date-fns';


export interface ProfileData {
  name: string;
  agencyName: string;
  phone: string;
  role: UserRole;
  avatar?: string;
  user_id: string;
  agency_id: string;
  trialEndDate?: string;
  daysLeftInTrial?: number;
  planName?: PlanName;
  planStartDate?: string;
}

interface ProfileContextType {
  profile: ProfileData;
  setProfile: (profile: Partial<ProfileData>) => void;
  isLoading: boolean;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

const defaultProfile: ProfileData = {
    name: '',
    agencyName: '',
    phone: '',
    role: 'Agent',
    avatar: '',
    user_id: '',
    agency_id: '',
    planName: 'Basic',
};

const MASTER_ADMIN_EMAIL = 'usmansagheer444@gmail.com';

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [user, firestore]);
  const { data: userProfile, isLoading: isUserProfileLoading } = useDoc<any>(userDocRef);

  const agencyDocRef = useMemoFirebase(() => 
    userProfile?.agency_id && userProfile.agency_id.trim() !== '' 
      ? doc(firestore, 'agencies', userProfile.agency_id) 
      : null, 
    [userProfile, firestore]
  );
  const { data: agencyProfile, isLoading: isAgencyLoading } = useDoc<any>(agencyDocRef);
  
  const teamMemberDocRef = useMemoFirebase(() =>
    userProfile?.agency_id && userProfile.agency_id.trim() !== '' && user
        ? doc(firestore, 'agencies', userProfile.agency_id, 'teamMembers', user.uid)
        : null,
    [userProfile, user, firestore]
  );
  const { data: teamMemberProfile, isLoading: isTeamMemberLoading } = useDoc<any>(teamMemberDocRef);
  
  const agentDocRef = useMemoFirebase(() => (userProfile?.role === 'Agent' && user ? doc(firestore, 'agents', user.uid) : null), [userProfile, user, firestore]);
  const { data: agentProfile, isLoading: isAgentProfileLoading } = useDoc<any>(agentDocRef);


  const [profile, setProfileState] = useState<ProfileData>(defaultProfile);

  useEffect(() => {
    if (isAuthLoading) return;

    if (!user) {
        setProfileState(defaultProfile);
        localStorage.removeItem('app-profile');
        return;
    }

    // Set initial data from auth user to avoid flicker
    setProfileState(prev => ({
        ...prev,
        user_id: user.uid,
        name: user.displayName || prev.name || 'User',
        avatar: user.photoURL || prev.avatar,
    }));

    if (!isUserProfileLoading) {
        const isMasterEmail = user.email?.toLowerCase() === MASTER_ADMIN_EMAIL;
        const role = isMasterEmail ? 'Super Admin' : (userProfile?.role || 'Agent');
        
        let name = userProfile?.name || user.displayName || 'User';
        let phone = userProfile?.phone || '';
        let avatar = teamMemberProfile?.avatar || agencyProfile?.avatar || userProfile?.avatar || user.photoURL || '';
        let agencyName = agencyProfile?.agencyName || 'My Agency';

        if (role === 'Agent' && agentProfile) {
            name = agentProfile.name || name;
            phone = agentProfile.phone || phone;
        } else if (role === 'Admin' && agencyProfile) {
            name = agencyProfile.name || name;
            phone = agencyProfile.phone || phone;
        } else if (role === 'Video Recorder' && teamMemberProfile) {
             name = teamMemberProfile.name || name;
             phone = teamMemberProfile.phone || phone;
        } else if (role === 'Super Admin') {
             agencyName = "Platform Master Control";
             name = name || 'System Admin';
        }


        let trialEndDate: string | undefined;
        let daysLeftInTrial: number | undefined;
        let planStartDate: string | undefined;

        // Prioritize planStartDate if it exists
        const startDateSource = agencyProfile?.planStartDate || userProfile?.createdAt;
        if (startDateSource) {
            const startDate = (startDateSource as Timestamp).toDate();
            const endDate = addDays(startDate, 30);
            const daysLeft = differenceInDays(endDate, new Date());
            trialEndDate = endDate.toISOString();
            daysLeftInTrial = Math.max(0, daysLeft);
            if (agencyProfile?.planStartDate) {
                planStartDate = startDate.toISOString();
            }
        }

        const newProfileData: ProfileData = {
            name: name,
            agencyName: agencyName,
            phone: phone,
            role: role, 
            avatar: avatar,
            user_id: user.uid,
            agency_id: userProfile?.agency_id || (isMasterEmail ? 'master_control' : ''),
            trialEndDate,
            daysLeftInTrial,
            planName: agencyProfile?.planName || 'Basic',
            planStartDate: planStartDate,
        };
        
        setProfileState(newProfileData);
        localStorage.setItem('app-profile', JSON.stringify(newProfileData));
    }
  }, [user, userProfile, agencyProfile, agentProfile, teamMemberProfile, isAuthLoading, isUserProfileLoading, isAgencyLoading, isAgentProfileLoading, isTeamMemberLoading]);


  const setProfile = (newProfile: Partial<ProfileData>) => {
    setProfileState(prevProfile => {
        const updatedProfile = { ...prevProfile, ...newProfile };
        localStorage.setItem('app-profile', JSON.stringify(updatedProfile));
        return updatedProfile;
    });
  };

  const isLoading = isAuthLoading || isUserProfileLoading || (!!userProfile?.agency_id && (isAgencyLoading || isTeamMemberLoading));

  return (
    <ProfileContext.Provider value={{ profile, setProfile, isLoading }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
