import React, { useEffect, useState } from 'react';
import { Inbox, Loader2, Mail, Phone, MailOpen } from 'lucide-react';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { formatClinicDateTime } from '@/lib/clinicDate';
import { cn } from '@/lib/utils';

// Messages sent through the public website's Contact form.
export default function Messages() {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    (async () => {
      try {
        const res = await api.admin.messages.list();
        setItems(res.items || []);
      } catch (e) {
        toast({ title: 'Could not load messages', description: e.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  const setRead = async (m, is_read) => {
    try {
      const updated = await api.admin.messages.update(m.id, { is_read });
      setItems((list) => list.map((x) => (x.id === m.id ? { ...x, ...updated, is_read } : x)));
    } catch (e) {
      toast({ title: 'Could not update message', description: e.message, variant: 'destructive' });
    }
  };

  const unread = items.filter((m) => !m.is_read).length;
  const shown = filter === 'unread' ? items.filter((m) => !m.is_read) : items;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 lg:px-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-display text-3xl font-semibold">
            <Inbox className="h-7 w-7 text-primary" aria-hidden="true" /> Website Messages
          </h1>
          <p className="mt-1 text-muted-foreground">Enquiries sent through the clinic website's contact form.</p>
        </div>
        <div className="flex gap-2" role="group" aria-label="Filter messages">
          {[['all', `All (${items.length})`], ['unread', `Unread (${unread})`]].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              aria-pressed={filter === k}
              className={cn('rounded-full border px-4 py-1.5 text-sm font-medium transition-all', filter === k ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground/70 hover:border-primary/40')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          {filter === 'unread' ? 'No unread messages.' : 'No messages yet.'}
        </div>
      ) : (
        <ul className="space-y-3">
          {shown.map((m) => (
            <li key={m.id} className={cn('rounded-2xl border bg-card p-5', m.is_read ? 'border-border' : 'border-primary/40 shadow-sm')}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {!m.is_read && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-primary align-middle" aria-label="Unread" />}
                    {m.name}
                    {m.subject && <span className="font-normal text-muted-foreground"> — {m.subject}</span>}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {m.email && <a href={`mailto:${m.email}`} className="inline-flex items-center gap-1 hover:text-primary"><Mail className="h-3 w-3" aria-hidden="true" />{m.email}</a>}
                    {m.phone && <a href={`tel:${m.phone}`} className="inline-flex items-center gap-1 hover:text-primary"><Phone className="h-3 w-3" aria-hidden="true" />{m.phone}</a>}
                    <span>{formatClinicDateTime(m.created_date)}</span>
                  </div>
                </div>
                <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setRead(m, !m.is_read)}>
                  {m.is_read ? <><Mail className="h-4 w-4" aria-hidden="true" /> Mark unread</> : <><MailOpen className="h-4 w-4" aria-hidden="true" /> Mark read</>}
                </Button>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm">{m.message}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
