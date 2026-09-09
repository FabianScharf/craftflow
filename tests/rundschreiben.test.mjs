import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RUNDSCHREIBEN, KENNUNG_MUSTER, merkerName, rundschreibenFinden, STARTHILFE_URL } from '../src/lib/mail/vorlagen.ts'

// Die Kennung ist der Merker gegen Doppelversand. Zwei gleiche Kennungen hießen:
// Die zweite Mail erreicht niemanden, der die erste hatte — ohne Fehlermeldung.
test('Jede Kennung ist eindeutig und folgt dem Muster Jahr-Monat-Name', () => {
  const alle = RUNDSCHREIBEN.map(r => r.kennung)
  assert.equal(new Set(alle).size, alle.length, 'doppelte Kennung')
  for (const k of alle) assert.match(k, KENNUNG_MUSTER, `Kennung „${k}“ passt nicht zum Muster`)
})

test('Jedes Rundschreiben ergibt eine vollständige Mail mit Starthilfe-Link', () => {
  for (const r of RUNDSCHREIBEN) {
    const m = r.mail()
    assert.ok(m.subject.length > 10, `${r.kennung}: Betreff fehlt`)
    assert.ok(m.html.includes('<html'), `${r.kennung}: kein HTML`)
    assert.ok(m.text.length > 100, `${r.kennung}: Textfassung fehlt`)
    assert.ok(m.html.includes(STARTHILFE_URL), `${r.kennung}: kein Link zur Starthilfe`)
    assert.ok(r.titel.length > 5 && /^\d{4}-\d{2}-\d{2}$/.test(r.erstellt), `${r.kennung}: Titel/Datum unvollständig`)
  }
})

test('Merker und Suche', () => {
  assert.equal(merkerName('2026-09-neuigkeiten'), 'rundschreiben_2026-09-neuigkeiten')
  assert.equal(rundschreibenFinden('2026-09-neuigkeiten')?.kennung, '2026-09-neuigkeiten')
  assert.equal(rundschreibenFinden('gibt-es-nicht'), undefined)
})
