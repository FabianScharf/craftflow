// scripts/plaene-export.mjs — schreibt die Matrix als JSON für die Website
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { PLAN_REIHE, PLAENE, PLAN_LABELS, merkmaleFuerAnzeige } from '../src/lib/plaene.ts'

const daten = PLAN_REIHE.map(id => ({
  id,
  name: PLAN_LABELS[id],
  preisNetto: PLAENE[id].preisNetto,
  untertitel: PLAENE[id].untertitel,
  merkmale: merkmaleFuerAnzeige(id),
  beliebt: id === 'pro',
}))

// Website-Repo liegt nicht neben diesem Repo — Standardort ist ~/craftflow-web,
// überschreibbar per CRAFTFLOW_WEB_DIR (z. B. für abweichende Checkouts).
const webDir = process.env.CRAFTFLOW_WEB_DIR ?? join(homedir(), 'craftflow-web')
const ziel = process.argv[2] ?? join(webDir, 'lib', 'plaene.json')
writeFileSync(ziel, JSON.stringify(daten, null, 2) + '\n')
console.log('geschrieben:', ziel)
