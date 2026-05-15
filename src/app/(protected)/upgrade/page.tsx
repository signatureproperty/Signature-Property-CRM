'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { Check, ArrowRight, Star, Briefcase } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useProfile } from '@/context/profile-context';
import { PaymentDialog } from '@/components/payment-dialog';
import type { Plan } from '@/components/payment-dialog';

const agentPlans: Plan[] = [
    {
        name: 'Free',
        price: { monthly: 0, yearly: 0 },
        description: 'Perfect for getting started and working with a single agency.',
        features: [
            'Connect with 1 Agency',
            'Manage Assigned Properties',
            'Manage Assigned Buyers',
            'Use Core CRM Tools',
        ],
        cta: 'Current Plan',
        isPopular: false,
    },
    {
        name: 'Standard',
        price: { monthly: 2000, yearly: 20000 },
        description: 'For professional agents expanding their network.',
        features: [
            'Connect with up to 2 Agencies',
            'All Free Features',
            'Priority Lead Notifications',
            'Basic Personal Analytics',
        ],
        cta: 'Upgrade to Standard',
        isPopular: true,
    },
    {
        name: 'Pro',
        price: { monthly: 5000, yearly: 50000 },
        description: 'For top-tier agents managing multiple agency partnerships.',
        features: [
            'Connect with up to 4 Agencies',
            'All Standard Features',
            'Advanced Tools & Integrations',
            'Dedicated Support',
        ],
        cta: 'Upgrade to Pro',
        isPopular: false,
    }
];


export default function AgentUpgradePage() {
    const [isYearly, setIsYearly] = useState(false);
    const { profile } = useProfile();
    const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

    const handleChoosePlan = (plan: Plan) => {
        setSelectedPlan(plan);
        setIsPaymentDialogOpen(true);
    }
    
    const currentPlanName = profile.planName || 'Free'; 

  return (
    <>
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight font-headline">Upgrade Your Agent Account</h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          Expand your network by connecting with multiple agencies and unlock powerful features.
        </p>
      </div>
      
       <Alert className="max-w-2xl mx-auto bg-primary/10 border-primary/30">
          <Briefcase className="h-4 w-4" />
          <AlertTitle className="font-bold">How It Works</AlertTitle>
          <AlertDescription>
              Upgrading your account allows you to accept invitations from multiple agencies simultaneously, increasing your lead flow and opportunities.
          </AlertDescription>
        </Alert>

       <div className="flex items-center justify-center space-x-4">
        <span className={cn("font-medium", !isYearly && "text-primary")}>Monthly</span>
        <Switch
          checked={isYearly}
          onCheckedChange={setIsYearly}
          aria-label="Toggle between monthly and yearly pricing"
        />
        <span className={cn("font-medium", isYearly && "text-primary")}>Yearly</span>
        <span className="text-sm font-semibold text-green-600">(Save 2 months!)</span>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 items-start max-w-7xl mx-auto">
        {agentPlans.map((plan) => {
          const isCurrentPlan = plan.name === currentPlanName;
          const isDisabled = isCurrentPlan;

          let buttonText: React.ReactNode = plan.cta;
           if (isDisabled) {
              buttonText = 'Current Plan';
          }

          const priceData = plan.price as any;

          return (
            <Card key={plan.name} className={cn("flex flex-col h-full relative", plan.isPopular && "border-primary border-2 shadow-primary/20", isCurrentPlan && "ring-2 ring-primary")}>
              {plan.isPopular && (
                   <div className="bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider text-center py-1 rounded-t-lg -mt-px flex items-center justify-center gap-2">
                      <Star className="h-4 w-4" />
                      Most Popular
                  </div>
              )}
              <CardHeader className="text-center">
                <CardTitle className="text-2xl font-bold font-headline">{plan.name}</CardTitle>
                  <div className="text-4xl font-extrabold my-4">
                      {priceData.custom ? (
                          'Custom'
                      ) : priceData.monthly === 0 ? 'Free' : (
                         isYearly ? (
                          <div className="flex items-center justify-center gap-2">
                             <span>RS {priceData.yearly.toLocaleString()}</span>
                             <span className="text-xl font-medium text-muted-foreground line-through">RS {(priceData.monthly * 12).toLocaleString()}</span>
                          </div>
                         ) : `RS ${priceData.monthly.toLocaleString()}`
                      )}
                      {!priceData.custom && priceData.monthly > 0 && (
                           <span className="text-sm font-normal text-muted-foreground">/{isYearly ? 'year' : 'month'}</span>
                      )}
                  </div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 space-y-4">
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start">
                      <Check className="mr-3 h-5 w-5 flex-shrink-0 text-green-500" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  className={cn("w-full", plan.isPopular && 'glowing-btn')} 
                  variant={plan.isPopular ? 'default' : 'outline'}
                  onClick={() => handleChoosePlan(plan)}
                  disabled={isDisabled}
                >
                  {buttonText} {!isDisabled && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
              </CardFooter>
            </Card>
        )})}
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