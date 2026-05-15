'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Buyer, Property, RecommendedProperty } from '@/lib/types';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Share2, Sparkles, RefreshCw, Video, Eye } from 'lucide-react';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { formatCurrency, formatUnit, formatPhoneNumberForWhatsApp } from '@/lib/formatters';
import { useCurrency } from '@/context/currency-context';
import { Progress } from './ui/progress';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { useFirestore } from '@/firebase/provider';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useProfile } from '@/context/profile-context';
import { PropertyDetailsDialog } from './property-details-dialog';

type VideoLinkPlatform = 'tiktok' | 'youtube' | 'instagram' | 'facebook' | 'other';
type ShareStatus = 'idle' | 'confirming' | 'shared';


interface PropertyRecommenderDialogProps {
  buyer: Buyer;
  properties: Property[];
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const calculateMatchScore = (buyer: Buyer, property: Property): RecommendedProperty | null => {
    if (property.status !== 'Available') {
        return null;
    }
    
    const buyerListingType = buyer.listing_type || 'For Sale';
    const propertyListingType = property.is_for_rent ? 'For Rent' : 'For Sale';
    if (buyerListingType !== propertyListingType) {
        return null;
    }
    
    let score = 0;
    let reasons: string[] = [];

    if (buyer.property_type_preference) {
        if (buyer.property_type_preference.toLowerCase() !== property.property_type.toLowerCase()) {
            return null;
        }
        score += 30;
        reasons.push('Property type match.');
    }

    if (buyer.area_preference) {
        const buyerAreas = buyer.area_preference.toLowerCase().split(',').map(a => a.trim()).filter(Boolean);
        const propertyArea = property.area.toLowerCase();
        if (buyerAreas.length > 0 && buyerAreas.some(area => propertyArea.includes(area))) {
            score += 25;
            reasons.push('Area preference matched.');
        }
    }

    const buyerMinBudget = formatUnit(buyer.budget_min_amount || 0, buyer.budget_min_unit || 'Thousand');
    const buyerMaxBudget = formatUnit(buyer.budget_max_amount || 0, buyer.budget_max_unit || 'Lacs');
    const propertyDemand = formatUnit(property.demand_amount, property.demand_unit);
    
    if (buyerMinBudget > 0 && buyerMaxBudget > 0) {
        if (propertyDemand >= buyerMinBudget && propertyDemand <= buyerMaxBudget) {
            score += 25;
            reasons.push('Falls within budget.');
        } else if (propertyDemand >= buyerMinBudget * 0.9 && propertyDemand <= buyerMaxBudget * 1.1) {
            score += 15;
            reasons.push('Close to budget.');
        }
    }

    const buyerMinSize = buyer.size_min_value || 0;
    const buyerMaxSize = buyer.size_max_value || 0;
    const propertySize = property.size_value;

    if (buyerMinSize > 0 && buyerMaxSize > 0 && property.size_unit === (buyer.size_min_unit || buyer.size_max_unit)) {
        if (propertySize >= buyerMinSize && propertySize <= buyerMaxSize) {
            score += 20;
            reasons.push('Size preference matched.');
        } else if (propertySize >= buyerMinSize * 0.9 && propertySize <= buyerMaxSize * 1.1) {
            score += 10;
            reasons.push('Close to size preference.');
        }
    }

    const maxScore = 30 + 25 + 25 + 20;
    const finalScore = Math.min(100, Math.round((score / maxScore) * 100));

    if (finalScore < 10) return null;

    return { ...property, matchScore: finalScore, matchReasons: reasons };
};

const RecommendedPropertyCard = ({ property, buyer, onShareConfirmed, onViewDetails }: { property: RecommendedProperty, buyer: Buyer, onShareConfirmed: () => void, onViewDetails: (property: Property) => void }) => {
    const { currency } = useCurrency();
    const { toast } = useToast();
    const { profile } = useProfile();
    const firestore = useFirestore();
    const [selectedLinks, setSelectedLinks] = useState<Record<VideoLinkPlatform, boolean>>({
        tiktok: false, youtube: false, instagram: false, facebook: false, other: false
    });
    const [shareStatus, setShareStatus] = useState<ShareStatus>('idle');

    const availableLinks = useMemo(() => {
        if (!property.is_recorded || !property.video_links) return [];
        return (Object.keys(property.video_links) as VideoLinkPlatform[]).filter(key => !!property.video_links![key as VideoLinkPlatform]);
    }, [property]);

    useEffect(() => {
        const initialSelected: Record<VideoLinkPlatform, boolean> = {
            tiktok: !!property.video_links?.tiktok,
            youtube: !!property.video_links?.youtube,
            instagram: !!property.video_links?.instagram,
            facebook: !!property.video_links?.facebook,
            other: !!property.video_links?.other
        };
        setSelectedLinks(initialSelected);
    }, [property]);

    const handleLinkSelectionChange = (platform: VideoLinkPlatform) => {
        setSelectedLinks(prev => ({ ...prev, [platform]: !prev[platform] }));
    };

    const handleShare = () => {
        const buyerPhone = formatPhoneNumberForWhatsApp(buyer.phone, buyer.country_code);
        let message = '';

        const linksToShare = Object.entries(selectedLinks)
            .filter(([_, isSelected]) => isSelected)
            .map(([platform]) => {
                const link = property.video_links?.[platform as VideoLinkPlatform];
                return link ? `${platform.charAt(0).toUpperCase() + platform.slice(1)}: ${link}` : null;
            })
            .filter(Boolean)
            .join('\n');

        const videoLinksSection = linksToShare ? `\n*Video Links:*\n${linksToShare}` : null;
    
        if (buyer.listing_type === 'For Rent') {
            const demand = `${property.demand_amount}${property.demand_unit === 'Thousand' ? 'K' : ` ${property.demand_unit}`}`;
            const utilities = [
                property.meters?.gas && '- Gas',
                property.meters?.electricity && '- Electricity',
                property.meters?.water && '- Water'
            ].filter(Boolean).join('\n');
    
            message = `*RENT PROPERTY DETAILS* 🏡
*Recommended:* ${property.matchScore}%

Serial No: ${property.serial_no}
Area: ${property.area}
Property Type: ${property.property_type}
Size/Marla: ${property.size_value} ${property.size_unit}
Portion: ${property.storey || 'N/A'}
Demand: ${demand}

*Utilities:*
${utilities || 'N/A'}${videoLinksSection || ''}`;
    
        } else {
            const demand = `${property.demand_amount} ${property.demand_unit}`;
            const rentInBaseUnit = formatUnit(property.potential_rent_amount || 0, property.potential_rent_unit || 'Thousand');
            const potentialRent = property.potential_rent_amount ? `Rs. ${formatCurrency(rentInBaseUnit, currency)}` : 'N/A';
            const utilities = [
                property.meters?.gas && '- Gas',
                property.meters?.electricity && '- Electricity',
                property.meters?.water && '- Water'
            ].filter(Boolean).join('\n');
    
            message = `*PROPERTY DETAILS* 🏡
*Recommended:* ${property.matchScore}%

Serial No: ${property.serial_no}
Area: ${property.area}
Property Type: ${property.property_type}
Size/Marla: ${property.size_value} ${property.size_unit}
Floor: ${property.storey || 'N/A'}
Road Size: ${property.road_size_ft ? `${property.road_size_ft}ft` : 'N/A'}
Front/Length: ${property.front_ft ? `${property.front_ft}/${property.length_ft || ''}` : 'N/A'}
Demand: ${demand}

*Financials:*
- Potential Rent: ${potentialRent.replace('RS ', 'Rs.')}

*Utilities:*
${utilities || 'N/A'}

*Documents:* ${property.documents || 'N/A'}${videoLinksSection || ''}`;
        }
    
        const whatsappUrl = `https://wa.me/${buyerPhone}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
        toast({ title: 'Redirecting to WhatsApp', description: `Sharing ${property.serial_no} with ${buyer.name}` });
        setShareStatus('confirming');
    };

    const handleConfirmShare = async (confirmed: boolean) => {
        if (confirmed) {
            try {
                if (!profile.agency_id) throw new Error('Agency ID not found');
                const buyerRef = doc(firestore, 'agencies', profile.agency_id, 'buyers', buyer.id);
                await updateDoc(buyerRef, {
                    sharedProperties: arrayUnion({
                        propertyId: property.id,
                        propertySerialNo: property.serial_no,
                        propertyTitle: property.auto_title,
                        sharedAt: new Date().toISOString(),
                    })
                });
                setShareStatus('shared');
                toast({ title: "Shared property recorded!" });
                onShareConfirmed();
            } catch (error) {
                console.error("Failed to record shared property:", error);
                toast({ title: "Failed to record share", variant: "destructive" });
                setShareStatus('idle');
            }
        } else {
            setShareStatus('idle');
        }
    };


    const getScoreColor = (score: number) => {
        if (score >= 90) return 'bg-green-600';
        if (score >= 75) return 'bg-green-500';
        if (score >= 60) return 'bg-yellow-500';
        if (score >= 40) return 'bg-orange-500';
        return 'bg-red-500';
    };

    return (
        <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
                <div>
                    <h4 className="font-bold">{property.auto_title}</h4>
                    <p className="text-sm text-muted-foreground">{property.address}</p>
                </div>
                <Badge variant="secondary">{formatCurrency(formatUnit(property.demand_amount, property.demand_unit), currency)}</Badge>
            </div>
            <div className="flex items-center gap-4 mt-4">
                <div className="w-24 text-center">
                    <p className="text-xs text-muted-foreground">Match Score</p>
                    <p className="text-2xl font-bold" style={{ color: `hsl(var(--${getScoreColor(property.matchScore).replace('bg-','')}-foreground))` }}>{property.matchScore}%</p>
                </div>
                <div className="flex-1">
                    <Progress value={property.matchScore} className="h-3" indicatorClassName={getScoreColor(property.matchScore)} />
                    <div className="text-xs text-muted-foreground mt-1 space-x-2">
                        {property.matchReasons.map(reason => (
                            <span key={reason}>&#x2022; {reason}</span>
                        ))}
                    </div>
                </div>
            </div>

            {availableLinks.length > 0 && (
                <div className="mt-4 pt-3 border-t">
                    <Label className="font-semibold flex items-center gap-2 mb-2"><Video className="h-4 w-4" /> Include Video Links</Label>
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                        {availableLinks.map(platform => (
                            <div key={platform} className="flex items-center space-x-2">
                                <Checkbox 
                                    id={`${property.id}-${platform}`}
                                    checked={selectedLinks[platform]}
                                    onCheckedChange={() => handleLinkSelectionChange(platform)}
                                />
                                <Label htmlFor={`${property.id}-${platform}`} className="text-sm font-normal capitalize cursor-pointer">
                                    {platform}
                                </Label>
                            </div>
                        ))}
                    </div>
                </div>
            )}

             <div className="flex justify-end items-center gap-2 mt-3">
                <Button size="sm" variant="ghost" onClick={() => onViewDetails(property)}>
                    <Eye className="mr-2 h-4 w-4" />
                    View Details
                </Button>
                {shareStatus === 'idle' && (
                    <Button size="sm" variant="outline" onClick={handleShare}>
                        <Share2 className="mr-2 h-4 w-4" />
                        Share via WhatsApp
                    </Button>
                )}
                {shareStatus === 'confirming' && (
                    <div className="flex items-center justify-end gap-2">
                        <span className="text-sm font-semibold">Shared?</span>
                        <Button size="sm" variant="outline" onClick={() => handleConfirmShare(false)}>No</Button>
                        <Button size="sm" onClick={() => handleConfirmShare(true)}>Yes</Button>
                    </div>
                )}
                {shareStatus === 'shared' && (
                    <div className="flex items-center justify-end gap-2 text-green-600 font-bold text-sm">
                        <Badge variant="success">Recorded</Badge>
                    </div>
                )}
            </div>
        </div>
    );
};


export function PropertyRecommenderDialog({
  buyer,
  properties,
  isOpen,
  setIsOpen,
}: PropertyRecommenderDialogProps) {
    
    const { toast } = useToast();
    const [refreshKey, setRefreshKey] = useState(0);
    const [propertyForDetails, setPropertyForDetails] = useState<Property | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    const handleRefresh = useCallback(() => {
        setRefreshKey(prev => prev + 1);
        toast({ title: "Recommendations Refreshed", description: "The property list has been updated." });
    }, [toast]);


    const recommendedProperties = useMemo(() => {
        if (!buyer || !properties) return [];

        return properties
            .map(prop => calculateMatchScore(buyer, prop))
            .filter((p): p is RecommendedProperty => p !== null)
            .sort((a, b) => b.matchScore - a.matchScore);
    }, [buyer, properties, refreshKey]);

    const handleViewDetails = (property: Property) => {
        setPropertyForDetails(property);
        setIsDetailsOpen(true);
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                        <div className="flex justify-between items-center">
                            <DialogTitle className="font-headline flex items-center gap-2 text-2xl">
                                <Sparkles />
                                Property Recommendations for {buyer.name}
                            </DialogTitle>
                            <Button variant="outline" size="sm" onClick={handleRefresh}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Refresh
                            </Button>
                        </div>
                        <DialogDescription>
                            Based on the buyer's preferences, here are the top property matches.
                        </DialogDescription>
                    </DialogHeader>

                    <ScrollArea className="h-[60vh] pr-4">
                        <div className="space-y-4 py-4">
                            {recommendedProperties.length > 0 ? (
                                recommendedProperties.map(prop => (
                                    <RecommendedPropertyCard 
                                        key={prop.id} 
                                        property={prop} 
                                        buyer={buyer} 
                                        onShareConfirmed={handleRefresh} 
                                        onViewDetails={handleViewDetails}
                                    />
                                ))
                            ) : (
                                <div className="text-center py-10 text-muted-foreground">
                                    <p>No suitable properties found based on the current criteria.</p>
                                    <p className="text-xs">Try adjusting the buyer's preferences for better results.</p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>

                    <DialogFooter>
                        <Button variant="secondary" onClick={() => setIsOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {propertyForDetails && (
                <PropertyDetailsDialog 
                    property={propertyForDetails}
                    isOpen={isDetailsOpen}
                    setIsOpen={setIsDetailsOpen}
                />
            )}
        </>
    );
}
