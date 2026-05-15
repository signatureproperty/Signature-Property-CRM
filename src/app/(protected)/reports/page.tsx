'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Property, Buyer } from '@/lib/types';
import { useFirestore } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { useProfile } from '@/context/profile-context';
import { useMemoFirebase } from '@/firebase/hooks';
import { formatCurrency, formatUnit } from '@/lib/formatters';
import { useCurrency } from '@/context/currency-context';
import { Download, MoreHorizontal, Edit, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { MarkAsSoldDialog } from '@/components/mark-as-sold-dialog';
import { MarkAsRentOutDialog } from '@/components/mark-as-rent-out-dialog';
import { useToast } from '@/hooks/use-toast';

// Extend jsPDF with autoTable method
interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

export default function ReportsPage() {
  const { profile } = useProfile();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { currency } = useCurrency();

  const [propertyToEdit, setPropertyToEdit] = useState<Property | null>(null);
  const [isSoldDialogOpen, setIsSoldDialogOpen] = useState(false);
  const [isRentOutDialogOpen, setIsRentOutDialogOpen] = useState(false);

  const propertiesQuery = useMemoFirebase(
    () => (profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'properties') : null),
    [profile.agency_id, firestore]
  );
  const { data: properties, isLoading: isPropertiesLoading } = useCollection<Property>(propertiesQuery);
  
  const buyersQuery = useMemoFirebase(
    () => (profile.agency_id ? collection(firestore, 'agencies', profile.agency_id, 'buyers') : null),
    [profile.agency_id, firestore]
  );
  const { data: buyers, isLoading: isBuyersLoading } = useCollection<Buyer>(buyersQuery);


  const handleUpdateProperty = async (updatedProperty: Property) => {
    if (!profile.agency_id) return;
    const docRef = doc(firestore, 'agencies', profile.agency_id, 'properties', updatedProperty.id);
    const batch = writeBatch(firestore);
    batch.set(docRef, updatedProperty, { merge: true });
    await batch.commit();
    toast({ title: 'Property Updated', description: `${updatedProperty.serial_no} details have been updated.` });
  };
  
  const handleRevertToAvailable = async (prop: Property) => {
    if (!profile.agency_id) return;
    const isForRent = prop.is_for_rent;
    let dataToReset: any = { status: 'Available' };

    const batch = writeBatch(firestore);
    const propRef = doc(firestore, 'agencies', profile.agency_id, 'properties', prop.id);
    
    if (isForRent) {
        dataToReset = {
            ...dataToReset,
            rent_out_date: undefined,
            rented_by_agent_id: undefined,
            final_rent_amount: undefined,
            final_rent_unit: undefined,
            rent_commission_from_tenant: undefined,
            rent_commission_from_tenant_unit: undefined,
            rent_commission_from_owner: undefined,
            rent_commission_from_owner_unit: undefined,
            rent_total_commission: undefined,
            rent_agent_share: undefined,
            rent_agent_share_unit: undefined,
        };
    } else {
        dataToReset = {
            ...dataToReset,
            sold_price: undefined,
            sold_price_unit: undefined,
            sale_date: undefined,
            sold_by_agent_id: undefined,
            buyerId: undefined,
            buyerName: undefined,
            buyerSerialNo: undefined,
            commission_from_buyer: undefined,
            commission_from_buyer_unit: undefined,
            commission_from_seller: undefined,
            commission_from_seller_unit: undefined,
            total_commission: undefined,
            agent_commission_amount: undefined,
            agent_commission_unit: undefined,
            agent_share_percentage: undefined,
        };
        // Revert buyer's status if they were linked to this sale
        if (prop.buyerId) {
            const buyerRef = doc(firestore, 'agencies', profile.agency_id, 'buyers', prop.buyerId);
            batch.update(buyerRef, { status: 'Interested' }); 
        }
    }
    
    batch.update(propRef, dataToReset);
    await batch.commit();

    toast({ title: 'Status Reverted', description: `${prop.serial_no} is now marked as Available.` });
  };


  const salesReportData = useMemo(() => {
    if (!properties || !buyers) return { rows: [], totals: { soldPrice: 0, totalCommission: 0, agentShare: 0, agencyProfit: 0 } };
    const soldProperties = properties.filter(p => p.status === 'Sold' && !p.is_for_rent);
    
    let totals = { soldPrice: 0, totalCommission: 0, agentShare: 0, agencyProfit: 0 };
    
    const rows = soldProperties.map(p => {
        const agentShareAmount = p.agent_commission_amount || 0;
        const agentShareUnit = p.agent_commission_unit || 'Thousand';
        const agentShare = formatUnit(agentShareAmount, agentShareUnit);
        
        const agencyProfit = (p.total_commission || 0) - agentShare;

        totals.soldPrice += (p.sold_price || 0);
        totals.totalCommission += (p.total_commission || 0);
        totals.agentShare += agentShare;
        totals.agencyProfit += agencyProfit;

        return { ...p, agentShare, agencyProfit };
    }) as any[];
    
    return { rows, totals };
  }, [properties, buyers]);

  const rentalReportData = useMemo(() => {
    if (!properties) return { rows: [], totals: { monthlyRent: 0, totalCommission: 0, agentShare: 0, agencyProfit: 0 } };
    const rentedProperties = properties.filter(p => p.status === 'Rent Out');
    
    let totals = { monthlyRent: 0, totalCommission: 0, agentShare: 0, agencyProfit: 0 };

    const rows = rentedProperties.map(p => {
        const agentShareAmount = p.rent_agent_share || 0;
        const agentShareUnit = p.rent_agent_share_unit || 'Thousand';
        const agentShare = formatUnit(agentShareAmount, agentShareUnit);

        const totalCommission = p.rent_total_commission || 0;
        const agencyProfit = totalCommission - agentShare;
        const finalRent = formatUnit(p.final_rent_amount || 0, p.final_rent_unit || 'Thousand');

        totals.monthlyRent += finalRent;
        totals.totalCommission += totalCommission;
        totals.agentShare += agentShare;
        totals.agencyProfit += agencyProfit;
        
        return { ...p, agencyProfit, agentShare, finalRent };
    }) as any[];

    return { rows, totals };
  }, [properties]);

  const handleEdit = (prop: Property) => {
    setPropertyToEdit(prop);
    if(prop.is_for_rent) {
      setIsRentOutDialogOpen(true);
    } else {
      setIsSoldDialogOpen(true);
    }
  }

  const handleDownloadPdf = (type: 'sales' | 'rental') => {
    const doc = new jsPDF() as jsPDFWithAutoTable;
    const isSales = type === 'sales';
    const data = isSales ? salesReportData : rentalReportData;
    const title = isSales ? 'Sales Performance Report' : 'Rental Performance Report';
    
    const head = isSales 
      ? [['Property', 'Buyer', 'Sale Date', 'Sold Price', 'Total Commission', 'Agent\'s Share', 'Agency Profit']]
      : [['Property', 'Rent Out Date', 'Monthly Rent', 'Total Commission', 'Agent\'s Share', 'Agency Profit']];
      
    const body = data.rows.map(p => isSales ? [
        `${p.auto_title}\n${p.serial_no}`,
        `${p.buyerName || '-'}\n${p.buyerSerialNo || '-'}`,
        p.sale_date ? new Date(p.sale_date).toLocaleDateString() : 'N/A',
        formatCurrency(p.sold_price || 0, currency),
        formatCurrency(p.total_commission || 0, currency),
        formatCurrency(p.agentShare || 0, currency),
        formatCurrency(p.agencyProfit || 0, currency)
    ] : [
        `${p.auto_title}\n${p.serial_no}`,
        p.rent_out_date ? new Date(p.rent_out_date).toLocaleDateString() : 'N/A',
        formatCurrency(p.finalRent, currency),
        formatCurrency(p.rent_total_commission || 0, currency),
        formatCurrency(p.agentShare || 0, currency),
        formatCurrency(p.agencyProfit || 0, currency)
    ]);

    const totalsRow = isSales ? [
      { content: 'Total', colSpan: 3, styles: { fontStyle: 'bold' } },
      formatCurrency(data.totals.soldPrice, currency),
      formatCurrency(data.totals.totalCommission, currency),
      formatCurrency(data.totals.agentShare, currency),
      formatCurrency(data.totals.agencyProfit, currency),
    ] : [
      { content: 'Total', colSpan: 2, styles: { fontStyle: 'bold' } },
      formatCurrency(data.totals.monthlyRent, currency),
      formatCurrency(data.totals.totalCommission, currency),
      formatCurrency(data.totals.agentShare, currency),
      formatCurrency(data.totals.agencyProfit, currency),
    ];
    
    body.push(totalsRow as any);

    doc.autoTable({
        head: head,
        body: body,
        didDrawPage: (data: any) => {
            doc.text(title, data.settings.margin.left, 15);
        },
    });

    doc.save(`${type}_report.pdf`);
  };

  const handleDownloadSinglePdf = (prop: Property, type: 'sales' | 'rental') => {
    const doc = new jsPDF() as jsPDFWithAutoTable;
    const isSales = type === 'sales';
    
    doc.text(`${isSales ? 'Sale' : 'Rental'} Report for ${prop.serial_no}`, 14, 15);

    if (isSales) {
        const agentShare = formatUnit(prop.agent_commission_amount || 0, prop.agent_commission_unit || 'Thousand');
        const agencyProfit = (prop.total_commission || 0) - agentShare;
        doc.autoTable({
            startY: 20,
            head: [['Field', 'Value']],
            body: [
                ['Property', `${prop.auto_title} (${prop.serial_no})`],
                ['Buyer', `${prop.buyerName || '-'} (${prop.buyerSerialNo || '-'})`],
                ['Sale Date', prop.sale_date ? new Date(prop.sale_date).toLocaleDateString() : 'N/A'],
                ['Sold Price', formatCurrency(prop.sold_price || 0, currency)],
                ['Total Commission', formatCurrency(prop.total_commission || 0, currency)],
                ['Agent\'s Share', formatCurrency(agentShare, currency)],
                ['Agency Profit', formatCurrency(agencyProfit, currency)],
            ]
        });
    } else {
        const agentShare = formatUnit(prop.rent_agent_share || 0, prop.rent_agent_share_unit || 'Thousand');
        const agencyProfit = (prop.rent_total_commission || 0) - agentShare;
         doc.autoTable({
            startY: 20,
            head: [['Field', 'Value']],
            body: [
                ['Property', `${prop.auto_title} (${prop.serial_no})`],
                ['Rent Out Date', prop.rent_out_date ? new Date(prop.rent_out_date).toLocaleDateString() : 'N/A'],
                ['Monthly Rent', formatCurrency(formatUnit(prop.final_rent_amount || 0, prop.final_rent_unit || 'Thousand'), currency)],
                ['Total Commission', formatCurrency(prop.rent_total_commission || 0, currency)],
                ['Agent\'s Share', formatCurrency(agentShare, currency)],
                ['Agency Profit', formatCurrency(agencyProfit, currency)],
            ]
        });
    }

    doc.save(`${prop.serial_no}_${type}_report.pdf`);
  };

  if (isPropertiesLoading || isBuyersLoading) {
    return <div>Loading reports...</div>;
  }

  return (
    <>
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline flex items-center gap-2">
          <MoreHorizontal />
          Reports
        </h1>
        <p className="text-muted-foreground">
          Analyze your agency's sales and rental performance.
        </p>
      </div>

      <Tabs defaultValue="sales">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="sales">Sales Report</TabsTrigger>
          <TabsTrigger value="rental">Rental Report</TabsTrigger>
        </TabsList>
        <TabsContent value="sales">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Sales Performance</CardTitle>
                  <CardDescription>Detailed report of all properties marked as sold.</CardDescription>
                </div>
                <Button onClick={() => handleDownloadPdf('sales')} variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Property</TableHead>
                    <TableHead>Buyer</TableHead>
                    <TableHead>Sale Date</TableHead>
                    <TableHead>Sold Price</TableHead>
                    <TableHead>Total Commission</TableHead>
                    <TableHead>Agent's Share</TableHead>
                    <TableHead>Agency Profit</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                    {salesReportData.rows.map(p => (
                        <TableRow key={p.id}>
                            <TableCell>
                                <div className="font-medium">{p.auto_title}</div>
                                <div className="text-sm text-muted-foreground">{p.serial_no}</div>
                            </TableCell>
                            <TableCell>
                                <div className="font-medium">{p.buyerName || '-'}</div>
                                <div className="text-sm text-muted-foreground">{p.buyerSerialNo || '-'}</div>
                            </TableCell>
                            <TableCell>{p.sale_date ? new Date(p.sale_date).toLocaleDateString() : 'N/A'}</TableCell>
                            <TableCell>{formatCurrency(p.sold_price || 0, currency)}</TableCell>
                            <TableCell>{formatCurrency(p.total_commission || 0, currency)}</TableCell>
                            <TableCell>{formatCurrency(p.agentShare || 0, currency)}</TableCell>
                            <TableCell className="font-bold">{formatCurrency(p.agencyProfit || 0, currency)}</TableCell>
                            <TableCell className="text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal /></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuItem onSelect={() => handleEdit(p) as any}><Edit /> Edit Sale Info</DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => handleDownloadSinglePdf(p, 'sales') as any}><Download /> Download PDF</DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => handleRevertToAvailable(p) as any} className="text-destructive"><RotateCcw /> Revert to Available</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan={3} className="font-bold">Total</TableCell>
                        <TableCell className="font-bold">{formatCurrency(salesReportData.totals.soldPrice, currency)}</TableCell>
                        <TableCell className="font-bold">{formatCurrency(salesReportData.totals.totalCommission, currency)}</TableCell>
                        <TableCell className="font-bold">{formatCurrency(salesReportData.totals.agentShare, currency)}</TableCell>
                        <TableCell className="font-bold text-lg text-primary">{formatCurrency(salesReportData.totals.agencyProfit, currency)}</TableCell>
                         <TableCell />
                    </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="rental">
           <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Rental Performance</CardTitle>
                  <CardDescription>Detailed report of all properties marked as rent out.</CardDescription>
                </div>
                <Button onClick={() => handleDownloadPdf('rental')} variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Download PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Property</TableHead>
                    <TableHead>Rent Out Date</TableHead>
                    <TableHead>Monthly Rent</TableHead>
                    <TableHead>Total Commission</TableHead>
                    <TableHead>Agent's Share</TableHead>
                    <TableHead>Agency Profit</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                    {rentalReportData.rows.map(p => (
                         <TableRow key={p.id}>
                            <TableCell>
                                <div className="font-medium">{p.auto_title}</div>
                                <div className="text-sm text-muted-foreground">{p.serial_no}</div>
                            </TableCell>
                            <TableCell>{p.rent_out_date ? new Date(p.rent_out_date).toLocaleDateString() : 'N/A'}</TableCell>
                            <TableCell>{formatCurrency(p.finalRent, currency)}</TableCell>
                            <TableCell>{formatCurrency(p.rent_total_commission || 0, currency)}</TableCell>
                            <TableCell>{formatCurrency(p.agentShare || 0, currency)}</TableCell>
                            <TableCell className="font-bold">{formatCurrency(p.agencyProfit || 0, currency)}</TableCell>
                             <TableCell className="text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal /></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuItem onSelect={() => handleEdit(p) as any}><Edit /> Edit Rent Info</DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => handleDownloadSinglePdf(p, 'rental') as any}><Download /> Download PDF</DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => handleRevertToAvailable(p) as any} className="text-destructive"><RotateCcw /> Revert to Available</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                 <TableFooter>
                    <TableRow>
                        <TableCell colSpan={2} className="font-bold">Total</TableCell>
                        <TableCell className="font-bold">{formatCurrency(rentalReportData.totals.monthlyRent, currency)}</TableCell>
                        <TableCell className="font-bold">{formatCurrency(rentalReportData.totals.totalCommission, currency)}</TableCell>
                        <TableCell className="font-bold">{formatCurrency(rentalReportData.totals.agentShare, currency)}</TableCell>
                        <TableCell className="font-bold text-lg text-primary">{formatCurrency(rentalReportData.totals.agencyProfit, currency)}</TableCell>
                        <TableCell />
                    </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
    {propertyToEdit && !propertyToEdit.is_for_rent && (
      <MarkAsSoldDialog
        property={propertyToEdit}
        isOpen={isSoldDialogOpen}
        setIsOpen={setIsSoldDialogOpen}
        onUpdateProperty={handleUpdateProperty}
      />
    )}
    {propertyToEdit && propertyToEdit.is_for_rent && (
      <MarkAsRentOutDialog
        property={propertyToEdit}
        isOpen={isRentOutDialogOpen}
        setIsOpen={setIsRentOutDialogOpen}
        onUpdateProperty={handleUpdateProperty}
      />
    )}
    </>
  );
}