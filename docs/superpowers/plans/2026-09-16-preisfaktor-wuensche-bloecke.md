# Preisfaktor & Zeitfaktoren (P), Wünsche-Community (W), Große Projekte in Blöcken (C) — Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Jeder Betrieb kann seine Preise über einen eigenen Preishebel einstellen, ohne dass die Stunden verfälscht werden; jeder Nutzer kann Wünsche vorschlagen und mit dem Stimmenbudget seines Plans abstimmen, und die Website zeigt daraus eine öffentliche Roadmap; und ein Projekt mit 30 Fotos und einem 40-seitigen Leistungsverzeichnis läuft in Blöcken durch, ohne dass irgendetwas stumm gekürzt oder verworfen wird.

**Architecture:** Drei voneinander unabhängige Teile auf demselben Fundament. **P** legt ein neues Feld `preisfaktor` auf die Position (`src/lib/types.ts`) und stempelt es serverseitig dort, wo Positionen entstehen (analyze, optimize, manuelles Anlegen) — die Rechenregel steht in genau einer Funktion (`calcAngebotspos`), damit App, PDF und Export automatisch übereinstimmen. Die reine Klemm- und Stempellogik liegt importfrei in `src/lib/preisfaktor.ts`. **W** erweitert die eine Plan-Quelle `src/lib/plaene.ts` um die Deckel-Art `wunschStimmen` und rechnet die aktiven Stimmen beim Lesen über `wendeDeckelAn` aus; die reine Zähl- und Prüflogik liegt importfrei in `src/lib/wuensche.ts`, die Routen sind dünn. **C** schneidet Text und Bilder serverseitig in Blöcke; die reine Teil-Logik (schneiden, Kontext bauen, Dubletten finden, zusammenführen) liegt importfrei in `src/lib/bloecke.ts` und ist vollständig getestet — das ist der Kern, den der Live-Test später nicht mehr anzweifeln soll. Die Routen `/api/upload`, `/api/analyze/vorbereiten` und `/api/analyze/block` setzen Zugang, Funktion und Deckel wie überall serverseitig durch (`src/lib/planpruefung.ts`); `/api/analyze` bleibt für kleine Projekte unverändert.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Supabase (Postgres + RLS + Storage), Stripe, Anthropic `claude-sonnet-4-6`, `unpdf`, Node 24 Test-Runner (`npm run test`, führt `.ts` direkt aus — Dateien unter `src/lib/`, die Tests laden, importieren **nichts** aus React oder Supabase und untereinander mit `.ts`-Endung). Website: Next.js mit CSS-Modulen (`~/craftflow-web`).

**Spec:** `docs/superpowers/specs/2026-09-16-preisfaktor-wuensche-bloecke-design.md` (Teile P, W, C; **Teil B — Kostenzähler — ist zurückgestellt** und kommt in diesem Plan nicht vor).

## Global Constraints

- **Reihenfolge: P → W → C.** Jeder Task endet mit einem prüfbaren, committbaren Stand. Innerhalb eines Teils bauen die Tasks aufeinander auf.
- **Zahlen wörtlich aus der Spec:** Zeitfaktoren von Hand 0,50–3,00 (Ableitung unverändert 0,6–1,4), Preisfaktor 0,50–3,00 mit Standard 1,00, Stimmenbudget 1 / 3 / 10 / 30, Blockgrenzen 8.000 Zeichen und 6 Bilder, Datei ≤ 10 MB.
- **Der Browser ist nie die Instanz.** Jede Sperre und jeder Deckel steht in der Route über `src/lib/planpruefung.ts` (`pruefeZugang`, `pruefeFunktion`, `pruefeDeckel`, `ladeEffektivenPlan`). Der Browser zeigt nur, was der Server ohnehin durchsetzt.
- **Nie stumm ablehnen.** Jede Ablehnung ist JSON mit Text und Ziel-Plan: `{ error, minPlan }`, Status 402 (Zugang) oder 403 (Funktion/Deckel). Texte kommen aus `src/lib/plantexte.ts`.
- **Supabase wirft nicht.** Jedes `{ data, error }` wird geprüft; ein Fehler wird geloggt und führt nie dazu, dass eine Prüfung als bestanden durchgeht (fail closed).
- **Deckel wirken beim Lesen:** die ältesten N (nach `created_at`) bleiben aktiv, der Rest ist inaktiv — `wendeDeckelAn` aus `src/lib/plaene.ts`. Nichts wird gelöscht, ein Upgrade wirkt sofort.
- **Kalkulations-Invarianten bleiben unangetastet:** `vkStunde` und `aufschlag` werden nach der KI deterministisch überschrieben (`validateAndFix`, `applyUserRates`); Positionen kommen über `positionenAusKi` in `src/lib/kiantwort.ts` in die Oberfläche; `stundenGesamt`, `materialkostenGesamt`, Stundensätze und Aufschläge ändert der Preisfaktor **nicht**.
- **Der Vault beeinflusst keine Preise.** Der Preisfaktor geht **nie** in einen KI-Prompt und erscheint **nie** im PDF — er ist reine Nachrechnung.
- **Keine festen Farben.** Nur `C.*` aus `@/lib/types` und `akzentTon()`/`ton()` aus `@/lib/theme`. Nie einen Hex-Alpha-Anhang an eine CSS-Variable hängen.
- **SQL-Migrationen sind Dateien** unter `docs/sql/`, immer mit `grant … to authenticated, service_role` (Lehre vom 16.09.: RLS-Policies allein lassen jede App-Abfrage still scheitern). **Der Controller führt sie aus, nie der Implementierer.** Erst danach deployen, sonst 500er.
- **Die App läuft lokal nicht.** Geprüft wird mit `npm run test`, `npx tsc --noEmit -p tsconfig.json` und gegen die dev-Vorschau `https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app` (Testkonto ist dort eingeloggt). **KI-Aufrufe kosten Geld — so wenige wie nötig, nie in Schleifen.**
- Arbeiten auf Branch `dev` (App **und** Website). Nichts auf `main` ohne Fabians Freigabe.
- UI-Texte und Kommentare deutsch.

---

## Dateiübersicht

| Datei | Verantwortung | Teil |
|---|---|---|
| `src/lib/preisfaktor.ts` (neu) | Grenzen 0,50–3,00, `klemmePreisfaktor`, `stempelPreisfaktor`, `angezeigterPreisfaktor` — importfrei | P |
| `tests/preisfaktor.test.mjs` (neu) | Rechenregel, Klemmung, Standard 1, Stempeln nur auf neue Positionen | P |
| `src/lib/types.ts` | `Angebotsposition.preisfaktor?: number`, `calcAngebotspos` multipliziert | P |
| `src/lib/kiantwort.ts` | `preisfaktor` durchreichen — was hier fehlt, ist danach verloren | P |
| `src/lib/kalibrierung.ts` | `HAND_MIN`/`HAND_MAX` (0,5–3,0) und `deckeleHand` neben `deckele` (0,6–1,4) | P |
| `docs/sql/2026-09-16-preisfaktor.sql` (neu) | `betriebsprofil.preisfaktor numeric(4,2) not null default 1.00` | P |
| `src/app/api/settings/betriebsprofil/route.ts` | `preisfaktor` in `allowed`, Klemmung, 400 mit Meldung | P |
| `src/app/api/settings/kalibrierung/route.ts` | `vonHand` nutzt `deckeleHand` | P |
| `src/app/api/analyze/route.ts`, `src/app/api/optimize/route.ts` | Preisfaktor laden und auf **neue** Positionen stempeln | P |
| `src/components/settings/BetriebSettings.tsx` | Zeitfaktoren 0,50–3,00, neuer Abschnitt „Preisfaktor“ | P |
| `src/app/page.tsx` | manuelle Position stempeln, Übersichtszeile „Preisfaktor“ | P |
| `src/lib/plaene.ts`, `src/lib/plantexte.ts` | Deckel-Art `wunschStimmen` (1/3/10/30), `stimmenAblehnung` | W |
| `src/lib/wuensche.ts` (neu) | Status, Textgrenzen, aktive Stimmen je Wunsch, Budget — importfrei | W |
| `tests/wuensche.test.mjs` (neu) | Budget, Wechsel nach unten, Textprüfung, öffentliche Auswahl | W |
| `docs/sql/2026-09-16-wuensche.sql` (neu) | `wuensche`, `wunsch_stimmen`, RLS **und** GRANTs | W |
| `src/app/api/wuensche/route.ts` (neu) | GET Liste + Budget, POST anlegen (3 je Tag) | W |
| `src/app/api/wuensche/[id]/stimme/route.ts` (neu) | POST setzen (403 bei vollem Budget), DELETE zurücknehmen | W |
| `src/app/api/wuensche/oeffentlich/route.ts` (neu) | öffentlich, ohne Nutzerdaten, `s-maxage=300` | W |
| `src/app/api/admin/wuensche/[id]/route.ts` (neu) | Status, Zusammenlegen, Ausblenden — nur Fabian | W |
| `src/middleware.ts` | `/api/wuensche/oeffentlich` in `PUBLIC_PATHS` | W |
| `src/components/settings/WuenscheSettings.tsx` (neu), `src/app/settings/page.tsx` | Bereich „Wünsche“ | W |
| `src/lib/assistentwissen.ts`, `tests/assistentwissen.test.mjs` | Preisfaktor und Wünsche im Assistenten | P, W |
| `~/craftflow-web/app/roadmap/page.tsx` + `roadmap.module.css` (neu), `app/page.tsx`, `app/sitemap.ts` | öffentliche Roadmap, Navigation, FAQ | W |
| `src/lib/bloecke.ts` (neu) | schneiden, Kontext, Dubletten, zusammenführen — importfrei | C |
| `tests/bloecke.test.mjs` (neu) | Schnittregeln, Bilderverteilung, Dubletten, ids | C |
| `docs/sql/2026-09-16-bloecke-storage.sql` (neu) | Bucket `projektdateien` (privat) + Storage-Policies + GRANTs | C |
| `src/app/api/upload/route.ts` (neu) | POST/DELETE eine Datei, Deckel `dateien` je Projekt | C |
| `src/app/api/analyze/vorbereiten/route.ts` (neu) | Dateien lesen, PDF-Text ziehen, in Blöcke teilen | C |
| `src/app/api/analyze/block/route.ts` (neu) | Analyse eines Blocks, je Block ein Angebot reserviert | C |
| `src/app/page.tsx` | Upload mit Fortschritt, Blockfortschritt, Abbrechen, Zusammenführen, Dublettenhinweis | C |
| `CLAUDE.md` | Regeln für künftige Änderungen (je Teil ein Abschnitt) | P, W, C |

---

# Teil P — Zeitfaktoren 0,50–3,00 und ein neuer Preisfaktor

### Task P1: Die Rechenregel — Preisfaktor auf der Position, Handgrenzen für die Zeitfaktoren

**Files:**
- Create: `src/lib/preisfaktor.ts`
- Create: `tests/preisfaktor.test.mjs`
- Create: `docs/sql/2026-09-16-preisfaktor.sql`
- Modify: `src/lib/types.ts:180-206` (`Angebotsposition`), `:432-434` (`calcAngebotspos`)
- Modify: `src/lib/kiantwort.ts:23-45` (`KiPosition`, `UiPosition`, `KI_POSITIONSFELDER`), `:63-77` (Übernahme)
- Modify: `src/lib/kalibrierung.ts:634-640` (`deckele`, neu `HAND_MIN`/`HAND_MAX`/`deckeleHand`)
- Modify: `tests/kalibrierung.test.mjs:84-96` (Handgrenzen ergänzen)
- Modify: `tests/kiantwort.test.mjs:5-13` (`VOLL` bekommt `preisfaktor`)

**Interfaces:**
- Produces:
  - `Angebotsposition.preisfaktor?: number` (`src/lib/types.ts`)
  - `calcAngebotspos(p: Angebotsposition): number` — `(materialkostenPos(p) + arbeitszeitPreisPos(p)) * (p.preisfaktor ?? 1)`
  - `PREISFAKTOR_MIN = 0.5`, `PREISFAKTOR_MAX = 3`, `PREISFAKTOR_STANDARD = 1`
  - `klemmePreisfaktor(v: unknown): number | null` (null = keine Zahl → 400)
  - `stempelPreisfaktor<T extends { preisfaktor?: number }>(positionen: T[], faktor: number): T[]`
  - `angezeigterPreisfaktor(positionen: Array<{ preisfaktor?: number }>): number | 'gemischt' | null`
  - `HAND_MIN = 0.5`, `HAND_MAX = 3`, `deckeleHand(faktor: number): number` (`src/lib/kalibrierung.ts`)
  - `UiPosition.preisfaktor?: number`, `'preisfaktor'` in `KI_POSITIONSFELDER`
- Consumes: nichts (alle vier Dateien bleiben importfrei bzw. importieren nur untereinander)

- [ ] **Step 1: Test schreiben**

```js
// tests/preisfaktor.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  calcAngebotspos, nettoSumme, materialkostenGesamt, stundenGesamt,
} from '../src/lib/types.ts'
import {
  PREISFAKTOR_MIN, PREISFAKTOR_MAX, PREISFAKTOR_STANDARD,
  klemmePreisfaktor, stempelPreisfaktor, angezeigterPreisfaktor,
} from '../src/lib/preisfaktor.ts'
import { deckele, deckeleHand, HAND_MIN, HAND_MAX } from '../src/lib/kalibrierung.ts'
import { positionenAusKi } from '../src/lib/kiantwort.ts'

// Eine Position mit runden Zahlen: Material 10 m2 x 20 EUR x 1,30 = 260,00 EUR,
// Arbeit 120 min / 60 x 72 EUR/h = 144,00 EUR. Zusammen 404,00 EUR.
const POS = (extra = {}) => ({
  id: 1, titel: 'Einbauschrank', beschreibung: '',
  material: [{ id: 11, bezeichnung: 'Spanplatte 19 mm', menge: 10, einheit: 'm²', ekPreis: 20, aufschlag: 0.3 }],
  arbeitszeit: [{ id: 21, kostenstelle: 'Zuschnitt', minuten: 120, vkStunde: 72 }],
  ...extra,
})

test('Ohne Preisfaktor rechnet sich nichts anders als bisher', () => {
  assert.equal(calcAngebotspos(POS()), 404)
  assert.equal(PREISFAKTOR_STANDARD, 1)
})

test('Der Preisfaktor multipliziert den Endpreis der Position — Material und Lohn zusammen', () => {
  assert.equal(calcAngebotspos(POS({ preisfaktor: 1.25 })), 505)
  assert.equal(calcAngebotspos(POS({ preisfaktor: 0.5 })), 202)
  assert.equal(calcAngebotspos(POS({ preisfaktor: 3 })), 1212)
})

test('Stunden, Materialkosten und Stundensätze bleiben unberührt', () => {
  // GENAU DARUM geht es: Zeitfaktoren verfaelschen "Stunden gesamt" und den
  // Plancraft-Export. Der Preisfaktor darf das nicht.
  const teuer = [POS({ preisfaktor: 3 })]
  assert.equal(stundenGesamt(teuer), 2)
  assert.equal(materialkostenGesamt(teuer), 260)
  assert.equal(teuer[0].arbeitszeit[0].vkStunde, 72)
  assert.equal(teuer[0].material[0].aufschlag, 0.3)
})

test('nettoSumme summiert die gestempelten Preise, Alternativpositionen bleiben draußen', () => {
  assert.equal(nettoSumme([POS({ preisfaktor: 1.25 }), POS({ id: 2 })]), 505 + 404)
  assert.equal(nettoSumme([POS({ preisfaktor: 1.25 }), POS({ id: 2, preisfaktor: 2, alternativ: true })]), 505)
})

test('Ein kaputter Wert kippt die Kalkulation nicht — er gilt als 1,00', () => {
  // Ein NaN im Feld wuerde sonst die ganze Angebotssumme zu NaN machen, ohne Meldung.
  for (const kaputt of [NaN, 0, -1, Infinity, null, undefined, '1,25']) {
    assert.equal(calcAngebotspos(POS({ preisfaktor: kaputt })), 404, `preisfaktor ${String(kaputt)}`)
  }
})

test('klemmePreisfaktor hält 0,50 bis 3,00 ein und weist Unsinn ab', () => {
  assert.equal(PREISFAKTOR_MIN, 0.5)
  assert.equal(PREISFAKTOR_MAX, 3)
  assert.equal(klemmePreisfaktor(1.25), 1.25)
  assert.equal(klemmePreisfaktor('1.25'), 1.25)
  assert.equal(klemmePreisfaktor(0.1), 0.5)
  assert.equal(klemmePreisfaktor(9), 3)
  assert.equal(klemmePreisfaktor(1.2345), 1.23)
  assert.equal(klemmePreisfaktor(''), null)
  assert.equal(klemmePreisfaktor('abc'), null)
  assert.equal(klemmePreisfaktor(null), null)
  assert.equal(klemmePreisfaktor(undefined), null)
})

test('stempelPreisfaktor setzt den Faktor nur auf Positionen, die noch keinen tragen', () => {
  // Ein verschicktes Angebot darf sich nicht rueckwirkend veraendern: Wer schon
  // einen Faktor traegt, behaelt ihn — auch wenn der Betrieb seinen inzwischen
  // geaendert hat.
  const gestempelt = stempelPreisfaktor(
    [{ id: 1, titel: 'neu' }, { id: 2, titel: 'alt', preisfaktor: 1.1 }],
    1.4,
  )
  assert.deepEqual(gestempelt.map(p => p.preisfaktor), [1.4, 1.1])
  // Faktor 1,00 wird nicht gestempelt — sonst steht in jedem Angebot "preisfaktor: 1"
  // herum und der Versionsvergleich meldet Aenderungen, die keine sind.
  assert.ok(!('preisfaktor' in stempelPreisfaktor([{ id: 1 }], 1)[0]))
  // Die Eingabeliste bleibt unveraendert (keine stillen Nebenwirkungen).
  const eingabe = [{ id: 1 }]
  stempelPreisfaktor(eingabe, 1.5)
  assert.ok(!('preisfaktor' in eingabe[0]))
})

test('angezeigterPreisfaktor meldet nur, was wirklich wirkt', () => {
  assert.equal(angezeigterPreisfaktor([]), null)
  assert.equal(angezeigterPreisfaktor([{ id: 1 }, { id: 2 }]), null)
  assert.equal(angezeigterPreisfaktor([{ preisfaktor: 1 }, {}]), null)
  assert.equal(angezeigterPreisfaktor([{ preisfaktor: 1.25 }, { preisfaktor: 1.25 }]), 1.25)
  assert.equal(angezeigterPreisfaktor([{ preisfaktor: 1.25 }, { preisfaktor: 1.1 }]), 'gemischt')
  assert.equal(angezeigterPreisfaktor([{ preisfaktor: 1.25 }, {}]), 'gemischt')
})

test('positionenAusKi reicht den gestempelten Preisfaktor durch', () => {
  // Der Server stempelt NACH validateAndFix. Wuerde diese Umwandlung das Feld
  // weglassen, waere der Faktor in der Oberflaeche weg — genau so ist 2026-09-08
  // die Stueckzahl verschwunden.
  const [p] = positionenAusKi([{ titel: 'X', preisfaktor: 1.25, material: [], arbeitszeit: [] }], 1000)
  assert.equal(p.preisfaktor, 1.25)
  const [q] = positionenAusKi([{ titel: 'X', material: [], arbeitszeit: [] }], 1000)
  assert.ok(!('preisfaktor' in q), 'ohne Faktor wird keiner erfunden')
  const [r] = positionenAusKi([{ titel: 'X', preisfaktor: 'viel', material: [], arbeitszeit: [] }], 1000)
  assert.ok(!('preisfaktor' in r), 'Unsinn wird nicht uebernommen')
})

test('Zeitfaktoren von Hand: 0,50 bis 3,00 — die Ableitung bleibt bei 0,6 bis 1,4', () => {
  // Fabian am 16.09.: Die enge Grenze war nur ein Tippfehler-Schutz. Sie gilt
  // weiterhin fuer die ABLEITUNG aus den Kalibrierungsantworten (deckele), nicht
  // mehr fuer die Handeingabe (deckeleHand).
  assert.equal(HAND_MIN, 0.5)
  assert.equal(HAND_MAX, 3)
  assert.equal(deckeleHand(0.1), 0.5)
  assert.equal(deckeleHand(9), 3)
  assert.equal(deckeleHand(2.5), 2.5)
  assert.equal(deckeleHand(0.83), 0.83)
  assert.equal(deckeleHand(NaN), 1)
  assert.equal(deckele(0.1), 0.6)
  assert.equal(deckele(9), 1.4)
  assert.equal(deckele(2.5), 1.4)
})
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `node --test tests/preisfaktor.test.mjs`
Expected: FAIL, „Cannot find module … src/lib/preisfaktor.ts“

- [ ] **Step 3: `src/lib/preisfaktor.ts` anlegen**

```ts
// src/lib/preisfaktor.ts
// Der Preishebel des Betriebs. Reine Daten und Funktionen ohne Importe —
// `npm run test` fuehrt sie direkt aus.
//
// ANLASS (Fabian, 2026-09-16): "Wenn ich feststelle, die Preise sind zu guenstig,
// dann moechte ich das mit Faktoren regeln koennen." Ueber die ZEITfaktoren ging das
// nicht: Sie verfaelschen "Stunden gesamt" und den Plancraft-Export. Der Preisfaktor
// multipliziert deshalb nur den Endpreis der Position — Material und Lohn zusammen —
// und laesst Stunden, Stundensaetze und Aufschlaege unangetastet.
//
// ZWEI REGELN, die hier festgeschrieben sind:
//   1. Der Faktor wird auf die Position GESTEMPELT, wenn sie entsteht. Ein spaeteres
//      Aendern des Faktors veraendert alte Angebote nicht — ein verschicktes Angebot
//      darf sich nicht rueckwirkend veraendern.
//   2. Der Faktor geht NIE in einen KI-Prompt und NIE ins PDF. Er ist reine
//      Nachrechnung; der Kunde sieht nur Endpreise.

export const PREISFAKTOR_MIN = 0.5
export const PREISFAKTOR_MAX = 3
export const PREISFAKTOR_STANDARD = 1

/**
 * Prueft und klemmt einen Wert aus Eingabefeld oder Datenbank.
 * Rueckgabe `null` = gar keine Zahl → die Route antwortet mit 400 und einer Meldung,
 * statt stillschweigend etwas anderes zu speichern.
 */
export function klemmePreisfaktor(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).trim())
  if (!Number.isFinite(n)) return null
  const geklemmt = Math.min(PREISFAKTOR_MAX, Math.max(PREISFAKTOR_MIN, n))
  return Math.round(geklemmt * 100) / 100
}

/** Der Faktor einer Position, defensiv gelesen. Unsinn gilt als 1,00. */
export function preisfaktorVon(p: { preisfaktor?: unknown } | null | undefined): number {
  const f = p?.preisfaktor
  return typeof f === 'number' && Number.isFinite(f) && f > 0 ? f : PREISFAKTOR_STANDARD
}

/**
 * Stempelt den Faktor des Betriebs auf jede Position, die noch keinen traegt.
 * Bestehende Faktoren bleiben stehen (Regel 1 im Dateikopf). Faktor 1,00 wird nicht
 * gestempelt — sonst steht in jedem Angebot ein Feld herum, das nichts bewirkt, und
 * der Versionsvergleich der Lernschleife meldet Aenderungen, die keine sind.
 */
export function stempelPreisfaktor<T extends { preisfaktor?: number }>(
  positionen: T[], faktor: number,
): T[] {
  if (!Array.isArray(positionen)) return []
  const f = typeof faktor === 'number' && Number.isFinite(faktor) && faktor > 0 ? faktor : PREISFAKTOR_STANDARD
  return positionen.map(p => {
    const vorhanden = preisfaktorVon(p as { preisfaktor?: unknown })
    if (typeof p?.preisfaktor === 'number' && Number.isFinite(p.preisfaktor) && p.preisfaktor > 0) return p
    if (f === PREISFAKTOR_STANDARD) return p
    void vorhanden
    return { ...p, preisfaktor: f }
  })
}

/**
 * Was in der Kalkulationsuebersicht stehen soll.
 * `null` = nichts anzeigen (alle Positionen rechnen mit 1,00), `'gemischt'` = die
 * Positionen tragen verschiedene Faktoren (kommt vor, wenn ein Betrieb seinen Faktor
 * zwischen zwei Optimieren-Runden aendert). Eine einzelne Zahl waere dann gelogen.
 */
export function angezeigterPreisfaktor(
  positionen: Array<{ preisfaktor?: number }>,
): number | 'gemischt' | null {
  const werte = (positionen ?? []).map(p => preisfaktorVon(p as { preisfaktor?: unknown }))
  if (werte.length === 0) return null
  const einzig = new Set(werte)
  if (einzig.size > 1) return 'gemischt'
  const [nur] = [...einzig]
  return nur === PREISFAKTOR_STANDARD ? null : nur
}
```

- [ ] **Step 4: `src/lib/types.ts` — Feld und Rechenregel**

Ersetze in `src/lib/types.ts` den Block ab `  /**\n   * Alternativposition:` bis `  alternativ?: boolean\n}` (Zeilen 200-206) durch:

```ts
  /**
   * Alternativposition: wird angeboten, zaehlt aber NICHT in die Summe. Im PDF mit
   * dem Zusatz "(Alternative Position)" und dem Preis in Klammern — so steht es im
   * Referenzangebot.
   */
  alternativ?: boolean
  /**
   * Preishebel des Betriebs, auf die Position GESTEMPELT, als sie entstand
   * (0,50-3,00, Standard 1,00 = Feld bleibt leer). Multipliziert den Endpreis
   * dieser Position — Material und Lohn zusammen — und laesst Stunden,
   * Stundensaetze und Aufschlaege unberuehrt (siehe calcAngebotspos unten).
   *
   * Gestempelt statt nachgeschlagen, weil ein verschicktes Angebot sich nicht
   * rueckwirkend veraendern darf, wenn der Betrieb spaeter teurer verkauft.
   * Regeln und Grenzen: src/lib/preisfaktor.ts.
   */
  preisfaktor?: number
}
```

Ersetze `calcAngebotspos` (Zeilen 432-434) durch:

```ts
/**
 * Preis EINER Position. Der Preisfaktor des Betriebs (Spec 2026-09-16, Teil P)
 * multipliziert Material und Lohn ZUSAMMEN — die einzige Stelle, an der er wirkt.
 * Weil nettoSumme, das PDF und der Export alle hier hereinlaufen, koennen sie nicht
 * auseinanderdriften.
 *
 * Ein kaputter Wert (NaN, 0, negativ, Text) gilt als 1,00: Ohne diesen Schutz wuerde
 * ein einziges NaN die gesamte Angebotssumme zu NaN machen — ohne Meldung.
 */
export function calcAngebotspos(p: Angebotsposition): number {
  const f = p?.preisfaktor
  const faktor = typeof f === 'number' && Number.isFinite(f) && f > 0 ? f : 1
  return (materialkostenPos(p) + arbeitszeitPreisPos(p)) * faktor
}
```

- [ ] **Step 5: `src/lib/kiantwort.ts` — das Feld durchreichen**

In `KiPosition` (Zeile 23-27) und `UiPosition` (Zeile 29-39) jeweils nach `alternativ?: boolean` ergänzen: `preisfaktor?: number`.

`KI_POSITIONSFELDER` (Zeile 42-45) wird zu:

```ts
export const KI_POSITIONSFELDER = [
  'titel', 'beschreibung', 'stueckzahl', 'gruppe', 'alternativ', 'warnung',
  'preisfaktor', 'material', 'arbeitszeit',
] as const
```

Im Rückgabeobjekt (nach `...(p.warnung ? { warnung: String(p.warnung) } : {}),`, Zeile 77) ergänzen:

```ts
      // Der Preisfaktor kommt NICHT von der KI — der Server stempelt ihn nach
      // validateAndFix auf die Positionen (src/lib/preisfaktor.ts). Hier wird er
      // nur durchgereicht. Ohne diese Zeile waere er in der Oberflaeche weg,
      // ohne Fehler und ohne Meldung (so verschwand 2026-09-08 die stueckzahl).
      ...(typeof p.preisfaktor === 'number' && Number.isFinite(p.preisfaktor) && p.preisfaktor > 0
        ? { preisfaktor: p.preisfaktor } : {}),
```

- [ ] **Step 6: `src/lib/kalibrierung.ts` — zwei Grenzen statt einer**

Ersetze die Zeilen 634-640 durch:

```ts
// Grenzen der ABLEITUNG aus den Kalibrierungsantworten. Sie bleiben, wie sie sind:
// Die fuenf Antwortbaender sind genau auf 0,60-1,40 zurueckgerechnet (ZIEL_FAKTOREN).
const MIN_FAKTOR = 0.6
const MAX_FAKTOR = 1.4

// Grenzen der HANDEINGABE in "Mein Betrieb". Fabian am 2026-09-16: Die enge Grenze
// war dort nur ein Tippfehler-Schutz und hat Betriebe ausgesperrt, die wirklich
// deutlich langsamer oder schneller arbeiten.
export const HAND_MIN = 0.5
export const HAND_MAX = 3

export function deckele(faktor: number): number {
  if (!Number.isFinite(faktor)) return 1
  return Math.min(MAX_FAKTOR, Math.max(MIN_FAKTOR, Math.round(faktor * 100) / 100))
}

/** Wie deckele, aber fuer von Hand gesetzte Faktoren: 0,50 bis 3,00. */
export function deckeleHand(faktor: number): number {
  if (!Number.isFinite(faktor)) return 1
  return Math.min(HAND_MAX, Math.max(HAND_MIN, Math.round(faktor * 100) / 100))
}
```

- [ ] **Step 7: Bestehende Tests nachziehen**

In `tests/kalibrierung.test.mjs` die Importzeile 4 erweitern auf
`  REFERENZ, BAENDER, referenzPreis, berechneFaktoren, deckele, deckeleHand, HAND_MIN, HAND_MAX, kostenstellenSollZustand,`
und direkt nach dem bestehenden `deckele`-Test (Zeilen 84-88) ergänzen:

```js
test('Von Hand gesetzte Faktoren duerfen 0,50 bis 3,00 sein (Fabian, 16.09.)', () => {
  assert.equal(HAND_MIN, 0.5)
  assert.equal(HAND_MAX, 3)
  assert.equal(deckeleHand(0.4), 0.5)
  assert.equal(deckeleHand(3.7), 3)
  assert.equal(deckeleHand(2.5), 2.5)
  // Die Ableitung bleibt eng — die Baender sind darauf zurueckgerechnet.
  assert.equal(deckele(2.5), 1.4)
})
```

In `tests/kiantwort.test.mjs` bekommt `VOLL` (Zeile 5-13) eine Zeile nach `warnung:`:

```js
  preisfaktor: 1.25,
```

(Sonst schlägt „Kein Feld der KI-Antwort geht verloren“ fehl, weil `KI_POSITIONSFELDER` jetzt `preisfaktor` enthält — genau der Wächter, für den der Test gebaut ist.)

- [ ] **Step 8: SQL-Migration schreiben (ausgeführt wird sie vom Controller)**

```sql
-- docs/sql/2026-09-16-preisfaktor.sql
-- Preisfaktor je Betrieb (Spec 2026-09-16, Teil P). Multipliziert den Endpreis
-- jeder NEU entstehenden Position; Stunden und Stundensaetze bleiben unberuehrt.
-- Grenzen 0,50-3,00 werden zusaetzlich serverseitig geprueft
-- (src/lib/preisfaktor.ts, PATCH /api/settings/betriebsprofil).
alter table betriebsprofil
  add column if not exists preisfaktor numeric(4,2) not null default 1.00;

alter table betriebsprofil
  drop constraint if exists betriebsprofil_preisfaktor_grenzen;
alter table betriebsprofil
  add constraint betriebsprofil_preisfaktor_grenzen
  check (preisfaktor >= 0.5 and preisfaktor <= 3.0);

-- betriebsprofil hat bereits RLS und GRANTs; eine neue Spalte erbt beides.
-- Trotzdem hier ausgeschrieben, weil eine fehlende Berechtigung in Supabase
-- still scheitert ({data: null, error}) statt zu werfen — Lehre vom 16.09.
grant select, insert, update on public.betriebsprofil to authenticated, service_role;
```

- [ ] **Step 9: Tests und Typprüfung**

Run: `npm run test` → alles grün (neu: `tests/preisfaktor.test.mjs`; nachgezogen: `kalibrierung`, `kiantwort`).
Run: `npx tsc --noEmit -p tsconfig.json | grep -v "^.next/"` → keine Ausgabe.

- [ ] **Step 10: Commit**

```bash
git add src/lib/preisfaktor.ts src/lib/types.ts src/lib/kiantwort.ts src/lib/kalibrierung.ts docs/sql/2026-09-16-preisfaktor.sql tests/preisfaktor.test.mjs tests/kalibrierung.test.mjs tests/kiantwort.test.mjs
git commit -m "feat(preisfaktor): Preisfaktor auf der Position, Zeitfaktoren von Hand 0,50-3,00"
```

---

### Task P2: Server — speichern, klemmen, stempeln

**Files:**
- Modify: `src/app/api/settings/betriebsprofil/route.ts:28-55` (`allowed`, `numFields`), `:69-83` (Prüfblock)
- Modify: `src/app/api/settings/kalibrierung/route.ts:5` (Import), `:87-90` (`vonHand`)
- Modify: `src/app/api/analyze/route.ts:981-989` (Profil-Select), `:1129-1143` (Stempel nach `validateAndFix`)
- Modify: `src/app/api/optimize/route.ts:223-255` (`applyUserRates`), `:363-372` (Profil-Select), `:544-546` (Aufruf)

**Interfaces:**
- Consumes: `klemmePreisfaktor`, `stempelPreisfaktor`, `PREISFAKTOR_STANDARD` (Task P1); `deckeleHand` (Task P1)
- Produces:
  - `PATCH /api/settings/betriebsprofil` akzeptiert `preisfaktor`; ungültig → `400 { error: 'Preisfaktor: „…" ist keine Zahl zwischen 0,50 und 3,00.' }`
  - `POST /api/analyze` liefert Positionen mit gestempeltem `preisfaktor`
  - `applyUserRates(offer, customSaetze, matGruppen, deaktiviert, faktoren, preisfaktor)` stempelt nur neue Positionen

- [ ] **Step 1: Betriebsprofil-Route — `preisfaktor` erlauben und klemmen**

Import ergänzen (nach Zeile 3):
```ts
import { klemmePreisfaktor } from '@/lib/preisfaktor'
```
In `allowed` (Zeile 28-45) nach `'benchmark_zustimmung',` ergänzen: `'preisfaktor',`.
`numFields` **nicht** erweitern — der Preisfaktor bekommt seine eigene Prüfung, weil `Number('abc')` sonst `NaN` in die Datenbank schreiben würde.

Direkt vor dem Farbcode-Block (Zeile 70) einfügen:

```ts
  // Preisfaktor: 0,50-3,00. Unsinn wird abgewiesen statt stillschweigend
  // umgedeutet — ein NaN in dieser Spalte wuerde jede Angebotssumme zerstoeren.
  if ('preisfaktor' in patch) {
    const roh = patch.preisfaktor
    const wert = klemmePreisfaktor(roh)
    if (wert === null) {
      return NextResponse.json(
        { error: `Preisfaktor: „${String(roh)}“ ist keine Zahl zwischen 0,50 und 3,00.` },
        { status: 400 },
      )
    }
    patch.preisfaktor = wert
  }
```

- [ ] **Step 2: Kalibrierungs-Route — Handgrenzen weiten**

Zeile 5 wird zu:
```ts
import { berechneFaktoren, deckele, deckeleHand, referenzFuer } from '@/lib/kalibrierung'
```
(`deckele` bleibt importiert, weil `berechneFaktoren` es intern nutzt und der Import sonst ungenutzt wäre — entferne `deckele` aus der Importliste, falls der Linter ihn als ungenutzt meldet.)

Der `vonHand`-Block (Zeilen 87-90) wird zu:

```ts
  // Ausnahme: ein von Hand gesetzter Faktor aus den Einstellungen. Er ueberschreibt
  // die Ableitung bewusst — steht so im Reiter "Mein Betrieb" — und wird gedeckelt.
  // Handeingaben duerfen 0,50 bis 3,00 sein (deckeleHand); die ABLEITUNG aus den
  // Antworten bleibt bei 0,60 bis 1,40 (deckele, in berechneFaktoren).
  const vonHand = (k: string, standard: number) =>
    b[k] === undefined || b[k] === null || b[k] === '' ? standard : deckeleHand(Number(b[k]))
```

- [ ] **Step 3: Analyse-Route — Faktor laden und stempeln**

Import ergänzen (nach Zeile 9):
```ts
import { stempelPreisfaktor, PREISFAKTOR_STANDARD, klemmePreisfaktor } from '@/lib/preisfaktor'
```
Neben `let firmenStandort = ''` (Zeile 960) ergänzen:
```ts
    let preisfaktorNutzer = PREISFAKTOR_STANDARD
```
Der Profil-Select (Zeile 981-985) wird zu:
```ts
        const { data: profil, error: profilErr } = await supabase
          .from('betriebsprofil')
          .select('strasse, plz, ort, preisfaktor')
          .eq('user_id', user.id)
          .single()
        if (profilErr) console.error('[analyze] Betriebsprofil:', profilErr.message)
```
und direkt nach dem `if (profil) { … }`-Block (nach Zeile 989):
```ts
        // Der Preisfaktor geht NIE in den Prompt — er wird erst nach der Antwort
        // auf die Positionen gestempelt (Spec: Vault beeinflusst keine Preise).
        preisfaktorNutzer = klemmePreisfaktor(profil?.preisfaktor) ?? PREISFAKTOR_STANDARD
```
Im Erfolgspfad (Zeile 1131) nach `const validated = …` einfügen:
```ts
      // Preisfaktor des Betriebs auf die frisch entstandenen Positionen stempeln.
      // Nach validateAndFix, damit der deterministische vkStunde-/aufschlag-Override
      // unberuehrt bleibt — der Faktor ist reine Nachrechnung auf den Endpreis.
      const positionenRoh = (validated as { positionen?: unknown }).positionen
      if (Array.isArray(positionenRoh)) {
        (validated as { positionen: unknown }).positionen =
          stempelPreisfaktor(positionenRoh as Array<{ preisfaktor?: number }>, preisfaktorNutzer)
      }
```

- [ ] **Step 4: Optimieren-Route — neue Positionen aus dem Chat stempeln**

Import ergänzen:
```ts
import { stempelPreisfaktor, PREISFAKTOR_STANDARD, klemmePreisfaktor } from '@/lib/preisfaktor'
```
Neben `let firmenStandort = ''` (Zeile 337) ergänzen:
```ts
    let preisfaktorNutzer = PREISFAKTOR_STANDARD
```
Der Profil-Select (Zeile 365-369) wird zu:
```ts
        const { data: profil, error: profilErr } = await supabase
          .from('betriebsprofil')
          .select('strasse, plz, ort, preisfaktor')
          .eq('user_id', user.id)
          .single()
        if (profilErr) console.error('[optimize] Betriebsprofil:', profilErr.message)
        preisfaktorNutzer = klemmePreisfaktor(profil?.preisfaktor) ?? PREISFAKTOR_STANDARD
```
`applyUserRates` bekommt einen sechsten Parameter (Zeile 223-229):
```ts
function applyUserRates(
  offer: Record<string, unknown>,
  customSaetze: Record<string, number>,
  matGruppen: Array<{ name: string; aufschlag_prozent: number }>,
  deaktiviert: Set<string> = new Set(),
  faktoren: Faktoren = KEINE_FAKTOREN,
  preisfaktor: number = PREISFAKTOR_STANDARD,
): Record<string, unknown> {
```
und am Ende der Funktion (Zeile 253-254) wird
```ts
    return { ...pos, arbeitszeit, material }
  })
  return offer
```
zu
```ts
    return { ...pos, arbeitszeit, material }
  })
  // Neue Positionen aus dem Chat bekommen den heutigen Preisfaktor; bereits
  // gestempelte behalten ihren. Sonst wuerde ein Optimieren-Lauf ein verschicktes
  // Angebot rueckwirkend teurer machen.
  offer.positionen = stempelPreisfaktor(
    offer.positionen as Array<{ preisfaktor?: number }>, preisfaktor,
  )
  return offer
```
Der Aufruf (Zeile 545) wird zu:
```ts
        ? applyUserRates(parsed.updatedOffer as Record<string, unknown>, customSaetze, matGruppen, deaktiviert, faktoren, preisfaktorNutzer)
```

- [ ] **Step 5: Typprüfung und Tests**

Run: `npx tsc --noEmit -p tsconfig.json | grep -v "^.next/"` → keine Ausgabe.
Run: `npm run test` → alles grün.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/settings/betriebsprofil/route.ts src/app/api/settings/kalibrierung/route.ts src/app/api/analyze/route.ts src/app/api/optimize/route.ts
git commit -m "feat(preisfaktor): serverseitig speichern, klemmen und auf neue Positionen stempeln"
```

---

### Task P3: Oberfläche — „Mein Betrieb“ und die Kalkulationsübersicht

**Files:**
- Modify: `src/components/settings/BetriebSettings.tsx:16-46` (Typ + Texte), `:111-149` (Prüfung), `:331-371` (Zeitfaktoren), neuer Abschnitt „Preisfaktor“ nach Zeile 371
- Modify: `src/app/page.tsx:120-122` (`defaultAngebotspos`), `:724` (`addPos`), `:1045` (neues Angebot), `:3734-3746` (Übersicht)

**Interfaces:**
- Consumes: `klemmePreisfaktor`, `angezeigterPreisfaktor`, `PREISFAKTOR_MIN`, `PREISFAKTOR_MAX`, `PREISFAKTOR_STANDARD` (Task P1); `PATCH /api/settings/betriebsprofil` (Task P2)
- Produces: Abschnitt „Preisfaktor“ in „Mein Betrieb“; Übersichtszeile „Preisfaktor 1,25“ in der Kalkulation

- [ ] **Step 1: Zeitfaktor-Eingaben auf 0,50–3,00 weiten**

In `src/components/settings/BetriebSettings.tsx` die Vorab-Prüfung (Zeilen 115-121) ersetzen durch:

```ts
      // Erst pruefen, dann senden — sonst landet eine leere Eingabe als 0 beim Server.
      // Grenzen wie serverseitig (deckeleHand): 0,50 bis 3,00.
      for (const { feld, name } of FAKTOR_TEXTE) {
        const w = Number(k[feld])
        if (!Number.isFinite(w) || w < 0.5 || w > 3) {
          setFaktorenMeldung({ ok: false, text: `${name}: Bitte einen Wert zwischen 0,50 und 3,00 eintragen.` })
          return
        }
      }
```

Im Eingabefeld (Zeile 342) `min="0.6" max="1.4"` ersetzen durch `min="0.5" max="3"`.

Den Erklärtext über den Zeitfaktoren (Zeilen 332-335) ersetzen durch:

```tsx
      <p style={{ color: C.textMid, fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
        Deine Zeiten im Verhältnis zu den CraftFlow-Werten. Du kannst
        jeden Wert von Hand überschreiben (0,50 bis 3,00) — dann gilt deine Zahl statt
        der abgeleiteten. Achtung: Zeitfaktoren verändern auch „Stunden gesamt“. Wenn du
        nur teurer verkaufen willst, nimm den Preisfaktor darunter.
      </p>
```

- [ ] **Step 2: Abschnitt „Preisfaktor“ ergänzen**

Importe oben in der Datei ergänzen:
```ts
import { klemmePreisfaktor, PREISFAKTOR_STANDARD } from '@/lib/preisfaktor'
```
Zustand nach Zeile 74 (`const [aufschlag, setAufschlag] = useState(0.30)`) ergänzen:

```ts
  // Preisfaktor: eigener Zustand, eigenes Laden, eigener Knopf — dasselbe Muster wie
  // "Faktoren von Hand uebernehmen" (aktiv nur bei Aenderung, Meldung daneben).
  const [preisfaktor, setPreisfaktor] = useState<number>(PREISFAKTOR_STANDARD)
  const [preisfaktorGeladen, setPreisfaktorGeladen] = useState<number>(PREISFAKTOR_STANDARD)
  const [preisfaktorMeldung, setPreisfaktorMeldung] = useState<{ ok: boolean; text: string } | null>(null)
  const [preisfaktorSpeichern, setPreisfaktorSpeichern] = useState(false)
```

In `laden()` am Ende (vor `setLaedt(false)`, Zeile 108) ergänzen:

```ts
    // Der Preisfaktor steht im Betriebsprofil, nicht in der Kalibrierung.
    const resP = await fetch('/api/settings/betriebsprofil')
    if (resP.ok) {
      const jp = await resP.json() as { profil?: { preisfaktor?: number | string | null } | null }
      const wert = klemmePreisfaktor(jp.profil?.preisfaktor) ?? PREISFAKTOR_STANDARD
      setPreisfaktor(wert)
      setPreisfaktorGeladen(wert)
    }
```

Neue Speicherfunktion nach `faktorenGeaendert` (Zeile 149) ergänzen:

```ts
  const preisfaktorGeaendert = Math.abs(Number(preisfaktor) - Number(preisfaktorGeladen)) > 0.0001

  async function speicherePreisfaktor() {
    setPreisfaktorMeldung(null)
    const wert = klemmePreisfaktor(preisfaktor)
    if (wert === null || Number(preisfaktor) < 0.5 || Number(preisfaktor) > 3) {
      setPreisfaktorMeldung({ ok: false, text: 'Bitte einen Wert zwischen 0,50 und 3,00 eintragen.' })
      return
    }
    setPreisfaktorSpeichern(true)
    const res = await fetch('/api/settings/betriebsprofil', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preisfaktor: wert }),
    })
    const j = await res.json().catch(() => ({})) as { error?: string }
    setPreisfaktorSpeichern(false)
    if (!res.ok) { setPreisfaktorMeldung({ ok: false, text: j.error ?? 'Speichern fehlgeschlagen' }); return }
    setPreisfaktor(wert); setPreisfaktorGeladen(wert)
    setPreisfaktorMeldung({ ok: true, text: 'Gespeichert — der Faktor gilt für neue Positionen.' })
  }
```

Und nach dem Trennstrich hinter den Zeitfaktoren (Zeile 373, `<div style={{ height: 1, background: C.border, margin: '30px 0' }} />`) den neuen Abschnitt einfügen:

```tsx
      <div style={{ color: C.white, fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Preisfaktor</div>
      <p style={{ color: C.textMid, fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
        Multipliziert den Preis jeder neuen Position. Stunden und Stundensätze bleiben,
        wie sie sind. 1,00 = CraftFlow-Preis, 1,20 = 20 % teurer.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14,
        background: C.gray1, borderRadius: 8, padding: '12px 14px', marginBottom: 10 }}>
        <input type="number" step="0.01" min="0.5" max="3"
          value={Number.isFinite(preisfaktor) ? preisfaktor : ''}
          onChange={e => { setPreisfaktorMeldung(null); setPreisfaktor(e.target.value === '' ? NaN : Number(e.target.value)) }}
          style={{ width: 80, background: C.gray2, border: `1px solid ${C.border}`,
            borderRadius: 6, color: C.white, padding: '8px 10px', fontSize: 14 }} />
        <div style={{ color: C.textMid, fontSize: 12, lineHeight: 1.5 }}>
          {Math.abs(Number(preisfaktor) - 1) < 0.005
            ? 'Ich rechne den CraftFlow-Preis.'
            : Number(preisfaktor) > 1
              ? `Ich schlage ${Math.round((Number(preisfaktor) - 1) * 100)} % auf jede neue Position auf.`
              : `Ich gebe ${Math.round((1 - Number(preisfaktor)) * 100)} % auf jede neue Position nach.`}
          <br />Bereits erstellte Angebote bleiben, wie sie sind.
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 8 }}>
        <button onClick={() => void speicherePreisfaktor()} disabled={!preisfaktorGeaendert || preisfaktorSpeichern} style={{
          background: preisfaktorGeaendert ? C.copper : 'transparent',
          border: preisfaktorGeaendert ? 'none' : `1px solid ${C.border}`, borderRadius: 8,
          color: preisfaktorGeaendert ? C.black : C.textMid, fontWeight: preisfaktorGeaendert ? 700 : 400,
          padding: '10px 18px', fontSize: 13, cursor: preisfaktorGeaendert ? 'pointer' : 'default',
          opacity: preisfaktorSpeichern ? 0.6 : 1 }}>
          {preisfaktorSpeichern ? 'Speichert …' : 'Preisfaktor übernehmen'}
        </button>
        {preisfaktorMeldung && (
          <span style={{ fontSize: 13, color: preisfaktorMeldung.ok ? C.ok : C.err }}>{preisfaktorMeldung.text}</span>
        )}
        {!preisfaktorMeldung && !preisfaktorGeaendert && (
          <span style={{ fontSize: 12, color: C.textMid }}>Ändere den Wert, dann kannst du ihn hier übernehmen.</span>
        )}
      </div>

      <div style={{ height: 1, background: C.border, margin: '30px 0' }} />
```

- [ ] **Step 3: Manuell angelegte Positionen stempeln**

In `src/app/page.tsx` den Import ergänzen:
```ts
import { klemmePreisfaktor, angezeigterPreisfaktor, PREISFAKTOR_STANDARD } from '@/lib/preisfaktor'
```
`defaultAngebotspos` (Zeile 120-122) wird zu:
```ts
const defaultAngebotspos = (id: number, preisfaktor = 1): Angebotsposition => ({
  id, titel: 'Neue Position', beschreibung: '', material: [], arbeitszeit: [],
  // Faktor 1,00 bleibt weg — sonst steht das Feld in jedem Angebot herum.
  ...(preisfaktor !== 1 ? { preisfaktor } : {}),
})
```
Neben `const totals = { net: nettoSumme(pos) }` (Zeile 791) ergänzen:
```ts
  // Preisfaktor des Betriebs fuer NEU angelegte Positionen. Das rohe Profil liegt
  // bereits vor (profilRoh) — dieselbe Quelle wie die PDF-Optionen.
  const preisfaktorAktuell = klemmePreisfaktor(profilRoh.preisfaktor) ?? PREISFAKTOR_STANDARD
  const preisfaktorAnzeige = angezeigterPreisfaktor(pos)
```
`addPos` (Zeile 724) wird zu:
```ts
  const addPos = () => setPos(prev => [...prev, defaultAngebotspos(Date.now(), preisfaktorAktuell)])
```
Zeile 1045 (`setPos([defaultAngebotspos(Date.now())])`) wird zu:
```ts
    setPos([defaultAngebotspos(Date.now(), preisfaktorAktuell)])
```
Zeile 584 (`useState<Angebotsposition[]>([defaultAngebotspos(Date.now())])`) bleibt **unverändert**: Das Profil ist beim ersten Rendern noch nicht geladen; diese Platzhalter-Position wird durch die Analyse oder durch „neues Angebot“ ohnehin ersetzt.

- [ ] **Step 4: Zeile „Preisfaktor“ in der Kalkulationsübersicht**

In `src/app/page.tsx` den zweiten Übersichtsstreifen (Zeilen 3734-3746) so ändern, dass die Liste bedingt eine dritte Zelle bekommt:

```tsx
              <div style={{ display: 'flex', borderTop: `1px solid ${C.border}` }}>
                {[
                  { l: 'Materialkosten gesamt', v: eur(materialGesamt) },
                  { l: 'Stunden gesamt', v: `${stundenGesamtWert.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} h` },
                  // Nur zeigen, wenn er wirklich wirkt (Spec: nur wenn ungleich 1,00).
                  ...(preisfaktorAnzeige === null ? [] : [{
                    l: 'Preisfaktor',
                    v: preisfaktorAnzeige === 'gemischt'
                      ? 'gemischt'
                      : preisfaktorAnzeige.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                  }]),
                ].map(({ l, v }, i) => (
```

(Der Rest des Blocks bleibt unverändert.)

- [ ] **Step 5: Typprüfung, Lint, Tests**

Run: `npx tsc --noEmit -p tsconfig.json | grep -v "^.next/"` → keine Ausgabe.
Run: `npm run lint` → keine **neuen** Fehler.
Run: `npm run test` → alles grün.

- [ ] **Step 6: Commit**

```bash
git add src/components/settings/BetriebSettings.tsx src/app/page.tsx
git commit -m "feat(preisfaktor): Abschnitt in Mein Betrieb, Zeitfaktoren 0,50-3,00, Zeile in der Kalkulationsübersicht"
```

---

### Task P4: Assistent, Live-Prüfung auf der dev-Vorschau, Doku

**Files:**
- Modify: `src/lib/assistentwissen.ts:49` (Bereich `betrieb`), `:64-68` (`PFLICHTTHEMEN`), `:194-200` („WAS VIELE ÜBERSEHEN“)
- Modify: `CLAUDE.md` (neuer Abschnitt „Preisfaktor & Zeitfaktoren“)

**Interfaces:**
- Consumes: `assistentWissen`, `PFLICHTTHEMEN` (bestehend)
- Produces: keine neuen Signaturen

- [ ] **Step 1: Test zuerst — der Assistent muss den Preisfaktor kennen**

In `src/lib/assistentwissen.ts` `PFLICHTTHEMEN` (Zeile 64-68) ergänzen:

```ts
export const PFLICHTTHEMEN = [
  'Stückzahl', 'Alternativposition', 'Gruppe', 'Textbaustein', 'Schriftart',
  'Kleinunternehmer', 'Materialpreise', 'Bauweise', 'Mein Betrieb',
  'Optimieren', 'Vorschau', 'Briefpapier', 'Preisfaktor',
] as const
```

Run: `node --test tests/assistentwissen.test.mjs`
Expected: FAIL, „Thema "Preisfaktor" fehlt im Wissen“

- [ ] **Step 2: Wissen ergänzen**

Der Bereich `betrieb` (Zeile 49) wird zu:

```ts
  { id: 'betrieb', label: 'Mein Betrieb', zweck: `Betriebskalibrierung (${abPlan('kalibrierung')}): acht bis neun Fragen (je nach Schwerpunkt) zu Maschinen, Schwerpunkt, Montage, Stückzahlen und einem Referenzmöbel. Daraus rechnet CraftFlow mit den Zeiten dieses Betriebs statt mit den CraftFlow-Werten. Dort auch: Zeitfaktoren von Hand (0,50 bis 3,00), der Preisfaktor und die Lernschleife aus gewonnenen Angeboten (${abPlan('lernschleife')})` },
```

In „WAS VIELE ÜBERSEHEN“ (nach der Zeile zu „MEIN BETRIEB“, Zeile 197-198) ergänzen:

```
→ PREISFAKTOR: Einstellungen → Mein Betrieb. Multipliziert den Preis jeder neuen Position — Material und Lohn zusammen. Stunden und Stundensätze bleiben, wie sie sind. 1,00 = CraftFlow-Preis, 1,20 = 20 % teurer. Erlaubt sind 0,50 bis 3,00. Wichtig: Er wirkt nur auf Positionen, die NACH dem Einstellen entstehen — bereits erstellte Angebote ändern sich nicht. Im Angebots-PDF steht er nicht; der Kunde sieht nur Endpreise.
→ ZEITFAKTOREN gegen PREISFAKTOR: Zeitfaktoren ändern die Minuten und damit auch „Stunden gesamt“ und den Export. Wer nur teurer verkaufen will, nimmt den Preisfaktor.
```

Und in „HÄUFIGE FRAGEN“ (nach Zeile 212) ergänzen:

```
→ „Wie verkaufe ich einfach 20 % teurer?" — Einstellungen → Mein Betrieb → Preisfaktor auf 1,20 stellen und übernehmen. Ab dann rechnet CraftFlow jede neue Position 20 % höher; Stunden und Stundensätze bleiben gleich.
```

Run: `node --test tests/assistentwissen.test.mjs` → grün.
Run: `npm run test` → alles grün.

- [ ] **Step 3: Commit (Code vollständig), dann SQL durch den Controller**

```bash
git add src/lib/assistentwissen.ts
git commit -m "docs(assistent): Preisfaktor und Zeitfaktoren 0,50-3,00 im Hilfe-Assistenten"
git push origin dev
```

**Der Controller führt jetzt `docs/sql/2026-09-16-preisfaktor.sql` im Supabase-SQL-Editor aus** (Editor vorher leeren, Inhalt gegenlesen). Erst danach hat die dev-Vorschau die Spalte — ohne sie antwortet `PATCH /api/settings/betriebsprofil` mit 500.

- [ ] **Step 4: Live-Prüfung auf `https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app`**

Regel: **so wenige KI-Aufrufe wie nötig, nie in Schleifen.** Die Schritte 1-4 kosten nichts, nur Schritt 5 ruft die KI **einmal** auf.

  1. `/settings` → „Mein Betrieb“: Der Abschnitt „Preisfaktor“ ist da, steht auf 1,00, der Knopf ist grau. Zeitfaktor-Felder akzeptieren 2,50 (vorher rot bei > 1,4).
  2. Preisfaktor auf `4` setzen → Knopf drücken → serverseitig geklemmt auf 3,00; Meldung „Gespeichert — der Faktor gilt für neue Positionen.“ Neu laden: 3,00 steht da.
  3. Per `fetch` im eingeloggten Tab: `PATCH /api/settings/betriebsprofil` mit `{"preisfaktor":"abc"}` → **400** und Text „Preisfaktor: „abc" ist keine Zahl zwischen 0,50 und 3,00.“
  4. Preisfaktor auf 1,25 setzen. Ein **bestehendes** Projekt öffnen: Summe und Übersicht unverändert, keine Zeile „Preisfaktor“ (alte Positionen tragen keinen Faktor).
  5. **Ein** neues Angebot erzeugen (kleiner Text, keine Bilder — ein KI-Aufruf): Die Kalkulationsübersicht zeigt „Preisfaktor 1,25“; „Stunden gesamt“ und „Materialkosten gesamt“ entsprechen den Positionszeilen; „Positionsgesamt“ ist 1,25 × (Material + Lohn). PDF anzeigen: **kein** Preisfaktor im Dokument, Endsummen stimmen mit der App überein.
  6. Im selben Angebot „+ Position hinzufügen“ → die neue Position trägt ebenfalls 1,25 (Übersicht bleibt bei „1,25“, nicht „gemischt“).
  7. Preisfaktor zurück auf 1,00 stellen. Screenshots unter `/tmp/cfshots/preisfaktor-*.png`.

- [ ] **Step 5: CLAUDE.md**

Neuen Abschnitt nach „Kalkulations-Engine — verbindliche Invarianten“ einfügen:

```markdown
## Preisfaktor & Zeitfaktoren (Stand 2026-09-16)
- **Zwei verschiedene Hebel, nie verwechseln.** Zeitfaktoren (`kalibrierung.ts`) ändern
  die Minuten — und damit „Stunden gesamt“ und den Export. Der **Preisfaktor**
  (`src/lib/preisfaktor.ts`) multipliziert nur den Endpreis der Position, Material und
  Lohn zusammen; Stunden, Stundensätze und Aufschläge bleiben unberührt.
- **Grenzen:** Zeitfaktoren von Hand 0,50–3,00 (`deckeleHand`), Ableitung aus den
  Kalibrierungsantworten unverändert 0,6–1,4 (`deckele` — die fünf Antwortbänder sind
  genau darauf zurückgerechnet). Preisfaktor 0,50–3,00, Standard 1,00.
- **Gestempelt, nicht nachgeschlagen:** `Angebotsposition.preisfaktor` wird gesetzt, wenn
  die Position entsteht (analyze nach `validateAndFix`, optimize in `applyUserRates`,
  manuell in `defaultAngebotspos`). Bestehende Faktoren werden nie überschrieben — ein
  verschicktes Angebot darf sich nicht rückwirkend verändern.
- **Eine Rechenstelle:** `calcAngebotspos` in `src/lib/types.ts`. Wer selbst multipliziert,
  bringt App, PDF und Export auseinander. Ein kaputter Wert gilt als 1,00 (ein NaN würde
  sonst die ganze Angebotssumme zerstören).
- Der Preisfaktor geht **nie** in einen KI-Prompt und erscheint **nie** im PDF.
- Speicherort `betriebsprofil.preisfaktor numeric(4,2) not null default 1.00`
  (`docs/sql/2026-09-16-preisfaktor.sql`). Tests: `tests/preisfaktor.test.mjs`.
```

```bash
git add CLAUDE.md
git commit -m "docs: Preisfaktor und Zeitfaktoren — Regeln für künftige Änderungen"
git push origin dev
```

---

# Teil W — Wünsche-Community

### Task W1: Deckel-Art `wunschStimmen` und die reine Wunsch-Logik

**Files:**
- Modify: `src/lib/plaene.ts:27` (`DeckelArt`), `:41-62` (`PLAENE`), `:107-113` (Kommentar unverändert)
- Modify: `src/lib/plantexte.ts:29-36` (`DECKEL_NAME`), Ende der Datei (`stimmenAblehnung`)
- Create: `src/lib/wuensche.ts`
- Create: `tests/wuensche.test.mjs`
- Modify: `tests/plaene.test.mjs:28-30` (neuer Deckel-Test), `:45-56` (Monotonie-Liste)
- Modify: `tests/plantexte.test.mjs` (Test für `stimmenAblehnung`)

**Interfaces:**
- Produces:
  - `DeckelArt` enthält `'wunschStimmen'`; `deckel(plan, 'wunschStimmen')` = 1 / 3 / 10 / 30
  - `stimmenAblehnung(plan: Plan): { error: string; minPlan: Plan | null }` (`plantexte.ts`)
  - `src/lib/wuensche.ts`: `WunschStatus`, `WUNSCH_STATUS`, `STATUS_LABEL`, `OEFFENTLICHE_STATUS`, `TITEL_MAX = 120`, `BESCHREIBUNG_MAX = 1000`, `VORSCHLAEGE_JE_TAG = 3`, `istWunschStatus`, `pruefeTexte`, `Stimme`, `stimmenbudget`, `aktiveStimmen`, `stimmenJeWunsch`
- Consumes: `deckel`, `effektiverPlan`, `wendeDeckelAn`, `naechsterPlanMitMehr`, `PLAN_LABELS`, `ProfilFuerPlan` aus `plaene.ts`

- [ ] **Step 1: Tests schreiben**

```js
// tests/wuensche.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deckel } from '../src/lib/plaene.ts'
import { stimmenAblehnung } from '../src/lib/plantexte.ts'
import {
  WUNSCH_STATUS, STATUS_LABEL, OEFFENTLICHE_STATUS, TITEL_MAX, BESCHREIBUNG_MAX,
  VORSCHLAEGE_JE_TAG, istWunschStatus, pruefeTexte, stimmenbudget,
  aktiveStimmen, stimmenJeWunsch,
} from '../src/lib/wuensche.ts'

// Ein Konto, das noch in der Testphase ist, gilt als Enterprise (30 Stimmen).
const LAEUFT = { plan: 'solo', trial_starts_at: '2026-09-15T00:00:00Z' }
const jetzt = new Date('2026-09-16T12:00:00Z')
const mitPlan = (p) => ({ plan: p, trial_starts_at: '2026-01-01T00:00:00Z', abo_status: 'aktiv' })

test('Stimmenbudget je Plan: 1 / 3 / 10 / 30', () => {
  assert.deepEqual(['solo','starter','pro','enterprise'].map(p => deckel(p, 'wunschStimmen')), [1, 3, 10, 30])
  assert.equal(stimmenbudget(mitPlan('solo'), jetzt), 1)
  assert.equal(stimmenbudget(mitPlan('pro'), jetzt), 10)
  assert.equal(stimmenbudget(LAEUFT, jetzt), 30, 'Testphase = Enterprise = 30')
  assert.equal(stimmenbudget(null, jetzt), 0, 'gesperrt: keine Stimme')
})

test('Der Status-Vorrat steht fest, Ausgeblendet ist nicht öffentlich', () => {
  assert.deepEqual(WUNSCH_STATUS, ['offen', 'geplant', 'in_arbeit', 'fertig', 'ausgeblendet'])
  assert.deepEqual(OEFFENTLICHE_STATUS, ['geplant', 'in_arbeit', 'fertig'])
  assert.equal(STATUS_LABEL.in_arbeit, 'In Arbeit')
  assert.ok(istWunschStatus('fertig'))
  assert.ok(!istWunschStatus('erledigt'))
  assert.ok(!istWunschStatus(null))
})

test('Textgrenzen: 120 Zeichen Titel, 1000 Zeichen Beschreibung', () => {
  assert.equal(TITEL_MAX, 120)
  assert.equal(BESCHREIBUNG_MAX, 1000)
  assert.equal(VORSCHLAEGE_JE_TAG, 3)
  assert.deepEqual(pruefeTexte('  Serienbriefe  ', ' bitte '), { ok: true, titel: 'Serienbriefe', beschreibung: 'bitte' })
  assert.deepEqual(pruefeTexte('   ', 'x'), { ok: false, grund: 'Bitte gib einen Titel an.' })
  assert.deepEqual(pruefeTexte('a'.repeat(121), ''), { ok: false, grund: 'Der Titel darf höchstens 120 Zeichen haben.' })
  assert.deepEqual(pruefeTexte('ok', 'b'.repeat(1001)), { ok: false, grund: 'Die Beschreibung darf höchstens 1000 Zeichen haben.' })
  assert.deepEqual(pruefeTexte('ok', null), { ok: true, titel: 'ok', beschreibung: '' })
})

test('Wechsel nach unten: die ältesten N Stimmen bleiben aktiv, der Rest zählt nicht', () => {
  // Dieselbe Regel wie überall (wendeDeckelAn). Nichts wird gelöscht — ein Upgrade
  // schaltet die inaktiven Stimmen sofort wieder scharf.
  const stimmen = [
    { wunsch_id: 'w1', user_id: 'u1', created_at: '2026-09-01T00:00:00Z' },
    { wunsch_id: 'w2', user_id: 'u1', created_at: '2026-09-02T00:00:00Z' },
    { wunsch_id: 'w3', user_id: 'u1', created_at: '2026-09-03T00:00:00Z' },
    { wunsch_id: 'w1', user_id: 'u2', created_at: '2026-09-04T00:00:00Z' },
  ]
  const profile = { u1: mitPlan('solo'), u2: mitPlan('pro') }   // 1 bzw. 10 Stimmen
  const aktiv = aktiveStimmen(stimmen, profile, jetzt)
  assert.deepEqual(aktiv.map(s => `${s.user_id}:${s.wunsch_id}`), ['u1:w1', 'u2:w1'])
  assert.deepEqual(stimmenJeWunsch(stimmen, profile, jetzt), { w1: 2, w2: 0, w3: 0 })
})

test('Ohne Profil (gesperrt) zählt keine Stimme, und niemand fällt aus der Liste', () => {
  const stimmen = [{ wunsch_id: 'w1', user_id: 'u9', created_at: '2026-09-01T00:00:00Z' }]
  assert.deepEqual(aktiveStimmen(stimmen, {}, jetzt), [])
  assert.deepEqual(stimmenJeWunsch(stimmen, {}, jetzt), { w1: 0 })
})

test('Volles Budget wird mit Zahl, Ausweg und nächstem Plan abgelehnt', () => {
  assert.deepEqual(stimmenAblehnung('starter'), {
    error: 'Du hast alle 3 Stimmen deines Plans vergeben. Nimm eine zurück oder wechsle den Plan.',
    minPlan: 'pro',
  })
  assert.deepEqual(stimmenAblehnung('enterprise'), {
    error: 'Du hast alle 30 Stimmen deines Plans vergeben. Nimm eine zurück oder wechsle den Plan.',
    minPlan: null,
  })
})
```

Ergänzungen in `tests/plaene.test.mjs`: nach dem Nutzer-Test (Zeile 28-30) einfügen

```js
test('Stimmen für Wünsche: 1 / 3 / 10 / 30 (Testphase = Enterprise = 30)', () => {
  assert.deepEqual(['solo','starter','pro','enterprise'].map(p => deckel(p, 'wunschStimmen')), [1, 3, 10, 30])
})
```

und in der Monotonie-Schleife (Zeile 47) die Liste erweitern:

```js
  for (const art of ['angebote','optimierenRunden','dateien','bauweiseRegeln','materialpreise','nutzer','wunschStimmen']) {
```

Ergänzung in `tests/plantexte.test.mjs` (am Ende der Datei):

```js
test('Deckel-Ablehnung kennt auch die Stimmen für Wünsche', () => {
  assert.deepEqual(deckelAblehnung('wunschStimmen', 'solo', 1),
    { error: 'Im Solo-Plan ist 1 Stimme für Wünsche möglich. Ab dem Starter-Plan 3 Stimmen für Wünsche.', minPlan: 'starter' })
})
```

(Der Import in `tests/plantexte.test.mjs` muss `deckelAblehnung` und `stimmenAblehnung` enthalten.)

- [ ] **Step 2: Tests laufen lassen — müssen fehlschlagen**

Run: `node --test tests/wuensche.test.mjs`
Expected: FAIL, „Cannot find module … src/lib/wuensche.ts“

- [ ] **Step 3: `plaene.ts` erweitern**

Zeile 27 wird zu:
```ts
export type DeckelArt = 'angebote' | 'optimierenRunden' | 'dateien' | 'bauweiseRegeln' | 'materialpreise' | 'nutzer' | 'wunschStimmen'
```
In `PLAENE` bekommt jeder Plan einen Eintrag (Spec 2026-09-16, Teil W):
```ts
    deckel: { angebote: 3, optimierenRunden: 5, dateien: 0, bauweiseRegeln: 0, materialpreise: 0, nutzer: 1, wunschStimmen: 1 },
```
```ts
    deckel: { angebote: 15, optimierenRunden: 10, dateien: 5, bauweiseRegeln: 5, materialpreise: 20, nutzer: 1, wunschStimmen: 3 },
```
```ts
    deckel: { angebote: 50, optimierenRunden: 20, dateien: 25, bauweiseRegeln: null, materialpreise: null, nutzer: 3, wunschStimmen: 10 },
```
```ts
    deckel: { angebote: 150, optimierenRunden: 40, dateien: 60, bauweiseRegeln: null, materialpreise: null, nutzer: null, wunschStimmen: 30 },
```

`merkmaleFuerAnzeige` bleibt **unverändert** — die Stimmen stehen bewusst nicht auf den Plan-Kacheln (sonst müsste auch `~/craftflow-web/lib/plaene.json` neu exportiert werden, und `tests/plaene-website.test.mjs` schlüge an). Die Community ist ein Zusatz, kein Verkaufsargument.

- [ ] **Step 4: `plantexte.ts` erweitern**

`DECKEL_NAME` (Zeile 29-36) bekommt eine Zeile:
```ts
  wunschStimmen: ['Stimme für Wünsche', 'Stimmen für Wünsche'],
```
Am Ende der Datei ergänzen:
```ts
/**
 * 403-Antwortkörper: Das Stimmenbudget des Plans ist aufgebraucht.
 * Eigener Text statt deckelAblehnung, weil hier ein AUSWEG dazugehört — eine Stimme
 * zurücknehmen kostet nichts und ist meistens das, was der Nutzer will.
 */
export function stimmenAblehnung(plan: Plan): { error: string; minPlan: Plan | null } {
  const n = deckel(plan, 'wunschStimmen') ?? 0
  return {
    error: `Du hast alle ${n} Stimmen deines Plans vergeben. Nimm eine zurück oder wechsle den Plan.`,
    minPlan: naechsterPlanMitMehr('wunschStimmen', plan),
  }
}
```

- [ ] **Step 5: `src/lib/wuensche.ts` anlegen**

```ts
// src/lib/wuensche.ts
// Die reine Logik der Wünsche-Community: Status, Textgrenzen und die Frage, welche
// Stimme zählt. Importiert nur aus ./plaene.ts (mit .ts-Endung) — damit
// `npm run test` die Datei direkt ausführen kann.
//
// WARUM DIE ZÄHLUNG HIER LIEGT und nicht in einer SQL-View: Ob eine Stimme zählt,
// hängt am PLAN ihres Urhebers, und die Plan-Logik steht in plaene.ts. Eine View
// müsste sie nachbauen — und würde beim nächsten Matrix-Wechsel lautlos falsch.

import {
  deckel, effektiverPlan, wendeDeckelAn, type ProfilFuerPlan,
} from './plaene.ts'

export type WunschStatus = 'offen' | 'geplant' | 'in_arbeit' | 'fertig' | 'ausgeblendet'

export const WUNSCH_STATUS: WunschStatus[] = ['offen', 'geplant', 'in_arbeit', 'fertig', 'ausgeblendet']

export const STATUS_LABEL: Record<WunschStatus, string> = {
  offen: 'Offen', geplant: 'Geplant', in_arbeit: 'In Arbeit',
  fertig: 'Fertig', ausgeblendet: 'Ausgeblendet',
}

/** Was auf der öffentlichen Roadmap der Website erscheint. „Offen“ bleibt in der App. */
export const OEFFENTLICHE_STATUS: WunschStatus[] = ['geplant', 'in_arbeit', 'fertig']

export const TITEL_MAX = 120
export const BESCHREIBUNG_MAX = 1000
/** Gegen Spam: so viele neue Vorschläge darf ein Nutzer am Tag einreichen. */
export const VORSCHLAEGE_JE_TAG = 3

export function istWunschStatus(v: unknown): v is WunschStatus {
  return typeof v === 'string' && (WUNSCH_STATUS as string[]).includes(v)
}

export type TextPruefung =
  | { ok: true; titel: string; beschreibung: string }
  | { ok: false; grund: string }

/** Prüft und beschneidet die Eingaben. Kein stilles Abschneiden — zu lang wird abgelehnt. */
export function pruefeTexte(titel: unknown, beschreibung: unknown): TextPruefung {
  const t = String(titel ?? '').trim()
  const b = String(beschreibung ?? '').trim()
  if (!t) return { ok: false, grund: 'Bitte gib einen Titel an.' }
  if (t.length > TITEL_MAX) return { ok: false, grund: `Der Titel darf höchstens ${TITEL_MAX} Zeichen haben.` }
  if (b.length > BESCHREIBUNG_MAX) return { ok: false, grund: `Die Beschreibung darf höchstens ${BESCHREIBUNG_MAX} Zeichen haben.` }
  return { ok: true, titel: t, beschreibung: b }
}

export type Stimme = { wunsch_id: string; user_id: string; created_at: string }

/** Wie viele Stimmen dieser Nutzer nach seinem Plan hat. Gesperrt = 0. */
export function stimmenbudget(profil: ProfilFuerPlan | null | undefined, jetzt: Date = new Date()): number {
  return deckel(effektiverPlan(profil, jetzt), 'wunschStimmen') ?? 0
}

/**
 * Welche Stimmen zählen. Je Nutzer bleiben die ÄLTESTEN N aktiv (wendeDeckelAn),
 * alle weiteren zählen nicht — dieselbe Regel wie bei Bauweise-Regeln und
 * Materialpreisen. Nichts wird gelöscht; ein Upgrade wirkt sofort beim nächsten Lesen.
 */
export function aktiveStimmen(
  stimmen: Stimme[],
  profile: Record<string, ProfilFuerPlan | null | undefined>,
  jetzt: Date = new Date(),
): Stimme[] {
  const jeNutzer = new Map<string, Stimme[]>()
  for (const s of stimmen ?? []) {
    const liste = jeNutzer.get(s.user_id) ?? []
    liste.push(s)
    jeNutzer.set(s.user_id, liste)
  }
  const aktiv: Stimme[] = []
  for (const [userId, liste] of jeNutzer) {
    const budget = stimmenbudget(profile[userId], jetzt)
    for (const s of wendeDeckelAn(liste, budget)) if (s.aktivDurchPlan) aktiv.push(s)
  }
  // Reihenfolge der Eingabe wiederherstellen, damit der Aufrufer sich darauf verlassen kann.
  const erlaubt = new Set(aktiv.map(s => `${s.user_id}|${s.wunsch_id}`))
  return (stimmen ?? []).filter(s => erlaubt.has(`${s.user_id}|${s.wunsch_id}`))
}

/** Zählt je Wunsch die aktiven Stimmen. Wünsche ohne aktive Stimme stehen mit 0 drin. */
export function stimmenJeWunsch(
  stimmen: Stimme[],
  profile: Record<string, ProfilFuerPlan | null | undefined>,
  jetzt: Date = new Date(),
): Record<string, number> {
  const zaehler: Record<string, number> = {}
  for (const s of stimmen ?? []) zaehler[s.wunsch_id] = 0
  for (const s of aktiveStimmen(stimmen, profile, jetzt)) zaehler[s.wunsch_id] += 1
  return zaehler
}
```

- [ ] **Step 6: Tests grün**

Run: `node --test tests/wuensche.test.mjs tests/plaene.test.mjs tests/plantexte.test.mjs` → alle grün.
Run: `npm run test` → alles grün (insbesondere `tests/plaene-website.test.mjs`, das unverändert bleiben muss).
Run: `npx tsc --noEmit -p tsconfig.json | grep -v "^.next/"` → keine Ausgabe.

- [ ] **Step 7: Commit**

```bash
git add src/lib/plaene.ts src/lib/plantexte.ts src/lib/wuensche.ts tests/wuensche.test.mjs tests/plaene.test.mjs tests/plantexte.test.mjs
git commit -m "feat(wuensche): Deckel-Art wunschStimmen (1/3/10/30) und die reine Wunsch-Logik"
```

---

### Task W2: Datenmodell und die Routen für Vorschlagen und Abstimmen

**Files:**
- Create: `docs/sql/2026-09-16-wuensche.sql`
- Create: `src/app/api/wuensche/route.ts`
- Create: `src/app/api/wuensche/[id]/stimme/route.ts`

**Interfaces:**
- Consumes: `pruefeZugang`, `ladeEffektivenPlan` (`planpruefung.ts`), `stimmenAblehnung` (`plantexte.ts`), `pruefeTexte`, `stimmenbudget`, `stimmenJeWunsch`, `VORSCHLAEGE_JE_TAG`, `OEFFENTLICHE_STATUS` (`wuensche.ts`), `getSupabaseClient` (`src/lib/supabase.ts`)
- Produces:
  - `GET /api/wuensche` → `{ wuensche: Array<{ id, titel, beschreibung, status, created_at, stimmen, eigeneStimme, vonDir }>, budget: { gesamt, benutzt }, istAdmin: boolean }`
  - `POST /api/wuensche` `{ titel, beschreibung }` → `201 { wunsch }` | `400 { error }` | `403 { error, minPlan }`
  - `POST /api/wuensche/[id]/stimme` → `{ ok: true, stimmen }` | `403 { error, minPlan }`
  - `DELETE /api/wuensche/[id]/stimme` → `{ ok: true, stimmen }`

- [ ] **Step 1: SQL-Migration schreiben (ausgeführt wird sie vom Controller)**

```sql
-- docs/sql/2026-09-16-wuensche.sql
-- Wünsche-Community (Spec 2026-09-16, Teil W). Jeder Plan darf vorschlagen und
-- abstimmen; das Stimmenbudget je Plan (1/3/10/30) steht in src/lib/plaene.ts und
-- wirkt BEIM LESEN (wendeDeckelAn) — hier wird nichts gelöscht und nichts gedeckelt.

create table if not exists wuensche (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  titel             text not null check (char_length(titel) between 1 and 120),
  beschreibung      text not null default '' check (char_length(beschreibung) <= 1000),
  status            text not null default 'offen'
                      check (status in ('offen','geplant','in_arbeit','fertig','ausgeblendet')),
  zusammengelegt_in uuid references wuensche(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists wuensche_status_idx on wuensche (status, created_at desc);
create index if not exists wuensche_user_idx   on wuensche (user_id, created_at desc);

create table if not exists wunsch_stimmen (
  wunsch_id  uuid not null references wuensche(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (wunsch_id, user_id)   -- je Wunsch höchstens EINE Stimme je Nutzer
);
create index if not exists wunsch_stimmen_user_idx on wunsch_stimmen (user_id, created_at);

alter table wuensche       enable row level security;
alter table wunsch_stimmen enable row level security;

-- Lesen darf jeder Angemeldete — außer Ausgeblendetes.
drop policy if exists "Wünsche lesen" on wuensche;
create policy "Wünsche lesen" on wuensche for select to authenticated
  using (status <> 'ausgeblendet');
drop policy if exists "eigene Wünsche anlegen" on wuensche;
create policy "eigene Wünsche anlegen" on wuensche for insert to authenticated
  with check (auth.uid() = user_id);
-- BEWUSST keine update/delete-Policy für authenticated: Status setzen, zusammenlegen
-- und ausblenden macht ausschließlich die Admin-Route über die Service-Role.

drop policy if exists "eigene Stimmen lesen" on wunsch_stimmen;
create policy "eigene Stimmen lesen" on wunsch_stimmen for select to authenticated
  using (auth.uid() = user_id);
drop policy if exists "eigene Stimmen anlegen" on wunsch_stimmen;
create policy "eigene Stimmen anlegen" on wunsch_stimmen for insert to authenticated
  with check (auth.uid() = user_id);
drop policy if exists "eigene Stimmen löschen" on wunsch_stimmen;
create policy "eigene Stimmen löschen" on wunsch_stimmen for delete to authenticated
  using (auth.uid() = user_id);

-- GRANTS NICHT VERGESSEN (Lehre vom 16.09.): Ohne sie sieht die App "permission
-- denied", und der Supabase-Client liefert still {data: null, error} statt zu werfen.
grant select, insert         on public.wuensche       to authenticated;
grant select, insert, delete on public.wunsch_stimmen to authenticated;
grant select, insert, update, delete on public.wuensche       to service_role;
grant select, insert, update, delete on public.wunsch_stimmen to service_role;
```

- [ ] **Step 2: `GET`/`POST /api/wuensche`**

```ts
// src/app/api/wuensche/route.ts
// Wünsche-Community: Liste (mit aktiven Stimmen und eigenem Budget) und Anlegen.
//
// WARUM HIER EIN SERVICE-ROLE-CLIENT STEHT: Die Stimmenzahl je Wunsch ist die Summe
// der AKTIVEN Stimmen aller Nutzer — und ob eine Stimme aktiv ist, hängt am Plan
// ihres Urhebers. Weder fremde Stimmen noch fremde Betriebsprofile darf der
// angemeldete Nutzer selbst lesen (RLS), deshalb zählt der Server mit erhöhten
// Rechten und gibt nur Zahlen heraus — keine Nutzerdaten.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseClient } from '@/lib/supabase'
import { pruefeZugang } from '@/lib/planpruefung'
import type { ProfilFuerPlan } from '@/lib/plaene'
import {
  pruefeTexte, stimmenbudget, stimmenJeWunsch, VORSCHLAEGE_JE_TAG, type Stimme,
} from '@/lib/wuensche'

const ADMIN_EMAIL = 'l.m.p.1@gmx.de'

/** Alle Stimmen + die Plan-Felder ihrer Urheber — die Grundlage jeder Zählung. */
async function ladeStimmenUndProfile(): Promise<{
  stimmen: Stimme[]; profile: Record<string, ProfilFuerPlan> ; fehler: string | null
}> {
  const service = getSupabaseClient()
  const { data: stimmenRoh, error: stimmenErr } = await service
    .from('wunsch_stimmen')
    .select('wunsch_id, user_id, created_at')
  if (stimmenErr) {
    console.error('[wuensche] Stimmen laden:', stimmenErr.message)
    return { stimmen: [], profile: {}, fehler: stimmenErr.message }
  }
  const stimmen = (stimmenRoh ?? []) as Stimme[]
  const ids = [...new Set(stimmen.map(s => s.user_id))]
  if (ids.length === 0) return { stimmen, profile: {}, fehler: null }
  const { data: profileRoh, error: profilErr } = await service
    .from('betriebsprofil')
    .select('user_id, plan, trial_starts_at, abo_status, plan_gueltig_bis')
    .in('user_id', ids)
  if (profilErr) {
    console.error('[wuensche] Profile laden:', profilErr.message)
    return { stimmen, profile: {}, fehler: profilErr.message }
  }
  const profile: Record<string, ProfilFuerPlan> = {}
  for (const p of profileRoh ?? []) profile[String(p.user_id)] = p as ProfilFuerPlan
  return { stimmen, profile, fehler: null }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const zu = await pruefeZugang(supabase, user.id)
  if (zu) return zu

  // Ausgeblendetes und Zusammengelegtes erscheint nicht in der Liste.
  const { data: wuensche, error: wErr } = await supabase
    .from('wuensche')
    .select('id, user_id, titel, beschreibung, status, created_at')
    .neq('status', 'ausgeblendet')
    .is('zusammengelegt_in', null)
    .order('created_at', { ascending: false })
  if (wErr) return NextResponse.json({ error: wErr.message }, { status: 500 })

  const { stimmen, profile, fehler } = await ladeStimmenUndProfile()
  if (fehler) return NextResponse.json({ error: fehler }, { status: 500 })

  const zaehler = stimmenJeWunsch(stimmen, profile, new Date())
  const eigene = new Set(stimmen.filter(s => s.user_id === user.id).map(s => s.wunsch_id))

  const { data: eigenesProfil, error: pErr } = await supabase
    .from('betriebsprofil')
    .select('plan, trial_starts_at, abo_status, plan_gueltig_bis')
    .eq('user_id', user.id)
    .single()
  if (pErr) console.error('[wuensche] eigenes Profil:', pErr.message)
  const gesamt = stimmenbudget(eigenesProfil as ProfilFuerPlan | null)

  const liste = (wuensche ?? []).map(w => ({
    id: w.id, titel: w.titel, beschreibung: w.beschreibung, status: w.status,
    created_at: w.created_at,
    stimmen: zaehler[w.id] ?? 0,
    eigeneStimme: eigene.has(w.id),
    vonDir: w.user_id === user.id,
  })).sort((a, b) => b.stimmen - a.stimmen || b.created_at.localeCompare(a.created_at))

  return NextResponse.json({
    wuensche: liste,
    budget: { gesamt, benutzt: Math.min(eigene.size, gesamt) },
    istAdmin: user.email === ADMIN_EMAIL,
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const zu = await pruefeZugang(supabase, user.id)
  if (zu) return zu

  const body = await req.json().catch(() => ({})) as { titel?: unknown; beschreibung?: unknown }
  const geprueft = pruefeTexte(body.titel, body.beschreibung)
  if (!geprueft.ok) return NextResponse.json({ error: geprueft.grund }, { status: 400 })

  // Spam-Bremse: höchstens drei neue Vorschläge je Nutzer und Tag.
  const seit = new Date(); seit.setHours(0, 0, 0, 0)
  const { count, error: zErr } = await supabase
    .from('wuensche')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', seit.toISOString())
  if (zErr) return NextResponse.json({ error: zErr.message }, { status: 500 })
  if ((count ?? 0) >= VORSCHLAEGE_JE_TAG) {
    return NextResponse.json(
      { error: `Du kannst höchstens ${VORSCHLAEGE_JE_TAG} Vorschläge am Tag einreichen. Morgen geht es weiter.`, minPlan: null },
      { status: 403 },
    )
  }

  const { data: row, error } = await supabase
    .from('wuensche')
    .insert({ user_id: user.id, titel: geprueft.titel, beschreibung: geprueft.beschreibung })
    .select('id, titel, beschreibung, status, created_at')
    .single()
  if (error || !row) return NextResponse.json({ error: error?.message ?? 'Anlegen fehlgeschlagen' }, { status: 500 })

  return NextResponse.json(
    { wunsch: { ...row, stimmen: 0, eigeneStimme: false, vonDir: true } },
    { status: 201 },
  )
}
```

- [ ] **Step 3: Stimme setzen und zurücknehmen**

```ts
// src/app/api/wuensche/[id]/stimme/route.ts
// Eine Stimme je Wunsch und Nutzer (Primärschlüssel in der Tabelle). Das Budget des
// Plans wird VOR dem Anlegen geprüft — und zwar gegen die AKTIVEN Stimmen, nicht
// gegen die Rohzahl: Wer aus einem größeren Plan zurückgewechselt ist, hat inaktive
// Stimmen stehen, die nicht gegen ihn zählen dürfen.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseClient } from '@/lib/supabase'
import { pruefeZugang } from '@/lib/planpruefung'
import { stimmenAblehnung } from '@/lib/plantexte'
import { istPlan, type EffektiverPlan, type Plan, type ProfilFuerPlan } from '@/lib/plaene'
import { stimmenbudget, aktiveStimmen, stimmenJeWunsch, type Stimme } from '@/lib/wuensche'
import { effektiverPlan } from '@/lib/plaene'

/** Aktive Stimmenzahl EINES Wunsches — für die Antwort, damit die Liste sofort stimmt. */
async function zaehleWunsch(wunschId: string): Promise<number> {
  const service = getSupabaseClient()
  const { data: stimmen, error } = await service
    .from('wunsch_stimmen').select('wunsch_id, user_id, created_at')
  if (error) { console.error('[stimme] zählen:', error.message); return 0 }
  const ids = [...new Set((stimmen ?? []).map(s => String(s.user_id)))]
  const profile: Record<string, ProfilFuerPlan> = {}
  if (ids.length > 0) {
    const { data: p, error: pErr } = await service
      .from('betriebsprofil')
      .select('user_id, plan, trial_starts_at, abo_status, plan_gueltig_bis')
      .in('user_id', ids)
    if (pErr) console.error('[stimme] Profile:', pErr.message)
    for (const row of p ?? []) profile[String(row.user_id)] = row as ProfilFuerPlan
  }
  return stimmenJeWunsch((stimmen ?? []) as Stimme[], profile)[wunschId] ?? 0
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const zu = await pruefeZugang(supabase, user.id)
  if (zu) return zu

  const { data: wunsch, error: wErr } = await supabase
    .from('wuensche').select('id, status').eq('id', id).maybeSingle()
  if (wErr) return NextResponse.json({ error: wErr.message }, { status: 500 })
  if (!wunsch) return NextResponse.json({ error: 'Diesen Wunsch gibt es nicht mehr.' }, { status: 404 })

  const { data: profil, error: pErr } = await supabase
    .from('betriebsprofil')
    .select('plan, trial_starts_at, abo_status, plan_gueltig_bis')
    .eq('user_id', user.id).single()
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

  const { data: eigene, error: eErr } = await supabase
    .from('wunsch_stimmen').select('wunsch_id, user_id, created_at').eq('user_id', user.id)
  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 })
  const bereitsFuerDiesen = (eigene ?? []).some(s => s.wunsch_id === id)
  if (bereitsFuerDiesen) {
    return NextResponse.json({ ok: true, stimmen: await zaehleWunsch(id) })
  }

  const budget = stimmenbudget(profil as ProfilFuerPlan)
  const benutzt = aktiveStimmen((eigene ?? []) as Stimme[], { [user.id]: profil as ProfilFuerPlan }).length
  if (benutzt >= budget) {
    const plan: EffektiverPlan = effektiverPlan(profil as ProfilFuerPlan)
    const fuerText: Plan = istPlan(plan) ? plan : 'solo'
    return NextResponse.json(stimmenAblehnung(fuerText), { status: 403 })
  }

  const { error } = await supabase.from('wunsch_stimmen').insert({ wunsch_id: id, user_id: user.id })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, stimmen: await zaehleWunsch(id) })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const zu = await pruefeZugang(supabase, user.id)
  if (zu) return zu

  const { error } = await supabase
    .from('wunsch_stimmen').delete().eq('wunsch_id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, stimmen: await zaehleWunsch(id) })
}
```

- [ ] **Step 4: Typprüfung, Tests, Commit**

Run: `npx tsc --noEmit -p tsconfig.json | grep -v "^.next/"` → keine Ausgabe.
Run: `npm run test` → alles grün.

```bash
git add docs/sql/2026-09-16-wuensche.sql src/app/api/wuensche
git commit -m "feat(wuensche): Tabellen mit RLS und GRANTs, Routen für Vorschlagen und Abstimmen"
```

---

### Task W3: Admin-Route, öffentliche Roadmap-API und `PUBLIC_PATHS`

**Files:**
- Create: `src/app/api/admin/wuensche/[id]/route.ts`
- Create: `src/app/api/wuensche/oeffentlich/route.ts`
- Modify: `src/middleware.ts:9` (`PUBLIC_PATHS`)

**Interfaces:**
- Consumes: `getSupabaseClient`, `istWunschStatus`, `OEFFENTLICHE_STATUS`, `stimmenJeWunsch`, `STATUS_LABEL`
- Produces:
  - `PATCH /api/admin/wuensche/[id]` `{ status?, zusammengelegt_in? }` → `{ ok: true }` | `403 { error: 'Kein Zugriff' }`
  - `GET /api/wuensche/oeffentlich` → `{ wuensche: Array<{ titel, status, stimmen }> }` mit `Cache-Control: public, s-maxage=300, stale-while-revalidate=600`

- [ ] **Step 1: Admin-Route (Muster `admin/gutscheincodes`)**

```ts
// src/app/api/admin/wuensche/[id]/route.ts
// Status setzen, zusammenlegen, ausblenden — nur Fabian. Dieselbe Bauart wie
// src/app/api/admin/gutscheincodes/route.ts: eine guard()-Funktion, die die
// E-Mail prüft, und ein Service-Role-Client für den Schreibzugriff (die
// RLS-Policies erlauben authenticated bewusst kein update).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { getSupabaseClient } from '@/lib/supabase'
import { istWunschStatus } from '@/lib/wuensche'

const ADMIN_EMAIL = 'l.m.p.1@gmx.de'

async function guard(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  return !error && !!user && user.email === ADMIN_EMAIL
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await guard()) return NextResponse.json({ error: 'Kein Zugriff' }, { status: 403 })
  const { id } = await params
  const body = await req.json().catch(() => ({})) as { status?: unknown; zusammengelegt_in?: unknown }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if ('status' in body) {
    if (!istWunschStatus(body.status)) {
      return NextResponse.json({ error: `„${String(body.status)}“ ist kein gültiger Status.` }, { status: 400 })
    }
    patch.status = body.status
  }
  if ('zusammengelegt_in' in body) {
    const ziel = body.zusammengelegt_in
    if (ziel !== null && typeof ziel !== 'string') {
      return NextResponse.json({ error: 'Ziel des Zusammenlegens muss eine Kennung oder null sein.' }, { status: 400 })
    }
    if (ziel === id) {
      return NextResponse.json({ error: 'Ein Wunsch kann nicht in sich selbst zusammengelegt werden.' }, { status: 400 })
    }
    patch.zusammengelegt_in = ziel
  }
  if (Object.keys(patch).length === 1) {
    return NextResponse.json({ error: 'Nichts zu ändern.' }, { status: 400 })
  }

  const { error } = await getSupabaseClient().from('wuensche').update(patch).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Öffentliche Route für die Website**

```ts
// src/app/api/wuensche/oeffentlich/route.ts
// Für die Roadmap auf www.getcraftflow.de. Öffentlich (PUBLIC_PATHS), OHNE
// Nutzerdaten: nur Titel, Status und die Zahl der aktiven Stimmen. Fünf Minuten
// Cache am Rand — die Seite muss nicht sekundengenau sein, und jeder Aufruf kostet
// sonst zwei Datenbankabfragen.

import { NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'
import type { ProfilFuerPlan } from '@/lib/plaene'
import { OEFFENTLICHE_STATUS, stimmenJeWunsch, type Stimme } from '@/lib/wuensche'

export async function GET() {
  const service = getSupabaseClient()

  const { data: wuensche, error: wErr } = await service
    .from('wuensche')
    .select('id, titel, status, created_at')
    .in('status', OEFFENTLICHE_STATUS)
    .is('zusammengelegt_in', null)
    .order('created_at', { ascending: false })
  if (wErr) {
    console.error('[wuensche/oeffentlich] laden:', wErr.message)
    return NextResponse.json({ error: 'Liste nicht verfügbar' }, { status: 500 })
  }

  const { data: stimmenRoh, error: sErr } = await service
    .from('wunsch_stimmen').select('wunsch_id, user_id, created_at')
  if (sErr) {
    console.error('[wuensche/oeffentlich] Stimmen:', sErr.message)
    return NextResponse.json({ error: 'Liste nicht verfügbar' }, { status: 500 })
  }
  const stimmen = (stimmenRoh ?? []) as Stimme[]
  const ids = [...new Set(stimmen.map(s => s.user_id))]
  const profile: Record<string, ProfilFuerPlan> = {}
  if (ids.length > 0) {
    const { data: p, error: pErr } = await service
      .from('betriebsprofil')
      .select('user_id, plan, trial_starts_at, abo_status, plan_gueltig_bis')
      .in('user_id', ids)
    if (pErr) console.error('[wuensche/oeffentlich] Profile:', pErr.message)
    for (const row of p ?? []) profile[String(row.user_id)] = row as ProfilFuerPlan
  }
  const zaehler = stimmenJeWunsch(stimmen, profile, new Date())

  const liste = (wuensche ?? [])
    .map(w => ({ titel: w.titel as string, status: w.status as string, stimmen: zaehler[w.id] ?? 0 }))
    .sort((a, b) => b.stimmen - a.stimmen || a.titel.localeCompare(b.titel, 'de'))

  return NextResponse.json({ wuensche: liste }, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  })
}
```

- [ ] **Step 3: `PUBLIC_PATHS` erweitern**

`src/middleware.ts` Zeile 9 wird zu:

```ts
// '/api/wuensche/oeffentlich' speist die Roadmap auf www.getcraftflow.de. Sie ruft
// die Route ohne Sitzung auf; ohne diesen Eintrag käme eine 307 auf /login zurück
// (derselbe Fehler wie beim Stripe-Webhook am 16.09.). Die Route gibt ausschließlich
// Titel, Status und Stimmenzahl heraus — keine Nutzerdaten.
const PUBLIC_PATHS = ['/login', '/register', '/impressum', '/datenschutz', '/agb', '/avv', '/auth/forgot-password', '/auth/reset-password', '/auth/callback', '/api/notify-signup', '/api/stripe/webhook', '/api/wuensche/oeffentlich']
```

**Achtung:** Der Eintrag steht **vor** `/api/wuensche` in keiner Prüfung — `PUBLIC_PATHS.some(p => pathname.startsWith(p))` vergleicht jeden Eintrag einzeln, `/api/wuensche` selbst ist **nicht** öffentlich. Ein Test dafür in Step 4.

- [ ] **Step 4: Test für die öffentliche Auswahl**

In `tests/wuensche.test.mjs` ergänzen:

```js
test('Öffentlich sind nur Geplant, In Arbeit und Fertig — Offenes bleibt in der App', () => {
  assert.ok(!OEFFENTLICHE_STATUS.includes('offen'))
  assert.ok(!OEFFENTLICHE_STATUS.includes('ausgeblendet'))
})

test('Die Middleware öffnet nur die öffentliche Wunsch-Route, nicht die ganze Familie', () => {
  // `startsWith` ist grosszuegig: Ein Eintrag '/api/wuensche' wuerde versehentlich
  // auch /api/wuensche/[id]/stimme oeffnen. Deshalb steht nur der volle Pfad drin.
  const PUBLIC = ['/api/wuensche/oeffentlich']
  const oeffentlich = (p) => PUBLIC.some(x => p.startsWith(x))
  assert.ok(oeffentlich('/api/wuensche/oeffentlich'))
  assert.ok(!oeffentlich('/api/wuensche'))
  assert.ok(!oeffentlich('/api/wuensche/abc/stimme'))
})
```

Run: `node --test tests/wuensche.test.mjs` → grün.
Run: `npx tsc --noEmit -p tsconfig.json | grep -v "^.next/"` → keine Ausgabe.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/wuensche src/app/api/wuensche/oeffentlich src/middleware.ts tests/wuensche.test.mjs
git commit -m "feat(wuensche): Admin-Route, öffentliche Roadmap-API mit 5 Minuten Cache"
```

---

### Task W4: Der Bereich „Wünsche“ in den Einstellungen

**Files:**
- Create: `src/components/settings/WuenscheSettings.tsx`
- Modify: `src/app/settings/page.tsx:141` (Typ von `section`), `:526-544` (`navItems`), Bereichsausgabe (nach dem Block `section === 'plan'`)
- Modify: `src/lib/assistentwissen.ts:41-58` (`EINSTELLUNGSBEREICHE`)

**Interfaces:**
- Consumes: `GET/POST /api/wuensche`, `POST/DELETE /api/wuensche/[id]/stimme`, `PATCH /api/admin/wuensche/[id]` (Tasks W2, W3); `STATUS_LABEL`, `WUNSCH_STATUS`, `TITEL_MAX`, `BESCHREIBUNG_MAX`
- Produces: Bereich `wuensche` in den Einstellungen

- [ ] **Step 1: Test zuerst — der Assistent muss den neuen Bereich kennen**

`tests/assistentwissen.test.mjs` prüft bereits, dass **jede** `id` aus `navItems` in `EINSTELLUNGSBEREICHE` steht. Sobald Step 2 den Eintrag in `navItems` einfügt, schlägt der Test fehl:

Run: `node --test tests/assistentwissen.test.mjs`
Expected (nach Step 2, vor Step 4): FAIL, „Der Einstellungsbereich "wuensche" ist dem Assistenten unbekannt.“

- [ ] **Step 2: Bereich in die Seitenleiste**

`src/app/settings/page.tsx` Zeile 141: `'plan'` behalten und `| 'wuensche'` in die Union aufnehmen.
In `navItems` (Zeile 526-544) **vor** `{ id: 'plan', … }` einfügen:

```tsx
    { id: 'wuensche',         label: 'Wünsche',         icon: '💬' },
```

Und in der Bereichsausgabe (direkt vor `{section === 'hilfe' && (`):

```tsx
          {section === 'wuensche' && <WuenscheSettings />}
```

Import oben in der Datei ergänzen:
```ts
import WuenscheSettings from '@/components/settings/WuenscheSettings'
```

- [ ] **Step 3: Die Komponente**

```tsx
// src/components/settings/WuenscheSettings.tsx
'use client'
import { useEffect, useState } from 'react'
import { akzentTon } from '@/lib/theme'
import { C } from '@/lib/types'
import { STATUS_LABEL, WUNSCH_STATUS, TITEL_MAX, BESCHREIBUNG_MAX, type WunschStatus } from '@/lib/wuensche'

// Einstellungen -> Wünsche. Jeder Plan darf vorschlagen und abstimmen; wie viele
// Stimmen jemand hat, entscheidet sein Plan (1/3/10/30, src/lib/plaene.ts).
// Der Server setzt das durch — diese Anzeige spart nur den Fehlversuch.

type Wunsch = {
  id: string; titel: string; beschreibung: string; status: WunschStatus
  created_at: string; stimmen: number; eigeneStimme: boolean; vonDir: boolean
}

const STATUS_FARBE: Record<WunschStatus, string> = {
  offen: C.textMid, geplant: C.copper, in_arbeit: C.warn, fertig: C.ok, ausgeblendet: C.err,
}

export default function WuenscheSettings() {
  const [wuensche, setWuensche] = useState<Wunsch[]>([])
  const [budget, setBudget] = useState({ gesamt: 0, benutzt: 0 })
  const [istAdmin, setIstAdmin] = useState(false)
  const [laedt, setLaedt] = useState(true)
  const [fehler, setFehler] = useState('')
  const [titel, setTitel] = useState('')
  const [beschreibung, setBeschreibung] = useState('')
  const [sendet, setSendet] = useState(false)
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => { void laden() }, [])

  async function laden() {
    const res = await fetch('/api/wuensche')
    const j = await res.json().catch(() => ({})) as {
      wuensche?: Wunsch[]; budget?: { gesamt: number; benutzt: number }; istAdmin?: boolean; error?: string
    }
    // Supabase wirft nicht — der echte Grund gehoert auf den Bildschirm, nicht ins Log.
    if (!res.ok) { setFehler(j.error ?? `Laden fehlgeschlagen (${res.status})`); setLaedt(false); return }
    setWuensche(j.wuensche ?? [])
    setBudget(j.budget ?? { gesamt: 0, benutzt: 0 })
    setIstAdmin(j.istAdmin === true)
    setLaedt(false)
  }

  async function vorschlagen() {
    setMeldung(null); setSendet(true)
    const res = await fetch('/api/wuensche', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titel, beschreibung }),
    })
    const j = await res.json().catch(() => ({})) as { error?: string }
    setSendet(false)
    if (!res.ok) { setMeldung({ ok: false, text: j.error ?? 'Vorschlag konnte nicht gespeichert werden.' }); return }
    setTitel(''); setBeschreibung('')
    setMeldung({ ok: true, text: 'Danke — dein Vorschlag steht in der Liste.' })
    await laden()
  }

  async function stimmeUmschalten(w: Wunsch) {
    setMeldung(null)
    const res = await fetch(`/api/wuensche/${w.id}/stimme`, { method: w.eigeneStimme ? 'DELETE' : 'POST' })
    const j = await res.json().catch(() => ({})) as { error?: string }
    if (!res.ok) { setMeldung({ ok: false, text: j.error ?? 'Das hat nicht geklappt.' }); return }
    await laden()
  }

  async function statusSetzen(w: Wunsch, status: WunschStatus) {
    const res = await fetch(`/api/admin/wuensche/${w.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const j = await res.json().catch(() => ({})) as { error?: string }
    if (!res.ok) { setMeldung({ ok: false, text: j.error ?? 'Status nicht geändert.' }); return }
    await laden()
  }

  async function zusammenlegen(w: Wunsch, zielId: string) {
    if (!zielId) return
    const res = await fetch(`/api/admin/wuensche/${w.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zusammengelegt_in: zielId }),
    })
    const j = await res.json().catch(() => ({})) as { error?: string }
    if (!res.ok) { setMeldung({ ok: false, text: j.error ?? 'Zusammenlegen fehlgeschlagen.' }); return }
    await laden()
  }

  if (laedt) return <div style={{ color: C.textMid, fontSize: 13 }}>Lädt …</div>

  const kannNochStimmen = budget.benutzt < budget.gesamt

  return (
    <div>
      <div style={{ color: C.white, fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Wünsche</div>
      <p style={{ color: C.textMid, fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
        Was fehlt dir in CraftFlow? Schreib es auf und stimm über die Vorschläge der
        anderen ab. Was die meisten Stimmen hat, wird als Nächstes gebaut.
      </p>

      {fehler && <div style={{ color: C.err, fontSize: 13, marginBottom: 14 }}>{fehler}</div>}

      <div style={{ background: akzentTon('0D'), border: `1px solid ${akzentTon('44')}`,
        borderRadius: 8, padding: '12px 14px', marginBottom: 18, fontSize: 13, color: C.white }}>
        Du hast {budget.benutzt} von {budget.gesamt} Stimmen vergeben.
        {!kannNochStimmen && (
          <span style={{ color: C.textMid }}> Nimm eine zurück oder wechsle den Plan, um weiter abzustimmen.</span>
        )}
      </div>

      <div style={{ background: C.gray1, borderRadius: 8, padding: 14, marginBottom: 22 }}>
        <input value={titel} maxLength={TITEL_MAX} placeholder="Kurz und klar, z. B. „Serienbrief an alle Kunden“"
          onChange={e => { setMeldung(null); setTitel(e.target.value) }}
          style={{ width: '100%', background: C.gray2, border: `1px solid ${C.border}`, borderRadius: 6,
            color: C.white, padding: '9px 11px', fontSize: 13, marginBottom: 10, boxSizing: 'border-box' }} />
        <textarea value={beschreibung} maxLength={BESCHREIBUNG_MAX} rows={4}
          placeholder="Was soll es können? Wobei würde es dir helfen?"
          onChange={e => { setMeldung(null); setBeschreibung(e.target.value) }}
          style={{ width: '100%', background: C.gray2, border: `1px solid ${C.border}`, borderRadius: 6,
            color: C.white, padding: '9px 11px', fontSize: 13, marginBottom: 10, boxSizing: 'border-box',
            fontFamily: 'Helvetica Neue,sans-serif', resize: 'vertical' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <button onClick={() => void vorschlagen()} disabled={!titel.trim() || sendet} style={{
            background: titel.trim() ? C.copper : 'transparent',
            border: titel.trim() ? 'none' : `1px solid ${C.border}`, borderRadius: 8,
            color: titel.trim() ? C.black : C.textMid, fontWeight: titel.trim() ? 700 : 400,
            padding: '10px 18px', fontSize: 13, cursor: titel.trim() ? 'pointer' : 'default',
            opacity: sendet ? 0.6 : 1 }}>
            {sendet ? 'Sendet …' : 'Wunsch vorschlagen'}
          </button>
          {meldung && <span style={{ fontSize: 13, color: meldung.ok ? C.ok : C.err }}>{meldung.text}</span>}
        </div>
      </div>

      {wuensche.length === 0 && (
        <div style={{ color: C.textMid, fontSize: 13 }}>Noch kein Vorschlag. Mach den ersten.</div>
      )}

      {wuensche.map(w => (
        <div key={w.id} style={{ display: 'flex', gap: 14, alignItems: 'flex-start',
          background: C.gray1, borderRadius: 8, padding: '12px 14px', marginBottom: 10 }}>
          <button onClick={() => void stimmeUmschalten(w)}
            title={w.eigeneStimme ? 'Stimme zurücknehmen' : 'Für diesen Wunsch stimmen'}
            disabled={!w.eigeneStimme && !kannNochStimmen}
            style={{
              minWidth: 56, background: w.eigeneStimme ? C.copper : 'transparent',
              border: w.eigeneStimme ? 'none' : `1px solid ${C.border}`, borderRadius: 8,
              color: w.eigeneStimme ? C.black : C.white, fontWeight: 700, fontSize: 13,
              padding: '10px 6px', textAlign: 'center',
              cursor: (!w.eigeneStimme && !kannNochStimmen) ? 'default' : 'pointer',
              opacity: (!w.eigeneStimme && !kannNochStimmen) ? 0.45 : 1 }}>
            ▲<br />{w.stimmen}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ color: C.white, fontSize: 13.5, fontWeight: 700 }}>{w.titel}</span>
              <span style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase',
                color: STATUS_FARBE[w.status], border: `1px solid ${C.border}`,
                borderRadius: 4, padding: '2px 6px' }}>{STATUS_LABEL[w.status]}</span>
              {w.vonDir && <span style={{ fontSize: 11, color: C.copper }}>von dir</span>}
            </div>
            {w.beschreibung && (
              <div style={{ color: C.textMid, fontSize: 12.5, lineHeight: 1.6, marginTop: 4, whiteSpace: 'pre-wrap' }}>
                {w.beschreibung}
              </div>
            )}
            <div style={{ color: C.textMid, fontSize: 11, marginTop: 6 }}>
              {new Date(w.created_at).toLocaleDateString('de-DE')}
            </div>
            {istAdmin && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <select value={w.status} onChange={e => void statusSetzen(w, e.target.value as WunschStatus)}
                  style={{ background: C.gray2, border: `1px solid ${C.border}`, borderRadius: 6,
                    color: C.white, fontSize: 12, padding: '5px 8px' }}>
                  {WUNSCH_STATUS.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
                <select defaultValue="" onChange={e => void zusammenlegen(w, e.target.value)}
                  style={{ background: C.gray2, border: `1px solid ${C.border}`, borderRadius: 6,
                    color: C.white, fontSize: 12, padding: '5px 8px' }}>
                  <option value="">Zusammenlegen in …</option>
                  {wuensche.filter(z => z.id !== w.id).map(z => (
                    <option key={z.id} value={z.id}>{z.titel}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Assistent nachziehen**

In `src/lib/assistentwissen.ts` `EINSTELLUNGSBEREICHE` **vor** dem Eintrag `plan` ergänzen:

```ts
  { id: 'wuensche', label: 'Wünsche', zweck: 'Funktionswünsche vorschlagen und über die Vorschläge anderer abstimmen. Jeder Plan darf mitmachen; wie viele Stimmen jemand hat, hängt am Plan (Solo 1, Starter 3, Pro 10, Enterprise 30). Je Wunsch höchstens eine Stimme; Stimmen lassen sich jederzeit zurücknehmen. Was geplant, in Arbeit oder fertig ist, steht auch öffentlich auf www.getcraftflow.de/roadmap' },
```

Run: `node --test tests/assistentwissen.test.mjs` → grün.
Run: `npm run test` → alles grün.
Run: `npx tsc --noEmit -p tsconfig.json | grep -v "^.next/"` → keine Ausgabe.

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/WuenscheSettings.tsx src/app/settings/page.tsx src/lib/assistentwissen.ts
git commit -m "feat(wuensche): Bereich Wünsche in den Einstellungen, Admin-Steuerung, Assistent kennt ihn"
```

---

### Task W5: Öffentliche Roadmap auf der Website (Repo `~/craftflow-web`, Branch `dev`)

**Files:**
- Create: `~/craftflow-web/app/roadmap/page.tsx`
- Create: `~/craftflow-web/app/roadmap/roadmap.module.css`
- Modify: `~/craftflow-web/app/page.tsx:174-179` (Navigation), `:92-133` (`FAQS`)
- Modify: `~/craftflow-web/app/sitemap.ts:6-16`

**Interfaces:**
- Consumes: `GET https://app.getcraftflow.de/api/wuensche/oeffentlich` → `{ wuensche: Array<{ titel: string; status: string; stimmen: number }> }`
- Produces: Seite `/roadmap`

- [ ] **Step 1: Die Seite**

```tsx
// ~/craftflow-web/app/roadmap/page.tsx
import type { Metadata } from "next"
import s from "./roadmap.module.css"

/*
 * Öffentliche Roadmap. Die Daten kommen aus der App
 * (GET /api/wuensche/oeffentlich, in PUBLIC_PATHS, fünf Minuten Cache am Rand).
 * Gezeigt werden nur Geplant, In Arbeit und Fertig — offene Vorschläge bleiben in
 * der App, weil dort abgestimmt wird. Keine Namen, keine Nutzerdaten.
 */

const APP = "https://app.getcraftflow.de"
const REGISTER = `${APP}/register`

export const revalidate = 300

export const metadata: Metadata = {
  title: "Roadmap — Was als Nächstes kommt | CraftFlow",
  description:
    "Was CraftFlow als Nächstes bekommt: geplante, laufende und fertige Funktionen — vorgeschlagen und gewählt von Schreinern, die damit arbeiten.",
  alternates: { canonical: "https://www.getcraftflow.de/roadmap" },
  openGraph: { title: "CraftFlow Roadmap — Was als Nächstes kommt", type: "website", locale: "de_DE" },
}

type Wunsch = { titel: string; status: string; stimmen: number }

const SPALTEN: Array<{ status: string; titel: string; leer: string }> = [
  { status: "geplant",   titel: "Geplant",   leer: "Gerade nichts eingeplant." },
  { status: "in_arbeit", titel: "In Arbeit", leer: "Gerade nichts in Arbeit." },
  { status: "fertig",    titel: "Fertig",    leer: "Noch nichts abgeschlossen." },
]

async function ladeWuensche(): Promise<Wunsch[]> {
  try {
    const res = await fetch(`${APP}/api/wuensche/oeffentlich`, { next: { revalidate: 300 } })
    if (!res.ok) return []
    const j = (await res.json()) as { wuensche?: Wunsch[] }
    return j.wuensche ?? []
  } catch {
    // Die Seite darf nie an der App hängen. Ohne Daten stehen die Spalten leer da.
    return []
  }
}

export default async function Page() {
  const wuensche = await ladeWuensche()

  return (
    <div className={s.page}>
      <nav className={s.nav}>
        <a className={s.logo} href="/">
          Craft<span className={s.logoBold}>Flow</span>
        </a>
        <div className={s.navLinks}>
          <a className={s.navLink} href="/#preise">Preise</a>
          <a className={s.navLink} href="/#faq">Fragen</a>
          <a className={s.navCta} href={REGISTER}>Kostenlos testen</a>
        </div>
      </nav>

      <div className={s.head}>
        <p className={s.eyebrow}>Roadmap</p>
        <h1 className={s.h1}>Was als Nächstes kommt.</h1>
        <p className={s.sub}>
          CraftFlow wird von Schreinern gebaut, die damit arbeiten. Jeder Nutzer kann
          Wünsche einreichen und über die Vorschläge der anderen abstimmen — direkt in
          der App unter Einstellungen → Wünsche. Was hier steht, ist das Ergebnis.
        </p>
      </div>

      <div className={s.board}>
        {SPALTEN.map((sp) => {
          const liste = wuensche.filter((w) => w.status === sp.status)
          return (
            <div key={sp.status} className={s.col}>
              <div className={s.colHead}>
                <span className={s.colTitle}>{sp.titel}</span>
                <span className={s.colCount}>{liste.length}</span>
              </div>
              {liste.length === 0 && <div className={s.empty}>{sp.leer}</div>}
              {liste.map((w) => (
                <div key={`${sp.status}-${w.titel}`} className={s.card}>
                  <span className={s.cardTitle}>{w.titel}</span>
                  <span className={s.votes}>
                    {w.stimmen} {w.stimmen === 1 ? "Stimme" : "Stimmen"}
                  </span>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      <div className={s.ctaWrap}>
        <h2 className={s.ctaH}>Dein Wunsch fehlt?</h2>
        <p className={s.ctaSub}>
          Leg ihn in der App an — Einstellungen → Wünsche. Jeder Plan darf vorschlagen
          und abstimmen.
        </p>
        <a href={REGISTER} className={s.ctaBtn}>14 Tage kostenlos testen</a>
      </div>

      <div className={s.footer}>
        <div className={s.footerCopy}>© 2026 CraftFlow · Ein Produkt von FS Crafted, Rodenbach</div>
        <div className={s.footerLegal}>
          <a href="/datenschutz" className={s.footerLink}>Datenschutz</a>
          <a href="/impressum" className={s.footerLink}>Impressum</a>
          <a href="/agb" className={s.footerLink}>AGB</a>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Das Stylesheet (dieselben Farben und Maße wie `app/page.module.css`)**

```css
/* ~/craftflow-web/app/roadmap/roadmap.module.css */
.page * { box-sizing: border-box; }
.page {
  background: #0D0D0D;
  color: #F0EDE8;
  font-family: var(--font-inter), sans-serif;
  line-height: 1.6;
  font-size: 15px;
  min-height: 100vh;
}

.nav {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 48px; border-bottom: 1px solid rgba(255,255,255,0.07);
  position: sticky; top: 0; background: rgba(13,13,13,0.95);
  backdrop-filter: blur(8px); z-index: 10;
}
.logo { font-weight: 600; font-size: 16px; letter-spacing: -0.2px; color: #F0EDE8; text-decoration: none; }
.logoBold { color: #C8885A; font-weight: 600; }
.navLinks { display: flex; align-items: center; gap: 32px; }
.navLink { font-size: 13px; color: rgba(240,237,232,0.45); text-decoration: none; transition: color .15s; }
.navLink:hover { color: #F0EDE8; }
.navCta {
  background: #C8885A; color: #0D0D0D; font-size: 13px; font-weight: 600;
  padding: 9px 20px; border-radius: 8px; text-decoration: none;
}
.navCta:hover { background: #A36B3F; }

.head { max-width: 1080px; margin: 0 auto; padding: 72px 48px 32px; }
.eyebrow {
  font-size: 11px; font-weight: 600; letter-spacing: 0.11em;
  text-transform: uppercase; color: #C8885A; margin-bottom: 18px;
}
.h1 {
  font-family: var(--font-dm-serif), serif; font-size: 44px; line-height: 1.07;
  letter-spacing: -0.02em; color: #F0EDE8; margin-bottom: 18px; font-weight: 400;
}
.sub { font-size: 15px; color: rgba(240,237,232,0.55); max-width: 640px; }

.board {
  max-width: 1080px; margin: 0 auto; padding: 16px 48px 72px;
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; align-items: start;
}
.col { border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 18px; }
.colHead { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 14px; }
.colTitle { font-size: 13px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #F0EDE8; }
.colCount { font-size: 12px; color: rgba(240,237,232,0.35); }
.empty { font-size: 13px; color: rgba(240,237,232,0.3); }
.card {
  display: flex; flex-direction: column; gap: 6px;
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px; padding: 12px 14px; margin-bottom: 10px;
}
.cardTitle { font-size: 14px; color: #F0EDE8; }
.votes { font-size: 12px; color: #C8885A; }

.ctaWrap { max-width: 1080px; margin: 0 auto; padding: 0 48px 72px; text-align: center; }
.ctaH { font-family: var(--font-dm-serif), serif; font-size: 32px; font-weight: 400; margin-bottom: 12px; }
.ctaSub { font-size: 15px; color: rgba(240,237,232,0.55); margin-bottom: 22px; }
.ctaBtn {
  display: inline-block; background: #C8885A; color: #0D0D0D; font-size: 14px;
  font-weight: 600; padding: 12px 26px; border-radius: 8px; text-decoration: none;
}
.ctaBtn:hover { background: #A36B3F; }

.footer {
  border-top: 1px solid rgba(255,255,255,0.06); padding: 24px 48px;
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;
}
.footerCopy { font-size: 12px; color: rgba(240,237,232,0.25); }
.footerLegal { display: flex; gap: 20px; }
.footerLink { font-size: 13px; color: rgba(240,237,232,0.45); text-decoration: none; }
.footerLink:hover { color: #F0EDE8; }

@media (max-width: 860px) {
  .nav, .head, .board, .ctaWrap, .footer { padding-left: 20px; padding-right: 20px; }
  .board { grid-template-columns: 1fr; }
  .h1 { font-size: 34px; }
}
```

- [ ] **Step 3: Navigation, FAQ und Sitemap**

In `~/craftflow-web/app/page.tsx` die Navigation (Zeile 174-179) um einen Link erweitern:

```tsx
        <div className={s.navLinks}>
          <a className={s.navLink} href="#staerken">Funktionen</a>
          <a className={s.navLink} href="#preise">Preise</a>
          <a className={s.navLink} href="/roadmap">Roadmap</a>
          <a className={s.navLink} href="#gruender">Über uns</a>
          <a className={s.navCta} href={REGISTER}>Kostenlos testen</a>
        </div>
```

An `FAQS` (nach dem Eintrag „Sind die Preise netto?“) anhängen:

```ts
  {
    q: "Was passiert mit meinen Wünschen?",
    a: "Jeder Nutzer kann in der App unter Einstellungen → Wünsche vorschlagen, was ihm fehlt, und über die Vorschläge der anderen abstimmen — jeder Plan darf mitmachen, die Zahl der Stimmen hängt am Plan. Was eingeplant, in Arbeit oder fertig ist, steht öffentlich auf der Roadmap.",
  },
```

In `~/craftflow-web/app/sitemap.ts` die Routen erweitern:

```ts
  const routes = ["", "/roadmap", ...productPages, ...legalPages]
```
und die Priorität ergänzen:
```ts
      priority: route === "" ? 1 : isProduct ? 0.9 : route === "/roadmap" ? 0.7 : 0.5,
```

- [ ] **Step 4: Prüfen und committen (Website)**

```bash
cd ~/craftflow-web
npx tsc --noEmit
npm run lint
git add app/roadmap app/page.tsx app/sitemap.ts
git commit -m "feat(roadmap): öffentliche Roadmap aus der App, Link in Navigation und FAQ"
git push origin dev
```

Vorschau ansehen: `/roadmap` zeigt drei Spalten; ohne erreichbare API stehen sie leer da, ohne Fehlerseite (Screenshot).

---

### Task W6: Live-Prüfung auf der dev-Vorschau und Doku

**Files:**
- Modify: `CLAUDE.md` (neuer Abschnitt „Wünsche-Community“)

- [ ] **Step 1: SQL-Migration eingespielt?**

`docs/sql/2026-09-16-wuensche.sql` muss vom Controller ausgeführt sein (Tabellen, RLS **und** GRANTs). Ohne GRANTs liefert jede Abfrage still `{ data: null, error }` — die Liste bliebe leer, ohne Meldung.

- [ ] **Step 2: Live-Prüfung** (`https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app`, **keine KI-Aufrufe nötig — kostet nichts**)

  1. `/settings` → „Wünsche“: Kopfzeile „Du hast 0 von 30 Stimmen vergeben.“ (Testkonto in der Testphase = Enterprise).
  2. Zwei Wünsche anlegen. Beide erscheinen sofort, Abzeichen „Offen“, Zusatz „von dir“.
  3. Bei beiden abstimmen → Zähler 1, Knopf in Kupfer, Kopfzeile „2 von 30“. Eine Stimme zurücknehmen → Zähler 0, Kopfzeile „1 von 30“.
  4. Titel mit 121 Zeichen senden → **400** „Der Titel darf höchstens 120 Zeichen haben.“ Vierter Vorschlag am selben Tag → **403** „Du kannst höchstens 3 Vorschläge am Tag einreichen. Morgen geht es weiter.“
  5. Testkonto per SQL vorübergehend auf `trial_starts_at = now() - 30 Tage`, `abo_status = 'aktiv'`, `plan = 'solo'` (Budget 1): Die Liste zeigt „1 von 1“, und der zweite Stimmversuch liefert **403** „Du hast alle 1 Stimmen deines Plans vergeben. Nimm eine zurück oder wechsle den Plan.“ mit `minPlan: 'starter'`. Die ältere Stimme bleibt aktiv, die jüngere zählt nicht — nichts wurde gelöscht. **Danach zurücksetzen.**
  6. Als Fabian (Admin-Konto): Status eines Wunsches auf „Geplant“, eines auf „Fertig“, einen dritten „Ausgeblendet“ → der ausgeblendete verschwindet aus der Liste.
  7. `GET /api/wuensche/oeffentlich` **ohne Sitzung** (anderer Browser / `curl`): liefert 200 mit `geplant`/`fertig`, **ohne** den offenen und den ausgeblendeten, Header `Cache-Control: public, s-maxage=300, …`. `GET /api/wuensche` ohne Sitzung → Weiterleitung auf `/login` (nicht öffentlich).
  8. Website-Vorschau `/roadmap`: Geplant und Fertig gefüllt, In Arbeit leer mit „Gerade nichts in Arbeit.“
  9. Screenshots unter `/tmp/cfshots/wuensche-*.png`.

- [ ] **Step 3: CLAUDE.md**

```markdown
## Wünsche-Community (Stand 2026-09-16)
- **Stimmenbudget je Plan** (1 / 3 / 10 / 30) steht als Deckel-Art `wunschStimmen` in
  `src/lib/plaene.ts` — nirgends sonst. Je Wunsch höchstens **eine** Stimme je Nutzer
  (Primärschlüssel `(wunsch_id, user_id)`).
- **Wechsel nach unten wie überall:** die ältesten N Stimmen bleiben aktiv, weitere
  zählen nicht (`wendeDeckelAn` über `wunsch_stimmen.created_at`). Nichts wird gelöscht.
- **Gezählt wird serverseitig, nie in einer SQL-View:** Ob eine Stimme zählt, hängt am
  Plan ihres Urhebers, und die Plan-Logik steht in `plaene.ts`. Die reine Zählung liegt
  in `src/lib/wuensche.ts` (`stimmenJeWunsch`), getestet in `tests/wuensche.test.mjs`.
- Fremde Stimmen und fremde Betriebsprofile darf niemand lesen (RLS). Die Zählung läuft
  deshalb über den Service-Role-Client (`getSupabaseClient`) und gibt **nur Zahlen** heraus.
- **Status:** `offen | geplant | in_arbeit | fertig | ausgeblendet`. Status setzen,
  zusammenlegen und ausblenden macht ausschließlich `PATCH /api/admin/wuensche/[id]`
  (Fabians E-Mail) — für `authenticated` gibt es bewusst keine update-Policy.
- **Öffentlich** ist nur `GET /api/wuensche/oeffentlich` (`PUBLIC_PATHS`, 5 Minuten Cache,
  ohne Nutzerdaten). Die Website `/roadmap` liest sie mit `revalidate = 300`.
- SQL: `docs/sql/2026-09-16-wuensche.sql` — **mit GRANTs.**
```

```bash
git add CLAUDE.md
git commit -m "docs: Wünsche-Community — Regeln für künftige Änderungen"
git push origin dev
```

---

# Teil C — Große Projekte in Blöcken

**Ziel dieses Teils:** Ein Kunde lädt 30 Fotos und ein 40-seitiges Leistungsverzeichnis hoch, und es läuft durch. Die drei Wände — 4,5 MB Anfrage, 300 s Laufzeit, stille 10.000-Zeichen-Kürzung — fallen. **Nichts wird mehr stumm gekürzt oder verworfen.**

### Task C1: Storage-Bucket `projektdateien` und die Upload-Route

**Files:**
- Create: `docs/sql/2026-09-16-bloecke-storage.sql`
- Create: `src/app/api/upload/route.ts`

**Interfaces:**
- Consumes: `pruefeZugang`, `pruefeFunktion`, `pruefeDeckel`, `ladeEffektivenPlan` (`planpruefung.ts`), `deckel` (`plaene.ts`)
- Produces:
  - `POST /api/upload` (multipart: `file`, optional `projekt_id`) → `{ pfad, name, groesse, projekt_id }`
  - `DELETE /api/upload` `{ pfad }` → `{ ok: true }`
  - Bucket `projektdateien` (privat), Pfad `<user_id>/<projekt_id>/<uuid>-<name>`

- [ ] **Step 1: SQL-Migration schreiben (ausgeführt wird sie vom Controller)**

```sql
-- docs/sql/2026-09-16-bloecke-storage.sql
-- Privater Bucket für Projektdateien (Spec 2026-09-16, Teil C).
-- Pfad: <user_id>/<projekt_id>/<uuid>-<dateiname>. Gelesen wird ausschließlich
-- serverseitig bzw. über signierte URLs, die der Server erzeugt — der Bucket ist
-- NICHT öffentlich (anders als 'logos' und 'briefpapier').

insert into storage.buckets (id, name, public, file_size_limit)
values ('projektdateien', 'projektdateien', false, 10485760)
on conflict (id) do update
  set public = false, file_size_limit = 10485760;

-- Nur der eigene Ordner. (storage.foldername(name))[1] ist der erste Pfadteil,
-- also die user_id.
drop policy if exists "eigene Projektdateien lesen" on storage.objects;
create policy "eigene Projektdateien lesen" on storage.objects for select to authenticated
  using (bucket_id = 'projektdateien' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "eigene Projektdateien anlegen" on storage.objects;
create policy "eigene Projektdateien anlegen" on storage.objects for insert to authenticated
  with check (bucket_id = 'projektdateien' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "eigene Projektdateien ersetzen" on storage.objects;
create policy "eigene Projektdateien ersetzen" on storage.objects for update to authenticated
  using (bucket_id = 'projektdateien' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "eigene Projektdateien löschen" on storage.objects;
create policy "eigene Projektdateien löschen" on storage.objects for delete to authenticated
  using (bucket_id = 'projektdateien' and (storage.foldername(name))[1] = auth.uid()::text);

-- GRANTS NICHT VERGESSEN (Lehre vom 16.09.): Policies allein lassen jede Abfrage
-- still scheitern. Für storage.objects sind sie in Supabase üblicherweise gesetzt —
-- hier ausgeschrieben, damit ein frisch aufgesetztes Projekt nicht daran hängt.
grant select, insert, update, delete on storage.objects to authenticated, service_role;
```

- [ ] **Step 2: Die Upload-Route**

```ts
// src/app/api/upload/route.ts
// Eine Datei je Aufruf — bewusst. Damit fällt die 4,5-MB-Wand von Vercel: Der
// Browser lädt dreißig Fotos in dreißig kleinen Anfragen hoch statt in einer großen,
// und jeder einzelne Fehlschlag ist sichtbar statt einer stummen 413.
//
// Der Bucket ist privat (docs/sql/2026-09-16-bloecke-storage.sql). Gelesen wird nur
// serverseitig; nichts davon landet je in einer öffentlichen URL.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { pruefeZugang, pruefeFunktion, pruefeDeckel, ladeEffektivenPlan } from '@/lib/planpruefung'

export const maxDuration = 300

const BUCKET = 'projektdateien'
const MAX_BYTES = 10 * 1024 * 1024
const ERLAUBTE_TYPEN = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const ERLAUBTE_ENDUNGEN = ['.jpg', '.jpeg', '.png', '.webp', '.pdf']

/** Dateiname ohne Pfadtrenner und Sonderzeichen, die den Storage-Pfad sprengen. */
export function sichererName(name: string): string {
  return String(name ?? 'datei')
    .replace(/[/\\]/g, '-')
    .replace(/[^A-Za-z0-9._\- ]/g, '_')
    .slice(-80) || 'datei'
}

/**
 * Zählt die Dateien eines Projekts im Storage. Dateien mit führendem Unterstrich
 * sind interne Zwischenstände (_vorbereitet.json) und zählen nicht gegen den Deckel.
 */
async function zaehleDateien(
  supabase: Awaited<ReturnType<typeof createClient>>, userId: string, projektId: string,
): Promise<number> {
  const { data, error } = await supabase.storage.from(BUCKET).list(`${userId}/${projektId}`, { limit: 200 })
  if (error) { console.error('[upload] list:', error.message); return 0 }
  return (data ?? []).filter(d => !d.name.startsWith('_')).length
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const zu = await pruefeZugang(supabase, user.id)
  if (zu) return zu
  const sperre = await pruefeFunktion(supabase, user.id, 'dateien')
  if (sperre) return sperre

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Keine Datei' }, { status: 400 })
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `„${file.name}“ ist größer als 10 MB.` }, { status: 400 })
  }
  const endung = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
  if (!ERLAUBTE_TYPEN.includes(file.type) && !ERLAUBTE_ENDUNGEN.includes(endung)) {
    return NextResponse.json(
      { error: `„${file.name}“ ist kein Bild und kein PDF. Erlaubt sind JPG, PNG, WEBP und PDF.` },
      { status: 400 },
    )
  }

  // Ohne Projekt-Kennung zuerst einen Entwurf anlegen, damit jede Datei zu einem
  // Projekt gehört. Ohne diesen Schritt hinge die Datei im Nichts, sobald der
  // Nutzer den Browser schließt.
  let projektId = String(form.get('projekt_id') ?? '').trim()
  if (!projektId) {
    const { data: row, error: pErr } = await supabase
      .from('projects')
      .insert({ user_id: user.id, title: 'Entwurf', status: 'offen', data: {} })
      .select('id')
      .single()
    if (pErr || !row) {
      return NextResponse.json({ error: pErr?.message ?? 'Projekt-Entwurf konnte nicht angelegt werden.' }, { status: 500 })
    }
    projektId = String(row.id)
  }

  const plan = await ladeEffektivenPlan(supabase, user.id)
  const vorhanden = await zaehleDateien(supabase, user.id, projektId)
  const deckelSperre = pruefeDeckel(plan, 'dateien', vorhanden)
  if (deckelSperre) return deckelSperre

  const pfad = `${user.id}/${projektId}/${crypto.randomUUID()}-${sichererName(file.name)}`
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(pfad, await file.arrayBuffer(), {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  return NextResponse.json({ pfad, name: file.name, groesse: file.size, projekt_id: projektId })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const zu = await pruefeZugang(supabase, user.id)
  if (zu) return zu

  const { pfad } = await req.json().catch(() => ({})) as { pfad?: string }
  if (!pfad) return NextResponse.json({ error: 'Kein Pfad' }, { status: 400 })
  // Zweite Mauer neben der Storage-Policy: Wer einen fremden Pfad schickt, bekommt
  // 403 statt eines stillen Fehlschlags.
  if (!pfad.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: 'Kein Zugriff auf diese Datei.' }, { status: 403 })
  }

  const { error } = await supabase.storage.from(BUCKET).remove([pfad])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Typprüfung, Tests, Commit**

Run: `npx tsc --noEmit -p tsconfig.json | grep -v "^.next/"` → keine Ausgabe.
Run: `npm run test` → alles grün (unverändert).

```bash
git add docs/sql/2026-09-16-bloecke-storage.sql src/app/api/upload/route.ts
git commit -m "feat(bloecke): privater Bucket projektdateien und Upload-Route je Datei"
```

---

### Task C2: Die Teil-Logik `src/lib/bloecke.ts` und die Vorbereitung

**Files:**
- Create: `src/lib/bloecke.ts`
- Create: `tests/bloecke.test.mjs`
- Create: `src/app/api/analyze/vorbereiten/route.ts`
- Modify: `src/lib/plantexte.ts` (Ende: `bloeckeAblehnung`)

**Interfaces:**
- Produces:
  - `MAX_ZEICHEN_JE_BLOCK = 8000`, `MAX_BILDER_JE_BLOCK = 6`
  - `schnittRang(zeile: string, vorige: string): 0 | 1 | 2 | 3`
  - `schneideText(text: string, maxZeichen?: number): string[]`
  - `type Block = { nr: number; text: string; bilder: string[] }`
  - `teileInBloecke(text: string, bilder: string[], maxZeichen?: number, maxBilder?: number): Block[]`
  - `type BlockInfo = { nr: number; vorschau: string; zeichen: number; bilder: number }`
  - `blockInfos(bloecke: Block[]): BlockInfo[]`
  - `bloeckeAblehnung(): { error: string; minPlan: Plan }` (`plantexte.ts`)
  - `POST /api/analyze/vorbereiten` `{ projekt_id, text }` → `{ bloecke: BlockInfo[], nichtVerarbeitet: Array<{ name, grund }> }`
- Consumes: `pruefeZugang`, `pruefeFunktion`, `ladeEffektivenPlan`, `deckel`, `deckelAblehnung`, `extractText` (`unpdf`)

- [ ] **Step 1: Test schreiben**

```js
// tests/bloecke.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_ZEICHEN_JE_BLOCK, MAX_BILDER_JE_BLOCK,
  schnittRang, schneideText, teileInBloecke, blockInfos,
} from '../src/lib/bloecke.ts'
import { bloeckeAblehnung } from '../src/lib/plantexte.ts'

test('Die Grenzen stehen fest: 8.000 Zeichen und 6 Bilder je Block', () => {
  assert.equal(MAX_ZEICHEN_JE_BLOCK, 8000)
  assert.equal(MAX_BILDER_JE_BLOCK, 6)
})

test('Schnittstellen werden nach Rang erkannt: Positionsnummer vor Seite vor Absatz', () => {
  assert.equal(schnittRang('1.2 Einbauschrank Flur', 'irgendwas'), 3)
  assert.equal(schnittRang('01.03.0040  Drehtür', 'x'), 3)
  assert.equal(schnittRang('Pos. 4 Garderobe', 'x'), 3)
  assert.equal(schnittRang('--- Seite 12 ---', 'x'), 2)
  assert.equal(schnittRang('\fSeite 13', 'x'), 2)
  assert.equal(schnittRang('Nach einer Leerzeile', ''), 1)
  assert.equal(schnittRang('Mitten im Absatz', 'davor'), 0)
  assert.equal(schnittRang('', 'davor'), 0, 'eine Leerzeile ist selbst keine Grenze')
})

test('Kurzer Text bleibt ein Block', () => {
  assert.deepEqual(schneideText('Ein Satz.', 8000), ['Ein Satz.'])
  assert.deepEqual(schneideText('   ', 8000), [])
  assert.deepEqual(schneideText('', 8000), [])
})

test('Geschnitten wird an Positionsnummern — und nichts geht verloren', () => {
  // NICHTS WIRD MEHR STUMM GEKUERZT: Der Test prueft nicht nur die Schnittstellen,
  // sondern dass alle Zeilen wieder auftauchen. Genau daran ist die alte
  // 10.000-Zeichen-Kuerzung gescheitert — sie hat schweigend weggeworfen.
  const zeilen = []
  for (let i = 1; i <= 20; i++) {
    zeilen.push(`${i}.1 Position ${i}`)
    zeilen.push('Beschreibung: ' + 'x'.repeat(40))
  }
  const text = zeilen.join('\n')
  const teile = schneideText(text, 200)
  assert.ok(teile.length > 1, 'es muss geschnitten werden')
  for (const t of teile) {
    assert.ok(/^\d+\.1 Position /.test(t), `Block beginnt nicht an einer Position: ${t.slice(0, 40)}`)
  }
  assert.equal(teile.join('\n'), text, 'kein Zeichen darf verloren gehen')
})

test('Ohne Positionsnummern fällt der Schnitt auf Seitengrenzen zurück, dann auf Absätze', () => {
  const mitSeiten = ['A'.repeat(90), '--- Seite 2 ---', 'B'.repeat(90), '--- Seite 3 ---', 'C'.repeat(90)].join('\n')
  const teileS = schneideText(mitSeiten, 120)
  assert.ok(teileS.length >= 2)
  assert.ok(teileS[1].startsWith('--- Seite'), 'der zweite Block beginnt an einer Seitengrenze')

  const mitAbsaetzen = ['A'.repeat(90), '', 'B'.repeat(90), '', 'C'.repeat(90)].join('\n')
  const teileA = schneideText(mitAbsaetzen, 120)
  assert.ok(teileA.length >= 2)
  assert.ok(teileA[1].startsWith('B'), 'der zweite Block beginnt am Absatz')
})

test('Eine einzelne überlange Zeile wird nicht weggeworfen', () => {
  const lang = 'y'.repeat(500)
  const teile = schneideText(`kurz\n${lang}\nkurz2`, 100)
  assert.ok(teile.some(t => t.includes(lang)), 'die lange Zeile fehlt')
  assert.equal(teile.join('\n'), `kurz\n${lang}\nkurz2`)
})

test('Bilder werden in Upload-Reihenfolge verteilt, höchstens sechs je Block', () => {
  const bilder = Array.from({ length: 14 }, (_, i) => `p/${i}.jpg`)
  const bloecke = teileInBloecke('nur ein kurzer Text', bilder, 8000, 6)
  assert.equal(bloecke.length, 3, '14 Bilder ergeben drei Blöcke')
  assert.deepEqual(bloecke.map(b => b.bilder.length), [6, 6, 2])
  assert.deepEqual(bloecke.flatMap(b => b.bilder), bilder, 'kein Bild fällt weg, Reihenfolge bleibt')
  assert.deepEqual(bloecke.map(b => b.nr), [1, 2, 3])
  assert.equal(bloecke[0].text, 'nur ein kurzer Text')
  assert.equal(bloecke[1].text, '', 'Folgeblöcke ohne Text bekommen einen leeren Text, keinen erfundenen')
})

test('Text und Bilder zusammen: die Blockzahl richtet sich nach dem, was mehr braucht', () => {
  const text = Array.from({ length: 6 }, (_, i) => `${i + 1}.1 Pos\n${'z'.repeat(80)}`).join('\n')
  const bloecke = teileInBloecke(text, ['a.jpg', 'b.jpg'], 100, 6)
  assert.ok(bloecke.length >= 6)
  assert.deepEqual(bloecke[0].bilder, ['a.jpg', 'b.jpg'])
  assert.deepEqual(bloecke[1].bilder, [])
  assert.equal(teileInBloecke('', [], 8000, 6).length, 0)
})

test('blockInfos beschreibt jeden Block, ohne den ganzen Text zu schicken', () => {
  const infos = blockInfos([
    { nr: 1, text: 'Zeile eins\nZeile zwei', bilder: ['a.jpg'] },
    { nr: 2, text: '', bilder: [] },
  ])
  assert.deepEqual(infos, [
    { nr: 1, vorschau: 'Zeile eins Zeile zwei', zeichen: 21, bilder: 1 },
    { nr: 2, vorschau: '', zeichen: 0, bilder: 0 },
  ])
  const lang = blockInfos([{ nr: 1, text: 'w'.repeat(300), bilder: [] }])[0]
  assert.equal(lang.vorschau.length, 123, '120 Zeichen plus " …"')
  assert.equal(lang.zeichen, 300)
})

test('Die Ablehnung nennt den Plan, der Blöcke freischaltet — wörtlich wie in der Spec', () => {
  assert.deepEqual(bloeckeAblehnung(), {
    error: 'Große Projekte in Blöcken sind ab dem Pro-Plan möglich.',
    minPlan: 'pro',
  })
})
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `node --test tests/bloecke.test.mjs`
Expected: FAIL, „Cannot find module … src/lib/bloecke.ts“

- [ ] **Step 3: `src/lib/bloecke.ts` anlegen**

```ts
// src/lib/bloecke.ts
// Große Projekte in Blöcken — die reine Teil-Logik. Importiert bewusst NICHTS
// (auch nicht plaene.ts), damit `npm run test` die Datei direkt ausführt.
//
// WARUM DAS DER KERN IST: Bis zum 2026-09-16 hat /api/analyze jeden Text nach 10.000
// Zeichen abgeschnitten — schweigend. Ein 40-seitiges Leistungsverzeichnis verlor
// dabei den größten Teil seiner Positionen, und im Angebot fehlten sie einfach.
// Diese Datei ist die Gegenprobe: Was hier hineingeht, kommt vollständig wieder
// heraus, verteilt auf Blöcke. Der Test prüft nicht die Schnittstellen allein,
// sondern dass sich der Ausgangstext wieder zusammensetzen lässt.

export const MAX_ZEICHEN_JE_BLOCK = 8000
export const MAX_BILDER_JE_BLOCK = 6

/** Zeile beginnt mit einer Positionsnummer: "1.2", "01.03.0040", "4)", "Pos. 4". */
const POSITIONSNUMMER = /^\s*(?:Pos\.?\s*)?\d{1,4}(?:[.\-]\d{1,4}){0,3}[.)]?\s+\S/
/** Seitenumbruch: Seitenvorschub oder eine Zeile wie "--- Seite 12 ---". */
const SEITENUMBRUCH = /^\s*(?:\f|-{0,3}\s*Seite\s+\d+)/i

/**
 * Wie gut eignet sich diese Zeile als Blockanfang?
 * 3 = Positionsnummer, 2 = Seitengrenze, 1 = Absatzanfang, 0 = mitten im Text.
 */
export function schnittRang(zeile: string, vorige: string): 0 | 1 | 2 | 3 {
  const z = String(zeile ?? '')
  if (!z.trim()) return 0
  if (POSITIONSNUMMER.test(z)) return 3
  if (SEITENUMBRUCH.test(z)) return 2
  if (String(vorige ?? '').trim() === '') return 1
  return 0
}

/**
 * Schneidet den Text in Stücke von höchstens `maxZeichen` Zeichen.
 * Der Schnitt fällt auf die beste Grenze innerhalb des Stücks — Positionsnummer vor
 * Seitengrenze vor Absatz. Gibt es keine, wird an der Zeilengrenze geschnitten.
 * Eine einzelne Zeile, die für sich länger ist als `maxZeichen`, bildet ihren
 * eigenen Block: lieber ein zu großer Block als eine verschwundene Zeile.
 */
export function schneideText(text: string, maxZeichen = MAX_ZEICHEN_JE_BLOCK): string[] {
  const roh = String(text ?? '').replace(/\r\n?/g, '\n')
  if (!roh.trim()) return []
  if (roh.length <= maxZeichen) return [roh.trim()]

  const zeilen = roh.split('\n')
  const rang = zeilen.map((z, i) => schnittRang(z, i > 0 ? zeilen[i - 1] : ''))
  const teile: string[] = []
  let start = 0

  while (start < zeilen.length) {
    let ende = start
    let laenge = 0
    while (ende < zeilen.length) {
      const zusatz = (ende === start ? 0 : 1) + zeilen[ende].length
      if (laenge + zusatz > maxZeichen && ende > start) break
      laenge += zusatz
      ende++
    }
    if (ende < zeilen.length) {
      // Rückwärts die beste Grenze suchen: erst Positionsnummern, dann Seiten,
      // dann Absätze. Gefunden wird der ANFANG des nächsten Blocks.
      let gewaehlt = -1
      for (const r of [3, 2, 1] as const) {
        for (let i = ende; i > start; i--) if (rang[i] === r) { gewaehlt = i; break }
        if (gewaehlt > start) break
      }
      if (gewaehlt > start) ende = gewaehlt
    }
    const stueck = zeilen.slice(start, ende).join('\n').trim()
    if (stueck) teile.push(stueck)
    start = ende
  }
  return teile
}

export type Block = { nr: number; text: string; bilder: string[] }

/**
 * Text und Bilder auf Blöcke verteilen. Bilder gehen in Upload-Reihenfolge, je Block
 * höchstens `maxBilder`. Gibt es mehr Bilderblöcke als Textblöcke, entstehen Blöcke
 * mit leerem Text — Bilder ohne Text sind eine gültige Anfrage (Fotos vom Aufmaß).
 */
export function teileInBloecke(
  text: string,
  bilder: string[],
  maxZeichen = MAX_ZEICHEN_JE_BLOCK,
  maxBilder = MAX_BILDER_JE_BLOCK,
): Block[] {
  const texte = schneideText(text, maxZeichen)
  const liste = (Array.isArray(bilder) ? bilder : []).filter(Boolean)
  const anzahl = Math.max(texte.length, Math.ceil(liste.length / maxBilder))
  const bloecke: Block[] = []
  for (let i = 0; i < anzahl; i++) {
    bloecke.push({
      nr: i + 1,
      text: texte[i] ?? '',
      bilder: liste.slice(i * maxBilder, (i + 1) * maxBilder),
    })
  }
  return bloecke
}

export type BlockInfo = { nr: number; vorschau: string; zeichen: number; bilder: number }

/** Was der Browser über die Blöcke wissen muss — ohne den ganzen Text zu übertragen. */
export function blockInfos(bloecke: Block[]): BlockInfo[] {
  return (bloecke ?? []).map(b => {
    const einzeilig = String(b.text ?? '').replace(/\s+/g, ' ').trim()
    return {
      nr: b.nr,
      vorschau: einzeilig.length > 120 ? `${einzeilig.slice(0, 120)} …` : einzeilig,
      zeichen: String(b.text ?? '').length,
      bilder: (b.bilder ?? []).length,
    }
  })
}
```

- [ ] **Step 4: `bloeckeAblehnung` in `plantexte.ts`**

Am Ende der Datei ergänzen:

```ts
/**
 * 403-Antwortkörper für die Blockanalyse. Eigener Satz statt ablehnung('bloecke'),
 * weil der Nutzer hier nicht „eine Funktion“ vermisst, sondern gerade ein großes
 * Projekt hochgeladen hat. Der Plan-Name kommt aus der Matrix — wandert die Funktion
 * einmal in einen anderen Plan, wandert der Text mit.
 */
export function bloeckeAblehnung(): { error: string; minPlan: Plan } {
  const minPlan = mindestPlan('bloecke')
  return { error: `Große Projekte in Blöcken sind ab dem ${PLAN_LABELS[minPlan]}-Plan möglich.`, minPlan }
}
```

- [ ] **Step 5: Tests grün**

Run: `node --test tests/bloecke.test.mjs` → alle grün.
Run: `npm run test` → alles grün.

- [ ] **Step 6: Die Vorbereitungs-Route**

```ts
// src/app/api/analyze/vorbereiten/route.ts
// Serverseitige Vorbereitung: Dateien des Projekts lesen, Text aus PDFs ziehen,
// alles zusammen in Blöcke teilen — und das Ergebnis als _vorbereitet.json in
// denselben privaten Bucket legen. /api/analyze/block holt sich daraus seinen Block.
//
// WARUM ALS DATEI UND NICHT IN EINER TABELLE: Die Blöcke gehören zum Projekt, liegen
// im selben Ordner wie seine Dateien und verschwinden mit ihm. Eine eigene Tabelle
// wäre eine zusätzliche Migration für Daten, die nur Minuten leben.
//
// Was nicht gelesen werden kann, wird GEMELDET (nichtVerarbeitet), nicht verschwiegen.

import { NextRequest, NextResponse } from 'next/server'
import { extractText } from 'unpdf'
import { createClient } from '@/utils/supabase/server'
import { pruefeZugang, ladeEffektivenPlan } from '@/lib/planpruefung'
import { deckel, erlaubt } from '@/lib/plaene'
import { deckelAblehnung, bloeckeAblehnung } from '@/lib/plantexte'
import { teileInBloecke, blockInfos, type Block } from '@/lib/bloecke'

export const maxDuration = 300

const BUCKET = 'projektdateien'
const VORBEREITET = '_vorbereitet.json'
const BILD_ENDUNGEN = ['.jpg', '.jpeg', '.png', '.webp']

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
  const zu = await pruefeZugang(supabase, user.id)
  if (zu) return zu

  const { projekt_id: projektId, text } = await req.json().catch(() => ({})) as
    { projekt_id?: string; text?: string }
  if (!projektId) return NextResponse.json({ error: 'Kein Projekt' }, { status: 400 })

  const ordner = `${user.id}/${projektId}`
  const { data: dateien, error: listErr } = await supabase.storage.from(BUCKET).list(ordner, { limit: 200 })
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 })
  const nutzdateien = (dateien ?? []).filter(d => !d.name.startsWith('_'))

  const plan = await ladeEffektivenPlan(supabase, user.id)
  const grenze = deckel(plan, 'dateien')
  if (grenze !== null && nutzdateien.length > grenze) {
    return NextResponse.json(
      { ...deckelAblehnung('dateien', plan === 'gesperrt' ? 'solo' : plan, grenze) },
      { status: 403 },
    )
  }

  const nichtVerarbeitet: Array<{ name: string; grund: string }> = []
  const bildPfade: string[] = []
  let gesamtText = String(text ?? '').trim()

  for (const d of nutzdateien) {
    const pfad = `${ordner}/${d.name}`
    const endung = d.name.slice(d.name.lastIndexOf('.')).toLowerCase()
    if (BILD_ENDUNGEN.includes(endung)) { bildPfade.push(pfad); continue }
    if (endung !== '.pdf') {
      nichtVerarbeitet.push({ name: d.name, grund: 'kein Bild und kein PDF' })
      continue
    }
    const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(pfad)
    if (dlErr || !blob) {
      nichtVerarbeitet.push({ name: d.name, grund: 'konnte nicht geladen werden' })
      continue
    }
    try {
      const { text: pdfText } = await extractText(new Uint8Array(await blob.arrayBuffer()), { mergePages: true })
      const sauber = String(pdfText ?? '').trim()
      if (!sauber) {
        // Gescannte PDFs haben keinen Text. Das ist kein Fehler, aber der Nutzer
        // muss es wissen — sonst wundert er sich über fehlende Positionen.
        nichtVerarbeitet.push({ name: d.name, grund: 'kein lesbarer Text (gescannt?) — bitte als Foto hochladen' })
        continue
      }
      gesamtText = gesamtText ? `${gesamtText}\n\n--- ${d.name} ---\n${sauber}` : `--- ${d.name} ---\n${sauber}`
    } catch (e) {
      nichtVerarbeitet.push({ name: d.name, grund: e instanceof Error ? e.message : 'nicht lesbar' })
    }
  }

  const bloecke: Block[] = teileInBloecke(gesamtText, bildPfade)
  if (bloecke.length === 0) {
    return NextResponse.json({ error: 'Kein Text und keine Bilder — es gibt nichts zu analysieren.' }, { status: 400 })
  }
  if (bloecke.length > 1 && !erlaubt(plan, 'bloecke')) {
    return NextResponse.json(bloeckeAblehnung(), { status: 403 })
  }

  const inhalt = JSON.stringify({ erstellt: new Date().toISOString(), bloecke })
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(`${ordner}/${VORBEREITET}`, new TextEncoder().encode(inhalt), {
      contentType: 'application/json', upsert: true,
    })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  return NextResponse.json({ bloecke: blockInfos(bloecke), nichtVerarbeitet })
}
```

- [ ] **Step 7: Typprüfung, Tests, Commit**

Run: `npx tsc --noEmit -p tsconfig.json | grep -v "^.next/"` → keine Ausgabe.
Run: `npm run test` → alles grün.

```bash
git add src/lib/bloecke.ts tests/bloecke.test.mjs src/lib/plantexte.ts src/app/api/analyze/vorbereiten/route.ts
git commit -m "feat(bloecke): Text und Bilder in Blöcke schneiden (8.000 Zeichen, 6 Bilder) und serverseitig vorbereiten"
```

---

### Task C3: Die Analyse eines Blocks

**Files:**
- Create: `src/app/api/analyze/gemeinsam.ts` (Verschiebung aus `route.ts`)
- Modify: `src/app/api/analyze/route.ts:13-789` (verschoben), `:1-12` (Importe)
- Create: `src/app/api/analyze/block/route.ts`
- Modify: `src/lib/bloecke.ts` (`GEMEINPOSITIONEN`, `baueKontext`)
- Modify: `tests/bloecke.test.mjs` (Kontext-Tests)

**Interfaces:**
- Produces:
  - `src/app/api/analyze/gemeinsam.ts`: `SYSTEM_PROMPT`, `validateAndFix`, `MAX_IMAGE_B64_BYTES` und die von ihnen genutzten Hilfsfunktionen — **unverändert verschoben, keine Zeile inhaltlich geändert**
  - `GEMEINPOSITIONEN: string[]` = `['Planung', 'Besprechung', 'Konstruktion', 'Montage-Pauschale', 'Anfahrt']`
  - `BLOCK_REGEL: string` (fester Prompt-Block, kein Nutzertext)
  - `baueKontext(k: { kunde?: string; kopf?: string; titel: string[] }): string`
  - `POST /api/analyze/block` `{ projekt_id, blockNr, kontext }` → `{ success, data, blockNr, bloeckeGesamt }`
- Consumes: `reserviereAngebot`, `gibAngebotFrei`, `aktuellerMonat`, `pruefeZugang`, `ladeEffektivenPlan`, `deckel`, `deckelAblehnung`, `bloeckeAblehnung`, `stempelPreisfaktor`

- [ ] **Step 1: Test für Kontext und feste Regel**

In `tests/bloecke.test.mjs` ergänzen (Import um `GEMEINPOSITIONEN, BLOCK_REGEL, baueKontext` erweitern):

```js
test('Die Gemeinpositionen stehen fest und nur in Block 1', () => {
  assert.deepEqual(GEMEINPOSITIONEN, ['Planung', 'Besprechung', 'Konstruktion', 'Montage-Pauschale', 'Anfahrt'])
  // Der Satz muss WOERTLICH so im Prompt stehen (Spec 2026-09-16, Teil C).
  assert.ok(BLOCK_REGEL.includes(
    'Gemeinpositionen (Planung, Besprechung, Anfahrt/Montage-Pauschale) nur in Block 1; in Folgeblöcken NICHT erneut anlegen'))
  // Fester Block, kein Nutzertext — sonst greift das Prompt-Caching nicht.
  assert.ok(!BLOCK_REGEL.includes('${'))
})

test('Der Kontext trägt Kunde, Kopfdaten und die bisherigen Titel', () => {
  const k = baueKontext({ kunde: 'Familie Meier, Gelnhausen', kopf: 'Umbau Küche', titel: ['Unterschrank', 'Hängeschrank'] })
  assert.ok(k.includes('Familie Meier, Gelnhausen'))
  assert.ok(k.includes('Umbau Küche'))
  assert.ok(k.includes('Unterschrank'))
  assert.ok(k.includes('Hängeschrank'))
  assert.equal(baueKontext({ titel: [] }), '', 'ohne Inhalt entsteht kein leerer Block')
  // Lange Titellisten werden gekürzt, damit der Kontext nicht selbst zum Block wird.
  const viele = baueKontext({ titel: Array.from({ length: 200 }, (_, i) => `Position ${i}`) })
  assert.ok(viele.length < 4000, `Kontext zu lang: ${viele.length}`)
  assert.ok(viele.includes('Position 199'), 'die zuletzt erzeugten Titel müssen drin sein')
})
```

Run: `node --test tests/bloecke.test.mjs` → FAIL (`GEMEINPOSITIONEN` fehlt).

- [ ] **Step 2: `bloecke.ts` erweitern**

Am Ende der Datei:

```ts
/**
 * Positionen, die für das ganze Projekt EINMAL anfallen. In Block 1 gehören sie hin,
 * in jedem weiteren wären sie doppelt — das Angebot wäre um sie zu teuer.
 */
export const GEMEINPOSITIONEN = ['Planung', 'Besprechung', 'Konstruktion', 'Montage-Pauschale', 'Anfahrt']

/**
 * Feste Prompt-Ergänzung für jede Blockanalyse. Enthält BEWUSST keinen Nutzertext:
 * Nur ein unveränderlicher Block kann zwischengespeichert werden (cache_control), und
 * er kostet dann ab dem zweiten Aufruf ein Zehntel.
 */
export const BLOCK_REGEL = `
## DIESE ANFRAGE IST EIN AUSSCHNITT EINES GROSSEN PROJEKTS
Du bekommst das Projekt in mehreren Blöcken nacheinander. Halte dich an diese Regeln:
- Kalkuliere AUSSCHLIESSLICH, was in diesem Block steht. Erfinde nichts dazu und
  wiederhole nichts aus früheren Blöcken.
- Gemeinpositionen (Planung, Besprechung, Anfahrt/Montage-Pauschale) nur in Block 1; in Folgeblöcken NICHT erneut anlegen.
- Kunde und Kopfdaten stehen in Block 1. In Folgeblöcken gibst du "kunde" NICHT erneut aus.
- Stelle KEINE Rückfragen ("fragen"), solange dieser Block kalkulierbar ist. Fehlt etwas,
  kalkuliere mit dem üblichen Fall und schreibe es in die "warnung" der Position.`

/**
 * Der Kontext, den Block 2 und folgende mitbekommen: Kunde, Kopfdaten und die bisher
 * erzeugten Positionstitel. Leer, wenn es nichts zu sagen gibt — ein leerer Block
 * würde nur Token kosten.
 *
 * Die Titelliste wird von HINTEN gekürzt: Die zuletzt erzeugten Titel sagen am
 * meisten darüber, wo die Kalkulation gerade steht.
 */
export function baueKontext(k: { kunde?: string; kopf?: string; titel: string[] }): string {
  const zeilen: string[] = []
  if (k.kunde?.trim()) zeilen.push(`Kunde: ${k.kunde.trim()}`)
  if (k.kopf?.trim()) zeilen.push(`Bauvorhaben: ${k.kopf.trim()}`)
  const titel = (k.titel ?? []).filter(Boolean).slice(-60)
  if (titel.length > 0) {
    zeilen.push('Bereits kalkulierte Positionen (NICHT wiederholen):')
    for (const t of titel) zeilen.push(`- ${String(t).slice(0, 80)}`)
  }
  if (zeilen.length === 0) return ''
  return `## STAND AUS DEN VORHERIGEN BLÖCKEN\n${zeilen.join('\n')}`
}
```

Run: `node --test tests/bloecke.test.mjs` → grün.

- [ ] **Step 3: Gemeinsamen Teil aus `analyze/route.ts` herauslösen**

Lege `src/app/api/analyze/gemeinsam.ts` an und verschiebe **unverändert** alles aus `src/app/api/analyze/route.ts`, was zwischen den Importen und `export async function POST` steht — Zeilen 13 bis 789, also `SYSTEM_PROMPT`, `countHardware`, `isMassivholz`, `normalizeKostenstelle`, `matchMaterialgruppe`, `validateAndFix`, `MAX_IMAGE_B64_BYTES` und alle übrigen Konstanten und Hilfsfunktionen dieses Bereichs. Exportiere `SYSTEM_PROMPT`, `validateAndFix` und `MAX_IMAGE_B64_BYTES`; alles andere bleibt dateiintern. Die Importe, die nur dieser Teil braucht (`normalizeKsId`, `Faktoren`, `KEINE_FAKTOREN`, Handarbeit-/Laufmeter-Helfer — `grep` in den verschobenen Zeilen), wandern mit.

In `route.ts` bleiben die Importe für den Routenteil plus:

```ts
import { SYSTEM_PROMPT, validateAndFix, MAX_IMAGE_B64_BYTES } from './gemeinsam'
```

**Keine inhaltliche Änderung an den verschobenen Zeilen.** Prüfen:

```bash
npx tsc --noEmit -p tsconfig.json | grep -v "^.next/"   # keine Ausgabe
npm run test                                             # alles grün
git diff --stat                                          # route.ts wird kürzer, gemeinsam.ts neu — sonst nichts
```

Zwischen-Commit, damit die Verschiebung für sich nachvollziehbar bleibt:

```bash
git add src/app/api/analyze/gemeinsam.ts src/app/api/analyze/route.ts
git commit -m "refactor(analyze): Systemprompt und validateAndFix in gemeinsam.ts — unverändert verschoben"
```

- [ ] **Step 4: Die Block-Route**

```ts
// src/app/api/analyze/block/route.ts
// Die heutige Analyse, angewandt auf EINEN Block. Klein genug, dass der KI-Aufruf
// sicher unter den 300 s bleibt (Erfahrung: 8.000 Zeichen + 6 Bilder ≈ 60-120 s).
//
// Jeder Block reserviert ein Angebot (reserviere_angebot, VOR dem KI-Aufruf) und gibt
// es wieder frei, wenn keine Positionen herauskommen — dieselbe Regel wie in
// /api/analyze. Der Deckel wird damit auch bei sieben Blöcken korrekt geführt.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { pruefeZugang, ladeEffektivenPlan } from '@/lib/planpruefung'
import { deckel, erlaubt } from '@/lib/plaene'
import { deckelAblehnung, bloeckeAblehnung } from '@/lib/plantexte'
import { aktuellerMonat, reserviereAngebot, gibAngebotFrei } from '@/lib/angebotszaehler'
import { stempelPreisfaktor, klemmePreisfaktor, PREISFAKTOR_STANDARD } from '@/lib/preisfaktor'
import { BLOCK_REGEL, type Block } from '@/lib/bloecke'
import { SYSTEM_PROMPT, validateAndFix, MAX_IMAGE_B64_BYTES } from '../gemeinsam'
import { ladeFaktoren } from '@/lib/kalibrierungsspeicher'
import { KEINE_FAKTOREN, type Faktoren } from '@/lib/zeitfaktoren'
import { regelBlockFuerNutzer } from '@/lib/bauweise'
import { preisBlockFuerNutzer } from '@/lib/preisspeicher'
import { ladeKalibrierung } from '@/lib/kalibrierungsspeicher'
import { abzuschaltendeKostenstellen, lackBlockFuer } from '@/lib/kalibrierung'
import { normalizeKsId } from '@/lib/types'

export const maxDuration = 300

const BUCKET = 'projektdateien'
const VORBEREITET = '_vorbereitet.json'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })
    const zu = await pruefeZugang(supabase, user.id)
    if (zu) return zu

    const body = await req.json().catch(() => ({})) as {
      projekt_id?: string; blockNr?: number; kontext?: string
      userKostenstellen?: Array<{ code: string; bezeichnung: string; stundensatz: number }>
      userMaterialgruppen?: Array<{ name: string; aufschlag_prozent: number }>
      deaktivierteKostenstellen?: string[]
    }
    const projektId = String(body.projekt_id ?? '').trim()
    const blockNr = Number(body.blockNr)
    if (!projektId || !Number.isFinite(blockNr) || blockNr < 1) {
      return NextResponse.json({ error: 'Projekt oder Blocknummer fehlt' }, { status: 400 })
    }

    // Die vorbereiteten Blöcke liegen im Projektordner (Task C2).
    const ordner = `${user.id}/${projektId}`
    const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(`${ordner}/${VORBEREITET}`)
    if (dlErr || !blob) {
      return NextResponse.json({ error: 'Die Vorbereitung fehlt. Bitte „Vorbereiten“ erneut ausführen.' }, { status: 409 })
    }
    const vorbereitet = JSON.parse(await blob.text()) as { bloecke: Block[] }
    const bloecke = vorbereitet.bloecke ?? []
    const block = bloecke.find(b => b.nr === blockNr)
    if (!block) return NextResponse.json({ error: `Block ${blockNr} gibt es nicht.` }, { status: 404 })

    const plan = await ladeEffektivenPlan(supabase, user.id)
    if (bloecke.length > 1 && !erlaubt(plan, 'bloecke')) {
      return NextResponse.json(bloeckeAblehnung(), { status: 403 })
    }

    // Ein Angebot je Block — reserviert VOR dem KI-Aufruf.
    const monat = aktuellerMonat()
    const limit = deckel(plan, 'angebote')
    const reservierung = await reserviereAngebot(supabase, monat, limit)
    if (!reservierung.ok) {
      return NextResponse.json(
        { success: false, ...deckelAblehnung('angebote', plan === 'gesperrt' ? 'solo' : plan, limit ?? 0) },
        { status: 403 },
      )
    }
    let freigegeben = false
    const gibFrei = async () => {
      if (freigegeben) return
      freigegeben = true
      try { await gibAngebotFrei(supabase, monat) }
      catch (e) { console.error('[analyze/block] gibAngebotFrei:', e) }
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) { await gibFrei(); return NextResponse.json({ error: 'Kein API Key konfiguriert' }, { status: 500 }) }

    // Bilder dieses Blocks aus dem privaten Bucket holen und als base64 anhängen.
    const bilderB64: string[] = []
    for (const pfad of block.bilder ?? []) {
      const { data: bild, error } = await supabase.storage.from(BUCKET).download(pfad)
      if (error || !bild) { console.error('[analyze/block] Bild:', pfad, error?.message); continue }
      const b64 = Buffer.from(await bild.arrayBuffer()).toString('base64')
      if (b64.length > MAX_IMAGE_B64_BYTES) { console.error('[analyze/block] Bild zu groß:', pfad); continue }
      bilderB64.push(b64)
    }

    // Nutzerspezifisches wie in /api/analyze — serverseitig geladen.
    const customKs = Array.isArray(body.userKostenstellen) ? body.userKostenstellen : []
    const customSaetze: Record<string, number> = {}
    for (const k of customKs) { customSaetze[normalizeKsId(k.code)] = k.stundensatz; customSaetze[k.bezeichnung] = k.stundensatz }
    const matGruppen = Array.isArray(body.userMaterialgruppen) ? body.userMaterialgruppen : []
    const deaktiviert = new Set<string>((body.deaktivierteKostenstellen ?? []).map(c => normalizeKsId(c)))

    let faktoren: Faktoren = KEINE_FAKTOREN
    try { faktoren = await ladeFaktoren(supabase, user.id) }
    catch (e) { console.error('[analyze/block] Faktoren:', e) }
    let lackBlock = ''
    try {
      const kal = await ladeKalibrierung(supabase, user.id)
      for (const ks of abzuschaltendeKostenstellen(kal)) deaktiviert.add(normalizeKsId(ks))
      lackBlock = lackBlockFuer(kal)
    } catch (e) { console.error('[analyze/block] Kalibrierung:', e) }
    let regelBlock = ''
    try { regelBlock = (await regelBlockFuerNutzer(supabase, user.id)).block }
    catch (e) { console.error('[analyze/block] Regeln:', e) }
    let preisBlock = ''
    try { preisBlock = await preisBlockFuerNutzer(supabase, user.id) }
    catch (e) { console.error('[analyze/block] Preise:', e) }

    const { data: profil, error: profilErr } = await supabase
      .from('betriebsprofil').select('strasse, plz, ort, preisfaktor').eq('user_id', user.id).single()
    if (profilErr) console.error('[analyze/block] Betriebsprofil:', profilErr.message)
    const preisfaktorNutzer = klemmePreisfaktor(profil?.preisfaktor) ?? PREISFAKTOR_STANDARD
    const standort = profil
      ? [profil.strasse, [profil.plz, profil.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ')
      : ''

    let nutzerBlock = ''
    if (Object.keys(customSaetze).length > 0) {
      nutzerBlock += '\n\n## ECHTE STUNDENSÄTZE DIESES NUTZERS (verbindlich):\n' +
        customKs.map(k => `${normalizeKsId(k.code)} → ${k.stundensatz} €/h`).join('\n')
    }
    if (deaktiviert.size > 0) {
      nutzerBlock += '\n\n## DIESE KOSTENSTELLEN NICHT VERWENDEN:\n' + [...deaktiviert].join(', ')
    }
    if (matGruppen.length > 0) {
      nutzerBlock += '\n\n## ECHTE MATERIALAUFSCHLÄGE DIESES NUTZERS (verbindlich):\n' +
        matGruppen.map(m => `${m.name} → ${m.aufschlag_prozent}%`).join('\n')
    }
    if (standort) {
      nutzerBlock += '\n\n## FIRMENSTANDORT DES NUTZERS (verbindlich für Anfahrt & Fahrtzeit):\n' + standort
    }
    nutzerBlock += regelBlock + lackBlock + preisBlock

    // Reihenfolge der System-Blöcke ist funktional: zuerst das feste Fachwissen
    // (zwischengespeichert), dann die feste Blockregel (ebenfalls zwischengespeichert),
    // erst danach alles Nutzerspezifische — sonst macht jeder Nutzer den Cache des
    // anderen ungültig.
    const systemBloecke: Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }> = [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: BLOCK_REGEL, cache_control: { type: 'ephemeral' } },
    ]
    if (nutzerBlock.trim()) systemBloecke.push({ type: 'text', text: nutzerBlock })

    const userContent: object[] = []
    for (const b64 of bilderB64) {
      userContent.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } })
    }
    const kontext = String(body.kontext ?? '').trim()
    userContent.push({
      type: 'text',
      text: `${kontext ? kontext + '\n\n' : ''}## BLOCK ${blockNr} VON ${bloecke.length}\n${block.text || '(nur Fotos in diesem Block)'}`,
    })

    const model = 'claude-sonnet-4-6'
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'interleaved-thinking-2025-05-14',
      },
      body: JSON.stringify({
        model, max_tokens: 16000, temperature: 1,
        thinking: { type: 'enabled', budget_tokens: 5000 },
        system: systemBloecke,
        messages: [{ role: 'user', content: userContent }],
      }),
    })
    if (!response.ok) {
      const err = await response.text()
      console.error('[analyze/block] Claude error:', response.status, err)
      await gibFrei()
      return NextResponse.json({ success: false, error: `Claude ${response.status}: ${err}` }, { status: 502 })
    }

    const data = await response.json() as { content?: Array<{ type: string; text?: string }> }
    const rawText = (data.content ?? []).find(b => b.type === 'text')?.text ?? ''
    const start = rawText.indexOf('{')
    const clean = start === -1 ? rawText : rawText.slice(start, rawText.lastIndexOf('}') + 1)

    try {
      const parsed = JSON.parse(clean) as Record<string, unknown>
      const validated = 'fragen' in parsed
        ? parsed
        : validateAndFix(parsed, block.text ?? '', customSaetze, matGruppen, deaktiviert, faktoren)
      const positionen = (validated as { positionen?: unknown }).positionen
      if (Array.isArray(positionen)) {
        (validated as { positionen: unknown }).positionen =
          stempelPreisfaktor(positionen as Array<{ preisfaktor?: number }>, preisfaktorNutzer)
      }
      const hatPositionen = Array.isArray(positionen) && positionen.length > 0
      if (!hatPositionen) await gibFrei()
      return NextResponse.json({ success: true, data: validated, blockNr, bloeckeGesamt: bloecke.length })
    } catch {
      console.error('[analyze/block] JSON parse failed, raw:', rawText.slice(0, 300))
      await gibFrei()
      return NextResponse.json({ success: false, error: 'JSON Parse Fehler', blockNr }, { status: 500 })
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unbekannter Fehler'
    console.error('[analyze/block] unhandled error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
```

**Hinweis für die Umsetzung:** Die Importpfade für `Faktoren`/`KEINE_FAKTOREN`, `ladeFaktoren` und `ladeKalibrierung` sind aus `src/app/api/analyze/route.ts` zu übernehmen (`grep -n "KEINE_FAKTOREN\|ladeFaktoren\|ladeKalibrierung" src/app/api/analyze/route.ts`) — dort stehen sie bereits richtig. Nichts erfinden.

- [ ] **Step 5: Typprüfung, Tests, Commit**

Run: `npx tsc --noEmit -p tsconfig.json | grep -v "^.next/"` → keine Ausgabe.
Run: `npm run test` → alles grün.

```bash
git add src/lib/bloecke.ts tests/bloecke.test.mjs src/app/api/analyze/block/route.ts
git commit -m "feat(bloecke): Analyse je Block mit fester Blockregel, Kontext und eigener Angebots-Reservierung"
```

---

### Task C4: Der Ablauf im Browser — hochladen, vorbereiten, Block für Block

**Files:**
- Modify: `src/lib/bloecke.ts` (`vereinigePositionen`)
- Modify: `tests/bloecke.test.mjs` (Test dafür)
- Modify: `src/app/page.tsx:48-54` (`UploadedFile`), `:639-665` (Zustand), `:817-883` (Upload), `:1114-1260` (Start), Startbildschirm (~`:3190-3250`)

**Interfaces:**
- Produces:
  - `vereinigePositionen<T extends { id: number }>(bisher: T[], neue: T[]): T[]` — hängt an, vergibt neue eindeutige ids, Reihenfolge bleibt
  - Browser: `ladeDateiHoch(file)`, `starteBlockAnalyse()`, Zustände `bloecke`, `blockAktuell`, `nichtVerarbeitet`, `abbrechenRef`
- Consumes: `POST /api/upload`, `POST /api/analyze/vorbereiten`, `POST /api/analyze/block` (Tasks C1–C3); `baueKontext` (Task C3); `positionenAusKi`

- [ ] **Step 1: Test für das Anhängen**

In `tests/bloecke.test.mjs` ergänzen (Import um `vereinigePositionen` erweitern):

```js
test('Positionen werden angehängt, die Nummerierung läuft fort, keine id doppelt', () => {
  const bisher = [{ id: 1000, titel: 'A' }, { id: 1001, titel: 'B' }]
  const neue = [{ id: 1000, titel: 'C' }, { id: 5, titel: 'D' }]   // kollidierende ids
  const zusammen = vereinigePositionen(bisher, neue)
  assert.deepEqual(zusammen.map(p => p.titel), ['A', 'B', 'C', 'D'], 'Reihenfolge bleibt')
  assert.equal(new Set(zusammen.map(p => p.id)).size, 4, 'doppelte ids')
  assert.deepEqual(zusammen.slice(0, 2), bisher, 'bestehende Positionen bleiben unangetastet')
  assert.deepEqual(vereinigePositionen([], neue).map(p => p.titel), ['C', 'D'])
  assert.deepEqual(vereinigePositionen(bisher, []), bisher)
})
```

Run: `node --test tests/bloecke.test.mjs` → FAIL (`vereinigePositionen` fehlt).

- [ ] **Step 2: `vereinigePositionen` in `bloecke.ts`**

```ts
/**
 * Positionen aus einem weiteren Block anhängen. Die bestehenden bleiben Zeichen für
 * Zeichen, wie sie sind; die neuen bekommen fortlaufende, garantiert freie ids.
 *
 * WARUM NEUE IDS: positionenAusKi vergibt ids aus Date.now(). Zwei Blöcke, die
 * innerhalb derselben Millisekunde zurückkommen, hätten identische ids — und die
 * Oberfläche paart Positionen, Material und Zeiten über genau diese id.
 */
export function vereinigePositionen<T extends { id: number }>(bisher: T[], neue: T[]): T[] {
  const alt = Array.isArray(bisher) ? bisher : []
  const zusatz = Array.isArray(neue) ? neue : []
  if (zusatz.length === 0) return alt
  let naechste = alt.reduce((max, p) => Math.max(max, Number(p?.id) || 0), 0) + 1
  return [...alt, ...zusatz.map(p => ({ ...p, id: naechste++ }))]
}
```

Run: `node --test tests/bloecke.test.mjs` → grün.

- [ ] **Step 3: `UploadedFile` und Zustand erweitern**

`src/app/page.tsx` Zeilen 48-54:

```ts
type UploadedFile = {
  id: number
  name: string
  type: 'image' | 'pdf'
  previewUrl?: string
  b64?: string
  /** Pfad im Bucket `projektdateien`, sobald die Datei serverseitig liegt (Teil C). */
  pfad?: string
  /** Sichtbarer Stand je Datei — ohne ihn wäre ein Fehlschlag stumm. */
  stand?: 'laeuft' | 'fertig' | 'fehler'
  grund?: string
}
```

Neben `const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])` (Zeile 639) ergänzen:

```ts
  // Große Projekte in Blöcken (Spec 2026-09-16, Teil C).
  const [bloecke, setBloecke] = useState<Array<{ nr: number; vorschau: string; zeichen: number; bilder: number }>>([])
  const [nichtVerarbeitet, setNichtVerarbeitet] = useState<Array<{ name: string; grund: string }>>([])
  const [blockAktuell, setBlockAktuell] = useState(0)
  const [blockLaeuft, setBlockLaeuft] = useState(false)
  const abbrechenRef = useRef(false)
```

Import ergänzen:
```ts
import { baueKontext, vereinigePositionen } from '@/lib/bloecke'
```

- [ ] **Step 4: Upload je Datei mit Fortschritt**

Nach `handlePdfUpload` (Zeile 883) einfügen:

```ts
  /**
   * Eine Datei in den Bucket `projektdateien` legen. Eine Anfrage je Datei — damit
   * fällt die 4,5-MB-Wand von Vercel, und jeder Fehlschlag ist an der Kachel sichtbar
   * statt als stumme 413 für den ganzen Stapel.
   *
   * Fotos werden weiter IM BROWSER verkleinert (compressImage) — das spart Upload,
   * Speicher und Token, und die KI braucht keine 12-Megapixel-Vorlage.
   */
  const ladeDateiHoch = useCallback(async (datei: File, id: number) => {
    setUploadedFiles(prev => prev.map(f => f.id === id ? { ...f, stand: 'laeuft' } : f))
    const form = new FormData()
    form.append('file', datei)
    const projektId = currentProjectIdRef.current
    if (projektId) form.append('projekt_id', projektId)
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      const j = await res.json().catch(() => ({})) as
        { pfad?: string; projekt_id?: string; error?: string }
      if (!res.ok) {
        setUploadedFiles(prev => prev.map(f => f.id === id
          ? { ...f, stand: 'fehler', grund: j.error ?? `Fehlgeschlagen (${res.status})` } : f))
        return
      }
      // Beim ersten Upload legt der Server einen Projekt-Entwurf an — ab jetzt
      // gehören alle weiteren Dateien zu diesem Projekt.
      if (j.projekt_id && !currentProjectIdRef.current) {
        currentProjectIdRef.current = j.projekt_id
        setCurrentProjectId(j.projekt_id)
      }
      setUploadedFiles(prev => prev.map(f => f.id === id ? { ...f, stand: 'fertig', pfad: j.pfad } : f))
    } catch (e) {
      setUploadedFiles(prev => prev.map(f => f.id === id
        ? { ...f, stand: 'fehler', grund: e instanceof Error ? e.message : 'Netzfehler' } : f))
    }
  }, [])
```

In `loadBild` (Zeile 817-832) nach dem erfolgreichen `compressImage` den Upload anstoßen — das verkleinerte Bild, nicht das Original:

```ts
  const loadBild = useCallback(async (file: File) => {
    const id = Date.now() + Math.round(Math.random() * 1000)
    const previewUrl = URL.createObjectURL(file)
    setUploadedFiles(prev => [...prev, { id, name: file.name, type: 'image', previewUrl, stand: 'laeuft' }])
    try {
      const b64 = await compressImage(file)
      setUploadedFiles(prev => prev.map(f => f.id === id ? { ...f, b64 } : f))
      // Das verkleinerte Bild wandert in den Bucket — das Original braucht niemand.
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
      const klein = new File([bytes], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
      await ladeDateiHoch(klein, id)
    } catch {
      const reader = new FileReader()
      reader.onload = ev => {
        const b64 = (ev.target?.result as string).split(',')[1]
        setUploadedFiles(prev => prev.map(f => f.id === id ? { ...f, b64 } : f))
        void ladeDateiHoch(file, id)
      }
      reader.readAsDataURL(file)
    }
  }, [compressImage, ladeDateiHoch])
```

In `handlePdfUpload` das Original-PDF zusätzlich hochladen (direkt nach dem Anlegen des Platzhalters, Zeile 841):

```ts
    // Das PDF selbst wandert in den Bucket: Der Server zieht daraus später den
    // VOLLSTÄNDIGEN Text (unpdf), nicht nur die ersten 10.000 Zeichen.
    void ladeDateiHoch(file, pdfId)
```

- [ ] **Step 5: Vorbereiten und Blöcke nacheinander**

Nach `startAnalyse` (Zeile 1260) einfügen:

```ts
  /**
   * Der Weg für große Projekte: vorbereiten, dann Block für Block.
   *
   * NACHEINANDER, nicht parallel: Jeder Block kostet einen KI-Aufruf und ein Angebot
   * aus dem Kontingent. Parallel gestartet, liefen bei einem Abbruch drei weitere
   * Aufrufe unbemerkt durch — bezahlt und weggeworfen.
   */
  const starteBlockAnalyse = useCallback(async () => {
    const projektId = currentProjectIdRef.current
    if (!projektId) { setStartMsg('Bitte zuerst eine Datei hochladen.'); return }
    abbrechenRef.current = false
    setStartStatus('loading'); setStartMsg(''); setBlockLaeuft(true)
    setBloecke([]); setNichtVerarbeitet([]); setBlockAktuell(0)

    try {
      const vor = await fetch('/api/analyze/vorbereiten', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projekt_id: projektId, text: startText }),
      })
      const jv = await vor.json().catch(() => ({})) as {
        bloecke?: Array<{ nr: number; vorschau: string; zeichen: number; bilder: number }>
        nichtVerarbeitet?: Array<{ name: string; grund: string }>
        error?: string; minPlan?: string | null
      }
      if (!vor.ok) {
        setStartStatus('error')
        setStartMsg(jv.error ?? `Vorbereiten fehlgeschlagen (${vor.status})`)
        setBlockLaeuft(false)
        return
      }
      const liste = jv.bloecke ?? []
      setBloecke(liste)
      setNichtVerarbeitet(jv.nichtVerarbeitet ?? [])

      let gesammelt: Angebotsposition[] = []
      let kundeAusBlock1 = { name: '', zusatz: '', strasse: '', ort: '', projekt: '' }

      for (const b of liste) {
        if (abbrechenRef.current) break
        setBlockAktuell(b.nr)
        const res = await fetch('/api/analyze/block', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projekt_id: projektId,
            blockNr: b.nr,
            // Block 1 trägt Kopf und Gemeinpositionen; Folgeblöcke bekommen den Stand
            // und das Verbot, sie erneut anzulegen (BLOCK_REGEL, serverseitig fest).
            kontext: b.nr === 1 ? '' : baueKontext({
              kunde: [kundeAusBlock1.name, kundeAusBlock1.ort].filter(Boolean).join(', '),
              kopf: kundeAusBlock1.projekt,
              titel: gesammelt.map(p => p.titel),
            }),
            userKostenstellen: userKs.filter(k => k.aktiv).map(k => ({
              code: k.code, bezeichnung: k.bezeichnung, stundensatz: k.stundensatz,
            })),
            userMaterialgruppen: userMatGruppen.filter(m => m.aktiv).map(m => ({
              name: m.name, aufschlag_prozent: m.aufschlag_prozent,
            })),
            deaktivierteKostenstellen: userKs.filter(k => !k.aktiv).map(k => k.code),
          }),
        })
        const j = await res.json().catch(() => ({})) as
          { success?: boolean; error?: string; minPlan?: string | null; data?: Record<string, unknown> }
        if (!res.ok || !j.success) {
          // Kein throw: Was bis hierher entstanden ist, bleibt stehen. Der Nutzer
          // sieht, an welchem Block es gehakt hat, und kann neu ansetzen.
          setStartStatus('error')
          setStartMsg(`Block ${b.nr}: ${j.error ?? `Fehlgeschlagen (${res.status})`}`)
          break
        }
        const daten = j.data ?? {}
        if (b.nr === 1 && daten.kunde) {
          const kd = daten.kunde as Record<string, string>
          kundeAusBlock1 = {
            name: kd.name ?? '', zusatz: kd.zusatz ?? '', strasse: kd.strasse ?? '',
            ort: kd.ort ?? '', projekt: kd.projekt ?? '',
          }
          setKunde(kundeAusBlock1)
        }
        const neue = positionenAusKi(
          (daten.positionen as unknown) ?? [], Date.now(), DEFAULT_STUNDENSAETZE['Produktion'],
        ) as unknown as Angebotsposition[]
        gesammelt = vereinigePositionen(gesammelt, neue)
        setPos(gesammelt)
        refreshUsage().catch(() => {})
      }

      setBlockLaeuft(false)
      setBlockAktuell(0)
      if (gesammelt.length > 0) {
        setScreen('app')
        setTab('kalkulation')
        if (startStatus !== 'error') setStartStatus('idle')
      }
    } catch (e) {
      setStartStatus('error')
      setStartMsg(`Fehler: ${e instanceof Error ? e.message : 'Unbekannt'}`)
      setBlockLaeuft(false)
    }
  }, [startText, userKs, userMatGruppen, refreshUsage, startStatus])
```

- [ ] **Step 6: Anzeige auf dem Startbildschirm**

Unter der Dateiliste (nach dem Block `{uploadedFiles.length > 0 && ( … )}`, Zeile ~3233-3250) einfügen:

```tsx
            {uploadedFiles.some(f => f.stand === 'fehler') && (
              <div style={{ color: C.err, fontSize: 12, marginTop: 8 }}>
                {uploadedFiles.filter(f => f.stand === 'fehler').map(f => (
                  <div key={f.id}>{f.name}: {f.grund}</div>
                ))}
              </div>
            )}

            {bloecke.length > 0 && (
              <div style={{ background: C.gray1, border: `1px solid ${akzentTon('44')}`, borderRadius: 8,
                padding: '12px 14px', marginTop: 10, fontSize: 12.5, color: C.white, lineHeight: 1.7 }}>
                {bloecke.length} {bloecke.length === 1 ? 'Block' : 'Blöcke'}
                {nichtVerarbeitet.length > 0 && (
                  <>, {nichtVerarbeitet.length} {nichtVerarbeitet.length === 1 ? 'Datei' : 'Dateien'} nicht lesbar: {nichtVerarbeitet.map(n => `${n.name} (${n.grund})`).join(', ')}</>
                )}
                {blockLaeuft && blockAktuell > 0 && (
                  <div style={{ color: C.copper, marginTop: 6 }}>
                    Block {blockAktuell} von {bloecke.length} — bisher {pos.length} {pos.length === 1 ? 'Position' : 'Positionen'}
                  </div>
                )}
              </div>
            )}

            {uploadedFiles.some(f => f.stand === 'fertig') && !blockLaeuft && (
              <button onClick={() => void starteBlockAnalyse()} style={{
                width: '100%', marginTop: 10, background: 'transparent', color: C.white,
                border: `1px solid ${C.copper}`, borderRadius: 4, padding: '11px 0',
                fontSize: 12, cursor: 'pointer', fontFamily: 'Helvetica Neue,sans-serif' }}>
                Großes Projekt in Blöcken kalkulieren
              </button>
            )}

            {blockLaeuft && (
              <button onClick={() => { abbrechenRef.current = true }} style={{
                width: '100%', marginTop: 10, background: 'transparent', color: C.textMid,
                border: `1px solid ${C.border}`, borderRadius: 4, padding: '11px 0',
                fontSize: 12, cursor: 'pointer', fontFamily: 'Helvetica Neue,sans-serif' }}>
                Abbrechen — das Ergebnis bis hierher bleibt
              </button>
            )}
```

- [ ] **Step 7: Typprüfung, Lint, Tests, Commit**

Run: `npx tsc --noEmit -p tsconfig.json | grep -v "^.next/"` → keine Ausgabe.
Run: `npm run lint` → keine **neuen** Fehler.
Run: `npm run test` → alles grün.

```bash
git add src/lib/bloecke.ts tests/bloecke.test.mjs src/app/page.tsx
git commit -m "feat(bloecke): Ablauf im Browser — Upload mit Fortschritt, Vorbereiten, Blöcke nacheinander, Abbrechen"
```

---

### Task C5: Zusammenführen — Dubletten und doppelte Gemeinpositionen melden

**Files:**
- Modify: `src/lib/bloecke.ts` (`masseAus`, `findeDubletten`)
- Modify: `tests/bloecke.test.mjs` (Tests dafür)
- Modify: `src/app/page.tsx` (Hinweisliste über der Kalkulation)

**Interfaces:**
- Produces:
  - `masseAus(text: string): string` — normalisierte Maßangabe („2000x600x2400“) oder `''`
  - `type Dublettenhinweis = { art: 'dublette' | 'gemeinposition'; titel: string; nummern: number[] }`
  - `findeDubletten(positionen: Array<{ titel?: string; beschreibung?: string }>): Dublettenhinweis[]`
- Consumes: `GEMEINPOSITIONEN` (Task C3)

- [ ] **Step 1: Test schreiben**

In `tests/bloecke.test.mjs` ergänzen (Import um `masseAus, findeDubletten` erweitern):

```js
test('Maße werden erkannt und vergleichbar gemacht', () => {
  assert.equal(masseAus('Schrank 2000 x 600 x 2400 mm'), '2000x600x2400')
  assert.equal(masseAus('Schrank 2000×600×2400'), '2000x600x2400')
  assert.equal(masseAus('B 2000 mm, H 2400 mm'), '')
  assert.equal(masseAus('ohne Maß'), '')
  assert.equal(masseAus('Platte 1200x800'), '1200x800')
})

test('Gleicher Titel UND gleiche Maße ergeben einen Dublettenhinweis — verschmolzen wird nichts', () => {
  const hinweise = findeDubletten([
    { titel: 'Unterschrank', beschreibung: '2000 x 600 x 900 mm, Eiche' },
    { titel: 'Hängeschrank', beschreibung: '2000 x 350 x 700 mm' },
    { titel: ' unterschrank ', beschreibung: 'Maße 2000x600x900, Eiche furniert' },
  ])
  assert.deepEqual(hinweise, [{ art: 'dublette', titel: 'Unterschrank', nummern: [1, 3] }])
})

test('Gleicher Titel mit verschiedenen Maßen ist keine Dublette', () => {
  assert.deepEqual(findeDubletten([
    { titel: 'Unterschrank', beschreibung: '2000 x 600 x 900' },
    { titel: 'Unterschrank', beschreibung: '1200 x 600 x 900' },
  ]), [])
})

test('Gemeinpositionen werden gemeldet, sobald sie mehr als einmal vorkommen', () => {
  // DAS RISIKO AUS DER SPEC: Die KI legt trotz Anweisung in Block 3 noch einmal
  // "Planung" an. Gemeldet, nicht verschmolzen — entscheiden soll der Schreiner.
  const hinweise = findeDubletten([
    { titel: 'Planung und Aufmaß', beschreibung: '' },
    { titel: 'Unterschrank', beschreibung: '2000 x 600 x 900' },
    { titel: 'Planung', beschreibung: '' },
    { titel: 'Anfahrt und Montage-Pauschale', beschreibung: '' },
  ])
  assert.deepEqual(hinweise, [{ art: 'gemeinposition', titel: 'Planung', nummern: [1, 3] }])
})

test('Ein einzelnes Vorkommen meldet nichts, und leere Listen stürzen nicht ab', () => {
  assert.deepEqual(findeDubletten([{ titel: 'Planung' }]), [])
  assert.deepEqual(findeDubletten([]), [])
  assert.deepEqual(findeDubletten(null), [])
})
```

Run: `node --test tests/bloecke.test.mjs` → FAIL (`masseAus` fehlt).

- [ ] **Step 2: Implementierung in `bloecke.ts`**

```ts
/** Drei Zahlen mit x/× dazwischen — die übliche Schreibweise für B × T × H. */
const MASSE = /(\d{2,5})\s*[x×*]\s*(\d{2,5})(?:\s*[x×*]\s*(\d{2,5}))?/i

/**
 * Normalisierte Maßangabe aus Titel und Beschreibung, z. B. "2000x600x2400".
 * Leer, wenn keine zusammenhängende Maßkette gefunden wird — dann ist „gleiche Maße“
 * keine belastbare Aussage, und zwei Positionen gelten NICHT als Dublette.
 */
export function masseAus(text: string): string {
  const t = String(text ?? '').replace(/\s+/g, ' ')
  const m = MASSE.exec(t)
  if (!m) return ''
  return [m[1], m[2], m[3]].filter(Boolean).join('x')
}

export type Dublettenhinweis = { art: 'dublette' | 'gemeinposition'; titel: string; nummern: number[] }

const normTitel = (t: unknown) => String(t ?? '').trim().replace(/\s+/g, ' ').toLowerCase()

/**
 * Sucht zwei Sorten von Doppelungen nach dem Zusammenführen der Blöcke:
 *   1. GLEICHER TITEL UND GLEICHE MASSE — sehr wahrscheinlich dieselbe Position aus
 *      zwei Blöcken.
 *   2. GEMEINPOSITIONEN, die mehr als einmal vorkommen (Planung, Besprechung,
 *      Konstruktion, Montage-Pauschale, Anfahrt) — die fallen für das ganze Projekt
 *      einmal an.
 *
 * GEMELDET, NICHT VERSCHMOLZEN (Fabian, 16.09.): Zwei gleich benannte Schränke mit
 * gleichen Maßen KÖNNEN zwei echte Schränke sein. Automatisch zusammengelegt wäre das
 * Angebot stillschweigend zu billig — der schlimmere Fehler.
 * Die Nummern sind 1-basiert wie die Positionsnummern in der Oberfläche.
 */
export function findeDubletten(
  positionen: Array<{ titel?: string; beschreibung?: string }> | null | undefined,
): Dublettenhinweis[] {
  const liste = Array.isArray(positionen) ? positionen : []
  const hinweise: Dublettenhinweis[] = []

  // 1. Titel + Maße
  const nachSchluessel = new Map<string, { titel: string; nummern: number[] }>()
  liste.forEach((p, i) => {
    const titel = normTitel(p?.titel)
    if (!titel) return
    const masse = masseAus(`${p?.titel ?? ''} ${p?.beschreibung ?? ''}`)
    if (!masse) return
    const schluessel = `${titel}|${masse}`
    const eintrag = nachSchluessel.get(schluessel) ?? { titel: String(p?.titel ?? '').trim(), nummern: [] }
    eintrag.nummern.push(i + 1)
    nachSchluessel.set(schluessel, eintrag)
  })
  for (const e of nachSchluessel.values()) {
    if (e.nummern.length > 1) hinweise.push({ art: 'dublette', titel: e.titel, nummern: e.nummern })
  }

  // 2. Gemeinpositionen
  for (const gemein of GEMEINPOSITIONEN) {
    const nummern: number[] = []
    liste.forEach((p, i) => {
      if (normTitel(p?.titel).includes(gemein.toLowerCase())) nummern.push(i + 1)
    })
    if (nummern.length > 1) hinweise.push({ art: 'gemeinposition', titel: gemein, nummern })
  }

  return hinweise
}
```

Run: `node --test tests/bloecke.test.mjs` → grün.

- [ ] **Step 3: Hinweisliste über der Kalkulation**

In `src/app/page.tsx` den Import erweitern:
```ts
import { baueKontext, vereinigePositionen, findeDubletten } from '@/lib/bloecke'
```
Neben `const preisfaktorAnzeige = angezeigterPreisfaktor(pos)` (Task P3) ergänzen:
```ts
  // Nur nach einer Blockanalyse: Bei einem einzelnen Block kann es diese Doppelungen
  // nicht geben, und ein Hinweis ohne Anlass macht die Kalkulation unglaubwürdig.
  const dublettenHinweise = bloecke.length > 1 ? findeDubletten(pos) : []
```
Direkt über der Gesamtübersicht (vor Zeile 3720, `{/* Gesamtübersicht oben */}`) einfügen:

```tsx
            {dublettenHinweise.length > 0 && (
              <div style={{ background: C.gray1, border: `1px solid ${C.warn}`, borderRadius: 4,
                padding: '12px 14px', marginBottom: 12 }}>
                <div style={{ color: C.warn, fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>
                  Bitte nachsehen: mögliche Doppelungen aus den Blöcken
                </div>
                {dublettenHinweise.map(h => (
                  <div key={`${h.art}-${h.titel}`} style={{ color: C.white, fontSize: 12, lineHeight: 1.7 }}>
                    {h.art === 'gemeinposition'
                      ? `„${h.titel}“ fällt für das ganze Projekt einmal an, steht aber in Position ${h.nummern.join(' und ')}.`
                      : `„${h.titel}“ steht mit denselben Maßen in Position ${h.nummern.join(' und ')}.`}
                  </div>
                ))}
                <div style={{ color: C.textMid, fontSize: 11.5, marginTop: 6 }}>
                  CraftFlow legt nichts von selbst zusammen — zwei gleich benannte Möbel können
                  auch wirklich zwei sein. Löschen oder anpassen kannst du sie unten.
                </div>
              </div>
            )}
```

- [ ] **Step 4: Typprüfung, Lint, Tests, Commit**

Run: `npx tsc --noEmit -p tsconfig.json | grep -v "^.next/"` → keine Ausgabe.
Run: `npm run lint` → keine neuen Fehler.
Run: `npm run test` → alles grün.

```bash
git add src/lib/bloecke.ts tests/bloecke.test.mjs src/app/page.tsx
git commit -m "feat(bloecke): Dubletten und doppelte Gemeinpositionen melden statt still verschmelzen"
```

---

### Task C6: Live-Test-Protokoll auf der dev-Vorschau und Doku

**Files:**
- Modify: `src/lib/assistentwissen.ts` (Blöcke im Wissen)
- Modify: `CLAUDE.md` (Abschnitt „Große Projekte in Blöcken“)

- [ ] **Step 1: SQL-Migrationen eingespielt?**

Der Controller muss `docs/sql/2026-09-16-bloecke-storage.sql` ausgeführt haben (Bucket **privat**, vier Policies, GRANTs). Gegenprobe vor dem Live-Test: Im Supabase-Dashboard unter Storage steht `projektdateien` und ist **nicht** öffentlich. Ohne die Policies scheitert jeder Upload mit „new row violates row-level security policy“ — sichtbar an der Kachel, nicht stumm.

- [ ] **Step 2: Assistent ergänzen**

In `src/lib/assistentwissen.ts` unter „NEUES ANGEBOT“ (nach der GAEB-Zeile) einfügen:

```
→ Große Projekte (viele Fotos, langes Leistungsverzeichnis): hochladen, dann „Großes Projekt in Blöcken kalkulieren“. CraftFlow teilt Text und Bilder in Blöcke und rechnet sie nacheinander; du siehst „Block 3 von 7“ und die bisherigen Positionen. Abbrechen geht jederzeit, das Ergebnis bis dahin bleibt. Jeder Block zählt als ein Angebot. Ab dem Pro-Plan.
```

Run: `npm run test` → alles grün (der Assistent-Test prüft die Plan-Nennung).

- [ ] **Step 3: Live-Test-Protokoll** (`https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app`)

**Kostenregel: Die KI-Aufrufe in Schritt 5 und 6 sind die einzigen bezahlten Schritte. Sie werden GENAU EINMAL ausgeführt. Kein Wiederholen „zur Sicherheit“, keine Schleifen.** Erwartete Kosten: rund 1,50 $ für den großen Durchlauf.

  1. **Upload ohne Plan-Recht:** Testkonto per SQL auf `plan = 'solo'`, `abo_status = 'aktiv'`, `trial_starts_at = now() - 30 Tage`. Ein Foto hochladen → **403** „Der Datei-Upload ist ab dem Starter-Plan verfügbar.“, Kachel zeigt den Text. Kostet nichts.
  2. **Dateideckel:** Plan auf `starter` (5 Dateien je Projekt). Sechs Fotos hochladen → die ersten fünf gehen durch, das sechste bekommt **403** „Im Starter-Plan sind 5 Dateien je Projekt möglich. Ab dem Pro-Plan 25 Dateien je Projekt.“ Kostet nichts.
  3. **Blöcke ab Pro:** Plan bleibt `starter`. Ein PDF mit rund 20 Seiten hochladen, „Großes Projekt in Blöcken kalkulieren“ → **403** „Große Projekte in Blöcken sind ab dem Pro-Plan möglich.“ **Kein KI-Aufruf — kostet nichts.**
  4. **Vorbereiten:** Plan auf `pro`. Dasselbe PDF plus zwei Fotos und ein absichtlich gescanntes (textloses) PDF. „Vorbereiten“ läuft → Anzeige „N Blöcke, 1 Datei nicht lesbar: scan.pdf (kein lesbarer Text (gescannt?) — bitte als Foto hochladen)“. **Kein KI-Aufruf.** Gegenprobe: Die Summe der `zeichen` über alle Blöcke entspricht der Textlänge; keine Meldung über gekürzten Text.
  5. **Abbrechen (ein KI-Aufruf):** Blockanalyse starten, nach dem ersten fertigen Block „Abbrechen“ drücken. Erwartet: Es startet **kein** weiterer Block, die Positionen aus Block 1 stehen in der Kalkulation, kein Fehlerbildschirm. In `/api/usage` ist **ein** Angebot verbraucht.
  6. **Der große Durchlauf (ein Durchlauf, N KI-Aufrufe):** Ein echtes 40-seitiges Leistungsverzeichnis und rund 10 Fotos. Erwartet und zu protokollieren:
     - jeder Block läuft unter 300 s durch (Laufzeit je Block notieren),
     - „Block k von N“ zählt hoch, die Positionsliste wächst sichtbar,
     - Kunde und Kopfdaten stammen aus Block 1 und werden nicht überschrieben,
     - die Positionsnummerierung läuft fortlaufend, keine id doppelt (Bearbeiten einer Position ändert nur diese),
     - Gemeinpositionen (Planung, Besprechung, Konstruktion, Montage-Pauschale, Anfahrt) stehen **einmal**; falls doch doppelt → der gelbe Hinweiskasten meldet sie mit Positionsnummern,
     - Stichprobe: fünf Positionen aus der Mitte und vom Ende des LV sind in der Kalkulation vorhanden — **nichts wurde still gekürzt**,
     - `/api/usage` zählt genau N Angebote (ein Block ohne Positionen zählt nicht),
     - PDF erzeugen: Summen stimmen mit der App überein.
  7. **Aufräumen:** Testprojekt löschen, Plan des Testkontos auf den echten Stand zurücksetzen. Screenshots unter `/tmp/cfshots/bloecke-*.png`; Laufzeiten und Blockzahl ins Protokoll.

- [ ] **Step 4: CLAUDE.md**

```markdown
## Große Projekte in Blöcken (Stand 2026-09-16)
- **Nichts wird stumm gekürzt.** Die alte 10.000-Zeichen-Grenze in `/api/analyze` gilt nur
  noch für kleine Projekte ohne Dateien. Große Projekte laufen über
  `POST /api/upload` → `POST /api/analyze/vorbereiten` → `POST /api/analyze/block` (je Block).
- **Die reine Teil-Logik liegt in `src/lib/bloecke.ts`** (importfrei, `tests/bloecke.test.mjs`):
  schneiden (≤ 8.000 Zeichen, ≤ 6 Bilder), Kontext bauen, Positionen vereinigen, Dubletten
  finden. Der Test prüft nicht nur die Schnittstellen, sondern dass sich der Ausgangstext
  wieder zusammensetzen lässt — das ist die Gegenprobe gegen stilles Wegwerfen.
- **Schnittregel:** Positionsnummer vor Seitengrenze vor Absatz. Eine einzelne überlange
  Zeile bildet ihren eigenen Block — lieber ein zu großer Block als eine verschwundene Zeile.
- **Block 1 trägt Kunde, Kopfdaten und die Gemeinpositionen.** Folgeblöcke bekommen den
  Kontext (`baueKontext`) und die feste Prompt-Regel `BLOCK_REGEL` — ein eigener,
  unveränderlicher System-Block, damit `cache_control` greift. Nutzertext gehört nie hinein.
- **Jeder Block reserviert ein Angebot** (`reserviere_angebot` VOR dem KI-Aufruf); ohne
  Positionen wird es wieder freigegeben. Sieben Blöcke = sieben Angebote.
- **Dateien liegen im privaten Bucket `projektdateien`**, Pfad `<user_id>/<projekt_id>/<uuid>-<name>`,
  eine Anfrage je Datei (damit fällt die 4,5-MB-Wand von Vercel). Dateien mit führendem
  Unterstrich sind interne Zwischenstände (`_vorbereitet.json`) und zählen nicht gegen den
  Dateien-Deckel. SQL: `docs/sql/2026-09-16-bloecke-storage.sql` — **mit GRANTs.**
- **Dubletten werden gemeldet, nie verschmolzen.** Zwei gleich benannte Möbel mit gleichen
  Maßen können zwei echte Möbel sein; automatisch zusammengelegt wäre das Angebot
  stillschweigend zu billig.
- `src/app/api/analyze/gemeinsam.ts` hält `SYSTEM_PROMPT` und `validateAndFix` — beide
  Analyse-Routen lesen dort. Zwei Kopien des Systemprompts wären der sichere Weg in
  auseinanderlaufende Kalkulationen.
```

```bash
git add src/lib/assistentwissen.ts CLAUDE.md
git commit -m "docs: große Projekte in Blöcken — Assistent und Regeln für künftige Änderungen"
git push origin dev
```

- [ ] **Step 5: Freigabe**

Alles liegt auf `dev` (App) und `dev` (Website). **Eine** Abnahme durch Fabian über alle drei Teile, dann gemeinsam `dev → main` — App und Website zusammen. Nichts vorher.

---

## Self-Review

### Spec-Abdeckung, Task für Task

**Teil P — Zeitfaktoren 0,50–3,00 und Preisfaktor**

| Spec-Satz | Task | Stand |
|---|---|---|
| Zeitfaktoren von Hand 0,50–3,00, Ableitung bleibt 0,6–1,4 | P1 (`deckeleHand` neben `deckele`), P2 (Route `vonHand`), P3 (Eingabefelder + Vorab-Prüfung) | ✔ |
| Preisfaktor 0,50–3,00, Standard 1,00, multipliziert den Endpreis jeder Position, Material und Lohn zusammen, ohne die Stunden zu verändern | P1 (`calcAngebotspos`, Test prüft `stundenGesamt` und `materialkostenGesamt` ausdrücklich) | ✔ |
| Speicherort `betriebsprofil.preisfaktor numeric(4,2) not null default 1.00`, SQL-Datei `docs/sql/2026-09-16-preisfaktor.sql` | P1 Step 8 | ✔ |
| PATCH-Route: in `allowed`, serverseitig auf 0,5–3,0 geklemmt, sonst 400 mit Meldung | P2 Step 1 (bewusst **nicht** in `numFields` — `Number('abc')` wäre `NaN` in der Datenbank) | ✔ |
| Der Faktor wird auf die Position gestempelt (`preisfaktor?: number`); Ändern verändert alte Angebote nicht | P1 (`stempelPreisfaktor`, Test „nur auf Positionen, die noch keinen tragen“) | ✔ |
| Neue Positionen aus der Analyse, aus dem Optimieren (`updatedOffer`) und manuell angelegte bekommen den Faktor | P2 Step 3+4, P3 Step 3 | ✔ |
| `nettoSumme` summiert `calcAngebotspos`; `stundenGesamt`, `materialkostenGesamt`, Stundensätze, Aufschläge bleiben unberührt | P1 (bestehende Funktionen unverändert, Test belegt es) | ✔ |
| Kalkulationsübersicht: Zeile „Preisfaktor 1,25“, nur wenn ≠ 1,00 | P3 Step 4 (`angezeigterPreisfaktor`, `null` = nichts anzeigen) | ✔ |
| „Mein Betrieb“: eigener Abschnitt „Preisfaktor“ unter den Zeitfaktoren, Erklärungstext **wörtlich**, Knopf-Muster wie „Faktoren von Hand übernehmen“ | P3 Step 2 | ✔ |
| Erscheint NICHT im PDF und NIE im KI-Prompt | P2: gestempelt **nach** der KI-Antwort; keine Zeile in `pdf.ts` angefasst. Live-Gegenprobe P4 Step 4.5 | ✔ |
| Hilfe-Assistent kennt beides | P4 (`PFLICHTTHEMEN` + Test) | ✔ |
| Tests `tests/preisfaktor.test.mjs`, `tests/kalibrierung.test.mjs` ergänzen | P1 Step 1 + 7 | ✔ |

**Teil W — Wünsche-Community**

| Spec-Satz | Task | Stand |
|---|---|---|
| Bereich „Wünsche“ in den Einstellungen, jeder Plan darf vorschlagen und abstimmen, neue Vorschläge sofort sichtbar | W4 | ✔ |
| Stimmenbudget 1 / 3 / 10 / 30 als `DeckelArt 'wunschStimmen'` | W1 | ✔ |
| Je Wunsch höchstens eine Stimme; Budget frei verteilbar; Stimmen jederzeit zurücknehmbar | W2 (Primärschlüssel `(wunsch_id, user_id)`, `DELETE …/stimme`) | ✔ |
| Wechsel nach unten: älteste N bleiben aktiv, wirkt beim Lesen (`wendeDeckelAn`) | W1 (`aktiveStimmen`, Test), W6 Live-Schritt 5 | ✔ |
| Status `offen` \| `geplant` \| `in_arbeit` \| `fertig` \| `ausgeblendet`, Ausblenden nur Fabian, Fertige bleiben sichtbar | W1 (`WUNSCH_STATUS`), W2 (SQL-Check), W3 (Admin-Route), W4 (Abzeichen) | ✔ |
| Datenmodell `wuensche` / `wunsch_stimmen` mit RLS **und GRANTs** | W2 Step 1 | ✔ |
| Stimmenzahl serverseitig gerechnet, nicht in SQL-Views | W1 (`stimmenJeWunsch`), W2 (Service-Role-Zählung, Begründung im Dateikopf) | ✔ |
| `GET /api/wuensche` (Liste, eigene Stimme, Budget `{ gesamt, benutzt }`) | W2 | ✔ |
| `POST /api/wuensche` mit Textlängen und max. 3 offenen Vorschlägen je Nutzer und Tag | W2 (`pruefeTexte`, `VORSCHLAEGE_JE_TAG`) | ✔ |
| `POST/DELETE /api/wuensche/[id]/stimme`, 403-Text **wörtlich** + `minPlan` | W1 (`stimmenAblehnung`, Test prüft den Satz), W2 | ✔ |
| `PATCH /api/admin/wuensche/[id]` (Status, zusammenlegen, ausblenden — nur Fabian) | W3 | ✔ |
| `pruefeZugang` überall; gesperrte Nutzer können weder vorschlagen noch abstimmen | W2, W3 (jede Route ruft `pruefeZugang`; zusätzlich ergibt `stimmenbudget` für `'gesperrt'` 0) | ✔ |
| Oberfläche: Budget-Zeile „Du hast 3 von 10 Stimmen vergeben“, Formular, Liste nach Stimmen sortiert, Status-Abzeichen, Stimmen-Knopf, Datum, „von dir“, nur `C.*`/`akzentTon()` | W4 | ✔ |
| Website `/roadmap`, drei Spalten Geplant / In Arbeit / Fertig, Link in der Navigation, FAQ „Was passiert mit meinen Wünschen?“ | W5 | ✔ |
| Öffentliche API `GET /api/wuensche/oeffentlich`, in `PUBLIC_PATHS`, ohne Nutzerdaten, 5 Minuten Cache | W3 (`s-maxage=300`), Test gegen zu großzügiges `startsWith` | ✔ |

**Teil C — Große Projekte in Blöcken**

| Spec-Satz | Task | Stand |
|---|---|---|
| Upload je Datei, Bucket `projektdateien`, Pfad `<user_id>/<projekt_id>/<uuid>-<name>`, privat | C1 | ✔ |
| `POST /api/upload` prüft `pruefeZugang`, `erlaubt('dateien')`, Deckel `dateien` je Projekt (zählt Storage), ≤ 10 MB, jpg/png/webp/pdf; Antwort `{ pfad, name, groesse }` | C1 | ✔ |
| Fotos werden weiter im Browser verkleinert (`compressImage`) | C4 Step 4 (das **verkleinerte** Bild wird hochgeladen) | ✔ |
| Ohne `projekt_id` zuerst Projekt-Entwurf mit Titel „Entwurf“ | C1 | ✔ |
| `DELETE /api/upload` entfernt eine Datei | C1 | ✔ |
| `POST /api/analyze/vorbereiten { projekt_id, text }`: Dateien lesen, PDF-Text über `unpdf`, teilen (≤ 8.000 Zeichen, ≤ 6 Bilder), Antwort `{ bloecke: [{ nr, vorschau, zeichen, bilder }], nichtVerarbeitet: [{ name, grund }] }` | C2 | ✔ |
| Schnitt bevorzugt an Positionsnummern (`1.2`, `01.03`, `Pos. 4`), sonst Seitenumbruch, sonst Absatz | C2 (`schnittRang`, Tests je Rang) | ✔ |
| Bilder in Upload-Reihenfolge zugeteilt | C2 (Test „kein Bild fällt weg, Reihenfolge bleibt“) | ✔ |
| Mehr als ein Block braucht `erlaubt('bloecke')`, sonst 403 **wörtlich** „Große Projekte in Blöcken sind ab dem Pro-Plan möglich.“ | C2 (`bloeckeAblehnung`, Test auf den Satz) | ✔ |
| Ein einzelner Block ohne Dateien läuft wie heute über `/api/analyze` | `/api/analyze` bleibt inhaltlich unverändert (C3 verschiebt nur Code, ohne eine Zeile zu ändern) | ✔ |
| `POST /api/analyze/block { projekt_id, blockNr, kontext }`, Zugang, Deckel `angebote` je Block (`reserviere_angebot`, ohne Positionen wieder frei) | C3 | ✔ |
| Kontext trägt Kunde, Kopfdaten, bisherige Positionstitel; Gemeinpositions-Verbot als eigener, fester Block (kein Nutzertext), damit das Caching greift | C3 (`baueKontext`, `BLOCK_REGEL` mit `cache_control`; Test prüft den Satz wörtlich und dass kein `${` darin steht) | ✔ |
| Browser: Upload mit Fortschritt → „Vorbereiten“ → „7 Blöcke, 2 Dateien nicht lesbar: …“ → Blöcke nacheinander → „Block 3 von 7“ mit bisherigen Positionen → Abbrechen, Ergebnis bleibt | C4 | ✔ |
| Zusammenführen: Positionen anhängen, Nummerierung fortlaufend, Kunde/Kopf aus Block 1 | C4 (`vereinigePositionen`, Kunde nur aus Block 1) | ✔ |
| Dubletten (gleicher Titel und gleiche Maße) werden als Hinweisliste gezeigt, nicht still verschmolzen | C5 | ✔ |
| Gemeinpositionen gegen eine feste Liste prüfen (Planung, Besprechung, Konstruktion, Montage-Pauschale, Anfahrt) | C3 (`GEMEINPOSITIONEN`), C5 (`findeDubletten`) | ✔ |
| Jede Route ≤ 300 s (`maxDuration`) | C1, C2, C3 (`export const maxDuration = 300`) | ✔ |
| Storage-RLS und GRANTs beim Anlegen des Buckets prüfen | C1 (SQL), C6 Step 1 (Gegenprobe im Dashboard) | ✔ |
| Kein Streaming, keine Warteschlange, kein GAEB als Blockquelle | nicht enthalten — bewusst | ✔ |

**Bewusst nicht in diesem Plan:** Teil B (Kostenzähler) — zurückgestellt, kommt in keiner Zeile vor. Hintergrund-Warteschlange, E-Mail bei Fertigstellung und GAEB als Blockquelle stehen in der Spec ausdrücklich unter „Nicht in dieser Runde“.

### Platzhalter-Scan

Kein „TBD“, kein „später“, kein „ähnlich wie Task N“. Jede Datei ist mit vollständigem Pfad benannt, jede Änderung an einer bestehenden Datei mit Zeilenbereich, jeder Text ausgeschrieben. Drei Stellen verlangen ausdrücklich, im Code **nachzulesen** statt zu erfinden — das ist Absicht, nicht Unschärfe:
1. **C3 Step 3** (Verschiebung nach `gemeinsam.ts`): Der Bereich ist über Zeilennummern und Grenzen (`SYSTEM_PROMPT` bis `MAX_IMAGE_B64_BYTES`, alles vor `export async function POST`) eindeutig bestimmt, und die Prüfung ist benannt (`git diff --stat`, `tsc`, `npm run test`). Eine 780-Zeilen-Verschiebung wörtlich abzuschreiben, würde nur die Gefahr eines Tippfehlers erzeugen.
2. **C3 Step 4** (Importpfade für `Faktoren`/`ladeFaktoren`/`ladeKalibrierung`): ausdrücklich aus `analyze/route.ts` zu übernehmen, mit `grep`-Befehl.
3. **P2 Step 2**: Falls der Linter `deckele` als ungenutzten Import meldet, ist er zu entfernen — die Entscheidung steht im Plan, nicht offen.

### Typkonsistenz

- `Plan`, `EffektiverPlan`, `Funktion`, `DeckelArt` sind **nur** in `src/lib/plaene.ts` definiert. `wunschStimmen` wird dort ergänzt; jede `Record<DeckelArt, …>`-Tabelle (vier Einträge in `PLAENE`, `DECKEL_NAME` in `plantexte.ts`) wird im selben Task mitgezogen — der Compiler erzwingt das, weil `Record` vollständig sein muss.
- `Angebotsposition.preisfaktor?: number` ist optional; alle Leser gehen defensiv damit um (`calcAngebotspos`, `preisfaktorVon`, `stempelPreisfaktor`, `angezeigterPreisfaktor`). `UiPosition` in `kiantwort.ts` trägt dasselbe Feld, damit der Weg KI → Server → Browser typgleich ist.
- `klemmePreisfaktor` liefert `number | null` — `null` heißt „keine Zahl“ und führt in der Route zu 400, nie zu einem stillen Standardwert. Alle drei Aufrufer (`betriebsprofil`, `analyze`, `optimize`, `block`) verwenden `?? PREISFAKTOR_STANDARD` bzw. den 400-Zweig.
- `pruefeZugang`, `pruefeFunktion`, `pruefeDeckel` liefern weiterhin `NextResponse | null` und werden überall als `const sperre = …; if (sperre) return sperre` verwendet.
- `stimmenbudget` nimmt `ProfilFuerPlan | null | undefined` und liefert immer eine Zahl (`'gesperrt'` → 0). `aktiveStimmen`/`stimmenJeWunsch` nehmen `Record<string, ProfilFuerPlan | null | undefined>` — ein fehlendes Profil ist damit ein gültiger Fall, kein Absturz.
- `wendeDeckelAn` verlangt `{ created_at: string }`; `wunsch_stimmen.created_at` ist `timestamptz not null` und kommt als ISO-Zeichenkette an — dieselbe Voraussetzung wie bei Bauweise-Regeln und Materialpreisen.
- `Block` (`{ nr, text, bilder }`) ist die einzige Form, in der Blöcke zwischen `vorbereiten` (schreibt `_vorbereitet.json`) und `block` (liest sie) reisen; `BlockInfo` ist die reduzierte Form für den Browser und enthält **keinen** Text.
- `vereinigePositionen<T extends { id: number }>` ist generisch und wird im Browser mit `Angebotsposition` aufgerufen — die neu vergebenen ids sind `number`, wie die Oberfläche sie überall erwartet.
- Testdateien laden ausschließlich `src/lib/*.ts`-Module ohne React- oder Supabase-Import: `preisfaktor.ts` (keine Importe), `bloecke.ts` (keine Importe), `wuensche.ts` (nur `plaene.ts` mit `.ts`-Endung), `plantexte.ts` (nur `plaene.ts`), `types.ts`, `kalibrierung.ts`, `kiantwort.ts` (alle bereits importfrei). `npm run test` bleibt lauffähig.
