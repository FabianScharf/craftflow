# Lernfunktion Bauweise-Vault — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CraftFlow erkennt Korrekturen des Nutzers am KI-Vorschlag, fragt einmal gesammelt nach, und wendet bestätigte Bauweise-Regeln ab dem nächsten Angebot pro Nutzer automatisch an.

**Architecture:** Hybrid. Reine Vergleichsfunktionen in `src/lib/learn.ts` liefern belegte Änderungen aus KI-Erstvorschlag vs. Endstand. Ein KI-Call formuliert daraus Wenn-Dann-Regeln, die eine Pflicht-Belegangabe tragen; der Server verwirft jeden unbelegten Kandidaten. Bestätigte Regeln liegen pro `user_id` in `bauweise_regeln` und werden serverseitig in die System-Prompts von `/api/analyze` und `/api/optimize` eingehängt.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Supabase (Postgres + RLS), Anthropic `claude-sonnet-4-6`. Tests: Node-24-eigener Test-Runner (`node --test`) gegen TypeScript direkt — **keine neuen Pakete**.

**Spec:** `docs/superpowers/specs/2026-07-31-lernfunktion-bauweise-vault-design.md`

## Global Constraints

- Branch: alles auf `dev`. **Niemals direkt auf `main`.** Merge nach `main` erst nach Fabians ausdrücklicher Freigabe.
- Sprache: alle nutzersichtbaren Strings **deutsch**. Code, Bezeichner und Kommentare englisch oder deutsch wie im umgebenden Code — Kommentare im Projekt sind gemischt, neue Kommentare in der Sprache der jeweiligen Datei halten.
- Styling: ausschließlich inline `style={{}}` mit Konstanten aus `@/lib/types` (Palette `C`). **Kein Tailwind, keine CSS-Module.**
- `src/app/page.tsx` bleibt eine Datei — UI nicht in Komponenten-Dateien auslagern (Projekt-CLAUDE.md). Ausnahme: Einstellungs-Teilbereiche, die dort schon als eigene Komponenten liegen (`src/components/settings/`).
- Keine Formatierungswerkzeuge hinzufügen (kein Prettier).
- Der Lern-Pfad darf **niemals** Speichern oder PDF-Export blockieren. Jeder Fehler wird geschluckt, geloggt mit Prefix `[learn]`, und führt schlimmstenfalls dazu, dass kein Dialog erscheint.
- Regeln beeinflussen **nie** `vkStunde`, `aufschlag` oder Preise. Die bleiben deterministisch aus `validateAndFix` (analyze) und `applyUserRates` (optimize).
- `user_id` immer aus `supabase.auth.getUser()`, **niemals** aus dem Request-Body.
- Rauschfilter-Schwellen exakt: Minuten ab **25 % UND 15 Minuten** absolut, Menge ab **20 %**.
- Prompt-Obergrenze: **60** aktive Regeln. Aufräum-Hinweis im Vault-UI ab **40**.
- Lokal läuft die App nicht (`.env.local` enthält nur leere Platzhalter). `npm run dev` nicht versuchen. **Auch `npm run build` läuft lokal NICHT** — er bricht vorbestehend bei `/api/stripe/checkout` ab, weil die Stripe-Keys fehlen (verifiziert 2026-07-31, unabhängig von diesem Feature). Der lokale Typecheck ist stattdessen **`npx tsc --noEmit`** (läuft sauber durch, Exit 0). Der echte Build passiert auf Vercel. Funktionstest live auf der dev-Preview.
- **Lint: `npm run lint` hat im Repo KEINE saubere Basis** (Stand 2026-07-31: 513 Fehler, 9414 Warnungen, alle in Bestandsdateien wie `src/hooks/usePlan.ts`). Ein grüner Gesamt-Lint ist also kein erreichbares Ziel und darf kein Abbruchkriterium sein. Verbindlich ist stattdessen: **`npx eslint <die von dir geänderten/neuen Dateien>` muss leer ausgeben.** Bestandsfehler in fremden Dateien nicht mitreparieren — das wäre Scope-Ausweitung.

## File Structure

```
NEU   src/lib/learn.ts                              Reine Logik: Diff, Rauschfilter, Belegprüfung,
                                                    Regel-Gleichheit, Prompt-Block. Keine DB, kein Netz.
NEU   src/lib/bauweise.ts                           Serverseitige DB-Helfer (Regeln laden, Zähler hoch).
                                                    Getrennt von learn.ts, damit learn.ts testbar bleibt.
NEU   tests/learn-diff.test.mjs                     Tests Task 1
NEU   tests/learn-beleg.test.mjs                    Tests Task 2
NEU   tests/learn-prompt.test.mjs                   Tests Task 3
NEU   docs/sql/2026-07-31-bauweise-regeln.sql       Tabelle + RLS + Zähler-Funktion (Fabian führt aus)
NEU   src/app/api/settings/bauweise/route.ts        Vault CRUD
NEU   src/app/api/learn/candidates/route.ts         Kandidaten erzeugen
NEU   src/components/settings/BauweiseSettings.tsx  Vault-UI
ÄND   package.json                                  test-Script
ÄND   src/app/api/analyze/route.ts                  Regel-Block in Prompt
ÄND   src/app/api/optimize/route.ts                 Regel-Block in Prompt
ÄND   src/app/page.tsx                              Erstvorschlag-Ref + Lern-Dialog
ÄND   src/app/settings/page.tsx                     Vault-Reiter einhängen
ÄND   CLAUDE.md                                     Vault als Engine-Invariante
```

**Warum `learn.ts` und `bauweise.ts` getrennt sind:** `learn.ts` importiert nichts. Damit kann Node es direkt ausführen und die riskante Logik (Rauschfilter, Belegprüfung) ist ohne Keys und ohne Datenbank testbar — der einzige Weg, diese Logik in diesem Projekt überhaupt zu testen. Sobald ein Supabase-Import darin läge, wäre das vorbei.

---

### Task 1: Diff-Engine mit Rauschfilter

**Files:**
- Create: `src/lib/learn.ts`
- Create: `tests/learn-diff.test.mjs`
- Modify: `package.json` (Script `test`)

**Interfaces:**
- Consumes: nichts.
- Produces: `Bereich`, `BEREICHE`, `MIN_MINUTEN_PROZENT`, `MIN_MINUTEN_ABSOLUT`, `MIN_MENGE_PROZENT`, `LernMaterial`, `LernArbeitszeit`, `LernPosition`, `LernOffer`, `Aenderung`, `normalisiere(text: string): string`, `diffOffer(kiVorschlag: LernOffer, endstand: LernOffer): Aenderung[]`

- [ ] **Step 1: Test-Script in `package.json` eintragen**

In `"scripts"` ergänzen (die Glob-Form ist nötig — `node --test tests/` schlägt in Node 24 mit `MODULE_NOT_FOUND` fehl):

```json
"test": "node --test \"tests/**/*.test.mjs\""
```

Keine `devDependencies` ändern. Node 24 führt TypeScript per Type-Stripping direkt aus.

- [ ] **Step 2: Den fehlschlagenden Test schreiben**

`tests/learn-diff.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { diffOffer } from '../src/lib/learn.ts'

// Hilfsfunktion: eine Position mit Standardwerten, einzelne Felder überschreibbar.
const p = (over = {}) => ({ id: 'p1', titel: 'Garderobe', material: [], arbeitszeit: [], ...over })

test('Material ersetzt (gleiche id, andere Bezeichnung)', () => {
  const alt = { positionen: [p({ material: [{ id: 'm1', bezeichnung: 'HPL 6mm', menge: 2 }] })] }
  const neu = { positionen: [p({ material: [{ id: 'm1', bezeichnung: 'Multiplex Birke 8mm', menge: 2 }] })] }
  const d = diffOffer(alt, neu)
  assert.equal(d.length, 1)
  assert.equal(d[0].art, 'material_ersetzt')
  assert.equal(d[0].vorher, 'HPL 6mm')
  assert.equal(d[0].nachher, 'Multiplex Birke 8mm')
  assert.equal(d[0].position, 'Garderobe')
  assert.equal(d[0].nr, 1)
})

test('Material ersetzt auch ohne ids (Paarung nach Reihenfolge)', () => {
  const alt = { positionen: [p({ material: [{ bezeichnung: 'HPL 6mm', menge: 1 }] })] }
  const neu = { positionen: [p({ material: [{ bezeichnung: 'Multiplex 8mm', menge: 1 }] })] }
  const d = diffOffer(alt, neu)
  assert.equal(d.length, 1)
  assert.equal(d[0].art, 'material_ersetzt')
})

test('Material entfernt und Material neu, wenn Anzahl abweicht', () => {
  const alt = { positionen: [p({ material: [{ id: 'm1', bezeichnung: 'HPL 6mm' }, { id: 'm2', bezeichnung: 'Kantenband ABS' }] })] }
  const neu = { positionen: [p({ material: [{ id: 'm1', bezeichnung: 'HPL 6mm' }] })] }
  const d = diffOffer(alt, neu)
  assert.equal(d.length, 1)
  assert.equal(d[0].art, 'material_entfernt')
  assert.equal(d[0].vorher, 'Kantenband ABS')

  const neu2 = { positionen: [p({ material: [{ id: 'm1', bezeichnung: 'HPL 6mm' }, { id: 'm9', bezeichnung: 'LED-Profil' }] })] }
  const d2 = diffOffer({ positionen: [p({ material: [{ id: 'm1', bezeichnung: 'HPL 6mm' }] })] }, neu2)
  assert.equal(d2.length, 1)
  assert.equal(d2[0].art, 'material_neu')
  assert.equal(d2[0].nachher, 'LED-Profil')
})

test('Minuten: 45 → 70 wird erkannt (55 %, 25 min)', () => {
  const alt = { positionen: [p({ arbeitszeit: [{ kostenstelle: 'Zuschnitt', minuten: 45 }] })] }
  const neu = { positionen: [p({ arbeitszeit: [{ kostenstelle: 'Zuschnitt', minuten: 70 }] })] }
  const d = diffOffer(alt, neu)
  assert.equal(d.length, 1)
  assert.equal(d[0].art, 'minuten_geaendert')
  assert.equal(d[0].kostenstelle, 'Zuschnitt')
  assert.equal(d[0].vorher, 45)
  assert.equal(d[0].nachher, 70)
})

test('Minuten: 45 → 56 wird NICHT erkannt (24 % unter der Prozentschwelle)', () => {
  const alt = { positionen: [p({ arbeitszeit: [{ kostenstelle: 'Zuschnitt', minuten: 45 }] })] }
  const neu = { positionen: [p({ arbeitszeit: [{ kostenstelle: 'Zuschnitt', minuten: 56 }] })] }
  assert.deepEqual(diffOffer(alt, neu), [])
})

test('Minuten: 45 → 57 wird NICHT erkannt (26 %, aber nur 12 min absolut)', () => {
  const alt = { positionen: [p({ arbeitszeit: [{ kostenstelle: 'Zuschnitt', minuten: 45 }] })] }
  const neu = { positionen: [p({ arbeitszeit: [{ kostenstelle: 'Zuschnitt', minuten: 57 }] })] }
  assert.deepEqual(diffOffer(alt, neu), [])
})

test('Minuten: 60 → 76 wird erkannt (26 %, 16 min — beide Schwellen erfüllt)', () => {
  const alt = { positionen: [p({ arbeitszeit: [{ kostenstelle: 'Oberfläche', minuten: 60 }] })] }
  const neu = { positionen: [p({ arbeitszeit: [{ kostenstelle: 'Oberfläche', minuten: 76 }] })] }
  const d = diffOffer(alt, neu)
  assert.equal(d.length, 1)
  assert.equal(d[0].art, 'minuten_geaendert')
})

test('Reine vkStunde-Änderung erzeugt KEINE Änderung', () => {
  const alt = { positionen: [p({ arbeitszeit: [{ kostenstelle: 'Zuschnitt', minuten: 45, vkStunde: 72 }] })] }
  const neu = { positionen: [p({ arbeitszeit: [{ kostenstelle: 'Zuschnitt', minuten: 45, vkStunde: 95 }] })] }
  assert.deepEqual(diffOffer(alt, neu), [])
})

test('Reine aufschlag-Änderung erzeugt KEINE Änderung', () => {
  const alt = { positionen: [p({ material: [{ id: 'm1', bezeichnung: 'Eiche massiv', menge: 3, aufschlag: 0.3 }] })] }
  const neu = { positionen: [p({ material: [{ id: 'm1', bezeichnung: 'Eiche massiv', menge: 3, aufschlag: 0.45 }] })] }
  assert.deepEqual(diffOffer(alt, neu), [])
})

test('Kostenstelle entfernt und Kostenstelle neu', () => {
  const alt = { positionen: [p({ arbeitszeit: [{ kostenstelle: 'CNC', minuten: 30 }] })] }
  const neu = { positionen: [p({ arbeitszeit: [{ kostenstelle: 'Zusammenbau', minuten: 30 }] })] }
  const d = diffOffer(alt, neu)
  assert.equal(d.length, 2)
  assert.deepEqual(d.map(x => x.art).sort(), ['kostenstelle_entfernt', 'kostenstelle_neu'])
})

test('Menge: 10 → 13 wird erkannt (30 %), 10 → 11 nicht (10 %)', () => {
  const mk = (menge) => ({ positionen: [p({ material: [{ id: 'm1', bezeichnung: 'Multiplex 18mm', menge }] })] })
  const d = diffOffer(mk(10), mk(13))
  assert.equal(d.length, 1)
  assert.equal(d[0].art, 'menge_geaendert')
  assert.deepEqual(diffOffer(mk(10), mk(11)), [])
})

test('Gelöschte oder neue Position erzeugt keine Änderungen', () => {
  const alt = { positionen: [p({ id: 'p1', material: [{ id: 'm1', bezeichnung: 'HPL 6mm' }] })] }
  const neu = { positionen: [p({ id: 'p2', material: [{ id: 'm9', bezeichnung: 'Multiplex 8mm' }] })] }
  assert.deepEqual(diffOffer(alt, neu), [])
})

test('Leere Eingaben brechen nicht', () => {
  assert.deepEqual(diffOffer({}, {}), [])
  assert.deepEqual(diffOffer({ positionen: [] }, { positionen: [] }), [])
})

test('Änderungsnummern sind lückenlos ab 1', () => {
  const alt = { positionen: [p({ material: [{ id: 'm1', bezeichnung: 'HPL 6mm' }], arbeitszeit: [{ kostenstelle: 'Zuschnitt', minuten: 45 }] })] }
  const neu = { positionen: [p({ material: [{ id: 'm1', bezeichnung: 'Multiplex 8mm' }], arbeitszeit: [{ kostenstelle: 'Zuschnitt', minuten: 90 }] })] }
  const d = diffOffer(alt, neu)
  assert.deepEqual(d.map(x => x.nr), [1, 2])
})
```

- [ ] **Step 3: Test laufen lassen und Fehlschlag bestätigen**

Run: `cd ~/Downloads/craftflow && npm run test`
Expected: FAIL — `Cannot find module '.../src/lib/learn.ts'`

- [ ] **Step 4: `src/lib/learn.ts` anlegen**

```ts
// Lern-Funktion („Bauweise-Vault"): erkennt, was der Nutzer am KI-Vorschlag
// geändert hat, und leitet daraus bestätigungspflichtige Regeln ab.
//
// WICHTIG: Diese Datei importiert absichtlich NICHTS. Nur so kann Node sie
// direkt ausführen (`npm run test`) — die App läuft lokal nicht, deshalb ist
// das der einzige Weg, die riskante Logik hier überhaupt zu testen.
// Alles, was Supabase braucht, gehört nach src/lib/bauweise.ts.

export type Bereich = 'Material' | 'Konstruktion' | 'Zeit' | 'Oberfläche' | 'Montage' | 'Sonstiges'

export const BEREICHE: Bereich[] = ['Material', 'Konstruktion', 'Zeit', 'Oberfläche', 'Montage', 'Sonstiges']

// Rauschfilter-Schwellen. Bewusst konservativ: eine Korrektur von 45 auf 48
// Minuten ist Feinschliff, kein Prinzip — daraus darf keine Dauerregel werden.
export const MIN_MINUTEN_PROZENT = 25
export const MIN_MINUTEN_ABSOLUT = 15
export const MIN_MENGE_PROZENT = 20

export type LernMaterial = { id?: string | number; bezeichnung?: string; menge?: number }
export type LernArbeitszeit = { id?: string | number; kostenstelle?: string; minuten?: number }
export type LernPosition = {
  id?: string | number
  titel?: string
  material?: LernMaterial[]
  arbeitszeit?: LernArbeitszeit[]
}
export type LernOffer = { positionen?: LernPosition[] }

export type Aenderung =
  | { nr: number; art: 'material_ersetzt';      position: string; vorher: string; nachher: string }
  | { nr: number; art: 'material_entfernt';     position: string; vorher: string }
  | { nr: number; art: 'material_neu';          position: string; nachher: string }
  | { nr: number; art: 'kostenstelle_entfernt'; position: string; kostenstelle: string }
  | { nr: number; art: 'kostenstelle_neu';      position: string; kostenstelle: string }
  | { nr: number; art: 'minuten_geaendert';     position: string; kostenstelle: string; vorher: number; nachher: number }
  | { nr: number; art: 'menge_geaendert';       position: string; material: string; vorher: number; nachher: number }

// Verteilt Omit über die Union — ein direktes Omit<Aenderung,'nr'> würde die
// Diskriminierung platt machen.
type OhneNr<T> = T extends unknown ? Omit<T, 'nr'> : never
type AenderungRoh = OhneNr<Aenderung>

export function normalisiere(text: string): string {
  return (text ?? '')
    .toLowerCase()
    .replace(/[.,;:!?"'„“()\-–]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Beide Schwellen müssen erfüllt sein: relativ UND absolut. Sonst schlägt jede
// Kleinigkeit an kurzen Positionen an (5 → 7 min sind 40 %, aber irrelevant).
function ueberSchwelle(vorher: number, nachher: number, minProzent: number, minAbsolut: number): boolean {
  if (vorher === nachher) return false
  const diffAbs = Math.abs(nachher - vorher)
  if (diffAbs < minAbsolut) return false
  if (vorher === 0) return true
  return (diffAbs / vorher) * 100 >= minProzent
}

export function diffOffer(kiVorschlag: LernOffer, endstand: LernOffer): Aenderung[] {
  const roh: AenderungRoh[] = []
  const alt = kiVorschlag?.positionen ?? []
  const neu = endstand?.positionen ?? []

  for (const posAlt of alt) {
    if (posAlt.id == null) continue
    const posNeu = neu.find(x => x.id === posAlt.id)
    // Gelöschte Position sagt nichts über Bauweise aus → ignorieren.
    if (!posNeu) continue
    const titel = posNeu.titel ?? posAlt.titel ?? ''

    // ── Material: erst über id paaren, dann über normalisierte Bezeichnung ──
    const matAlt = posAlt.material ?? []
    const matNeu = posNeu.material ?? []
    const offenAlt: LernMaterial[] = []
    const genutzt = new Set<number>()

    for (const mAlt of matAlt) {
      let idx = mAlt.id == null ? -1 : matNeu.findIndex((m, i) => !genutzt.has(i) && m.id === mAlt.id)
      if (idx === -1) {
        idx = matNeu.findIndex((m, i) =>
          !genutzt.has(i) && normalisiere(m.bezeichnung ?? '') === normalisiere(mAlt.bezeichnung ?? ''))
      }
      if (idx === -1) { offenAlt.push(mAlt); continue }
      genutzt.add(idx)
      const mNeu = matNeu[idx]
      const bAlt = mAlt.bezeichnung ?? ''
      const bNeu = mNeu.bezeichnung ?? ''
      if (normalisiere(bAlt) !== normalisiere(bNeu)) {
        roh.push({ art: 'material_ersetzt', position: titel, vorher: bAlt, nachher: bNeu })
      }
      if (ueberSchwelle(mAlt.menge ?? 0, mNeu.menge ?? 0, MIN_MENGE_PROZENT, 0)) {
        roh.push({ art: 'menge_geaendert', position: titel, material: bNeu || bAlt, vorher: mAlt.menge ?? 0, nachher: mNeu.menge ?? 0 })
      }
    }

    const offenNeu = matNeu.filter((_, i) => !genutzt.has(i))
    const paare = Math.min(offenAlt.length, offenNeu.length)
    for (let i = 0; i < paare; i++) {
      roh.push({ art: 'material_ersetzt', position: titel, vorher: offenAlt[i].bezeichnung ?? '', nachher: offenNeu[i].bezeichnung ?? '' })
    }
    for (let i = paare; i < offenAlt.length; i++) {
      roh.push({ art: 'material_entfernt', position: titel, vorher: offenAlt[i].bezeichnung ?? '' })
    }
    for (let i = paare; i < offenNeu.length; i++) {
      roh.push({ art: 'material_neu', position: titel, nachher: offenNeu[i].bezeichnung ?? '' })
    }

    // ── Arbeitszeit: über die Kostenstelle paaren, nie über die id ──
    const azAlt = posAlt.arbeitszeit ?? []
    const azNeu = posNeu.arbeitszeit ?? []
    for (const aAlt of azAlt) {
      const ks = aAlt.kostenstelle ?? ''
      const aNeu = azNeu.find(x => normalisiere(x.kostenstelle ?? '') === normalisiere(ks))
      if (!aNeu) { roh.push({ art: 'kostenstelle_entfernt', position: titel, kostenstelle: ks }); continue }
      if (ueberSchwelle(aAlt.minuten ?? 0, aNeu.minuten ?? 0, MIN_MINUTEN_PROZENT, MIN_MINUTEN_ABSOLUT)) {
        roh.push({ art: 'minuten_geaendert', position: titel, kostenstelle: ks, vorher: aAlt.minuten ?? 0, nachher: aNeu.minuten ?? 0 })
      }
    }
    for (const aNeu of azNeu) {
      const ks = aNeu.kostenstelle ?? ''
      if (!azAlt.some(x => normalisiere(x.kostenstelle ?? '') === normalisiere(ks))) {
        roh.push({ art: 'kostenstelle_neu', position: titel, kostenstelle: ks })
      }
    }
  }

  return roh.map((a, i) => ({ ...a, nr: i + 1 }) as Aenderung)
}
```

- [ ] **Step 5: Tests laufen lassen**

Run: `cd ~/Downloads/craftflow && npm run test`
Expected: PASS — 14 Tests, `fail 0`

- [ ] **Step 6: Lint prüfen**

Run: `cd ~/Downloads/craftflow && npx eslint src/lib/learn.ts tests/learn-diff.test.mjs`
Expected: leere Ausgabe. Falls ESLint die `.mjs`-Testdateien beanstandet (z. B. wegen `no-undef` oder Next-spezifischer Regeln), `"tests/**"` in `eslint.config.mjs` in den `globalIgnores`-Array aufnehmen — mit Kommentar `// Node-Testdateien, laufen nicht im Next-Kontext`. Nichts anderes an der Lint-Konfiguration ändern.

- [ ] **Step 7: Commit**

```bash
cd ~/Downloads/craftflow
git add src/lib/learn.ts tests/learn-diff.test.mjs package.json eslint.config.mjs
git commit -m "feat(learn): Diff-Engine mit Rauschfilter fuer Bauweise-Vault"
```

---

### Task 2: Belegprüfung, Ausnahme- und Datenschutzfilter

**Files:**
- Modify: `src/lib/learn.ts` (anfügen)
- Create: `tests/learn-beleg.test.mjs`

**Interfaces:**
- Consumes: aus Task 1 `Aenderung`, `Bereich`, `BEREICHE`, `normalisiere`
- Produces: `Beleg`, `Kandidat`, `BestehendeRegel`, `GepruefterKandidat`, `AUSNAHME_WOERTER`, `MIN_ZITAT_ZEICHEN` (Wert `6`), `enthaeltWortfolge(nachrichtNorm: string, zitatNorm: string): boolean`, `istAusnahmeNachricht(text: string): boolean`, `beschreibeAenderung(a: Aenderung): string`, `istGleicheRegel(a: {bereich:string; wenn:string}, b: {bereich:string; wenn:string}): boolean`, `pruefeKandidaten(kandidaten: unknown, aenderungen: Aenderung[], nutzerChat: string[], kundenWoerter: string[], bestehendeRegeln: BestehendeRegel[]): GepruefterKandidat[]`

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`tests/learn-beleg.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pruefeKandidaten, istAusnahmeNachricht, istGleicheRegel, beschreibeAenderung, enthaeltWortfolge, MIN_ZITAT_ZEICHEN } from '../src/lib/learn.ts'

const AEND = [
  { nr: 1, art: 'material_ersetzt', position: 'Garderobe', vorher: 'HPL 6mm', nachher: 'Multiplex Birke 8mm' },
  { nr: 2, art: 'minuten_geaendert', position: 'Garderobe', kostenstelle: 'Zuschnitt', vorher: 45, nachher: 70 },
]
const CHAT = ['Rückwand bitte immer 8mm Multiplex, nie HPL']

test('Kandidat mit gültigem Diff-Beleg wird übernommen', () => {
  const k = [{ bereich: 'Material', wenn: 'Korpus mit Rückwand', dann: 'Rückwand 8mm Multiplex', belegt_durch: { art: 'diff', nr: 1 } }]
  const r = pruefeKandidaten(k, AEND, CHAT, [], [])
  assert.equal(r.length, 1)
  assert.equal(r[0].bereich, 'Material')
  assert.equal(r[0].wenn, 'Korpus mit Rückwand')
  assert.equal(r[0].aendertRegelId, null)
  assert.match(r[0].belegText, /HPL 6mm/)
})

test('Kandidat mit nicht existierender Diff-Nummer wird verworfen', () => {
  const k = [{ bereich: 'Material', wenn: '', dann: 'Irgendwas', belegt_durch: { art: 'diff', nr: 99 } }]
  assert.deepEqual(pruefeKandidaten(k, AEND, CHAT, [], []), [])
})

test('Kandidat mit Zitat aus dem Chat wird übernommen', () => {
  const k = [{ bereich: 'Konstruktion', wenn: '', dann: 'Nie HPL verwenden', belegt_durch: { art: 'zitat', text: 'nie HPL' } }]
  const r = pruefeKandidaten(k, AEND, CHAT, [], [])
  assert.equal(r.length, 1)
  assert.match(r[0].belegText, /Chat:/)
})

test('Kandidat mit erfundenem Zitat wird verworfen', () => {
  const k = [{ bereich: 'Konstruktion', wenn: '', dann: 'Alles aus Nussbaum', belegt_durch: { art: 'zitat', text: 'immer Nussbaum verwenden' } }]
  assert.deepEqual(pruefeKandidaten(k, AEND, CHAT, [], []), [])
})

test('Zu kurzes Zitat wird verworfen, auch wenn es im Chat vorkommt', () => {
  const chat = ['Die Rueckwand soll anders werden']
  const k = [{ bereich: 'Material', wenn: '', dann: 'Irgendwas', belegt_durch: { art: 'zitat', text: 'die' } }]
  assert.deepEqual(pruefeKandidaten(k, AEND, chat, [], []), [])
})

test('Zitat, das nur mitten in einem Wort trifft, wird verworfen', () => {
  const chat = ['Die Maschinen laufen gut']
  const k = [{ bereich: 'Zeit', wenn: '', dann: 'Irgendwas', belegt_durch: { art: 'zitat', text: 'maschin' } }]
  assert.deepEqual(pruefeKandidaten(k, AEND, chat, [], []), [])
})

test('enthaeltWortfolge trifft nur auf ganze Wortfolgen', () => {
  assert.equal(enthaeltWortfolge('rueckwand immer multiplex nie hpl', 'nie hpl'), true)
  assert.equal(enthaeltWortfolge('die maschinen laufen', 'maschin'), false)
  assert.equal(enthaeltWortfolge('nie hpl', 'nie hpl'), true)
  assert.equal(enthaeltWortfolge('irgendwas', ''), false)
})

test('MIN_ZITAT_ZEICHEN hat den festgelegten Wert', () => {
  assert.equal(MIN_ZITAT_ZEICHEN, 6)
})

test('Kandidat ohne Beleg wird verworfen', () => {
  assert.deepEqual(pruefeKandidaten([{ bereich: 'Material', wenn: '', dann: 'Ohne Beleg' }], AEND, CHAT, [], []), [])
})

test('Unbekannter Bereich wird verworfen', () => {
  const k = [{ bereich: 'Preisfindung', wenn: '', dann: 'Stundensatz 95 Euro', belegt_durch: { art: 'diff', nr: 1 } }]
  assert.deepEqual(pruefeKandidaten(k, AEND, CHAT, [], []), [])
})

test('Leeres dann wird verworfen', () => {
  const k = [{ bereich: 'Material', wenn: 'x', dann: '   ', belegt_durch: { art: 'diff', nr: 1 } }]
  assert.deepEqual(pruefeKandidaten(k, AEND, CHAT, [], []), [])
})

test('Kandidat mit Kundennamen wird verworfen (Datenschutz)', () => {
  const k = [{ bereich: 'Material', wenn: 'bei Müller', dann: 'immer Multiplex', belegt_durch: { art: 'diff', nr: 1 } }]
  assert.deepEqual(pruefeKandidaten(k, AEND, CHAT, ['Müller', 'Rodenbach'], []), [])
})

test('Kurze Kundenwörter filtern nicht versehentlich mit', () => {
  // "Ilm" wäre 3 Zeichen und dürfte filtern; "AG" mit 2 Zeichen darf NICHT
  // dazu führen, dass jede Regel mit "ag" darin (z.B. "Anschlag") stirbt.
  const k = [{ bereich: 'Konstruktion', wenn: '', dann: 'Anschlag immer links', belegt_durch: { art: 'diff', nr: 1 } }]
  assert.equal(pruefeKandidaten(k, AEND, CHAT, ['AG'], []).length, 1)
})

test('Kandidat, der eine bestehende Regel ändert, wird markiert', () => {
  const bestehend = [{ id: 'r1', bereich: 'Material', wenn: 'Korpus mit Rückwand' }]
  const k = [{ bereich: 'Material', wenn: 'korpus mit rueckwand', dann: 'Neu: 10mm', belegt_durch: { art: 'diff', nr: 1 } }]
  // Normalisierung erfasst Gross/Kleinschreibung — Umlaut-Varianten bewusst NICHT.
  const r = pruefeKandidaten(
    [{ bereich: 'Material', wenn: 'Korpus mit Rückwand', dann: 'Neu: 10mm', belegt_durch: { art: 'diff', nr: 1 } }],
    AEND, CHAT, [], bestehend,
  )
  assert.equal(r.length, 1)
  assert.equal(r[0].aendertRegelId, 'r1')
  assert.equal(pruefeKandidaten(k, AEND, CHAT, [], bestehend)[0].aendertRegelId, null)
})

test('Leeres wenn ("gilt immer") gilt NIE als dieselbe Regel', () => {
  // Entscheidung Fabian 2026-08-02: ein Bereich enthaelt viele unabhaengige
  // Immer-Regeln. Waeren zwei leere wenn gleich, gaebe es pro Bereich nur eine.
  assert.equal(istGleicheRegel({ bereich: 'Zeit', wenn: '' }, { bereich: 'Zeit', wenn: '  ' }), false)
  assert.equal(istGleicheRegel({ bereich: 'Zeit', wenn: '' }, { bereich: 'Material', wenn: '' }), false)
  assert.equal(istGleicheRegel({ bereich: 'Zeit', wenn: '' }, { bereich: 'Zeit', wenn: 'bei Eiche' }), false)
})

test('Ausnahme-Nachrichten werden erkannt', () => {
  assert.equal(istAusnahmeNachricht('Diesmal bitte HPL, der Kunde will das so'), true)
  assert.equal(istAusnahmeNachricht('Nur bei diesem Projekt anders'), true)
  assert.equal(istAusnahmeNachricht('Ausnahmsweise ohne Bekantung'), true)
  assert.equal(istAusnahmeNachricht('Rückwand immer 8mm Multiplex'), false)
})

test('beschreibeAenderung liefert lesbaren Text für jede Art', () => {
  assert.match(beschreibeAenderung(AEND[0]), /HPL 6mm.*Multiplex Birke 8mm/)
  assert.match(beschreibeAenderung(AEND[1]), /Zuschnitt 45 → 70 min/)
})

test('Nicht-Array als Kandidatenliste bricht nicht', () => {
  assert.deepEqual(pruefeKandidaten(null, AEND, CHAT, [], []), [])
  assert.deepEqual(pruefeKandidaten('kaputt', AEND, CHAT, [], []), [])
})
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag bestätigen**

Run: `cd ~/Downloads/craftflow && npm run test`
Expected: FAIL — `pruefeKandidaten is not a function` bzw. `SyntaxError: ... does not provide an export named 'pruefeKandidaten'`

- [ ] **Step 3: An `src/lib/learn.ts` anfügen**

```ts
// ── Belegprüfung ───────────────────────────────────────────────────────────
// Die KI darf Regeln nur FORMULIEREN, nicht ERFINDEN. Jeder Kandidat muss auf
// eine Änderung aus dem Code-Diff oder ein wörtliches Chat-Zitat zeigen. Alles
// ohne gültigen Beleg wird verworfen. Gleiche Haltung wie bei validateAndFix /
// applyUserRates: den KI-Angaben wird nicht vertraut.

export type Beleg = { art: 'diff'; nr: number } | { art: 'zitat'; text: string }
export type Kandidat = { bereich: string; wenn: string; dann: string; belegt_durch: Beleg }
export type BestehendeRegel = { id: string; bereich: string; wenn: string }
export type GepruefterKandidat = {
  bereich: Bereich
  wenn: string
  dann: string
  belegText: string
  aendertRegelId: string | null
}

// Ein Kundensonderwunsch darf keine Dauerregel werden. Doppelt abgesichert:
// hier im Code und zusätzlich im KI-Auftrag.
export const AUSNAHME_WOERTER = [
  'diesmal', 'nur hier', 'nur bei diesem', 'nur dieses mal', 'ausnahmsweise',
  'einmalig', 'für diesen kunden', 'fuer diesen kunden', 'nur in diesem fall',
]

export function istAusnahmeNachricht(text: string): boolean {
  const t = normalisiere(text)
  return AUSNAHME_WOERTER.some(w => t.includes(normalisiere(w)))
}

export function beschreibeAenderung(a: Aenderung): string {
  switch (a.art) {
    case 'material_ersetzt':      return `"${a.vorher}" → "${a.nachher}" (${a.position})`
    case 'material_entfernt':     return `Material entfernt: "${a.vorher}" (${a.position})`
    case 'material_neu':          return `Material ergänzt: "${a.nachher}" (${a.position})`
    case 'kostenstelle_entfernt': return `Kostenstelle entfernt: ${a.kostenstelle} (${a.position})`
    case 'kostenstelle_neu':      return `Kostenstelle ergänzt: ${a.kostenstelle} (${a.position})`
    case 'minuten_geaendert':     return `${a.kostenstelle} ${a.vorher} → ${a.nachher} min (${a.position})`
    case 'menge_geaendert':       return `Menge "${a.material}" ${a.vorher} → ${a.nachher} (${a.position})`
  }
}

// Ein Zitat muss ein echter Beleg sein. Zwei Huerden gemeinsam:
// Mindestlaenge UND vollstaendige Wortfolge. Ohne die Mindestlaenge wuerde ein
// Alltagswort wie "die" reichen, das in fast jeder Nachricht vorkommt; ohne die
// Wortgrenze wuerde "machen" auch mitten in "Maschinen" treffen. Beides waere
// ein Schlupfloch, durch das die KI sich einen Beleg erschleichen kann.
export const MIN_ZITAT_ZEICHEN = 6

export function enthaeltWortfolge(nachrichtNorm: string, zitatNorm: string): boolean {
  if (zitatNorm === '') return false
  return ` ${nachrichtNorm} `.includes(` ${zitatNorm} `)
}

// Bewusst exakter Vergleich nach Normalisierung, kein unscharfes Matching:
// ein Fehltreffer würde die falsche Regel überschreiben, und Ähnlichkeits-
// schwellen sind nicht sinnvoll testbar.
// Ausnahme: Ein leeres `wenn` („gilt immer") ist KEINE Identität — sonst gäbe
// es pro Bereich nur eine einzige Immer-Regel. Siehe Spec, Schritt 6.
export function istGleicheRegel(a: { bereich: string; wenn: string }, b: { bereich: string; wenn: string }): boolean {
  const wennA = normalisiere(a.wenn)
  const wennB = normalisiere(b.wenn)
  if (wennA === '' || wennB === '') return false
  return normalisiere(a.bereich) === normalisiere(b.bereich) && wennA === wennB
}

export function pruefeKandidaten(
  kandidaten: unknown,
  aenderungen: Aenderung[],
  nutzerChat: string[],
  kundenWoerter: string[],
  bestehendeRegeln: BestehendeRegel[],
): GepruefterKandidat[] {
  if (!Array.isArray(kandidaten)) return []
  const chatNorm = nutzerChat.map(normalisiere)
  // Mindestlänge 3, damit kurze Kürzel wie "AG" nicht halbe Regeltexte treffen.
  const kundenNorm = kundenWoerter.map(normalisiere).filter(w => w.length >= 3)
  const ergebnis: GepruefterKandidat[] = []

  for (const roh of kandidaten) {
    const k = roh as Partial<Kandidat> | null
    if (!k || typeof k.dann !== 'string' || k.dann.trim() === '') continue

    const bereich = BEREICHE.find(b => normalisiere(b) === normalisiere(String(k.bereich ?? '')))
    if (!bereich) continue

    let belegText: string | null = null
    const beleg = k.belegt_durch
    if (beleg && beleg.art === 'diff' && typeof beleg.nr === 'number') {
      const treffer = aenderungen.find(a => a.nr === beleg.nr)
      if (treffer) belegText = beschreibeAenderung(treffer)
    } else if (beleg && beleg.art === 'zitat' && typeof beleg.text === 'string' && beleg.text.trim() !== '') {
      const zitat = normalisiere(beleg.text)
      if (zitat.length >= MIN_ZITAT_ZEICHEN && chatNorm.some(m => enthaeltWortfolge(m, zitat))) {
        belegText = `Chat: „${beleg.text.trim()}"`
      }
    }
    if (!belegText) continue

    const wenn = String(k.wenn ?? '').trim()
    const inhalt = normalisiere(`${wenn} ${k.dann}`)
    if (kundenNorm.some(w => inhalt.includes(w))) continue

    const bestehend = bestehendeRegeln.find(r => istGleicheRegel(r, { bereich, wenn }))
    ergebnis.push({ bereich, wenn, dann: k.dann.trim(), belegText, aendertRegelId: bestehend?.id ?? null })
  }
  return ergebnis
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `cd ~/Downloads/craftflow && npm run test`
Expected: PASS — alle Tests aus Task 1 und 2, `fail 0`

- [ ] **Step 5: Commit**

```bash
cd ~/Downloads/craftflow
git add src/lib/learn.ts tests/learn-beleg.test.mjs
git commit -m "feat(learn): Belegpflicht, Ausnahme- und Datenschutzfilter"
```

---

### Task 3: Prompt-Block bauen

**Files:**
- Modify: `src/lib/learn.ts` (anfügen)
- Create: `tests/learn-prompt.test.mjs`

**Interfaces:**
- Consumes: aus Task 1 nichts direkt außer dem Modul selbst
- Produces: `MAX_REGELN_IM_PROMPT` (Wert `60`), `WARNUNG_AB_REGELN` (Wert `40`), `baueRegelBlock(regeln: Array<{bereich: string; wenn: string; dann: string}>): string`

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`tests/learn-prompt.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { baueRegelBlock, MAX_REGELN_IM_PROMPT, WARNUNG_AB_REGELN } from '../src/lib/learn.ts'

test('Leere Regelliste ergibt leeren String', () => {
  assert.equal(baueRegelBlock([]), '')
})

test('Regel mit Bedingung wird als "Wenn ... →" gerendert', () => {
  const s = baueRegelBlock([{ bereich: 'Material', wenn: 'Korpus mit Rückwand', dann: 'Rückwand 8mm Multiplex' }])
  assert.match(s, /\[Material\] Wenn Korpus mit Rückwand → Rückwand 8mm Multiplex/)
})

test('Regel ohne Bedingung wird als "Immer →" gerendert', () => {
  const s = baueRegelBlock([{ bereich: 'Zeit', wenn: '  ', dann: 'Zuschnitt 50 % länger' }])
  assert.match(s, /\[Zeit\] Immer → Zuschnitt 50 % länger/)
})

test('Block enthält Überschrift und Vorrang-Satz', () => {
  const s = baueRegelBlock([{ bereich: 'Material', wenn: '', dann: 'X' }])
  assert.match(s, /## MEINE BAUWEISE — VERBINDLICHE REGELN DIESES BETRIEBS/)
  assert.match(s, /Vorrang/)
})

test('Mehr als MAX_REGELN_IM_PROMPT Regeln werden abgeschnitten', () => {
  const viele = Array.from({ length: MAX_REGELN_IM_PROMPT + 5 }, (_, i) => ({ bereich: 'Material', wenn: '', dann: `Regel ${i}` }))
  const zeilen = baueRegelBlock(viele).split('\n').filter(z => z.startsWith('[Material]'))
  assert.equal(zeilen.length, MAX_REGELN_IM_PROMPT)
})

test('Schwellen haben die in der Spec festgelegten Werte', () => {
  assert.equal(MAX_REGELN_IM_PROMPT, 60)
  assert.equal(WARNUNG_AB_REGELN, 40)
})
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag bestätigen**

Run: `cd ~/Downloads/craftflow && npm run test`
Expected: FAIL — kein Export `baueRegelBlock`

- [ ] **Step 3: An `src/lib/learn.ts` anfügen**

```ts
// ── Prompt-Block ───────────────────────────────────────────────────────────
export const MAX_REGELN_IM_PROMPT = 60
export const WARNUNG_AB_REGELN = 40

// Der Block wird ans ENDE des System-Prompts gehängt und trägt einen
// ausdrücklichen Vorrang-Satz. Beides ist funktional nötig: steht er vor dem
// allgemeinen Fachwissen, gewinnt weiter die generische Vorgabe (z. B. 6 mm
// HPL-Rückwand) und die gelernte Regel bleibt wirkungslos.
export function baueRegelBlock(regeln: Array<{ bereich: string; wenn: string; dann: string }>): string {
  if (regeln.length === 0) return ''
  const zeilen = regeln.slice(0, MAX_REGELN_IM_PROMPT).map(r => {
    const bedingung = (r.wenn ?? '').trim() === '' ? 'Immer' : `Wenn ${r.wenn.trim()}`
    return `[${r.bereich}] ${bedingung} → ${(r.dann ?? '').trim()}`
  })
  return '\n\n## MEINE BAUWEISE — VERBINDLICHE REGELN DIESES BETRIEBS\n'
    + zeilen.join('\n')
    + '\nDiese Regeln haben Vorrang vor allen allgemeinen Vorgaben oben. Widerspricht eine allgemeine Vorgabe einer dieser Regeln, gilt die Regel.'
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `cd ~/Downloads/craftflow && npm run test`
Expected: PASS, `fail 0`

- [ ] **Step 5: Commit**

```bash
cd ~/Downloads/craftflow
git add src/lib/learn.ts tests/learn-prompt.test.mjs
git commit -m "feat(learn): Regel-Block fuer System-Prompt"
```

---

### Task 4: Datenbank-Tabelle und Vault-CRUD-Route

**Files:**
- Create: `docs/sql/2026-07-31-bauweise-regeln.sql`
- Create: `src/app/api/settings/bauweise/route.ts`
- Create: `src/lib/bauweise.ts`

**Interfaces:**
- Consumes: aus `src/lib/learn.ts`: `BEREICHE`, `Bereich`, `baueRegelBlock`, `MAX_REGELN_IM_PROMPT`
- Produces:
  - Tabelle `bauweise_regeln`, SQL-Funktion `bauweise_regeln_gesendet(regel_ids uuid[])`
  - Route `/api/settings/bauweise`: `GET` → `{ regeln: VaultRegel[] }`, `POST` `{bereich, wenn, dann, herkunft?, quelle_text?, beleg?}` → `{ regel: VaultRegel }`, `PUT` `{id, wenn?, dann?, aktiv?}` → `{ ok: true }`, `DELETE` `{id}` → `{ ok: true }`
  - `src/lib/bauweise.ts`: `type AktiveRegel = { id: string; bereich: string; wenn: string; dann: string }`, `regelBlockFuerNutzer(supabase, userId): Promise<{ block: string; ids: string[] }>`, `zaehleRegelnHoch(supabase, ids): void`

- [ ] **Step 1: SQL-Datei anlegen**

`docs/sql/2026-07-31-bauweise-regeln.sql`:

```sql
-- Bauweise-Vault: nutzerindividuell gelernte Kalkulationsregeln.
-- Im Supabase-Dashboard (SQL Editor) einmal ausführen.
-- Gehört zu docs/superpowers/specs/2026-07-31-lernfunktion-bauweise-vault-design.md

create table if not exists bauweise_regeln (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  bereich          text not null,
  wenn             text not null default '',
  dann             text not null,
  herkunft         text not null default 'gelernt',
  quelle_text      text not null default '',
  beleg            text not null default '',
  aktiv            boolean not null default true,
  gesendet_zahl    integer not null default 0,
  zuletzt_gesendet timestamptz,
  konflikt_hinweis boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists bauweise_regeln_user_idx on bauweise_regeln (user_id, aktiv);

alter table bauweise_regeln enable row level security;

drop policy if exists "eigene Regeln lesen"   on bauweise_regeln;
drop policy if exists "eigene Regeln anlegen" on bauweise_regeln;
drop policy if exists "eigene Regeln aendern" on bauweise_regeln;
drop policy if exists "eigene Regeln loeschen" on bauweise_regeln;

create policy "eigene Regeln lesen"    on bauweise_regeln for select using (auth.uid() = user_id);
create policy "eigene Regeln anlegen"  on bauweise_regeln for insert with check (auth.uid() = user_id);
create policy "eigene Regeln aendern"  on bauweise_regeln for update using (auth.uid() = user_id);
create policy "eigene Regeln loeschen" on bauweise_regeln for delete using (auth.uid() = user_id);

-- Zähler in EINER Abfrage hochsetzen. security invoker → RLS greift, ein Nutzer
-- kann damit nur seine eigenen Regeln hochzählen.
create or replace function bauweise_regeln_gesendet(regel_ids uuid[])
returns void
language sql
security invoker
as $$
  update bauweise_regeln
     set gesendet_zahl    = gesendet_zahl + 1,
         zuletzt_gesendet = now()
   where id = any(regel_ids);
$$;
```

- [ ] **Step 2: SQL im Supabase-Dashboard ausführen — GATE**

Diesen Schritt führt **Fabian** aus (SQL Editor im Supabase-Dashboard, Inhalt der Datei aus Step 1 einfügen und ausführen). Ohne die Tabelle liefern alle folgenden Routen leere Ergebnisse.

Prüfung nach dem Ausführen: Im Table Editor muss `bauweise_regeln` mit aktivem RLS-Schild erscheinen.

**Nicht weitermachen, bevor Fabian bestätigt hat, dass das SQL durchgelaufen ist.**

- [ ] **Step 3: `src/lib/bauweise.ts` anlegen**

```ts
import { after } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { baueRegelBlock, MAX_REGELN_IM_PROMPT } from './learn'

// Serverseitige DB-Helfer für den Bauweise-Vault. Bewusst getrennt von
// src/lib/learn.ts, damit die reine Logik dort ohne Supabase testbar bleibt.

export type AktiveRegel = { id: string; bereich: string; wenn: string; dann: string }

// Sortierung: zuletzt mitgeschickte zuerst, dann die neuesten. Bei mehr als
// MAX_REGELN_IM_PROMPT Regeln fallen die ältesten/ungenutzten heraus — das
// Vault-UI zeigt dem Nutzer, welche das sind (kein stilles Abschneiden).
export async function ladeAktiveRegeln(supabase: SupabaseClient, userId: string): Promise<AktiveRegel[]> {
  const { data, error } = await supabase
    .from('bauweise_regeln')
    .select('id, bereich, wenn, dann')
    .eq('user_id', userId)
    .eq('aktiv', true)
    .order('zuletzt_gesendet', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(MAX_REGELN_IM_PROMPT)
  if (error) { console.error('[learn] ladeAktiveRegeln:', error.message); return [] }
  return (data ?? []) as AktiveRegel[]
}

export async function regelBlockFuerNutzer(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ block: string; ids: string[] }> {
  const regeln = await ladeAktiveRegeln(supabase, userId)
  return { block: baueRegelBlock(regeln), ids: regeln.map(r => r.id) }
}

// Läuft nach dem Senden der Antwort, verzögert sie also nicht — wird von der
// Plattform aber garantiert noch ausgeführt. Reines `void promise` wäre hier
// falsch: Vercel friert die Function nach der Antwort ein und nicht abgewartete
// Arbeit darf verloren gehen. Dann fehlen `gesendet_zahl`/`zuletzt_gesendet` —
// und weil die 60er-Priorisierung auf `zuletzt_gesendet` beruht, wäre auch die
// Auswahl der mitgeschickten Regeln still falsch.
export function zaehleRegelnHoch(supabase: SupabaseClient, ids: string[]): void {
  if (ids.length === 0) return
  after(async () => {
    const { error } = await supabase.rpc('bauweise_regeln_gesendet', { regel_ids: ids })
    if (error) console.error('[learn] zaehleRegelnHoch:', error.message)
  })
}
```

- [ ] **Step 4: Vault-CRUD-Route anlegen**

`src/app/api/settings/bauweise/route.ts` — Muster exakt wie `src/app/api/settings/kostenstellen/route.ts`: Nutzer aus der Session, `.eq('user_id', user.id)` an **jeder** Abfrage.

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { BEREICHE, normalisiere, type Bereich } from '@/lib/learn'

const SPALTEN = 'id, bereich, wenn, dann, herkunft, quelle_text, beleg, aktiv, gesendet_zahl, zuletzt_gesendet, konflikt_hinweis, created_at'

function pruefeBereich(wert: unknown): Bereich | null {
  return BEREICHE.find(b => normalisiere(b) === normalisiere(String(wert ?? ''))) ?? null
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const { data, error } = await supabase
    .from('bauweise_regeln')
    .select(SPALTEN)
    .eq('user_id', user.id)
    .order('bereich')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ regeln: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const body = await req.json() as {
    bereich?: string; wenn?: string; dann?: string
    herkunft?: string; quelle_text?: string; beleg?: string
    ersetztRegelId?: string
  }

  const bereich = pruefeBereich(body.bereich)
  if (!bereich) return NextResponse.json({ error: 'Unbekannter Bereich' }, { status: 400 })
  const dann = (body.dann ?? '').trim()
  if (!dann) return NextResponse.json({ error: 'dann erforderlich' }, { status: 400 })
  const wenn = (body.wenn ?? '').trim()
  const herkunft = body.herkunft === 'manuell' ? 'manuell' : 'gelernt'

  // Ersetzt der Kandidat eine bestehende Regel, wird diese aktualisiert statt
  // eine zweite widersprüchliche Regel anzulegen.
  if (body.ersetztRegelId) {
    const { data, error } = await supabase
      .from('bauweise_regeln')
      .update({
        bereich, wenn, dann, beleg: body.beleg ?? '', quelle_text: body.quelle_text ?? '',
        konflikt_hinweis: false, aktiv: true, updated_at: new Date().toISOString(),
      })
      .eq('id', body.ersetztRegelId)
      .eq('user_id', user.id)
      .select(SPALTEN)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (data) return NextResponse.json({ regel: data })
    // Kein Treffer: die Regel wurde zwischen Kandidaten-Erzeugung und Bestätigung
    // gelöscht (oder die id gehört nicht diesem Nutzer). Die bestätigte Regel darf
    // deswegen nicht verloren gehen — unten normal neu anlegen. `.single()` wäre
    // hier ein 500er gewesen und hätte die Regel verworfen.
  }

  const { data, error } = await supabase
    .from('bauweise_regeln')
    .insert({
      user_id: user.id, bereich, wenn, dann, herkunft,
      quelle_text: body.quelle_text ?? '', beleg: body.beleg ?? '',
    })
    .select(SPALTEN)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ regel: data })
}

export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const body = await req.json() as { id?: string; wenn?: string; dann?: string; aktiv?: boolean }
  if (!body.id) return NextResponse.json({ error: 'id erforderlich' }, { status: 400 })

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.wenn != null) patch.wenn = body.wenn.trim()
  if (body.dann != null) {
    const dann = body.dann.trim()
    if (!dann) return NextResponse.json({ error: 'dann darf nicht leer sein' }, { status: 400 })
    patch.dann = dann
  }
  if (body.aktiv != null) patch.aktiv = body.aktiv
  // Jede bewusste Änderung räumt den Konflikt-Hinweis ab.
  patch.konflikt_hinweis = false

  const { error } = await supabase
    .from('bauweise_regeln')
    .update(patch)
    .eq('id', body.id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const body = await req.json() as { id?: string }
  if (!body.id) return NextResponse.json({ error: 'id erforderlich' }, { status: 400 })

  const { error } = await supabase
    .from('bauweise_regeln')
    .delete()
    .eq('id', body.id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5: Build und Lint prüfen**

Run: `cd ~/Downloads/craftflow && npx tsc --noEmit && npx eslint <deine geaenderten Dateien>`
Expected: `tsc` Exit 0 ohne Ausgabe, eslint-Ausgabe leer. `tsc --noEmit` ist hier der Typecheck — die Route wird lokal nicht ausgeführt.

- [ ] **Step 6: Commit**

```bash
cd ~/Downloads/craftflow
git add docs/sql/2026-07-31-bauweise-regeln.sql src/lib/bauweise.ts src/app/api/settings/bauweise/route.ts
git commit -m "feat(bauweise): Tabelle, RLS und Vault-CRUD-Route"
```

---

### Task 5: Regeln in die System-Prompts einhängen

**Files:**
- Modify: `src/app/api/analyze/route.ts` (nach dem `firmenStandort`-Block, ca. Zeile 883–888)
- Modify: `src/app/api/optimize/route.ts` (nach dem `firmenStandort`-Block, ca. Zeile 191–194)

**Interfaces:**
- Consumes: `regelBlockFuerNutzer`, `zaehleRegelnHoch` aus `@/lib/bauweise`
- Produces: nichts Neues — beide Routen verhalten sich nach außen unverändert, der System-Prompt trägt zusätzlich den Regel-Block.

- [ ] **Step 1: `analyze` — Regeln laden**

In `src/app/api/analyze/route.ts` den Import ergänzen:

```ts
import { regelBlockFuerNutzer, zaehleRegelnHoch } from '@/lib/bauweise'
```

Der bestehende `firmenStandort`-Block (ca. Zeile 840–857) holt sich schon `supabase` und `user`. Diese Variablen sind aber im `try`-Scope gefangen. Deshalb den Block so erweitern, dass Regelblock und IDs mit herausgereicht werden — direkt vor `let systemPrompt = SYSTEM_PROMPT` (Zeile 859):

```ts
    // Gelernte Bauweise-Regeln dieses Nutzers (Bauweise-Vault). Serverseitig
    // geladen, nicht vom Frontend geschickt — was das Frontend nicht sendet,
    // kann nicht manipuliert werden.
    let regelBlock = ''
    let regelIds: string[] = []
    let supabaseFuerZaehler: Awaited<ReturnType<typeof createClient>> | null = null
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const r = await regelBlockFuerNutzer(supabase, user.id)
        regelBlock = r.block
        regelIds = r.ids
        supabaseFuerZaehler = supabase
      }
    } catch (e) { console.error('[learn] Regeln laden (analyze):', e) }
```

- [ ] **Step 2: `analyze` — Block anhängen**

**Nach** dem `if (firmenStandort) { ... }`-Block (endet ca. Zeile 888), also als **letzte** Ergänzung am `systemPrompt`:

```ts
    // MUSS ganz am Ende stehen: der Block trägt einen Vorrang-Satz und muss
    // nach dem allgemeinen Fachwissen kommen, sonst gewinnt weiter die
    // generische Vorgabe (z. B. 6 mm HPL-Rückwand).
    systemPrompt += regelBlock
```

- [ ] **Step 3: `analyze` — Zähler hochsetzen**

Direkt nach dem erfolgreichen Claude-Aufruf, unmittelbar nach der Zeile `if (!response.ok)`-Prüfung (also sobald klar ist, dass der Call durchgelaufen ist):

```ts
    if (supabaseFuerZaehler && regelIds.length > 0) zaehleRegelnHoch(supabaseFuerZaehler, regelIds)
```

- [ ] **Step 4: `optimize` — dieselbe Ergänzung**

In `src/app/api/optimize/route.ts` den Import ergänzen:

```ts
import { regelBlockFuerNutzer, zaehleRegelnHoch } from '@/lib/bauweise'
```

Direkt nach dem bestehenden `firmenStandort`-try-Block (endet Zeile 170) einfügen:

```ts
    // Gelernte Bauweise-Regeln dieses Nutzers (Bauweise-Vault).
    let regelBlock = ''
    let regelIds: string[] = []
    let supabaseFuerZaehler: Awaited<ReturnType<typeof createClient>> | null = null
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const r = await regelBlockFuerNutzer(supabase, user.id)
        regelBlock = r.block
        regelIds = r.ids
        supabaseFuerZaehler = supabase
      }
    } catch (e) { console.error('[learn] Regeln laden (optimize):', e) }
```

**Nach** dem `if (firmenStandort) { ... }`-Block (endet Zeile 194), als letzte Ergänzung an `system`:

```ts
    system += regelBlock
```

Und nach der `if (!res.ok)`-Prüfung (Zeile 217–220), sobald der Call durchgelaufen ist:

```ts
    if (supabaseFuerZaehler && regelIds.length > 0) zaehleRegelnHoch(supabaseFuerZaehler, regelIds)
```

- [ ] **Step 5: Build und Lint prüfen**

Run: `cd ~/Downloads/craftflow && npm run test && npx tsc --noEmit && npx eslint <deine geaenderten Dateien>`
Expected: Tests `fail 0`, `tsc` Exit 0, eslint-Ausgabe leer.

- [ ] **Step 6: Prüfen, dass der Block wirklich am Ende landet**

Run: `cd ~/Downloads/craftflow && grep -n "systemPrompt +=" src/app/api/analyze/route.ts && grep -n "system +=" src/app/api/optimize/route.ts`
Expected: In beiden Dateien ist die Zeile mit `regelBlock` die **letzte** Zuweisung an den Prompt, nach `firmenStandort`.

- [ ] **Step 7: Commit**

```bash
cd ~/Downloads/craftflow
git add src/app/api/analyze/route.ts src/app/api/optimize/route.ts
git commit -m "feat(analyze,optimize): Bauweise-Regeln in den System-Prompt einhaengen"
```

---

### Task 6: Kandidaten-Route

**Files:**
- Create: `src/app/api/learn/candidates/route.ts`

**Interfaces:**
- Consumes: `diffOffer`, `pruefeKandidaten`, `istAusnahmeNachricht`, `beschreibeAenderung`, `BEREICHE`, Typen `LernOffer`, `BestehendeRegel`, `GepruefterKandidat` aus `@/lib/learn`
- Produces: `POST /api/learn/candidates` mit Body `{ kiVorschlag: LernOffer, endstand: LernOffer, chatVerlauf: string[], kundenWoerter: string[], projektTitel: string }` → `{ kandidaten: Array<{ bereich, wenn, dann, belegText, aendertRegelId, quelle_text }> }`. Bei jedem Problem: `{ kandidaten: [] }` mit Status 200 — die Route wirft nie einen Fehler ins Frontend, weil sie den Speichervorgang nicht gefährden darf.

- [ ] **Step 1: Route anlegen**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import {
  diffOffer, pruefeKandidaten, istAusnahmeNachricht, beschreibeAenderung, BEREICHE,
  type LernOffer, type BestehendeRegel,
} from '@/lib/learn'

export const maxDuration = 60

const LEER = { kandidaten: [] as unknown[] }

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

    const body = await req.json() as {
      kiVorschlag?: LernOffer
      endstand?: LernOffer
      chatVerlauf?: string[]
      kundenWoerter?: string[]
      projektTitel?: string
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json(LEER)

    // ── 1. Harte Fakten aus dem Code-Diff ──
    const aenderungen = diffOffer(body.kiVorschlag ?? {}, body.endstand ?? {})

    // ── 2. Chat filtern: Einmal-Ausnahmen sind keine Signalquelle ──
    const chat = (Array.isArray(body.chatVerlauf) ? body.chatVerlauf : [])
      .filter(m => typeof m === 'string' && m.trim() !== '')
      .filter(m => !istAusnahmeNachricht(m))

    if (aenderungen.length === 0 && chat.length === 0) return NextResponse.json(LEER)

    // ── 3. Bestehende Regeln für den Abgleich ──
    const { data: bestehendRoh, error: bestehendErr } = await supabase
      .from('bauweise_regeln')
      .select('id, bereich, wenn')
      .eq('user_id', user.id)
      .eq('aktiv', true)
    // Fehler hier ist nicht fatal (der Abgleich fällt dann aus), darf aber nicht
    // spurlos verschwinden: sonst degradiert die Konflikt-Erkennung dauerhaft und
    // still, z.B. bei einer kaputten RLS-Policy.
    if (bestehendErr) console.error('[learn] bestehende Regeln:', bestehendErr.message)
    const bestehend = (bestehendRoh ?? []) as BestehendeRegel[]

    // ── 4. KI formuliert — darf nur beschreiben, was schon belegt ist ──
    const aenderungsListe = aenderungen.length > 0
      ? aenderungen.map(a => `${a.nr}. ${beschreibeAenderung(a)}`).join('\n')
      : '(keine strukturellen Änderungen erkannt)'
    const chatListe = chat.length > 0
      ? chat.map(m => `- ${m}`).join('\n')
      : '(keine Chat-Nachrichten)'

    const system = `Du wertest aus, welche dauerhaften Bauweise-Gewohnheiten eines Schreiners hinter seinen Korrekturen an einem KI-Kalkulationsvorschlag stecken.

AUSGABEFORMAT: Deine gesamte Antwort ist GENAU EIN JSON-Array. Kein Text davor, kein Text danach, keine Backticks. Keine Kandidaten → [].

Jedes Element:
{"bereich":"...","wenn":"...","dann":"...","belegt_durch":{"art":"diff","nr":ZAHL}}
oder
{"bereich":"...","wenn":"...","dann":"...","belegt_durch":{"art":"zitat","text":"WÖRTLICHES ZITAT"}}

REGELN:
- "bereich" ist genau einer von: ${BEREICHE.join(', ')}
- "wenn" ist die Bedingung (z.B. "Korpus mit Rückwand"). Gilt die Regel immer, ist "wenn" ein leerer String.
- "dann" ist die Gewohnheit in einem knappen Satz, aus Sicht des Betriebs formuliert.
- BELEGPFLICHT: Jeder Kandidat MUSS auf eine Nummer aus der Änderungsliste zeigen ODER ein WÖRTLICHES, unverändertes Zitat aus einer Nutzer-Nachricht enthalten. Erfinde nichts. Kandidaten ohne gültigen Beleg werden verworfen.
- Änderungen, die erkennbar einmalig oder kundenspezifisch sind, ergeben KEINE Regel.
- Keine Namen, Adressen oder Orte von Kunden in "wenn" oder "dann".
- Keine Regeln über Stundensätze, Materialaufschläge oder Preise — die stellt der Nutzer separat ein.
- Fasse zusammen: lieber 1–3 tragfähige Regeln als 8 Kleinigkeiten.`

    const userContent = `ÄNDERUNGEN (belegt, nummeriert):
${aenderungsListe}

NACHRICHTEN DES NUTZERS:
${chatListe}`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        temperature: 0,
        system,
        messages: [{ role: 'user', content: userContent }],
      }),
    })
    if (!res.ok) {
      console.error('[learn] Claude', res.status, (await res.text()).slice(0, 300))
      return NextResponse.json(LEER)
    }

    const data = await res.json() as { content?: Array<{ text?: string }> }
    const raw = (data.content?.[0]?.text ?? '').replace(/```json\n?|```/g, '').trim()

    let rohKandidaten: unknown = null
    try {
      rohKandidaten = JSON.parse(raw)
    } catch {
      // Fallback: das erste eckige-Klammer-Paar herausschneiden
      const von = raw.indexOf('[')
      const bis = raw.lastIndexOf(']')
      if (von !== -1 && bis > von) {
        try { rohKandidaten = JSON.parse(raw.slice(von, bis + 1)) } catch { /* aufgeben */ }
      }
    }
    if (rohKandidaten === null) {
      console.error('[learn] Antwort nicht parsebar:', raw.slice(0, 300))
      return NextResponse.json(LEER)
    }

    // ── 5. Belegprüfung, Datenschutzfilter, Vault-Abgleich ──
    const kundenWoerter = Array.isArray(body.kundenWoerter)
      ? body.kundenWoerter.filter((w): w is string => typeof w === 'string')
      : []
    const geprueft = pruefeKandidaten(rohKandidaten, aenderungen, chat, kundenWoerter, bestehend)

    const titel = (body.projektTitel ?? '').trim()
    const datum = new Date().toLocaleDateString('de-DE')
    const quelle = titel ? `gelernt am ${datum} aus Angebot „${titel}"` : `gelernt am ${datum}`

    return NextResponse.json({
      kandidaten: geprueft.map(k => ({ ...k, quelle_text: quelle })),
    })
  } catch (e: unknown) {
    // Lernen darf NIE den Speichervorgang stören → immer 200 mit leerer Liste.
    console.error('[learn]', e instanceof Error ? e.message : e)
    return NextResponse.json(LEER)
  }
}
```

- [ ] **Step 2: Build, Lint und Tests prüfen**

Run: `cd ~/Downloads/craftflow && npm run test && npx tsc --noEmit && npx eslint <deine geaenderten Dateien>`
Expected: Tests `fail 0`, `tsc` Exit 0, eslint-Ausgabe leer.

- [ ] **Step 3: Commit**

```bash
cd ~/Downloads/craftflow
git add src/app/api/learn/candidates/route.ts
git commit -m "feat(learn): Kandidaten-Route mit Belegpflicht"
```

---

### Task 7: Frontend — Erstvorschlag merken und Lern-Dialog

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `POST /api/learn/candidates`, `POST /api/settings/bauweise`
- Produces: nichts für andere Tasks.

**Kontext:** `page.tsx` bleibt eine Datei (Projekt-CLAUDE.md). Der Dialog wird also innerhalb von `page.tsx` gebaut, mit inline `style={{}}` und Farben aus `C`.

- [ ] **Step 1: State und Ref anlegen**

Bei den übrigen `useState`/`useRef`-Deklarationen der Hauptkomponente (in der Nähe von `const [offerId, setOfferId] = useState...`, Zeile 494) einfügen:

```tsx
  // Bauweise-Vault: der unveränderte KI-Erstvorschlag als Vergleichsbasis.
  // Absichtlich nur im Speicher (Ref) — kein DB-Eintrag nötig, und ein
  // Seitenwechsel soll das Lernen einfach verfallen lassen.
  const kiVorschlagRef = useRef<{ positionen: Angebotsposition[] } | null>(null)
  const [lernKandidaten, setLernKandidaten] = useState<Array<{
    bereich: string; wenn: string; dann: string; belegText: string
    aendertRegelId: string | null; quelle_text: string
  }>>([])
  const [lernAuswahl, setLernAuswahl] = useState<Record<number, boolean>>({})
  const [lernWenn, setLernWenn] = useState<Record<number, string>>({})
  const [lernSpeichert, setLernSpeichert] = useState(false)
  const [lernFehler, setLernFehler] = useState('')
  // Welche Kandidaten schon erfolgreich gespeichert sind. Ohne das würde ein
  // zweiter Versuch nach einem Teilfehler die bereits gespeicherten Regeln
  // erneut anlegen — die POST-Route hat für neue Regeln keine Dublettenprüfung.
  const [lernErledigt, setLernErledigt] = useState<Record<number, boolean>>({})
```

- [ ] **Step 2: Erstvorschlag beim Analyse-Ergebnis merken**

In der Verarbeitung der `/api/analyze`-Antwort, direkt nach `setPos(parsedPos)` (Zeile 964):

```tsx
        // Vergleichsbasis für den Bauweise-Vault festhalten (tiefe Kopie, damit
        // späteres Bearbeiten der Positionen den Erstvorschlag nicht verändert).
        kiVorschlagRef.current = { positionen: JSON.parse(JSON.stringify(parsedPos)) }
```

- [ ] **Step 3: Lern-Prüfung als Funktion**

**Platzierung — wichtig:** NICHT direkt neben `saveProject` (ca. Zeile 400). Die beiden
`useCallback`-Blöcke lesen `pos`, `kunde`, `optimMessages` und `checkMessages` in ihren
Dependency-Arrays; diese States werden erst weiter unten im Komponentenkörper deklariert.
Dort platziert, bricht `tsc` mit TS2448/TS2454 (Zugriff vor der Deklaration). Die Blöcke
gehören hinter die Deklaration aller vier States (in der aktuellen Datei hinter
`checkChatRef`). Die Auslösepunkte bleiben unverändert.

```tsx
  // Bauweise-Vault: prüft nach dem Speichern/PDF, was der Nutzer geändert hat.
  // Läuft absichtlich NACH dem eigentlichen Vorgang und feuere-und-vergiss —
  // ein Fehler hier darf Speichern und PDF nie beeinflussen.
  const pruefeLernkandidaten = useCallback(async () => {
    const basis = kiVorschlagRef.current
    if (!basis) return               // z.B. PDF-/GAEB-Import oder geladenes Projekt
    if (lernKandidaten.length > 0) return  // Dialog steht schon offen
    try {
      const chatVerlauf = [
        ...optimMessages.filter(m => m.role === 'user').map(m => m.content),
        ...checkMessages.filter(m => m.role === 'user').map(m => m.content),
      ]
      const kundenWoerter = [kunde.name, kunde.ort, kunde.strasse, kunde.zusatz]
        .filter(Boolean)
        .flatMap(v => String(v).split(/\s+/))
      const res = await fetch('/api/learn/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kiVorschlag: basis,
          endstand: { positionen: pos },
          chatVerlauf,
          kundenWoerter,
          projektTitel: [kunde.name.trim(), kunde.projekt.trim()].filter(Boolean).join(' – '),
        }),
      })
      if (!res.ok) return
      const json = await res.json() as { kandidaten?: typeof lernKandidaten }
      const k = json.kandidaten ?? []
      if (k.length === 0) return
      setLernKandidaten(k)
      // Neue Regeln vorangehakt; Kandidaten, die eine bestehende Regel ändern,
      // bewusst NICHT — dem soll der Nutzer aktiv zustimmen.
      setLernAuswahl(Object.fromEntries(k.map((x, i) => [i, x.aendertRegelId === null])))
      setLernWenn(Object.fromEntries(k.map((x, i) => [i, x.wenn])))
      // Zweite Absicherung gegen stehengebliebene „schon gespeichert"-Marken:
      // ein frischer Kandidatensatz startet immer ohne Erledigt-Flags.
      setLernErledigt({})
    } catch (e) { console.error('[learn] pruefeLernkandidaten', e) }
  }, [lernKandidaten.length, optimMessages, checkMessages, kunde, pos])

  // Ein einziger Weg, den Dialog zu schließen — inklusive lernErledigt. Bliebe
  // ein „schon gespeichert" auf Index n stehen, würde ein späterer, völlig
  // anderer Kandidat auf demselben Index als erledigt gelten und beim Speichern
  // stillschweigend übersprungen. Still nicht gespeichert ist schlimmer als
  // doppelt gespeichert.
  const lernDialogSchliessen = useCallback(() => {
    setLernKandidaten([])
    setLernAuswahl({})
    setLernWenn({})
    setLernFehler('')
    setLernErledigt({})
  }, [])

  // Anzahl der noch offenen (angehakten, nicht gespeicherten) Kandidaten —
  // steuert Beschriftung und Aktivierung des Bestätigungsknopfes.
  const lernOffeneAnzahl = lernKandidaten.reduce(
    (n, _k, i) => n + (lernAuswahl[i] && !lernErledigt[i] ? 1 : 0), 0)

  const lernRegelnSpeichern = useCallback(async () => {
    setLernSpeichert(true)
    setLernFehler('')
    const erledigt: Record<number, boolean> = { ...lernErledigt }
    let fehler = 0
    for (let i = 0; i < lernKandidaten.length; i++) {
      // Schon gespeicherte übersprigen: die POST-Route legt neue Regeln ohne
      // Dublettenprüfung an, ein zweiter Versuch würde sie sonst verdoppeln.
      if (!lernAuswahl[i] || erledigt[i]) continue
      const k = lernKandidaten[i]
      try {
        const res = await fetch('/api/settings/bauweise', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bereich: k.bereich,
            wenn: lernWenn[i] ?? k.wenn,
            dann: k.dann,
            herkunft: 'gelernt',
            quelle_text: k.quelle_text,
            beleg: k.belegText,
            ersetztRegelId: k.aendertRegelId ?? undefined,
          }),
        })
        if (res.ok) erledigt[i] = true
        else fehler++
      } catch (e) {
        // Einzelne Regel gescheitert — die übrigen trotzdem versuchen, statt die
        // ganze Schleife abzubrechen.
        console.error('[learn] Regel speichern', e)
        fehler++
      }
    }
    setLernErledigt(erledigt)
    setLernSpeichert(false)
    if (fehler > 0) {
      // Dialog offen lassen. Still schließen wäre die schlechteste Variante: der
      // Nutzer hat bestätigt, gespeichert wurde nichts, und er wundert sich beim
      // nächsten Angebot, warum die Regel nicht greift.
      setLernFehler(fehler === 1
        ? 'Eine Regel konnte nicht gespeichert werden. Bitte nochmal versuchen — bereits gespeicherte werden nicht doppelt angelegt.'
        : `${fehler} Regeln konnten nicht gespeichert werden. Bitte nochmal versuchen — bereits gespeicherte werden nicht doppelt angelegt.`)
      return
    }
    lernDialogSchliessen()
  }, [lernKandidaten, lernAuswahl, lernWenn, lernErledigt, lernDialogSchliessen])
```

- [ ] **Step 4: Auslöser einbauen**

In `saveProject` **nach** `setSaveStatus('saved')` (Zeile 385) — also nachdem das Speichern vollständig durch ist:

```tsx
      void pruefeLernkandidaten()
```

**Beim PDF-Export NICHT direkt nach dem Export auslösen.** Der Export setzt
`setScreen('pdf-preview')`, und dieser Bildschirm kehrt früh zurück — der Dialog wird dort
gar nicht gerendert (er hängt im `screen === 'app'`-Zweig). Der Aufruf am Export-Ende
würde die Kandidaten unsichtbar füllen und der Dialog später überfallartig auftauchen,
im schlechtesten Fall mit Kandidaten eines längst gewechselten Angebots.

Stattdessen im **„← Zurück"-Handler des `pdf-preview`-Bildschirms** auslösen, also genau
dann, wenn der Nutzer die Vorschau verlässt und wieder auf `screen === 'app'` landet:

```tsx
              void pruefeLernkandidaten()
```

Nebeneffekt: Bei fehlgeschlagener PDF-Erzeugung erscheint dadurch gar kein Dialog mehr —
richtig so, denn das ist der schlechteste Moment für eine Rückfrage.

`saveProject` ist eine normale `async function`, keine `useCallback` — der Aufruf von `pruefeLernkandidaten` darin ist zulässig, weil die Funktion bei jedem Render neu erzeugt wird und die aktuelle Closure sieht.

- [ ] **Step 4b: Vergleichsbasis beim Angebotswechsel zurücksetzen**

Ohne diesen Schritt ist die Regel „keine Kopie → kein Lernen" ausgehebelt:
`kiVorschlagRef.current` wird nur gesetzt, nie geleert. Wer ein Angebot analysiert, dann
„Neues Angebot" klickt oder ein Projekt aus der Liste lädt, bearbeitet und speichert,
vergleicht das neue Angebot gegen den Erstvorschlag des **vorigen**. Der Diff ist Müll,
die KI leitet daraus Kandidaten ab — und weil das neue Regeln sind, stehen sie
**vorangehakt** hinter dem Bestätigungsknopf. Ein Klick vermüllt den Vault dauerhaft,
und der Müll fließt danach in jeden Prompt.

In `resetAll` (ca. Zeile 899–943) **und** in `loadProject` (ca. Zeile 416–432) jeweils
ergänzen:

```tsx
    // Bauweise-Vault: Vergleichsbasis und offene Kandidaten gehören zum bisherigen
    // Angebot. Ohne Zurücksetzen würde das nächste Angebot gegen den Erstvorschlag
    // des vorigen verglichen.
    kiVorschlagRef.current = null
    setLernKandidaten([])
    setLernAuswahl({})
    setLernWenn({})
    setLernFehler('')
    setLernErledigt({})
```

- [ ] **Step 5: Dialog rendern**

Am Ende des JSX der Hauptkomponente, direkt vor `{HelpWidget}` (Zeile 3990):

```tsx
      {lernKandidaten.length > 0 && (
        <div
          onClick={e => { if (e.target === e.currentTarget && !lernSpeichert) lernDialogSchliessen() }}
          style={{ position: 'fixed', inset: 0, background: '#000000CC', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: 16 }}>
          <div style={{ background: C.darkbg, border: `1px solid ${C.border}`, borderRadius: 4, maxWidth: 560, width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.white, fontFamily: 'Helvetica Neue,sans-serif', marginBottom: 4 }}>
              {lernKandidaten.length === 1 ? 'Mir ist eine Sache aufgefallen' : `Mir sind ${lernKandidaten.length} Dinge aufgefallen`}
            </div>
            <div style={{ fontSize: 12, color: C.textMid, marginBottom: 16 }}>
              Was davon ist deine Standardbauweise? Angehakte Punkte merkt sich CraftFlow für künftige Angebote.
            </div>

            {lernKandidaten.map((k, i) => (
              <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 3, padding: 12, marginBottom: 10, background: C.gray1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <input
                    type="checkbox"
                    checked={!!lernAuswahl[i]}
                    disabled={!!lernErledigt[i] || lernSpeichert}
                    onChange={() => setLernAuswahl(prev => ({ ...prev, [i]: !prev[i] }))}
                    style={{ accentColor: C.copper, cursor: lernErledigt[i] ? 'default' : 'pointer', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: C.copper, fontFamily: 'Helvetica Neue,sans-serif' }}>
                    {k.bereich.toUpperCase()}
                  </span>
                  {k.aendertRegelId && (
                    <span style={{ fontSize: 10, color: '#E0B05A', fontFamily: 'Helvetica Neue,sans-serif' }}>
                      ⚠ ändert bestehende Regel
                    </span>
                  )}
                  {lernErledigt[i] && (
                    <span style={{ fontSize: 10, color: '#5ABE6A', fontFamily: 'Helvetica Neue,sans-serif' }}>
                      ✓ gespeichert
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: C.textMid, width: 38, flexShrink: 0 }}>Wenn</span>
                  <input
                    value={lernWenn[i] ?? ''}
                    onChange={e => setLernWenn(prev => ({ ...prev, [i]: e.target.value }))}
                    placeholder="gilt immer"
                    style={{ flex: 1, background: C.black, color: C.white, border: `1px solid ${C.border}`, borderRadius: 3, padding: '6px 8px', fontSize: 12, fontFamily: 'Helvetica Neue,sans-serif' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: C.textMid, width: 38, flexShrink: 0 }}>Dann</span>
                  <span style={{ fontSize: 12, color: C.white, lineHeight: 1.4 }}>{k.dann}</span>
                </div>
                <div style={{ fontSize: 10, color: C.textMid, marginTop: 6 }}>↳ belegt: {k.belegText}</div>
              </div>
            ))}

            {lernFehler && (
              <div style={{ border: '1px solid #6a3a3a', background: '#2a1a1a', borderRadius: 3, padding: 10, marginTop: 10, fontSize: 11, color: '#E05A5A' }}>
                {lernFehler}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button
                onClick={lernDialogSchliessen}
                disabled={lernSpeichert}
                style={{ flex: 1, background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 3, padding: '11px 0', fontSize: 12, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 700, cursor: lernSpeichert ? 'not-allowed' : 'pointer' }}
              >
                Nicht merken
              </button>
              <button
                onClick={lernRegelnSpeichern}
                disabled={lernSpeichert || lernOffeneAnzahl === 0}
                style={{ flex: 1, background: lernOffeneAnzahl > 0 ? C.copper : C.gray2, color: lernOffeneAnzahl > 0 ? C.black : C.textMid, border: 'none', borderRadius: 3, padding: '11px 0', fontSize: 12, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 800, cursor: lernSpeichert || lernOffeneAnzahl === 0 ? 'not-allowed' : 'pointer' }}
              >
                {lernSpeichert ? '…' : `${lernOffeneAnzahl} ${lernOffeneAnzahl === 1 ? 'Regel' : 'Regeln'} merken`}
              </button>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 6: Prüfen, dass `useRef` importiert ist**

Run: `cd ~/Downloads/craftflow && grep -n "^import.*from 'react'" src/app/page.tsx`
Expected: `useRef` und `useCallback` sind in der Import-Liste. Falls nicht, ergänzen.

- [ ] **Step 7: Build, Lint und Tests prüfen**

Run: `cd ~/Downloads/craftflow && npm run test && npx tsc --noEmit && npx eslint <deine geaenderten Dateien>`
Expected: Tests `fail 0`, `tsc` Exit 0, eslint-Ausgabe leer.

- [ ] **Step 8: Commit**

```bash
cd ~/Downloads/craftflow
git add src/app/page.tsx
git commit -m "feat(page): Erstvorschlag merken und Lern-Dialog beim Speichern"
```

---

### Task 8: Vault-UI in den Einstellungen

**Files:**
- Create: `src/components/settings/BauweiseSettings.tsx`
- Modify: `src/app/settings/page.tsx`

**Interfaces:**
- Consumes: `GET/POST/PUT/DELETE /api/settings/bauweise`, `BEREICHE`, `WARNUNG_AB_REGELN`, `MAX_REGELN_IM_PROMPT` aus `@/lib/learn`
- Produces: Default-Export `BauweiseSettings` (keine Props).

- [ ] **Step 1: Komponente anlegen**

`src/components/settings/BauweiseSettings.tsx`. Aufbau und Styling an `src/components/settings/EmailSettings.tsx` orientieren (dort zuerst nachsehen, welche Konstanten aus `@/lib/types` verwendet werden und wie Karten dort aussehen — dieselben Muster übernehmen).

```tsx
'use client'
import { useCallback, useEffect, useState } from 'react'
import { C } from '@/lib/types'
import { BEREICHE, WARNUNG_AB_REGELN, MAX_REGELN_IM_PROMPT } from '@/lib/learn'

type Regel = {
  id: string
  bereich: string
  wenn: string
  dann: string
  herkunft: string
  quelle_text: string
  beleg: string
  aktiv: boolean
  gesendet_zahl: number
  zuletzt_gesendet: string | null
  konflikt_hinweis: boolean
  created_at: string
}

export default function BauweiseSettings() {
  const [regeln, setRegeln] = useState<Regel[]>([])
  const [laedt, setLaedt] = useState(true)
  const [neuOffen, setNeuOffen] = useState(false)
  const [neuBereich, setNeuBereich] = useState<string>(BEREICHE[0])
  const [neuWenn, setNeuWenn] = useState('')
  const [neuDann, setNeuDann] = useState('')
  const [neuFehler, setNeuFehler] = useState('')
  const [listenFehler, setListenFehler] = useState('')

  const laden = useCallback(async () => {
    const res = await fetch('/api/settings/bauweise')
    if (res.ok) {
      const json = await res.json() as { regeln?: Regel[] }
      setRegeln(json.regeln ?? [])
    }
    setLaedt(false)
  }, [])

  useEffect(() => { void laden() }, [laden])

  const aktive = regeln.filter(r => r.aktiv)
  // Reihenfolge wie im Prompt (siehe ladeAktiveRegeln): zuletzt gesendet zuerst.
  const imPromptIds = new Set(
    [...aktive]
      .sort((a, b) => {
        const za = a.zuletzt_gesendet ? Date.parse(a.zuletzt_gesendet) : -1
        const zb = b.zuletzt_gesendet ? Date.parse(b.zuletzt_gesendet) : -1
        if (za !== zb) return zb - za
        return Date.parse(b.created_at) - Date.parse(a.created_at)
      })
      .slice(0, MAX_REGELN_IM_PROMPT)
      .map(r => r.id),
  )

  // Jede Schreiboperation muss ihren Erfolg pruefen. Ein stiller Fehlschlag ist
  // hier besonders heimtueckisch: die Eingabefelder zeigen weiter den getippten
  // Text, der Nutzer haelt die Regel fuer gespeichert — und wundert sich beim
  // naechsten Angebot, warum sie nicht greift.
  const aendern = async (id: string, patch: { wenn?: string; dann?: string; aktiv?: boolean }) => {
    setListenFehler('')
    try {
      const res = await fetch('/api/settings/bauweise', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      })
      if (!res.ok) setListenFehler('Änderung konnte nicht gespeichert werden.')
    } catch { setListenFehler('Änderung konnte nicht gespeichert werden.') }
    // Immer neu laden: so zeigt die Liste im Fehlerfall wieder den echten
    // Datenbankstand statt der nicht gespeicherten Eingabe.
    void laden()
  }

  const loeschen = async (id: string) => {
    if (!confirm('Regel wirklich löschen?')) return
    setListenFehler('')
    try {
      const res = await fetch('/api/settings/bauweise', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) setListenFehler('Regel konnte nicht gelöscht werden.')
    } catch { setListenFehler('Regel konnte nicht gelöscht werden.') }
    void laden()
  }

  const anlegen = async () => {
    if (!neuDann.trim()) return
    setNeuFehler('')
    let ok = false
    try {
      const res = await fetch('/api/settings/bauweise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bereich: neuBereich, wenn: neuWenn, dann: neuDann, herkunft: 'manuell' }),
      })
      ok = res.ok
    } catch { ok = false }
    if (!ok) {
      // Eingabe stehen lassen, damit der Nutzer sie nicht neu tippen muss.
      setNeuFehler('Regel konnte nicht gespeichert werden. Bitte nochmal versuchen.')
      return
    }
    setNeuWenn(''); setNeuDann(''); setNeuOffen(false)
    void laden()
  }

  if (laedt) return <div style={{ fontSize: 12, color: C.textMid, padding: 16 }}>Lade Regeln…</div>

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontSize: 12, color: C.textMid, marginBottom: 14, lineHeight: 1.5 }}>
        Hier steht, was CraftFlow über deine Bauweise gelernt hat. Diese Regeln fließen in jede
        Kalkulation ein und gelten nur für dein Konto. Stundensätze und Materialaufschläge gehören
        weiterhin in die jeweiligen Bereiche — hier geht es um Bauweise, Material und Zeitgefühl.
      </div>

      {aktive.length >= WARNUNG_AB_REGELN && (
        <div style={{ border: `1px solid ${C.copper}55`, background: `${C.copper}15`, borderRadius: 3, padding: 10, marginBottom: 14, fontSize: 11, color: C.white, lineHeight: 1.5 }}>
          Du hast {aktive.length} aktive Regeln. Ab {MAX_REGELN_IM_PROMPT} werden nicht mehr alle
          mitgeschickt — räume am besten auf, was nicht mehr stimmt.
        </div>
      )}

      {regeln.length === 0 && (
        <div style={{ fontSize: 12, color: C.textMid, marginBottom: 14 }}>
          Noch keine Regeln. CraftFlow fragt dich nach dem Speichern eines Angebots, wenn ihm etwas
          auffällt — oder du legst hier selbst eine an.
        </div>
      )}

      {BEREICHE.filter(b => regeln.some(r => r.bereich === b)).map(bereich => (
        <div key={bereich} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: C.copper, fontFamily: 'Helvetica Neue,sans-serif', marginBottom: 8 }}>
            {bereich.toUpperCase()}
          </div>
          {regeln.filter(r => r.bereich === bereich).map(r => (
            <div key={r.id} style={{ border: `1px solid ${C.border}`, borderRadius: 3, padding: 12, marginBottom: 8, background: C.gray1, opacity: r.aktiv ? 1 : 0.55 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <input
                  type="checkbox"
                  checked={r.aktiv}
                  onChange={() => void aendern(r.id, { aktiv: !r.aktiv })}
                  style={{ accentColor: C.copper, cursor: 'pointer', flexShrink: 0 }}
                  title={r.aktiv ? 'Regel ist aktiv' : 'Regel ist aus'}
                />
                <span style={{ fontSize: 11, color: C.textMid, flex: 1 }}>
                  {r.herkunft === 'manuell' ? 'von mir eingetippt' : r.quelle_text || 'gelernt'}
                </span>
                <button
                  onClick={() => void loeschen(r.id)}
                  style={{ background: 'transparent', border: 'none', color: C.textMid, cursor: 'pointer', fontSize: 14, padding: '0 4px' }}
                  title="Regel löschen"
                >×</button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: C.textMid, width: 38, flexShrink: 0 }}>Wenn</span>
                <input
                  defaultValue={r.wenn}
                  onBlur={e => { if (e.target.value !== r.wenn) void aendern(r.id, { wenn: e.target.value }) }}
                  placeholder="gilt immer"
                  style={{ flex: 1, background: C.black, color: C.white, border: `1px solid ${C.border}`, borderRadius: 3, padding: '6px 8px', fontSize: 12, fontFamily: 'Helvetica Neue,sans-serif' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: C.textMid, width: 38, flexShrink: 0 }}>Dann</span>
                <input
                  defaultValue={r.dann}
                  onBlur={e => { if (e.target.value !== r.dann && e.target.value.trim()) void aendern(r.id, { dann: e.target.value }) }}
                  style={{ flex: 1, background: C.black, color: C.white, border: `1px solid ${C.border}`, borderRadius: 3, padding: '6px 8px', fontSize: 12, fontFamily: 'Helvetica Neue,sans-serif' }}
                />
              </div>

              {r.beleg && <div style={{ fontSize: 10, color: C.textMid, marginTop: 6 }}>↳ belegt: {r.beleg}</div>}

              <div style={{ fontSize: 10, color: C.textMid, marginTop: 6 }}>
                {r.gesendet_zahl === 0
                  ? 'noch nicht mitgeschickt'
                  : `${r.gesendet_zahl}× mitgeschickt${r.zuletzt_gesendet ? `, zuletzt ${new Date(r.zuletzt_gesendet).toLocaleDateString('de-DE')}` : ''}`}
              </div>

              {r.konflikt_hinweis && (
                <div style={{ fontSize: 10, color: '#E0B05A', marginTop: 6 }}>
                  ⚠ Du hast das kürzlich wieder anders gemacht — greift diese Regel noch?
                </div>
              )}
              {r.aktiv && !imPromptIds.has(r.id) && (
                <div style={{ fontSize: 10, color: '#E05A5A', marginTop: 6 }}>
                  Wird derzeit NICHT mitgeschickt — Obergrenze von {MAX_REGELN_IM_PROMPT} Regeln erreicht.
                </div>
              )}
            </div>
          ))}
        </div>
      ))}

      {!neuOffen ? (
        <button
          onClick={() => setNeuOffen(true)}
          style={{ background: 'transparent', color: C.copper, border: `1px solid ${C.copper}55`, borderRadius: 3, padding: '10px 14px', fontSize: 12, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 700, cursor: 'pointer' }}
        >
          + Regel selbst anlegen
        </button>
      ) : (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 3, padding: 12, background: C.gray1 }}>
          <select
            value={neuBereich}
            onChange={e => setNeuBereich(e.target.value)}
            style={{ background: C.black, color: C.white, border: `1px solid ${C.border}`, borderRadius: 3, padding: '6px 8px', fontSize: 12, fontFamily: 'Helvetica Neue,sans-serif', marginBottom: 8, width: '100%' }}
          >
            {BEREICHE.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <input
            value={neuWenn}
            onChange={e => setNeuWenn(e.target.value)}
            placeholder="Wenn … (leer lassen für: gilt immer)"
            style={{ width: '100%', background: C.black, color: C.white, border: `1px solid ${C.border}`, borderRadius: 3, padding: '6px 8px', fontSize: 12, fontFamily: 'Helvetica Neue,sans-serif', marginBottom: 8 }}
          />
          <input
            value={neuDann}
            onChange={e => setNeuDann(e.target.value)}
            placeholder="Dann … (z.B. Rückwand 8mm Multiplex, kein HPL)"
            style={{ width: '100%', background: C.black, color: C.white, border: `1px solid ${C.border}`, borderRadius: 3, padding: '6px 8px', fontSize: 12, fontFamily: 'Helvetica Neue,sans-serif', marginBottom: 10 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { setNeuOffen(false); setNeuWenn(''); setNeuDann('') }}
              style={{ flex: 1, background: 'transparent', color: C.textMid, border: `1px solid ${C.border}`, borderRadius: 3, padding: '9px 0', fontSize: 12, fontFamily: 'Helvetica Neue,sans-serif', cursor: 'pointer' }}
            >Abbrechen</button>
            <button
              onClick={() => void anlegen()}
              disabled={!neuDann.trim()}
              style={{ flex: 1, background: neuDann.trim() ? C.copper : C.gray2, color: neuDann.trim() ? C.black : C.textMid, border: 'none', borderRadius: 3, padding: '9px 0', fontSize: 12, fontFamily: 'Helvetica Neue,sans-serif', fontWeight: 800, cursor: neuDann.trim() ? 'pointer' : 'not-allowed' }}
            >Regel speichern</button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Prüfen, dass `C` aus `@/lib/types` so exportiert wird**

Run: `cd ~/Downloads/craftflow && grep -n "export const C" src/lib/types.ts && grep -n "from '@/lib/types'" src/components/settings/EmailSettings.tsx`
Expected: `C` ist exportiert und wird in `EmailSettings.tsx` genauso importiert. Weichen die Namen ab (z. B. andere Farb-Keys als `C.gray1`, `C.darkbg`, `C.textMid`, `C.border`, `C.copper`, `C.black`, `C.white`, `C.gray2`), die tatsächlich vorhandenen Keys verwenden.

- [ ] **Step 3: In die Einstellungsseite einhängen**

In `src/app/settings/page.tsx` importieren und als eigene Karte einhängen — an derselben Stelle und im selben Muster, wie `EmailSettings` bzw. `LieferantenSettings` dort schon eingebunden sind (vorher nachsehen). Überschrift der Karte: `Meine Bauweise`, mit Unterzeile `Was CraftFlow von dir gelernt hat`.

```tsx
import BauweiseSettings from '@/components/settings/BauweiseSettings'
```

- [ ] **Step 4: Build, Lint und Tests prüfen**

Run: `cd ~/Downloads/craftflow && npm run test && npx tsc --noEmit && npx eslint <deine geaenderten Dateien>`
Expected: Tests `fail 0`, `tsc` Exit 0, eslint-Ausgabe leer.

- [ ] **Step 5: Commit**

```bash
cd ~/Downloads/craftflow
git add src/components/settings/BauweiseSettings.tsx src/app/settings/page.tsx
git commit -m "feat(settings): Vault-Reiter 'Meine Bauweise'"
```

---

### Task 9: Dokumentation und Live-Test auf der dev-Preview

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: alles Vorherige.
- Produces: nichts.

- [ ] **Step 1: `CLAUDE.md` ergänzen**

Im Abschnitt „Kalkulations-Engine — verbindliche Invarianten" ergänzen:

```markdown
- **Bauweise-Vault** (`bauweise_regeln`, pro `user_id`): gelernte Wenn-Dann-Regeln des
  Nutzers werden **serverseitig** geladen und als **letzter** Block an den System-Prompt
  von analyze und optimize gehängt, mit ausdrücklichem Vorrang-Satz. Reihenfolge ist
  funktional — vor dem Standardwissen wäre der Block wirkungslos.
- Der Vault beeinflusst **nie** `vkStunde`, `aufschlag` oder Preise. Nur Bauweise,
  Material, Konstruktion, Zeitgefühl.
- Der Vault wird **nie** über Nutzer hinweg aggregiert oder geteilt — strikt getrennt von
  `benchmark_zustimmung` / `include_in_benchmark`.
- Regelkandidaten aus der KI haben **Belegpflicht**: ohne gültigen Verweis auf einen
  Code-Diff-Eintrag oder ein wörtliches Chat-Zitat werden sie verworfen
  (`pruefeKandidaten` in `src/lib/learn.ts`). Gleiche Haltung wie bei den KI-Zahlen.
- Lernen darf Speichern und PDF-Export **nie** blockieren.
```

Im Abschnitt „Lokale Umgebung & Testen" bei den Testwegen ergänzen:

```markdown
3. **Reine Logik mit echten Tests:** `npm run test` führt `tests/*.test.mjs` über Nodes
   eigenen Test-Runner aus. Node 24 führt die TypeScript-Dateien direkt aus (Type
   Stripping) — deshalb sind **keine** Test-Pakete installiert und `src/lib/learn.ts`
   importiert absichtlich nichts. Alles, was Supabase braucht, gehört nach
   `src/lib/bauweise.ts`, sonst sind die Tests nicht mehr lauffähig.
```

- [ ] **Step 2: Vollständige lokale Verifikation**

Run: `cd ~/Downloads/craftflow && npm run test && npx tsc --noEmit && npx eslint <deine geaenderten Dateien>`
Expected: Tests `fail 0`, `tsc` Exit 0, eslint-Ausgabe auf den geaenderten Dateien leer. **Ausgabe tatsächlich lesen** — nicht auf Erfolg schließen, ohne sie gesehen zu haben.

- [ ] **Step 3: Commit und auf dev pushen**

```bash
cd ~/Downloads/craftflow
git add CLAUDE.md
git commit -m "docs(CLAUDE.md): Bauweise-Vault als Engine-Invariante"
git push origin dev
```

- [ ] **Step 4: Live-Durchlauf auf der dev-Preview**

Adresse: `https://craftflow-git-dev-fabian-scharf-s-projects.vercel.app`
Fabian loggt manuell ein (Vercel-SSO + App-Login). Steuerung danach über das projekteigene `puppeteer-core` gegen Chrome mit Debug-Port, wie in der Projekt-CLAUDE.md beschrieben.

Reihenfolge:

1. Angebot mit Korpus und Rückwand erzeugen → prüfen, dass die KI HPL vorschlägt
2. Im Optimieren-Chat auf „Rückwand bitte 8mm Multiplex Birke, nie HPL" ändern
3. „Änderungen speichern" → Dialog muss erscheinen, Kandidat mit sichtbarem Beleg
4. Regel anhaken, merken
5. Einstellungen → „Meine Bauweise": Regel ist da, mit Beleg und Herkunft
6. **Neues** Angebot mit Korpus und Rückwand erzeugen → Rückwand muss von allein
   Multiplex 8 mm sein. **Das ist der eigentliche Beweis, dass das Feature funktioniert.**
7. Regel im Vault deaktivieren → nächstes Angebot fällt auf HPL zurück
8. Gegenprobe Rauschfilter: nur eine Minutenangabe um ~10 % ändern, speichern → **kein**
   Dialog
9. Gegenprobe Ausnahme: „Diesmal bitte HPL, der Kunde will das so" → **keine** Regel dazu

- [ ] **Step 5: Mandantentrennung prüfen**

1. Zweites Konto über `/register` anlegen (zweite E-Mail-Adresse nötig; `solo`-Plan genügt —
   3 Angebote pro Monat, 14 Tage Trial)
2. Mit Konto B einloggen → Einstellungen → „Meine Bauweise" muss **leer** sein
3. Mit Konto B ein Angebot mit Rückwand erzeugen → muss den generischen Vorschlag liefern,
   **nicht** Fabians Multiplex-Regel
4. Danach aufräumen: Testregeln und Testprojekte von Konto B löschen. **Achtung:** Alle
   Previews und die Produktion teilen dieselbe Supabase-DB — die Testdaten liegen also
   auch in der Produktions-DB.

- [ ] **Step 6: Freigabe einholen — GATE**

Ergebnisse aus Step 4 und 5 an Fabian berichten, inklusive dem, was **nicht** funktioniert
hat. Erst nach seiner ausdrücklichen Freigabe:

```bash
cd ~/Downloads/craftflow
git checkout main && git merge dev && git push origin main
```

**Nicht ohne Freigabe mergen.**

---

## Self-Review

**Spec-Abdeckung geprüft:**

| Spec-Abschnitt | Task |
|---|---|
| Datenmodell `bauweise_regeln` + RLS | 4 |
| Mandantentrennung (`user_id`, Session, RLS) | 4, 9 (Step 5) |
| Ablauf Schritt 1 (Kopie) | 7 (Step 2) |
| Code-Diff + Rauschfilter | 1 |
| KI formuliert | 6 |
| Belegpflicht | 2, 6 |
| Einmal-Ausnahmen | 2 (`istAusnahmeNachricht`), 6 (KI-Auftrag) |
| Datenschutz-Filter (Kundendaten) | 2 (`kundenWoerter`), 6, 7 (Step 3 sendet sie) |
| Abgleich mit Vault / Konflikt-Markierung | 2 (`istGleicheRegel`), 4 (`ersetztRegelId`), 8 (Anzeige) |
| Dialog beim Speichern | 7 |
| Prompt-Block + Vorrang + Position am Ende | 3, 5 |
| Serverseitiges Laden | 4 (`bauweise.ts`), 5 |
| Mengenbegrenzung 60 / Warnung 40 / kein stilles Abschneiden | 3, 4, 8 |
| Zähler + `zuletzt_gesendet` | 4 (SQL-Funktion), 5, 8 (Anzeige) |
| Vault-UI mit Bearbeiten, an/aus, löschen, selbst anlegen | 8 |
| Fehlerverhalten (nie blockieren) | 6 (immer 200), 7 (try/catch, `void`) |
| Testplan reine Funktionen | 1, 2, 3 |
| Testplan Live dev-Preview | 9 (Step 4) |
| Testplan Mandantentrennung | 9 (Step 5) |
| Deployment-Regel | 9 (Step 6) |

Keine Lücken gefunden.

**Platzhalter-Scan:** Keine „TBD", „TODO", „ähnlich wie Task N" oder „Fehlerbehandlung ergänzen". Jeder Code-Schritt enthält den tatsächlichen Code.

**Typ-Konsistenz geprüft:**
- `normalisiere` in Task 1 definiert, in Task 2 (`istGleicheRegel`, `pruefeKandidaten`, `istAusnahmeNachricht`) und Task 4 (`pruefeBereich`) verwendet — konsistent.
- `Aenderung.nr` in Task 1 definiert, in Task 2 (`beschreibeAenderung`, Belegprüfung) und Task 6 (Prompt-Liste) verwendet — konsistent.
- `GepruefterKandidat` (Task 2, Felder `bereich`, `wenn`, `dann`, `belegText`, `aendertRegelId`) → Task 6 ergänzt `quelle_text` → Task 7 liest genau diese Felder — konsistent.
- `ersetztRegelId` in der POST-Route (Task 4) heißt im Frontend beim Senden ebenfalls `ersetztRegelId` (Task 7) — konsistent. Nicht zu verwechseln mit `aendertRegelId`, das vom Server zum Frontend geht.
- `MAX_REGELN_IM_PROMPT` in Task 3 definiert, in Task 4 (`ladeAktiveRegeln`) und Task 8 (Anzeige) verwendet — konsistent.
- `regelBlockFuerNutzer` / `zaehleRegelnHoch` in Task 4 definiert, in Task 5 verwendet — Signaturen stimmen überein.

## Verifizierte Voraussetzungen

Beim Schreiben des Plans gegen den Code geprüft — muss beim Umsetzen nicht erneut geklärt werden:

1. **Farb-Keys in `C`** (`src/lib/types.ts:189`): `black`, `darkbg`, `copper`, `white`,
   `gray1`, `gray2`, `textMid`, `border`. Alle im Plan verwendeten Keys existieren.
2. **React-Hooks** in `src/app/page.tsx:3` bereits importiert: `useState`, `useRef`,
   `useCallback`, `useEffect`. Kein Import-Nachtrag nötig.
3. **`Angebotsposition`** ist in `src/app/page.tsx:13` schon importiert.
4. **`Kunde`** (`src/lib/types.ts:2`) hat genau die Felder `name`, `zusatz`, `strasse`,
   `ort`, `projekt` — die in Task 7 Step 3 verwendeten Felder stimmen.
5. **`OptimChatMsg`** (`src/app/page.tsx:25`) ist `{ role: 'user' | 'assistant'; content: string }` —
   `optimMessages` und `checkMessages` teilen diese Form.
6. **Positions- und Material-IDs sind Zahlen** (`id: Date.now() + …` in `src/app/page.tsx`).
   `LernPosition.id?: string | number` deckt das ab, ebenso UUID-Strings, falls das später wechselt.
7. **`node --test` mit Glob** funktioniert unter Node 24.16 gegen TypeScript direkt
   (verifiziert). Die Verzeichnisform `node --test tests/` scheitert mit `MODULE_NOT_FOUND` —
   deshalb die Glob-Schreibweise im `test`-Script.

Offen bleibt nur:

- **ESLint auf `.mjs`-Testdateien** — nicht vorab prüfbar, weil es die Dateien noch nicht gibt.
  Task 1 Step 6 behandelt den Fall.
