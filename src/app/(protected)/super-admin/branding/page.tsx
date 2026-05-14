
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useFirestore } from '@/firebase/provider';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Palette, Upload, Image as ImageIcon, Save, Smartphone, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { BrandingConfig } from '@/lib/types';
import { uploadToR2 } from '@/lib/r2-client';

export default function BrandingPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    
    const [config, setConfig] = useState<BrandingConfig>({
        appName: 'Signature Property CRM',
        appDescription: 'Real Estate Management Platform',
        pwaIconUrl: '',
        updatedAt: ''
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const docRef = doc(firestore, 'system_config', 'branding');
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setConfig(docSnap.data() as BrandingConfig);
                }
            } catch (error) {
                console.error("Error fetching config:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchConfig();
    }, [firestore]);

    const handleSaveConfig = async () => {
        setIsSaving(true);
        try {
            const docRef = doc(firestore, 'system_config', 'branding');
            await setDoc(docRef, {
                ...config,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            toast({ title: 'Branding Updated', description: 'Changes have been saved successfully.' });
        } catch (error) {
            toast({ title: 'Error', description: 'Could not save branding settings.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            toast({ title: 'File too large', description: 'Please select an image smaller than 5MB.', variant: 'destructive' });
            return;
        }

        setIsUploading(true);
        
        try {
            const fileName = `pwa-icon-${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
            const path = `system/${fileName}`;
            
            // Upload to Cloudflare R2 using our S3 logic
            const url = await uploadToR2(file, path);
            
            setConfig(prev => ({ ...prev, pwaIconUrl: url }));
            toast({ title: 'Icon Uploaded to R2', description: 'Click "Save Branding" to finalize changes.' });
        } catch (error: any) {
            console.error("R2 Upload error:", error);
            toast({ title: 'Upload Failed', description: error.message || 'Check your internet and R2 CORS settings.', variant: 'destructive' });
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    if (isLoading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-primary h-10 w-10" /></div>;
    }

    return (
        <div className="space-y-10 animate-fade-in pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black tracking-tight font-headline flex items-center gap-3">
                        <Palette className="h-8 w-8 text-primary" /> App Branding
                    </h1>
                    <p className="text-muted-foreground font-medium">Customize platform identity via Cloudflare R2 Storage.</p>
                </div>
                <Button className="rounded-full glowing-btn px-8" onClick={handleSaveConfig} disabled={isSaving || isUploading}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Branding
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <Card className="border-none shadow-xl">
                        <CardHeader>
                            <CardTitle className="text-xl font-bold flex items-center gap-2">
                                <Globe className="h-5 w-5 text-primary" /> General Identity
                            </CardTitle>
                            <CardDescription>Updates are stored in Firestore, icons in Cloudflare R2.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="appName">Application Name</Label>
                                <Input 
                                    id="appName" 
                                    value={config.appName} 
                                    onChange={e => setConfig(prev => ({...prev, appName: e.target.value}))}
                                    placeholder="e.g. My Agency CRM"
                                    className="h-12 text-lg font-bold"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="appDesc">Short Description</Label>
                                <Textarea 
                                    id="appDesc" 
                                    value={config.appDescription} 
                                    onChange={e => setConfig(prev => ({...prev, appDescription: e.target.value}))}
                                    placeholder="The ultimate real-estate CRM..."
                                    rows={3}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-xl overflow-hidden">
                        <CardHeader>
                            <CardTitle className="text-xl font-bold flex items-center gap-2">
                                <Smartphone className="h-5 w-5 text-primary" /> PWA & App Icon (R2)
                            </CardTitle>
                            <CardDescription>
                                This icon is fetched directly from your Cloudflare R2 bucket.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-48 h-48 rounded-[2.5rem] border-4 border-dashed border-primary/20 bg-muted/30 flex items-center justify-center overflow-hidden shadow-inner group relative">
                                        {config.pwaIconUrl ? (
                                            <img 
                                                src={config.pwaIconUrl} 
                                                alt="App Icon" 
                                                className="w-full h-full object-cover transition-transform group-hover:scale-110"
                                            />
                                        ) : (
                                            <ImageIcon className="h-16 w-16 text-muted-foreground/30" />
                                        )}
                                        {isUploading && (
                                            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white p-4">
                                                <Loader2 className="h-8 w-8 animate-spin mb-2" />
                                                <span className="text-xs font-bold uppercase tracking-widest text-center">Uploading to R2...</span>
                                            </div>
                                        )}
                                    </div>
                                    <Badge variant="outline" className="font-mono text-[10px]">512 x 512 recommended</Badge>
                                </div>

                                <div className="flex-1 space-y-4 pt-4">
                                    <div className="space-y-2">
                                        <h4 className="font-bold text-sm">Upload New Icon</h4>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            For the best mobile experience, use a high-resolution PNG image with a square aspect ratio. 
                                            This icon will represent your brand on all user devices after installation.
                                        </p>
                                    </div>
                                    <Button variant="outline" className="w-full h-12 gap-2" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                                        <Upload className="h-4 w-4" />
                                        Select Image File
                                    </Button>
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        className="hidden" 
                                        accept="image/png, image/jpeg" 
                                        onChange={handleIconUpload}
                                    />
                                </div>
                            </div>

                            <Separator />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10">
                                    <h5 className="text-xs font-black uppercase tracking-wider text-primary mb-2">Live Preview</h5>
                                    <div className="flex items-center gap-3 bg-card border rounded-lg p-2 shadow-sm">
                                        <div className="w-4 h-4 bg-muted rounded flex items-center justify-center overflow-hidden">
                                            {config.pwaIconUrl && <img src={config.pwaIconUrl} alt="fav" className="w-full h-full object-cover" />}
                                        </div>
                                        <span className="text-[10px] font-medium truncate">{config.appName}</span>
                                    </div>
                                </div>
                                <div className="p-4 rounded-2xl bg-muted/30 border">
                                    <h5 className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-2">Storage Node</h5>
                                    <p className="text-[10px] font-mono break-all opacity-60">cloudflare-r2-signature-crm-assets</p>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="bg-muted/50 p-4">
                            <p className="text-[10px] text-muted-foreground font-medium italic text-center w-full">
                                Note: Ensure CORS is enabled on R2 for browser uploads to work.
                            </p>
                        </CardFooter>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="border-none shadow-xl bg-gradient-to-br from-primary to-blue-700 text-primary-foreground">
                        <CardHeader>
                            <CardTitle className="text-lg font-black tracking-tight">Cloudflare R2 Advantage</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm opacity-90 leading-relaxed">
                                By using Cloudflare R2, you get high-speed asset delivery with zero egress fees. 
                                Your app icons and documents will load instantly across the globe.
                            </p>
                            <div className="pt-4 flex items-center justify-center">
                                <div className="p-4 bg-white/10 rounded-full animate-pulse">
                                    <Smartphone className="h-12 w-12" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-md">
                        <CardHeader>
                            <CardTitle className="text-sm font-bold">R2 Credentials Active</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="text-xs space-y-3 text-muted-foreground">
                                <li className="flex gap-2"><div className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" /> Bucket: signature-crm-assets</li>
                                <li className="flex gap-2"><div className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" /> S3 Client: @aws-sdk/client-s3</li>
                                <li className="flex gap-2"><div className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" /> Region: auto</li>
                                <li className="flex gap-2"><div className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" /> Max file size: 5MB.</li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
