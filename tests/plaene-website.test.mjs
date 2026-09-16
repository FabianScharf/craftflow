import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { PLAN_REIHE, PLAENE, PLAN_LABELS, merkmaleFuerAnzeige } from '../src/lib/plaene.ts'

const pfad = new URL('../../craftflow-web/lib/plaene.json', import.meta.url)

test('Website-Preise stimmen mit der App überein (übersprungen, wenn das Nachbar-Repo fehlt)', { skip: !existsSync(pfad) }, () => {
  const web = JSON.parse(readFileSync(pfad, 'utf8'))
  assert.deepEqual(web, PLAN_REIHE.map(id => ({
    id,
    name: PLAN_LABELS[id],
    preisNetto: PLAENE[id].preisNetto,
    untertitel: PLAENE[id].untertitel,
    merkmale: merkmaleFuerAnzeige(id),
    beliebt: id === 'pro',
  })), 'Website veraltet — `node scripts/plaene-export.mjs` ausführen und im Website-Repo committen')
})
