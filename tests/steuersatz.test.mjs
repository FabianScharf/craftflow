import { test } from 'node:test'
import assert from 'node:assert/strict'
import { waehleSteuersatz } from '../src/lib/steuersatz.ts'

test('Aktiver, aufschlagender 19-%-Satz wird gewaehlt; inklusive, inaktive und andere Prozente nicht', () => {
  assert.equal(waehleSteuersatz([
    { id: 'txr_inkl', active: true, inclusive: true, percentage: 19 },
    { id: 'txr_alt', active: false, inclusive: false, percentage: 19 },
    { id: 'txr_7', active: true, inclusive: false, percentage: 7 },
    { id: 'txr_ok', active: true, inclusive: false, percentage: 19 },
  ]), 'txr_ok')
})

test('Der von CraftFlow angelegte Satz (Umsatzsteuer, DE) hat Vorrang', () => {
  assert.equal(waehleSteuersatz([
    { id: 'txr_fremd', active: true, inclusive: false, percentage: 19, display_name: 'VAT' },
    { id: 'txr_cf', active: true, inclusive: false, percentage: 19, display_name: 'Umsatzsteuer', country: 'DE' },
  ]), 'txr_cf')
})

test('Nichts Passendes → null (Aufrufer legt an)', () => {
  assert.equal(waehleSteuersatz([]), null)
  assert.equal(waehleSteuersatz([{ id: 'x', active: true, inclusive: true, percentage: 19 }]), null)
})
