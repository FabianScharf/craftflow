import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { PLAN_REIHE, PLAENE, PLAN_LABELS, merkmaleFuerAnzeige } from '../src/lib/plaene.ts'

// Website-Repo liegt nicht neben diesem Repo — Standardort ist ~/craftflow-web,
// überschreibbar per CRAFTFLOW_WEB_DIR (dieselbe Auflösung wie im Export-Skript).
const webDir = process.env.CRAFTFLOW_WEB_DIR ?? join(homedir(), 'craftflow-web')
const pfad = join(webDir, 'lib', 'plaene.json')

test(`Website-Preise stimmen mit der App überein (übersprungen, wenn ${pfad} fehlt)`, { skip: !existsSync(pfad) }, () => {
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
