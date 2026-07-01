import { Angebotsposition, Kunde, FIRMA, calcAngebotspos, eur, today, inDays } from './types'

export function buildFooterTemplate(
  docTyp: string,
  docNr: string,
  firmaOpts: FirmaOpts = {},
  textOpts: PDFTextOpts = {}
): string {
  const firma = { ...FIRMA, ...Object.fromEntries(Object.entries(firmaOpts).filter(([, v]) => v)) } as typeof FIRMA & FirmaOpts
  const ftrLine2 = `USt-IdNr.: ${firma.ust}${textOpts.zeigeTelefon && firma.telefon ? ` | Tel.: ${firma.telefon}` : ''}`
  const ftrLine3 = `${firma.bank} | IBAN: ${firma.iban}${textOpts.zeigeBic && firma.bic ? ` | BIC: ${firma.bic}` : ''}`
  const ftrLine4 = textOpts.zeigeWebsite && firma.website ? ` | ${firma.website}` : ''
  return `<div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:9px;color:#999;width:100%;display:flex;justify-content:space-between;align-items:center;padding:5px 15mm 0;border-top:1px solid #ddd;box-sizing:border-box;">
    <span style="white-space:nowrap;flex-shrink:0;">${docTyp} ${docNr}</span>
    <span style="text-align:center;line-height:1.6;padding:0 8px;">${firma.name} – ${firma.inhaber} | ${firma.strasse} | ${firma.ort}<br>${ftrLine2}<br>${ftrLine3}${ftrLine4}</span>
    <span style="white-space:nowrap;flex-shrink:0;">Seite <span class="pageNumber"></span> / <span class="totalPages"></span></span>
  </div>`
}

export interface PDFTextOpts {
  anredeVorlage?: string
  nachtext?: string
  widerrufText?: string
  zahlungText?: string
  logoUrl?: string
  angebotsdatum?: string
  hinweis?: string
  zeigeBic?: boolean
  zeigeTelefon?: boolean
  zeigeWebsite?: boolean
  layout?: 'klassisch' | 'kompakt'
  zeigeMassivholz?: boolean
  massivholzText?: string
  zeigeUnterschrift?: boolean
  unterschriftText?: string
  // Wenn true: Header (Logo/Absender) und Footer werden ausgeblendet —
  // das eigene Briefpapier liefert den Rahmen, CraftFlow nur den Inhalt.
  eigeneBriefpapier?: boolean
  margins?: { top: number; bottom: number; left: number; right: number }
}

export interface FirmaOpts {
  name?: string
  inhaber?: string
  strasse?: string
  ort?: string
  email?: string
  ust?: string
  iban?: string
  bank?: string
  bic?: string
  telefon?: string
  website?: string
  akzentfarbe?: string
}

export function buildPDF(
  pos: Angebotsposition[],
  kunde: Kunde,
  docNr: string,
  docTyp: string,
  anschr: string,
  mitWiderruf: boolean,
  textOpts: PDFTextOpts = {},
  firmaOpts: FirmaOpts = {}
): string {
  const firma = { ...FIRMA, ...Object.fromEntries(Object.entries(firmaOpts).filter(([, v]) => v)) } as typeof FIRMA & FirmaOpts
  const { angebotsdatum: savedDatum, ...restOpts } = textOpts
  void restOpts
  const datumStr = savedDatum || today()
  const net = pos.reduce((s, p) => s + calcAngebotspos(p), 0)
  const vat = net * 0.19
  const gross = net + vat

  const accent = (firmaOpts.akzentfarbe || '#1a1a1a')
  const isKompakt = textOpts.layout === 'kompakt'
  const ownLetterhead = textOpts.eigeneBriefpapier === true

  const rows = pos.map((p, i) => {
    const g = calcAngebotspos(p)
    return `<tr class="pos-group">
      <td class="pos-nr">Pos.&nbsp;${i + 1}</td>
      <td class="pos-bez"><strong>${p.titel}</strong></td>
      <td class="pos-ges"></td>
    </tr>
    <tr>
      <td class="pos-nr">${i + 1}.001</td>
      <td class="pos-bez">
        <strong>${p.titel}</strong>
        ${p.beschreibung ? `<span class="bez-desc">${p.beschreibung}</span>` : ''}
      </td>
      <td class="pos-ges">${eur(g)}</td>
    </tr>`
  }).join('')

  const anredeText = (textOpts.anredeVorlage || 'Liebe/r {name},')
    .replace('{name}', kunde.name || 'Kundin / Kunde')

  const defaultWiderruf = `Sie haben das Recht, binnen 14 Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Um Ihr Widerrufsrecht auszuüben, wenden Sie sich an: ${firma.name} – ${firma.inhaber}, ${firma.strasse}, ${firma.ort}, E-Mail: ${firma.email}.`
  const widerrufBlock = mitWiderruf
    ? `<div class="widerruf">
        <strong>Widerrufsrecht</strong><br><br>
        ${textOpts.widerrufText || defaultWiderruf}
      </div>`
    : ''

  const hinweisBlock = textOpts.hinweis
    ? `<div class="hinweis">${textOpts.hinweis.replace(/\n/g, '<br>')}</div>`
    : ''

  const defaultZahlung = '50% Anzahlung nach Auftragserteilung, 50% nach Abnahme, zahlbar innerhalb von 7 Tagen netto.'
  const nachtextRaw = textOpts.nachtext || `Mit freundlichen Grüßen\n\n${firma.inhaber}\n${firma.name}`
  const nachtextHtml = nachtextRaw.replace(/\n/g, '<br>')

  const defaultMassivholz = 'Hinweis: Massivholz ist ein Naturprodukt. Farbliche und strukturelle Abweichungen zwischen einzelnen Teilen sind natürlich und kein Mangel.'
  const massivholzBlock = textOpts.zeigeMassivholz !== false
    ? `<div class="holz">${textOpts.massivholzText || defaultMassivholz}</div>`
    : ''

  const defaultUnterschrift = 'Wir freuen uns auf die Zusammenarbeit und bitten um Unterzeichnung und Rücksendung.'
  const signBlock = docTyp !== 'Rechnung' && textOpts.zeigeUnterschrift !== false
    ? `<div class="sign-block">
        <p class="sign-intro">${textOpts.unterschriftText || defaultUnterschrift}</p>
        <div class="sign-lines">
          <div class="sign-line">Ort | Datum</div>
          <div class="sign-line">Unterschrift Auftraggeber</div>
        </div>
      </div>`
    : ''

  const ftrLine2 = `USt-IdNr.: ${firma.ust}${textOpts.zeigeTelefon && firma.telefon ? ` | Tel.: ${firma.telefon}` : ''}`
  const ftrLine3 = `${firma.bank} | IBAN: ${firma.iban}${textOpts.zeigeBic && firma.bic ? ` | BIC: ${firma.bic}` : ''}`
  const ftrLine4 = textOpts.zeigeWebsite && firma.website ? `<br>${firma.website}` : ''

  const m = textOpts.margins
  // Benutzerdefinierte Margins gelten nur mit eigenem Briefpapier.
  // Ohne Briefpapier: feste Standardwerte, damit der fixed-positionierte
  // Header (top:-34mm) korrekt im @page-Randbereich landet.
  const pageMargin = ownLetterhead
    ? (m ? `${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm` : isKompakt ? '28mm 20mm 28mm 20mm' : '38mm 20mm 32mm 20mm')
    : (isKompakt ? '12mm 15mm 22mm 15mm' : '16mm 15mm 26mm 15mm')
  const baseFontSize = isKompakt ? '11px' : '12px'
  const pagePadding = ownLetterhead
    ? (isKompakt ? '10mm 20mm 16mm' : '14mm 20mm 20mm')
    : (isKompakt ? '10mm 15mm 16mm' : '14mm 15mm 20mm')

  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">
<title>${docTyp} ${docNr}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:${baseFontSize};color:#1a1a1a;line-height:1.5;background:#fff}

@page{size:A4;margin:${pageMargin}}
@media print{
  .ftr{display:none}
}
@media screen{
  body{background:#e8e8e8}
  .page{max-width:210mm;margin:0 auto;background:#fff;padding:${pagePadding};box-shadow:0 4px 24px rgba(0,0,0,.15)}
  .hdr{padding:6px 0 7px}
  .ftr{margin-top:28px}
}

.hdr{display:flex;justify-content:space-between;align-items:flex-end;padding-bottom:7px}
.hdr-sender{font-size:9px;color:#888;letter-spacing:.3px}
.hdr-logo{text-align:right}
.hdr-logo img{height:80px;width:auto;display:block;margin-left:auto}

.addr-meta{display:flex;justify-content:space-between;align-items:flex-start;margin:${isKompakt ? '16px 0 18px' : '24px 0 26px'}}
.addr{line-height:1.9}
.addr .name{font-weight:700;font-size:13px}
.addr .sub{font-size:12px;color:#333}
.meta-t{font-size:11px}
.meta-t td{padding:2px 0 2px 18px;color:#444;vertical-align:top}
.meta-t td:first-child{color:#888;font-size:10px;text-align:right}

.bau{font-size:11px;color:#555;font-style:italic;margin-bottom:5px}
.doc-nr{font-size:${isKompakt ? '14px' : '16px'};font-weight:700;margin-bottom:${isKompakt ? '6px' : '10px'}}
.intro{font-size:12px;margin-bottom:${isKompakt ? '16px' : '26px'};line-height:1.75;color:#222}

table.pos{width:100%;border-collapse:collapse}
table.pos thead th{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:${isKompakt ? '5px 6px' : '8px 6px'};border-top:1.5px solid ${accent};border-bottom:1.5px solid ${accent};white-space:nowrap}
table.pos thead th.r{text-align:right}
.pos-nr{width:46px;font-size:11px;color:#888;vertical-align:top;padding:${isKompakt ? '5px 6px' : '8px 6px'}}
.pos-bez{padding:${isKompakt ? '5px 6px' : '8px 6px'};vertical-align:top;border-bottom:1px solid #f0f0f0}
.pos-bez strong{display:block;font-size:13px;margin-bottom:2px}
.bez-desc{display:block;font-size:11px;color:#555;line-height:1.55;margin-top:2px}
.pos-ges{width:110px;text-align:right;font-weight:600;font-size:12px;vertical-align:top;padding:${isKompakt ? '5px 6px' : '8px 6px'};white-space:nowrap;border-bottom:1px solid #f0f0f0}
tr.pos-group .pos-nr{color:#1a1a1a;font-weight:700;padding-top:${isKompakt ? '10px' : '16px'};padding-bottom:2px}
tr.pos-group .pos-bez{border-bottom:none;padding-top:${isKompakt ? '10px' : '16px'};padding-bottom:2px}
tr.pos-group .pos-bez strong{font-size:12px}
tr.pos-group .pos-ges{border-bottom:none;padding-top:${isKompakt ? '10px' : '16px'};padding-bottom:2px}
.tab-end{border-top:1.5px solid ${accent}}

.sum-wrap{display:flex;justify-content:flex-end;margin:${isKompakt ? '10px 0 16px' : '16px 0 24px'}}
.sum-inner{width:272px}
.sr{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #eee;font-size:12px}
.st{display:flex;justify-content:space-between;padding:8px 0;font-weight:700;font-size:14px;border-top:2px solid ${accent};border-bottom:2px solid ${accent};margin-top:2px}

.holz{font-style:italic;font-size:10px;color:#666;margin-bottom:12px;line-height:1.6}
.zahlung{font-size:11px;font-weight:700;margin-bottom:16px}
.widerruf{font-size:10px;color:#555;line-height:1.6;margin-bottom:20px}
.hinweis{font-size:10px;color:#444;line-height:1.7;margin-bottom:20px;padding:10px 14px;background:#f8f8f8;border-left:3px solid ${accent}}
.sign-block{margin-top:${isKompakt ? '18px' : '28px'}}
.sign-intro{font-size:12px;margin-bottom:24px}
.sign-lines{display:flex;gap:40px;margin-top:32px}
.sign-line{flex:1;border-top:1px solid #555;padding-top:5px;font-size:11px;color:#555}
.gruss{font-size:12px;margin-top:32px;line-height:2.1}

.ftr{display:flex;justify-content:space-between;align-items:center;font-size:9px;color:#999;padding-top:5px;border-top:1px solid #ddd}
.ftr .pn{white-space:nowrap}
.ftr .ftr-mid{text-align:center;line-height:1.6}
</style>
</head><body>
<div class="page">

${ownLetterhead ? '' : `<div class="hdr">
  <div class="hdr-sender">${firma.name} | ${firma.strasse} | ${firma.ort}</div>
  <div class="hdr-logo">
    ${textOpts.logoUrl ? `<img src="${textOpts.logoUrl}" alt="Logo">` : ''}
  </div>
</div>`}

<div class="addr-meta">
  <div class="addr">
    <div class="name">${kunde.name || '–'}</div>
    ${kunde.strasse ? `<div class="sub">${kunde.strasse}</div>` : ''}
    ${kunde.ort ? `<div class="sub">${kunde.ort}</div>` : ''}
  </div>
  <table class="meta-t">
    <tr><td>${docTyp}-Nr.</td><td><strong>${docNr}</strong></td></tr>
    <tr><td>Datum</td><td>${datumStr}</td></tr>
    <tr><td>Ansprechpartner</td><td>${firma.inhaber}</td></tr>
    <tr><td>E-Mail</td><td>${firma.email}</td></tr>
    ${docTyp !== 'Rechnung' ? `<tr><td>Gültig bis</td><td>${savedDatum ? inDays(30, new Date(savedDatum.split('.').reverse().join('-'))) : inDays(30)}</td></tr>` : ''}
  </table>
</div>

<div class="bau">Bauvorhaben: ${kunde.projekt || '–'}</div>
<div class="doc-nr">${docTyp}-Nr. ${docNr}</div>
<div class="intro">${anredeText}<br><br>${anschr}</div>

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

${massivholzBlock}
<div class="zahlung">Zahlungskondition: ${textOpts.zahlungText || defaultZahlung}</div>
${widerrufBlock}
${hinweisBlock}
${signBlock}
<div class="gruss">${nachtextHtml}</div>

${ownLetterhead ? '' : `<div class="ftr">
  <span>${docTyp} ${docNr}</span>
  <span class="ftr-mid">${firma.name} – ${firma.inhaber} | ${firma.strasse} | ${firma.ort}<br>${ftrLine2}<br>${ftrLine3}${ftrLine4}</span>
  <span class="pn">Seite 1</span>
</div>`}

</div>
</body></html>`
}
