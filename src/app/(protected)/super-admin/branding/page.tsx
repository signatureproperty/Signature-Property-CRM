
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
import { Loader2, Palette, Upload, Image as ImageIcon, Save, Smartphone, Globe, CheckCircle2 } from 'lucide-react';
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
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    
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
                    const data = docSnap.data() as BrandingConfig;
                    setConfig(data);
                    if (data.pwaIconUrl) setPreviewUrl(data.pwaIconUrl);
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

        // Show local preview immediately
        const localUrl = URL.createObjectURL(file);
        setPreviewUrl(localUrl);
        setIsUploading(true);
        
        try {
            const fileName = `pwa-icon-${Date.now()}.png`;
            const path = `system/${fileName}`;
            
            // Upload to Cloudflare R2
            const permanentUrl = await uploadToR2(file, path);
            
            setConfig(prev => ({ ...prev, pwaIconUrl: permanentUrl }));
            toast({ title: 'Image Uploaded!', description: 'Click "Save Branding" to finalize changes.' });
        } catch (error: any) {
            console.error("R2 Upload error:", error);
            toast({ title: 'Upload Failed', description: 'Please check your internet or R2 settings.', variant: 'destructive' });
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    if (isLoading) {
        return <div className="flex h-screen items-center justify-center bg-background"><Loader2 className="animate-spin text-primary h-12 w-12" /></div>;
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
                    <Card className="border-none shadow-2xl bg-card/40 backdrop-blur-xl">
                        <CardHeader>
                            <CardTitle className="text-xl font-bold flex items-center gap-2">
                                <Globe className="h-5 w-5 text-primary" /> General Identity
                            </CardTitle>
                            <CardDescription>Updates are stored in Firestore, icons in Cloudflare R2.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="appName" className="text-xs font-black uppercase tracking-widest opacity-70">Application Name</Label>
                                <Input 
                                    id="appName" 
                                    value={config.appName} 
                                    onChange={e => setConfig(prev => ({...prev, appName: e.target.value}))}
                                    placeholder="e.g. My Agency CRM"
                                    className="h-12 text-lg font-bold bg-background/50"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="appDesc" className="text-xs font-black uppercase tracking-widest opacity-70">Short Description</Label>
                                <Textarea 
                                    id="appDesc" 
                                    value={config.appDescription} 
                                    onChange={e => setConfig(prev => ({...prev, appDescription: e.target.value}))}
                                    placeholder="The ultimate real-estate CRM..."
                                    rows={3}
                                    className="bg-background/50"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-2xl overflow-hidden bg-card/40 backdrop-blur-xl">
                        <CardHeader>
                            <CardTitle className="text-xl font-bold flex items-center gap-2">
                                <Smartphone className="h-5 w-5 text-primary" /> PWA & App Icon (R2)
                            </CardTitle>
                            <CardDescription>
                                This icon will represent your app on mobile home screens.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-48 h-48 rounded-[2.5rem] border-4 border-dashed border-primary/20 bg-muted/30 flex items-center justify-center overflow-hidden shadow-inner group relative">
                                        {previewUrl ? (
                                            <img 
                                                src={previewUrl} 
                                                alt="App Icon" 
                                                className="w-full h-full object-cover transition-transform group-hover:scale-110"
                                                onError={() => setPreviewUrl(null)}
                                            />
                                        ) : (
                                            <ImageIcon className="h-16 w-16 text-muted-foreground/30" />
                                        )}
                                        {isUploading && (
                                            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white p-4">
                                                <Loader2 className="h-8 w-8 animate-spin mb-2" />
                                                <span className="text-[10px] font-black uppercase tracking-widest text-center">Uploading...</span>
                                            </div>
                                        )}
                                    </div>
                                    <Badge variant="outline" className="font-mono text-[10px] bg-background">512 x 512 Recommended</Badge>
                                </div>

                                <div className="flex-1 space-y-5 pt-4">
                                    <div className="space-y-2">
                                        <h4 className="font-bold text-base flex items-center gap-2">
                                            {previewUrl && !isUploading && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                                            Upload App Logo
                                        </h4>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            For best results, upload a <strong>square PNG</strong> with high resolution. This icon will appear on Android and iOS devices when users install your CRM.
                                        </p>
                                    </div>
                                    <Button variant="outline" className="w-full h-12 gap-2 border-primary/30 hover:bg-primary/5 rounded-2xl" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
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

                            <Separator className="opacity-20" />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-5 rounded-3xl bg-primary/5 border border-primary/10">
                                    <h5 className="text-[10px] font-black uppercase tracking-widest text-primary mb-3">Instant Preview</h5>
                                    <div className="flex items-center gap-3 bg-card border rounded-2xl p-3 shadow-md">
                                        <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center overflow-hidden">
                                            {previewUrl && <img src={previewUrl} alt="fav" className="w-full h-full object-cover" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className="text-xs font-bold truncate block">{config.appName}</span>
                                            <span className="text-[9px] text-muted-foreground uppercase">Installed Web App</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-5 rounded-3xl bg-muted/20 border flex flex-col justify-center">
                                    <h5 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Cloudflare Endpoint</h5>
                                    <p className="text-[10px] font-mono break-all opacity-60">signature-crm-assets.r2.dev</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="border-none shadow-2xl bg-gradient-to-br from-primary via-blue-600 to-blue-800 text-primary-foreground rounded-[2rem]">
                        <CardHeader>
                            <CardTitle className="text-lg font-black tracking-tight">Enterprise Storage</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm opacity-90 leading-relaxed font-medium">
                                We use Cloudflare R2 for blazing fast asset delivery. Your app icons and documents load instantly with zero egress fees.
                            </p>
                            <div className="pt-6 flex items-center justify-center">
                                <div className="p-5 bg-white/10 rounded-[2rem] shadow-2xl animate-pulse">
                                    <Smartphone className="h-14 w-14" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-xl bg-card/60 backdrop-blur-md rounded-2xl">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">R2 Status</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="text-[11px] space-y-3 font-bold">
                                <li className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500" /> BUCKET: signature-crm-assets</li>
                                <li className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500" /> REGION: Auto (Global)</li>
                                <li className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500" /> CORS: Enabled</li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
