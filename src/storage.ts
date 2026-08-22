/** localStorage boundary. `loadSessions` and `saveSessions` never call each
 *  other, so a read failure and a write failure keep separate signals and
 *  reach separate places in the UI. */
import { normalizeStoredSession, type SessionEntry } from './domain';

const KEY = 'constellation.sessions.v1';

export type LoadResult =
  | { ok: true; sessions: SessionEntry[]; skipped: number }
  | { ok: false; sessions: SessionEntry[]; reason: string };

export type SaveResult = { ok: true } | { ok: false; reason: string };

export function loadSessions(): LoadResult {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return { ok: false, sessions: [], reason: 'Penyimpanan browser tidak bisa dibaca.' };
  }

  if (raw === null) return { ok: true, sessions: [], skipped: 0 };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, sessions: [], reason: 'Data tersimpan rusak dan tidak bisa dibaca.' };
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, sessions: [], reason: 'Data tersimpan tidak berbentuk daftar sesi.' };
  }

  const sessions: SessionEntry[] = [];
  let skipped = 0;
  for (const item of parsed) {
    const entry = normalizeStoredSession(item);
    if (entry) sessions.push(entry);
    else skipped += 1;
  }
  return { ok: true, sessions, skipped };
}

export function saveSessions(sessions: SessionEntry[]): SaveResult {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(sessions));
    return { ok: true };
  } catch (error) {
    const full = error instanceof DOMException && error.name === 'QuotaExceededError';
    return {
      ok: false,
      reason: full
        ? 'Penyimpanan browser penuh, sesi ini belum tersimpan.'
        : 'Sesi gagal disimpan ke penyimpanan browser.',
    };
  }
}
