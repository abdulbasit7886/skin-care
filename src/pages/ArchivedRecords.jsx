import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Search, FileImage, FolderOpen, Eye, Loader2, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { formatMobile, formatCNIC } from '@/lib/formatId';
import { cn } from '@/lib/utils';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const PAGE_SIZE = 50;

export default function ArchivedRecords() {
  const { toast } = useToast();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [letter, setLetter] = useState('ALL');
  const [query, setQuery] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [signing, setSigning] = useState(null);

  const baseQuery = useMemo(() => {
    const q = { chart_image_uri: { $exists: true } };
    if (letter !== 'ALL') {
      q.name = { $regex: `^${letter}`, $options: 'i' };
    }
    if (query.trim()) {
      const rx = { $regex: query.trim(), $options: 'i' };
      q.$or = [
        { name: rx }, { first_name: rx }, { last_name: rx },
        { mrn: rx }, { mobile: rx }, { father_husband: rx },
        { profession: rx }, { previous_diagnosis: rx }, { address: rx },
      ];
    }
    return q;
  }, [letter, query]);

  const load = useCallback(async (reset = true) => {
    if (reset) setLoading(true); else setLoadingMore(true);
    try {
      const { items, next_cursor, has_more } = await api.entities.Patient.filter(
        baseQuery,
        { sort: 'name', limit: PAGE_SIZE, cursor: reset ? undefined : cursor }
      );
      setRecords((prev) => reset ? items : [...prev, ...items]);
      setCursor(next_cursor);
      setHasMore(has_more);
    } catch (e) {
      toast({ title: 'Could not load archived records', description: e?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [baseQuery, cursor]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(true); }, [baseQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSearch = (e) => { e.preventDefault(); setLetter('ALL'); load(true); };

  const viewChart = async (p) => {
    setSigning(p.id);
    try {
      const { signed_url } = await api.files.signedUrl(p.chart_image_uri);
      window.open(signed_url, '_blank');
    } catch (e) {
      toast({ title: 'Could not open chart', description: e?.message, variant: 'destructive' });
    } finally {
      setSigning(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 lg:px-10">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-semibold">Archived Records</h1>
        <p className="mt-1 text-muted-foreground">Digitised patient charts from scanned documents. Filter by the first letter of the patient name.</p>
      </div>

      {/* A-Z letter index */}
      <div className="mb-5 flex flex-wrap gap-1.5">
        <button
          onClick={() => setLetter('ALL')}
          className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors', letter === 'ALL' ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-muted-foreground hover:border-primary/40')}
        >
          All
        </button>
        {LETTERS.map((l) => (
          <button
            key={l}
            onClick={() => setLetter(l)}
            className={cn('grid h-8 w-8 place-items-center rounded-lg text-xs font-semibold transition-colors', letter === l ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-muted-foreground hover:border-primary/40')}
          >
            {l}
          </button>
        ))}
      </div>

      <form onSubmit={onSearch} className="mb-6 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, MRN, mobile, profession, diagnosis…"
            className="rounded-xl pl-10"
          />
        </div>
        <Button type="submit" variant="secondary" className="rounded-xl">Search</Button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading archived records…</div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center">
            <FileImage className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No scanned charts found{letter !== 'ALL' ? ` starting with “${letter}”` : ''}.</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-border">
              {records.map((p) => (
                <div key={p.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="grid h-11 w-11 place-items-center rounded-full bg-accent font-display text-base font-semibold text-accent-foreground">
                      {(p.first_name?.[0] || p.name?.[0] || '?').toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{p.name || `${p.first_name} ${p.last_name}`}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span>MRN {p.mrn || '—'}</span>
                        {p.mobile && <span>· {formatMobile(p.mobile)}</span>}
                        {p.cnic && <span>· {formatCNIC(p.cnic)}</span>}
                        {p.sex && <span>· {p.sex}</span>}
                        {p.age && <span>· {p.age}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" className="gap-1.5 rounded-lg" onClick={() => viewChart(p)} disabled={signing === p.id}>
                      {signing === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                      View chart
                    </Button>
                    <Link to={`/patients/${p.id}`}>
                      <Button size="sm" variant="secondary" className="gap-1.5 rounded-lg">
                        <FolderOpen className="h-3.5 w-3.5" /> File
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
            {hasMore && (
              <div className="border-t border-border p-4 text-center">
                <Button variant="ghost" size="sm" onClick={() => load(false)} disabled={loadingMore} className="gap-2">
                  {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}