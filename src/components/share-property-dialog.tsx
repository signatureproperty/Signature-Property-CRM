'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { Property } from '@/lib/types';
import { Copy, Share2, Check, Video, FileArchive, Wallet, PlugZap } from 'lucide-react';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Separator } from './ui/separator';

interface SharePropertyDialogProps {
    property: Property;
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
}

type VideoLinkPlatform = 'tiktok' | 'youtube' | 'instagram' | 'facebook' | 'other';

const generateShareableText = (
    property: Property,
    selectedLinks: Record<VideoLinkPlatform, boolean> = {
        tiktok: false, youtube: false, instagram: false, facebook: false, other: false
    },
    includeDocs: boolean = false,
    includeFinancials: boolean = false,
    includeUtilities: boolean = false,
) => {
    if (!property) return { forCustomer: '', forAgent: '' };

    const formatLink = (platform: string, link: string) => {
        const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
        return `${platformName}: ${link}`;
    }

    const linksToShare = Object.entries(selectedLinks)
        .filter(([_, isSelected]) => isSelected)
        .map(([platform]) => {
            const link = property.video_links?.[platform as VideoLinkPlatform];
            return link ? formatLink(platform, link) : null;
        })
        .filter(Boolean)
        .join('\n');

    const docsToShare = includeDocs && property.uploaded_documents 
        ? property.uploaded_documents.map(doc => `- ${doc.name}: ${doc.url}`).join('\n')
        : null;

    const details = {
        serialNo: `Serial No: ${property.serial_no}`,
        area: `Area: ${property.area}`,
        propertyType: `Property Type: ${property.property_type}`,
        size: `Size/Marla: ${property.size_value} ${property.size_unit}`,
        storey: property.storey ? `Floor: ${property.storey}` : null,
        roadSize: property.road_size_ft ? `Road Size: ${property.road_size_ft}ft` : null,
        front: property.front_ft ? `Front: ${property.front_ft}ft` : null,
        length: property.length_ft ? `Length: ${property.length_ft}ft` : null,
        demand: `Demand: ${property.demand_amount} ${property.demand_unit}`,
        address: `Full Address: ${property.address}`,
        ownerNumber: `Owner Number: ${property.owner_number}`,
        potentialRent: property.potential_rent_amount ? `- Potential Rent: ${property.potential_rent_amount}K` : '- Potential Rent: N/A',
        documents: `Documents: ${property.documents || 'N/A'}`,
        videoLinks: linksToShare ? `\n*Video Links:*\n${linksToShare}` : null,
        uploadedDocs: docsToShare ? `\n*Document Links:*\n${docsToShare}` : null,
    };

    const utilities = [
        property.meters?.gas && '*- Gas*',
        property.meters?.electricity && '*- Electricity*',
        property.meters?.water && '*- Water*'
    ].filter(Boolean).join('\n') || 'No utilities listed.';

    const customerFinancialsSection = includeFinancials ? `\n*Financials:*\n${details.potentialRent}` : '';
    const agentFinancialsSection = `\n*Financials:*\n${details.potentialRent}`; 
    const utilitiesSection = includeUtilities ? `\n*Utilities:*\n${utilities}` : '';

    const baseCustomerParts = [
        '*PROPERTY DETAILS 🏡*',
        details.serialNo,
        details.area,
        details.propertyType,
        details.size,
        details.storey,
        details.roadSize,
        details.front,
        details.length,
        details.demand,
        customerFinancialsSection,
        utilitiesSection,
        '\n*Documents:*',
        details.documents,
    ];
    if (details.videoLinks) baseCustomerParts.push(details.videoLinks);
    if (details.uploadedDocs) baseCustomerParts.push(details.uploadedDocs);
    const forCustomer = baseCustomerParts.filter(Boolean).join('\n');

    const baseAgentParts = [
        '*PROPERTY DETAILS 🏡*',
        details.serialNo,
        details.area,
        details.address,
        details.propertyType,
        details.size,
        details.storey,
        details.roadSize,
        details.front,
        details.length,
        details.demand,
        details.ownerNumber,
        agentFinancialsSection,
        `\n*Utilities:*\n${utilities}`,
        '\n*Documents:*',
        details.documents,
    ];
    if (details.videoLinks) baseAgentParts.push(details.videoLinks);
    if (details.uploadedDocs) baseAgentParts.push(details.uploadedDocs);
    const forAgent = baseAgentParts.filter(Boolean).join('\n');

    return { forCustomer, forAgent };
};


export function SharePropertyDialog({
  property,
  isOpen,
  setIsOpen,
}: SharePropertyDialogProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState<'customer' | 'agent' | null>(null);
  const [customerText, setCustomerText] = useState('');
  const [agentText, setAgentText] = useState('');
  const [loading, setLoading] = useState(false);
  const [includeDocs, setIncludeDocs] = useState(true);
  const [includeFinancials, setIncludeFinancials] = useState(true);
  const [includeUtilities, setIncludeUtilities] = useState(true);

  const [selectedLinks, setSelectedLinks] = useState<Record<VideoLinkPlatform, boolean>>({
      tiktok: false, youtube: false, instagram: false, facebook: false, other: false
  });

  const availableLinks = useMemo(() => {
    if (!property.is_recorded || !property.video_links) return [];
    return (Object.keys(property.video_links) as VideoLinkPlatform[]).filter(key => !!property.video_links![key as VideoLinkPlatform]);
  }, [property]);

  useEffect(() => {
    if (isOpen && property) {
        setLoading(true);
        const initialSelected: Record<VideoLinkPlatform, boolean> = {
             tiktok: !!property.video_links?.tiktok,
             youtube: !!property.video_links?.youtube,
             instagram: !!property.video_links?.instagram,
             facebook: !!property.video_links?.facebook,
             other: !!property.video_links?.other
        };
        setSelectedLinks(initialSelected);
        const { forCustomer, forAgent } = generateShareableText(property, initialSelected, includeDocs, includeFinancials, includeUtilities);
        setCustomerText(forCustomer);
        setAgentText(forAgent);
        setLoading(false);
    }
  }, [isOpen, property, includeDocs, includeFinancials, includeUtilities]);

  useEffect(() => {
    if (isOpen && property) {
       const { forCustomer, forAgent } = generateShareableText(property, selectedLinks, includeDocs, includeFinancials, includeUtilities);
       setCustomerText(forCustomer);
       setAgentText(forAgent);
    }
  }, [selectedLinks, isOpen, property, includeDocs, includeFinancials, includeUtilities]);

  const handleLinkSelectionChange = (platform: VideoLinkPlatform) => {
      setSelectedLinks(prev => ({ ...prev, [platform]: !prev[platform] }));
  };


  const handleCopy = (text: string, type: 'customer' | 'agent') => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard!' });
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleShare = async (text: string) => {
    const encodedText = encodeURIComponent(text);
    const whatsappUrl = `https://wa.me/?text=${encodedText}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };


  return (
    <Dialog
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-headline">
            Share Property: {property.auto_title}
          </DialogTitle>
        </DialogHeader>

          <div className="space-y-4">
              <p className="text-sm font-semibold">Include Sections:</p>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                 <div className="flex items-center space-x-2">
                      <Checkbox id="include-financials" checked={includeFinancials} onCheckedChange={(checked) => setIncludeFinancials(checked as boolean)} />
                      <Label htmlFor="include-financials" className="font-normal flex items-center gap-2 cursor-pointer"><Wallet/> Financials</Label>
                  </div>
                   <div className="flex items-center space-x-2">
                      <Checkbox id="include-utilities" checked={includeUtilities} onCheckedChange={(checked) => setIncludeUtilities(checked as boolean)} />
                      <Label htmlFor="include-utilities" className="font-normal flex items-center gap-2 cursor-pointer"><PlugZap/> Utilities</Label>
                  </div>
                 {property.uploaded_documents && property.uploaded_documents.length > 0 && (
                     <div className="flex items-center space-x-2">
                        <Checkbox id="include-docs" checked={includeDocs} onCheckedChange={(checked) => setIncludeDocs(checked as boolean)} />
                        <Label htmlFor="include-docs" className="font-normal flex items-center gap-2 cursor-pointer"><FileArchive/> Document Links</Label>
                    </div>
                )}
              </div>
          </div>
          
          {availableLinks.length > 0 && (
              <div className="space-y-2 pt-4 border-t">
                <Label className="font-semibold flex items-center gap-2"><Video /> Include Video Links</Label>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {availableLinks.map(platform => (
                        <div key={platform} className="flex items-center space-x-2">
                            <Checkbox 
                                id={`link-${platform}`}
                                checked={selectedLinks[platform as VideoLinkPlatform]}
                                onCheckedChange={() => handleLinkSelectionChange(platform as VideoLinkPlatform)}
                            />
                            <Label htmlFor={`link-${platform}`} className="text-sm font-normal capitalize cursor-pointer">
                                {platform}
                            </Label>
                        </div>
                    ))}
                </div>
              </div>
          )}


          <Tabs defaultValue="customer" className="pt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="customer">For Customer</TabsTrigger>
              <TabsTrigger value="agent">For Agent</TabsTrigger>
            </TabsList>
            <TabsContent value="customer">
              <Textarea
                readOnly
                value={customerText}
                className="h-60 mt-4"
                disabled={loading}
              />
              <div className="flex gap-2 mt-4">
                <Button className="w-full" variant="secondary" onClick={() => handleCopy(customerText, 'customer')} disabled={loading}>
                    {copied === 'customer' ? <Check className="mr-2" /> : <Copy className="mr-2" />}
                    {copied === 'customer' ? 'Copied' : 'Copy Text'}
                </Button>
                <Button className="w-full" onClick={() => handleShare(customerText)} disabled={loading}>
                    <Share2 className="mr-2" /> Share on WhatsApp
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="agent">
              <Textarea
                readOnly
                value={agentText}
                className="h-60 mt-4"
                disabled={loading}
              />
               <div className="flex gap-2 mt-4">
                <Button className="w-full" variant="secondary" onClick={() => handleCopy(agentText, 'agent')} disabled={loading}>
                    {copied === 'agent' ? <Check className="mr-2" /> : <Copy className="mr-2" />}
                    {copied === 'agent' ? 'Copied' : 'Copy Text'}
                </Button>
                <Button className="w-full" onClick={() => handleShare(agentText)} disabled={loading}>
                    <Share2 className="mr-2" /> Share on WhatsApp
                </Button>
              </div>
            </TabsContent>
          </Tabs>

        <DialogFooter className="sm:justify-start">
           <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
