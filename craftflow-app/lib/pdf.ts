import { Angebotsposition, Kunde, FIRMA, eur, today, inDays } from './types'

function calcAngebotspos(p: Angebotsposition): number {
  const mat = p.material.reduce((sum, m) => sum + m.ekPreis * (1 + m.aufschlag) * m.menge, 0)
  const arb = p.arbeitszeit.reduce((sum, a) => sum + (a.minuten / 60) * a.vkStunde, 0)
  return mat + arb
}

export function buildPDF(
  pos: Angebotsposition[],
  kunde: Kunde,
  docNr: string,
  docTyp: string,
  anschr: string,
  mitWiderruf: boolean
): string {
  const totals = pos.reduce((a, p) => ({ net: a.net + calcAngebotspos(p) }), { net: 0 })
  const vat = totals.net * 0.19
  const gross = totals.net + vat

  const rows = pos
    .map((p, i) => {
      const gesamt = calcAngebotspos(p)
      return (
        `<tr style="background:${i % 2 ? '#fafafa' : '#fff'}">
          <td style="padding:6px 8px;font-size:11px;color:#888;vertical-align:top;border-bottom:1px solid #f0f0f0">${i + 1}</td>
          <td style="padding:6px 8px;vertical-align:top;border-bottom:1px solid #f0f0f0">
            <strong style="font-size:13px;display:block;margin-bottom:2px">${p.titel}</strong>
            <span style="font-size:11px;color:#666">${p.beschreibung}</span>
          </td>
          <td style="padding:6px 8px;text-align:right;font-size:12px;font-weight:bold;white-space:nowrap;vertical-align:top;border-bottom:1px solid #f0f0f0">${eur(gesamt)}</td>
        </tr>`
      )
    })
    .join('')

  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">
  <title>${docTyp} ${docNr}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#1a1a1a;background:#fff;padding:40px 48px;font-size:13px;line-height:1.6}
    .logo-area{text-align:right;margin-bottom:28px}
    .logo-name{font-size:12px;letter-spacing:2px;font-weight:700;margin-top:3px}
    .abs{font-size:10px;color:#888;margin-bottom:16px}
    .adr{font-size:13px;margin-bottom:28px}
    .meta{float:right;font-size:12px;margin-top:-64px}
    .meta td{padding:2px 0 2px 20px;color:#555}
    .meta td:first-child{color:#999;font-size:10px}
    .cf{clear:both}
    .proj{font-size:12px;color:#666;margin-bottom:4px}
    h1{font-size:16px;font-weight:700;margin-bottom:6px}
    table.pos{width:100%;border-collapse:collapse;margin-bottom:20px}
    table.pos thead tr{border-bottom:2px solid #1a1a1a}
    table.pos thead th{padding:8px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;text-align:left}
    table.pos thead th.r{text-align:right}
    .sum{display:flex;justify-content:flex-end;margin-bottom:20px}
    .si{width:240px;font-size:13px}
    .sr{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #eee}
    .st{display:flex;justify-content:space-between;font-weight:bold;font-size:14px;border-top:2px solid #1a1a1a;border-bottom:2px solid #1a1a1a;padding:7px 0;margin-top:2px}
    .footer{position:fixed;bottom:20px;left:48px;right:48px;border-top:1px solid #ddd;padding-top:6px;display:flex;justify-content:space-between;font-size:10px;color:#999}
    @media print{body{padding:20px 28px}@page{margin:0;size:A4}}
  </style></head><body>
  <div class="logo-area">
    <svg width="48" height="48" viewBox="0 0 100 100">
      <polygon points="50,4 94,27 94,73 50,96 6,73 6,27" fill="none" stroke="#1a1a1a" stroke-width="5"/>
      <text x="50" y="64" text-anchor="middle" font-family="Helvetica Neue" font-size="30" font-weight="800" fill="#1a1a1a">FS</text>
    </svg>
    <div class="logo-name">FS CRAFTED</div>
  </div>
  <div class="abs">${FIRMA.name} | ${FIRMA.strasse} | ${FIRMA.ort}</div>
  <div>
    <div class="adr">
      <strong>${kunde.name || '–'}</strong><br>
      ${kunde.zusatz ? kunde.zusatz + '<br>' : ''}
      ${kunde.strasse || ''}<br>
      ${kunde.ort || ''}
    </div>
    <table class="meta">
      <tr><td>Dokumentennummer</td><td><strong>${docNr}</strong></td></tr>
      <tr><td>Datum</td><td>${today()}</td></tr>
      <tr><td>Ansprechpartner</td><td>${FIRMA.inhaber}</td></tr>
      <tr><td>E-Mail</td><td>${FIRMA.email}</td></tr>
      ${docTyp !== 'Rechnung' ? `<tr><td>Gültig bis</td><td>${inDays(30)}</td></tr>` : ''}
    </table>
    <div class="cf"></div>
  </div>
  <div class="proj">Bauvorhaben: ${kunde.projekt || '–'}</div>
  <h1>${docTyp} Nr. ${docNr}</h1>
  <p style="font-size:13px;margin-bottom:20px">
    Liebe/r ${kunde.name || 'Kunde/Kundin'},<br><br>${anschr}
  </p>
  <table class="pos">
    <thead><tr>
      <th style="width:36px">Pos</th>
      <th>Bezeichnung</th>
      <th class="r" style="width:100px">Gesamt</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="sum"><div class="si">
    <div class="sr"><span>Nettobetrag</span><span>${eur(totals.net)}</span></div>
    <div class="sr"><span>zzgl. 19% MwSt.</span><span>${eur(vat)}</span></div>
    <div class="st"><span>Gesamtsumme</span><span>${eur(gross)}</span></div>
  </div></div>
  <div style="font-size:12px;color:#333;margin-bottom:14px">
    <strong>Zahlungskondition:</strong> 50% Anzahlung nach Auftragserteilung, 50% nach Abnahme innerhalb von 7 Tagen.
  </div>
  ${
    docTyp !== 'Rechnung'
      ? `<p style="font-size:13px;margin-bottom:20px">Wir freuen uns darauf, dieses Projekt umzusetzen und bitten um Unterzeichnung und Rücksendung.</p>
  <div style="margin-top:32px;padding-top:12px;border-top:1px solid #ccc;font-size:12px">
    Auftrag erteilt:<br><br><br>
    <div style="display:flex;gap:40px">
      <div style="flex:1;border-top:1px solid #333;padding-top:4px">Ort | Datum</div>
      <div style="flex:2;border-top:1px solid #333;padding-top:4px">Unterschrift Auftraggeber</div>
    </div>
  </div>`
      : ''
  }
  ${
    mitWiderruf
      ? `<div style="margin-top:28px;font-size:11px;color:#444;line-height:1.7">
    <strong>Widerrufsrecht</strong><br><br>
    Sie haben das Recht, binnen 14 Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.
    Um Ihr Widerrufsrecht auszuüben, wenden Sie sich an: ${FIRMA.name} – ${FIRMA.inhaber},
    ${FIRMA.strasse}, ${FIRMA.ort}, E-Mail: ${FIRMA.email}.
  </div>`
      : ''
  }
  <div class="footer">
    <span>${docTyp} ${docNr}</span>
    <span>${FIRMA.name} – ${FIRMA.inhaber} | ${FIRMA.strasse} | ${FIRMA.ort}</span>
    <span>USt-IdNr.: ${FIRMA.ust} | ${FIRMA.bank} | IBAN: ${FIRMA.iban}</span>
  </div>
  </body></html>`
}
