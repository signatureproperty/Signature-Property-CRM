'use client';

import { useState, useRef, ChangeEvent, useEffect } from 'react';
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
import { Loader2, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface AvatarCropDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onSave: (dataUrl: string) => void;
  isSaving: boolean;
}

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number
): Crop {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}


export function AvatarCropDialog({
  isOpen,
  setIsOpen,
  onSave,
  isSaving,
}: AvatarCropDialogProps) {
  const [imgSrc, setImgSrc] = useState('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<Crop>();
  const imgRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen) {
        setImgSrc('');
        setCrop(undefined);
        setCompletedCrop(undefined);
    }
  }, [isOpen]);

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, 1));
  };


  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            toast({
                title: 'File too large',
                description: 'Please select an image smaller than 5MB.',
                variant: 'destructive',
            });
            return;
        }
        setCrop(undefined)
        const reader = new FileReader()
        reader.addEventListener('load', () =>
            setImgSrc(reader.result?.toString() || '')
        )
        reader.readAsDataURL(e.target.files[0])
    }
  };

  const handleSave = async () => {
    if (!completedCrop || !imgRef.current) {
        toast({ title: 'No crop selection', description: 'Please select and crop an area.', variant: 'destructive'});
        return;
    }

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    canvas.width = Math.floor(completedCrop.width * scaleX);
    canvas.height = Math.floor(completedCrop.height * scaleY);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        toast({ title: 'Error', description: 'Could not process image.', variant: 'destructive' });
        return;
    }

    const cropX = completedCrop.x * scaleX;
    const cropY = completedCrop.y * scaleY;

    ctx.drawImage(
      image,
      cropX,
      cropY,
      canvas.width,
      canvas.height,
      0,
      0,
      canvas.width,
      canvas.height
    );

    // Convert to WebP for storage efficiency
    const webpImage = canvas.toDataURL('image/webp', 0.85);
    onSave(webpImage);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Update Profile Picture</DialogTitle>
          <DialogDescription>
            Select and crop your new profile picture. It will be converted to WebP for optimization.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
            <Input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/png, image/jpeg, image/gif"
                onChange={handleFileChange}
            />

            {!imgSrc && (
                 <div 
                    className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50"
                    onClick={() => fileInputRef.current?.click()}
                 >
                    <Upload className="h-10 w-10 text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">Click to upload an image</p>
                    <p className="text-xs text-muted-foreground">(Max 5MB)</p>
                </div>
            )}

            {imgSrc && (
                <div className="flex justify-center">
                    <ReactCrop
                        crop={crop}
                        onChange={c => setCrop(c)}
                        onComplete={c => setCompletedCrop(c)}
                        aspect={1}
                        minWidth={100}
                        minHeight={100}
                        circularCrop
                    >
                        <img
                            ref={imgRef}
                            alt="Crop me"
                            src={imgSrc}
                            onLoad={onImageLoad}
                            style={{ maxHeight: '70vh' }}
                        />
                    </ReactCrop>
                </div>
            )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!completedCrop || isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Picture
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}