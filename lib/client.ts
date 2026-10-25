let authToken: string | null = null;

/** Used when the browser blocks the session cookie (embedded previews, private modes). */
export function setAuthToken(token: string | null): void {
  authToken = token;
  try {
    if (token) sessionStorage.setItem('ospm_token', token);
  } catch {
    /* storage can be blocked too — the header still works for this page */
  }
}

export function getAuthToken(): string | null {
  if (authToken) return authToken;
  try {
    authToken = sessionStorage.getItem('ospm_token');
  } catch {
    /* ignore */
  }
  return authToken;
}

export async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { 'x-ospm-token': token } : {}),
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.error || `Request failed (${res.status})`);
  return data as T;
}

export const post = <T = any>(path: string, body: unknown) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(body) });

export const patch = <T = any>(path: string, body: unknown) =>
  api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });

export const del = <T = any>(path: string) => api<T>(path, { method: 'DELETE' });

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/** Only http(s), mailto, anchors and local paths may become links. */
export function safeHref(url: string | null | undefined): string {
  const value = (url ?? '').trim();
  if (!value) return '#';
  return /^(https?:\/\/|mailto:|\/|#)/i.test(value) ? value : '#';
}

export function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
