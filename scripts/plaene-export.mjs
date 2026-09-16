// scripts/plaene-export.mjs — schreibt die Matrix als JSON für die Website
import { writeFileSync } from 'node:fs'
import { PLAN_REIHE, PLAENE, PLAN_LABELS, merkmaleFuerAnzeige } from '../src/lib/plaene.ts'

const daten = PLAN_REIHE.map(id => ({
  id,
  name: PLAN_LABELS[id],
  preisNetto: PLAENE[id].preisNetto,
  untertitel: PLAENE[id].untertitel,
  merkmale: merkmaleFuerAnzeige(id),
  beliebt: id === 'pro',
}))

const ziel = process.argv[2] ?? '../craftflow-web/lib/plaene.json'
writeFileSync(ziel, JSON.stringify(daten, null, 2) + '\n')
console.log('geschrieben:', ziel)
