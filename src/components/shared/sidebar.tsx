'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  Gem,
  FileArchive,
  Video,
  Edit,
  Mail,
  ShieldAlert,
  Palette,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { useProfile } from '@/context/profile-context';

const allMenuItems = [
  { href: '/overview', label: 'Dashboard', icon: <LayoutDashboard />, roles: ['Admin', 'Agent', 'Video Recorder', 'Super Admin'] },
  { href: '/super-admin', label: 'Admin Control', icon: <ShieldAlert />, roles: ['Super Admin'] },
  { href: '/super-admin/branding', label: 'App Branding', icon: <Palette />, roles: ['Super Admin'] },
  { href: '/properties', label: 'Properties', icon: <Building2 />, roles: ['Admin', 'Agent'] },
  { href: '/buyers', label: 'Buyers', icon: <Users />, roles: ['Admin', 'Agent'] },
  { href: '/team', label: 'Team', icon: <UserCog />, roles: ['Admin'] },
  { href: '/analytics', label: 'Analytics', icon: <BarChart3 />, roles: ['Admin'] },
  { href: '/appointments', label: 'Appointments', icon: <Calendar />, roles: ['Admin', 'Agent']},
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

export function AppSidebar() {
  const pathname = usePathname();
  const { profile } = useProfile();
  const { setOpenMobile } = useSidebar();

  const renderMenuItem = (item: any) => {
    if (!item.roles.includes(profile.role)) {
      return null;
    }
    
    const isActive = pathname === item.href;

    return (
      <SidebarMenuItem key={item.href} className="relative">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href={item.href} onClick={() => setOpenMobile(false)}>
              <SidebarMenuButton
                isActive={isActive}
                className={cn("transition-all duration-150 py-2 md:py-2")}
              >
                {React.cloneElement(item.icon, { className: "h-5 w-5" })}
                <span className="flex-1 truncate font-medium text-sm">{item.label}</span>
              </SidebarMenuButton>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" align="center" className="hidden md:block">{item.label}</TooltipContent>
        </Tooltip>
      </SidebarMenuItem>
    );
  };

  return (
    <TooltipProvider>
      <Sidebar
        collapsible="icon"
        className="flex flex-col bg-card/60 dark:bg-transparent border-r dark:border-white/10 backdrop-blur-xl"
      >
        <SidebarHeader className="p-4">
            <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-white shadow-lg shrink-0">
                    <Building2 className="h-5 w-5" />
                </div>
                <span className="font-bold text-lg font-headline text-foreground tracking-tight group-data-[state=collapsed]:hidden">
                    Signature CRM
                </span>
            </div>
        </SidebarHeader>

        <SidebarContent className="flex-1 p-2">
          <SidebarMenu className="gap-0.5">
            {allMenuItems.map(renderMenuItem)}
            {profile.role === 'Video Recorder' && videoMenuItems.map(renderMenuItem)}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="p-2 border-t border-border/30">
           <SidebarMenu className="gap-0.5">
            {bottomMenuItems.map(renderMenuItem)}
             {profile.role === 'Admin' && (
                <SidebarMenuItem>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Link href="/upgrade" onClick={() => setOpenMobile(false)}>
                                <SidebarMenuButton className="bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary transition-all duration-150 h-10 md:h-14 md:justify-center">
                                    <Gem className="h-5 w-5" />
                                    <span className="font-bold text-sm group-data-[state=collapsed]:hidden">Upgrade Plan</span>
                                </SidebarMenuButton>
                            </Link>
                        </TooltipTrigger>
                        <TooltipContent side="right" align="center" className="hidden md:block">Upgrade Plan</TooltipContent>
                    </Tooltip>
                </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
    </TooltipProvider>
  );
}
