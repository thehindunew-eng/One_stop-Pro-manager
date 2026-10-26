'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, KeyRound, Loader2, RefreshCw, ShieldCheck, User,
} from 'lucide-react';
import { api } from '@/lib/client';
import { Avatar, Pill, Spinner } from './ui';

interface StatusRow {
  user_id: string;
  name: string;
  role: string;
  last_seen: string | null;
  online: boolean;
  open: number;
  overdue: number;
  in_progress: { id: string; title: string; stage: string; branch?: string | null } | null;
  next_due: string | null;
  credentials: number;
  notes_this_week: number;
  last_note: { content: string; at: string; task: string } | null;
}

interface Coverage {
  user_id: string;
  name: string;
  role: string;
  connected: number;
  saved: number;
  providers: string[];
  blocked: boolean;
}

const ago = (iso: string | null): string => {
  if (!iso) return 'never';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

/**
 * What every seat is doing, right now.
 *
 * One component, two homes: the Build tab for the team and the owner console
 * for the admin. The difference is disclosure, not data — the owner also sees
 * who has attached access, still without a single secret.
 */
export default function LiveStatus({
  code,
  stageNames,
  owner = false,
}: {
  code: string;
  stageNames: Record<string, string>;
  owner?: boolean;
}) {
  const [rows, setRows] = useState<StatusRow[] | null>(null);
  const [coverage, setCoverage] = useState<Coverage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const build = await api<{ status: StatusRow[] }>(`/api/build?code=${encodeURIComponent(code)}`);
      setRows(build.status);
      if (owner) {
        const creds = await api<{ coverage: Coverage[] }>(`/api/credentials?code=${encodeURIComponent(code)}`);
        setCoverage(creds.coverage);
      }
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [code, owner]);

  useEffect(() => {
    void load();
  }, [load]);

  const online = (rows ?? []).filter((r) => r.online).length;
  const open = (rows ?? []).reduce((sum, r) => sum + r.open, 0);
  const late = (rows ?? []).reduce((sum, r) => sum + r.overdue, 0);

  return (
    <div className="space-y-3">
      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-900/15 px-4 py-2.5">
          {owner ? <ShieldCheck className="h-4 w-4 text-slate-700" /> : <User className="h-4 w-4 text-slate-700" />}
          <h3 className="text-[14px] font-semibold text-slate-900">Live task status</h3>
          <span className="text-[12px] text-slate-500">
            {online} of {rows?.length ?? 0} online · {open} open · {late} late
          </span>
          <button type="button" className="btn-ghost ml-auto h-7 px-2 text-[12px]" onClick={() => void load()}>
            {loading ? <Spinner className="h-3 w-3" /> : <RefreshCw className="h-3 w-3" />} Refresh
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-4 py-2 text-[12px] text-rose">
            <AlertTriangle className="h-3 w-3" /> {error}
          </div>
        )}

        <div className="divide-y divide-slate-900/10">
          {(rows ?? []).map((s) => (
            <div key={s.user_id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
              <span className="relative">
                <Avatar name={s.name} size={24} />
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-white ${
                    s.online ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[13px] font-medium text-slate-900">{s.name}</span>
                  <span className="text-[11px] uppercase tracking-wider text-slate-500">{s.role}</span>
                  <span className="text-[11px] text-slate-500">
                    {s.online ? '· online now' : `· seen ${ago(s.last_seen)}`}
                  </span>
                </div>
                <div className="text-[12px] text-slate-600">
                  {s.in_progress ? (
                    <span className="inline-flex items-center gap-1">
                      <Loader2 className="h-3 w-3 text-slate-500" />
                      {s.in_progress.title}
                      <span className="text-slate-500">· {stageNames[s.in_progress.stage] ?? s.in_progress.stage}</span>
                      {s.in_progress.branch && (
                        <span className="font-mono text-[11px] text-slate-500">· {s.in_progress.branch}</span>
                      )}
                    </span>
                  ) : s.open ? (
                    <span>Nothing started yet — {s.open} open task{s.open === 1 ? '' : 's'}</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-slate-500">
                      <CheckCircle2 className="h-3 w-3" /> no open work
                    </span>
                  )}
                </div>
                {s.last_note && (
                  <div className="truncate text-[11px] text-slate-500">
                    last note · {s.last_note.content} — {ago(s.last_note.at)}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="chip h-6 tnum">{s.open} open</span>
                {s.overdue > 0 && <span className="chip h-6 border-rose-300 text-rose tnum">{s.overdue} late</span>}
                {s.notes_this_week > 0 && <span className="chip h-6 tnum">{s.notes_this_week} notes/wk</span>}
                <span className={`chip h-6 ${s.credentials ? '' : 'text-slate-500'}`}>
                  <KeyRound className="h-2.5 w-2.5" /> {s.credentials}
                </span>
              </div>
            </div>
          ))}
          {!loading && !(rows ?? []).length && (
            <p className="px-4 py-3 text-[13px] text-slate-600">Nobody has joined this room yet.</p>
          )}
        </div>
        <div className="border-t border-slate-900/10 px-4 py-2 text-[11px] text-slate-500">
          Online means active in the last 5 minutes. The team sees the same table — status is not a secret, access is.
        </div>
      </div>

      {owner && (
        <div className="panel overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-900/15 px-4 py-2.5">
            <KeyRound className="h-3.5 w-3.5 text-slate-700" />
            <h3 className="text-[14px] font-semibold text-slate-900">Access, per person</h3>
            <span className="text-[12px] text-slate-500">Status only — the platform cannot show you a secret.</span>
          </div>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-slate-900/10 text-left text-[11px] uppercase tracking-[.08em] text-slate-500">
                <th className="px-4 py-1.5 font-semibold">Person</th>
                <th className="px-2 py-1.5 font-semibold">Seat</th>
                <th className="px-2 py-1.5 font-semibold">Verified</th>
                <th className="px-2 py-1.5 font-semibold">Services</th>
                <th className="px-4 py-1.5 font-semibold">State</th>
              </tr>
            </thead>
            <tbody>
              {coverage.map((c) => (
                <tr key={c.user_id} className="border-b border-slate-900/5">
                  <td className="px-4 py-1.5">
                    <span className="inline-flex items-center gap-1.5">
                      <Avatar name={c.name} size={18} /> {c.name}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-slate-600">{c.role}</td>
                  <td className="px-2 py-1.5 tnum text-slate-700">
                    {c.connected}/{c.saved}
                  </td>
                  <td className="px-2 py-1.5 text-slate-600">{c.providers.join(', ') || '—'}</td>
                  <td className="px-4 py-1.5">
                    {c.blocked ? (
                      <Pill tone="rose">needs attention</Pill>
                    ) : c.saved ? (
                      <Pill tone="mint">ok</Pill>
                    ) : (
                      <Pill tone="amber">not connected</Pill>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
