import React, { useState } from 'react';
import { MessageCircle, Copy, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { buildConfirmationMessage, waLink, normalizePhone } from '@/lib/whatsappMessage';

export default function BookingConfirmationDialog({ appointment, doctor, patient, facility, open, onOpenChange }) {
  const [copied, setCopied] = useState(false);
  if (!appointment) return null;

  const message = buildConfirmationMessage({ appointment, doctor, facility });
  const mobile = patient?.mobile || '';
  const link = waLink(mobile, message);
  const validPhone = normalizePhone(mobile).length >= 8;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (e) { /* ignore */ }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" /> Appointment booked
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Confirmation message ready to share with {appointment.patient_name}. Send it via WhatsApp to reduce no-shows.
          </p>
          <div className="space-y-1.5">
            <Label>Message</Label>
            <Textarea readOnly value={message} rows={11} className="text-sm leading-relaxed" />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="gap-1.5">
              <X className="h-4 w-4" /> Close
            </Button>
            <Button variant="outline" onClick={copy} className="gap-1.5">
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button asChild disabled={!validPhone} className="gap-1.5">
              <a href={link} target="_blank" rel="noreferrer">
                <MessageCircle className="h-4 w-4" /> Open in WhatsApp
              </a>
            </Button>
          </div>
          {!validPhone && (
            <p className="text-right text-xs text-amber-700">
              Patient mobile number missing or invalid — copy the message instead.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}