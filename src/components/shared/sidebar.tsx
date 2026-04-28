
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
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  Building2,
  Users,
  UserCog,
  PhoneForwarded,
  Calendar,
  Settings,
  Rocket,
  Home,
  ChevronDown,
  LineChart,
  History,
  Trash2,
  MessageSquare,
  ClipboardList,
  Badge,
  MoreHorizontal,
  X,
  Menu,
  Gem,
  ShieldCheck,
  PieChart,
  FileArchive,
  Video,
  Edit,
  Mail,
  Plus,
  ArrowUpCircle,
  Workflow,
  LogOut,
  Building
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { buyerStatuses } from '@/lib/data';
import { useProfile } from '@/context/profile-context';
import { useUI } from '@/app/(protected)/layout';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth, useFirestore } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { AddPropertyDialog } from '../add-property-dialog';
import { AddBuyerDialog } from '../add-buyer-dialog';
import { collection } from 'firebase/firestore';
import { useMemoFirebase } from '@/firebase/hooks';
import type { Property, Buyer, ListingType, UserRole } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Button } from '../ui/button';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Separator } from '../ui/separator';

const mainMenuItems = [
  { href: '/overview', label: 'Dashboard', icon: <LayoutDashboard />, roles: ['Admin', 'Agent', 'Video Recorder'] },
  { href: '/team', label: 'Team', icon: <UserCog />, roles: ['Admin'] },
];

const productivityMenuItems = [
  { href: '/appointments', label: 'Appointments', icon: <Calendar />, roles: ['Admin', 'Agent']},
  { href: '/follow-ups', label: 'Follow-ups', icon: <PhoneForwarded />, roles: ['Admin', 'Agent']},
  { href: '/activities', label: 'Activities', icon: <History />, roles: ['Admin', 'Agent'] },
  { href: '/inbox', label: 'Inbox', icon: <Mail />, roles: ['Admin']},
];

const growthMenuItems = [
    { href: '/reports', label: 'Reports', icon: <ClipboardList />, roles: ['Admin'] },
    { href: '/tools', label: 'Tools', icon: <Rocket />, roles: ['Admin', 'Agent'] },
];

const managementMenuItems = [
    { href: '/documents', label: 'Documents', icon: <FileArchive />, roles: ['Admin'] },
    { href: '/trash', label: 'Trash', icon: <Trash2 />, roles: ['Admin', 'Agent'] },
];

const videoMenuItems = [
    { href: '/recording', label: 'Recording', icon: <Video />, roles: ['Video Recorder'] },
    { href: '/editing', label: 'Editing', icon: <Edit />, roles: ['Video Recorder'] },
];

const bottomMenuItems = [
  { href: '/settings', label: 'Settings', icon: <Settings />, roles: ['Admin', 'Agent'] },
  { href: '/support', label: 'Support', icon: <MessageSquare />, roles: ['Admin', 'Agent'] },
];

const allMobileMenuItems = [
    ...mainMenuItems,
    { href: '/properties', label: 'Properties', icon: <Building2 />, roles: ['Admin', 'Agent'] },
    { href: '/buyers', label: 'Buyers', icon: <Users />, roles: ['Admin', 'Agent'] },
    ...productivityMenuItems,
    ...growthMenuItems,
    ...managementMenuItems,
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

  const handleLogout = async () => {
    if (auth) {
        await signOut(auth);
    }
    localStorage.removeItem('app-profile');
    router.push('/');
  };

  const handleOpenAddDialog = (type: 'Property' | 'Buyer', listingType: ListingType) => {
    if (type === 'Property') {
        setPropertyListingType(listingType);
        setIsAddPropertyOpen(true);
    } else {
        setIsAddBuyerOpen(true);
    }
  }

  const renderMenuItem = (item: any) => {
    
    // Role check
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
                className={cn("transition-all duration-200")}
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
      return null; // Don't render anything until we know the screen size
  }

  if (isMobile) {
    if (profile.role === 'Video Recorder') {
      const recorderNavItems = [
        { href: '/recording', label: 'Recording', icon: <Video />, roles: [], isCenter: false },
        { href: '/overview', label: 'Overview', icon: <LayoutDashboard />, roles: [], isCenter: true },
        { href: '/editing', label: 'Editing', icon: <Edit />, roles: [], isCenter: false },
      ];
      return (
        <div className="fixed bottom-0 left-0 z-50 w-full h-20 border-t bg-transparent backdrop-blur-md">
          <div className="grid h-full grid-cols-3 relative">
            {recorderNavItems.map(item => {
              const isActive = pathname.startsWith(item.href);
              if (item.isCenter) {
                return (
                  <div key={item.href} className="relative flex items-center justify-center">
                    <Link href={item.href}>
                      <div className={cn(
                        'absolute -top-6 flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg transition-all duration-300 left-1/2 -translate-x-1/2',
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
                        'flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
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
    // New Mobile Nav for Admin/Agent
    const mobileNavItems = [
        { href: '/tools', label: 'Tools', icon: <Rocket />, roles: ['Admin', 'Agent'] },
        { href: '/properties', label: 'Properties', icon: <Building2 />, roles: ['Admin', 'Agent'] },
        { href: '/overview', label: 'Dashboard', icon: <LayoutDashboard />, isCenter: true, roles: ['Admin', 'Agent'] },
        { href: '/buyers', label: 'Buyers', icon: <Users />, roles: ['Admin', 'Agent'] },
        { href: '#', label: 'More', icon: <MoreHorizontal />, isSheet: true, roles: ['Admin', 'Agent'] },
    ];
    return (
        <>
            <div className="fixed bottom-0 left-0 z-50 w-full h-20 border-t bg-transparent backdrop-blur-md">
                <div className="grid h-full grid-cols-5 relative">
                    {mobileNavItems.map(item => {
                        if (!item.roles.includes(profile.role)) return null;

                        const isActive = !item.isSheet && pathname.startsWith(item.href);
                        
                        if (item.isCenter) {
                            return (
                                <div key={item.href} className="relative flex items-center justify-center">
                                    <Link href={item.href}>
                                        <div className={cn(
                                            'absolute -top-6 flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg transition-all duration-300 left-1/2 -translate-x-1/2',
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
                                <button key={item.label} onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)} className="flex flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground">
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
                                    'flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
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
                    className="fixed inset-0 z-40 bg-black/60"
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
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            transition={{
                                type: 'tween',
                                ease: 'easeOut',
                                duration: 0.3,
                                delay: index * 0.05,
                            }}
                            className="flex items-center gap-3"
                        >
                            <span className="bg-card text-card-foreground px-3 py-1.5 rounded-lg text-sm font-semibold shadow-lg">
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

  const CollapsibleMenuItem = ({
    label,
    icon,
    children,
    parentPath,
    roles
  }: {
    label: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    parentPath: string;
    roles: UserRole[];
  }) => {
    if (!roles.includes(profile.role)) return null;
    const isActive = pathname.startsWith(parentPath);
    const [isOpen, setIsOpen] = useState(isActive);
     useEffect(() => {
        if(isActive){
            setIsOpen(true);
        }
    }, [isActive]);

    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
        <CollapsibleTrigger asChild>
          <SidebarMenuButton isActive={isActive} className="justify-between">
            <div className="flex items-center gap-3">
              {icon}
              <span className="flex-1 truncate">{label}</span>
            </div>
            <ChevronDown className="size-4 shrink-0 transition-transform duration-200 data-[state=open]:rotate-180" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenu className="pl-6 pt-2">
            {children}
          </SidebarMenu>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  const CollapsibleSubItem = ({ href, label }: { href: string; label: string }) => {
    const searchParams = useSearchParams();
    const currentParams = new URLSearchParams(Array.from(searchParams.entries()));
    const isActive = pathname === href.split('?')[0] && currentParams.toString() === (href.split('?')[1] || '');
    
    return (
      <SidebarMenuItem>
        <Link href={href}>
          <SidebarMenuButton size="sm" isActive={isActive}>
            {label}
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
    );
  };


  return (
    <>
    <TooltipProvider>
      <Sidebar
        collapsible="icon"
        className="hidden md:flex flex-col bg-card dark:bg-neutral-900"
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
            {mainMenuItems.map(renderMenuItem)}
             {profile.role === 'Video Recorder' && videoMenuItems.map(renderMenuItem)}
          </SidebarMenu>
          
           <SidebarMenu className="mt-4">
            <h3 className="text-xs text-muted-foreground font-semibold pl-4 mb-1 group-data-[state=collapsed]:pl-0 group-data-[state=collapsed]:text-center">Leads</h3>
            <CollapsibleMenuItem label="Properties" icon={<Building2 />} parentPath="/properties" roles={['Admin', 'Agent']}>
                <p className="text-xs font-semibold text-muted-foreground px-4 py-2">Sale Properties</p>
                <CollapsibleSubItem href="/properties?status=All%20(Sale)" label="All (Sale)" />
                <CollapsibleSubItem href="/properties?status=Pending" label="Pending" />
                <CollapsibleSubItem href="/properties?status=Available%20(Sale)" label="Available" />
                <CollapsibleSubItem href="/properties?status=Sold" label="Sold" />
                <CollapsibleSubItem href="/properties?status=Sold%20(External)" label="Sold (External)" />
                <CollapsibleSubItem href="/properties?status=Recorded" label="Recorded" />
                <Separator className="my-2" />
                <p className="text-xs font-semibold text-muted-foreground px-4 py-2">Rent Properties</p>
                <CollapsibleSubItem href="/properties?status=All%20(Rent)" label="All (Rent)" />
                <CollapsibleSubItem href="/properties?status=Available%20(Rent)" label="Available" />
                <CollapsibleSubItem href="/properties?status=Rent%20Out" label="Rent Out" />
            </CollapsibleMenuItem>
            <CollapsibleMenuItem
              label="Buyers"
              icon={<Users />}
              parentPath="/buyers"
              roles={['Admin', 'Agent']}
            >
              <CollapsibleSubItem key="all" href="/buyers?status=All" label="All" />
              <Separator className="my-2" />
              <p className="text-xs font-semibold text-muted-foreground px-4 py-2">Filter by Status</p>
              {buyerStatuses.map(status => (
                  <CollapsibleSubItem key={status} href={`/buyers?status=${encodeURIComponent(status)}`} label={status} />
              ))}
            </CollapsibleMenuItem>
          </SidebarMenu>

          <SidebarMenu className="mt-4">
             <h3 className="text-xs text-muted-foreground font-semibold font-semibold pl-4 mb-1 group-data-[state=collapsed]:pl-0 group-data-[state=collapsed]:text-center">Productivity</h3>
             {productivityMenuItems.map(renderMenuItem)}
          </SidebarMenu>
          
          <SidebarMenu className="mt-4">
            <h3 className="text-xs text-muted-foreground font-semibold font-semibold pl-4 mb-1 group-data-[state=collapsed]:pl-0 group-data-[state=collapsed]:text-center">Growth</h3>
            {growthMenuItems.map(renderMenuItem)}
          </SidebarMenu>

          <SidebarMenu className="mt-4">
             <h3 className="text-xs text-muted-foreground font-semibold pl-4 mb-1 group-data-[state=collapsed]:pl-0 group-data-[state=collapsed]:text-center">Management</h3>
            {managementMenuItems.map(renderMenuItem)}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter>
           <SidebarMenu>
            {bottomMenuItems.map(renderMenuItem)}
             {profile.role === 'Admin' && <SidebarMenuItem>
              <Tooltip>
                  <TooltipTrigger asChild>
                      <Link href="/upgrade">
                          <SidebarMenuButton className="bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary justify-center">
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
