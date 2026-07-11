'use client';

import { useState, useRef, ChangeEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ImageUploadDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onSave: (dataUrl: string) => void;
  isSaving: boolean;
}

export function ImageUploadDialog({
  isOpen,
  setIsOpen,
  onSave,
  isSaving,
}: ImageUploadDialogProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        toast({
          title: 'File too large',
          description: 'Please select an image smaller than 2MB.',
          variant: 'destructive',
        });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setImageSrc(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (imageSrc) {
      onSave(imageSrc);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) {
            setImageSrc(null); // Reset on close
        }
        setIsOpen(open);
    }}>
      <DialogContent className="sm:max-w-md max-h-[70vh] sm:max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Update Profile Picture</DialogTitle>
          <DialogDescription>
            Select a new profile picture.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center justify-center space-y-4 py-4">
            <Avatar className="h-40 w-40 border-4 border-dashed">
                <AvatarImage src={imageSrc!} className="object-cover" />
                <AvatarFallback className="bg-muted">
                    <Upload className="h-10 w-10 text-muted-foreground" />
                </AvatarFallback>
            </Avatar>
            <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
            >
                Choose Image
            </Button>
            <Input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/png, image/jpeg, image/gif"
                onChange={handleFileChange}
            />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!imageSrc || isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Picture
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
