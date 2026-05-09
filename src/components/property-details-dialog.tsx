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
import { Property, PriceUnit } from '@/lib/types';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { SharePropertyDialog } from './share-property-dialog';
import { useState, useMemo } from 'react';
import { 
  Ruler, 
  CalendarDays, 
  Tag, 
  Wallet, 
  LandPlot, 
  Building, 
  Briefcase, 
  Video, 
  Percent, 
  User, 
  CircleDollarSign, 
  Phone, 
  Share2, 
  MapPin, 
  UtilityPole,
  FileText,
  Clock,
  MessageSquare
} from 'lucide-react';
import { VideoLinksDialog } from './video-links-dialog';
import { useCurrency } from '@/context/currency-context';
import { formatCurrency, formatUnit } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface PropertyDetailsDialogProps {
  property: Property;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const DetailBox = ({ icon, label, value, className }: { icon: React.ReactNode, label: string, value: React.ReactNode, className?: string }) => (
    <div className={cn("flex flex-col gap-1 p-3 rounded-xl bg-accent/20 border border-border/40", className)}>
        <div className="flex items-center gap-2 text-muted-foreground">
            <span className="text-primary/60">{icon}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
        </div>
        <div className="text-sm font-semibold truncate">
            {value || 'N/A'}
        </div>
    </div>
);

export function PropertyDetailsDialog({
  property,
  isOpen,
  setIsOpen,
}: PropertyDetailsDialogProps) {
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isVideoLinksOpen, setIsVideoLinksOpen] = useState(false);
  const { currency } = useCurrency();

  const formatPrice = (amount?: number, unit?: PriceUnit) => {
    if (amount === undefined || amount === null || !unit) return 'N/A';
    const valueInPkr = formatUnit(amount, unit);
    return formatCurrency(valueInPkr, currency);
  }

  const hasVideoLinks = property?.is_recorded && property?.video_links && Object.values(property.video_links).some(link => !!link);

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Sold':
        return 'bg-green-600 hover:bg-green-700 text-white border-0';
      case 'Rent Out':
        return 'bg-blue-600 hover:bg-blue-700 text-white border-0';
      case 'Sold (External)':
        return 'bg-slate-500 text-white border-0';
      default:
        return 'bg-primary text-primary-foreground border-0';
    }
  };

  if (!property) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-3xl p-0 overflow-hidden rounded-2xl">
          <div className="p-6 pb-0">
            <DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="font-mono text-[10px] bg-background">
                    {property.serial_no}
                  </Badge>
                  <Badge className={cn("text-[10px] uppercase font-bold px-2 py-0.5", getStatusBadgeClass(property.status))}>
                    {property.status}
                  </Badge>
                </div>
                
                <div className="space-y-1">
                  <DialogTitle className="font-headline text-2xl font-extrabold tracking-tight">
                    {property.auto_title || `${property.size_value} ${property.size_unit} ${property.property_type}`}
                  </DialogTitle>
                  <DialogDescription className="flex items-center gap-1 text-sm font-medium">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    {property.address}, {property.area}, {property.city}
                  </DialogDescription>
                </div>

                <div className="flex items-center gap-4 py-2 px-4 bg-primary/5 rounded-xl border border-primary/10 w-fit">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase text-primary/60 tracking-wider">Demand</span>
                        <span className="text-xl font-black text-primary">
                            {formatPrice(property.demand_amount, property.demand_unit)}
                        </span>
                    </div>
                    {property.potential_rent_amount ? (
                        <>
                            <Separator orientation="vertical" className="h-8" />
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Potential Rent</span>
                                <span className="text-lg font-bold text-muted-foreground">
                                    {formatPrice(property.potential_rent_amount, property.potential_rent_unit || 'Thousand')}
                                </span>
                            </div>
                        </>
                    ) : null}
                </div>
              </div>
            </DialogHeader>
          </div>

          <Separator className="my-4 opacity-50" />

          <ScrollArea className="max-h-[60vh] px-6">
            <div className="space-y-8 pb-8">
              
              <div className="space-y-3">
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Building className="h-3.5 w-3.5" /> Property Overview
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <DetailBox icon={<Tag className="h-3.5 w-3.5" />} label="Type" value={property.property_type} />
                    <DetailBox icon={<Ruler className="h-3.5 w-3.5" />} label="Size" value={`${property.size_value} ${property.size_unit}`} />
                    <DetailBox icon={<CalendarDays className="h-3.5 w-3.5" />} label="Added On" value={new Date(property.created_at).toLocaleDateString()} />
                    <DetailBox icon={<Phone className="h-3.5 w-3.5" />} label="Owner" value={property.owner_number} />
                  </div>
              </div>

              <div className="space-y-3">
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <LandPlot className="h-3.5 w-3.5" /> Specification & Dimensions
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {!property.is_for_rent && <DetailBox icon={<LandPlot className="h-3.5 w-3.5" />} label="Front" value={property.front_ft ? `${property.front_ft} ft` : 'N/A'} />}
                    {!property.is_for_rent && <DetailBox icon={<LandPlot className="h-3.5 w-3.5 rotate-90" />} label="Length" value={property.length_ft ? `${property.length_ft} ft` : 'N/A'} />}
                    {!property.is_for_rent && <DetailBox icon={<Ruler className="h-3.5 w-3.5" />} label="Road Size" value={property.road_size_ft ? `${property.road_size_ft} ft` : 'N/A'} />}
                    <DetailBox icon={<Building className="h-3.5 w-3.5" />} label="Storey" value={property.storey} />
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <UtilityPole className="h-3.5 w-3.5" /> Meters & Utilities
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={property.meters?.electricity ? 'default' : 'outline'} className={cn(property.meters?.electricity ? "bg-amber-500 hover:bg-amber-600 text-white" : "opacity-40")}>Electricity</Badge>
                    <Badge variant={property.meters?.gas ? 'default' : 'outline'} className={cn(property.meters?.gas ? "bg-blue-500 hover:bg-blue-600 text-white" : "opacity-40")}>Gas</Badge>
                    <Badge variant={property.meters?.water ? 'default' : 'outline'} className={cn(property.meters?.water ? "bg-cyan-500 hover:bg-cyan-600 text-white" : "opacity-40")}>Water</Badge>
                  </div>
                </div>
                <div className="space-y-3">
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5" /> {property.is_for_rent ? 'Rental Policy' : 'Property Documents'}
                  </h3>
                  <div className="p-3 rounded-xl bg-accent/10 border border-border/40 text-sm italic text-muted-foreground">
                    {property.is_for_rent ? (property.message || 'No policy notes.') : (property.documents || 'No document notes.')}
                  </div>
                </div>
              </div>

              {(property.status === 'Sold' || property.status === 'Rent Out') && (
                <div className="space-y-3">
                  <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <CircleDollarSign className="h-3.5 w-3.5" /> {property.status === 'Sold' ? 'Sale Record' : 'Rental Record'}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {property.status === 'Sold' ? (
                        <>
                          <DetailBox icon={<Wallet className="h-3.5 w-3.5" />} label="Sold Price" value={formatCurrency(property.sold_price || 0, currency)} className="bg-green-500/5 border-green-500/10" />
                          <DetailBox icon={<Percent className="h-3.5 w-3.5" />} label="Total Commission" value={formatCurrency(property.total_commission || 0, currency)} />
                          <DetailBox icon={<User className="h-3.5 w-3.5" />} label="Sold By" value={property.sold_by_agent_id} />
                        </>
                    ) : (
                        <>
                          <DetailBox icon={<Wallet className="h-3.5 w-3.5" />} label="Final Rent" value={formatPrice(property.final_rent_amount, property.final_rent_unit)} className="bg-blue-500/5 border-blue-500/10" />
                          <DetailBox icon={<User className="h-3.5 w-3.5" />} label="Tenant" value={property.tenant_name} />
                          <DetailBox icon={<Phone className="h-3.5 w-3.5" />} label="Tenant Phone" value={property.tenant_phone} />
                        </>
                    )}
                  </div>
                </div>
              )}
              
              {property.message && !property.is_for_rent && (
                <div className="space-y-3">
                   <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <MessageSquare className="h-3.5 w-3.5" /> General Notes
                  </h3>
                  <div className="p-4 rounded-xl bg-accent/10 border border-dashed border-border/60 text-sm">
                    {property.message}
                  </div>
                </div>
              )}

            </div>
          </ScrollArea>

          <DialogFooter className="p-6 border-t bg-muted/5 sm:justify-between items-center">
            <div className="flex gap-2">
                {hasVideoLinks && (
                    <Button variant="outline" className="rounded-full h-9 px-4" onClick={() => setIsVideoLinksOpen(true)}>
                        <Video className="mr-2 h-4 w-4" />
                        Watch Video
                    </Button>
                )}
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
                <Button className="flex-1 sm:flex-none rounded-full h-9 px-6 glowing-btn" onClick={() => setIsShareOpen(true)}>
                    <Share2 className="mr-2 h-4 w-4" /> Share Detail
                </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SharePropertyDialog property={property} isOpen={isShareOpen} setIsOpen={setIsShareOpen} />
      
      {hasVideoLinks && (
        <VideoLinksDialog 
            property={property}
            isOpen={isVideoLinksOpen}
            setIsOpen={setIsVideoLinksOpen}
        />
      )}
    </>
  );
}
