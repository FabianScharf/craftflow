import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { WEBHOOK_EREIGNISSE, fehlendeEreignisse, ergaenzeEreignisse } from '../src/lib/stripe-ereignisse.ts'

// DER EIGENTLICHE TEST: Ein Webhook-Zweig ohne Abonnement ist toter Code, den man
// im Code nicht sehen kann — Stripe schickt das Ereignis dann einfach nie.
test('Jeder Zweig der Webhook-Route hat sein Ereignis in der Liste', () => {
  const quelle = readFileSync('src/app/api/stripe/webhook/route.ts', 'utf8')
  const behandelt = [...quelle.matchAll(/event\.type === '([a-z_.]+)'/g)].map(m => m[1])
  assert.ok(behandelt.length > 0, 'keine Ereignis-Zweige gefunden — Muster geändert?')
  for (const e of behandelt) {
    assert.ok(
      WEBHOOK_EREIGNISSE.includes(e),
      `Die Route behandelt '${e}', aber WEBHOOK_EREIGNISSE kennt es nicht — Stripe würde es nie schicken.`,
    )
  }
})

test('Fehlende Ereignisse werden erkannt', () => {
  assert.deepEqual(fehlendeEreignisse([...WEBHOOK_EREIGNISSE]), [])
  assert.deepEqual(fehlendeEreignisse(['checkout.session.completed']).includes('invoice.paid'), true)
})

// '*' ist bei Stripe die Sammelauswahl „alle Ereignisse“ — dann fehlt nichts.
test('Ein Endpunkt mit * gilt als vollständig', () => {
  assert.deepEqual(fehlendeEreignisse(['*']), [])
  assert.deepEqual(ergaenzeEreignisse(['*']), ['*'])
})

// Bestehende Ereignisse dürfen nie verloren gehen — ein Endpunkt kann mehr abonniert
// haben, als wir kennen (etwa für ein anderes Werkzeug).
test('Ergänzen behält Fremdes und macht keine Dubletten', () => {
  const vorher = ['customer.created', 'checkout.session.completed']
  const nachher = ergaenzeEreignisse(vorher)
  assert.ok(nachher.includes('customer.created'), 'fremdes Ereignis verloren')
  assert.ok(nachher.includes('invoice.paid'), 'neues Ereignis fehlt')
  assert.equal(new Set(nachher).size, nachher.length, 'Dubletten in der Liste')
})
