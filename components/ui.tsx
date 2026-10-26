'use client';

import { safeHref } from '@/lib/client';
import React, { useState } from 'react';
import {
  Compass, ClipboardList, Lightbulb, Palette, Boxes, Code2, FlaskConical, Rocket, TrendingUp,
  Check, Copy, Loader2, Sparkles, type LucideIcon,
} from 'lucide-react';

export const STAGE_ICONS: Record<string, LucideIcon> = {
  Compass, ClipboardList, Lightbulb, Palette, Boxes, Code2, FlaskConical, Rocket, TrendingUp,
  Sparkles, Check,
};

export function StageIcon({ name, className }: { name: string; className?: string }) {
  const Icon = STAGE_ICONS[name] ?? Compass;
  return <Icon className={className} strokeWidth={1.75} />;
}

/* ------------------------------- brand ---------------------------------- */

export function Logo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <div
      className={`grid shrink-0 place-items-center rounded-[10px] text-white ${className}`}
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(160deg, #35508a 0%, #1e2f57 48%, #14203c 100%)',
        border: '1px solid #0b1220',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.34), inset 0 -1px 0 rgba(0,0,0,.35), 0 6px 14px -10px rgba(20,35,70,.9)',
      }}
      aria-hidden
    >
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none">
        <path d="M5 19V7.5L12 13l7-5.5V19" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <Logo size={28} />
      <div className="leading-none">
        <div className="text-[13px] font-semibold tracking-tight text-slate-900">One Stop</div>
        {!compact && (
          <div className="mt-1 text-[11px] font-medium uppercase tracking-[.08em] text-slate-500">Pro Manager</div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- icons ---------------------------------- */

/** Tint a hex colour towards the background so initials stay legible. */
function tint(hex: string, amount: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(num)) return '#4338ca';
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const mix = (c: number) => Math.round(c * (1 - amount) + 255 * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function darken(hex: string, amount: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(num)) return '#4338ca';
  const r = Math.round(((num >> 16) & 255) * (1 - amount));
  const g = Math.round(((num >> 8) & 255) * (1 - amount));
  const b = Math.round((num & 255) * (1 - amount));
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Tool marks are flat, tinted brand tiles: one colour, no gradient, no glow.
 * 104 of them sit next to each other, so restraint is what makes the wall read.
 */
export function ToolIcon({
  name,
  color,
  size = 32,
  rounded = 8,
}: {
  name: string;
  color?: string;
  size?: number;
  rounded?: number;
}) {
  const hex = (color || '4338ca').replace('#', '');
  const safe = /^[0-9a-fA-F]{6}$/.test(hex) ? hex : /^[0-9a-fA-F]{3}$/.test(hex) ? hex : '4338ca';
  const initials = name
    .replace(/[^A-Za-z0-9 ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <div
      className="grid shrink-0 place-items-center border font-semibold"
      style={{
        width: size,
        height: size,
        borderRadius: rounded,
        fontSize: Math.max(10, size * 0.36),
        letterSpacing: '-0.01em',
        /* Glass tile: the brand tint stays, the black hairline keeps it in the system. */
        background: `linear-gradient(158deg, rgba(255,255,255,.86), ${tint(`#${safe}`, 0.76)})`,
        borderColor: 'rgba(11,18,32,.8)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.9), inset 0 -1px 0 rgba(255,255,255,.35), 0 2px 6px -5px rgba(11,18,32,.7)',
        color: darken(`#${safe}`, 0.4),
      }}
      title={name}
      aria-hidden
    >
      {initials || '·'}
    </div>
  );
}

/* ------------------------------- people --------------------------------- */

/*
 * Cool jewel tones: navy, steel, slate-blue, graphite-plum. Professional, still
 * distinguishable at 26px, and each carries a light ring so it reads on glass.
 */
const AVATAR_COLORS = [
  ['#2c4270', '#1b2b4d'],
  ['#3a5170', '#243449'],
  ['#4a5478', '#2e3450'],
  ['#2f4a58', '#1d3039'],
  ['#414a63', '#282f44'],
  ['#525a74', '#343a4f'],
];

export function Avatar({ name, size = 26 }: { name: string; size?: number; accent?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  const hash = [...name].reduce((n, c) => n + c.charCodeAt(0), 0);
  const pair = AVATAR_COLORS[hash % AVATAR_COLORS.length];
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, size * 0.38),
        background: `linear-gradient(160deg, ${pair[0]}, ${pair[1]})`,
        border: '1px solid rgba(11,18,32,.65)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.28)',
      }}
      title={name}
    >
      {initials}
    </div>
  );
}

/* ------------------------------- labels --------------------------------- */

export function Pill({
  children,
  tone = 'slate',
  className = '',
}: {
  children: React.ReactNode;
  tone?: 'slate' | 'mint' | 'amber' | 'rose' | 'electric' | 'cyan';
  className?: string;
}) {
  /*
   * A tinted sheet of glass: the tone is carried by the text colour plus a 6%
   * wash of the same hue, so a status is legible at a glance without a
   * saturated fill that would fight the monochrome chrome.
   */
  const tones: Record<string, string> = {
    slate: 'text-slate-700 border-slate-900/30 bg-white/55',
    mint: 'text-mint border-emerald-800/30 bg-emerald-500/10',
    amber: 'text-amber border-amber-800/30 bg-amber-500/10',
    rose: 'text-rose border-rose-800/30 bg-rose-500/10',
    electric: 'text-electric border-indigo-900/35 bg-indigo-500/10',
    cyan: 'text-cyan border-cyan-800/30 bg-cyan-500/10',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[12px] font-medium leading-4 shadow-[inset_0_1px_0_rgba(255,255,255,.85)] ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function CopyButton({ value, label = 'Copy link', className = '' }: { value: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={`btn-ghost ${className}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          /* clipboard can be blocked — the link is still visible */
        }
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}
    >
      {done ? <Check className="h-4 w-4 text-mint" /> : <Copy className="h-4 w-4" />}
      <span className="hidden sm:inline">{done ? 'Copied' : label}</span>
    </button>
  );
}

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} />;
}

export function ProgressRing({
  value,
  size = 22,
  stroke = 2.5,
  color = '#4338ca',
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <svg width={size} height={size} className="-rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e4e7ec" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - (pct / 100) * c}
        style={{ transition: 'stroke-dashoffset .5s ease' }}
      />
    </svg>
  );
}

/* ------------------------------- markdown ------------------------------- */

function inline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyPrefix}-${i++}`;
    if (tok.startsWith('**')) nodes.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('`')) nodes.push(<code key={key}>{tok.slice(1, -1)}</code>);
    else if (tok.startsWith('[')) {
      const mm = /\[([^\]]+)\]\(([^)]+)\)/.exec(tok);
      nodes.push(
        <a key={key} href={safeHref(mm?.[2])} target="_blank" rel="noreferrer noopener">
          {mm?.[1] ?? tok}
        </a>,
      );
    } else nodes.push(<em key={key}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Small dependency-free markdown renderer (headings, lists, tables, code, quotes, task lists). */
export function Markdown({ text, className = '' }: { text: string; className?: string }) {
  const lines = (text || '').replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.trim().startsWith('```')) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) buf.push(lines[i++]);
      i++;
      blocks.push(
        <pre key={key++}>
          <code>{buf.join('\n')}</code>
        </pre>,
      );
      continue;
    }
    if (/^\s*\|/.test(line)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        const cells = lines[i].trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c) || c === '')) rows.push(cells);
        i++;
      }
      if (rows.length) {
        const [head, ...body] = rows;
        blocks.push(
          <div key={key++} className="overflow-x-auto">
            <table>
              <thead>
                <tr>{head.map((h, hi) => <th key={hi}>{inline(h, `h${key}-${hi}`)}</th>)}</tr>
              </thead>
              <tbody>
                {body.map((r, ri) => (
                  <tr key={ri}>
                    {r.map((c, ci) => (
                      <td key={ci}>{inline(c, `c${key}-${ri}-${ci}`)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
      }
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const content = inline(h[2], `hd${key}`);
      if (level === 1) blocks.push(<h1 key={key++}>{content}</h1>);
      else if (level === 2) blocks.push(<h2 key={key++}>{content}</h2>);
      else blocks.push(<h3 key={key++}>{content}</h3>);
      i++;
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: { text: string; task?: boolean; checked?: boolean }[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        let item = lines[i].replace(/^\s*([-*]|\d+\.)\s+/, '');
        let task: boolean | undefined;
        let checked: boolean | undefined;
        const tm = /^\[([ xX])\]\s*(.*)$/.exec(item);
        if (tm) {
          task = true;
          checked = tm[1].toLowerCase() === 'x';
          item = tm[2];
        }
        items.push({ text: item, task, checked });
        i++;
      }
      const List = ordered ? 'ol' : 'ul';
      blocks.push(
        <List key={key++} className="list-none">
          {items.map((it, idx) => (
            <li key={idx} className={it.task ? 'flex items-start gap-2 list-none pl-0' : ''}>
              {it.task && (
                <span
                  className={`mt-[3px] grid h-[15px] w-[15px] shrink-0 place-items-center rounded-[4px] border ${
                    it.checked ? 'border-emerald-500 bg-emerald-100 text-emerald-600' : 'border-slate-900/40 bg-white/80'
                  }`}
                >
                  {it.checked && <Check className="h-3 w-3" />}
                </span>
              )}
              <span>{inline(it.text, `li${key}-${idx}`)}</span>
            </li>
          ))}
        </List>,
      );
      continue;
    }
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push(<blockquote key={key++}>{inline(buf.join(' '), `bq${key}`)}</blockquote>);
      continue;
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      blocks.push(<hr key={key++} />);
      i++;
      continue;
    }
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,4})\s|^\s*([-*]|\d+\.)\s|^\s*\||^>\s?|^```/.test(lines[i])
    ) {
      buf.push(lines[i++]);
    }
    blocks.push(<p key={key++}>{inline(buf.join(' '), `p${key}`)}</p>);
  }

  return <div className={`md ${className}`}>{blocks}</div>;
}
