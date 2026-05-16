
'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Property, PropertyType, SizeUnit, PriceUnit } from '@/lib/types';
import { useProfile } from '@/context/profile-context';
import { useToast } from '@/hooks/use-toast';
import { ClipboardCopy, ClipboardCheck, List, SlidersHorizontal, CheckSquare, ChevronDown, Search, X, FileText, RotateCcw, ListChecks } from 'lucide-react';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { formatUnit } from '@/lib/formatters';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { cn } from '@/lib/utils';

interface ListGeneratorToolProps {
  allProperties: Property[];
}

type SelectableField = 'serial_no' | 'owner_number' | 'area' | 'address' | 'size' | 'demand' | 'property_type' | 'status' | 'road_size_ft' | 'storey' | 'utilities' | 'documents';

const fieldLabels: Record<SelectableField, string> = {
  serial_no: 'Serial No',
  owner_number: 'Owner Number',
  area: 'Area',
  address: 'Full Address',
  size: 'Size',
  demand: 'Demand',
  property_type: 'Property Type',
  status: 'Status',
  road_size_ft: 'Road Size',
  storey: 'Storey',
  utilities: 'Utilities',
  documents: 'Documents'
};

const propertyTypesForFilter: (PropertyType | 'All' | 'Other')[] = [
    'All', 'House', 'Flat', 'Farm House', 'Penthouse', 'Plot', 'Residential Plot', 'Commercial Plot', 'Agricultural Land', 'Industrial Land', 'Office', 'Shop', 'Warehouse', 'Factory', 'Building', 'Other'
];
const sizeUnits: SizeUnit[] = ['Marla', 'SqFt', 'Kanal', 'Acre', 'Maraba'];
const demandUnits: PriceUnit[] = ['Lacs', 'Crore'];

export function ListGeneratorTool({ allProperties }: ListGeneratorToolProps) {
  const { profile } = useProfile();
  const { toast } = useToast();
  const [selectedFields, setSelectedFields] = useState<SelectableField[]>([
    'serial_no', 'area', 'address', 'size', 'demand', 'property_type',
    'status', 'road_size_ft', 'storey', 'utilities', 'documents'
  ]);
  
  // Area Filter State
  const [areaFilters, setAreaFilters] = useState<string[]>([]);
  const [areaSearch, setAreaSearch] = useState('');
  
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<PropertyType | 'All' | 'Other'>('All');
  const [otherPropertyTypeFilter, setOtherPropertyTypeFilter] = useState('');
  const [minSizeFilter, setMinSizeFilter] = useState('');
  const [maxSizeFilter, setMaxSizeFilter] = useState('');
  const [sizeUnitFilter, setSizeUnitFilter] = useState<SizeUnit>('Marla');
  const [minDemandFilter, setMinDemandFilter] = useState('');
  const [maxDemandFilter, setMaxDemandFilter] = useState('');
  const [demandUnitFilter, setDemandUnitFilter] = useState<PriceUnit>('Lacs');

  const [filteredProperties, setFilteredProperties] = useState<Property[]>([]);
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const [generatedList, setGeneratedList] = useState('');
  const [copied, setCopied] = useState(false);

  // Get unique areas from all properties for the dropdown
  const uniqueAreas = useMemo(() => {
    return Array.from(new Set(allProperties.map(p => p.area)))
      .filter(Boolean)
      .sort();
  }, [allProperties]);

  const filteredAreas = useMemo(() => {
    return uniqueAreas.filter(a => a.toLowerCase().includes(areaSearch.toLowerCase()));
  }, [uniqueAreas, areaSearch]);

  const handleFieldChange = (field: SelectableField) => {
    setSelectedFields((prev) =>
      prev.includes(field)
        ? prev.filter((f) => f !== field)
        : [...prev, field]
    );
  };
  
  const handleFilterProperties = (e?: React.FormEvent) => {
    e?.preventDefault();
    
    const minDemandBase = minDemandFilter ? formatUnit(parseFloat(minDemandFilter), demandUnitFilter) : 0;
    const maxDemandBase = maxDemandFilter ? formatUnit(parseFloat(maxDemandFilter), demandUnitFilter) : Infinity;

    const filtered = allProperties.filter(p => {
        const demandBase = formatUnit(p.demand_amount, p.demand_unit);

        // Area Match logic
        const areaMatch = areaFilters.length === 0 || areaFilters.includes(p.area);
        
        let typeMatch = true;
        if (propertyTypeFilter !== 'All') {
            if (propertyTypeFilter === 'Other') {
                typeMatch = p.property_type.toLowerCase().includes(otherPropertyTypeFilter.toLowerCase());
            } else {
                typeMatch = p.property_type === propertyTypeFilter;
            }
        }
        
        const minSizeMatch = !minSizeFilter || (p.size_value >= parseFloat(minSizeFilter) && p.size_unit === sizeUnitFilter);
        const maxSizeMatch = !maxSizeFilter || (p.size_value <= parseFloat(maxSizeFilter) && p.size_unit === sizeUnitFilter);
        const minDemandMatch = !minDemandFilter || demandBase >= minDemandBase;
        const maxDemandMatch = !maxDemandFilter || demandBase <= maxDemandBase;
        
        return p.status === 'Available' && areaMatch && typeMatch && minSizeMatch && maxSizeMatch && minDemandMatch && maxDemandMatch;
    });

    setFilteredProperties(filtered);
    setSelectedProperties([]); // Reset selection
    setGeneratedList('');
    
    if (filtered.length === 0) {
        toast({ title: "No properties found", description: "Try adjusting your filters.", variant: "destructive" });
    } else {
        toast({ title: "Filters Applied", description: `Found ${filtered.length} properties.` });
    }
  }

  const handlePropertySelection = (propertyId: string) => {
    setSelectedProperties((prev) => 
        prev.includes(propertyId) 
            ? prev.filter(id => id !== propertyId) 
            : [...prev, propertyId]
    );
  }

  const handleSelectAll = (checked: boolean) => {
      if (checked) {
          setSelectedProperties(filteredProperties.map(p => p.id));
      } else {
          setSelectedProperties([]);
      }
  }

  const handleSelectAllAreas = () => {
    if (areaFilters.length === uniqueAreas.length) {
        setAreaFilters([]);
    } else {
        setAreaFilters([...uniqueAreas]);
    }
  };

  const generateList = () => {
    if (selectedProperties.length === 0) {
        toast({
            title: "No Properties Selected",
            description: "Please select at least one property from the list.",
            variant: "destructive"
        });
        return;
    }

    const propertiesToInclude = allProperties.filter(p => selectedProperties.includes(p.id));

    // Group properties by type
    const groupedProperties = propertiesToInclude.reduce((acc, property) => {
        const type = (property.property_type || 'Other').toUpperCase();
        if (!acc[type]) {
            acc[type] = [];
        }
        acc[type].push(property);
        return acc;
    }, {} as Record<string, Property[]>);

    let listString = `*${profile.agencyName.toUpperCase()}*\n`;
    listString += `Property Inventory List - ${new Date().toLocaleDateString()}\n`;
    listString += `--------------------------------\n\n`;

    // Iterate over grouped properties
    const sortedTypes = Object.keys(groupedProperties).sort();
    
    for (const type of sortedTypes) {
        listString += `*[ ${type}S ]*\n`; // e.g., *[ HOUSES ]*
        listString += `--------------------------------\n`;
        
        groupedProperties[type]
            .sort((a, b) => b.size_value - a.size_value) // Sort within group
            .forEach((p, index) => {
                listString += `${index + 1}).\n`;
                
                if (selectedFields.includes('serial_no')) listString += `*Serial No:* ${p.serial_no}\n`;
                if (selectedFields.includes('owner_number')) listString += `*Owner Contact:* ${p.owner_number}\n`;
                if (selectedFields.includes('property_type')) listString += `*Property Type:* ${p.property_type}\n`;
                if (selectedFields.includes('size')) listString += `*Size:* ${p.size_value} ${p.size_unit}\n`;
                if (selectedFields.includes('storey')) listString += `*Floor/Storey:* ${p.storey || 'N/A'}\n`;
                if (selectedFields.includes('area')) listString += `*Area:* ${p.area}\n`;
                if (selectedFields.includes('address')) listString += `*Full Address:* ${p.address}\n`;
                if (selectedFields.includes('road_size_ft')) listString += `*Road Size:* ${p.road_size_ft ? `${p.road_size_ft} ft` : 'N/A'}\n`;
                if (selectedFields.includes('demand')) listString += `*Demand:* ${p.demand_amount} ${p.demand_unit}\n`;
                
                if (selectedFields.includes('utilities')) {
                    const utils = [
                        p.meters?.electricity && 'Electricity',
                        p.meters?.gas && 'Gas',
                        p.meters?.water && 'Water'
                    ].filter(Boolean).join(', ') || 'N/A';
                    listString += `*Meters:* ${utils}\n`;
                }
                if (selectedFields.includes('documents')) listString += `*Documents:* ${p.documents || 'N/A'}\n`;
                if (selectedFields.includes('status')) listString += `*Status:* ${p.status}\n`;

                listString += `\n`;
            });
        listString += `\n`;
    }

    listString += `--------------------------------\n`;
    listString += `For more details, contact: ${profile.phone || ''}\n`;
    listString += `Generated via Signature CRM`;

    setGeneratedList(listString.trim());
    setCopied(false);
    
    // Scroll to text area on mobile
    const textarea = document.getElementById('generated-list');
    if (textarea) {
        textarea.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleCopy = () => {
    if (generatedList) {
      navigator.clipboard.writeText(generatedList);
      toast({
        title: 'List Copied!',
        description: 'The property list has been copied to your clipboard.',
      });
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const toggleArea = useCallback((area: string) => {
    setAreaFilters(prev => 
      prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]
    );
  }, []);

  return (
    <Card className="shadow-lg border-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl font-bold font-headline">
            <List className="h-6 w-6 text-primary" />
            List Generator Tool
        </CardTitle>
        <CardDescription>
          Filter properties, select fields, and generate a professional text list for sharing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Column 1: Filters & Options */}
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">1</div>
                    <h3 className="font-bold text-lg flex items-center gap-2"><SlidersHorizontal className="h-5 w-5" /> Filters & Settings</h3>
                </div>
                
                <div className="p-5 border rounded-2xl space-y-6 bg-muted/20">
                    <div className="space-y-4">
                         <div>
                            <Label className="text-xs font-black uppercase tracking-widest opacity-60">Filter by Area</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-between h-11 mt-1.5 bg-background rounded-xl border-border/60">
                                        {areaFilters.length > 0 ? (
                                            <span className="font-bold text-primary">{areaFilters.length} Areas Selected</span>
                                        ) : "Search Areas..."}
                                        <ChevronDown className="h-4 w-4 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="p-0 w-[300px] shadow-2xl bg-background border-none rounded-2xl overflow-hidden" align="start">
                                    <div className="p-3 border-b bg-muted/30">
                                        <div className="relative">
                                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            <Input 
                                                placeholder="Search area name..." 
                                                className="h-10 pl-9 rounded-lg bg-background border-none ring-1 ring-border focus-visible:ring-primary/40" 
                                                value={areaSearch} 
                                                onChange={(e) => setAreaSearch(e.target.value)} 
                                            />
                                        </div>
                                    </div>
                                    <div className="p-2 border-b bg-muted/5 flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase text-muted-foreground pl-1">Selection Options</span>
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-7 text-[10px] font-black uppercase text-primary hover:bg-primary/10 gap-1.5"
                                            onClick={(e) => { e.preventDefault(); handleSelectAllAreas(); }}
                                        >
                                            <ListChecks className="h-3 w-3" />
                                            {areaFilters.length === uniqueAreas.length ? 'Deselect All' : 'Select All'}
                                        </Button>
                                    </div>
                                    <ScrollArea className="max-h-[250px] p-2">
                                        {filteredAreas.length > 0 ? (
                                            <div className="space-y-1">
                                                {filteredAreas.map((areaName) => (
                                                    <div 
                                                        key={areaName} 
                                                        className={cn(
                                                            "flex items-center space-x-3 p-2.5 rounded-xl cursor-pointer transition-all",
                                                            areaFilters.includes(areaName) ? "bg-primary/5 text-primary" : "hover:bg-accent"
                                                        )}
                                                        onClick={() => toggleArea(areaName)}
                                                    >
                                                        <Checkbox 
                                                            id={`area-${areaName}`} 
                                                            checked={areaFilters.includes(areaName)}
                                                            onCheckedChange={() => toggleArea(areaName)}
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                        <label 
                                                            htmlFor={`area-${areaName}`} 
                                                            className="text-sm flex-1 cursor-pointer truncate font-bold"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                toggleArea(areaName);
                                                            }}
                                                        >
                                                            {areaName}
                                                        </label>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="py-10 text-center text-sm text-muted-foreground">
                                                No matching areas.
                                            </div>
                                        )}
                                    </ScrollArea>
                                    {areaFilters.length > 0 && (
                                        <div className="p-2 border-t bg-muted/10 flex justify-between items-center">
                                            <span className="text-[10px] font-black uppercase text-muted-foreground pl-2">{areaFilters.length} Selected</span>
                                            <Button variant="ghost" size="sm" className="h-8 text-[10px] font-black uppercase text-primary hover:bg-primary/10" onClick={() => setAreaFilters([])}>
                                                Clear All
                                            </Button>
                                        </div>
                                    )}
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label className="text-xs font-black uppercase tracking-widest opacity-60">Property Type</Label>
                                <Select value={propertyTypeFilter} onValueChange={(v) => setPropertyTypeFilter(v as any)}>
                                    <SelectTrigger className="mt-1.5 h-11 bg-background rounded-xl border-border/60"><SelectValue /></SelectTrigger>
                                    <SelectContent className="rounded-xl border-none shadow-xl">
                                        {propertyTypesForFilter.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                {propertyTypeFilter === 'Other' && (
                                    <Input 
                                        value={otherPropertyTypeFilter}
                                        onChange={(e) => setOtherPropertyTypeFilter(e.target.value)}
                                        placeholder="Type name..."
                                        className="mt-2 h-10 rounded-xl"
                                    />
                                )}
                            </div>
                            <div>
                                <Label className="text-xs font-black uppercase tracking-widest opacity-60">Select Size Unit</Label>
                                <Select value={sizeUnitFilter} onValueChange={v => setSizeUnitFilter(v as any)}>
                                    <SelectTrigger className="mt-1.5 h-11 bg-background rounded-xl border-border/60"><SelectValue /></SelectTrigger>
                                    <SelectContent className="rounded-xl border-none shadow-xl">
                                        {sizeUnits.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-black uppercase tracking-widest opacity-60">Size Range ({sizeUnitFilter})</Label>
                                <div className="flex gap-2 items-center">
                                    <Input type="number" placeholder="Min" value={minSizeFilter} onChange={e => setMinSizeFilter(e.target.value)} className="h-10 rounded-xl bg-background border-border/60" />
                                    <Input type="number" placeholder="Max" value={maxSizeFilter} onChange={e => setMaxSizeFilter(e.target.value)} className="h-10 rounded-xl bg-background border-border/60" />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-black uppercase tracking-widest opacity-60">Price Unit</Label>
                                <Select value={demandUnitFilter} onValueChange={v => setDemandUnitFilter(v as any)}>
                                    <SelectTrigger className="h-10 rounded-xl bg-background border-border/60"><SelectValue /></SelectTrigger>
                                    <SelectContent className="rounded-xl border-none shadow-xl">
                                        {demandUnits.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-black uppercase tracking-widest opacity-60">Price Range ({demandUnitFilter})</Label>
                            <div className="flex gap-2 items-center">
                                <Input type="number" placeholder="Min" value={minDemandFilter} onChange={e => setMinDemandFilter(e.target.value)} className="h-10 rounded-xl bg-background border-border/60" />
                                <Input type="number" placeholder="Max" value={maxDemandFilter} onChange={e => setMaxDemandFilter(e.target.value)} className="h-10 rounded-xl bg-background border-border/60" />
                            </div>
                        </div>

                        <Button onClick={() => handleFilterProperties()} className="w-full h-12 rounded-xl font-bold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">
                            Apply Filters & Search
                        </Button>
                    </div>

                    <Separator className="bg-border/40" />

                    <div>
                        <Label className="text-xs font-black uppercase tracking-widest opacity-60 mb-3 block">Data Fields to Include</Label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {(Object.keys(fieldLabels) as SelectableField[]).map((field) => (
                            <div 
                                key={field} 
                                className={cn(
                                    "flex items-center space-x-2.5 p-2 rounded-lg border transition-colors cursor-pointer",
                                    selectedFields.includes(field) ? "bg-primary/5 border-primary/30" : "hover:bg-accent border-transparent"
                                )}
                                onClick={() => handleFieldChange(field)}
                            >
                                <Checkbox
                                    id={`field-${field}`}
                                    checked={selectedFields.includes(field)}
                                    onCheckedChange={() => handleFieldChange(field)}
                                    onClick={(e) => e.stopPropagation()}
                                />
                                <Label htmlFor={`field-${field}`} className="text-xs font-bold cursor-pointer opacity-80" onClick={(e) => e.stopPropagation()}>
                                    {fieldLabels[field]}
                                </Label>
                            </div>
                        ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Column 2: Select Properties */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">2</div>
                        <h3 className="font-bold text-lg flex items-center gap-2"><CheckSquare className="h-5 w-5" /> Select Properties</h3>
                    </div>
                    {filteredProperties.length > 0 && (
                        <div className="flex items-center gap-2">
                             <Checkbox
                                id="select-all"
                                onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                                checked={selectedProperties.length === filteredProperties.length && filteredProperties.length > 0}
                            />
                            <Label htmlFor="select-all" className="text-xs font-black uppercase cursor-pointer">Select All</Label>
                        </div>
                    )}
                </div>

                <ScrollArea className="h-[520px] border rounded-2xl p-4 bg-muted/10">
                    {filteredProperties.length > 0 ? (
                        <div className="space-y-2">
                            {filteredProperties.map(prop => (
                                <div 
                                    key={prop.id} 
                                    className={cn(
                                        "flex items-center space-x-3 p-3 rounded-xl border transition-all cursor-pointer",
                                        selectedProperties.includes(prop.id) ? "bg-background border-primary shadow-sm" : "hover:bg-background/60 border-transparent"
                                    )}
                                    onClick={() => handlePropertySelection(prop.id)}
                                >
                                    <Checkbox 
                                        id={prop.id}
                                        checked={selectedProperties.includes(prop.id)}
                                        onCheckedChange={() => handlePropertySelection(prop.id)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    <div className="flex-1 min-w-0 flex items-center justify-between gap-3">
                                        <span className="truncate text-sm font-bold opacity-90">{prop.auto_title}</span>
                                        <Badge variant="outline" className="text-[9px] shrink-0 font-mono font-bold bg-muted/40 uppercase px-2">{prop.serial_no}</Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-40">
                            <Search className="h-16 w-16 mb-4 text-muted-foreground" />
                            <p className="text-lg font-bold">Waiting for Search</p>
                            <p className="text-sm mt-1">Adjust filters and click "Apply" to show properties.</p>
                        </div>
                    )}
                </ScrollArea>
                
                {filteredProperties.length > 0 && (
                    <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 flex items-center justify-between">
                         <div className="text-sm font-bold">
                            <span className="text-primary">{selectedProperties.length}</span> / {filteredProperties.length} Properties Selected
                         </div>
                         <Button onClick={generateList} className="glowing-btn h-10 px-6 rounded-lg font-bold text-sm">
                            Generate Final List
                         </Button>
                    </div>
                )}
            </div>
        </div>
        
        <Separator className="bg-border/40" />
        
        {/* Generated List Section */}
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">3</div>
                <h3 className="font-bold text-lg flex items-center gap-2"><FileText className="h-5 w-5" /> Shareable Output</h3>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                    <div className="relative group">
                        <Textarea
                            id="generated-list"
                            readOnly
                            value={generatedList}
                            placeholder="Your professional property list will appear here after clicking 'Generate'..."
                            className="h-96 text-sm whitespace-pre-wrap bg-muted/30 font-mono rounded-2xl p-6 border-border/60 focus-visible:ring-primary/20 leading-relaxed"
                        />
                        {generatedList && (
                            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button size="sm" variant="secondary" className="h-8 rounded-full font-bold shadow-lg" onClick={() => setGeneratedList('')}>
                                    <X className="h-3 w-3 mr-1" /> Clear
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    <Card className="bg-card/50 border-none shadow-md rounded-2xl overflow-hidden">
                        <CardHeader className="bg-primary/10 pb-4">
                            <CardTitle className="text-sm font-black uppercase tracking-widest text-primary">Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <Button 
                                onClick={handleCopy} 
                                disabled={!generatedList} 
                                className={cn(
                                    "w-full h-14 text-base font-black rounded-xl transition-all shadow-xl",
                                    copied ? "bg-emerald-600 hover:bg-emerald-600 shadow-emerald-500/20" : "glowing-btn"
                                )}
                            >
                                {copied ? <ClipboardCheck className="mr-2 h-5 w-5" /> : <ClipboardCopy className="mr-2 h-5 w-5" />}
                                {copied ? 'COPIED TO CLIPBOARD' : 'COPY ALL TEXT'}
                            </Button>
                            
                            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] font-bold text-amber-700 leading-relaxed">
                                Tip: After copying, paste directly into WhatsApp or Telegram to share with your clients and partners.
                            </div>

                            <Separator />

                            <div className="flex flex-col gap-2">
                                <Button variant="outline" className="h-10 rounded-xl font-bold justify-start" onClick={() => window.print()}>
                                    <FileText className="mr-2 h-4 w-4" /> Print List
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 text-white shadow-xl">
                        <h4 className="text-xs font-black uppercase tracking-widest text-primary-foreground/60 mb-2">Instructions</h4>
                        <ul className="text-[10px] space-y-2 opacity-80 font-medium">
                            <li>1. Use filters to narrow down properties.</li>
                            <li>2. Check specific items you want to list.</li>
                            <li>3. Select data fields to display.</li>
                            <li>4. Generate and Copy!</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
