'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, CheckCircle, FileSpreadsheet, Sparkles } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  type: 'Buyers' | 'Properties';
  totalRows: number;
  colMapping: Record<string, string>;
  sampleRows: Record<string, string>[];
  onConfirm: () => void;
  importProgress: { current: number; total: number } | null;
  importStatus: 'idle' | 'importing' | 'complete' | 'error';
  importResult?: { success: number; failed: number; errors: string[] };
  onAiEnhance?: () => void;
  isAiEnhancing?: boolean;
}

export function ImportPreviewDialog({
  isOpen, onClose, type, totalRows, colMapping, sampleRows,
  onConfirm, importProgress, importStatus, importResult, onAiEnhance, isAiEnhancing,
}: Props) {
  const mappedCount = Object.values(colMapping).filter(v => v !== '—').length;
  const phoneCol = colMapping['phone'] || colMapping['owner_number'];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && importStatus !== 'importing') onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[70vh] sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Import {type}
          </DialogTitle>
          <DialogDescription>
            {totalRows} rows found · {mappedCount} columns matched
            {phoneCol && phoneCol !== '—' ? ` · Phone column: "${phoneCol}"` : ''}
          </DialogDescription>
        </DialogHeader>

        {importStatus === 'idle' && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              {Object.entries(colMapping).map(([field, header]) => (
                <Badge key={field} variant={header === '—' ? 'destructive' : 'secondary'} className="text-xs">
                  {header === '—' ? <AlertTriangle className="h-3 w-3 mr-1" /> : null}
                  {field}: {header}
                </Badge>
              ))}
            </div>

            {sampleRows.length > 0 && (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {Object.keys(sampleRows[0]).map(k => (
                        <TableHead key={k} className="text-xs whitespace-nowrap">{k}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sampleRows.slice(0, 3).map((row, i) => (
                      <TableRow key={i}>
                        {Object.values(row).map((v, j) => (
                          <TableCell key={j} className="text-xs max-w-[150px] truncate">{v || '—'}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {onAiEnhance && (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5 border-primary/20 text-primary"
                  onClick={onAiEnhance}
                  disabled={isAiEnhancing}
                >
                  {isAiEnhancing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  {isAiEnhancing ? 'AI Enhancing...' : 'AI Enhance (fix messy cells)'}
                </Button>
              </div>
            )}
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button onClick={onConfirm} className="glowing-btn">
                Start Import ({totalRows} {type.toLowerCase()})
              </Button>
            </div>
          </div>
        )}

        {importStatus === 'importing' && importProgress && (
          <div className="flex flex-col items-center gap-4 py-6">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="w-full space-y-2">
              <Progress value={(importProgress.current / importProgress.total) * 100} className="h-2" />
              <p className="text-sm text-center text-muted-foreground">
                Importing {importProgress.current} / {importProgress.total} ...
              </p>
            </div>
          </div>
        )}

        {importStatus === 'complete' && importResult && (
          <div className="flex flex-col items-center gap-3 py-4">
            <CheckCircle className="h-10 w-10 text-green-500" />
            <p className="text-lg font-bold">Import Complete</p>
            <p className="text-sm text-muted-foreground">
              {importResult.success} imported successfully
              {importResult.failed > 0 ? `, ${importResult.failed} failed` : ''}
            </p>
            {importResult.errors.length > 0 && (
              <div className="w-full max-h-32 overflow-y-auto text-xs text-destructive space-y-1">
                {importResult.errors.map((e, i) => <p key={i}>{e}</p>)}
              </div>
            )}
            <Button onClick={onClose}>Done</Button>
          </div>
        )}

        {importStatus === 'error' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <AlertTriangle className="h-10 w-10 text-destructive" />
            <p className="text-lg font-bold">Import Failed</p>
            <Button onClick={onClose}>Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
