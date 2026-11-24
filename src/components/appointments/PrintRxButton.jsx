import React from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { printRxSlip, rxFromVisit } from '@/lib/rxSlip';

// Prints the prescription written on this visit. Hidden until a prescription exists.
export default function PrintRxButton({ appointment, emr, doctor, facility }) {
  if (!(emr?.prescription || '').trim()) return null;

  return (
    <Button
      size="sm"
      variant="outline"
      className="gap-1.5 rounded-lg"
      onClick={() => printRxSlip(rxFromVisit({ appointment, emr, doctor, facility }))}
    >
      <Printer className="h-4 w-4" /> Print Rx
    </Button>
  );
}