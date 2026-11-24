import React from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buildConsultationMessage, waLink, normalizePhone } from '@/lib/whatsappMessage';
import { cn } from '@/lib/utils';

// Click-to-chat link that opens WhatsApp with the patient to conduct an online consultation.
export default function WhatsAppConsultButton({ appointment, patient, doctor, facility, size = 'sm', className, label = 'Consult on WhatsApp' }) {
  const mobile = patient?.mobile || '';
  const message = buildConsultationMessage({ appointment, doctor, facility });
  const link = waLink(mobile, message);
  const disabled = normalizePhone(mobile).length < 8;
  return (
    <Button asChild variant="default" size={size} disabled={disabled} className={cn('gap-1.5 rounded-lg', className)}>
      <a href={link} target="_blank" rel="noreferrer">
        <MessageCircle className="h-4 w-4" /> {label}
      </a>
    </Button>
  );
}