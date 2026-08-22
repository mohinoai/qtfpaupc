import { describe, expect, it } from 'vitest';
import {
  MESSAGES,
  createSessionEntry,
  normalizeStoredSession,
  sortByDateDesc,
  validateSessionInput,
  type SessionEntry,
  type SessionInput,
} from './domain';

const NOW = new Date('2026-03-14T21:30').getTime();

const base = (over: Partial<SessionInput> = {}): SessionInput => ({
  datetime: '2026-03-14T20:00',
  location: 'Pantai Ngobaran',
  sky: 'Cerah tanpa awan',
  constellations: ['Orion'],
  notes: '',
  ...over,
});

const entry = (id: string, datetime: string): SessionEntry => ({
  id,
  datetime,
  location: 'Dieng',
  sky: 'Cerah tanpa awan',
  constellations: ['Crux'],
  notes: '',
});

describe('validateSessionInput', () => {
  it('accepts a complete past session', () => {
    expect(validateSessionInput(base(), NOW)).toEqual({ valid: true, errors: {} });
  });

  it('reports every empty field at once', () => {
    const result = validateSessionInput(
      base({ datetime: '', location: '   ', sky: '', constellations: [] }),
      NOW,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual({
      datetime: MESSAGES.datetimeRequired,
      location: MESSAGES.locationRequired,
      sky: MESSAGES.skyRequired,
      constellations: MESSAGES.constellationsRequired,
    });
  });

  it('rejects a session dated after the supplied now', () => {
    const result = validateSessionInput(base({ datetime: '2026-03-14T21:31' }), NOW);
    expect(result.errors.datetime).toBe(MESSAGES.datetimeFuture);
  });

  it('accepts a session at exactly now', () => {
    expect(validateSessionInput(base({ datetime: '2026-03-14T21:30' }), NOW).valid).toBe(true);
  });

  it('rejects a malformed datetime', () => {
    expect(validateSessionInput(base({ datetime: '14/03/2026 20:00' }), NOW).errors.datetime).toBe(
      MESSAGES.datetimeInvalid,
    );
  });

  it('rejects a constellation list of only blanks', () => {
    expect(validateSessionInput(base({ constellations: ['  ', ''] }), NOW).errors.constellations).toBe(
      MESSAGES.constellationsRequired,
    );
  });
});

describe('createSessionEntry', () => {
  it('trims text and removes duplicate constellations case-insensitively', () => {
    const created = createSessionEntry(
      base({
        location: '  Bukit   Bintang  ',
        notes: '  Seeing stabil  ',
        constellations: ['Orion', ' orion ', 'Lyra'],
      }),
      'id-1',
    );
    expect(created).toEqual({
      id: 'id-1',
      datetime: '2026-03-14T20:00',
      location: 'Bukit Bintang',
      sky: 'Cerah tanpa awan',
      constellations: ['Orion', 'Lyra'],
      notes: 'Seeing stabil',
    });
  });
});

describe('sortByDateDesc', () => {
  it('orders by session time, newest first, not by input order', () => {
    const input = [
      entry('a', '2026-01-02T20:00'),
      entry('b', '2026-03-01T19:00'),
      entry('c', '2025-12-31T23:00'),
    ];
    expect(sortByDateDesc(input).map((s) => s.id)).toEqual(['b', 'a', 'c']);
  });

  it('keeps insertion order for identical timestamps and leaves the input untouched', () => {
    const input = [
      entry('first', '2026-02-10T21:00'),
      entry('second', '2026-02-10T21:00'),
      entry('third', '2026-02-10T21:00'),
    ];
    expect(sortByDateDesc(input).map((s) => s.id)).toEqual(['first', 'second', 'third']);
    expect(input.map((s) => s.id)).toEqual(['first', 'second', 'third']);
  });
});

describe('normalizeStoredSession', () => {
  it('keeps a valid stored record', () => {
    expect(normalizeStoredSession(entry('ok', '2026-02-01T20:00'))).toEqual(
      entry('ok', '2026-02-01T20:00'),
    );
  });

  it('drops records with a missing or unusable field instead of crashing', () => {
    expect(normalizeStoredSession(null)).toBeNull();
    expect(normalizeStoredSession('not an object')).toBeNull();
    expect(normalizeStoredSession({ ...entry('x', '2026-02-01T20:00'), id: '' })).toBeNull();
    expect(normalizeStoredSession({ ...entry('x', 'kemarin malam') })).toBeNull();
    expect(normalizeStoredSession({ ...entry('x', '2026-02-01T20:00'), location: '  ' })).toBeNull();
    expect(normalizeStoredSession({ ...entry('x', '2026-02-01T20:00'), constellations: [] })).toBeNull();
    expect(normalizeStoredSession({ ...entry('x', '2026-02-01T20:00'), sky: 42 })).toBeNull();
  });

  it('repairs a salvageable record: coerces notes and cleans the constellation list', () => {
    const stored = { ...entry('y', '2026-02-01T20:00'), notes: undefined, constellations: ['Lyra', 7, ' Lyra '] };
    expect(normalizeStoredSession(stored)).toEqual({
      id: 'y',
      datetime: '2026-02-01T20:00',
      location: 'Dieng',
      sky: 'Cerah tanpa awan',
      constellations: ['Lyra'],
      notes: '',
    });
  });
});
