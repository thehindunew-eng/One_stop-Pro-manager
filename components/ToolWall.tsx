'use client';

import { useMemo, useState } from 'react';
import { ExternalLink, Search, SlidersHorizontal } from 'lucide-react';
import type { Stage, StageKey, Tool } from '@/lib/types';
import { ToolIcon } from './ui';
import { hostFromUrl } from '@/lib/client';

export default function ToolWall({
  tools,
  stages,
  stageKey,
  canAdmin,
  onManage,
}: {
  tools: Tool[];
  stages: Stage[];
  stageKey?: StageKey;
  canAdmin?: boolean;
  onManage?: () => void;
}) {
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<'stage' | 'all'>(stageKey ? 'stage' : 'all');

  const filtered = useMemo(() => {
    const list = tools.filter((t) => (scope === 'stage' && stageKey ? t.stages.includes(stageKey) : true));
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (t) =>
        t.name.toLowerCase().includes(needle) ||
        t.category.toLowerCase().includes(needle) ||
        t.description.toLowerCase().includes(needle),
    );
  }, [tools, q, scope, stageKey]);

  const groups = useMemo(() => {
    const map = new Map<string, Tool[]>();
    for (const t of filtered) {
      const arr = map.get(t.category) ?? [];
      arr.push(t);
      map.set(t.category, arr);
    }
    return [...map.entries()];
  }, [filtered]);

  const stageName = stages.find((s) => s.key === stageKey)?.name;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[190px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            className="field py-2 pl-9 text-[12.5px]"
            placeholder="Find a tool, category or use case…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {stageKey && (
          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-ink-900/60 p-0.5">
            <button
              type="button"
              className={`rounded-md px-2.5 py-1.5 text-[11.5px] font-medium ${scope === 'stage' ? 'bg-white/[0.09] text-white' : 'text-slate-400'}`}
              onClick={() => setScope('stage')}
            >
              {stageName ?? 'This stage'}
            </button>
            <button
              type="button"
              className={`rounded-md px-2.5 py-1.5 text-[11.5px] font-medium ${scope === 'all' ? 'bg-white/[0.09] text-white' : 'text-slate-400'}`}
              onClick={() => setScope('all')}
            >
              All tools
            </button>
          </div>
        )}
        {canAdmin && onManage && (
          <button type="button" className="btn-ghost py-2 text-[12px]" onClick={onManage}>
            <SlidersHorizontal className="h-3.5 w-3.5" /> Manage
          </button>
        )}
      </div>

      <div className="space-y-5">
        {groups.map(([cat, list]) => (
          <div key={cat}>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{cat}</span>
              <span className="text-[10px] text-slate-600">{list.length}</span>
              <div className="h-px flex-1 bg-white/[0.06]" />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((t) => (
                <a
                  key={t.id}
                  href={t.url || '#'}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="group panel-flat card-hover flex items-start gap-2.5 p-2.5"
                  title={`${t.description}\nFree tier: ${t.free_tier}`}
                >
                  <ToolIcon name={t.name} color={t.color} size={32} rounded={9} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[12.5px] font-medium text-slate-100">{t.name}</span>
                      <ExternalLink className="h-3 w-3 shrink-0 text-slate-600 opacity-0 transition group-hover:opacity-100" />
                    </div>
                    <div className="truncate text-[10.5px] text-slate-500">{t.free_tier || t.category}</div>
                    <div className="mt-0.5 truncate text-[10.5px] text-slate-600">{hostFromUrl(t.url)}</div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        ))}
        {!groups.length && (
          <div className="panel-flat p-6 text-center text-[12.5px] text-slate-500">
            No tool matches “{q}”. {canAdmin ? 'Add it from the admin console — no deploy needed.' : 'Ask the owner to add it.'}
          </div>
        )}
      </div>
    </div>
  );
}
