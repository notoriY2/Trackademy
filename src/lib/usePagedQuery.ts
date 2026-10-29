import { useEffect, useState } from 'react';
import { supabase } from './supabase';

interface Opts {
  table: string; select: string; page: number; pageSize?: number;
  search?: string; searchCols?: string[];
  sortCol?: string; asc?: boolean;
  eq?: Record<string, string | number | boolean | undefined | ''>;
}

export function usePagedQuery<T = any>(o: Opts) {
  const { table, select, page, pageSize = 20, search = '', searchCols = [], sortCol, asc = true, eq = {} } = o;
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [debounced, setDebounced] = useState(search);
  const [tick, setTick] = useState(0);

  useEffect(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t); }, [search]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let q = supabase.from(table).select(select, { count: 'exact' });
      Object.entries(eq).forEach(([k, v]) => { if (v !== undefined && v !== '') q = q.eq(k, v as any); });
      if (debounced && searchCols.length)
        q = q.or(searchCols.map(c => `${c}.ilike.%${debounced.replace(/[%,]/g, '')}%`).join(','));
      if (sortCol) q = q.order(sortCol, { ascending: asc });
      const from = page * pageSize;
      const { data, count, error } = await q.range(from, from + pageSize - 1);
      if (cancelled) return;
      if (error) console.error(error);
      setRows((data as T[]) ?? []); setTotal(count ?? 0); setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [table, select, page, pageSize, debounced, sortCol, asc, JSON.stringify(eq), tick]);

  return { rows, total, loading, pageCount: Math.max(1, Math.ceil(total / pageSize)), refetch: () => setTick(t => t + 1) };
}