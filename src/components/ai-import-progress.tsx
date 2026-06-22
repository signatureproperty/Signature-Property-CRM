'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Loader2, Sparkles } from 'lucide-react';

interface Props {
  isOpen: boolean;
  type: 'Buyers' | 'Properties';
  status: 'reading' | 'analyzing' | 'importing' | 'complete' | 'error';
  count?: number;
  errorMsg?: string;
}

export function AiImportProgress({ isOpen, type, status, count, errorMsg }: Props) {
  const steps = [
    { key: 'reading', label: 'Reading file...', progress: 15 },
    { key: 'analyzing', label: `AI is analyzing ${type.toLowerCase()} data...`, progress: 50 },
    { key: 'importing', label: `Importing ${count || 0} ${type.toLowerCase()}...`, progress: 85 },
    { key: 'complete', label: `✅ Imported ${count} ${type.toLowerCase()} successfully!`, progress: 100 },
    { key: 'error', label: `❌ ${errorMsg || 'Import failed'}`, progress: 100 },
  ];

  const current = steps.find(s => s.key === status) || steps[0];

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Import
          </DialogTitle>
          <DialogDescription>
            {type === 'Properties' ? 'Property' : 'Buyer'} leads being processed by AI
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-6 py-6">
          {status !== 'complete' && status !== 'error' && (
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          )}
          <div className="w-full space-y-2">
            <Progress value={current.progress} className="h-2" />
            <p className="text-sm text-center font-medium text-muted-foreground">
              {current.label}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
