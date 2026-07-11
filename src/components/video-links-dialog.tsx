
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Property } from '@/lib/types';
import { Link as LinkIcon } from 'lucide-react';

interface VideoLinksDialogProps {
  property: Property;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const socialIcons = {
    tiktok: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.3-.69.39-1.06.08-.34.04-.7.04-1.06.01-3.49.01-6.98.01-10.46z"/></svg>
    ),
    youtube: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M21.582 7.043c-.23-.836-.9-1.472-1.754-1.693C18.266 5.002 12 5 12 5s-6.266.002-7.828.35c-.854.221-1.524.857-1.754 1.693C2.186 8.691 2 12 2 12s.186 3.309.418 4.957c.23.836.9 1.472 1.754 1.693C5.734 18.998 12 19 12 19s6.266-.002 7.828-.35c.854.221 1.524.857 1.754-1.693C21.814 15.309 22 12 22 12s-.186-3.309-.418-4.957zM10 14.59V9.41L14 12l-4 2.59z"/></svg>
    ),
    instagram: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.85s-.011 3.584-.069 4.85c-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07s-3.584-.012-4.85-.07c-3.252-.148-4.771-1.691-4.919-4.919-.058-1.265-.069-1.645-.069-4.85s.011-3.584.069-4.85c.149-3.225 1.664-4.771 4.919-4.919C8.416 2.175 8.796 2.163 12 2.163zm0 1.8a9.728 9.728 0 00-4.85.07C4.095 4.195 2.65 5.64 2.451 8.813c-.057 1.259-.068 1.63-.068 4.187s.011 2.928.068 4.187c.199 3.173 1.645 4.618 4.813 4.813 1.259.057 1.63.068 4.187.068s2.928-.011 4.187-.068c3.173-.199 4.618-1.645 4.813-4.813.057-1.259.068-1.63.068-4.187s-.011-2.928-.068-4.187c-.199-3.173-1.645-4.618-4.813-4.813C14.928 4.011 14.558 4 12 4zm0 2.882a5.118 5.118 0 100 10.236 5.118 5.118 0 000-10.236zM12 15a3 3 0 110-6 3 3 0 010 6zm6.406-9.15a1.288 1.288 0 100 2.576 1.288 1.288 0 000-2.576z"/></svg>
    ),
    facebook: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm3.31 11.9h-2.29v7.1h-3.12v-7.1H8.5V9.61h1.4V8.11c0-1.29.6-3.11 3.11-3.11h2.24v2.3h-1.63c-.43 0-.8.25-.8.74v1.57h2.46l-.37 2.29z"/></svg>
    ),
    other: (<LinkIcon />)
};

const truncateUrl = (url: string, length = 30) => {
    if (url.length <= length) return url;
    try {
        const urlObject = new URL(url);
        const origin = urlObject.origin;
        if (origin.length > length - 3) {
             return url.substring(0, length - 3) + '...';
        }
        return origin + '...';
    } catch (e) {
        return url.substring(0, length - 3) + '...';
    }
}


export function VideoLinksDialog({
  property,
  isOpen,
  setIsOpen,
}: VideoLinksDialogProps) {

  if (!property?.video_links) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md max-h-[70vh] sm:max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="font-headline">Video Links</DialogTitle>
          <DialogDescription>
            Watch videos for {property.auto_title}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
            {Object.entries(property.video_links).map(([platform, link]) => {
                if (!link) return null;
                const platformKey = platform as keyof typeof socialIcons;
                return (
                    <a 
                        key={platform} 
                        href={link} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex items-center gap-4 p-3 rounded-lg bg-secondary hover:bg-accent transition-colors"
                    >
                        <div className="text-primary w-6 h-6 flex-shrink-0">
                            {socialIcons[platformKey] || <LinkIcon />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium break-words">{truncateUrl(link, 40)}</p>
                        </div>
                    </a>
                )
            })}
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    