import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Inbox, Loader2, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

/*
 * DataTable — the one table used across the portal.
 *
 * columns: [{
 *   key,                       // unique id; also the default field for value/sort/search
 *   header,                    // column title (string or node)
 *   cell?: (row) => node,      // custom renderer (default: row[key])
 *   value?: (row) => any,      // plain value used for sorting / searching / mobile text (default row[key])
 *   sortable?: boolean,
 *   align?: 'left'|'center'|'right',
 *   className?: string,        // applied to <td>
 *   headerClassName?: string,
 *   hideBelow?: 'md'|'lg'|'xl',// hide the column in the table view below this width
 *   mobile?: 'title'|'subtitle'|'badge'|'hidden', // role in the phone card (default: shown as label/value)
 *   mobileLabel?: string,
 * }]
 * data, loading, getRowId
 * search: { placeholder, keys?: [colKey|field], value?, onChange? }  — client search unless value/onChange given
 * filters: [{ key, label, options:[{value,label}], value?, onChange?, predicate?:(row,value)=>bool, allLabel? }]
 *          — client-side when predicate given and value/onChange omitted; controlled otherwise
 * toolbar: node (e.g. <DateRangeFilter/>) rendered with the filters
 * actions: node rendered at the right end of the toolbar (e.g. export buttons)
 * rowActions: (row) => node     onRowClick: (row) => void
 * pagination: { pageSize } | false (client paging)       loadMore: { hasMore, loading, onLoadMore } (server paging)
 * initialSort: { key, dir: 'asc'|'desc' }
 * emptyState: { icon, title, description, action }
 * footer: node (e.g. totals) shown under the table
 * mobileCard: (row) => node    custom phone card (overrides the generated one)
 * rowClassName: (row) => string
 * caption: accessible description of the table
 */

const hideClass = { md: 'hidden md:table-cell', lg: 'hidden lg:table-cell', xl: 'hidden xl:table-cell' };
const alignClass = { left: 'text-left', center: 'text-center', right: 'text-right' };

const plain = (v) => {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
};

export default function DataTable({
  columns, data = [], loading = false, getRowId = (r) => r.id,
  search, filters = [], toolbar, actions,
  rowActions, onRowClick, pagination = { pageSize: 25 }, loadMore,
  initialSort, emptyState, footer, mobileCard, rowClassName, caption, className,
}) {
  const valueOf = (col, row) => (col.value ? col.value(row) : row?.[col.key]);

  // ---- search (client or controlled)
  const controlledSearch = search && typeof search.onChange === 'function';
  const [localQuery, setLocalQuery] = useState('');
  const query = controlledSearch ? (search.value ?? '') : localQuery;
  const setQuery = controlledSearch ? search.onChange : setLocalQuery;

  // ---- filters (client ones keep their own state)
  const [localFilters, setLocalFilters] = useState({});
  const filterValue = (f) => (typeof f.onChange === 'function' ? (f.value ?? 'all') : (localFilters[f.key] ?? 'all'));
  const setFilter = (f, v) => (typeof f.onChange === 'function' ? f.onChange(v) : setLocalFilters((s) => ({ ...s, [f.key]: v })));

  // ---- sort
  const [sort, setSort] = useState(initialSort || null);
  const toggleSort = (col) => {
    if (!col.sortable) return;
    setSort((s) => (s?.key === col.key ? (s.dir === 'asc' ? { key: col.key, dir: 'desc' } : null) : { key: col.key, dir: 'asc' }));
  };

  const processed = useMemo(() => {
    let rows = Array.isArray(data) ? data : [];
    if (!controlledSearch && query.trim()) {
      const q = query.trim().toLowerCase();
      const keys = search?.keys;
      rows = rows.filter((r) => {
        if (keys?.length) return keys.some((k) => { const col = columns.find((c) => c.key === k); return plain(col ? valueOf(col, r) : r?.[k]).toLowerCase().includes(q); });
        return columns.some((c) => plain(valueOf(c, r)).toLowerCase().includes(q));
      });
    }
    for (const f of filters) {
      if (typeof f.onChange === 'function' || !f.predicate) continue;
      const v = filterValue(f);
      if (v !== 'all') rows = rows.filter((r) => f.predicate(r, v));
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col) {
        const dir = sort.dir === 'desc' ? -1 : 1;
        rows = [...rows].sort((a, b) => {
          const av = valueOf(col, a);
          const bv = valueOf(col, b);
          if (av === bv) return 0;
          if (av === null || av === undefined || av === '') return 1;
          if (bv === null || bv === undefined || bv === '') return -1;
          if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
          return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * dir;
        });
      }
    }
    return rows;
  }, [data, query, localFilters, sort, columns, filters]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- client pagination
  const pageSize = pagination && !loadMore ? pagination.pageSize || 25 : null;
  const [page, setPage] = useState(1);
  const pageCount = pageSize ? Math.max(1, Math.ceil(processed.length / pageSize)) : 1;
  useEffect(() => { setPage(1); }, [query, localFilters, data]);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  const visible = pageSize ? processed.slice((page - 1) * pageSize, page * pageSize) : processed;

  const activeFilterCount = filters.filter((f) => filterValue(f) !== 'all').length + (query.trim() ? 1 : 0);
  const clearAll = () => {
    setQuery('');
    filters.forEach((f) => setFilter(f, 'all'));
  };

  const showToolbar = search || filters.length || toolbar || actions;
  const titleCol = columns.find((c) => c.mobile === 'title') || columns[0];
  const subtitleCol = columns.find((c) => c.mobile === 'subtitle');
  const badgeCol = columns.find((c) => c.mobile === 'badge');
  const detailCols = columns.filter((c) => c !== titleCol && c !== subtitleCol && c !== badgeCol && c.mobile !== 'hidden');
  const cellNode = (col, row) => (col.cell ? col.cell(row) : (plain(valueOf(col, row)) || <span className="text-muted-foreground">—</span>));

  const Empty = () => {
    const Icon = emptyState?.icon || Inbox;
    const filtered = activeFilterCount > 0 && (data?.length || 0) > 0;
    return (
      <div className="flex flex-col items-center px-6 py-14 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground"><Icon className="h-6 w-6" aria-hidden="true" /></span>
        <p className="mt-3 font-medium">{filtered ? 'No matching records' : emptyState?.title || 'Nothing here yet'}</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{filtered ? 'Try a different search or clear the filters.' : emptyState?.description}</p>
        <div className="mt-4">{filtered ? <Button variant="outline" size="sm" onClick={clearAll}>Clear filters</Button> : emptyState?.action}</div>
      </div>
    );
  };

  return (
    <div className={cn('space-y-3', className)}>
      {showToolbar && (
        <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
          {search && (
            <div className="relative w-full lg:w-72 xl:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={search.placeholder || 'Search…'}
                aria-label={search.placeholder || 'Search'}
                className="h-10 pl-9 pr-9"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent" aria-label="Clear search">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
          {(filters.length > 0 || toolbar) && (
            <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
              {filters.map((f) => (
                <Select key={f.key} value={filterValue(f)} onValueChange={(v) => setFilter(f, v)}>
                  <SelectTrigger className="h-10 w-full sm:w-auto sm:min-w-[10rem]" aria-label={f.label}>
                    <span className="mr-1 text-muted-foreground">{f.label}:</span>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{f.allLabel || 'All'}</SelectItem>
                    {f.options.map((o) => <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              ))}
              {toolbar}
              {activeFilterCount > 0 && filters.length > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={clearAll} className="h-10 gap-1.5 justify-self-start text-muted-foreground">
                  <X className="h-4 w-4" /> Clear
                </Button>
              )}
            </div>
          )}
          {actions && <div className="flex flex-wrap gap-2 lg:ml-auto">{actions}</div>}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {/* ---- table (tablet / desktop) */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            {caption && <caption className="sr-only">{caption}</caption>}
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {columns.map((col) => {
                  const active = sort?.key === col.key;
                  const SortIcon = active ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
                  return (
                    <th
                      key={col.key}
                      scope="col"
                      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                      className={cn('whitespace-nowrap px-4 py-3 font-medium', alignClass[col.align || 'left'], col.hideBelow && hideClass[col.hideBelow], col.headerClassName)}
                    >
                      {col.sortable ? (
                        <button type="button" onClick={() => toggleSort(col)} className={cn('inline-flex items-center gap-1 uppercase tracking-wide hover:text-foreground', active && 'text-foreground')}>
                          {col.header}
                          <SortIcon className={cn('h-3.5 w-3.5', !active && 'opacity-40')} aria-hidden="true" />
                        </button>
                      ) : col.header}
                    </th>
                  );
                })}
                {rowActions && <th scope="col" className="px-4 py-3 text-right font-medium"><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {loading && !visible.length ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`sk-${i}`} className="border-t border-border">
                    {columns.map((col) => (
                      <td key={col.key} className={cn('px-4 py-3.5', col.hideBelow && hideClass[col.hideBelow])}>
                        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                      </td>
                    ))}
                    {rowActions && <td className="px-4 py-3.5" />}
                  </tr>
                ))
              ) : visible.length === 0 ? (
                <tr><td colSpan={columns.length + (rowActions ? 1 : 0)}><Empty /></td></tr>
              ) : (
                visible.map((row) => (
                  <tr
                    key={getRowId(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn('border-t border-border align-middle transition-colors hover:bg-muted/40', onRowClick && 'cursor-pointer', rowClassName?.(row))}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className={cn('px-4 py-3', alignClass[col.align || 'left'], col.hideBelow && hideClass[col.hideBelow], col.className)}>
                        {cellNode(col, row)}
                      </td>
                    ))}
                    {rowActions && (
                      <td className="whitespace-nowrap px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center justify-end gap-1">{rowActions(row)}</div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ---- cards (phones) */}
        <div className="divide-y divide-border md:hidden">
          {loading && !visible.length ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={`msk-${i}`} className="space-y-2 p-4">
                <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
                <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
              </div>
            ))
          ) : visible.length === 0 ? (
            <Empty />
          ) : (
            visible.map((row) => (
              <div
                key={getRowId(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn('p-4', onRowClick && 'cursor-pointer active:bg-muted/40', rowClassName?.(row))}
              >
                {mobileCard ? mobileCard(row) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{cellNode(titleCol, row)}</div>
                        {subtitleCol && <div className="mt-0.5 truncate text-xs text-muted-foreground">{cellNode(subtitleCol, row)}</div>}
                      </div>
                      {badgeCol && <div className="shrink-0">{cellNode(badgeCol, row)}</div>}
                    </div>
                    {detailCols.length > 0 && (
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        {detailCols.map((col) => (
                          <div key={col.key} className="min-w-0">
                            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{col.mobileLabel || col.header}</dt>
                            <dd className="mt-0.5 break-words">{cellNode(col, row)}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </>
                )}
                {rowActions && (
                  <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-border pt-3" onClick={(e) => e.stopPropagation()}>
                    {rowActions(row)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {footer && <div className="border-t border-border bg-muted/30 px-4 py-3 text-sm">{footer}</div>}
      </div>

      {/* ---- paging */}
      {pageSize && processed.length > 0 && (
        <div className="flex flex-col items-center justify-between gap-2 text-sm text-muted-foreground sm:flex-row">
          <span>
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, processed.length)} of {processed.length}
          </span>
          {pageCount > 1 && (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="gap-1">
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <span className="px-2 tabular-nums">{page} / {pageCount}</span>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page === pageCount} className="gap-1">
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
      {loadMore && (
        <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
          {typeof loadMore.total === 'number' && <span>Showing {data.length} of {loadMore.total}</span>}
          {loadMore.hasMore && (
            <Button variant="outline" onClick={loadMore.onLoadMore} disabled={loadMore.loading} className="gap-2">
              {loadMore.loading && <Loader2 className="h-4 w-4 animate-spin" />} Load more
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
