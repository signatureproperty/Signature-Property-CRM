'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Building2, Users, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/components/ui/sidebar';
import { useProfile } from '@/context/profile-context';

export function MobileNav() {
  const pathname = usePathname();
  const { toggleSidebar } = useSidebar();
  const { profile } = useProfile();

  // Hide bottom nav for roles that don't need these specific shortcuts (e.g. Video Recorder)
  if (profile.role === 'Video Recorder') return null;

  const navItems = [
    { href: '/overview', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
    { href: '/properties', label: 'Properties', icon: <Building2 className="h-5 w-5" /> },
    { href: '/buyers', label: 'Buyers', icon: <Users className="h-5 w-5" /> },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 block border-t bg-card/80 backdrop-blur-xl md:hidden pb-safe">
      <nav className="flex h-16 items-center justify-around px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-1 transition-all duration-200",
                isActive ? "text-primary scale-110" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.icon}
              <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => toggleSidebar()}
          className="flex flex-col items-center justify-center gap-1 px-3 py-1 text-muted-foreground hover:text-foreground transition-all duration-200"
        >
          <Menu className="h-5 w-5" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">More</span>
        </button>
      </nav>
    </div>
  );
}
