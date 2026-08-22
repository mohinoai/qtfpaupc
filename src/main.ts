/** DOM layer. Static shell in index.html; JS renders the session list and toggles state. */
import {
  createSessionEntry,
  sortByDateDesc,
  validateSessionInput,
  type FieldName,
  type SessionEntry,
} from './domain';
import { loadSessions, saveSessions } from './storage';

const CONFIRM_WINDOW_MS = 4000;

const pick = <T extends Element>(selector: string): T => {
  const node = document.querySelector<T>(selector);
  if (!node) throw new Error(`Elemen tidak ditemukan: ${selector}`);
  return node;
};

const form = pick<HTMLFormElement>('#session-form');
const datetimeInput = pick<HTMLInputElement>('#f-datetime');
const locationInput = pick<HTMLInputElement>('#f-location');
const skySelect = pick<HTMLSelectElement>('#f-sky');
const notesInput = pick<HTMLTextAreaElement>('#f-notes');
const constellationSet = pick<HTMLFieldSetElement>('#f-constellations');
const constellationGroup = pick<HTMLDivElement>('#constellation-group');
const customInput = pick<HTMLInputElement>('#f-custom');
const addCustomButton = pick<HTMLButtonElement>('#add-custom');
const formToast = pick<HTMLParagraphElement>('#form-toast');
const list = pick<HTMLOListElement>('#session-list');
const emptyState = pick<HTMLDivElement>('#empty-state');
const emptyCta = pick<HTMLButtonElement>('#empty-cta');
const filterRow = pick<HTMLDivElement>('#filter-row');
const filterSky = pick<HTMLSelectElement>('#filter-sky');
const filterEmpty = pick<HTMLParagraphElement>('#filter-empty');
const loadError = pick<HTMLParagraphElement>('#load-error');
const countLabel = pick<HTMLParagraphElement>('#session-count');
const liveRegion = pick<HTMLParagraphElement>('#live-region');

const fields: Record<FieldName, { control: HTMLElement; error: HTMLElement }> = {
  datetime: { control: datetimeInput, error: pick('#e-datetime') },
  location: { control: locationInput, error: pick('#e-location') },
  sky: { control: skySelect, error: pick('#e-sky') },
  constellations: { control: constellationSet, error: pick('#e-constellations') },
};

const fieldNames = Object.keys(fields) as FieldName[];
const describedByBase = new Map<FieldName, string>(
  fieldNames.map((name) => [name, fields[name].control.getAttribute('aria-describedby') ?? '']),
);

let sessions: SessionEntry[] = [];
let armedId: string | null = null;
let armedTimer: number | undefined;

const dateFormat = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function announce(message: string): void {
  liveRegion.textContent = '';
  window.setTimeout(() => {
    liveRegion.textContent = message;
  }, 40);
}

function makeId(): string {
  if (typeof window.crypto?.randomUUID === 'function') return window.crypto.randomUUID();
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function localNowValue(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function refreshMaxDate(): void {
  datetimeInput.max = localNowValue();
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.appendChild(document.createTextNode(text));
  return node;
}

function setFieldError(name: FieldName, message?: string): void {
  const { control, error } = fields[name];
  const base = describedByBase.get(name) ?? '';
  if (message) {
    error.textContent = message;
    error.hidden = false;
    control.setAttribute('aria-invalid', 'true');
    control.setAttribute('aria-describedby', `${base} ${error.id}`.trim());
  } else {
    error.textContent = '';
    error.hidden = true;
    control.removeAttribute('aria-invalid');
    if (base) control.setAttribute('aria-describedby', base);
    else control.removeAttribute('aria-describedby');
  }
}

function clearFieldErrors(): void {
  fieldNames.forEach((name) => setFieldError(name));
}

function showFormToast(message: string): void {
  formToast.textContent = message;
  formToast.hidden = message === '';
}

function checkedConstellations(): string[] {
  return Array.from(
    constellationGroup.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked'),
    (box) => box.value,
  );
}

function addCustomConstellation(): void {
  const name = customInput.value.trim().replace(/\s+/g, ' ');
  if (!name) {
    customInput.focus();
    return;
  }

  const key = name.toLocaleLowerCase();
  const boxes = Array.from(
    constellationGroup.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
  );
  const existing = boxes.find((box) => box.value.trim().toLocaleLowerCase() === key);

  if (existing) {
    existing.checked = true;
    existing.focus();
  } else {
    const label = el('label', 'check');
    const box = el('input');
    box.type = 'checkbox';
    box.name = 'constellation';
    box.value = name;
    box.checked = true;
    label.appendChild(box);
    label.appendChild(document.createTextNode(name));
    constellationGroup.appendChild(label);
    box.focus();
  }

  customInput.value = '';
  setFieldError('constellations');
}

function buildCard(entry: SessionEntry): HTMLLIElement {
  const item = el('li');
  const card = el('article', 'card');
  card.dataset.id = entry.id;

  const head = el('div', 'card-head');
  const meta = el('div');

  const time = el('time', 'card-time', dateFormat.format(new Date(entry.datetime)));
  time.dateTime = entry.datetime;
  meta.appendChild(time);
  meta.appendChild(el('p', 'card-loc', entry.location));

  const remove = el('button', 'del', 'Hapus');
  remove.type = 'button';
  remove.dataset.action = 'delete';
  remove.dataset.id = entry.id;
  remove.setAttribute('aria-label', `Hapus sesi di ${entry.location}`);

  head.appendChild(meta);
  head.appendChild(remove);
  card.appendChild(head);
  card.appendChild(el('p', 'badge', entry.sky));

  const chips = el('ul', 'chips');
  for (const name of entry.constellations) chips.appendChild(el('li', undefined, name));
  card.appendChild(chips);

  if (entry.notes) card.appendChild(el('p', 'card-notes', entry.notes));

  item.appendChild(card);
  return item;
}

function populateFilter(): void {
  for (const option of Array.from(skySelect.options)) {
    if (!option.value) continue;
    filterSky.add(new Option(option.value, option.value));
  }
}

function render(): void {
  const total = sessions.length;
  const active = filterSky.value;
  const visible = active ? sessions.filter((session) => session.sky === active) : sessions;
  const ordered = sortByDateDesc(visible);
  list.replaceChildren(...ordered.map(buildCard));

  const noneAtAll = total === 0;
  const noneMatch = !noneAtAll && ordered.length === 0;
  emptyState.hidden = !noneAtAll;
  filterRow.hidden = noneAtAll;
  list.hidden = ordered.length === 0;
  filterEmpty.hidden = !noneMatch;
  if (noneMatch) filterEmpty.textContent = `Tidak ada sesi dengan kondisi langit "${active}".`;

  countLabel.textContent = noneAtAll
    ? ''
    : active
      ? `${ordered.length} dari ${total} sesi`
      : `${total} sesi tercatat`;
}

function disarmDelete(): void {
  if (armedTimer) window.clearTimeout(armedTimer);
  armedTimer = undefined;
  armedId = null;
  list.querySelectorAll<HTMLButtonElement>('button[data-armed="true"]').forEach((button) => {
    button.removeAttribute('data-armed');
    button.textContent = 'Hapus';
  });
}

function flagCard(id: string, message: string): void {
  const card = list.querySelector<HTMLElement>(`.card[data-id="${CSS.escape(id)}"]`);
  if (!card) return;
  card.classList.add('is-flagged');
  const note = el('p', 'toast', message);
  card.appendChild(note);
  window.setTimeout(() => {
    card.classList.remove('is-flagged');
    note.remove();
  }, 6000);
}

function handleSubmit(event: SubmitEvent): void {
  event.preventDefault();
  showFormToast('');
  refreshMaxDate();

  const input = {
    datetime: datetimeInput.value,
    location: locationInput.value,
    sky: skySelect.value,
    constellations: checkedConstellations(),
    notes: notesInput.value,
  };

  const result = validateSessionInput(input, Date.now());
  clearFieldErrors();

  if (!result.valid) {
    for (const name of fieldNames) setFieldError(name, result.errors[name]);
    const firstBad = fieldNames.find((name) => result.errors[name]);
    if (firstBad) {
      const target =
        firstBad === 'constellations'
          ? constellationGroup.querySelector<HTMLInputElement>('input[type="checkbox"]')
          : (fields[firstBad].control as HTMLElement);
      target?.focus();
    }
    announce('Sesi belum tersimpan, ada isian yang perlu diperbaiki.');
    return;
  }

  const entry = createSessionEntry(input, makeId());
  const next = [entry, ...sessions];
  const saved = saveSessions(next);

  if (!saved.ok) {
    showFormToast(saved.reason);
    announce(saved.reason);
    return;
  }

  sessions = next;
  disarmDelete();
  render();
  form.reset();
  constellationGroup
    .querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
    .forEach((box) => (box.checked = false));
  refreshMaxDate();
  announce(`Sesi di ${entry.location} berhasil ditambahkan.`);
  datetimeInput.focus();
}

function handleDeleteClick(event: MouseEvent): void {
  const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>(
    'button[data-action="delete"]',
  );
  if (!button) return;

  const id = button.dataset.id ?? '';
  if (armedId !== id) {
    disarmDelete();
    armedId = id;
    button.dataset.armed = 'true';
    button.textContent = 'Yakin hapus?';
    armedTimer = window.setTimeout(disarmDelete, CONFIRM_WINDOW_MS);
    return;
  }

  const target = sessions.find((session) => session.id === id);
  const next = sessions.filter((session) => session.id !== id);
  const saved = saveSessions(next);

  if (!saved.ok) {
    disarmDelete();
    flagCard(id, saved.reason);
    announce(saved.reason);
    return;
  }

  sessions = next;
  disarmDelete();
  render();
  announce(target ? `Sesi di ${target.location} dihapus.` : 'Sesi dihapus.');
}

function init(): void {
  refreshMaxDate();

  const loaded = loadSessions();
  if (loaded.ok) {
    sessions = loaded.sessions;
    if (loaded.skipped > 0) {
      loadError.textContent = `${loaded.skipped} entri tersimpan tidak terbaca dan dilewati saat memuat.`;
      loadError.hidden = false;
    }
  } else {
    sessions = [];
    loadError.textContent = `${loaded.reason} Riwayat lama tidak bisa ditampilkan, sesi baru tetap bisa dicatat.`;
    loadError.hidden = false;
  }

  populateFilter();
  render();

  filterSky.addEventListener('change', render);
  form.addEventListener('submit', handleSubmit);
  addCustomButton.addEventListener('click', addCustomConstellation);
  customInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addCustomConstellation();
    }
  });
  datetimeInput.addEventListener('focus', refreshMaxDate);
  list.addEventListener('click', handleDeleteClick);
  emptyCta.addEventListener('click', () => datetimeInput.focus());

  constellationGroup.addEventListener('change', () => {
    if (checkedConstellations().length > 0) setFieldError('constellations');
  });
  for (const name of fieldNames) {
    if (name === 'constellations') continue;
    fields[name].control.addEventListener('input', () => setFieldError(name));
  }
}

init();
