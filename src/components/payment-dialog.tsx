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
import { Card, CardContent } from '@/components/ui/card';
import { Copy, Check, Info, Upload, Banknote, CreditCard, ArrowLeft, Loader2 } from 'lucide-react';
import { useState, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Input } from './ui/input';
import { useProfile } from '@/context/profile-context';
import { useFirestore } from '@/firebase/provider';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

export type Plan = {
    name: string;
    price: { monthly: number; yearly: number; custom?: boolean } | { custom: true; monthly?: number; yearly?: number };
    description: string;
    features: string[];
    cta: string;
    isPopular: boolean;
};

interface PaymentDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  plan: Plan;
  billingCycle: 'monthly' | 'yearly';
}

type PaymentMethod = 'jazzcash' | 'bank' | 'card';

export function PaymentDialog({ isOpen, setIsOpen, plan, billingCycle }: PaymentDialogProps) {
  const { profile } = useProfile();
  const firestore = useFirestore();
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [transactionId, setTransactionId] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const priceData = plan.price as any;
  if (priceData.custom) {
      return null;
  }
  
  const price = billingCycle === 'yearly' ? (priceData.yearly || 0) : (priceData.monthly || 0);

  const handleCopy = (textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast({ title: "Copied to clipboard!" });
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleBack = () => {
    setSelectedMethod(null);
    setTransactionId('');
    setReceiptFile(null);
  }

  const handleSubmit = async () => {
    if (!transactionId || !receiptFile) {
        toast({
            title: "Information Missing",
            description: "Please provide both Transaction ID and a receipt file.",
            variant: "destructive"
        });
        return;
    }

    if (!profile.agency_id) {
        toast({ title: "Error", description: "Agency information not found.", variant: "destructive"});
        return;
    }

    setIsSubmitting(true);
    
    try {
        const storage = getStorage();
        const filePath = `upgrade_receipts/${profile.agency_id}/${new Date().getTime()}_${receiptFile.name}`;
        const receiptStorageRef = storageRef(storage, filePath);
        const uploadResult = await uploadBytes(receiptStorageRef, receiptFile);
        const receiptUrl = await getDownloadURL(uploadResult.ref);

        const requestsCollectionRef = collection(firestore, 'upgradeRequests');
        await addDoc(requestsCollectionRef, {
            agencyId: profile.agency_id,
            agencyName: profile.agencyName,
            requestedPlan: plan.name,
            billingCycle,
            amount: price,
            transactionId,
            receiptUrl,
            status: 'pending',
            createdAt: serverTimestamp(),
            userId: profile.user_id,
            userName: profile.name,
        });

        setIsSubmitted(true);

    } catch (error) {
        console.error("Error submitting upgrade request: ", error);
        toast({ title: "Submission Failed", description: "Could not submit your request. Please try again.", variant: "destructive"});
    } finally {
        setIsSubmitting(false);
    }
  }

  const renderInitialScreen = () => (
      <>
        <DialogHeader>
            <DialogTitle className="font-headline">Choose Payment Method</DialogTitle>
            <DialogDescription>
                You are purchasing the <strong>{plan.name} ({billingCycle})</strong> plan for <strong>RS {price.toLocaleString()}</strong>.
            </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 py-4">
            <Button variant="outline" className="justify-start h-14" onClick={() => setSelectedMethod('jazzcash')}>
                <div className="h-8 w-8 mr-4 flex items-center justify-center bg-primary rounded-md">
                    <span className="text-primary-foreground font-bold text-xl">J</span>
                </div>
                <span>Pay with JazzCash</span>
            </Button>
            <Button variant="outline" className="justify-start h-14" onClick={() => setSelectedMethod('bank')}>
                <div className="h-8 w-8 mr-4 flex items-center justify-center bg-primary text-primary-foreground rounded-md">
                  <Banknote className="h-5 w-5" />
                </div>
                <span>Pay with Bank Transfer</span>
            </Button>
            <Button variant="outline" className="justify-start h-14" onClick={() => setSelectedMethod('card')}>
                <div className="h-8 w-8 mr-4 flex items-center justify-center bg-primary text-primary-foreground rounded-md">
                  <CreditCard className="h-5 w-5" />
                </div>
                <span>Pay with Credit/Debit Card</span>
            </Button>
        </div>
        <DialogFooter>
            <Button variant="secondary" onClick={() => setIsOpen(false)}>Cancel</Button>
        </DialogFooter>
    </>
  );

  const renderDetailsScreen = () => {
    const detailsMap: any = {
        jazzcash: { title: "JazzCash Payment", accountName: "Usman Sagheer", accountNumber: "03001234567" },
        bank: { title: "Bank Transfer", accountName: "Usman Sagheer", accountNumber: "01234567890123", bankName: "Meezan Bank" },
        card: { title: "Credit/Debit Card", message: "Online card payments are coming soon. Please choose another method." }
    };
    const details = detailsMap[selectedMethod!];

    return (
        <>
             <DialogHeader>
                 <Button variant="ghost" size="icon" className="absolute left-4 top-4 h-8 w-8" onClick={handleBack}>
                    <ArrowLeft />
                 </Button>
                <DialogTitle className="font-headline text-center">{details.title}</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
                 <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Instructions</AlertTitle>
                    <AlertDescription>
                        Please transfer <strong>RS {price.toLocaleString()}</strong> to the account below, then upload the receipt and enter the Transaction ID to complete your request.
                    </AlertDescription>
                </Alert>

                <Card>
                    <CardContent className="p-4 space-y-3 text-sm">
                        {selectedMethod !== 'card' ? (
                            <>
                                {details.bankName && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">Bank:</span>
                                        <span className="font-semibold">{details.bankName}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Account Name:</span>
                                    <span className="font-semibold">{details.accountName}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Account Number:</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono">{details.accountNumber}</span>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopy(details.accountNumber || '')}>
                                            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <p className="text-center text-muted-foreground p-4">{details.message}</p>
                        )}
                    </CardContent>
                </Card>

                {selectedMethod !== 'card' && (
                    <div className="space-y-4 pt-4">
                        <Input
                            placeholder="Transaction ID / TID"
                            value={transactionId}
                            onChange={(e) => setTransactionId(e.target.value)}
                        />
                         <div>
                            <Button type="button" variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
                                <Upload className="mr-2 h-4 w-4" />
                                {receiptFile ? `Selected: ${receiptFile.name}` : 'Upload Receipt'}
                            </Button>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/png, image/jpeg, application/pdf" onChange={(e) => setReceiptFile(e.target.files?.[0] || null)} />
                        </div>
                    </div>
                )}
            </div>
             <DialogFooter>
                <Button variant="secondary" onClick={handleBack}>Back</Button>
                <Button onClick={handleSubmit} disabled={selectedMethod === 'card' || !transactionId || !receiptFile || isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Submit for Activation
                </Button>
            </DialogFooter>
        </>
    );
  };
  
  const renderSuccessScreen = () => (
    <>
         <DialogHeader>
            <DialogTitle className="font-headline text-center">Request Submitted</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center text-center space-y-4 py-8">
            <div className="h-16 w-16 bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300 rounded-full flex items-center justify-center">
                <Check className="h-8 w-8" />
            </div>
            <p className="max-w-xs text-muted-foreground">
                Thank you! Your request has been received. Your <strong>{plan.name}</strong> plan will be activated within the next 24 hours.
            </p>
        </div>
        <DialogFooter>
             <Button className="w-full" onClick={() => setIsOpen(false)}>Done</Button>
        </DialogFooter>
    </>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        {isSubmitted ? renderSuccessScreen() : selectedMethod ? renderDetailsScreen() : renderInitialScreen()}
      </DialogContent>
    </Dialog>
  );
}