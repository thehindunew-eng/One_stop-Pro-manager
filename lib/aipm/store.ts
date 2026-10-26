import { asJson, newId, sql } from '../db';
import type { Finding } from './guards';
import type { Project } from '../types';

/*
 * Where findings live.
 *
 * A finding is a room artefact, not an ephemeral toast: it has an owner, a
 * severity, a status and a confirmation trail. That is what makes the "no
 * autonomous writes" rule checkable — every action a human took is a row.
 */

export interface FindingRow {
  id: string;
  project_id: string;
  fingerprint: string;
  kind: string;
  severity: string;
  target: string;
  task_id: string | null;
  message: string;
  action: string;
  confidence: number;
  citations: { source: string; ref: string; detail: string }[];
  status: 'open' | 'acknowledged' | 'dismissed' | 'actioned';
  prompt_version: string;
  engine: string;
  created_by: string | null;
  confirmed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AipmSettings {
  enabled: boolean;
  /** Strict architecture mode: a HIGH deviation blocks completing the task, nothing else. */
  strict: boolean;
  maxPerPersonPerDay: number;
  digest: 'daily' | 'weekly' | 'off';
}

export const DEFAULT_AIPM_SETTINGS: AipmSettings = {
  enabled: true,
  strict: false,
  maxPerPersonPerDay: 3,
  digest: 'daily',
};

export function aipmSettings(project: Project): AipmSettings {
  const raw = (project.settings ?? {}) as Record<string, unknown>;
  const stored = raw.aipm && typeof raw.aipm === 'object' ? (raw.aipm as Partial<AipmSettings>) : {};
  return {
    enabled: stored.enabled !== false,
    strict: stored.strict === true,
    maxPerPersonPerDay:
      typeof stored.maxPerPersonPerDay === 'number' && stored.maxPerPersonPerDay >= 0
        ? Math.min(10, Math.round(stored.maxPerPersonPerDay))
        : DEFAULT_AIPM_SETTINGS.maxPerPersonPerDay,
    digest: stored.digest === 'weekly' || stored.digest === 'off' ? stored.digest : 'daily',
  };
}

export async function listFindings(projectId: string, limit = 60): Promise<FindingRow[]> {
  return sql<FindingRow>(
    `SELECT * FROM aipm_findings WHERE project_id = $1 ORDER BY
       CASE severity WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END,
       created_at DESC
     LIMIT $2`,
    [projectId, limit],
  );
}

export async function openFindingsFor(projectId: string, taskId: string): Promise<FindingRow[]> {
  return sql<FindingRow>(
    "SELECT * FROM aipm_findings WHERE project_id = $1 AND task_id = $2 AND status = 'open'",
    [projectId, taskId],
  );
}

export async function getFinding(projectId: string, id: string): Promise<FindingRow | null> {
  const rows = await sql<FindingRow>('SELECT * FROM aipm_findings WHERE project_id = $1 AND id = $2', [projectId, id]);
  return rows[0] ?? null;
}

/** `duplicate` when the same fingerprint is already open — an unchanged finding must not repeat. */
export async function persistFinding(
  projectId: string,
  finding: Finding,
  meta: { promptVersion: string; engine: string; createdBy: string },
): Promise<{ row: FindingRow | null; duplicate: boolean }> {
  const existing = await sql<FindingRow>(
    'SELECT * FROM aipm_findings WHERE project_id = $1 AND fingerprint = $2',
    [projectId, finding.fingerprint],
  );
  if (existing[0] && existing[0].status === 'open') return { row: existing[0], duplicate: true };

  const rows = await sql<FindingRow>(
    `INSERT INTO aipm_findings
       (id, project_id, fingerprint, kind, severity, target, task_id, message, action, confidence, citations,
        status, prompt_version, engine, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,'open',$12,$13,$14)
     ON CONFLICT (project_id, fingerprint) DO UPDATE SET
       message = $8, action = $9, confidence = $10, citations = $11::jsonb, status = 'open',
       prompt_version = $12, engine = $13, updated_at = now()
     RETURNING *`,
    [
      newId('aipm'),
      projectId,
      finding.fingerprint,
      finding.kind,
      finding.severity,
      finding.target,
      finding.task_id,
      finding.message,
      finding.suggested_action,
      finding.confidence,
      asJson(finding.citations),
      meta.promptVersion,
      meta.engine,
      meta.createdBy,
    ],
  );
  return { row: rows[0], duplicate: false };
}

export async function setFindingStatus(
  projectId: string,
  id: string,
  status: 'acknowledged' | 'dismissed' | 'actioned',
  by: string,
): Promise<FindingRow | null> {
  const rows = await sql<FindingRow>(
    `UPDATE aipm_findings SET status = $3, confirmed_by = $4, updated_at = now()
     WHERE project_id = $1 AND id = $2 RETURNING *`,
    [projectId, id, status, by],
  );
  return rows[0] ?? null;
}

/** Findings raised for a target in the last 24h — the noise budget is computed from this. */
export async function recentBudget(
  projectId: string,
): Promise<{ target: string; severity: string; task_id: string | null; created_at: string }[]> {
  return sql<{ target: string; severity: string; task_id: string | null; created_at: string }>(
    "SELECT target, severity, task_id, created_at FROM aipm_findings WHERE project_id = $1 AND created_at > now() - interval '24 hours'",
    [projectId],
  );
}

export async function recordRun(input: {
  projectId: string;
  engine: string;
  promptVersion: string;
  found: number;
  kept: number;
  ms: number;
  gaps: string[];
  createdBy: string;
}): Promise<void> {
  await sql(
    `INSERT INTO aipm_runs (id, project_id, engine, prompt_version, found, kept, ms, gaps, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
    [
      newId('run'),
      input.projectId,
      input.engine,
      input.promptVersion,
      input.found,
      input.kept,
      input.ms,
      asJson(input.gaps),
      input.createdBy,
    ],
  );
}

export async function lastRun(projectId: string): Promise<{ created_at: string; engine: string; kept: number } | null> {
  const rows = await sql<{ created_at: string; engine: string; kept: number }>(
    'SELECT created_at, engine, kept FROM aipm_runs WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1',
    [projectId],
  );
  return rows[0] ?? null;
}
