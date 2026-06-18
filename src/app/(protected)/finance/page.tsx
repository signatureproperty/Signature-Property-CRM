'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DollarSign } from 'lucide-react';

export default function FinancePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline flex items-center gap-2">
          <DollarSign />
          Finance
        </h1>
        <p className="text-muted-foreground">
          Manage your agency's finances, expenses, and accounts.
        </p>
      </div>

      <Card className="border-dashed flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <CardTitle className="text-2xl font-bold font-headline">Coming Soon</CardTitle>
          <CardDescription>
            The Finance module is currently under development and will be available in a future update.
          </CardDescription>
        </div>
      </Card>
    </div>
  );
}