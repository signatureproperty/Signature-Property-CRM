'use client';

import React from 'react';
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
  SidebarTrigger,
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

  const renderMenuItem = (item: any) => {
    if (!item.roles.includes(profile.role)) {
      return null;
    }
    
    const isActive = pathname === item.href;

    return (
      <SidebarMenuItem key={item.href}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href={item.href}>
              <SidebarMenuButton
                isActive={isActive}
                className={cn("transition-all duration-300")}
              >
                {React.cloneElement(item.icon, { className: "h-5 w-5" })}
                <span className="flex-1 truncate font-semibold group-data-[state=collapsed]:hidden">{item.label}</span>
              </SidebarMenuButton>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" align="center" className="md:block group-data-[state=expanded]:hidden">{item.label}</TooltipContent>
        </Tooltip>
      </SidebarMenuItem>
    );
  };

  return (
    <TooltipProvider>
      <Sidebar
        collapsible="icon"
        className="border-r dark:border-white/10"
      >
        <SidebarHeader className="p-3 flex flex-row items-center gap-2">
            <SidebarTrigger className="hidden md:flex shrink-0" />
            <div className="flex items-center gap-2 overflow-hidden transition-all duration-300 group-data-[state=collapsed]:opacity-0 group-data-[state=collapsed]:w-0">
                <div className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20 shrink-0">
                    <Building2 className="h-5 w-5" />
                </div>
                <span className="font-bold text-base font-headline text-foreground tracking-tight whitespace-nowrap">
                    Signature CRM
                </span>
            </div>
        </SidebarHeader>

        <SidebarContent className="flex-1 p-2">
          <SidebarMenu className="gap-1">
            {allMenuItems.map(renderMenuItem)}
            {profile.role === 'Video Recorder' && videoMenuItems.map(renderMenuItem)}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="p-2 border-t border-border/30">
           <SidebarMenu className="gap-1">
            {bottomMenuItems.map(renderMenuItem)}
             {profile.role === 'Admin' && (
                <SidebarMenuItem>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Link href="/upgrade">
                                <SidebarMenuButton className="bg-primary/5 text-primary hover:bg-primary/15 hover:text-primary transition-all duration-300 h-11 md:h-14 md:justify-center border border-primary/10">
                                    <Gem className="h-5 w-5" />
                                    <span className="font-black text-[11px] uppercase tracking-wider group-data-[state=collapsed]:hidden">Upgrade Plan</span>
                                </SidebarMenuButton>
                            </Link>
                        </TooltipTrigger>
                        <TooltipContent side="right" align="center" className="md:block group-data-[state=expanded]:hidden">Upgrade Plan</TooltipContent>
                    </Tooltip>
                </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
    </TooltipProvider>
  );
}
