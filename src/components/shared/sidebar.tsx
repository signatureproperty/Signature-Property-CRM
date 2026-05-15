'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  Building2,
  Users,
  UserCog,
  Calendar,
  Settings,
  Rocket,
  History,
  Trash2,
  MessageSquare,
  ClipboardList,
  MoreHorizontal,
  X,
  Gem,
  FileArchive,
  Video,
  Edit,
  Mail,
  Plus,
  DollarSign,
  ShieldAlert,
  Building,
  Palette
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { useProfile } from '@/context/profile-context';
import { useUI } from '@/app/(protected)/layout';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth, useFirestore } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { AddPropertyDialog } from '../add-property-dialog';
import { AddBuyerDialog } from '../add-buyer-dialog';
import { collection } from 'firebase/firestore';
import { useMemoFirebase } from '@/firebase/hooks';
import type { Property, Buyer, ListingType } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';

const allMenuItems = [
  { href: '/overview', label: 'Dashboard', icon: <LayoutDashboard />, roles: ['Admin', 'Agent', 'Video Recorder', 'Super Admin'] },
  { href: '/super-admin', label: 'Admin Control', icon: <ShieldAlert />, roles: ['Super Admin'] },
  { href: '/super-admin/branding', label: 'App Branding', icon: <Palette />, roles: ['Super Admin'] },
  { href: '/properties', label: 'Properties', icon: <Building2 />, roles: ['Admin', 'Agent'] },
  { href: '/buyers', label: 'Buyers', icon: <Users />, roles: ['Admin', 'Agent'] },
  { href: '/finance', label: 'Finance', icon: <DollarSign />, roles: ['Admin'] },
  { href: '/team', label: 'Team', icon: <UserCog />, roles: ['Admin'] },
  { href: '/appointments', label: 'Appointments', icon: <Calendar />, roles: ['Admin', 'Agent']},
  { href: '/inbox', label: 'Inbox', icon: <Mail />, roles: ['Admin', 'Agent']},
  { href: '/tools', label: 'Tools', icon: <Rocket />, roles: ['Admin', 'Agent'] },
  { href: '/reports', label: 'Reports', icon: <ClipboardList />, roles: ['Admin'] },
  { href: '/activities', label: 'Activities', icon: <History />, roles: ['Admin', 'Agent'] },
  { href: '/documents', label: 'Documents', icon: <FileArchive />, roles: ['Admin'] },
  { href: '/trash', label: 'Trash', icon: <Trash2 />, roles: ['Admin', 'Agent'] },
];

const videoMenuItems = [
    { href: '/recording', label: 'Recording', icon: <Video />, roles: ['Video Recorder'] },
    { href: '/editing', label: 'Editing', icon: <Edit />, roles: ['Video Recorder'] },
];

const bottomMenuItems = [
  { href: '/settings', label: 'Settings', icon: <Settings />, roles: ['Admin', 'Agent', 'Super Admin'] },
  { href: '/support', label: 'Support', icon: <MessageSquare />, roles: ['Admin', 'Agent'] },
];

const allMobileMenuItems = [
    ...allMenuItems,
    ...videoMenuItems,
    ...bottomMenuItems,
    { href: '/upgrade', label: 'Upgrade Plan', icon: <Gem />, roles: ['Admin'] },
];


export function AppSidebar() {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const { profile } = useProfile();
  
  const auth = useAuth();
  const router = useRouter();
  const firestore = useFirestore();
  const { isMoreMenuOpen, setIsMoreMenuOpen } = useUI();


  const [isAddPropertyOpen, setIsAddPropertyOpen] = useState(false);
  const [isAddBuyerOpen, setIsAddBuyerOpen] = useState(false);
  const [propertyListingType, setPropertyListingType] = useState<ListingType>('For Sale');
  
  const agencyPropertiesQuery = useMemoFirebase(() => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'properties') : null, [profile.agency_id, firestore]);
  const { data: allProperties } = useCollection<Property>(agencyPropertiesQuery);
  const agencyBuyersQuery = useMemoFirebase(() => profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'buyers') : null, [profile.agency_id, firestore]);
  const { data: allBuyers } = useCollection<Buyer>(agencyBuyersQuery);

  const renderMenuItem = (item: any) => {
    if (!item.roles.includes(profile.role)) {
      return null;
    }
    
    const isActive = pathname === item.href;

    return (
      <SidebarMenuItem key={item.href} className="relative">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href={item.href}>
              <SidebarMenuButton
                isActive={isActive}
                className={cn("transition-all duration-150")}
              >
                {item.icon}
                <span className="flex-1 truncate">{item.label}</span>
              </SidebarMenuButton>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" align="center">{item.label}</TooltipContent>
        </Tooltip>
      </SidebarMenuItem>
    );
  };

  if (isMobile === null) {
      return null;
  }

  if (isMobile) {
    if (profile.role === 'Video Recorder') {
      const recorderNavItems = [
        { href: '/recording', label: 'Recording', icon: <Video />, roles: [], isCenter: false },
        { href: '/overview', label: 'Overview', icon: <LayoutDashboard />, roles: [], isCenter: true },
        { href: '/editing', label: 'Editing', icon: <Edit />, roles: [], isCenter: false },
      ];
      return (
        <div className="fixed bottom-0 left-0 z-50 w-full h-20 border-t bg-background/95 dark:bg-black/20 backdrop-blur-xl">
          <div className="grid h-full grid-cols-3 relative">
            {recorderNavItems.map(item => {
              const isActive = pathname.startsWith(item.href);
              if (item.isCenter) {
                return (
                  <div key={item.href} className="relative flex items-center justify-center">
                    <Link href={item.href}>
                      <div className={cn(
                        'absolute -top-6 flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg transition-all duration-200 left-1/2 -translate-x-1/2',
                        'bg-gradient-to-br from-primary to-blue-500',
                        isActive && 'ring-4 ring-primary/30'
                      )}>
                        {React.cloneElement(item.icon, { className: 'h-7 w-7' })}
                      </div>
                    </Link>
                  </div>
                )
              }
              return (
                 <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                        'flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors duration-150',
                        isActive ? 'text-primary' : 'text-muted-foreground hover:text-primary'
                    )}
                >
                    {React.cloneElement(item.icon, { className: 'h-5 w-5' })}
                    <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      )
    }
    const mobileNavItems = [
        { href: '/tools', label: 'Tools', icon: <Rocket />, roles: ['Admin', 'Agent'] },
        { href: '/properties', label: 'Properties', icon: <Building2 />, roles: ['Admin', 'Agent'] },
        { href: '/overview', label: 'Dashboard', icon: <LayoutDashboard />, isCenter: true, roles: ['Admin', 'Agent', 'Video Recorder', 'Super Admin'] },
        { href: '/buyers', label: 'Buyers', icon: <Users />, roles: ['Admin', 'Agent'] },
        { href: '#', label: 'More', icon: <MoreHorizontal />, isSheet: true, roles: ['Admin', 'Agent', 'Super Admin'] },
    ];
    return (
        <>
            <div className="fixed bottom-0 left-0 z-50 w-full h-20 border-t bg-background/95 dark:bg-black/20 backdrop-blur-xl">
                <div className="grid h-full grid-cols-5 relative">
                    {mobileNavItems.map(item => {
                        if (item.roles.length > 0 && !item.roles.includes(profile.role)) return null;

                        const isActive = !item.isSheet && pathname.startsWith(item.href);
                        
                        if (item.isCenter) {
                            return (
                                <div key={item.href} className="relative flex items-center justify-center">
                                    <Link href={item.href}>
                                        <div className={cn(
                                            'absolute -top-6 flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg transition-all duration-200 left-1/2 -translate-x-1/2',
                                            'bg-gradient-to-br from-primary to-blue-500',
                                            isActive && 'ring-4 ring-primary/30'
                                        )}>
                                            {React.cloneElement(item.icon, { className: 'h-7 w-7' })}
                                        </div>
                                    </Link>
                                </div>
                            )
                        }
                        if (item.isSheet) {
                             return (
                                <button key={item.label} onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)} className="flex flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground outline-none">
                                    {isMoreMenuOpen ? <X className="h-5 w-5 text-primary" /> : <MoreHorizontal className="h-5 w-5" />}
                                    <span>{item.label}</span>
                                </button>
                            )
                        }
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    'flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors duration-150',
                                    isActive ? 'text-primary' : 'text-muted-foreground hover:text-primary'
                                )}
                            >
                                {React.cloneElement(item.icon, { className: 'h-5 w-5' })}
                                <span>{item.label}</span>
                            </Link>
                        )
                    })}
                </div>
            </div>
            
            <AnimatePresence>
            {isMoreMenuOpen && (
                <>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setIsMoreMenuOpen(false)}
                    className="fixed inset-0 z-40 bg-black/40"
                    transition={{ duration: 0.15 }}
                />
                <div className="fixed bottom-24 right-4 z-40 flex flex-col items-end gap-3">
                    {allMobileMenuItems
                        .filter(i => 
                            !mobileNavItems.some(navItem => navItem.href === i.href) && 
                            i.roles.includes(profile.role) &&
                            i.label !== 'Logout' && i.label !== 'Settings' && i.label !== 'Support'
                        )
                        .map((item, index) => (
                        <motion.div
                            key={item.href}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            transition={{
                                type: 'tween',
                                ease: 'easeOut',
                                duration: 0.15,
                                delay: index * 0.03,
                            }}
                            className="flex items-center gap-3"
                        >
                            <span className="bg-card dark:bg-slate-900 text-card-foreground px-3 py-1.5 rounded-lg text-sm font-semibold shadow-md border dark:border-white/10">
                                {item.label}
                            </span>
                            <Link href={item.href} onClick={() => setIsMoreMenuOpen(false)}>
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
                                    {React.cloneElement(item.icon, { className: 'h-6 w-6' })}
                                </div>
                            </Link>
                        </motion.div>
                    ))}
                </div>
                </>
            )}
            </AnimatePresence>
        </>
    )
  }

  return (
    <>
    <TooltipProvider>
      <Sidebar
        collapsible="icon"
        className="hidden md:flex flex-col bg-card dark:bg-transparent border-r dark:border-white/10"
      >
        <SidebarHeader className="p-6">
            <div className="flex items-center gap-2">
                <span className="font-bold text-xl font-headline text-foreground tracking-tight">
                    Signature CRM
                </span>
            </div>
        </SidebarHeader>

        <SidebarContent className="flex-1 p-3">
          <SidebarMenu>
            {allMenuItems.map(renderMenuItem)}
            {profile.role === 'Video Recorder' && videoMenuItems.map(renderMenuItem)}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter>
           <SidebarMenu>
            {bottomMenuItems.map(renderMenuItem)}
             {profile.role === 'Admin' && <SidebarMenuItem>
              <Tooltip>
                  <TooltipTrigger asChild>
                      <Link href="/upgrade">
                          <SidebarMenuButton className="bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary justify-center transition-all duration-150">
                              <Gem />
                              <span className="flex-1 truncate">Upgrade Plan</span>
                          </SidebarMenuButton>
                      </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" align="center">Upgrade Plan</TooltipContent>
              </Tooltip>
            </SidebarMenuItem>}
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
    </TooltipProvider>

     <AddPropertyDialog
        isOpen={isAddPropertyOpen}
        setIsOpen={setIsAddPropertyOpen}
        propertyToEdit={null}
        allProperties={allProperties || []}
        onSave={() => {}}
        listingType={propertyListingType}
        limitReached={false}
      />
      
      <AddBuyerDialog
        isOpen={isAddBuyerOpen}
        setIsOpen={setIsAddBuyerOpen}
        totalSaleBuyers={allBuyers?.filter(b => !b.is_deleted && b.listing_type !== 'For Rent').length || 0}
        totalRentBuyers={allBuyers?.filter(b => !b.is_deleted && b.listing_type === 'For Rent').length || 0}
        onSave={() => {}}
        limitReached={false}
      />
    </>
  );
}