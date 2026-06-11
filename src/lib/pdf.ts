import { Angebotsposition, Kunde, FIRMA, calcAngebotspos, eur, today, inDays } from './types'

export function buildPDF(
  pos: Angebotsposition[],
  kunde: Kunde,
  docNr: string,
  docTyp: string,
  anschr: string,
  mitWiderruf: boolean
): string {
  const net = pos.reduce((s, p) => s + calcAngebotspos(p), 0)
  const vat = net * 0.19
  const gross = net + vat

  const rows = pos.map((p, i) => {
    const g = calcAngebotspos(p)
    return `<tr>
      <td class="pos-nr">${i + 1}</td>
      <td class="pos-bez">
        <strong>${p.titel}</strong>
        ${p.beschreibung ? `<span class="bez-desc">${p.beschreibung}</span>` : ''}
      </td>
      <td class="pos-ges">${eur(g)}</td>
    </tr>`
  }).join('')

  const widerrufBlock = mitWiderruf
    ? `<div class="widerruf">
        <strong>Widerrufsrecht</strong><br><br>
        Sie haben das Recht, binnen 14 Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.
        Um Ihr Widerrufsrecht auszuüben, wenden Sie sich an: ${FIRMA.name} – ${FIRMA.inhaber},
        ${FIRMA.strasse}, ${FIRMA.ort}, E-Mail: ${FIRMA.email}.
      </div>`
    : ''

  const signBlock = docTyp !== 'Rechnung'
    ? `<div class="sign-block">
        <p class="sign-intro">Wir freuen uns auf die Zusammenarbeit und bitten um Unterzeichnung und Rücksendung.</p>
        <div class="sign-lines">
          <div class="sign-line">Ort | Datum</div>
          <div class="sign-line">Unterschrift Auftraggeber</div>
        </div>
      </div>`
    : ''

  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">
<title>${docTyp} ${docNr}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:#1a1a1a;line-height:1.5;background:#fff}

@page{size:A4;margin:38mm 15mm 26mm 15mm}
@media print{
  .hdr{position:fixed;top:-34mm;left:0;right:0}
  .ftr{position:fixed;bottom:-22mm;left:0;right:0}
  .ftr .pn::after{content:"Seite " counter(page) " / " counter(pages)}
}
@media screen{
  body{background:#e8e8e8}
  .page{max-width:210mm;margin:0 auto;background:#fff;padding:14mm 15mm 20mm;box-shadow:0 4px 24px rgba(0,0,0,.15)}
  .hdr{padding:10mm 0 7px}
  .ftr{margin-top:28px}
}

.hdr{display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:7px}
.hdr-sender{font-size:9px;color:#888;letter-spacing:.3px}
.hdr-logo{text-align:right}
.hdr-logo img{height:80px;width:auto;display:block;margin-left:auto}

.addr-meta{display:flex;justify-content:space-between;align-items:flex-start;margin:24px 0 26px}
.addr{line-height:1.9}
.addr .name{font-weight:700;font-size:13px}
.addr .sub{font-size:12px;color:#333}
.meta-t{font-size:11px}
.meta-t td{padding:2px 0 2px 18px;color:#444;vertical-align:top}
.meta-t td:first-child{color:#888;font-size:10px;text-align:right}

.bau{font-size:11px;color:#555;font-style:italic;margin-bottom:5px}
.doc-nr{font-size:16px;font-weight:700;margin-bottom:10px}
.intro{font-size:12px;margin-bottom:26px;line-height:1.75;color:#222}

table.pos{width:100%;border-collapse:collapse}
table.pos thead th{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:8px 6px;border-top:1.5px solid #1a1a1a;border-bottom:1.5px solid #1a1a1a;white-space:nowrap}
table.pos thead th.r{text-align:right}
.pos-nr{width:36px;font-size:11px;color:#888;vertical-align:top;padding:10px 6px}
.pos-bez{padding:10px 6px;vertical-align:top;border-bottom:1px solid #f0f0f0}
.pos-bez strong{display:block;font-size:13px;margin-bottom:3px}
.bez-desc{display:block;font-size:11px;color:#666;line-height:1.5}
.pos-ges{width:110px;text-align:right;font-weight:600;font-size:12px;vertical-align:top;padding:10px 6px;white-space:nowrap;border-bottom:1px solid #f0f0f0}
.tab-end{border-top:1.5px solid #1a1a1a}

.sum-wrap{display:flex;justify-content:flex-end;margin:16px 0 24px}
.sum-inner{width:272px}
.sr{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #eee;font-size:12px}
.st{display:flex;justify-content:space-between;padding:8px 0;font-weight:700;font-size:14px;border-top:2px solid #1a1a1a;border-bottom:2px solid #1a1a1a;margin-top:2px}

.holz{font-style:italic;font-size:10px;color:#666;margin-bottom:12px;line-height:1.6}
.zahlung{font-size:11px;font-weight:700;margin-bottom:16px}
.widerruf{font-size:10px;color:#555;line-height:1.6;margin-bottom:20px}
.sign-block{margin-top:28px}
.sign-intro{font-size:12px;margin-bottom:24px}
.sign-lines{display:flex;gap:40px;margin-top:32px}
.sign-line{flex:1;border-top:1px solid #555;padding-top:5px;font-size:11px;color:#555}
.gruss{font-size:12px;margin-top:32px;line-height:2.1}

.ftr{display:flex;justify-content:space-between;align-items:center;font-size:9px;color:#999;padding-top:5px;border-top:1px solid #ddd}
.ftr .pn{white-space:nowrap}
</style>
</head><body>
<div class="page">

<div class="hdr">
  <div class="hdr-sender">${FIRMA.name} | ${FIRMA.strasse} | ${FIRMA.ort}</div>
  <div class="hdr-logo">
    <img src="/logo.png" alt="${FIRMA.name}">
  </div>
</div>

<div class="addr-meta">
  <div class="addr">
    <div class="name">${kunde.name || '–'}</div>
    ${kunde.strasse ? `<div class="sub">${kunde.strasse}</div>` : ''}
    ${kunde.ort ? `<div class="sub">${kunde.ort}</div>` : ''}
  </div>
  <table class="meta-t">
    <tr><td>${docTyp}-Nr.</td><td><strong>${docNr}</strong></td></tr>
    <tr><td>Datum</td><td>${today()}</td></tr>
    <tr><td>Ansprechpartner</td><td>${FIRMA.inhaber}</td></tr>
    <tr><td>E-Mail</td><td>${FIRMA.email}</td></tr>
    ${docTyp !== 'Rechnung' ? `<tr><td>Gültig bis</td><td>${inDays(30)}</td></tr>` : ''}
  </table>
</div>

<div class="bau">Bauvorhaben: ${kunde.projekt || '–'}</div>
<div class="doc-nr">${docTyp}-Nr. ${docNr}</div>
<div class="intro">Liebe/r ${kunde.name || 'Kundin / Kunde'},<br><br>${anschr}</div>

<table class="pos">
  <thead><tr>
    <th>Pos</th>
    <th>Bezeichnung</th>
    <th class="r">Gesamt</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="tab-end"></div>

<div class="sum-wrap"><div class="sum-inner">
  <div class="sr"><span>Nettobetrag</span><span>${eur(net)}</span></div>
  <div class="sr"><span>zzgl. 19% MwSt.</span><span>${eur(vat)}</span></div>
  <div class="st"><span>Gesamtsumme</span><span>${eur(gross)}</span></div>
</div></div>

<div class="holz">Hinweis: Massivholz ist ein Naturprodukt. Farbliche und strukturelle Abweichungen zwischen einzelnen Teilen sind natürlich und kein Mangel.</div>
<div class="zahlung">Zahlungskondition: 50% Anzahlung nach Auftragserteilung, 50% nach Abnahme, zahlbar innerhalb von 7 Tagen netto.</div>
${widerrufBlock}
${signBlock}
<div class="gruss">Mit freundlichen Grüßen<br><br>${FIRMA.inhaber}<br>${FIRMA.name}</div>

<div class="ftr">
  <span>${docTyp} ${docNr}</span>
  <span>${FIRMA.name} – ${FIRMA.inhaber} | ${FIRMA.strasse} | ${FIRMA.ort} | USt-IdNr.: ${FIRMA.ust} | ${FIRMA.bank} | IBAN: ${FIRMA.iban}</span>
  <span class="pn">Seite 1</span>
</div>

</div>
</body></html>`
}
