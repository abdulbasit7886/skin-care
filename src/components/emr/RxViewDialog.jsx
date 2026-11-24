import React from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { buildRxSlip, printRxSlip } from '@/lib/rxSlip';

export default function RxViewDialog({ open, onOpenChange, rx }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Prescription</DialogTitle>
        </DialogHeader>
        <div
          className="max-h-[62vh] overflow-y-auto rounded-xl border border-border"
          dangerouslySetInnerHTML={{ __html: buildRxSlip(rx) }}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={() => printRxSlip(rx)} className="gap-2">
            <Printer className="h-4 w-4" /> Print Rx
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}