'use client';

import { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { validatePhone, type PhoneIssue } from '@/lib/phone-validation';

interface Props {
  phone: string;
  countryCode?: string;
}

export function PhoneValidationBadge({ phone, countryCode }: Props) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const issue = validatePhone(phone);
  if (!issue) return null;

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (analysis) return;
    setLoading(true);
    try {
      const res = await fetch('/api/analyze-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, countryCode: countryCode || '+92' }),
      });
      const data = await res.json();
      setAnalysis(data.analysis || 'Could not analyze');
    } catch {
      setAnalysis('AI analysis failed. Check the number manually.');
    }
    setLoading(false);
  };

  return (
    <TooltipProvider>
      <Tooltip open={!!analysis || undefined}>
        <TooltipTrigger asChild>
          <span
            onClick={handleClick}
            className={cn(
              'inline-flex items-center cursor-pointer rounded-full p-0.5',
              issue.severity === 'error' ? 'text-red-500 hover:text-red-600' : 'text-amber-500 hover:text-amber-600'
            )}
            title="Click for AI analysis"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5" />
            )}
          </span>
        </TooltipTrigger>
        {analysis && (
          <TooltipContent side="top" className="max-w-xs text-xs">
            <p>{analysis}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
