import { asJson, sql } from './db';

/**
 * Owner-level flags live in one small table so behaviour can be changed from the
 * UI instead of a redeploy. Values are JSON so a setting can grow without a
 * migration. Never put secrets here.
 */
export async function getSetting<T = unknown>(key: string): Promise<T | null> {
  try {
    const rows = await sql<{ value: T }>('SELECT value FROM app_settings WHERE key = $1', [key]);
    return rows.length ? (rows[0].value as T) : null;
  } catch {
    // settings are an enhancement: a read failure must never break a request
    return null;
  }
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await sql(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, asJson(value)],
  );
}

export async function deleteSetting(key: string): Promise<void> {
  await sql('DELETE FROM app_settings WHERE key = $1', [key]);
}

export interface AISetting {
  provider?: 'ollama';
  model?: string;
  baseUrl?: string;
  embedModel?: string;
  updatedBy?: string;
  updatedAt?: string;
}

export const AI_SETTING_KEY = 'ai_model';
