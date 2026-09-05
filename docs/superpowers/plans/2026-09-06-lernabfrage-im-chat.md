# Lernabfrage im Chat + Materialpreise — Umsetzungsplan

> **Für agentische Arbeiter:** ERFORDERLICHE SUB-SKILL: `superpowers:subagent-driven-development`
> (empfohlen) oder `superpowers:executing-plans`. Schritte nutzen Checkbox-Syntax.

**Ziel:** Die Lernabfrage wandert aus dem Speichern-Dialog in den KI-Optimierungs-Chat,
und Einkaufspreise werden dauerhaft fixierbar.

**Architektur:** Die KI bekommt zwei Werkzeuge (`regel_merken`, `preis_merken`) und ruft
sie auf, wenn der Nutzer zustimmt — statt Freitext zu deuten. Der Server prüft jeden
Aufruf gegen die tatsächliche Kalkulation, bevor gespeichert wird. Der Speichern-Dialog
und die separate Kandidaten-Route entfallen.

**Grundlage:** `docs/superpowers/specs/2026-09-05-lernabfrage-im-chat-design.md`

**Tech-Stack:** Next.js App Router, TypeScript, Supabase (RLS), Anthropic Messages API,
Node-eigener Test-Runner (`npm run test`).

## Globale Randbedingungen

- **Reine Logik bleibt importfrei.** `src/lib/learn.ts` und die neue
  `src/lib/materialpreise.ts` dürfen NICHTS importieren — sonst laufen die Tests nicht
  mehr (Node führt die `.ts` direkt aus, es gibt keine Test-Pakete). Alles mit Supabase
  gehört in `src/lib/bauweise.ts` bzw. `src/lib/preisspeicher.ts`.
- **`npm run build` läuft lokal NICHT** (bricht vorbestehend bei `/api/stripe/checkout` ab).
  Verbindlicher Typecheck: `npx tsc --noEmit`.
- **`npm run lint` hat keine saubere Basis** (513 Bestandsfehler). Verbindlich:
  `npx eslint <geänderte Dateien>`.
- **Engine-Invariante:** Der Bauweise-Vault beeinflusst nie `vkStunde`, `aufschlag` oder
  Preise. Materialpreise sind ein GETRENNTER Speicher.
- **Deploy-Regel:** niemals direkt auf `main`. Alles auf `dev`, Fabian gibt frei.
- **Lernen darf Speichern und PDF-Export nie blockieren.**
- **Jedes SQL enthält die GRANTs.** Ursache des Fehlers vom 2026-09-05 war ein fehlendes
  `grant select, insert, update, delete ... to authenticated`. Nie wieder ohne.
- **UI-Texte sind deutsch.**

---

## Dateien im Überblick

| Datei | Verantwortung |
|---|---|
| `docs/sql/2026-09-06-materialpreise.sql` | NEU — Tabelle, RLS, GRANTs |
| `src/lib/materialpreise.ts` | NEU — reine Logik: Matching, Prompt-Block, Alterung. Importfrei |
| `src/lib/preisspeicher.ts` | NEU — Supabase-Zugriff, Muster: `src/lib/bauweise.ts` |
| `src/lib/lernwerkzeuge.ts` | NEU — Werkzeug-Schemata + Erfindungsschutz. Importfrei |
| `src/app/api/settings/materialpreise/route.ts` | NEU — CRUD, Muster: `settings/bauweise/route.ts` |
| `src/app/api/optimize/route.ts` | ÄNDERN — Werkzeuge, Tool-Schleife, Preisblock |
| `src/app/page.tsx` | ÄNDERN — Dialog raus |
| `src/app/settings/page.tsx` | ÄNDERN — Reiter „Materialpreise" |
| `src/app/api/learn/candidates/route.ts` | LÖSCHEN — zuletzt |
| `tests/materialpreise.test.mjs` | NEU |
| `tests/lernwerkzeuge.test.mjs` | NEU |

---

## Task 1: SQL für Materialpreise

**Dateien:** Create `docs/sql/2026-09-06-materialpreise.sql`

**Produziert:** Tabelle `materialpreise` mit Spalten `id, user_id, bezeichnung, ek,
einheit, lieferant, stand, aktiv, created_at, updated_at`.

- [ ] **Schritt 1: SQL schreiben**

```sql
-- Materialpreise: vom Nutzer fixierte Einkaufspreise.
-- Getrennt von bauweise_regeln — der Bauweise-Vault bleibt preisfrei.
create table if not exists materialpreise (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  bezeichnung text not null,
  ek          numeric(12,2) not null check (ek >= 0),
  einheit     text not null default 'Stk',
  lieferant   text not null default '',
  stand       date not null default current_date,
  aktiv       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists materialpreise_user_idx on materialpreise (user_id, aktiv);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'materialpreise_einheit_check') then
    alter table materialpreise add constraint materialpreise_einheit_check
      check (einheit in ('Stk', 'm2', 'lfdm', 'm3', 'kg', 'pauschal'));
  end if;
end $$;

-- NICHT WEGLASSEN. Supabase vergibt diese Rechte bei neuen Tabellen nicht
-- zuverlaessig automatisch; ohne sie existiert die Tabelle und jedes Speichern
-- scheitert trotzdem (Vorfall 2026-09-05, bauweise_regeln).
grant select, insert, update, delete on table materialpreise to authenticated;

alter table materialpreise enable row level security;

drop policy if exists "eigene Preise lesen"    on materialpreise;
drop policy if exists "eigene Preise anlegen"  on materialpreise;
drop policy if exists "eigene Preise aendern"  on materialpreise;
drop policy if exists "eigene Preise loeschen" on materialpreise;

create policy "eigene Preise lesen"    on materialpreise for select using (auth.uid() = user_id);
create policy "eigene Preise anlegen"  on materialpreise for insert with check (auth.uid() = user_id);
create policy "eigene Preise aendern"  on materialpreise for update using (auth.uid() = user_id);
create policy "eigene Preise loeschen" on materialpreise for delete using (auth.uid() = user_id);
```

- [ ] **Schritt 2: Commit**

```bash
git add docs/sql/2026-09-06-materialpreise.sql
git commit -m "feat(preise): SQL fuer Materialpreise, mit GRANTs von Anfang an"
```

> **Fabian führt das SQL aus.** Danach Gegenprobe im SQL-Editor — dieselbe Abfrage, die
> am 2026-09-05 den Fehler aufgedeckt hat:
> ```sql
> select grantee, string_agg(privilege_type, ', ' order by privilege_type)
> from information_schema.role_table_grants
> where table_name = 'materialpreise' and grantee = 'authenticated'
> group by grantee;
> ```
> Erwartet: `DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE`.

---

## Task 2: Reine Logik für Materialpreise

**Dateien:** Create `src/lib/materialpreise.ts`, Test `tests/materialpreise.test.mjs`

**Interfaces — Produziert:**
- `type FixierterPreis = { id?: string; bezeichnung: string; ek: number; einheit: string; stand: string }`
- `findePreis(bezeichnung: string, preise: FixierterPreis[]): FixierterPreis | null`
- `bauePreisBlock(preise: FixierterPreis[]): string`
- `istVeraltet(stand: string, heute: string): boolean`
- `MAX_PREISE_IM_PROMPT = 80`, `VERALTET_NACH_TAGEN = 365`

- [ ] **Schritt 1: Failing test schreiben**

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findePreis, bauePreisBlock, istVeraltet } from '../src/lib/materialpreise.ts'

const P = (bezeichnung, ek, stand = '2026-09-06') => ({ bezeichnung, ek, einheit: 'Stk', stand })

test('Findet den Preis bei exakter Bezeichnung', () => {
  const t = findePreis('Blum Movento Softclose-Auszug', [P('Blum Movento Softclose-Auszug', 26.27)])
  assert.equal(t?.ek, 26.27)
})

test('Findet den Preis auch als Teilstring, Gross/Klein egal', () => {
  const t = findePreis('3x BLUM MOVENTO Softclose-Auszug inkl. Montage', [P('Blum Movento', 26.27)])
  assert.equal(t?.ek, 26.27)
})

test('Die laengste passende Bezeichnung gewinnt', () => {
  const t = findePreis('Blum Movento Softclose-Auszug 500mm',
    [P('Blum', 5), P('Blum Movento Softclose-Auszug', 26.27), P('Blum Movento', 20)])
  assert.equal(t?.ek, 26.27)
})

test('Kein Treffer ergibt null — nie geraten', () => {
  assert.equal(findePreis('Egger Dekorspanplatte 19mm', [P('Blum Movento', 26.27)]), null)
})

test('Leere Preisliste ergibt leeren Block', () => {
  assert.equal(bauePreisBlock([]), '')
})

test('Preisblock nennt Bezeichnung, EK und Einheit', () => {
  const s = bauePreisBlock([P('Blum Movento', 26.27)])
  assert.match(s, /Blum Movento/)
  assert.match(s, /26[.,]27/)
  assert.match(s, /Stk/)
})

test('Preisblock traegt einen Verbindlich-Satz', () => {
  assert.match(bauePreisBlock([P('X', 1)]), /verbindlich/i)
})

test('Preis aelter als ein Jahr gilt als veraltet', () => {
  assert.equal(istVeraltet('2025-09-05', '2026-09-06'), true)
  assert.equal(istVeraltet('2026-09-05', '2026-09-06'), false)
})
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npm run test`
Erwartet: FAIL — Modul `src/lib/materialpreise.ts` existiert nicht.

- [ ] **Schritt 3: Implementieren**

```typescript
// Reine Logik fuer fixierte Einkaufspreise. Importiert bewusst NICHTS —
// sonst sind die Tests nicht mehr ausfuehrbar (siehe src/lib/learn.ts).

export type FixierterPreis = {
  id?: string
  bezeichnung: string
  ek: number
  einheit: string
  stand: string
}

export const MAX_PREISE_IM_PROMPT = 80
export const VERALTET_NACH_TAGEN = 365

function normalisiere(s: string): string {
  return (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
}

// Laengster Treffer gewinnt — dieselbe Logik wie matchMaterialgruppe in
// /api/analyze und /api/optimize. "Blum Movento Softclose-Auszug" ist
// spezifischer als "Blum" und muss gewinnen, sonst gilt der falsche Preis.
export function findePreis(bezeichnung: string, preise: FixierterPreis[]): FixierterPreis | null {
  const text = normalisiere(bezeichnung)
  if (text === '') return null
  let best: FixierterPreis | null = null
  for (const p of preise) {
    const kandidat = normalisiere(p.bezeichnung)
    if (kandidat === '') continue
    if (text.includes(kandidat) && (!best || kandidat.length > normalisiere(best.bezeichnung).length)) {
      best = p
    }
  }
  return best
}

export function istVeraltet(stand: string, heute: string): boolean {
  const a = Date.parse(stand)
  const b = Date.parse(heute)
  if (Number.isNaN(a) || Number.isNaN(b)) return false
  return (b - a) / 86400000 > VERALTET_NACH_TAGEN
}

// Eigener Block, getrennt vom Bauweise-Block. Die Trennung ist funktional:
// Bauweise-Regeln duerfen nie Preise setzen, Preise nie Bauweise.
export function bauePreisBlock(preise: FixierterPreis[]): string {
  if (preise.length === 0) return ''
  const zeilen = preise.slice(0, MAX_PREISE_IM_PROMPT).map(p =>
    `${p.bezeichnung} → ${p.ek.toFixed(2)} € / ${p.einheit}`)
  return '\n\n## FIXIERTE EINKAUFSPREISE DIESES BETRIEBS\n'
    + zeilen.join('\n')
    + '\nDiese EK-Preise sind verbindlich. Trifft eine Materialbezeichnung zu, setze genau'
    + ' diesen ek-Wert ein, statt zu schaetzen. Der Aufschlag bleibt davon unberuehrt.'
}
```

- [ ] **Schritt 4: Tests laufen lassen**

Run: `npm run test`
Erwartet: PASS, alle 8 neuen Tests. Die bestehenden `learn-*.test.mjs` bleiben grün.

- [ ] **Schritt 5: Typecheck und Lint**

Run: `npx tsc --noEmit && npx eslint src/lib/materialpreise.ts`
Erwartet: beides ohne Fehler.

- [ ] **Schritt 6: Commit**

```bash
git add src/lib/materialpreise.ts tests/materialpreise.test.mjs
git commit -m "feat(preise): reine Logik fuer fixierte Einkaufspreise"
```

---

## Task 3: Erfindungsschutz und Werkzeug-Schemata

**Dateien:** Create `src/lib/lernwerkzeuge.ts`, Test `tests/lernwerkzeuge.test.mjs`

**Interfaces — Produziert:**
- `WERKZEUGE` — Array der Tool-Definitionen für die Anthropic-API, beide mit `strict: true`
- `pruefeRegelInhalt(dann: string, belegquellen: string[]): boolean`
- `pruefePreisInhalt(bezeichnung: string, ek: number, belegquellen: string[]): boolean`

**Konsumiert:** nichts (importfrei).

> **Kern der Spec.** Weil der wörtliche Beleg entfällt („lockerer fragen"), ist das hier
> die einzige verbliebene Sicherung gegen erfundene Inhalte. Abgeleitet werden darf die
> Absicht, niemals der Inhalt.

- [ ] **Schritt 1: Failing test schreiben**

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pruefeRegelInhalt, pruefePreisInhalt, WERKZEUGE } from '../src/lib/lernwerkzeuge.ts'

const QUELLEN = [
  'Rueckwand Spanplatte 8 mm',
  'Blum Movento Softclose-Auszug inkl. Montage',
  'Der Blum Movento kostet mich 26,27 EUR, aendere den Preis',
]

test('Regel mit belegtem Inhalt wird angenommen', () => {
  assert.equal(pruefeRegelInhalt('Rueckwaende aus Spanplatte 8 mm', QUELLEN), true)
})

test('Regel mit erfundener Holzart wird abgelehnt', () => {
  assert.equal(pruefeRegelInhalt('Rueckwaende aus Nussbaum massiv', QUELLEN), false)
})

test('Regel mit erfundener Zahl wird abgelehnt', () => {
  assert.equal(pruefeRegelInhalt('Rueckwaende aus Spanplatte 19 mm', QUELLEN), false)
})

test('Preis aus dem Chat wird angenommen', () => {
  assert.equal(pruefePreisInhalt('Blum Movento', 26.27, QUELLEN), true)
})

test('Erfundener Preis wird abgelehnt', () => {
  assert.equal(pruefePreisInhalt('Blum Movento', 99.0, QUELLEN), false)
})

test('Preis fuer nie erwaehntes Material wird abgelehnt', () => {
  assert.equal(pruefePreisInhalt('Hettich Quadro', 26.27, QUELLEN), false)
})

test('Beide Werkzeuge sind strict definiert', () => {
  assert.equal(WERKZEUGE.length, 2)
  for (const w of WERKZEUGE) {
    assert.equal(w.strict, true)
    assert.equal(w.input_schema.additionalProperties, false)
    assert.ok(Array.isArray(w.input_schema.required))
  }
})
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npm run test`
Erwartet: FAIL — Modul existiert nicht.

- [ ] **Schritt 3: Implementieren**

```typescript
// Werkzeug-Definitionen und Erfindungsschutz. Importiert bewusst NICHTS.
//
// Belegquellen sind: die Materialbezeichnungen der aktuellen Kalkulation und die
// Nachrichten des Nutzers. Jeder Inhalt, den die KI merken will, muss dort
// vorkommen. Abgeleitet werden darf die ABSICHT ("das ist dein Standard"),
// niemals der INHALT. Diese Grenze ist im Projekt `stimme` gerissen, als das
// Modell eine Holzart und eine persoenliche Anekdote dazuerfunden hat.

function normalisiere(s: string): string {
  return (s ?? '').toLowerCase().replace(/[^a-z0-9äöüß., ]+/gi, ' ').replace(/\s+/g, ' ').trim()
}

// Inhaltswoerter: alles ab 3 Zeichen, plus alle Zahlen (auch kurze wie "8").
// Zahlen sind besonders heikel — eine erfundene Materialstaerke sieht harmlos
// aus und aendert die Kalkulation.
function inhaltsWoerter(text: string): string[] {
  return normalisiere(text).split(' ').filter(w => w.length >= 3 || /^[0-9]/.test(w))
}

const FUELLWOERTER = new Set([
  'der', 'die', 'das', 'und', 'oder', 'aus', 'mit', 'fuer', 'für', 'von', 'immer',
  'nie', 'wird', 'werden', 'sind', 'ist', 'bei', 'als', 'nicht', 'standardmaessig',
  'standardmäßig', 'meine', 'mein', 'inkl', 'ca',
])

export function pruefeRegelInhalt(dann: string, belegquellen: string[]): boolean {
  const quelle = belegquellen.map(normalisiere).join(' ')
  if (quelle === '') return false
  const woerter = inhaltsWoerter(dann).filter(w => !FUELLWOERTER.has(w))
  if (woerter.length === 0) return false
  // JEDES Inhaltswort muss belegt sein. Eine Mehrheitsregel wuerde genau den
  // Fall durchlassen, um den es geht: viel Belegtes plus ein erfundenes Detail.
  return woerter.every(w => quelle.includes(w))
}

export function pruefePreisInhalt(bezeichnung: string, ek: number, belegquellen: string[]): boolean {
  const quelle = belegquellen.map(normalisiere).join(' ')
  if (quelle === '') return false
  const bez = inhaltsWoerter(bezeichnung).filter(w => !FUELLWOERTER.has(w))
  if (bez.length === 0) return false
  if (!bez.every(w => quelle.includes(w))) return false
  // Der Betrag muss woertlich vorkommen — mit Punkt ODER Komma, weil Fabian
  // "26,27" schreibt und das Angebot-JSON "26.27" enthaelt.
  const mitPunkt = ek.toFixed(2)
  const mitKomma = mitPunkt.replace('.', ',')
  const ohneNachkomma = String(Math.round(ek))
  return quelle.includes(mitPunkt) || quelle.includes(mitKomma)
    || (Number.isInteger(ek) && quelle.includes(ohneNachkomma))
}

export const WERKZEUGE = [
  {
    name: 'regel_merken',
    description:
      'Merkt eine Bauweise-Regel dauerhaft. NUR aufrufen, wenn der Nutzer gerade '
      + 'ausdruecklich zugestimmt hat. Nie fuer Preise, Stundensaetze oder Aufschlaege.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        bereich: { type: 'string', enum: ['Material', 'Konstruktion', 'Zeit', 'Oberfläche', 'Montage', 'Sonstiges'] },
        wenn:    { type: 'string', description: 'Bedingung, leer wenn die Regel immer gilt' },
        dann:    { type: 'string', description: 'Was gilt. Nur Inhalte, die wirklich vorkamen' },
        quelle:  { type: 'string', enum: ['woertlich', 'wiederholung'] },
      },
      required: ['bereich', 'wenn', 'dann', 'quelle'],
      additionalProperties: false,
    },
  },
  {
    name: 'preis_merken',
    description:
      'Fixiert einen Einkaufspreis dauerhaft. NUR aufrufen, wenn der Nutzer den Preis '
      + 'genannt und dem Merken zugestimmt hat. Preise nie selbst ausdenken.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        bezeichnung: { type: 'string', description: 'Materialbezeichnung, wonach spaeter gematcht wird' },
        ek:          { type: 'number', description: 'Einkaufspreis netto' },
        einheit:     { type: 'string', enum: ['Stk', 'm2', 'lfdm', 'm3', 'kg', 'pauschal'] },
      },
      required: ['bezeichnung', 'ek', 'einheit'],
      additionalProperties: false,
    },
  },
] as const
```

- [ ] **Schritt 4: Tests laufen lassen**

Run: `npm run test`
Erwartet: PASS.

- [ ] **Schritt 5: Typecheck und Lint**

Run: `npx tsc --noEmit && npx eslint src/lib/lernwerkzeuge.ts`

- [ ] **Schritt 6: Commit**

```bash
git add src/lib/lernwerkzeuge.ts tests/lernwerkzeuge.test.mjs
git commit -m "feat(learn): Werkzeug-Schemata und Erfindungsschutz"
```

---

## Task 4: Supabase-Zugriff für Materialpreise

**Dateien:** Create `src/lib/preisspeicher.ts`

**Konsumiert:** `FixierterPreis`, `bauePreisBlock`, `MAX_PREISE_IM_PROMPT` aus Task 2.

**Interfaces — Produziert:**
- `ladeAktivePreise(supabase, userId): Promise<FixierterPreis[]>`
- `preisBlockFuerNutzer(supabase, userId): Promise<string>`
- `speicherePreis(supabase, userId, { bezeichnung, ek, einheit }): Promise<{ ok: true } | { ok: false; grund: string }>`

- [ ] **Schritt 1: Implementieren**

Muster exakt wie `src/lib/bauweise.ts` (dort abschauen: Fehlerbehandlung, Rückgabe
leerer Listen statt Werfen).

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import { bauePreisBlock, MAX_PREISE_IM_PROMPT, type FixierterPreis } from './materialpreise'

export async function ladeAktivePreise(supabase: SupabaseClient, userId: string): Promise<FixierterPreis[]> {
  const { data, error } = await supabase
    .from('materialpreise')
    .select('id, bezeichnung, ek, einheit, stand')
    .eq('user_id', userId)
    .eq('aktiv', true)
    .order('updated_at', { ascending: false })
    .limit(MAX_PREISE_IM_PROMPT)
  if (error) { console.error('[preise] ladeAktivePreise:', error.message); return [] }
  return (data ?? []).map(r => ({ ...r, ek: Number(r.ek) })) as FixierterPreis[]
}

export async function preisBlockFuerNutzer(supabase: SupabaseClient, userId: string): Promise<string> {
  return bauePreisBlock(await ladeAktivePreise(supabase, userId))
}

// Gleiche Bezeichnung => aktualisieren statt doppelt anlegen. Zwei Preise fuer
// dasselbe Material waeren nicht aufloesbar: findePreis nimmt den laengsten
// Treffer, bei gleicher Laenge waere das Ergebnis zufaellig.
export async function speicherePreis(
  supabase: SupabaseClient,
  userId: string,
  p: { bezeichnung: string; ek: number; einheit: string },
): Promise<{ ok: true } | { ok: false; grund: string }> {
  const heute = new Date().toISOString().slice(0, 10)
  const { data: vorhanden } = await supabase
    .from('materialpreise')
    .select('id')
    .eq('user_id', userId)
    .ilike('bezeichnung', p.bezeichnung)
    .maybeSingle()

  const { error } = vorhanden
    ? await supabase.from('materialpreise')
        .update({ ek: p.ek, einheit: p.einheit, stand: heute, aktiv: true, updated_at: new Date().toISOString() })
        .eq('id', vorhanden.id).eq('user_id', userId)
    : await supabase.from('materialpreise')
        .insert({ user_id: userId, bezeichnung: p.bezeichnung, ek: p.ek, einheit: p.einheit, stand: heute })

  // Der echte Grund MUSS zurueck — die Meldung "konnte nicht gespeichert werden"
  // ohne Ursache hat am 2026-09-05 rund 20 Minuten Suche gekostet.
  if (error) return { ok: false, grund: error.message }
  return { ok: true }
}
```

- [ ] **Schritt 2: Typecheck und Lint**

Run: `npx tsc --noEmit && npx eslint src/lib/preisspeicher.ts`

- [ ] **Schritt 3: Commit**

```bash
git add src/lib/preisspeicher.ts
git commit -m "feat(preise): Supabase-Zugriff fuer Materialpreise"
```

---

## Task 5: CRUD-Route für Materialpreise

**Dateien:** Create `src/app/api/settings/materialpreise/route.ts`

**Muster:** `src/app/api/settings/bauweise/route.ts` — gleiche Struktur für
Auth-Prüfung (`supabase.auth.getUser()`, 401 bei fehlendem User), Validierung und
Fehlerrückgabe.

- [ ] **Schritt 1: Implementieren**

Methoden: `GET` (alle Preise des Nutzers, mit `stand`), `POST` (neu, Pflichtfelder
`bezeichnung` + `ek`), `PUT` (`id` + änderbare Felder, setzt `stand` auf heute),
`DELETE` (`id`, nur eigene). `ek` muss `>= 0` und eine Zahl sein, sonst 400 mit
verständlichem Grund. `einheit` gegen dieselbe Liste prüfen wie im SQL-Check.

- [ ] **Schritt 2: Typecheck und Lint**

Run: `npx tsc --noEmit && npx eslint src/app/api/settings/materialpreise/route.ts`

- [ ] **Schritt 3: Commit**

```bash
git add src/app/api/settings/materialpreise/route.ts
git commit -m "feat(preise): CRUD-Route fuer Materialpreise"
```

---

## Task 6: Werkzeuge in die Optimierungs-Route

**Dateien:** Modify `src/app/api/optimize/route.ts`

**Konsumiert:** `WERKZEUGE`, `pruefeRegelInhalt`, `pruefePreisInhalt` (Task 3),
`preisBlockFuerNutzer`, `speicherePreis` (Tasks 2/4).

Das ist der Kern. Vier Änderungen an derselben Datei:

- [ ] **Schritt 1: Preisblock an den System-Prompt hängen**

Direkt NACH `system += regelBlock` (aktuell Zeile ~211). Reihenfolge ist funktional:
Beide Blöcke müssen nach dem allgemeinen Fachwissen stehen.

```typescript
system += regelBlock
system += await preisBlockFuerNutzer(supabase, user.id)
```

- [ ] **Schritt 2: Frageregel und Zusage-Verbot in SYSTEM_BASE**

Anhängen an `SYSTEM_BASE`:

```
LERNEN — WANN DU FRAGST:
- Sagt der Nutzer ausdruecklich "immer", "standardmaessig", "grundsaetzlich" oder
  aehnlich, frage, ob du es dauerhaft merken sollst.
- Aendert er dasselbe Merkmal zum ZWEITEN Mal in diesem Angebot, frage ebenfalls.
- Hoechstens EINE Frage pro Antwort. Nie eine Frage, die er gerade verneint hat.
- Stimmt er zu, rufe regel_merken bzw. preis_merken auf. Ohne Zustimmung nie.
- Aendert der Nutzer einen Einkaufspreis, zu dem bereits ein fixierter Preis
  existiert, frage, ob der hinterlegte Preis dauerhaft nachgezogen werden soll.
  Fuer dieses Angebot gilt sein Wert in jedem Fall — ein fixierter Preis ist
  nie ein Zwang.

WAS DU NIE ZUSAGEN DARFST:
Du kannst dir NUR Bauweise-Regeln und Einkaufspreise merken. Stundensaetze,
Aufschlaege und Verkaufspreise kannst du NICHT dauerhaft merken. Sage dort niemals
"merke ich mir", sondern: "Fuer dieses Angebot uebernommen — dauerhaft merken kann
ich mir das nicht, das stellst du unter Einstellungen ein."
```

- [ ] **Schritt 3: Werkzeuge mitschicken und die Tool-Schleife bauen**

`tools: WERKZEUGE` in den Request-Body. Der Aufruf wird zur Schleife: Solange
`stop_reason === 'tool_use'`, jeden `tool_use`-Block ausführen und ALLE `tool_result`
in EINER Nutzer-Nachricht zurückgeben. Maximal 3 Durchläufe, dann abbrechen — eine
unbegrenzte Schleife wäre ein offenes Kostenrisiko.

Vor jedem Speichern die Prüfung aus Task 3, mit den Belegquellen:

```typescript
const belegquellen = [
  ...chatHistory.filter(m => m.role === 'user').map(m => m.content),
  message,
  ...alleMaterialbezeichnungen(offerData),
]
```

Bei abgelehntem Aufruf `tool_result` mit `is_error: true` und einem Grund im Klartext
zurückgeben — die KI darf es dann nicht stillschweigend erneut versuchen.

- [ ] **Schritt 4: Ergebnis in die Chat-Antwort**

Erfolg und Misserfolg müssen im `message`-Feld ankommen. Bei Fehlern **den echten
Grund** — nie nur "konnte nicht gespeichert werden".

- [ ] **Schritt 5: Typecheck und Lint**

Run: `npx tsc --noEmit && npx eslint src/app/api/optimize/route.ts`

- [ ] **Schritt 6: Commit**

```bash
git add src/app/api/optimize/route.ts
git commit -m "feat(learn): Lernabfrage und Preisfixierung im Optimierungs-Chat"
```

---

## Task 7: Einstellungen — Reiter „Materialpreise"

**Dateien:** Modify `src/app/settings/page.tsx`

**Muster:** der bestehende Reiter „Meine Bauweise" (`BauweiseSettings.tsx`).

- [ ] **Schritt 1: Reiter ergänzen**

Neuer Eintrag in der linken Leiste, direkt unter „Meine Bauweise". Tabelle mit
Bezeichnung, EK, Einheit, Stand. Zeilen mit `istVeraltet(stand, heute) === true`
sichtbar markieren (Hinweistext „Preis ist über ein Jahr alt"). Anlegen, Ändern und
Löschen von Hand möglich. **Kein PlanGate** — gleiche Entscheidung wie beim
Bauweise-Vault (2026-08-01).

- [ ] **Schritt 2: Typecheck und Lint**

Run: `npx tsc --noEmit && npx eslint src/app/settings/page.tsx`

- [ ] **Schritt 3: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "feat(preise): Einstellungen-Reiter fuer Materialpreise"
```

---

## Task 8: Speichern-Dialog entfernen

> **Erst jetzt.** Der alte Weg bleibt bis hierher funktionsfähig, damit die App zu keinem
> Zeitpunkt ohne Lernfunktion dasteht.

**Dateien:** Modify `src/app/page.tsx`, Delete `src/app/api/learn/candidates/route.ts`

- [ ] **Schritt 1: Frontend-Zustand entfernen**

Ersatzlos streichen: `pruefeLernkandidaten` (ab Zeile ~542), `lernDialogSchliessen`,
`lernRegelnSpeichern` (~607), `lernOffeneAnzahl`, die States `lernKandidaten`,
`lernAuswahl`, `lernWenn`, `lernErledigt`, `lernFehler`, `lernSpeichert`, `kiVorschlagRef`
sowie das Dialog-Markup (~4224). Beide Aufrufstellen: nach dem Speichern (~387) und bei
der Rückkehr aus der PDF-Vorschau (~2679).

- [ ] **Schritt 2: Route löschen**

```bash
git rm src/app/api/learn/candidates/route.ts
```

- [ ] **Schritt 3: Prüfen, dass nichts verwaist ist**

Run: `grep -rn "learn/candidates\|lernKandidaten\|kiVorschlagRef\|pruefeLernkandidaten" src/`
Erwartet: keine Treffer.

- [ ] **Schritt 4: Typecheck, Lint, Tests**

Run: `npx tsc --noEmit && npx eslint src/app/page.tsx && npm run test`
Erwartet: alles grün. `tests/learn-diff.test.mjs` und `tests/learn-beleg.test.mjs` prüfen
Funktionen, die es weiter gibt — bleiben sie rot, wurde zu viel entfernt.

- [ ] **Schritt 5: Commit**

```bash
git add -A && git commit -m "refactor(learn): Speichern-Dialog und Kandidaten-Route entfernt"
```

---

## Task 9: Bleistift-Hervorhebung folgt dem aktiven Bereich

> Kleiner, unabhängiger Fund vom 2026-09-05. Läuft hier mit, weil es dieselbe Datei ist.

**Dateien:** Modify `src/app/page.tsx:2524-2526` und `:3073-3075`

- [ ] **Schritt 1: Hervorhebung an den Zustand koppeln**

Aktuell hat der Bleistift fest `background: brandAccent`, die anderen sind immer
transparent. Stattdessen: hervorgehoben ist das Symbol, dessen Bereich gerade offen ist
(`screen === 'app'` → Bleistift, `screen === 'projekte'` → Klemmbrett). Beide Fundstellen
gleich behandeln.

- [ ] **Schritt 2: Lint**

Run: `npx eslint src/app/page.tsx`

- [ ] **Schritt 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "fix(ui): Kopfleiste hebt den aktiven Bereich hervor"
```

---

## Task 10: Abschlussprüfung auf der dev-Preview

**Voraussetzung:** Task 1 ist in Supabase ausgeführt, alles ist auf `dev` gepusht.

- [ ] **Schritt 1: Alle zwölf Prüfkriterien der Spec durchgehen**

Adresse: `https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app`
Kriterien: `docs/superpowers/specs/2026-09-05-lernabfrage-im-chat-design.md`, Abschnitt
„Pruefkriterien". Jedes Ergebnis im Arbeitsprotokoll festhalten.

- [ ] **Schritt 2: Trennungstest mit zwei Konten**

Regeln UND Materialpreise: Das zweite Konto darf beides nicht sehen. Der wichtigste Test —
Bauweise und Einkaufspreise sind Betriebsgeheimnis.

- [ ] **Schritt 3: Fabian gibt frei, dann erst `dev → main`**
