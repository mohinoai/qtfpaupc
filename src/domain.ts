/** Pure domain logic: no DOM, no localStorage, no ambient clock. "now" is passed in for testability. */

export interface SessionInput {
  datetime: string;
  location: string;
  sky: string;
  constellations: string[];
  notes: string;
}

export interface SessionEntry extends SessionInput {
  id: string;
}

export type FieldName = 'datetime' | 'location' | 'sky' | 'constellations';

export interface ValidationResult {
  valid: boolean;
  errors: Partial<Record<FieldName, string>>;
}

export const MESSAGES = {
  datetimeRequired: 'Tanggal dan waktu sesi wajib diisi.',
  datetimeInvalid: 'Tanggal dan waktu tidak terbaca, isi ulang lewat pemilih tanggal.',
  datetimeFuture: 'Sesi pengamatan tidak bisa dicatat di masa depan.',
  locationRequired: 'Lokasi pengamatan wajib diisi.',
  skyRequired: 'Pilih salah satu kondisi langit.',
  constellationsRequired: 'Centang minimal satu konstelasi.',
} as const;

const DATETIME_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

/** Parses a `datetime-local` value as local wall-clock time. Returns null if unusable. */
export function parseLocalDateTime(value: string): number | null {
  if (typeof value !== 'string' || !DATETIME_LOCAL.test(value.trim())) return null;
  const time = new Date(value.trim()).getTime();
  return Number.isNaN(time) ? null : time;
}

function cleanList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const name = value.trim().replace(/\s+/g, ' ');
    if (!name) continue;
    const key = name.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/[ \t]+/g, ' ') : '';
}

/** `now` is epoch milliseconds, supplied by the caller. */
export function validateSessionInput(input: SessionInput, now: number): ValidationResult {
  const errors: Partial<Record<FieldName, string>> = {};

  const raw = typeof input?.datetime === 'string' ? input.datetime.trim() : '';
  if (!raw) {
    errors.datetime = MESSAGES.datetimeRequired;
  } else {
    const time = parseLocalDateTime(raw);
    if (time === null) errors.datetime = MESSAGES.datetimeInvalid;
    else if (time > now) errors.datetime = MESSAGES.datetimeFuture;
  }

  if (!cleanText(input?.location)) errors.location = MESSAGES.locationRequired;
  if (!cleanText(input?.sky)) errors.sky = MESSAGES.skyRequired;
  if (cleanList(input?.constellations).length === 0) {
    errors.constellations = MESSAGES.constellationsRequired;
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function createSessionEntry(input: SessionInput, id: string): SessionEntry {
  return {
    id,
    datetime: typeof input.datetime === 'string' ? input.datetime.trim() : '',
    location: cleanText(input.location),
    sky: cleanText(input.sky),
    constellations: cleanList(input.constellations),
    notes: typeof input.notes === 'string' ? input.notes.trim() : '',
  };
}

/** Newest session first, by session time rather than insertion order. Stable on ties. */
export function sortByDateDesc(sessions: SessionEntry[]): SessionEntry[] {
  return [...sessions].sort((a, b) => {
    const ta = parseLocalDateTime(a.datetime);
    const tb = parseLocalDateTime(b.datetime);
    if (ta === null && tb === null) return 0;
    if (ta === null) return 1;
    if (tb === null) return -1;
    return tb - ta;
  });
}

/** Same gate for stored data as for new data: anything failing the schema is
 *  dropped rather than rendered, so one bad record cannot break the list. */
export function normalizeStoredSession(raw: unknown): SessionEntry | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Record<string, unknown>;

  const id = typeof record.id === 'string' ? record.id.trim() : '';
  const datetime = typeof record.datetime === 'string' ? record.datetime.trim() : '';
  const location = cleanText(record.location);
  const sky = cleanText(record.sky);
  const constellations = cleanList(record.constellations);
  const notes = typeof record.notes === 'string' ? record.notes.trim() : '';

  if (!id || parseLocalDateTime(datetime) === null) return null;
  if (!location || !sky || constellations.length === 0) return null;

  return { id, datetime, location, sky, constellations, notes };
}
