import { rechnungsMail } from '../src/lib/mail/vorlagen.ts'
import { writeFileSync } from 'node:fs'

// Sabrinas echter Fall, als Beispiel: Solo, 7 € netto.
const m = rechnungsMail({
  nummer: 'C1F2-0001',
  planName: 'Solo',
  nettoCent: 700,
  steuerCent: 133,
  gesamtCent: 833,
  vonSek: Math.floor(Date.UTC(2026, 8, 17) / 1000),
  bisSek: Math.floor(Date.UTC(2026, 9, 17) / 1000),
  rechnungUrl: 'https://invoice.stripe.com/i/beispiel',
  mitAnhang: true,
  firma: 'Schreinerei Beispiel',
})
writeFileSync('.tmp-cu/rechnungsmail.html', m.html)
console.log('Betreff:', m.subject)
