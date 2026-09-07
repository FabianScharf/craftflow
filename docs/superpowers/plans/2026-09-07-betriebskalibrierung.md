# Betriebskalibrierung — Umsetzungsplan

> **Für agentische Bearbeiter:** ERFORDERLICHE SUB-SKILL: `superpowers:subagent-driven-development` (empfohlen) oder `superpowers:executing-plans`, um diesen Plan Aufgabe für Aufgabe umzusetzen. Die Schritte nutzen Checkbox-Syntax (`- [ ]`).

**Ziel:** Ein Betrieb beantwortet beim ersten Start fünf Fragen zu sich und vier Preisfragen zu einem festen Referenzmöbel; daraus entstehen vier Zeitfaktoren, mit denen CraftFlow ab dann für diesen Betrieb rechnet.

**Architektur:** Die Antworten landen in einer eigenen Tabelle `betriebskalibrierung` (pro Nutzer). Eine reine Rechenbibliothek `src/lib/kalibrierung.ts` hält die **fest hinterlegte Referenzkalkulation** und leitet daraus die Faktoren ab — ohne KI-Aufruf, deterministisch und in Millisekunden. Die Faktoren greifen deterministisch nach der KI-Antwort, an derselben Stelle, an der schon `vkStunde` und `aufschlag` überschrieben werden.

**Tech-Stack:** Next.js App Router, TypeScript, Supabase (Postgres + RLS), Tests mit `node --test` über `tests/*.test.mjs` (Node führt TypeScript direkt aus, kein Bundler).

**Spec:** `docs/superpowers/specs/2026-09-06-betriebskalibrierung-design.md`

## Globale Vorgaben

- **Alle Oberflächentexte auf Deutsch.** Code und Bezeichner auf Englisch oder Deutsch wie im Umfeld, aber niemals gemischte Nutzertexte.
- **Kein Tailwind, keine CSS-Module.** Alle Styles sind Inline-Objekte mit den Konstanten aus `@/lib/types` (Farbpalette `C`). Das Projekt vermeidet das bewusst.
- **`src/lib/kalibrierung.ts` importiert NICHTS.** Wie `learn.ts`, `lernwerkzeuge.ts`, `chatantwort.ts`, `laufmeter.ts`, `zeitpruefung.ts` — sonst sind die Tests ohne Bundler nicht ausführbar. Alles, was Supabase braucht, gehört in eine eigene Datei.
- **Jedes neue SQL braucht Rechte.** `grant select, insert, update, delete on <tabelle> to authenticated;` — Supabase vergibt die bei neuen Tabellen nicht zuverlässig automatisch. Das hat am 2026-09-05 einen halben Tag gekostet.
- **Faktoren sind auf 0,6 bis 1,4 gedeckelt.** Ohne Ausnahme, in jeder Richtung.
- **Der Vault-Grundsatz gilt weiter:** Die Kalibrierung verändert **Zeiten**, niemals `vkStunde`, `aufschlag` oder Materialpreise.
- **Lokal prüfen:** `npx tsc --noEmit` (nicht `npm run build`, der bricht vorbestehend bei `/api/stripe/checkout` ab) und `npx eslint <geänderte Dateien>` (nicht `npm run lint`, 513 Bestandsfehler). Tests: `npm test`.
- **Niemals auf `main`.** Alles auf `dev`, Freigabe spricht Fabian eigens aus.

---

## Dateiübersicht

| Datei | Verantwortung |
|---|---|
| `docs/sql/2026-09-07-betriebskalibrierung.sql` | Tabelle + Rechte, von Fabian im Dashboard auszuführen |
| `src/lib/kalibrierung.ts` | **Kern.** Referenzkalkulation, Bandmitten, Faktorformel, Deckelung. Importiert nichts. |
| `src/lib/kalibrierungsspeicher.ts` | Supabase-Zugriff (laden, speichern) |
| `src/app/api/settings/kalibrierung/route.ts` | GET / PUT |
| `src/app/api/analyze/route.ts` | Faktoren anwenden (in `validateAndFix`) |
| `src/app/api/optimize/route.ts` | Faktoren anwenden (in `applyUserRates`) |
| `src/components/settings/BetriebSettings.tsx` | Einstellungen-Reiter „Mein Betrieb" |
| `src/app/settings/page.tsx` | Reiter einhängen |
| `src/app/page.tsx` | Onboarding-Schritte 5–7, Einstieg vom Ergebnis aus |
| `src/app/api/assistant/route.ts` | Hilfe kennt „Warum ist der Preis so hoch?" |
| `tests/kalibrierung.test.mjs` | Tests zur Rechenbibliothek |

---

## Die feste Referenzkalkulation

Der Entwurf ließ offen, woher CraftFlows eigener Preis für das Referenzmöbel kommt. **Entscheidung: fest hinterlegt, kein KI-Aufruf.** Ein Aufruf mitten im Onboarding würde ein bis zwei Minuten dauern, Geld kosten und bei jedem Nutzer leicht andere Zahlen liefern — der Faktor wäre nicht reproduzierbar.

Die Zahlen stammen aus der gemessenen Kalkulation vom 2026-09-07 (nach dem Laufmeter-Fix), gerundet auf glatte Richtwerte.

**Grundmöbel** — Einbauschrank Flur 2,00 × 2,40 × 0,60 m, Egger Dekor weiß, 4 Drehtüren, 2 Schubkästen auf Systemauszügen, Kleiderstange, je Fach 2 Einlegeböden, Sockel, Rückwand, Montage im Neubau, 20 km.

| Block | Posten | Wert |
|---|---|---|
| Material (EK) | Dekorspan 16,1 m² × 15 € | 241,50 € |
| | Rückwand Spanplatte 8 mm, 4,8 m² × 10 € | 48,00 € |
| | ABS-Kante 1 mm, 30 lfdm × 0,50 € | 15,00 € |
| | Topfscharniere 8 × 2,50 € | 20,00 € |
| | Systemauszüge 2 × 35,00 € | 70,00 € |
| | Kleiderstange | 15,00 € |
| | **Summe EK** | **409,50 €** |
| Fixsockel (min) | Besprechung 20, Planung 30, Konstruktion 60, Arbeitsvorbereitung 45 | 155 min |
| Werkstatt (min) | Zuschnitt 216, Bekantung 190, Zusammenbau 479, Warenhandling 20, Produktion 30, Verpacken 30 | 965 min |
| Montage (min) | Montage 240, Lieferung 70 | 310 min |

**Lackvariante:** zusätzlich 600 min Oberfläche und 60 € Lackmaterial (EK).
**Massivholzvariante:** Material-EK 1.770 € statt 409,50 €, Werkstatt × 1,3 (Eiche), zusätzlich 300 min Oberfläche (ölen).
**Altbau-Montage:** unsere Erwartung ist Montage × 1,6 = 384 min (ohne Fahrt).

Alle Blöcke werden mit den **Stundensätzen des Nutzers** bewertet — deshalb ist die Referenz für jeden Betrieb eine andere Zahl, obwohl das Möbel dasselbe ist.

---

### Task 1: Tabelle und Rechte

**Files:**
- Create: `docs/sql/2026-09-07-betriebskalibrierung.sql`

**Interfaces:**
- Consumes: nichts
- Produces: Tabelle `betriebskalibrierung` mit den unten genannten Spalten. Task 2 und 3 bauen darauf.

- [ ] **Schritt 1: SQL schreiben**

```sql
-- Betriebskalibrierung: die Antworten des Nutzers und die daraus abgeleiteten
-- Zeitfaktoren. Im Supabase-Dashboard (SQL Editor) einmal ausfuehren.
-- Gehoert zu docs/superpowers/specs/2026-09-06-betriebskalibrierung-design.md
--
-- Getrennt von betriebsprofil, weil hier gerechnete Werte liegen, die jederzeit
-- aus den Antworten neu abgeleitet werden koennen — das Profil traegt Stammdaten.

create table if not exists betriebskalibrierung (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade unique,

  -- Die fuenf Betriebsfragen
  mitarbeiter        text not null default '',
  maschinen          text[] not null default '{}',
  schwerpunkt        text not null default '',
  montage_selbst     text not null default '',
  stueckzahlen       text not null default '',

  -- Die vier Preisfragen. Werte: ein Bandschluessel, 'nicht' oder 'unbekannt'.
  antwort_grund      text not null default '',
  antwort_lack       text not null default '',
  antwort_massiv     text not null default '',
  antwort_montage    text not null default '',

  -- Abgeleitete Faktoren, immer zwischen 0.6 und 1.4
  faktor_werkstatt   numeric(4,2) not null default 1.0,
  faktor_oberflaeche numeric(4,2) not null default 1.0,
  faktor_massivholz  numeric(4,2) not null default 1.0,
  faktor_montage     numeric(4,2) not null default 1.0,

  abgeschlossen      boolean not null default false,
  hinweis_gezeigt    boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on column betriebskalibrierung.antwort_lack is
  'Bandschluessel, oder "nicht" (macht er nicht) oder "unbekannt" (weiss er gerade nicht). '
  '"unbekannt" laesst den Faktor auf 1.0 und darf NICHTS versprechen, solange es die Lernschleife nicht gibt.';

comment on column betriebskalibrierung.hinweis_gezeigt is
  'Der Deckungshinweis erscheint genau einmal und blockiert nie.';

create index if not exists betriebskalibrierung_user_idx on betriebskalibrierung (user_id);

alter table betriebskalibrierung enable row level security;

drop policy if exists "eigene kalibrierung lesen"   on betriebskalibrierung;
drop policy if exists "eigene kalibrierung anlegen" on betriebskalibrierung;
drop policy if exists "eigene kalibrierung aendern" on betriebskalibrierung;

create policy "eigene kalibrierung lesen"   on betriebskalibrierung for select using (auth.uid() = user_id);
create policy "eigene kalibrierung anlegen" on betriebskalibrierung for insert with check (auth.uid() = user_id);
create policy "eigene kalibrierung aendern" on betriebskalibrierung for update using (auth.uid() = user_id);

-- PFLICHT. Ohne diese Zeile schlaegt jedes Schreiben fehl, obwohl RLS korrekt ist.
-- Genau das hat am 2026-09-05 bei materialpreise einen halben Tag gekostet.
grant select, insert, update, delete on betriebskalibrierung to authenticated;
```

- [ ] **Schritt 2: Fabian bitten, das SQL im Supabase-Dashboard auszuführen**

Das kann kein Automat. Erst danach funktionieren Task 3 und alles Weitere.

- [ ] **Schritt 3: Commit**

```bash
git add docs/sql/2026-09-07-betriebskalibrierung.sql
git commit -m "feat(kalibrierung): SQL fuer die Tabelle betriebskalibrierung, mit GRANTs"
```

---

### Task 2: Die Rechenbibliothek

**Files:**
- Create: `src/lib/kalibrierung.ts`
- Test: `tests/kalibrierung.test.mjs`

**Interfaces:**
- Consumes: nichts (importiert bewusst nichts)
- Produces:
  - `REFERENZ` — die feste Referenzkalkulation
  - `BAENDER` — die Antwortbänder je Frage
  - `type Antworten = { grund: string; lack: string; massiv: string; montage: string }`
  - `type Faktoren = { werkstatt: number; oberflaeche: number; massivholz: number; montage: number }`
  - `referenzPreis(saetze, aufschlag): { material: number; fixsockel: number; werkstatt: number; montage: number; gesamt: number }`
  - `berechneFaktoren(antworten, saetze, aufschlag): Faktoren`
  - `deckele(f: number): number`
  - `WERKSTATT_KS`, `OBERFLAECHE_KS`, `MONTAGE_KS` — welche Kostenstelle zu welchem Faktor gehört

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

Datei `tests/kalibrierung.test.mjs`:

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  REFERENZ, BAENDER, referenzPreis, berechneFaktoren, deckele,
} from '../src/lib/kalibrierung.ts'

// Standardsaetze aus src/lib/types.ts, damit die Zahlen nachrechenbar bleiben.
const SAETZE = {
  Besprechung: 65, Planung: 85, Konstruktion: 75, Arbeitsvorbereitung: 75,
  Produktion: 65, Warenhandling: 65, Zuschnitt: 72, Bekantung: 100, CNC: 120,
  'Oberfläche': 72, Zusammenbau: 65, Verpacken: 65, Azubi: 52, Montage: 65, Lieferung: 65,
}
const AUFSCHLAG = 0.30

test('Die Referenzkalkulation ergibt einen plausiblen Gesamtpreis', () => {
  const r = referenzPreis(SAETZE, AUFSCHLAG)
  assert.ok(r.gesamt > 1900 && r.gesamt < 2600, `Gesamt war ${r.gesamt}`)
  assert.ok(Math.abs(r.material - 409.5 * 1.3) < 1)
  assert.ok(r.werkstatt > r.montage)
})

test('Die Summe der Bloecke ist der Gesamtpreis', () => {
  const r = referenzPreis(SAETZE, AUFSCHLAG)
  assert.ok(Math.abs((r.material + r.fixsockel + r.werkstatt + r.montage) - r.gesamt) < 0.01)
})

test('Wer die Bandmitte trifft, bekommt Faktor 1,0', () => {
  const r = referenzPreis(SAETZE, AUFSCHLAG)
  // Kuenstliches Band, dessen Mitte genau unseren Preis trifft
  const f = berechneFaktoren(
    { grund: `test:${r.gesamt}`, lack: 'unbekannt', massiv: 'unbekannt', montage: 'unbekannt' },
    SAETZE, AUFSCHLAG)
  assert.ok(Math.abs(f.werkstatt - 1.0) < 0.02, `Faktor war ${f.werkstatt}`)
})

test('Ein guenstigerer Betrieb bekommt einen Faktor unter 1', () => {
  const f = berechneFaktoren(
    { grund: '1200-1600', lack: 'unbekannt', massiv: 'unbekannt', montage: 'unbekannt' },
    SAETZE, AUFSCHLAG)
  assert.ok(f.werkstatt < 1.0, `Faktor war ${f.werkstatt}`)
})

test('"weiss ich nicht" laesst den Faktor auf genau 1,0', () => {
  const f = berechneFaktoren(
    { grund: '1600-2100', lack: 'unbekannt', massiv: 'unbekannt', montage: 'unbekannt' },
    SAETZE, AUFSCHLAG)
  assert.equal(f.oberflaeche, 1.0)
  assert.equal(f.massivholz, 1.0)
  assert.equal(f.montage, 1.0)
})

test('"mache ich nicht" laesst den Faktor ebenfalls auf 1,0', () => {
  const f = berechneFaktoren(
    { grund: '1600-2100', lack: 'nicht', massiv: 'nicht', montage: 'nicht' },
    SAETZE, AUFSCHLAG)
  assert.equal(f.oberflaeche, 1.0)
  assert.equal(f.massivholz, 1.0)
  assert.equal(f.montage, 1.0)
})

test('Eine unbeantwortete Frage erzeugt keinen Faktor', () => {
  const f = berechneFaktoren(
    { grund: '', lack: '', massiv: '', montage: '' }, SAETZE, AUFSCHLAG)
  assert.deepEqual(f, { werkstatt: 1, oberflaeche: 1, massivholz: 1, montage: 1 })
})

test('Die Deckelung haelt in beide Richtungen', () => {
  assert.equal(deckele(0.1), 0.6)
  assert.equal(deckele(9), 1.4)
  assert.equal(deckele(0.83), 0.83)
})

test('Auch ein extremes Band sprengt die Deckelung nicht', () => {
  const f = berechneFaktoren(
    { grund: 'unter-1200', lack: 'mehr', massiv: 'ueber-6000', montage: 'laenger' },
    SAETZE, AUFSCHLAG)
  for (const wert of Object.values(f)) {
    assert.ok(wert >= 0.6 && wert <= 1.4, `Faktor ausserhalb der Deckelung: ${wert}`)
  }
})

test('Die Lackfrage wirkt nur auf die Oberflaeche', () => {
  const a = berechneFaktoren({ grund: '1600-2100', lack: '700-1100', massiv: 'unbekannt', montage: 'unbekannt' }, SAETZE, AUFSCHLAG)
  const b = berechneFaktoren({ grund: '1600-2100', lack: 'unbekannt', massiv: 'unbekannt', montage: 'unbekannt' }, SAETZE, AUFSCHLAG)
  assert.notEqual(a.oberflaeche, b.oberflaeche)
  assert.equal(a.werkstatt, b.werkstatt)
  assert.equal(a.montage, b.montage)
})

test('Die Baender sind lueckenlos und aufsteigend', () => {
  for (const frage of ['grund', 'massiv']) {
    const werte = BAENDER[frage].filter(b => typeof b.mitte === 'number').map(b => b.mitte)
    for (let i = 1; i < werte.length; i++) assert.ok(werte[i] > werte[i - 1], `${frage} nicht aufsteigend`)
  }
})

test('Die Referenz nennt alle vier Bloecke', () => {
  assert.ok(REFERENZ.materialEk > 0)
  assert.ok(REFERENZ.fixsockel.length > 0)
  assert.ok(REFERENZ.werkstatt.length > 0)
  assert.ok(REFERENZ.montage.length > 0)
})
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npm test`
Erwartet: Die neue Datei schlägt fehl, weil `src/lib/kalibrierung.ts` nicht existiert.

- [ ] **Schritt 3: Die Bibliothek schreiben**

Datei `src/lib/kalibrierung.ts`:

```typescript
// Betriebskalibrierung: fest hinterlegte Referenzkalkulation und die daraus
// abgeleiteten Zeitfaktoren.
//
// Importiert bewusst NICHTS — wie learn.ts, lernwerkzeuge.ts, laufmeter.ts.
// Alles, was Supabase braucht, liegt in kalibrierungsspeicher.ts.
//
// WARUM FEST HINTERLEGT: Ein KI-Aufruf mitten im Onboarding wuerde ein bis zwei
// Minuten dauern, Geld kosten und bei jedem Nutzer leicht andere Zahlen liefern —
// der Faktor waere nicht reproduzierbar. Die Zahlen unten stammen aus der
// gemessenen Kalkulation vom 2026-09-07 (nach dem Laufmeter-Fix), gerundet.

export type Saetze = Record<string, number>

export type Zeitposten = { kostenstelle: string; minuten: number }

// Grundmoebel: Einbauschrank Flur 2,00 x 2,40 x 0,60 m, Egger Dekor weiss,
// 4 Drehtueren, 2 Schubkaesten auf Systemauszuegen, Kleiderstange, je Fach
// 2 Einlegeboeden, Sockel, Rueckwand, Montage im Neubau, 20 km.
export const REFERENZ = {
  materialEk: 409.5,
  fixsockel: [
    { kostenstelle: 'Besprechung', minuten: 20 },
    { kostenstelle: 'Planung', minuten: 30 },
    { kostenstelle: 'Konstruktion', minuten: 60 },
    { kostenstelle: 'Arbeitsvorbereitung', minuten: 45 },
  ] as Zeitposten[],
  werkstatt: [
    { kostenstelle: 'Zuschnitt', minuten: 216 },
    { kostenstelle: 'Bekantung', minuten: 190 },
    { kostenstelle: 'Zusammenbau', minuten: 479 },
    { kostenstelle: 'Warenhandling', minuten: 20 },
    { kostenstelle: 'Produktion', minuten: 30 },
    { kostenstelle: 'Verpacken', minuten: 30 },
  ] as Zeitposten[],
  montage: [
    { kostenstelle: 'Montage', minuten: 240 },
    { kostenstelle: 'Lieferung', minuten: 70 },
  ] as Zeitposten[],
  // Lackvariante: zusaetzliche Oberflaechenzeit und Lackmaterial.
  lackMinuten: 600,
  lackMaterialEk: 60,
  // Massivholzvariante: teureres Material, laengere Werkstattzeit (Eiche x1,3),
  // zusaetzlich Oelen.
  massivMaterialEk: 1770,
  massivWerkstattFaktor: 1.3,
  massivOberflaecheMinuten: 300,
  // Unsere Erwartung fuer eine Altbau-Montage: Neubau x 1,6, ohne Fahrt.
  altbauFaktor: 1.6,
} as const

// Welche Kostenstelle von welchem Faktor beruehrt wird. Liegt auf den
// KOSTENSTELLEN_GRUPPEN aus types.ts, absichtlich hier ohne Import wiederholt.
export const WERKSTATT_KS = [
  'Zuschnitt', 'Bekantung', 'CNC', 'Zusammenbau', 'Warenhandling', 'Produktion', 'Verpacken',
]
export const OBERFLAECHE_KS = ['Oberfläche']
export const MONTAGE_KS = ['Montage', 'Lieferung']
// Besprechung, Planung, Konstruktion, Arbeitsvorbereitung bleiben unberuehrt:
// Sie decken einen Sockel ab, der nicht mit der Betriebsgroesse skaliert.

export type Band = { schluessel: string; text: string; mitte: number | null }

export const BAENDER: Record<string, Band[]> = {
  grund: [
    { schluessel: 'unter-1200',  text: 'unter 1.200 €',   mitte: 1000 },
    { schluessel: '1200-1600',   text: '1.200 – 1.600 €', mitte: 1400 },
    { schluessel: '1600-2100',   text: '1.600 – 2.100 €', mitte: 1850 },
    { schluessel: '2100-2700',   text: '2.100 – 2.700 €', mitte: 2400 },
    { schluessel: 'ueber-2700',  text: 'über 2.700 €',    mitte: 3100 },
  ],
  lack: [
    { schluessel: '200-400',     text: '+ 200 – 400 €',     mitte: 300 },
    { schluessel: '400-700',     text: '+ 400 – 700 €',     mitte: 550 },
    { schluessel: '700-1100',    text: '+ 700 – 1.100 €',   mitte: 900 },
    { schluessel: '1100-1600',   text: '+ 1.100 – 1.600 €', mitte: 1350 },
    { schluessel: 'mehr',        text: 'mehr',              mitte: 1900 },
    { schluessel: 'nicht',       text: 'mache ich nicht',            mitte: null },
    { schluessel: 'unbekannt',   text: 'weiß ich gerade nicht',      mitte: null },
  ],
  massiv: [
    { schluessel: 'unter-2500',  text: 'unter 2.500 €',   mitte: 2200 },
    { schluessel: '2500-3500',   text: '2.500 – 3.500 €', mitte: 3000 },
    { schluessel: '3500-4500',   text: '3.500 – 4.500 €', mitte: 4000 },
    { schluessel: '4500-6000',   text: '4.500 – 6.000 €', mitte: 5250 },
    { schluessel: 'ueber-6000',  text: 'über 6.000 €',    mitte: 7000 },
    { schluessel: 'nicht',       text: 'mache ich nicht',            mitte: null },
    { schluessel: 'unbekannt',   text: 'weiß ich gerade nicht',      mitte: null },
  ],
  // In Tagen, weil ein Schreiner so darueber denkt. 1 Tag = 480 min.
  montage: [
    { schluessel: 'halber-tag',   text: 'ein halber Tag',   mitte: 240 },
    { schluessel: 'ein-tag',      text: 'ein Tag',          mitte: 480 },
    { schluessel: 'anderthalb',   text: 'anderthalb Tage',  mitte: 720 },
    { schluessel: 'zwei-tage',    text: 'zwei Tage',        mitte: 960 },
    { schluessel: 'laenger',      text: 'länger',           mitte: 1250 },
    { schluessel: 'nicht',        text: 'montiere ich nicht',      mitte: null },
    { schluessel: 'unbekannt',    text: 'weiß ich gerade nicht',   mitte: null },
  ],
}

const MIN_FAKTOR = 0.6
const MAX_FAKTOR = 1.4

export function deckele(faktor: number): number {
  if (!Number.isFinite(faktor)) return 1
  return Math.min(MAX_FAKTOR, Math.max(MIN_FAKTOR, Math.round(faktor * 100) / 100))
}

function wert(posten: Zeitposten[], saetze: Saetze, faktor = 1): number {
  return posten.reduce((s, p) => s + (p.minuten * faktor / 60) * (saetze[p.kostenstelle] ?? 65), 0)
}

export function referenzPreis(saetze: Saetze, aufschlag: number) {
  const material  = REFERENZ.materialEk * (1 + aufschlag)
  const fixsockel = wert(REFERENZ.fixsockel, saetze)
  const werkstatt = wert(REFERENZ.werkstatt, saetze)
  const montage   = wert(REFERENZ.montage, saetze)
  return { material, fixsockel, werkstatt, montage, gesamt: material + fixsockel + werkstatt + montage }
}

// Testschluessel "test:<zahl>" erlaubt es, die Bandmitte im Test genau auf den
// eigenen Referenzpreis zu setzen. In der Oberflaeche kommt so ein Wert nie vor.
function mitte(frage: string, schluessel: string): number | null {
  if (schluessel.startsWith('test:')) {
    const z = Number(schluessel.slice(5))
    return Number.isFinite(z) ? z : null
  }
  const band = (BAENDER[frage] ?? []).find(b => b.schluessel === schluessel)
  return band ? band.mitte : null
}

export type Antworten = { grund: string; lack: string; massiv: string; montage: string }
export type Faktoren = { werkstatt: number; oberflaeche: number; massivholz: number; montage: number }

/**
 * Leitet die vier Faktoren aus den Antworten ab.
 *
 * Grundform, fuer jeden Faktor gleich:
 *
 *   Faktor = (Zahl des Nutzers − unser Materialanteil − nicht skalierbarer Sockel)
 *            ─────────────────────────────────────────────────────────────────────
 *                       unser skalierbarer Zeitanteil in diesem Bereich
 *
 * Nicht beantwortet, "nicht" oder "unbekannt" ergeben immer genau 1,0 — eine
 * uebersprungene Frage darf nirgends wie eine beantwortete aussehen.
 */
export function berechneFaktoren(a: Antworten, saetze: Saetze, aufschlag: number): Faktoren {
  const r = referenzPreis(saetze, aufschlag)
  const f: Faktoren = { werkstatt: 1, oberflaeche: 1, massivholz: 1, montage: 1 }

  // 1. Grundmoebel -> Werkstatt. Material, Fixsockel und Montage bleiben aussen vor.
  const grund = mitte('grund', a.grund)
  if (grund !== null && r.werkstatt > 0) {
    f.werkstatt = deckele((grund - r.material - r.fixsockel - r.montage) / r.werkstatt)
  }

  // 2. Lack -> Oberflaeche. Der Aufpreis enthaelt Lackmaterial, das abgezogen wird.
  const lack = mitte('lack', a.lack)
  if (lack !== null) {
    const lackMaterial = REFERENZ.lackMaterialEk * (1 + aufschlag)
    const lackZeitwert = (REFERENZ.lackMinuten / 60) * (saetze['Oberfläche'] ?? 72)
    if (lackZeitwert > 0) f.oberflaeche = deckele((lack - lackMaterial) / lackZeitwert)
  }

  // 3. Massivholz -> Zuschlag auf Werkstatt- und Oberflaechenzeit.
  const massiv = mitte('massiv', a.massiv)
  if (massiv !== null) {
    const massivMaterial = REFERENZ.massivMaterialEk * (1 + aufschlag)
    const massivWerkstatt = wert(REFERENZ.werkstatt, saetze, REFERENZ.massivWerkstattFaktor)
    const massivOberflaeche = (REFERENZ.massivOberflaecheMinuten / 60) * (saetze['Oberfläche'] ?? 72)
    const zeitanteil = massivWerkstatt + massivOberflaeche
    if (zeitanteil > 0) {
      f.massivholz = deckele((massiv - massivMaterial - r.fixsockel - r.montage) / zeitanteil)
    }
  }

  // 4. Montage. Gefragt wird die ALTBAU-Dauer in Tagen, verglichen wird gegen
  //    unsere Altbau-Erwartung (Neubau x 1,6, ohne Fahrt). Der so gewonnene Faktor
  //    gilt fuer alle Montage; der Altbau-Zuschlag selbst bleibt Sache der Engine.
  const montage = mitte('montage', a.montage)
  if (montage !== null) {
    const erwartetMin = (REFERENZ.montage.find(p => p.kostenstelle === 'Montage')?.minuten ?? 240)
      * REFERENZ.altbauFaktor
    if (erwartetMin > 0) f.montage = deckele(montage / erwartetMin)
  }

  return f
}
```

- [ ] **Schritt 4: Tests laufen lassen, grün bestätigen**

Run: `npm test`
Erwartet: alle Tests grün, Gesamtzahl steigt um 11.

- [ ] **Schritt 5: Typen und Lint prüfen**

Run: `npx tsc --noEmit && npx eslint src/lib/kalibrierung.ts`
Erwartet: keine Ausgabe.

- [ ] **Schritt 6: Commit**

```bash
git add src/lib/kalibrierung.ts tests/kalibrierung.test.mjs
git commit -m "feat(kalibrierung): Referenzkalkulation und Faktorformel"
```

---

### Task 3: Speicher und Schnittstelle

**Files:**
- Create: `src/lib/kalibrierungsspeicher.ts`
- Create: `src/app/api/settings/kalibrierung/route.ts`

**Interfaces:**
- Consumes: `Antworten`, `Faktoren`, `berechneFaktoren` aus Task 2
- Produces:
  - `ladeKalibrierung(supabase, userId): Promise<Kalibrierung | null>`
  - `speichereKalibrierung(supabase, userId, daten): Promise<{ ok: boolean; grund?: string }>`
  - `GET /api/settings/kalibrierung` → `{ kalibrierung: Kalibrierung | null }`
  - `PUT /api/settings/kalibrierung` mit `{ mitarbeiter, maschinen, schwerpunkt, montage_selbst, stueckzahlen, antwort_grund, antwort_lack, antwort_massiv, antwort_montage }` → berechnet die Faktoren serverseitig und speichert beides

- [ ] **Schritt 1: Speicher schreiben**

Datei `src/lib/kalibrierungsspeicher.ts`. Muster: `src/lib/preisspeicher.ts` — dieselbe Struktur, dieselbe Fehlerbehandlung.

**Wichtig:** Supabase wirft nicht. Es liefert `{ data: null, error }`. Wer nur `data` liest, hält einen Ausfall für einen Normalfall. Jeder Aufruf prüft `error` ausdrücklich und gibt den Grund im Klartext zurück.

```typescript
// Supabase-Zugriff fuer die Betriebskalibrierung. Getrennt von kalibrierung.ts,
// weil die Rechenbibliothek nichts importieren darf.
import type { SupabaseClient } from '@supabase/supabase-js'

export type Kalibrierung = {
  mitarbeiter: string
  maschinen: string[]
  schwerpunkt: string
  montage_selbst: string
  stueckzahlen: string
  antwort_grund: string
  antwort_lack: string
  antwort_massiv: string
  antwort_montage: string
  faktor_werkstatt: number
  faktor_oberflaeche: number
  faktor_massivholz: number
  faktor_montage: number
  abgeschlossen: boolean
  hinweis_gezeigt: boolean
}

export async function ladeKalibrierung(
  supabase: SupabaseClient, userId: string,
): Promise<Kalibrierung | null> {
  if (!userId) return null
  const { data, error } = await supabase
    .from('betriebskalibrierung')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  // Supabase wirft nicht — ohne diese Pruefung sieht ein Ausfall wie "nichts da" aus.
  if (error) { console.error('[kalibrierung] laden:', error.message); return null }
  return (data as Kalibrierung) ?? null
}

export async function speichereKalibrierung(
  supabase: SupabaseClient, userId: string, daten: Partial<Kalibrierung>,
): Promise<{ ok: boolean; grund?: string }> {
  if (!userId) return { ok: false, grund: 'Nicht eingeloggt' }
  const { error } = await supabase
    .from('betriebskalibrierung')
    .upsert({ ...daten, user_id: userId, updated_at: new Date().toISOString() },
            { onConflict: 'user_id' })
  if (error) return { ok: false, grund: error.message }
  return { ok: true }
}
```

- [ ] **Schritt 2: Route schreiben**

Datei `src/app/api/settings/kalibrierung/route.ts`. Muster: `src/app/api/settings/materialpreise/route.ts`.

Die Route berechnet die Faktoren **serverseitig** aus den Antworten, den Stundensätzen des Nutzers und seinem Materialaufschlag. Nie aus dem Browser übernehmen — die Faktoren steuern Preise.

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { berechneFaktoren } from '@/lib/kalibrierung'
import { ladeKalibrierung, speichereKalibrierung } from '@/lib/kalibrierungsspeicher'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  return NextResponse.json({ kalibrierung: await ladeKalibrierung(supabase, user.id) })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const b = await req.json() as Record<string, unknown>
  const text = (k: string) => String(b[k] ?? '')

  // Stundensaetze und Aufschlag des Nutzers laden — die Referenz ist fuer jeden
  // Betrieb eine andere Zahl, obwohl das Moebel dasselbe ist.
  const { data: ks } = await supabase.from('kostenstellen')
    .select('code, bezeichnung, stundensatz').eq('user_id', user.id)
  const saetze: Record<string, number> = {}
  for (const k of ks ?? []) saetze[k.bezeichnung as string] = Number(k.stundensatz)
  const { data: mg } = await supabase.from('materialgruppen')
    .select('aufschlag_prozent').eq('user_id', user.id).limit(1)
  const aufschlag = mg?.[0] ? Number(mg[0].aufschlag_prozent) / 100 : 0.30

  const antworten = {
    grund:   text('antwort_grund'),
    lack:    text('antwort_lack'),
    massiv:  text('antwort_massiv'),
    montage: text('antwort_montage'),
  }
  const f = berechneFaktoren(antworten, saetze, aufschlag)

  const r = await speichereKalibrierung(supabase, user.id, {
    mitarbeiter:    text('mitarbeiter'),
    maschinen:      Array.isArray(b.maschinen) ? (b.maschinen as string[]).map(String) : [],
    schwerpunkt:    text('schwerpunkt'),
    montage_selbst: text('montage_selbst'),
    stueckzahlen:   text('stueckzahlen'),
    antwort_grund:   antworten.grund,
    antwort_lack:    antworten.lack,
    antwort_massiv:  antworten.massiv,
    antwort_montage: antworten.montage,
    faktor_werkstatt:   f.werkstatt,
    faktor_oberflaeche: f.oberflaeche,
    faktor_massivholz:  f.massivholz,
    faktor_montage:     f.montage,
    abgeschlossen: true,
  })
  if (!r.ok) return NextResponse.json({ error: r.grund }, { status: 500 })
  return NextResponse.json({ ok: true, faktoren: f })
}
```

- [ ] **Schritt 3: Typen und Lint prüfen**

Run: `npx tsc --noEmit && npx eslint src/lib/kalibrierungsspeicher.ts src/app/api/settings/kalibrierung/route.ts`

- [ ] **Schritt 4: Gegen die dev-Vorschau prüfen**

Nach dem Deploy im eingeloggten Browser:

```javascript
await fetch('/api/settings/kalibrierung', { method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ mitarbeiter: 'solo', maschinen: [], schwerpunkt: 'moebel',
    montage_selbst: 'immer', stueckzahlen: 'einzel',
    antwort_grund: '1600-2100', antwort_lack: 'unbekannt',
    antwort_massiv: 'nicht', antwort_montage: 'ein-tag' }) }).then(r => r.json())
```
Erwartet: `{ ok: true, faktoren: { werkstatt: <unter 1>, oberflaeche: 1, massivholz: 1, montage: <um 1,25> } }`

- [ ] **Schritt 5: Commit**

```bash
git add src/lib/kalibrierungsspeicher.ts src/app/api/settings/kalibrierung/route.ts
git commit -m "feat(kalibrierung): Speicher und Schnittstelle, Faktoren werden serverseitig berechnet"
```

---

### Task 4: Faktoren in der Analyse anwenden

**Files:**
- Create: `src/lib/zeitfaktoren.ts`
- Test: `tests/zeitfaktoren.test.mjs`
- Modify: `src/app/api/analyze/route.ts` (Import, `validateAndFix`-Signatur, Aufrufstelle)

**Interfaces:**
- Consumes: `WERKSTATT_KS`, `OBERFLAECHE_KS`, `MONTAGE_KS`, `Faktoren` aus Task 2
- Produces: `wendeFaktorenAn(zeilen, faktoren, massiv): Zeitzeile[]`

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { wendeFaktorenAn } from '../src/lib/zeitfaktoren.ts'

const ZEILEN = [
  { kostenstelle: 'Besprechung', minuten: 20 },
  { kostenstelle: 'Zuschnitt', minuten: 200 },
  { kostenstelle: 'Zusammenbau', minuten: 400 },
  { kostenstelle: 'Oberfläche', minuten: 300 },
  { kostenstelle: 'Montage', minuten: 240 },
]
const EINS = { werkstatt: 1, oberflaeche: 1, massivholz: 1, montage: 1 }

test('Faktor 1 aendert nichts', () => {
  assert.deepEqual(wendeFaktorenAn(ZEILEN, EINS, false), ZEILEN)
})

test('Der Werkstattfaktor wirkt nur auf Werkstatt-Kostenstellen', () => {
  const r = wendeFaktorenAn(ZEILEN, { ...EINS, werkstatt: 0.8 }, false)
  assert.equal(r.find(z => z.kostenstelle === 'Zuschnitt').minuten, 160)
  assert.equal(r.find(z => z.kostenstelle === 'Zusammenbau').minuten, 320)
  assert.equal(r.find(z => z.kostenstelle === 'Montage').minuten, 240)
  assert.equal(r.find(z => z.kostenstelle === 'Besprechung').minuten, 20)
})

test('Der Fixsockel bleibt immer unberuehrt', () => {
  const r = wendeFaktorenAn(ZEILEN, { werkstatt: 0.6, oberflaeche: 0.6, massivholz: 0.6, montage: 0.6 }, false)
  assert.equal(r.find(z => z.kostenstelle === 'Besprechung').minuten, 20)
})

test('Der Montagefaktor wirkt nur auf Montage und Lieferung', () => {
  const r = wendeFaktorenAn(ZEILEN, { ...EINS, montage: 1.25 }, false)
  assert.equal(r.find(z => z.kostenstelle === 'Montage').minuten, 300)
  assert.equal(r.find(z => z.kostenstelle === 'Zuschnitt').minuten, 200)
})

test('Bei Massivholz kommt der Massivholzfaktor obendrauf', () => {
  const ohne = wendeFaktorenAn(ZEILEN, { ...EINS, werkstatt: 0.9 }, false)
  const mit  = wendeFaktorenAn(ZEILEN, { ...EINS, werkstatt: 0.9, massivholz: 1.2 }, true)
  assert.ok(mit.find(z => z.kostenstelle === 'Zuschnitt').minuten
          > ohne.find(z => z.kostenstelle === 'Zuschnitt').minuten)
})

test('Ohne Massivholz bleibt der Massivholzfaktor wirkungslos', () => {
  const a = wendeFaktorenAn(ZEILEN, { ...EINS, massivholz: 1.4 }, false)
  assert.deepEqual(a, ZEILEN)
})

test('Minuten bleiben ganze Zahlen und nie negativ', () => {
  const r = wendeFaktorenAn([{ kostenstelle: 'Zuschnitt', minuten: 7 }], { ...EINS, werkstatt: 0.6 }, false)
  assert.equal(Number.isInteger(r[0].minuten), true)
  assert.ok(r[0].minuten >= 0)
})
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npm test` — Erwartet: `src/lib/zeitfaktoren.ts` fehlt.

- [ ] **Schritt 3: Die Bibliothek schreiben**

```typescript
// Wendet die Zeitfaktoren der Betriebskalibrierung an.
// Importiert bewusst NICHTS.
//
// Der Fixsockel (Besprechung, Planung, Konstruktion, Arbeitsvorbereitung) wird
// NIE veraendert: Er deckt einen Grundaufwand ab, der nicht mit der
// Betriebsgroesse skaliert. Steht so in der Spec, Abschnitt 6.

const WERKSTATT_KS = new Set([
  'Zuschnitt', 'Bekantung', 'CNC', 'Zusammenbau', 'Warenhandling', 'Produktion', 'Verpacken',
])
const OBERFLAECHE_KS = new Set(['Oberfläche'])
const MONTAGE_KS = new Set(['Montage', 'Lieferung'])

export type Zeitzeile = { kostenstelle: string; minuten: number }
export type Faktoren = { werkstatt: number; oberflaeche: number; massivholz: number; montage: number }

export function wendeFaktorenAn(
  zeilen: Zeitzeile[], f: Faktoren, massiv: boolean,
): Zeitzeile[] {
  if (!Array.isArray(zeilen) || zeilen.length === 0) return zeilen
  // Der Massivholzfaktor kommt auf Werkstatt und Oberflaeche OBENDRAUF, statt sie
  // zu ersetzen: Er beschreibt den Mehraufwand des Materials, nicht die
  // Geschwindigkeit des Betriebs.
  const massivZuschlag = massiv ? f.massivholz : 1
  return zeilen.map(z => {
    let faktor = 1
    if (WERKSTATT_KS.has(z.kostenstelle))       faktor = f.werkstatt * massivZuschlag
    else if (OBERFLAECHE_KS.has(z.kostenstelle)) faktor = f.oberflaeche * massivZuschlag
    else if (MONTAGE_KS.has(z.kostenstelle))     faktor = f.montage
    if (faktor === 1) return z
    return { ...z, minuten: Math.max(0, Math.round(z.minuten * faktor)) }
  })
}
```

- [ ] **Schritt 4: Tests laufen lassen, grün bestätigen**

Run: `npm test`

- [ ] **Schritt 5: In `analyze` einhängen**

In `src/app/api/analyze/route.ts`:

1. Import ergänzen: `import { wendeFaktorenAn } from '@/lib/zeitfaktoren'`
2. `validateAndFix` bekommt einen weiteren Parameter `faktoren: Faktoren = { werkstatt: 1, oberflaeche: 1, massivholz: 1, montage: 1 }`
3. **Direkt nach dem Block `6b. Zeiten auf die Pflichtrechnung deckeln`** einfügen:

```typescript
    // 6c. Zeitfaktoren der Betriebskalibrierung. NACH der Deckelung, damit die
    //     Deckelung den Branchenrichtwert prueft und nicht den kalibrierten Wert.
    az = wendeFaktorenAn(az, faktoren, massiv) as typeof az
```
4. In `POST`: Kalibrierung laden und durchreichen.

```typescript
    const kal = nutzerId ? await ladeKalibrierung(supabase, nutzerId) : null
    const faktoren = kal
      ? { werkstatt: Number(kal.faktor_werkstatt), oberflaeche: Number(kal.faktor_oberflaeche),
          massivholz: Number(kal.faktor_massivholz), montage: Number(kal.faktor_montage) }
      : { werkstatt: 1, oberflaeche: 1, massivholz: 1, montage: 1 }
```
und an `validateAndFix(...)` als letztes Argument übergeben.

- [ ] **Schritt 6: Typen und Lint prüfen**

Run: `npx tsc --noEmit && npx eslint src/lib/zeitfaktoren.ts src/app/api/analyze/route.ts`
Erwartet: die vier bekannten `prefer-const`-Bestandsfehler in `analyze/route.ts`, sonst nichts.

- [ ] **Schritt 7: Commit**

```bash
git add src/lib/zeitfaktoren.ts tests/zeitfaktoren.test.mjs src/app/api/analyze/route.ts
git commit -m "feat(kalibrierung): Zeitfaktoren wirken in der Analyse"
```

---

### Task 5: Faktoren in der Optimierung anwenden

**Files:**
- Modify: `src/app/api/optimize/route.ts` (`applyUserRates`, Aufrufstelle)

**Interfaces:**
- Consumes: `wendeFaktorenAn` aus Task 4, `ladeKalibrierung` aus Task 3
- Produces: nichts Neues

Ohne diesen Schritt lässt sich die Kalibrierung umgehen: Wer im Chat Änderungen machen lässt, bekommt unkalibrierte Zeiten zurück.

- [ ] **Schritt 1: `applyUserRates` erweitern**

Signatur um `faktoren: Faktoren` ergänzen und in der Positionsschleife anwenden:

```typescript
    const arbeitszeit = Array.isArray(pos.arbeitszeit)
      ? wendeFaktorenAn(
          pos.arbeitszeit
            .filter(a => !deaktiviert.has(normalizeKsId(a.kostenstelle)))
            .map(a => (a.kostenstelle in activeSaetze ? { ...a, vkStunde: activeSaetze[a.kostenstelle] } : a)),
          faktoren,
          isMassivholzPos(pos),
        ) as typeof pos.arbeitszeit
      : pos.arbeitszeit
```

`isMassivholzPos` gibt es in `optimize` noch nicht. Die einfachste tragfähige Fassung, bewusst dieselbe Regex wie in `analyze`:

```typescript
const MASSIVHOLZ_RE = /massivholz|massiv[\s-]?eiche|massiv[\s-]?buche|massiv[\s-]?nuss|massiv[\s-]?fichte|massiv[\s-]?kiefer|massiv[\s-]?esche/i
function isMassivholzPos(pos: Pos): boolean {
  const text = [pos.titel ?? '', pos.beschreibung ?? '',
    ...(pos.material ?? []).map(m => m.bezeichnung ?? '')].join(' ')
  return MASSIVHOLZ_RE.test(text)
}
```

- [ ] **Schritt 2: Kalibrierung in `POST` laden und durchreichen**

Wie in Task 4, Schritt 5, Punkt 4 — dieselben vier Zeilen, dieselbe Voreinstellung auf 1,0.

- [ ] **Schritt 3: Typen, Lint und Tests**

Run: `npx tsc --noEmit && npx eslint src/app/api/optimize/route.ts && npm test`

- [ ] **Schritt 4: Commit**

```bash
git add src/app/api/optimize/route.ts
git commit -m "feat(kalibrierung): Zeitfaktoren wirken auch im Chat-Weg"
```

---

### Task 6: Abgeschaltete Kostenstellen umbuchen statt löschen

**Files:**
- Create: `src/lib/handarbeit.ts`
- Test: `tests/handarbeit.test.mjs`
- Modify: `src/app/api/analyze/route.ts` (die Filterzeile), `src/app/api/optimize/route.ts` (die Filterzeile)

**Interfaces:**
- Produces: `bucheUm(zeilen, deaktiviert, saetze): Zeitzeile[]`

Heute streicht `az = az.filter(a => !deaktiviert.has(a.kostenstelle))` die Arbeit ersatzlos. Wer CNC abschaltet, verliert die Stunden für die Griffmulden. Das Angebot wird zu billig, die Arbeit fällt trotzdem an — das ist die zweite Beschwerde, die Fabian aus der Praxis kennt.

**Und Handarbeit ist nicht billiger:** Kantenanleimen von Hand dauert 1,5–2 h zu 65 €/h, an der Maschine 1 h zu 100 €/h. Wer nur den Satz tauscht, ohne die Zeit zu verlängern, erzeugt wieder zu billige Angebote.

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

```javascript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bucheUm, HANDARBEIT_ZIEL, HANDARBEIT_ZUSCHLAG } from '../src/lib/handarbeit.ts'

const ZEILEN = [
  { kostenstelle: 'Zuschnitt', minuten: 200, vkStunde: 72 },
  { kostenstelle: 'CNC', minuten: 60, vkStunde: 120 },
  { kostenstelle: 'Bekantung', minuten: 120, vkStunde: 100 },
]
const SAETZE = { Zuschnitt: 72, Zusammenbau: 65, CNC: 120, Bekantung: 100 }

test('Ohne Abschaltung bleibt alles', () => {
  assert.deepEqual(bucheUm(ZEILEN, new Set(), SAETZE), ZEILEN)
})

test('Abgeschaltete Arbeit verschwindet NICHT, sie wandert', () => {
  const r = bucheUm(ZEILEN, new Set(['CNC']), SAETZE)
  assert.equal(r.find(z => z.kostenstelle === 'CNC'), undefined)
  const gesamt = r.reduce((s, z) => s + z.minuten, 0)
  assert.ok(gesamt > 380, `Minuten sind verschwunden: ${gesamt}`)
})

test('Handarbeit dauert laenger als Maschinenarbeit', () => {
  const r = bucheUm(ZEILEN, new Set(['CNC']), SAETZE)
  const ziel = r.find(z => z.kostenstelle === HANDARBEIT_ZIEL['CNC'])
  assert.ok(ziel.minuten >= Math.round(60 * HANDARBEIT_ZUSCHLAG))
})

test('Das Ziel bekommt den Satz des Ziels, nicht den der Maschine', () => {
  const r = bucheUm(ZEILEN, new Set(['CNC']), SAETZE)
  const ziel = r.find(z => z.kostenstelle === HANDARBEIT_ZIEL['CNC'])
  assert.equal(ziel.vkStunde, SAETZE[HANDARBEIT_ZIEL['CNC']])
})

test('Mehrere abgeschaltete Kostenstellen summieren sich im Ziel', () => {
  const r = bucheUm(ZEILEN, new Set(['CNC', 'Bekantung']), SAETZE)
  assert.equal(r.find(z => z.kostenstelle === 'CNC'), undefined)
  assert.equal(r.find(z => z.kostenstelle === 'Bekantung'), undefined)
  assert.ok(r.reduce((s, z) => s + z.minuten, 0) > 380)
})

test('Ist auch das Ziel abgeschaltet, geht nichts verloren', () => {
  const r = bucheUm(ZEILEN, new Set(['CNC', 'Zusammenbau']), SAETZE)
  assert.ok(r.reduce((s, z) => s + z.minuten, 0) > 380)
})
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag bestätigen**

- [ ] **Schritt 3: Die Bibliothek schreiben**

```typescript
// Bucht die Arbeit abgeschalteter Kostenstellen auf Handarbeit um, statt sie zu
// streichen. Importiert bewusst NICHTS.
//
// Vorher: az = az.filter(a => !deaktiviert.has(a.kostenstelle)) — die Arbeit war weg.
// Wer CNC abschaltet, verlor die Stunden fuer die Griffmulden. Das Angebot wurde zu
// billig, die Arbeit fiel trotzdem an. Genau die Beschwerde "hat laenger gedauert
// als kalkuliert".
//
// Handarbeit ist NICHT billiger: Kantenanleimen von Hand 1,5-2 h zu 65 EUR/h gegen
// 1 h zu 100 EUR/h an der Maschine. Wer nur den Satz tauscht, ohne die Zeit zu
// verlaengern, erzeugt wieder zu billige Angebote.

export type Zeitzeile = { kostenstelle: string; minuten: number; vkStunde?: number }

// Wohin die Arbeit wandert, wenn die Maschine fehlt.
export const HANDARBEIT_ZIEL: Record<string, string> = {
  CNC: 'Zusammenbau',
  Bekantung: 'Zusammenbau',
  'Oberfläche': 'Zusammenbau',
  Zuschnitt: 'Zusammenbau',
}
// Ohne Maschine dauert dieselbe Arbeit laenger.
export const HANDARBEIT_ZUSCHLAG = 1.6
const RUECKFALL = 'Zusammenbau'

export function bucheUm(
  zeilen: Zeitzeile[], deaktiviert: Set<string>, saetze: Record<string, number>,
): Zeitzeile[] {
  if (!Array.isArray(zeilen) || deaktiviert.size === 0) return zeilen
  const behalten: Zeitzeile[] = []
  let umzubuchen = 0
  for (const z of zeilen) {
    if (!deaktiviert.has(z.kostenstelle)) { behalten.push(z); continue }
    umzubuchen += Math.round(z.minuten * HANDARBEIT_ZUSCHLAG)
  }
  if (umzubuchen === 0) return behalten

  // Ziel bestimmen: bevorzugt das hinterlegte, sonst der Rueckfall. Ist auch das
  // abgeschaltet, nimm die erste verbliebene Zeile — verloren gehen darf nichts.
  let ziel = RUECKFALL
  if (deaktiviert.has(ziel)) ziel = behalten[0]?.kostenstelle ?? RUECKFALL

  const vorhanden = behalten.find(z => z.kostenstelle === ziel)
  if (vorhanden) vorhanden.minuten += umzubuchen
  else behalten.push({ kostenstelle: ziel, minuten: umzubuchen, vkStunde: saetze[ziel] ?? 65 })
  return behalten
}
```

- [ ] **Schritt 4: Tests laufen lassen, grün bestätigen**

- [ ] **Schritt 5: In `analyze` und `optimize` einhängen**

In `analyze/route.ts` die Zeile

```typescript
    if (deaktiviert.size > 0) az = az.filter(a => !deaktiviert.has(a.kostenstelle))
```
ersetzen durch

```typescript
    if (deaktiviert.size > 0) az = bucheUm(az, deaktiviert, activeSaetze) as typeof az
```

In `optimize/route.ts` entsprechend die `.filter(a => !deaktiviert.has(normalizeKsId(a.kostenstelle)))`-Kette. Achtung: dort wird über `normalizeKsId` gefiltert — die Normalisierung muss erhalten bleiben, sonst greift die Abschaltung bei Legacy-Codes nicht mehr.

- [ ] **Schritt 6: Typen, Lint, Tests**

- [ ] **Schritt 7: Commit**

```bash
git add src/lib/handarbeit.ts tests/handarbeit.test.mjs src/app/api/analyze/route.ts src/app/api/optimize/route.ts
git commit -m "fix(kostenstellen): Abschalten bucht die Arbeit um, statt sie zu loeschen"
```

---

### Task 7: Die Erst-Anmeldung umbauen

**Files:**
- Modify: `src/app/page.tsx` (`ONBOARDING_STEPS`, ab Zeile ~1950)

**Interfaces:**
- Consumes: `BAENDER` aus Task 2, `PUT /api/settings/kalibrierung` aus Task 3
- Produces: nichts, was spätere Tasks brauchen

Aus sieben Schritten werden acht. Schritt 5 und 6 erklären heute nur, wo die Einstellungen liegen — künftig **stellen sie ein**.

| # | heute | künftig |
|---|---|---|
| 1–4 | Willkommen, Beschreibung ×2, KI-Werkzeuge | unverändert |
| 5 | „Kostenstellen einrichten" | **Die fünf Fragen zum Betrieb** |
| 6 | „Materialaufschlag einstellen" | **Grundmöbel + Preisfrage** |
| 7 | *(neu)* | **Lack, Massivholz, Montage** |
| 8 | „Bessere Ergebnisse bekommen" | unverändert, ergänzt um die vier Faktoren |

- [ ] **Schritt 1: Zustand für die Antworten anlegen**

Neben `onboardingStep` in derselben Komponente:

```typescript
  const [kalib, setKalib] = useState({
    mitarbeiter: '', maschinen: [] as string[], schwerpunkt: '',
    montage_selbst: '', stueckzahlen: '',
    antwort_grund: '', antwort_lack: '', antwort_massiv: '', antwort_montage: '',
  })
```

- [ ] **Schritt 2: Schritt 5 ersetzen — die fünf Betriebsfragen**

Fünf Auswahlgruppen. Der Aufbau folgt dem bestehenden Muster im Onboarding (Kästchen mit `background: '#1C1C1C'`, `borderRadius: 8`), Auswahl markiert mit `border: '1px solid ' + C.copper`.

1. **Wie viele arbeiten in der Werkstatt mit?** — `nur ich` · `2–3` · `4–10` · `mehr`
2. **Welche Maschinen hast du?** (Mehrfachauswahl) — `Formatkreissäge` · `Kantenanleimmaschine` · `CNC` · `Lackierkabine` · `keine davon`
3. **Was baust du hauptsächlich?** — `Möbel nach Maß` · `Innenausbau und Einbauschränke` · `Küchen` · `Türen und Böden` · `gemischt`
4. **Montierst du selbst beim Kunden?** — `immer` · `manchmal` · `nie`
5. **Einzelstücke oder auch größere Stückzahlen?** — `fast nur Einzelstücke` · `gemischt` · `oft Serien`

Unter Frage 5 der Hinweis: *„Diese Frage ändert deine Kalkulation nicht — sie hilft uns zu verstehen, wofür CraftFlow gebraucht wird."*

- [ ] **Schritt 3: Schritt 6 ersetzen — Grundmöbel und Preisfrage**

Die Beschreibung als hervorgehobener Kasten, die fünf Pflichtangaben **fett**:

> **Einbauschrank Flur**, 2,00 m breit × 2,40 m hoch × 0,60 m tief.
> Korpus und Fronten **Egger Dekorspanplatte 19 mm weiß**, Kanten ABS 1 mm.
> **4 Drehtüren** mit Topfscharnieren, **2 Schubkästen** auf Systemauszügen, Kleiderstange, je Fach 2 Einlegeböden, Sockel 100 mm, Rückwand.
> **Lieferung und Montage** beim Kunden, 20 km entfernt, Neubau, gerade Wände.

Darunter: *Genau diese fünf Dinge braucht CraftFlow immer: Möbelart, Maße, Material, Ausstattung, Montage.*

Dann die Frage **„Was nimmst du für so einen Schrank, netto?"** mit den fünf Bändern aus `BAENDER.grund`.

Darunter, sichtbar und nicht im Kleingedruckten: **„Diese Angabe sieht niemand außer dir."**

- [ ] **Schritt 4: Schritt 7 anlegen — die drei Differenzfragen**

Die Beschreibung des Grundmöbels bleibt oben verkürzt sichtbar („Derselbe Schrank …"), damit sich die Fragen sichtbar darauf beziehen.

Drei Fragen mit den Bändern aus `BAENDER.lack`, `BAENDER.massiv`, `BAENDER.montage` — **jeweils inklusive der beiden zusätzlichen Türen** `mache ich nicht` und `weiß ich gerade nicht`.

Unter „weiß ich gerade nicht" steht — **solange es die Lernschleife nicht gibt** — genau dieser Text:

> „Dann rechne ich hier mit dem Branchenwert. Du kannst es jederzeit unter Einstellungen nachtragen."

**Nicht** „ich lerne es aus deinen Angeboten". Das wäre ein Versprechen, das CraftFlow nicht halten kann.

- [ ] **Schritt 5: Speichern beim Abschluss**

Dort, wo heute `onboarding_abgeschlossen` gesetzt wird (Zeile ~2182), zusätzlich:

```typescript
    fetch('/api/settings/kalibrierung', { method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(kalib) }).catch(e => console.error('[onboarding] Kalibrierung', e))
```

Feuere-und-vergiss wie beim Profil: Ein Speicherfehler darf das Onboarding nicht blockieren.

- [ ] **Schritt 6: Überspringen**

Der bestehende Weg bleibt. Wird übersprungen, wird **nichts** gespeichert — alle Faktoren bleiben 1,0. Der Hinweis dazu: *„Dann rechne ich mit Branchenwerten. Das kann für deinen Betrieb daneben liegen — du kannst es jederzeit unter Einstellungen → Mein Betrieb nachholen."*

- [ ] **Schritt 7: Von Hand prüfen (dev-Vorschau)**

- [ ] Acht Schritte, nicht neun, nicht sieben
- [ ] Jede Antwort lässt sich anklicken und bleibt sichtbar markiert
- [ ] Nach dem Abschluss liefert `GET /api/settings/kalibrierung` die Antworten und vier Faktoren
- [ ] Überspringen erzeugt **keinen** Datensatz
- [ ] „weiß ich gerade nicht" verspricht nichts

- [ ] **Schritt 8: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(kalibrierung): Erst-Anmeldung stellt ein, statt zu erklaeren"
```

---

### Task 8: Einstellungen-Reiter „Mein Betrieb"

**Files:**
- Create: `src/components/settings/BetriebSettings.tsx`
- Modify: `src/app/settings/page.tsx` (Reiterliste ~Zeile 438, Einbindung ~Zeile 1114)

**Interfaces:**
- Consumes: `GET`/`PUT /api/settings/kalibrierung`, `BAENDER`
- Produces: nichts

Muster: `src/components/settings/MaterialpreiseSettings.tsx` — gleiche Struktur, gleiche Ladelogik.

- [ ] **Schritt 1: Komponente schreiben**

Zeigt dieselben neun Fragen wie das Onboarding, vorbelegt mit den gespeicherten Antworten, plus die vier abgeleiteten Faktoren **in Klartext**:

> **Werkstatt 0,78** — ich rechne deine Werkstattzeiten 22 % knapper als den Branchenrichtwert, weil du es so kalibriert hast.
> **Oberfläche 1,00** — noch nicht kalibriert, ich rechne mit dem Branchenwert.

Jeder Faktor ist von Hand überschreibbar (Zahlenfeld, 0,6 bis 1,4). Wer von Hand ändert, überschreibt die Ableitung — das steht als Satz darunter.

- [ ] **Schritt 2: Reiter einhängen**

In `src/app/settings/page.tsx` in die Reiterliste, **vor** `kostenstellen`, weil er die Grundeinstellung ist:

```typescript
    { id: 'betrieb',          label: 'Mein Betrieb',    icon: '🏗' },
```
und in den Inhalt: `{section === 'betrieb' && <BetriebSettings />}`

- [ ] **Schritt 3: Deckungshinweis**

Sobald `faktor_werkstatt` gesetzt ist, wird der daraus folgende Mischstundensatz gezeigt — genau einmal, gesteuert über `hinweis_gezeigt`:

> „Aus deiner Angabe ergibt sich ein Stundensatz von 52 €. Der Branchenwert liegt bei 65–90 €. Ich rechne mit deinem Wert — wollte es dir nur einmal gesagt haben."

Der Hinweis blockiert nichts und erscheint kein zweites Mal.

- [ ] **Schritt 4: Von Hand prüfen**

- [ ] Reiter erscheint, Antworten sind vorbelegt
- [ ] Ändern und speichern rechnet die Faktoren neu
- [ ] Ein von Hand gesetzter Faktor bleibt nach dem Neuladen stehen
- [ ] Der Deckungshinweis erscheint genau einmal
- [ ] Ein zweites Konto sieht davon nichts

- [ ] **Schritt 5: Commit**

```bash
git add src/components/settings/BetriebSettings.tsx src/app/settings/page.tsx
git commit -m "feat(kalibrierung): Einstellungen-Reiter Mein Betrieb"
```

---

### Task 9: Einstieg vom Ergebnis aus und die Hilfe

**Files:**
- Modify: `src/app/page.tsx` (unter der Kalkulationsübersicht)
- Modify: `src/app/api/assistant/route.ts` (Wissensbasis)

**Interfaces:**
- Consumes: `GET /api/settings/kalibrierung`
- Produces: nichts

Das ist die Stelle, an der Fabians abgesprungener Kunde die App geschlossen hat. Hier bekommt er stattdessen einen Ausweg.

- [ ] **Schritt 1: Einstieg unter der Kalkulation**

Nur sichtbar, wenn **nicht** kalibriert wurde (`GET` liefert `null` oder `abgeschlossen: false`):

> **Passt der Preis nicht zu deinem Betrieb?**
> Beantworte neun kurze Fragen — dann rechne ich mit deinen Werten statt mit Branchenwerten.
> *[Jetzt einrichten]* → führt zu *Einstellungen → Mein Betrieb*

- [ ] **Schritt 2: Die Hilfe lernt zwei Fragen**

In `src/app/api/assistant/route.ts` in die Wissensbasis, im Stil der vorhandenen Einträge („Frage: … → …"):

```
Frage: Warum ist der Preis so hoch?
→ Der Preis ist Material plus Minuten mal Stundensatz — sonst nichts.
→ Zwei Stellschrauben: die Stundensätze (Einstellungen → Kostenstellen) und die
  Zeiten deines Betriebs (Einstellungen → Mein Betrieb).
→ Unter "Mein Betrieb" beantwortest du neun kurze Fragen, danach rechnet CraftFlow
  mit deinen Werten statt mit Branchenwerten.

Frage: Was ist der Zeitfaktor?
→ Er sagt, wie deine Zeiten zum Branchenrichtwert stehen. 0,80 heißt: CraftFlow
  rechnet 20 % knapper, weil du es so kalibriert hast.
→ Es gibt vier davon: Werkstatt, Oberfläche, Massivholz, Montage.
→ Zu sehen und zu ändern unter Einstellungen → Mein Betrieb.
```

- [ ] **Schritt 3: Von Hand prüfen**

- [ ] Der Einstieg erscheint bei einem nicht kalibrierten Konto und verschwindet danach
- [ ] Die Hilfe beantwortet „Warum ist der Preis so hoch?" und führt zu *Mein Betrieb*

- [ ] **Schritt 4: Commit**

```bash
git add src/app/page.tsx src/app/api/assistant/route.ts
git commit -m "feat(kalibrierung): Einstieg vom Ergebnis aus, Hilfe kennt die Preisfrage"
```

---

## Abnahme — die Prüfkriterien der Spec

Erst wenn diese Punkte belegt sind, geht etwas an Fabian zur Freigabe. Gemessen wird auf der dev-Vorschau, nicht geschätzt.

- [ ] Ein Solo-Betrieb ohne Maschinen bekommt für **jedes** der vier Referenzszenarien einen Preis innerhalb des von ihm gewählten Bandes. Das ist die Selbstprobe: Wer den Faktor aus einer Rechnung ableitet, muss dieselbe Rechnung damit auch treffen.
- [ ] Derselbe Betrieb bekommt für den Rollcontainer aus dem Testangebot einen Preis deutlich unter 1.100 € — nachgerechnet, nicht geschätzt.
- [ ] Wer CNC abschaltet, verliert **keine** Minuten: Bei sonst gleichen Einstellungen sinkt die Summe der Arbeitszeit nicht, sie verschiebt sich zur Handarbeit und steigt dort leicht. Ohne Zeitfaktor gemessen.
- [ ] Alle vier Faktoren sind in den Einstellungen sichtbar, in Klartext erklärt und von Hand änderbar.
- [ ] Jeder Faktor bleibt zwischen 0,6 und 1,4, auch bei extremen Antworten.
- [ ] Überspringen führt zu einer lauffähigen Kalkulation mit Branchenwerten und einem sichtbaren Hinweis.
- [ ] Die Musterbeschreibung ist als Vorlage erkennbar, die fünf Pflichtangaben sind hervorgehoben.
- [ ] Ein zweites Konto sieht die Kalibrierung des ersten nicht.
- [ ] Der Deckungshinweis erscheint genau einmal und blockiert nichts.
- [ ] Die Fixkosten-Minima je Position werden vom Zeitfaktor **nicht** verändert.
- [ ] Beim ersten Start erscheint **eine** Einführung, acht Schritte.
- [ ] Wer die Erst-Anmeldung durchläuft, hat danach echte Werte in den Einstellungen stehen.
- [ ] Der Hilfe-Assistent beantwortet „Warum ist der Preis so hoch?".
- [ ] „Mache ich nicht" lässt den Branchenwert stehen und wird nicht erneut gefragt.
- [ ] „Weiß ich gerade nicht" lässt den Faktor auf 1,0 und verspricht **nichts**.
- [ ] Kein Faktor entsteht aus einer nicht beantworteten Frage.
- [ ] Fabians Vorbehalt, ausdrücklich: „wenn es genau so funktioniert" — der Faktor ist an echten Zahlen nachgerechnet, der Rechenweg liegt als Testskript vor, nicht nur im Kopf.

---

## Umsetzungsstand (2026-09-07 vormittags)

Alle neun Aufgaben sind gebaut, dazu die Lernschleife. `dev` = `bf8212c`,
`main` unberührt. **166 Tests grün**, `npx tsc --noEmit` sauber, keine neuen
eslint-Meldungen in irgendeiner berührten Datei (jeweils gegen den Stand davor
verglichen).

| Aufgabe | Stand |
|---|---|
| 1 · Tabelle und Rechte | Datei liegt bereit — **muss Fabian im Supabase-Dashboard ausführen** |
| 2 · Rechenbibliothek | fertig, 13 Tests |
| 3 · Speicher und Schnittstelle | fertig |
| 4 · Faktoren in der Analyse | fertig, 9 Tests |
| 5 · Faktoren in der Optimierung | fertig |
| 6 · Handarbeit statt Löschen | fertig, 8 Tests |
| 7 · Erst-Anmeldung, acht Schritte | fertig |
| 8 · Reiter „Mein Betrieb" | fertig |
| 9 · Einstieg vom Ergebnis, Hilfe | fertig |
| + · Lernschleife | fertig, 18 Tests |

### Zwei Entscheidungen, die beim Bauen fielen

**Die Faktorformel musste entschärft werden.** Fiel die ganze Differenz allein auf den
Werkstattblock, sprang der Faktor zwischen benachbarten Bändern um 0,46 — jedes Band
wäre ein Sprung ins Extrem gewesen. Die Differenz fällt jetzt auf alle skalierbare
Arbeitszeit (Werkstatt + Montage). Ohne eigene Montage-Antwort erbt die Montage die
Geschwindigkeit des Betriebs; eine eigene Antwort überschreibt das.

**Die Lernschleife braucht keine neue Tabelle.** Die frühe Fassung eines Angebots
liegt bereits in `offer_versions` (Version 1), der Endstand in `projects.data`, der
Status ebenda. Das war beim Schreiben des Plans noch nicht klar.

### Was aussteht

1. **Das SQL ausführen.** Ohne die Tabelle speichert die Kalibrierung nichts. Alles
   andere läuft weiter, nur mit Branchenwerten — die Faktoren bleiben auf 1,0.
2. **Der Live-Test.** Die Abnahmeliste oben ist noch nicht abgearbeitet; geprüft sind
   bisher nur Typen, Lint und die 166 Tests.
3. ~~Der Referenzpreis liegt über Fabians Faustregel.~~ **Zurückgenommen am
   2026-09-07.** Die Sorge beruhte auf einer falsch gelesenen Faustregel: In der
   Wissensbasis steht „600–1.000 €/lfm netto (inkl. Montage)", Fabian rechnet aber
   mit **rund 2.000 € für 2 lfm OHNE Montage**.

   Nachgerechnet am gemessenen Angebot:

   | | |
   |---|---|
   | CraftFlow nach dem Laufmeter-Fix | 2.315 € |
   | davon Montage + Lieferung (240 + 70 min à 65 €/h) | − 336 € |
   | **ohne Montage** | **1.979 €** |
   | **Fabians Faustregel** | **~2.000 €** |

   Eine Abweichung von einem Prozent. Die hinterlegte Referenz liegt ohne Montage bei
   1.909 €, ebenfalls im Rahmen. **Die Basis stimmt.**

   Damit passen auch die Antwortbänder: Ein Betrieb, der wie Fabian kalkuliert, landet
   inklusive Montage bei rund 2.300 € — im Band „2.100–2.700". Die zwei untersten
   Bänder stehen für deutlich billigere Betriebe; dass die in die Deckelung laufen,
   ist gewollt.

   **Für die Wissensbasis:** Die Faustregel in der Projekt-`CLAUDE.md` ist
   missverständlich. „600–1.000 €/lfm netto (inkl. Montage)" gegen „2.000 € für 2 lfm
   ohne Montage" sind zwei verschiedene Aussagen. Gehört bereinigt.
