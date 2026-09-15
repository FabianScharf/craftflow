# Pläne und Deckel (Teil A) + Website-Preise (Teil D) — Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Jeder Plan (Solo, Starter, Pro, Enterprise) bekommt genau die Funktionen und Deckel aus der Plan-Matrix, serverseitig durchgesetzt, aus einer einzigen Quelle — und die Website zeigt dieselbe Matrix mit Nettopreisen.

**Architecture:** Eine reine Datendatei `src/lib/plaene.ts` (Matrix, Preis-IDs, Deckel-Logik) speist alles: den Browser-Hook `usePlan`, die Sperr-Kästen, die Einstellungen, den Hilfe-Assistenten, den Stripe-Webhook und einen Server-Helfer `src/lib/planpruefung.ts`, der in jeder betroffenen API-Route den effektiven Plan lädt und Funktionen bzw. Deckel prüft. Deckel wirken **beim Lesen** (`wendeDeckelAn`: die ältesten N bleiben aktiv, der Rest wird als „inaktiv durch Plan“ markiert), nie per Massenänderung in der Datenbank. Die Website bekommt eine Kopie der Matrix als JSON; ein Test in diesem Repo prüft die Gleichheit, wenn das Nachbar-Repo vorhanden ist.

**Tech Stack:** Next.js (App Router), TypeScript, Supabase (Postgres + RLS), Stripe, Node 24 Test-Runner (`npm run test`, führt `.ts` direkt aus — Dateien unter `src/lib/` dürfen für die Tests **nichts** importieren, was Supabase oder React braucht).

**Spec:** `docs/superpowers/specs/2026-09-15-plaene-kosten-grosse-projekte-design.md` (Abschnitte 3, 4A, 4D, 6)

## Global Constraints

- Plan-Matrix exakt wie in der Spec, Abschnitt 3 (Zahlen unten in Task 1 wiederholt).
- Preise sind **netto**; überall „zzgl. MwSt.“ und „ausschließlich für Unternehmen“.
- Regel beim Wechsel nach unten: **die ältesten N bleiben aktiv, alle weiteren inaktiv; nichts wird gelöscht; Upgrade schaltet alles wieder ein.** Wirkt beim Lesen.
- Testphase (14 Tage) = Enterprise. Gutschein setzt `betriebsprofil.plan` direkt.
- Der Browser ist nie die Instanz: jede Sperre und jeder Deckel wird in der API-Route geprüft. Der Browser zeigt nur, was der Server ohnehin durchsetzt.
- Jede Ablehnung nennt den Plan, der sie hebt: JSON `{ error: '…', minPlan: 'pro' }` mit Status 403.
- Kostenzahlen (Token, Dollar) erscheinen **nie** in einer API-Antwort oder der Oberfläche (Spec Teil B).
- UI-Texte deutsch. Keine neuen festen Farben — nur `C.*` und `akzentTon()`/`ton()` (siehe CLAUDE.md „Farben / CI“).
- Arbeiten auf Branch `dev`. Nichts auf `main` ohne Fabians Freigabe.
- Live-Tests gegen die dev-Vorschau kosten Geld (KI-Aufrufe) — nur wo nötig, keine Wiederholungen aus Bequemlichkeit.

---

## Dateiübersicht

| Datei | Verantwortung |
|---|---|
| `src/lib/plaene.ts` (neu) | Matrix, Preis-IDs (beide Sätze), `PLAN_RANK`, `erlaubt()`, `deckel()`, `wendeDeckelAn()`, `effektiverPlan()`, `planFuerPreisId()`, `merkmaleFuerAnzeige()` |
| `tests/plaene.test.mjs` (neu) | Jede Zahl der Matrix, Monotonie, Deckel-Logik, Preis-Zuordnung |
| `src/lib/planpruefung.ts` (neu) | Server: `ladeEffektivenPlan(supabase, userId)`, `pruefeFunktion(...)`, `pruefeDeckel(...)` |
| `src/hooks/usePlan.ts` | liest Rank, Limits, Features aus `plaene.ts`; `effectivePlan` über `effektiverPlan()` |
| `src/app/api/usage/route.ts` | Limit aus `plaene.ts` |
| `src/app/api/stripe/webhook/route.ts` | `planFuerPreisId()` statt eigener Tabelle (**behebt: Kauf über Einstellungen landete auf Solo**) |
| `src/lib/bauweise.ts`, `src/app/api/settings/bauweise/route.ts` | Deckel Regeln (lesen + anlegen) |
| `src/lib/preisspeicher.ts`, `src/app/api/settings/materialpreise/route.ts` | Deckel Materialpreise |
| `src/lib/kalibrierungsspeicher.ts` | `ladeFaktoren` liefert Standard, wenn Plan keine Kalibrierung erlaubt |
| `src/app/api/optimize/route.ts`, `docs/sql/2026-09-16-plan-deckel.sql` | Deckel Optimieren-Runden je Projekt |
| `src/app/api/analyze/route.ts` | Deckel Dateien je Projekt |
| `src/app/api/lernschleife/route.ts`, `analytics`, `settings/email-config`, `settings/kalibrierung`, `settings/suppliers`, `suppliers/inquiry`, `suppliers/inquiry/send`, `gaeb/import` | Funktionssperren |
| `src/lib/pdfoptionen.ts` | Solo → Standardlayout |
| `src/app/settings/page.tsx`, `src/components/settings/BauweiseSettings.tsx`, `MaterialpreiseSettings.tsx`, `BetriebSettings.tsx`, `src/components/PlanGate.tsx`, `UpgradeHint.tsx`, `src/app/page.tsx` | Anzeige: Sperr-Kästen, Zähler „3 von 5“, ausgegraute Einträge, Plan-Kacheln |
| `src/lib/assistentwissen.ts` | Plan-Hinweise aus `plaene.ts` |
| `~/craftflow-web/lib/plaene.json`, `~/craftflow-web/app/page.tsx` | Website-Preise aus der Matrix, Netto-Hinweis, FAQ |
| `tests/plaene-website.test.mjs` (neu) | Gleichheit Matrix ↔ Website-JSON |
| `CLAUDE.md`, Vault | Regeln festhalten |

---

### Task 1: Die eine Quelle — `src/lib/plaene.ts`

**Files:**
- Create: `src/lib/plaene.ts`
- Test: `tests/plaene.test.mjs`

**Interfaces:**
- Produces:
  - `type Plan = 'solo' | 'starter' | 'pro' | 'enterprise'`
  - `type Funktion = 'spracheingabe' | 'pdf' | 'assistent' | 'dateien' | 'bloecke' | 'ausschreibung' | 'kalibrierung' | 'bauweise' | 'lernschleife' | 'materialpreise' | 'gestaltung' | 'lieferanten' | 'internetsuche' | 'auswertung' | 'smtp' | 'export' | 'gaeb'`
  - `type DeckelArt = 'angebote' | 'optimierenRunden' | 'dateien' | 'bauweiseRegeln' | 'materialpreise' | 'nutzer'`
  - `PLAN_RANK: Record<Plan, number>`, `PLAENE: Record<Plan, PlanDefinition>`
  - `erlaubt(plan: Plan, f: Funktion): boolean`
  - `mindestPlan(f: Funktion): Plan`
  - `deckel(plan: Plan, art: DeckelArt): number | null` (null = unbegrenzt)
  - `wendeDeckelAn<T extends { created_at: string }>(eintraege: T[], grenze: number | null): Array<T & { aktivDurchPlan: boolean }>`
  - `effektiverPlan(profil: { plan?: string | null; trial_starts_at?: string | null }, jetzt?: Date): Plan`
  - `planFuerPreisId(priceId: string): Plan | null`
  - `PREIS_IDS: Record<Plan, string>` (aktueller Satz für den Kauf)
  - `merkmaleFuerAnzeige(plan: Plan): string[]` (Sätze für Plan-Kacheln und Website)
  - `TRIAL_DAYS = 14`

- [ ] **Step 1: Test schreiben**

```js
// tests/plaene.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  PLAENE, PLAN_RANK, PREIS_IDS, erlaubt, mindestPlan, deckel, wendeDeckelAn,
  effektiverPlan, planFuerPreisId, merkmaleFuerAnzeige, TRIAL_DAYS,
} from '../src/lib/plaene.ts'

// Die Matrix aus der Spec (Abschnitt 3), Zahl für Zahl. Wer hier etwas ändert,
// ändert Fabians Preisliste — bewusst, nicht nebenbei.
test('Angebote pro Monat: 3 / 15 / 50 / Fair Use 150', () => {
  assert.equal(deckel('solo', 'angebote'), 3)
  assert.equal(deckel('starter', 'angebote'), 15)
  assert.equal(deckel('pro', 'angebote'), 50)
  assert.equal(deckel('enterprise', 'angebote'), 150)
})
test('Optimieren-Runden je Angebot: 5 / 10 / 20 / 40', () => {
  assert.deepEqual(['solo','starter','pro','enterprise'].map(p => deckel(p, 'optimierenRunden')), [5, 10, 20, 40])
})
test('Dateien je Projekt: 0 / 5 / 25 / 60', () => {
  assert.deepEqual(['solo','starter','pro','enterprise'].map(p => deckel(p, 'dateien')), [0, 5, 25, 60])
})
test('Bauweise-Regeln: 0 / 5 / unbegrenzt / unbegrenzt', () => {
  assert.deepEqual(['solo','starter','pro','enterprise'].map(p => deckel(p, 'bauweiseRegeln')), [0, 5, null, null])
})
test('Materialpreise: 0 / 20 / unbegrenzt / unbegrenzt', () => {
  assert.deepEqual(['solo','starter','pro','enterprise'].map(p => deckel(p, 'materialpreise')), [0, 20, null, null])
})
test('Nutzer: 1 / 1 / 3 / unbegrenzt', () => {
  assert.deepEqual(['solo','starter','pro','enterprise'].map(p => deckel(p, 'nutzer')), [1, 1, 3, null])
})
test('Funktionen je Plan (Spec-Matrix)', () => {
  const f = (p) => ['dateien','bloecke','ausschreibung','kalibrierung','bauweise','lernschleife','materialpreise','gestaltung','lieferanten','internetsuche','auswertung','smtp','export','gaeb'].filter(x => erlaubt(p, x))
  assert.deepEqual(f('solo'), [])
  assert.deepEqual(f('starter'), ['dateien','kalibrierung','bauweise','materialpreise','gestaltung','lieferanten','export'])
  assert.deepEqual(f('pro'), ['dateien','bloecke','kalibrierung','bauweise','lernschleife','materialpreise','gestaltung','lieferanten','auswertung','smtp','export'])
  assert.deepEqual(f('enterprise'), ['dateien','bloecke','ausschreibung','kalibrierung','bauweise','lernschleife','materialpreise','gestaltung','lieferanten','internetsuche','auswertung','smtp','export','gaeb'])
  for (const p of ['solo','starter','pro','enterprise']) for (const x of ['spracheingabe','pdf','assistent']) assert.ok(erlaubt(p, x), `${p} ${x}`)
})
test('mindestPlan nennt den ersten Plan, der die Funktion hat', () => {
  assert.equal(mindestPlan('dateien'), 'starter')
  assert.equal(mindestPlan('lernschleife'), 'pro')
  assert.equal(mindestPlan('gaeb'), 'enterprise')
  assert.equal(mindestPlan('pdf'), 'solo')
})
test('Monotonie: kein höherer Plan hat weniger als ein niedrigerer', () => {
  const reihe = ['solo','starter','pro','enterprise']
  for (const art of ['angebote','optimierenRunden','dateien','bauweiseRegeln','materialpreise','nutzer']) {
    let vorher = -1
    for (const p of reihe) {
      const d = deckel(p, art); const wert = d === null ? Infinity : d
      assert.ok(wert >= vorher, `${art}: ${p} (${d}) kleiner als Vorgänger`)
      vorher = wert
    }
  }
  for (let i = 1; i < reihe.length; i++) assert.ok(PLAN_RANK[reihe[i]] > PLAN_RANK[reihe[i-1]])
})
test('wendeDeckelAn: die ältesten N bleiben aktiv, der Rest wird inaktiv — nichts fällt weg', () => {
  const e = [
    { id: 'c', created_at: '2026-09-03T00:00:00Z' },
    { id: 'a', created_at: '2026-09-01T00:00:00Z' },
    { id: 'b', created_at: '2026-09-02T00:00:00Z' },
  ]
  const r = wendeDeckelAn(e, 2)
  assert.equal(r.length, 3)
  assert.deepEqual(r.map(x => [x.id, x.aktivDurchPlan]), [['c', false], ['a', true], ['b', true]], 'Reihenfolge der Eingabe bleibt erhalten')
  assert.ok(wendeDeckelAn(e, null).every(x => x.aktivDurchPlan), 'null = unbegrenzt')
  assert.ok(wendeDeckelAn(e, 0).every(x => !x.aktivDurchPlan), '0 = alle inaktiv')
})
test('effektiverPlan: Testphase = Enterprise, danach gespeicherter Plan, Standard Solo', () => {
  const jetzt = new Date('2026-09-15T12:00:00Z')
  assert.equal(effektiverPlan({ plan: 'starter', trial_starts_at: '2026-09-10T00:00:00Z' }, jetzt), 'enterprise')
  assert.equal(effektiverPlan({ plan: 'starter', trial_starts_at: '2026-08-01T00:00:00Z' }, jetzt), 'starter')
  assert.equal(effektiverPlan({ plan: null, trial_starts_at: null }, jetzt), 'solo')
  assert.equal(effektiverPlan({ plan: 'unsinn', trial_starts_at: null }, jetzt), 'solo')
  assert.equal(TRIAL_DAYS, 14)
})
test('Preis-IDs: BEIDE Sätze werden erkannt (Kauf über Einstellungen landete auf Solo — 15.09.)', () => {
  assert.equal(planFuerPreisId('price_1Tn1y0RvozvhvO9J4QXMCzje'), 'pro')      // Einstellungen (aktuell)
  assert.equal(planFuerPreisId('price_1TmScSRvozvhvO9J0RF42acJ'), 'pro')      // älterer Satz
  assert.equal(planFuerPreisId('price_1Tn1xzRvozvhvO9JJ3og0R3w'), 'solo')
  assert.equal(planFuerPreisId('price_1Tn1y1RvozvhvO9JYlX8lp4z'), 'enterprise')
  assert.equal(planFuerPreisId('price_gibtsnicht'), null)
  assert.equal(PREIS_IDS.pro, 'price_1Tn1y0RvozvhvO9J4QXMCzje')
})
test('Preise netto: 7 / 29 / 49 / 79', () => {
  assert.deepEqual(['solo','starter','pro','enterprise'].map(p => PLAENE[p].preisNetto), [7, 29, 49, 79])
})
test('merkmaleFuerAnzeige nennt Deckel als Zahlen und nur Funktionen, die der Plan hat', () => {
  const solo = merkmaleFuerAnzeige('solo').join(' | ')
  assert.match(solo, /3 Angebote/); assert.match(solo, /5 Optimieren-Runden/); assert.doesNotMatch(solo, /Kalibrierung/)
  const pro = merkmaleFuerAnzeige('pro').join(' | ')
  assert.match(pro, /50 Angebote/); assert.match(pro, /Große Projekte/); assert.match(pro, /Lernschleife/); assert.match(pro, /3 Nutzer/)
  assert.match(merkmaleFuerAnzeige('enterprise').join(' | '), /Fair Use/)
})
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `node --test tests/plaene.test.mjs`
Expected: FAIL, „Cannot find module … plaene.ts“

- [ ] **Step 3: Implementierung**

```ts
// src/lib/plaene.ts
// DIE Quelle für Pläne, Deckel und Funktionen. Alles andere liest hier.
//
// ANLASS (2026-09-15): Nach dem Sommer-Update hatte jeder Plan alle Funktionen, nur die
// Angebote je Monat waren gedeckelt — und die standen an drei Stellen im Code. Der
// Stripe-Webhook kannte zudem nur den alten Preis-Satz: ein Kauf über die
// Einstellungen (neuer Satz) wäre auf Solo gelandet.
//
// Reine Daten und Funktionen ohne Importe — `npm run test` führt sie direkt aus.
// Die Zahlen sind Fabians Preisliste (Spec 2026-09-15, Abschnitt 3). Wer sie ändert,
// ändert tests/plaene.test.mjs mit — bewusst, nicht nebenbei.

export type Plan = 'solo' | 'starter' | 'pro' | 'enterprise'
export const PLAN_REIHE: Plan[] = ['solo', 'starter', 'pro', 'enterprise']
export const PLAN_RANK: Record<Plan, number> = { solo: 1, starter: 2, pro: 3, enterprise: 4 }
export const PLAN_LABELS: Record<Plan, string> = { solo: 'Solo', starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise' }
export const TRIAL_DAYS = 14

export type Funktion =
  | 'spracheingabe' | 'pdf' | 'assistent'          // jeder Plan
  | 'dateien' | 'export' | 'kalibrierung' | 'bauweise' | 'materialpreise' | 'gestaltung' | 'lieferanten'  // ab Starter
  | 'bloecke' | 'lernschleife' | 'auswertung' | 'smtp'   // ab Pro
  | 'ausschreibung' | 'internetsuche' | 'gaeb'          // Enterprise

export type DeckelArt = 'angebote' | 'optimierenRunden' | 'dateien' | 'bauweiseRegeln' | 'materialpreise' | 'nutzer'

export type PlanDefinition = {
  preisNetto: number
  untertitel: string
  deckel: Record<DeckelArt, number | null>   // null = unbegrenzt
  funktionen: Funktion[]
}

const BASIS: Funktion[] = ['spracheingabe', 'pdf', 'assistent']
const STARTER: Funktion[] = [...BASIS, 'dateien', 'export', 'kalibrierung', 'bauweise', 'materialpreise', 'gestaltung', 'lieferanten']
const PRO: Funktion[] = [...STARTER, 'bloecke', 'lernschleife', 'auswertung', 'smtp']
const ENTERPRISE: Funktion[] = [...PRO, 'ausschreibung', 'internetsuche', 'gaeb']

export const PLAENE: Record<Plan, PlanDefinition> = {
  solo: {
    preisNetto: 7, untertitel: 'Für Einzelkämpfer',
    deckel: { angebote: 3, optimierenRunden: 5, dateien: 0, bauweiseRegeln: 0, materialpreise: 0, nutzer: 1 },
    funktionen: BASIS,
  },
  starter: {
    preisNetto: 29, untertitel: 'Für kleine Betriebe',
    deckel: { angebote: 15, optimierenRunden: 10, dateien: 5, bauweiseRegeln: 5, materialpreise: 20, nutzer: 1 },
    funktionen: STARTER,
  },
  pro: {
    preisNetto: 49, untertitel: 'Mein eigener Kalkulator',
    deckel: { angebote: 50, optimierenRunden: 20, dateien: 25, bauweiseRegeln: null, materialpreise: null, nutzer: 3 },
    funktionen: PRO,
  },
  enterprise: {
    preisNetto: 79, untertitel: 'Ausschreibungen und große Betriebe',
    deckel: { angebote: 150, optimierenRunden: 40, dateien: 60, bauweiseRegeln: null, materialpreise: null, nutzer: null },
    funktionen: ENTERPRISE,
  },
}

/** Aktueller Preis-Satz in Stripe (Einstellungen → „Mein Plan"). */
export const PREIS_IDS: Record<Plan, string> = {
  solo: 'price_1Tn1xzRvozvhvO9JJ3og0R3w',
  starter: 'price_1Tn1y0RvozvhvO9JK7pRRRht',
  pro: 'price_1Tn1y0RvozvhvO9J4QXMCzje',
  enterprise: 'price_1Tn1y1RvozvhvO9JYlX8lp4z',
}
/** Älterer Satz — noch gültig in Stripe, könnte in laufenden Abos stecken. */
const PREIS_IDS_ALT: Record<string, Plan> = {
  price_1TmSblRvozvhvO9J3EKljmMh: 'solo',
  price_1TmScDRvozvhvO9J9tvsywrG: 'starter',
  price_1TmScSRvozvhvO9J0RF42acJ: 'pro',
  price_1TmSchRvozvhvO9JOduoM8KU: 'enterprise',
}

export function planFuerPreisId(priceId: string): Plan | null {
  for (const p of PLAN_REIHE) if (PREIS_IDS[p] === priceId) return p
  return PREIS_IDS_ALT[priceId] ?? null
}

export function istPlan(v: unknown): v is Plan {
  return typeof v === 'string' && (PLAN_REIHE as string[]).includes(v)
}

export function erlaubt(plan: Plan, f: Funktion): boolean {
  return PLAENE[plan].funktionen.includes(f)
}

export function mindestPlan(f: Funktion): Plan {
  return PLAN_REIHE.find(p => erlaubt(p, f)) ?? 'enterprise'
}

export function deckel(plan: Plan, art: DeckelArt): number | null {
  return PLAENE[plan].deckel[art]
}

/**
 * Regel beim Wechsel nach unten (Fabian, 15.09.): Die ältesten N bleiben aktiv, alle
 * weiteren werden inaktiv gestellt. Nichts wird gelöscht. Wird BEIM LESEN angewandt —
 * ein Upgrade wirkt sofort, ohne Skript. Reihenfolge der Eingabe bleibt erhalten.
 */
export function wendeDeckelAn<T extends { created_at: string }>(
  eintraege: T[], grenze: number | null,
): Array<T & { aktivDurchPlan: boolean }> {
  if (grenze === null) return eintraege.map(e => ({ ...e, aktivDurchPlan: true }))
  const erlaubte = new Set(
    [...eintraege].sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(0, Math.max(0, grenze)),
  )
  return eintraege.map(e => ({ ...e, aktivDurchPlan: erlaubte.has(e) }))
}

/** Testphase = Enterprise (exakte Zeitgrenze wie in /api/usage), sonst gespeicherter Plan, sonst Solo. */
export function effektiverPlan(
  profil: { plan?: string | null; trial_starts_at?: string | null } | null | undefined,
  jetzt: Date = new Date(),
): Plan {
  const start = profil?.trial_starts_at ? new Date(profil.trial_starts_at).getTime() : NaN
  if (Number.isFinite(start) && jetzt.getTime() < start + TRIAL_DAYS * 86400_000) return 'enterprise'
  return istPlan(profil?.plan) ? profil!.plan as Plan : 'solo'
}

/** Sätze für Plan-Kacheln (App) und Preistabelle (Website) — eine Wortwahl für beide. */
export function merkmaleFuerAnzeige(plan: Plan): string[] {
  const d = PLAENE[plan].deckel
  const z = (n: number | null, einzahl: string, mehrzahl: string) =>
    n === null ? `${mehrzahl} unbegrenzt` : `${n} ${n === 1 ? einzahl : mehrzahl}`
  const zeilen: string[] = [
    plan === 'enterprise' ? `Fair Use: ${d.angebote} Angebote pro Monat` : `${d.angebote} Angebote pro Monat`,
    `${d.optimierenRunden} Optimieren-Runden je Angebot`,
    d.dateien === 0 ? 'Ohne Datei-Upload' : `${d.dateien} Dateien je Projekt (Fotos, PDFs)`,
    'Spracheingabe, KI-Kalkulation, PDF-Angebot, Hilfe-Assistent',
  ]
  if (erlaubt(plan, 'bloecke')) zeilen.push('Große Projekte in Blöcken')
  if (erlaubt(plan, 'ausschreibung')) zeilen.push('Ausschreibungs-Modus (GAEB, Stapel)')
  if (erlaubt(plan, 'kalibrierung')) zeilen.push('Betriebskalibrierung')
  if (erlaubt(plan, 'bauweise')) zeilen.push(z(d.bauweiseRegeln, 'Bauweise-Regel', 'Bauweise-Regeln'))
  if (erlaubt(plan, 'lernschleife')) zeilen.push('Lernschleife aus gewonnenen Angeboten')
  if (erlaubt(plan, 'materialpreise')) zeilen.push(z(d.materialpreise, 'Materialpreis', 'Materialpreise'))
  zeilen.push(erlaubt(plan, 'gestaltung') ? 'Textbausteine, Briefpapier, Schriftwahl, CI-Farben' : 'Standardlayout fürs Angebot')
  if (erlaubt(plan, 'lieferanten')) zeilen.push(erlaubt(plan, 'internetsuche') ? 'Lieferanten und Anfragen, mit Internet-Suche' : 'Lieferanten und Anfragen')
  if (erlaubt(plan, 'auswertung')) zeilen.push('Auswertung')
  if (erlaubt(plan, 'smtp')) zeilen.push('Eigener Mailversand (SMTP)')
  zeilen.push(z(d.nutzer, 'Nutzer', 'Nutzer'))
  return zeilen
}
```

- [ ] **Step 4: Tests laufen lassen — müssen grün sein**

Run: `node --test tests/plaene.test.mjs`
Expected: 14 pass, 0 fail

- [ ] **Step 5: Commit**

```bash
git add src/lib/plaene.ts tests/plaene.test.mjs
git commit -m "feat(plaene): eine Quelle für Pläne, Deckel, Funktionen und Preis-IDs (beide Sätze)"
```

---

### Task 2: Webhook, Angebotszähler und Browser-Hook lesen aus `plaene.ts`

**Files:**
- Modify: `src/app/api/stripe/webhook/route.ts:6-11` (PRICE_PLAN), `:32`, `:43`
- Modify: `src/app/api/usage/route.ts:5-10` (PLAN_LIMITS), `:17-25` (isInTrial), `:36-37`, `:71-72`
- Modify: `src/hooks/usePlan.ts` (PLAN_RANK, PLAN_LIMITS_ANGEBOTE, PLAN_FEATURES, trialLaeuft)
- Modify: `src/components/UpgradeHint.tsx:4,16`

**Interfaces:**
- Consumes: `planFuerPreisId`, `deckel`, `effektiverPlan`, `erlaubt`, `mindestPlan`, `PLAN_RANK`, `PLAN_LABELS`, `TRIAL_DAYS` aus Task 1
- Produces: `usePlan()` liefert zusätzlich `deckel(art)` und `erlaubt(f)`; `effectivePlan` bleibt

- [ ] **Step 1: Webhook — Preis-Zuordnung aus der Quelle**

Ersetze in `src/app/api/stripe/webhook/route.ts` den Block `const PRICE_PLAN … }` durch `import { planFuerPreisId } from '@/lib/plaene'` und beide Vorkommen `PRICE_PLAN[sub.items.data[0]?.price.id] ?? 'solo'` durch:

```ts
const priceId = sub.items.data[0]?.price.id ?? ''
const plan = planFuerPreisId(priceId)
if (!plan) {
  // Unbekannter Preis: NICHT still auf Solo — das war der Fehler vom 15.09.
  console.error('[stripe] unbekannte Preis-ID im Abo:', priceId, 'user', userId)
  return NextResponse.json({ received: true, warnung: 'unbekannte Preis-ID' })
}
```

(Beim `checkout.session.completed`-Zweig steht `userId` in `session.metadata.userId` — prüfe die vorhandene Variable und verwende sie.)

- [ ] **Step 2: Angebotszähler — Limit und Testphase aus der Quelle**

In `src/app/api/usage/route.ts`: `PLAN_LIMITS`, `isInTrial` und den Import von `TRIAL_DAYS` entfernen; stattdessen `import { deckel, effektiverPlan } from '@/lib/plaene'`. Beide Stellen

```ts
const inTrial = isInTrial(profil?.trial_starts_at ?? null)
const plan = inTrial ? 'enterprise' : (profil?.plan ?? 'solo') as string
const limit: number | null = plan in PLAN_LIMITS ? PLAN_LIMITS[plan]! : 3
```
werden zu
```ts
const plan = effektiverPlan(profil)
const limit = deckel(plan, 'angebote')
```

Falls andere Dateien `PLAN_LIMITS` aus dieser Route importieren (`grep -rn "PLAN_LIMITS" src`): auf `deckel(plan, 'angebote')` umstellen.

- [ ] **Step 3: usePlan — Rank, Limits, Features aus der Quelle**

In `src/hooks/usePlan.ts`:
- `export type Plan` → `export type { Plan } from '@/lib/plaene'`; `PLAN_RANK`, `TRIAL_DAYS` importieren statt definieren.
- `PLAN_LIMITS_ANGEBOTE` löschen; `PLAN_FEATURES` löschen und ersetzen durch

```ts
import { PLAN_RANK, TRIAL_DAYS, effektiverPlan, erlaubt as planErlaubt, deckel as planDeckel, mindestPlan, PLAN_LABELS, type Plan, type Funktion, type DeckelArt } from '@/lib/plaene'
export { mindestPlan, PLAN_LABELS }
export type { Funktion, DeckelArt }
```
- `trialLaeuft` löschen; `effectivePlan` wird `effektiverPlan({ plan, trial_starts_at: trialStartsAt })`.
- Rückgabe erweitern: `erlaubt: (f: Funktion) => planErlaubt(effectivePlan, f)`, `deckel: (art: DeckelArt) => planDeckel(effectivePlan, art)`.
- `canUse(minPlan)` bleibt (wird noch an vielen Stellen benutzt).

- [ ] **Step 4: UpgradeHint — Label und Mindestplan aus der Quelle**

`UpgradeHint.tsx`: `PLAN_FEATURES[feature]` → `{ minPlan: mindestPlan(feature), label: LABEL[feature] }` mit einer kleinen Tabelle `LABEL: Record<Funktion, string>` in der Datei (z. B. `dateien: 'Bilder & PDFs hochladen'`, `lieferanten: 'Lieferantenanfrage'`, `smtp: 'Versand über eigene E-Mail'`, `gaeb: 'GAEB-Import'`). Alle Aufrufer von `<UpgradeHint feature="…">` (`grep -rn "UpgradeHint" src`) auf die neuen `Funktion`-Schlüssel umstellen (`bildUpload` → `dateien`, `gaebImport` → `gaeb`, `eigeneEmail` → `smtp`, `lieferantenAnfrage` → `lieferanten`, `kalkulationsexport` → `export`).

- [ ] **Step 5: Typprüfung, Tests**

Run: `npx tsc --noEmit -p tsconfig.json | grep -v "^.next/"` → keine Ausgabe. `npm run test` → alles grün.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/stripe/webhook/route.ts src/app/api/usage/route.ts src/hooks/usePlan.ts src/components/UpgradeHint.tsx src/app/page.tsx
git commit -m "fix(plaene): Webhook erkennt beide Preis-Sätze (Kauf landete auf Solo); Zähler und Hook lesen aus plaene.ts"
```

---

### Task 3: Server-Helfer `planpruefung.ts` und Funktionssperren in den Routen

**Files:**
- Create: `src/lib/planpruefung.ts`
- Modify: `src/app/api/lernschleife/route.ts` (GET, POST), `src/app/api/analytics/route.ts` (GET), `src/app/api/settings/email-config/route.ts` (PATCH), `src/app/api/settings/kalibrierung/route.ts` (PUT), `src/app/api/settings/suppliers/route.ts` (POST, PUT), `src/app/api/suppliers/inquiry/route.ts`, `src/app/api/suppliers/inquiry/send/route.ts`, `src/app/api/gaeb/import/route.ts`
- Test: `tests/planpruefung.test.mjs` (nur der reine Teil)

**Interfaces:**
- Produces:
  - `ladeEffektivenPlan(supabase, userId): Promise<Plan>`
  - `ablehnung(f: Funktion): { error: string; minPlan: Plan }` (rein)
  - `pruefeFunktion(supabase, userId, f): Promise<NextResponse | null>` — `null` = erlaubt; sonst fertige 403-Antwort
  - `deckelAblehnung(art: DeckelArt, plan: Plan, grenze: number): { error: string; minPlan: Plan | null }` (rein)

- [ ] **Step 1: Test für den reinen Teil**

```js
// tests/planpruefung.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ablehnung, deckelAblehnung } from '../src/lib/plantexte.ts'

test('Ablehnung nennt Funktion und den Plan, der sie hebt', () => {
  assert.deepEqual(ablehnung('lernschleife'), { error: 'Die Lernschleife ist ab dem Pro-Plan verfügbar.', minPlan: 'pro' })
  assert.deepEqual(ablehnung('gaeb'), { error: 'Der GAEB-Import ist ab dem Enterprise-Plan verfügbar.', minPlan: 'enterprise' })
})
test('Deckel-Ablehnung nennt Zahl, Plan und nächsten Plan', () => {
  assert.deepEqual(deckelAblehnung('bauweiseRegeln', 'starter', 5),
    { error: 'Im Starter-Plan sind 5 Bauweise-Regeln möglich. Ab dem Pro-Plan unbegrenzt.', minPlan: 'pro' })
  assert.deepEqual(deckelAblehnung('optimierenRunden', 'enterprise', 40),
    { error: 'Im Enterprise-Plan sind 40 Optimieren-Runden je Angebot möglich.', minPlan: null })
  assert.deepEqual(deckelAblehnung('dateien', 'solo', 0),
    { error: 'Im Solo-Plan ist kein Datei-Upload möglich. Ab dem Starter-Plan 5 Dateien je Projekt.', minPlan: 'starter' })
})
```

Damit die Tests ohne Supabase laufen, liegen die reinen Texte in **`src/lib/plantexte.ts`** (kein Import außer `plaene.ts`); `planpruefung.ts` importiert Supabase-Typen und `plantexte.ts`.

- [ ] **Step 2: Test laufen lassen — fehlschlagen**

Run: `node --test tests/planpruefung.test.mjs` → FAIL (Modul fehlt)

- [ ] **Step 3: `plantexte.ts` und `planpruefung.ts`**

```ts
// src/lib/plantexte.ts — reine Texte für Ablehnungen (testbar ohne Supabase)
import { PLAN_LABELS, PLAN_REIHE, PLAN_RANK, mindestPlan, deckel, type Plan, type Funktion, type DeckelArt } from './plaene'

const FUNKTION_NAME: Record<Funktion, string> = {
  spracheingabe: 'Die Spracheingabe', pdf: 'Das PDF-Angebot', assistent: 'Der Hilfe-Assistent',
  dateien: 'Der Datei-Upload', export: 'Der Kalkulationsexport', kalibrierung: 'Die Betriebskalibrierung',
  bauweise: 'Die Bauweise-Lernfunktion', materialpreise: 'Die Materialpreise', gestaltung: 'Die Gestaltung des Angebots',
  lieferanten: 'Die Lieferantenverwaltung', bloecke: 'Die Analyse großer Projekte in Blöcken',
  lernschleife: 'Die Lernschleife', auswertung: 'Die Auswertung', smtp: 'Der Versand über die eigene E-Mail',
  ausschreibung: 'Der Ausschreibungs-Modus', internetsuche: 'Die Händlersuche im Internet', gaeb: 'Der GAEB-Import',
}
const DECKEL_NAME: Record<DeckelArt, [string, string]> = {
  angebote: ['Angebot pro Monat', 'Angebote pro Monat'],
  optimierenRunden: ['Optimieren-Runde je Angebot', 'Optimieren-Runden je Angebot'],
  dateien: ['Datei je Projekt', 'Dateien je Projekt'],
  bauweiseRegeln: ['Bauweise-Regel', 'Bauweise-Regeln'],
  materialpreise: ['Materialpreis', 'Materialpreise'],
  nutzer: ['Nutzer', 'Nutzer'],
}

export function ablehnung(f: Funktion): { error: string; minPlan: Plan } {
  const minPlan = mindestPlan(f)
  return { error: `${FUNKTION_NAME[f]} ist ab dem ${PLAN_LABELS[minPlan]}-Plan verfügbar.`, minPlan }
}

function naechsterPlanMitMehr(art: DeckelArt, plan: Plan): Plan | null {
  const aktuell = deckel(plan, art)
  return PLAN_REIHE.find(p => PLAN_RANK[p] > PLAN_RANK[plan] && (deckel(p, art) === null || (aktuell !== null && (deckel(p, art) as number) > aktuell))) ?? null
}

export function deckelAblehnung(art: DeckelArt, plan: Plan, grenze: number): { error: string; minPlan: Plan | null } {
  const [einzahl, mehrzahl] = DECKEL_NAME[art]
  const naechster = naechsterPlanMitMehr(art, plan)
  const kopf = grenze === 0
    ? `Im ${PLAN_LABELS[plan]}-Plan ist kein ${art === 'dateien' ? 'Datei-Upload' : einzahl} möglich.`
    : `Im ${PLAN_LABELS[plan]}-Plan sind ${grenze} ${grenze === 1 ? einzahl : mehrzahl} möglich.`
  if (!naechster) return { error: kopf, minPlan: null }
  const d = deckel(naechster, art)
  const rest = d === null ? 'unbegrenzt' : `${d} ${d === 1 ? einzahl : mehrzahl}`
  return { error: `${kopf} Ab dem ${PLAN_LABELS[naechster]}-Plan ${rest}.`, minPlan: naechster }
}
```

```ts
// src/lib/planpruefung.ts — Server: effektiven Plan laden, Funktion/Deckel prüfen
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { effektiverPlan, erlaubt, deckel, type Plan, type Funktion, type DeckelArt } from './plaene'
import { ablehnung, deckelAblehnung } from './plantexte'

export async function ladeEffektivenPlan(supabase: SupabaseClient, userId: string): Promise<Plan> {
  const { data } = await supabase.from('betriebsprofil').select('plan, trial_starts_at').eq('user_id', userId).single()
  return effektiverPlan(data)
}

/** null = erlaubt. Sonst eine fertige 403-Antwort mit lesbarer Meldung und minPlan. */
export async function pruefeFunktion(supabase: SupabaseClient, userId: string, f: Funktion): Promise<NextResponse | null> {
  const plan = await ladeEffektivenPlan(supabase, userId)
  if (erlaubt(plan, f)) return null
  return NextResponse.json(ablehnung(f), { status: 403 })
}

/** null = unter dem Deckel. `anzahl` ist der Stand VOR der neuen Anlage. */
export function pruefeDeckel(plan: Plan, art: DeckelArt, anzahl: number): NextResponse | null {
  const grenze = deckel(plan, art)
  if (grenze === null || anzahl < grenze) return null
  return NextResponse.json(deckelAblehnung(art, plan, grenze), { status: 403 })
}
```

- [ ] **Step 4: Sperren in die Routen**

Direkt nach der Zeile `if (authErr || !user) return …` in jeder Route:

| Route | Zeile einfügen |
|---|---|
| `lernschleife` GET und POST | `const sperre = await pruefeFunktion(supabase, user.id, 'lernschleife'); if (sperre) return sperre` |
| `analytics` GET | `… 'auswertung' …` |
| `settings/email-config` PATCH | `… 'smtp' …` (GET bleibt frei, damit die Seite den Zustand zeigen kann) |
| `settings/kalibrierung` PUT | `… 'kalibrierung' …` |
| `settings/suppliers` POST, PUT; `suppliers/inquiry`; `suppliers/inquiry/send` | `… 'lieferanten' …` — die vorhandene Plan-Abfrage in `suppliers/inquiry/route.ts:160-165` (`userPlan`) durch `ladeEffektivenPlan` ersetzen; dort, wo `userPlan` die Internet-Suche freischaltet, `erlaubt(plan, 'internetsuche')` verwenden |
| `gaeb/import` | `… 'gaeb' …` |

Import in jeder Datei: `import { pruefeFunktion } from '@/lib/planpruefung'`.

- [ ] **Step 5: Typprüfung, Tests, Commit**

Run: `npx tsc --noEmit -p tsconfig.json | grep -v "^.next/"`; `npm run test`.

```bash
git add src/lib/plantexte.ts src/lib/planpruefung.ts tests/planpruefung.test.mjs src/app/api
git commit -m "feat(plaene): Funktionssperren serverseitig — Lernschleife, Auswertung, SMTP, Kalibrierung, Lieferanten, GAEB"
```

---

### Task 4: Deckel beim Lesen — Bauweise-Regeln, Materialpreise, Kalibrierungsfaktoren

**Files:**
- Modify: `src/lib/bauweise.ts:13-38` (`ladeAktiveRegeln`, `regelBlockFuerNutzer`), `:55-85` (`speichereRegel`)
- Modify: `src/app/api/settings/bauweise/route.ts` (GET, POST)
- Modify: `src/lib/preisspeicher.ts:8-40` (`ladeAktivePreise`, `preisBlockFuerNutzer`), `:43-70` (`speicherePreis`)
- Modify: `src/app/api/settings/materialpreise/route.ts` (GET, POST)
- Modify: `src/lib/kalibrierungsspeicher.ts:47-63` (`ladeFaktoren`)

**Interfaces:**
- Consumes: `wendeDeckelAn`, `deckel`, `erlaubt`, `ladeEffektivenPlan`, `pruefeDeckel`
- Produces: GET-Antworten tragen je Eintrag `aktivDurchPlan: boolean` und oben `{ deckel: number | null, plan: Plan }`; `speichereRegel`/`speicherePreis` liefern bei vollem Deckel `{ ok: false, grund: '<Text aus deckelAblehnung>' }`

- [ ] **Step 1: `ladeAktiveRegeln` deckeln**

In `src/lib/bauweise.ts` nach dem Laden (die Abfrage filtert schon `aktiv = true`):

```ts
import { wendeDeckelAn, deckel } from './plaene'
import { ladeEffektivenPlan } from './planpruefung'
// …
export async function ladeAktiveRegeln(supabase: SupabaseClient, userId: string): Promise<AktiveRegel[]> {
  const { data, error } = await supabase.from('bauweise_regeln').select('…').eq('user_id', userId).eq('aktiv', true)
    .order('zuletzt_gesendet', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false })
  if (error || !data) return []
  // Deckel beim Lesen: die ältesten N gelten, der Rest nicht (Fabian, 15.09.).
  const plan = await ladeEffektivenPlan(supabase, userId)
  return wendeDeckelAn(data as AktiveRegel[], deckel(plan, 'bauweiseRegeln')).filter(r => r.aktivDurchPlan)
}
```
(`AktiveRegel` muss `created_at: string` enthalten — im `select` ergänzen, falls es fehlt.)

- [ ] **Step 2: `speichereRegel` — Deckel vor dem Anlegen**

Vor dem `insert`-Zweig (nicht vor dem `update`-Zweig — Ersetzen einer bestehenden Regel ist kein Wachstum):

```ts
const plan = await ladeEffektivenPlan(supabase, userId)
if (!erlaubt(plan, 'bauweise')) return { ok: false, grund: ablehnung('bauweise').error }
const grenze = deckel(plan, 'bauweiseRegeln')
if (grenze !== null) {
  const { count } = await supabase.from('bauweise_regeln').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('aktiv', true)
  if ((count ?? 0) >= grenze) return { ok: false, grund: deckelAblehnung('bauweiseRegeln', plan, grenze).error }
}
```
Im Optimieren-Chat kommt der `grund` bereits als Werkzeug-Meldung in den Chat (`optimize/route.ts:119` „Regel nicht gespeichert: …“) — **nichts fällt stumm weg.** Prüfen, dass die Meldung so ankommt.

- [ ] **Step 3: Bauweise-Route GET/POST**

GET: alle Regeln des Nutzers (aktiv und inaktiv) laden wie bisher, dann `const plan = await ladeEffektivenPlan(…)`, `const gedeckelt = wendeDeckelAn(regeln.filter(r => r.aktiv), deckel(plan, 'bauweiseRegeln'))`; Antwort `{ regeln: regeln.map(r => ({ ...r, aktivDurchPlan: gedeckelt.find(g => g.id === r.id)?.aktivDurchPlan ?? false })), deckel: deckel(plan, 'bauweiseRegeln'), plan }`.
POST (manuelle Anlage, `ersetztRegelId` leer): vor dem Insert `pruefeFunktion(…, 'bauweise')` und `pruefeDeckel(plan, 'bauweiseRegeln', anzahlAktiv)`; bei Sperre die Antwort zurückgeben.

- [ ] **Step 4: Materialpreise genauso**

`ladeAktivePreise`: nach dem Laden `wendeDeckelAn(data, deckel(plan, 'materialpreise')).filter(p => p.aktivDurchPlan)` (Sortierung fürs Prompt bleibt `updated_at desc`; der Deckel rechnet nach `created_at`, das die Tabelle hat). `speicherePreis`: vor dem Insert Funktion und Deckel prüfen wie in Step 2, `grund` zurückgeben. Route GET: `aktivDurchPlan`, `deckel`, `plan` mitgeben; POST: `pruefeFunktion(…, 'materialpreise')` + `pruefeDeckel(plan, 'materialpreise', anzahlAktiv)`.

- [ ] **Step 5: Kalibrierungsfaktoren nur mit Plan**

`ladeFaktoren`: als erste Zeile

```ts
const plan = await ladeEffektivenPlan(supabase, userId)
if (!erlaubt(plan, 'kalibrierung')) return { ...KEINE_FAKTOREN }  // Solo rechnet mit CraftFlow-Werten (Spec: Regel beim Wechsel nach unten)
```
Die Kalibrierungsantworten bleiben gespeichert; nach einem Upgrade gelten sie wieder.

- [ ] **Step 6: Typprüfung, Tests, Commit**

Run: `npx tsc --noEmit -p tsconfig.json | grep -v "^.next/"`; `npm run test` (die bestehenden Bauweise-/Preis-Tests dürfen nicht kippen — sie testen reine Funktionen in `learn.ts`/`materialpreise.ts`, nicht die Supabase-Lader).

```bash
git add src/lib/bauweise.ts src/lib/preisspeicher.ts src/lib/kalibrierungsspeicher.ts src/app/api/settings/bauweise/route.ts src/app/api/settings/materialpreise/route.ts
git commit -m "feat(plaene): Deckel beim Lesen — Regeln, Materialpreise (älteste N aktiv), Kalibrierung nur mit Plan"
```

---

### Task 5: Optimieren-Runden je Angebot und Dateien je Projekt

**Files:**
- Create: `docs/sql/2026-09-16-plan-deckel.sql`
- Modify: `src/app/api/optimize/route.ts:290-300` (Body), vor dem API-Aufruf, nach Erfolg
- Modify: `src/app/page.tsx` — die vier `fetch('/api/optimize'` (Zeilen ~1395, 1434, 1465, 1501): `projectId` mitschicken; Fehlermeldung mit `minPlan` im Chat zeigen
- Modify: `src/app/api/analyze/route.ts:796-860` — Dateien-Deckel

**Interfaces:**
- Consumes: `ladeEffektivenPlan`, `pruefeDeckel`, `deckel`
- Produces: Tabelle `optimieren_runden(user_id uuid, projekt_id text, runden int, updated_at)`; Optimieren-Body bekommt `projectId?: string`

- [ ] **Step 1: SQL-Migration**

```sql
-- docs/sql/2026-09-16-plan-deckel.sql
-- Zähler für Optimieren-Runden je Angebot (Deckel je Plan, Spec 2026-09-15).
create table if not exists optimieren_runden (
  user_id    uuid not null references auth.users(id) on delete cascade,
  projekt_id text not null,            -- projects.id oder 'ohne-projekt' vor dem ersten Speichern
  runden     int  not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, projekt_id)
);
alter table optimieren_runden enable row level security;
create policy "eigene Runden lesen"    on optimieren_runden for select using (auth.uid() = user_id);
create policy "eigene Runden anlegen"  on optimieren_runden for insert with check (auth.uid() = user_id);
create policy "eigene Runden ändern"   on optimieren_runden for update using (auth.uid() = user_id);
-- Nutzerkonten und Dateien brauchen keine Tabelle: Dateien zählt die Analyse je Anfrage,
-- Nutzer gibt es noch nicht (Mehrbenutzer ist nicht gebaut).
```

Ausführen im Supabase-SQL-Editor (Fabian, oder per Fernsteuer-Chrome; Editor vorher leeren und Inhalt gegenlesen — Vault: „Zwei Sitzungen, ein Browser“). Erst danach deployen — sonst 500er.

- [ ] **Step 2: Optimieren-Route — zählen und deckeln**

Body um `projectId?: string` erweitern. Nach dem Laden von `user` (die Route holt ihn bereits für die Werkzeuge; sonst `createClient()` + `getUser()`):

```ts
const projektId = (typeof projectId === 'string' && projectId) ? projectId : 'ohne-projekt'
const plan = await ladeEffektivenPlan(supabase, user.id)
const { data: stand } = await supabase.from('optimieren_runden').select('runden').eq('user_id', user.id).eq('projekt_id', projektId).maybeSingle()
const bisher = stand?.runden ?? 0
const sperre = pruefeDeckel(plan, 'optimierenRunden', bisher)
if (sperre) return sperre
```
Nach dem erfolgreichen Claude-Aufruf (vor `return NextResponse.json({ success: true …`):
```ts
await supabase.from('optimieren_runden').upsert({ user_id: user.id, projekt_id: projektId, runden: bisher + 1, updated_at: new Date().toISOString() }, { onConflict: 'user_id,projekt_id' })
```
Nicht eingeloggt → wie bisher weiter (Middleware schützt); dann keine Zählung, `plan = 'solo'`.

- [ ] **Step 3: Frontend — `projectId` mitschicken, Sperre im Chat zeigen**

An allen vier `fetch('/api/optimize'`-Stellen im Body `projectId: currentProjectIdRef.current ?? undefined` ergänzen. Beim Auswerten der Antwort: wenn `res.status === 403` und `json.minPlan`, als Chat-Nachricht des Assistenten anzeigen: `${json.error}` plus Link `/settings#plan` („Plan wechseln“). Kein `throw`, keine rote Fehlerbox — der letzte Stand bleibt.

- [ ] **Step 4: Dateien je Projekt in der Analyse**

In `analyze/route.ts` nach dem Lesen des Bodys (Zeile ~796), sobald `rawImages` bekannt ist und der Nutzer geladen wurde (die Route lädt ihn im `try` ab ~Zeile 900 — den `getUser()` nach vorn ziehen, damit der Plan vor dem KI-Aufruf feststeht):

```ts
if (user) {
  const plan = await ladeEffektivenPlan(supabase, user.id)
  const grenze = deckel(plan, 'dateien') ?? Infinity
  if (rawImages.length > grenze) {
    const t = deckelAblehnung('dateien', plan, deckel(plan, 'dateien') as number)
    return NextResponse.json({ success: false, ...t }, { status: 403 })
  }
}
```
(PDF-Seiten werden im Browser zu Bildern, zählen also als Dateien — das ist gewollt: Aufwand = Bilder.)

- [ ] **Step 5: Frontend — Upload-Knöpfe**

In `page.tsx` bei den Upload-Kacheln (~Zeile 3150): `darfNutzen('starter')` durch `erlaubt('dateien')` aus `usePlan` ersetzen; Beschriftung „AB STARTER“ aus `PLAN_LABELS[mindestPlan('dateien')]`. Vor dem Analyse-Aufruf: `if (uploadedFiles.length > (deckel('dateien') ?? Infinity)) setStartMsg(<Text wie deckelAblehnung>)` — der Server prüft ohnehin, der Browser spart nur den Fehlversuch.

- [ ] **Step 6: Typprüfung, Tests, Commit**

```bash
git add docs/sql/2026-09-16-plan-deckel.sql src/app/api/optimize/route.ts src/app/api/analyze/route.ts src/app/page.tsx
git commit -m "feat(plaene): Deckel für Optimieren-Runden je Angebot und Dateien je Projekt"
```

---

### Task 6: Solo bekommt das Standardlayout

**Files:**
- Modify: `src/lib/pdfoptionen.ts:35-90` (`pdfTextOptionen`, `pdfFirmaOptionen`)
- Modify: alle Aufrufer (`grep -rn "pdfTextOptionen\|pdfFirmaOptionen" src`) — `plan` übergeben
- Test: `tests/pdf-gestaltung.test.mjs` (erweitern)

**Interfaces:**
- Produces: `pdfTextOptionen(p, zusatz, plan: Plan = 'enterprise')`, `pdfFirmaOptionen(p, plan: Plan = 'enterprise')` — ohne `gestaltung` im Plan: Layout `klassisch`, Schrift `opensans`, kein eigenes Briefpapier, Standard-Ränder, keine Textbausteine, Akzentfarbe Standard. Firmendaten, Logo, Kleinunternehmer, Gültigkeit, Zahlungsziel, Anrede/Einleitung/Abschluss **bleiben** (das ist Inhalt, nicht Gestaltung).

- [ ] **Step 1: Test**

```js
// in tests/pdf-gestaltung.test.mjs ergänzen
import { pdfTextOptionen, pdfFirmaOptionen } from '../src/lib/pdfoptionen.ts'
test('Solo: Gestaltung fällt auf Standard zurück, Inhalt bleibt', () => {
  const p = { pdf_layout: 'kompakt', pdf_schriftart: 'lora', pdf_eigenes_briefpapier: true, pdf_briefpapier_url: 'x', pdf_margin_top: 40, farbe_akzent: '#C8102E', angebot_einleitung: 'Hallo', kleinunternehmer: true }
  const t = pdfTextOptionen(p, { bausteine: [{ inhalt: 'B' }] }, 'solo')
  assert.equal(t.layout, 'klassisch'); assert.equal(t.schriftart, 'opensans'); assert.equal(t.eigeneBriefpapier, false)
  assert.equal(t.bausteine?.length ?? 0, 0); assert.equal(t.kleinunternehmer, true)
  assert.equal(pdfFirmaOptionen(p, 'solo').akzentfarbe, undefined)
  assert.equal(pdfTextOptionen(p, { bausteine: [{ inhalt: 'B' }] }, 'starter').layout, 'kompakt')
})
```

- [ ] **Step 2: Implementierung**

In beiden Funktionen zuerst `const gestaltung = erlaubt(plan, 'gestaltung')`; die Gestaltungsfelder nur setzen, wenn `gestaltung` wahr ist, sonst Standard. Feldnamen exakt wie im bestehenden Rückgabeobjekt (Datei lesen, nichts erfinden). Aufrufer: `page.tsx` und `settings/page.tsx` übergeben `effectivePlan` aus `usePlan`; `generate-pdf`-Route falls sie die Funktionen nutzt: `await ladeEffektivenPlan(...)`.

- [ ] **Step 3: Tests, Commit**

```bash
git add src/lib/pdfoptionen.ts tests/pdf-gestaltung.test.mjs src/app/page.tsx src/app/settings/page.tsx
git commit -m "feat(plaene): Solo erhält das Standardlayout — Inhalt bleibt, Gestaltung fällt zurück"
```

---

### Task 7: Anzeige — Sperr-Kästen, Zähler, ausgegraute Einträge, Plan-Kacheln

**Files:**
- Modify: `src/components/PlanGate.tsx` (Props `funktion?: Funktion` zusätzlich zu `minPlan`; Text aus `ablehnung()`; Knopf führt zu `/settings#plan`; Farben `C.*`)
- Modify: `src/app/settings/page.tsx` — Bereiche umhüllen: `betrieb` (`kalibrierung`), `bauweise` (`bauweise`), `materialpreise` (`materialpreise`), `textbausteine` + `marketing` + `briefpapier`→Gestaltung (`gestaltung`); `PLANS` (Zeile 120-124) → aus `PLAENE`, `PREIS_IDS`, `merkmaleFuerAnzeige`; Netto-Hinweis bleibt („netto zzgl. gesetzlicher MwSt. · ausschließlich an Unternehmen“)
- Modify: `src/components/settings/BauweiseSettings.tsx` — Kopfzeile „N von M Regeln aktiv“, Einträge mit `aktivDurchPlan === false` ausgegraut (`opacity .5`) + Zeile „Inaktiv durch Plan — ab {Plan} wieder aktiv“; Anlegen-Knopf zeigt Server-Fehlertext
- Modify: `src/components/settings/MaterialpreiseSettings.tsx` — dito
- Modify: `src/components/settings/BetriebSettings.tsx` — Abschnitt „Aus gewonnenen Angeboten lernen“ in `<PlanGate funktion="lernschleife">`
- Modify: `src/app/page.tsx` — Beschriftungen „AB STARTER/ENTERPRISE“ aus `PLAN_LABELS[mindestPlan(f)]`; `darfNutzen('enterprise')` bei Internet-Suche → `erlaubt('internetsuche')`; GAEB → `erlaubt('gaeb')`; Export → `erlaubt('export')`

**Interfaces:**
- Consumes: `usePlan().erlaubt/deckel`, `ablehnung`, `PLAN_LABELS`, `mindestPlan`, `merkmaleFuerAnzeige`, GET-Antworten aus Task 4

- [ ] **Step 1: PlanGate erweitern**

```tsx
export function PlanGate({ minPlan, funktion, children, fallback }: { minPlan?: Plan; funktion?: Funktion; children: React.ReactNode; fallback?: React.ReactNode }) {
  const { canUse, erlaubt, loading } = usePlan()
  if (loading) return null
  const ok = funktion ? erlaubt(funktion) : canUse(minPlan ?? 'solo')
  if (ok) return <>{children}</>
  if (fallback) return <>{fallback}</>
  const text = funktion ? ablehnung(funktion).error : `Diese Funktion ist ab dem ${PLAN_LABELS[minPlan ?? 'solo']}-Plan verfügbar.`
  return (
    <div style={{ borderRadius: 8, border: `1px dashed ${akzentTon('66')}`, background: akzentTon('0D'), padding: '28px 20px', textAlign: 'center' }}>
      <p style={{ fontSize: 13, color: C.textMid, margin: '0 0 14px' }}>{text}</p>
      <a href="/settings#plan" style={{ display: 'inline-block', background: C.copper, color: C.black, borderRadius: 6, padding: '9px 20px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>Plan wechseln</a>
    </div>
  )
}
```

- [ ] **Step 2: Einstellungen umhüllen und Plan-Kacheln aus der Quelle**

`PLANS` in `settings/page.tsx` ersetzen durch
```ts
const PLANS = PLAN_REIHE.map(id => ({ id, name: PLAN_LABELS[id], price: PLAENE[id].preisNetto, priceId: PREIS_IDS[id], untertitel: PLAENE[id].untertitel, features: merkmaleFuerAnzeige(id) }))
```
Die Sonderanzeige „∞ Angebote – unbegrenzt“ für Enterprise (Zeile ~1600) wird zu `deckel(id, 'angebote')` + „Fair Use“. Pro-Kachel hervorheben („Beliebt“).

- [ ] **Step 3: Bauweise- und Materialpreis-Listen**

Nach dem Laden `deckel`, `plan` aus der Antwort im Zustand halten. Kopfzeile: `deckel === null ? `${aktive} Regeln aktiv` : `${Math.min(aktive, deckel)} von ${deckel} Regeln aktiv``. Einträge mit `aktivDurchPlan === false`: `opacity: .5`, Checkbox gesperrt, Zusatzzeile in `C.warn`: „Inaktiv durch Plan — ab {PLAN_LABELS[minPlanMitMehr]} wieder aktiv“. Fehlertext des Servers (403) beim Anlegen anzeigen wie in `BetriebSettings` (Meldung direkt am Knopf).

- [ ] **Step 4: Hilfe-Assistent**

`assistentwissen.ts`: die Freitexte „(ab Pro-Plan)“, „(ab Starter-Plan)“, „(GAEB ab Enterprise-Plan)“ durch `(ab ${PLAN_LABELS[mindestPlan('auswertung')]}-Plan)` usw. ersetzen. In `tests/assistentwissen.test.mjs` ein Test: für jede Funktion in `['auswertung','lieferanten','smtp','gaeb','kalibrierung','lernschleife','bauweise','materialpreise']` muss `assistentWissen()` den Text `ab dem ${PLAN_LABELS[mindestPlan(f)]}-Plan` oder `ab ${…}-Plan` enthalten.

- [ ] **Step 5: Typprüfung, Lint (nur neue Fehler), Tests, Commit**

```bash
git add src/components/PlanGate.tsx src/app/settings/page.tsx src/components/settings src/app/page.tsx src/lib/assistentwissen.ts tests/assistentwissen.test.mjs
git commit -m "feat(plaene): Anzeige — Sperr-Kästen, Zähler, inaktive Einträge, Plan-Kacheln und Assistent aus einer Quelle"
```

---

### Task 8: Website-Preise aus derselben Matrix (Repo `~/craftflow-web`)

**Files:**
- Create: `~/craftflow-web/lib/plaene.json`
- Modify: `~/craftflow-web/app/page.tsx:62-97` (`PLANS`), `:363-395` (Render), `:117-145` (`FAQS`)
- Delete: `~/craftflow-web/components/landing/PricingSection.tsx` (nicht eingebunden, zweite veraltete Kopie)
- Create (in **diesem** Repo): `tests/plaene-website.test.mjs`, `scripts/plaene-export.mjs`

**Interfaces:**
- Consumes: `PLAENE`, `PREIS_IDS` (nicht nötig auf der Website), `merkmaleFuerAnzeige`, `PLAN_LABELS`

- [ ] **Step 1: Export-Skript und Gleichheitstest (dieses Repo)**

```js
// scripts/plaene-export.mjs — schreibt die Matrix als JSON für die Website
import { writeFileSync } from 'node:fs'
import { PLAN_REIHE, PLAENE, PLAN_LABELS, merkmaleFuerAnzeige } from '../src/lib/plaene.ts'
const daten = PLAN_REIHE.map(id => ({ id, name: PLAN_LABELS[id], preisNetto: PLAENE[id].preisNetto, untertitel: PLAENE[id].untertitel, merkmale: merkmaleFuerAnzeige(id), beliebt: id === 'pro' }))
const ziel = process.argv[2] ?? '../craftflow-web/lib/plaene.json'
writeFileSync(ziel, JSON.stringify(daten, null, 2) + '\n')
console.log('geschrieben:', ziel)
```
```js
// tests/plaene-website.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { PLAN_REIHE, PLAENE, PLAN_LABELS, merkmaleFuerAnzeige } from '../src/lib/plaene.ts'
const pfad = new URL('../../craftflow-web/lib/plaene.json', import.meta.url)
test('Website-Preise stimmen mit der App überein (übersprungen, wenn das Nachbar-Repo fehlt)', { skip: !existsSync(pfad) }, () => {
  const web = JSON.parse(readFileSync(pfad, 'utf8'))
  assert.deepEqual(web, PLAN_REIHE.map(id => ({ id, name: PLAN_LABELS[id], preisNetto: PLAENE[id].preisNetto, untertitel: PLAENE[id].untertitel, merkmale: merkmaleFuerAnzeige(id), beliebt: id === 'pro' })),
    'Website veraltet — `node scripts/plaene-export.mjs` ausführen und im Website-Repo committen')
})
```
Run: `node scripts/plaene-export.mjs` → Datei entsteht; `node --test tests/plaene-website.test.mjs` → pass.

- [ ] **Step 2: Website — `PLANS` aus dem JSON, Netto-Hinweis, Pro hervorgehoben**

In `app/page.tsx`: `import plaene from '../lib/plaene.json'`; `PLANS` wird
```ts
const PLANS: Plan[] = plaene.map(p => ({ name: p.name, price: `${p.preisNetto} €`, desc: p.untertitel, feats: p.merkmale, cta: p.id === 'enterprise' ? 'Anfragen' : 'Kostenlos testen', href: p.id === 'enterprise' ? 'mailto:anfrage@fscrafted.de' : REGISTER, hi: p.beliebt }))
```
Im Render: `<span className={s.planPer}> / Monat zzgl. MwSt.</span>`; unter `secSub` ein Satz: „Alle Preise netto zzgl. gesetzlicher MwSt. CraftFlow richtet sich ausschließlich an Unternehmen.“ Bei `hi` ein Abzeichen „Beliebt“ über dem Namen (Klasse `planBadge`, Kupfer, in `page.module.css` ergänzen). Der Satz „Kein Abo, keine Kreditkarte“ bleibt nur, wenn die Testphase wirklich ohne Karte läuft (sie tut es — Registrierung ohne Stripe).

- [ ] **Step 3: FAQ-Einträge**

An `FAQS` anhängen:
```ts
{ q: 'Was passiert, wenn ich eine Grenze meines Plans erreiche?', a: 'CraftFlow sagt es dir an der Stelle, an der es passiert, und nennt den Plan, der die Grenze hebt. Nichts geht verloren: Beim Wechsel in einen kleineren Plan bleiben die ältesten Einträge aktiv, weitere werden inaktiv — und nach einem Upgrade sind sie sofort wieder da.' },
{ q: 'Was heißt „Fair Use" beim Enterprise-Plan?', a: '150 Angebote pro Monat sind großzügig bemessen. Wer regelmäßig darüber liegt, bekommt von uns ein Angebot, das dazu passt — ohne dass mitten im Monat etwas stehen bleibt.' },
{ q: 'Sind die Preise netto?', a: 'Ja. CraftFlow richtet sich ausschließlich an Unternehmen; alle Preise verstehen sich zuzüglich der gesetzlichen Umsatzsteuer, die auf der Rechnung ausgewiesen wird.' },
```

- [ ] **Step 4: Prüfen, Commit in beiden Repos**

Website: `cd ~/craftflow-web && npx tsc --noEmit && npm run lint`; Branch `dev`, pushen, Vorschau ansehen (Screenshot Preisblock + FAQ).
```bash
cd ~/craftflow-web && git add lib/plaene.json app/page.tsx app/page.module.css && git rm components/landing/PricingSection.tsx && git commit -m "feat(preise): Plan-Matrix aus der App, netto zzgl. MwSt., Pro hervorgehoben, FAQ zu Grenzen und Fair Use" && git push origin dev
cd ~/Downloads/craftflow && git add scripts/plaene-export.mjs tests/plaene-website.test.mjs && git commit -m "test(plaene): Website-JSON muss der Matrix entsprechen" && git push origin dev
```

---

### Task 9: Live-Prüfung auf der dev-Vorschau und Dokumentation

**Files:**
- Modify: `CLAUDE.md` (Abschnitt „Pläne / Deckel“), Vault `01 Projekte/CraftFlow - Pläne und Kostenkontrolle.md`

- [ ] **Step 1: SQL-Migration eingespielt?** (Task 5) — sonst zuerst.

- [ ] **Step 2: Live-Prüfung mit dem Testkonto** (Puppeteer gegen `https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app`; **ohne** KI-Aufrufe, wo es geht):
  1. `GET /api/settings/bauweise` → jede Regel hat `aktivDurchPlan`, oben `deckel`/`plan`.
  2. Testkonto steht in der Testphase (Enterprise): alle Bereiche offen, Plan-Kacheln zeigen die Merkmale aus der Matrix, „zzgl. MwSt.“ sichtbar.
  3. Plan des Testkontos in Supabase vorübergehend auf `starter` setzen und `trial_starts_at` 30 Tage zurück (SQL, danach zurücksetzen!): „Auswertung“ zeigt Sperr-Kasten mit „ab dem Pro-Plan“; `POST /api/lernschleife` → 403 mit `minPlan: 'pro'`; Bauweise zeigt „N von 5 Regeln aktiv“ und ausgegraute Einträge, wenn mehr als 5 da sind; `POST /api/settings/bauweise` bei vollem Deckel → 403 mit Text.
  4. Plan auf `solo`: Upload-Kacheln gesperrt mit „ab Starter“; `POST /api/analyze` mit 1 Bild → 403 „kein Datei-Upload“ (kostet keine KI, weil vor dem Aufruf abgelehnt).
  5. Plan zurück auf den echten Stand. Screenshots in `/tmp/cfshots/plaene-*.png`.

- [ ] **Step 3: Doku**

CLAUDE.md, neuer Abschnitt „Pläne / Deckel (Stand 2026-09-16)“: eine Quelle `plaene.ts`; Sperren/Deckel nur serverseitig über `planpruefung.ts`; Deckel wirken beim Lesen (`wendeDeckelAn`, älteste N); nie stumm ablehnen — immer `{ error, minPlan }` 403; Website-JSON per `scripts/plaene-export.mjs`, Test erinnert. Vault-Notiz: Status, Commits, offene Punkte (Blöcke = Teil C, Kostenzähler = Teil B).

- [ ] **Step 4: Commit, dann Freigabe durch Fabian für `main` (App) und Website**

```bash
git add CLAUDE.md && git commit -m "docs: Pläne und Deckel — Regeln für künftige Änderungen"
git push origin dev
```

---

## Self-Review

**Spec-Abdeckung (Abschnitt 3, 4A, 4D, 6):**
- Matrix Zeile für Zeile → Task 1 (Daten + Tests). ✔
- Serverseitig durchsetzen: Angebote (Task 2), Optimieren-Runden + Dateien (Task 5), Regeln + Materialpreise (Task 4), Funktionssperren (Task 3). ✔
- Oberfläche: Sperr-Kästen, Zähler, Plan-Kacheln (Task 7). ✔ Testphase Enterprise, Gutschein unverändert (Task 1 `effektiverPlan`). ✔
- Regel beim Wechsel nach unten für jede Beschränkung: Regeln/Preise (Task 4), Dateien/Angebote/Runden (Task 5: nur Neues gedeckelt), Kalibrierung → Standardwerte (Task 4 Step 5), Gestaltung → Standardlayout (Task 6). **Nutzerkonten:** Mehrbenutzer ist nicht gebaut (`grep multiUser` leer) — kein Deckel nötig, `deckel('nutzer')` steht nur in Matrix und Anzeige. ✔
- Hilfe-Assistent aus der Quelle (Task 7 Step 4). ✔
- Website: JSON aus der Matrix, Netto-Hinweis, Pro „Beliebt“, FAQ, Gleichheitstest (Task 8). ✔
- Nicht in diesem Plan (bewusst): Kostenzähler (Teil B), Blöcke (Teil C) — `bloecke`/`ausschreibung` stehen als Funktionen bereits in der Matrix, damit die Kacheln stimmen; die Sperre greift, sobald Teil C die Routen anlegt.

**Placeholder-Scan:** keine „TBD“/„später“; jede Route ist benannt, jeder Text ausgeschrieben. Task 6 verlangt, die Feldnamen aus `pdfoptionen.ts` zu lesen — das ist Absicht (nichts erfinden), die Testdatei nennt die erwarteten Felder.

**Typkonsistenz:** `Plan`, `Funktion`, `DeckelArt` nur in `plaene.ts` definiert; `usePlan` re-exportiert `Plan`. `pruefeFunktion` gibt `NextResponse | null`, `pruefeDeckel` ebenso — überall als `const sperre = …; if (sperre) return sperre` verwendet. `wendeDeckelAn` verlangt `created_at: string` — Regeln und Materialpreise haben die Spalte (SQL geprüft).
