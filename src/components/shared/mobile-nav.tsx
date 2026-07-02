
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  MoreHorizontal, 
  Rocket, 
  UserCog, 
  Calendar, 
  ClipboardList, 
  History, 
  Trash2,
  X,
  ShieldAlert,
  Palette,
  BarChart3,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProfile } from '@/context/profile-context';
import { motion, AnimatePresence } from 'framer-motion';

export function MobileNav() {
  const pathname = usePathname();
  const { profile } = useProfile();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Recorders have a very specific workflow
  if (profile.role === 'Video Recorder') return null;

  const menuItems = [
    { href: '/super-admin', label: 'Admin Control', icon: <ShieldAlert />, roles: ['Super Admin'] },
    { href: '/super-admin/branding', label: 'App Branding', icon: <Palette />, roles: ['Super Admin'] },
    { href: '/team', label: 'Team', icon: <UserCog />, roles: ['Admin'] },
    { href: '/analytics', label: 'Analytics', icon: <BarChart3 />, roles: ['Admin'] },
    { href: '/services', label: 'Services', icon: <Sparkles />, roles: ['Admin', 'Agent'] },
    { href: '/appointments', label: 'Appointments', icon: <Calendar />, roles: ['Admin', 'Agent'] },
    { href: '/reports', label: 'Reports', icon: <ClipboardList />, roles: ['Admin'] },
    { href: '/activities', label: 'Activities', icon: <History />, roles: ['Admin', 'Agent'] },
    { href: '/trash', label: 'Trash', icon: <Trash2 />, roles: ['Admin', 'Agent'] },
  ].filter(item => item.roles.includes(profile.role));

  const mainNavItems = [
    { href: '/tools', label: 'Tools', icon: <Rocket className="h-5 w-5" /> },
    { href: '/properties', label: 'Properties', icon: <Building2 className="h-5 w-5" /> },
    { href: '/overview', label: 'Dashboard', icon: <LayoutDashboard className="h-6 w-6" />, isCenter: true },
    { href: '/buyers', label: 'Buyers', icon: <Users className="h-5 w-5" /> },
  ];

  return (
    <>
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMenuOpen(false)}
            className="fixed inset-0 z-[60] bg-background/60 backdrop-blur-md"
          />
        )}
      </AnimatePresence>

      <div className="fixed bottom-24 right-6 z-[70] flex flex-col items-end gap-4 pointer-events-none">
        <AnimatePresence>
          {isMenuOpen && (
            <div className="flex flex-col items-end gap-3 mb-2">
              {menuItems.map((item, index) => (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.8 }}
                  transition={{ delay: (menuItems.length - index) * 0.05 }}
                  className="flex items-center gap-3 pointer-events-auto"
                >
                  <span className="text-sm font-black uppercase tracking-widest text-foreground bg-background/90 px-3 py-1.5 rounded-lg shadow-xl border border-white/20">
                    {item.label}
                  </span>
                  <Link
                    href={item.href}
                    onClick={() => setIsMenuOpen(false)}
                    className="flex h-12 w-12 items-center justify-center rounded-full glowing-btn shadow-2xl transition-transform active:scale-90"
                  >
                    {React.cloneElement(item.icon as React.ReactElement, { className: "h-5 w-5" })}
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 block border-t bg-card/80 backdrop-blur-xl md:hidden pb-safe">
        <nav className="flex h-16 items-center justify-around px-2 relative">
          
          {mainNavItems.map((item) => {
            const isActive = pathname === item.href;
            
            if (item.isCenter) {
              return (
                <div key={item.href} className="relative flex flex-col items-center">
                  <Link
                    href={item.href}
                    className={cn(
                      "absolute -top-10 flex h-14 w-14 items-center justify-center rounded-full glowing-btn shadow-2xl transition-all duration-300 ring-4 ring-background",
                      isActive ? "scale-110 shadow-primary/40" : "scale-100"
                    )}
                  >
                    {item.icon}
                  </Link>
                  <span className={cn(
                    "mt-6 text-[10px] font-black uppercase tracking-tighter transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground/60"
                  )}>
                    {item.label}
                  </span>
                </div>
              );
            }

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
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 px-3 py-1 transition-all duration-200 outline-none",
              isMenuOpen ? "text-primary scale-110" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="h-5 w-5 flex items-center justify-center">
                {isMenuOpen ? <X className="h-5 w-5" /> : <MoreHorizontal className="h-5 w-5" />}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-tighter">More</span>
          </button>
        </nav>
      </div>
    </>
  );
}
