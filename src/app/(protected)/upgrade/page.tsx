'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { Check, ArrowRight, Star, Building2, Gem } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useProfile } from '@/context/profile-context';
import { PaymentDialog } from '@/components/payment-dialog';
import type { Plan } from '@/components/payment-dialog';

const agencyPlans: Plan[] = [
    {
        name: 'Basic',
        price: { monthly: 0, yearly: 0 },
        description: 'Essential tools for individual dealers and small teams starting out.',
        features: [
            '500 Property Listings',
            '500 Buyer Leads',
            'Up to 3 Team Members',
            'Core CRM Tools',
            'Standard Support'
        ],
        cta: 'Current Plan',
        isPopular: false,
    },
    {
        name: 'Standard',
        price: { monthly: 5000, yearly: 50000 },
        description: 'Grow your agency with expanded limits and advanced tracking tools.',
        features: [
            '2,500 Property Listings',
            '2,500 Buyer Leads',
            'Up to 10 Team Members',
            'Professional List Generator',
            'Performance Reports',
            'Standard Support'
        ],
        cta: 'Upgrade to Standard',
        isPopular: true,
    },
    {
        name: 'Premium',
        price: { monthly: 15000, yearly: 150000 },
        description: 'The ultimate solution for high-volume agencies and large teams.',
        features: [
            'Unlimited Property Listings',
            'Unlimited Buyer Leads',
            'Unlimited Team Members',
            'Advanced Data Analytics',
            'Custom Document Branding',
            'Priority VIP Support'
        ],
        cta: 'Upgrade to Premium',
        isPopular: false,
    }
];


export default function AgencyUpgradePage() {
    const [isYearly, setIsYearly] = useState(false);
    const { profile } = useProfile();
    const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

    const handleChoosePlan = (plan: Plan) => {
        setSelectedPlan(plan);
        setIsPaymentDialogOpen(true);
    }
    
    const currentPlanName = profile.planName || 'Basic'; 

  return (
    <>
    <div className="space-y-10 pb-20 animate-fade-in">
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight font-headline">Scale Your Real Estate Agency</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto font-medium">
          Choose a plan that fits your current volume and future ambitions.
        </p>
      </div>
      
       <Alert className="max-w-2xl mx-auto bg-primary/5 border-primary/20 rounded-2xl">
          <Building2 className="h-5 w-5 text-primary" />
          <AlertTitle className="font-bold text-primary">Agency Plan Notice</AlertTitle>
          <AlertDescription className="text-sm font-medium">
              Agent accounts are free forever. These premium plans are designed to help agency owners manage higher inventory volumes and larger teams.
          </AlertDescription>
        </Alert>

       <div className="flex items-center justify-center space-x-4">
        <span className={cn("font-bold text-sm uppercase tracking-widest transition-colors", !isYearly ? "text-primary" : "text-muted-foreground/60")}>Monthly</span>
        <Switch
          checked={isYearly}
          onCheckedChange={setIsYearly}
          className="data-[state=checked]:bg-primary"
          aria-label="Toggle between monthly and yearly pricing"
        />
        <span className={cn("font-bold text-sm uppercase tracking-widest transition-colors", isYearly ? "text-primary" : "text-muted-foreground/60")}>Yearly</span>
        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-black text-[10px]">SAVE 2 MONTHS</Badge>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 items-stretch max-w-7xl mx-auto px-4">
        {agencyPlans.map((plan) => {
          const isCurrentPlan = plan.name === currentPlanName;
          const isDisabled = isCurrentPlan;

          const priceData = plan.price as any;

          return (
            <Card key={plan.name} className={cn(
                "flex flex-col h-full relative transition-all duration-300 rounded-[2.5rem] overflow-hidden border-none shadow-xl", 
                plan.isPopular ? "ring-2 ring-primary shadow-primary/20 scale-105 z-10 bg-card" : "bg-card/60 backdrop-blur-sm hover:scale-[1.02]",
                isCurrentPlan && "opacity-90"
            )}>
              {plan.isPopular && (
                   <div className="bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-[0.2em] text-center py-2 flex items-center justify-center gap-2">
                      <Star className="h-3 w-3 fill-current" />
                      Recommended for Growth
                  </div>
              )}
              <CardHeader className="text-center pt-8">
                <CardTitle className="text-2xl font-black font-headline uppercase tracking-tighter">{plan.name}</CardTitle>
                  <div className="flex items-baseline justify-center gap-1 mt-6">
                      <span className="text-sm font-black text-muted-foreground align-top">RS</span>
                      <span className="text-5xl font-black tracking-tighter">
                          {priceData.monthly === 0 ? '0' : (isYearly ? (priceData.yearly / 12).toLocaleString() : priceData.monthly.toLocaleString())}
                      </span>
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">/mo</span>
                  </div>
                  {isYearly && priceData.monthly > 0 && (
                      <p className="text-[10px] font-black text-emerald-600 uppercase mt-2">Billed RS {priceData.yearly.toLocaleString()} annually</p>
                  )}
                <CardDescription className="pt-4 font-medium min-h-[4rem] px-4">{plan.description}</CardDescription>
              </CardHeader>
              
              <CardContent className="flex-1 space-y-6 px-8">
                <Separator className="bg-border/40" />
                <ul className="space-y-4">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-full bg-emerald-500/10 p-0.5">
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      </div>
                      <span className="text-sm font-semibold opacity-80">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="pb-8 px-8">
                <Button 
                  className={cn(
                    "w-full h-14 rounded-2xl text-base font-black transition-all", 
                    plan.isPopular ? 'glowing-btn' : 'bg-muted/50 hover:bg-muted text-foreground'
                  )} 
                  variant={plan.isPopular ? 'default' : 'ghost'}
                  onClick={() => handleChoosePlan(plan)}
                  disabled={isDisabled}
                >
                  {isCurrentPlan ? 'CURRENT ACTIVE PLAN' : plan.cta} 
                  {!isDisabled && <ArrowRight className="ml-2 h-5 w-5" />}
                </Button>
              </CardFooter>
            </Card>
        )})}
      </div>

      <div className="max-w-4xl mx-auto text-center space-y-4 pt-10">
         <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20">
            <Gem className="h-4 w-4 text-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest text-primary">Enterprise Support</span>
         </div>
         <h3 className="text-2xl font-black font-headline tracking-tight">Need a custom plan for 50+ members?</h3>
         <p className="text-muted-foreground font-medium">Contact our enterprise sales team for customized volume pricing and onboarding services.</p>
         <Button variant="link" className="font-black text-primary hover:no-underline">SALES@SIGNATURECRM.PK</Button>
      </div>
    </div>

    {selectedPlan && (
        <PaymentDialog 
            isOpen={isPaymentDialogOpen}
            setIsOpen={setIsPaymentDialogOpen}
            plan={selectedPlan}
            billingCycle={isYearly ? 'yearly' : 'monthly'}
        />
    )}
    </>
  );
}
