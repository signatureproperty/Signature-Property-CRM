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
  Video,
  Edit,
  ShieldAlert,
  Palette,
  BarChart3,
  Sparkles
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
  { href: '/overview', label: 'Dashboard', roles: ['Admin', 'Agent'], icon: <LayoutDashboard /> },
  { href: '/properties', label: 'Properties', roles: ['Admin', 'Agent'], icon: <Building2 /> },
  { href: '/buyers', label: 'Buyers', roles: ['Admin', 'Agent'], icon: <Users /> },
  { href: '/services', label: 'Services', roles: ['Admin'], icon: <Sparkles /> },
  { href: '/team', label: 'Team', roles: ['Admin'], icon: <UserCog /> },
  { href: '/analytics', label: 'Analytics', roles: ['Admin'], icon: <BarChart3 /> },
  { href: '/appointments', label: 'Appointments', roles: ['Admin', 'Agent'], icon: <Calendar /> },
  { href: '/tools', label: 'Tools', roles: ['Admin', 'Agent'], icon: <Rocket /> },
  { href: '/reports', label: 'Reports', roles: ['Admin'], icon: <ClipboardList /> },
  { href: '/activities', label: 'Activities', roles: ['Admin', 'Agent'], icon: <History /> },
  { href: '/trash', label: 'Trash', roles: ['Admin', 'Agent'], icon: <Trash2 /> },
];

const bottomMenuItems = [
  { href: '/settings', label: 'Settings', roles: ['Admin', 'Agent'], icon: <Settings /> },
  { href: '/support', label: 'Support', roles: ['Admin', 'Agent'], icon: <MessageSquare /> },
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
