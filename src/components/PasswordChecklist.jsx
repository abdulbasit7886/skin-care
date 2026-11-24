import React from 'react';
import { Check, X } from 'lucide-react';
import { PASSWORD_RULE } from '@/api/client';

// Live checklist for the password policy shared with the server:
// 8+ characters, one uppercase letter, one number, one special character.
export const passwordChecks = (pw = '', confirm) => {
  const checks = [
    { id: 'len', label: 'At least 8 characters', ok: pw.length >= 8 },
    { id: 'upper', label: 'One uppercase letter (A–Z)', ok: /[A-Z]/.test(pw) },
    { id: 'num', label: 'One number (0–9)', ok: /\d/.test(pw) },
    { id: 'special', label: 'One special character (e.g. @ # $ !)', ok: /[^A-Za-z0-9]/.test(pw) },
  ];
  if (confirm !== undefined) checks.push({ id: 'match', label: 'Both passwords match', ok: !!pw && pw === confirm });
  return checks;
};

export const isPasswordValid = (pw, confirm) =>
  PASSWORD_RULE.test(pw || '') && (confirm === undefined || pw === confirm);

export default function PasswordChecklist({ password, confirm, className = '' }) {
  return (
    <ul className={`space-y-1 text-xs ${className}`} aria-live="polite">
      {passwordChecks(password, confirm).map((c) => (
        <li key={c.id} className={`flex items-center gap-1.5 ${c.ok ? 'text-emerald-700' : 'text-muted-foreground'}`}>
          {c.ok ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <X className="h-3.5 w-3.5" aria-hidden="true" />}
          <span>{c.label}</span>
          <span className="sr-only">{c.ok ? '(met)' : '(not met)'}</span>
        </li>
      ))}
    </ul>
  );
}
