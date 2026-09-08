import { Angebotsposition, Kunde, FIRMA, calcAngebotspos, nettoSumme, eur, today, inDays } from './types'
import { alsAbsaetze, fontFaces, SCHRIFTEN, anredeAus, positionsBloecke, unterNummer, type SchriftId } from './pdftext'
export { alsAbsaetze, SCHRIFTEN, type SchriftId } from './pdftext'

export function buildFooterTemplate(
  docTyp: string,
  docNr: string,
  firmaOpts: FirmaOpts = {},
  textOpts: PDFTextOpts = {}
): string {
  const firma = { ...FIRMA, ...Object.fromEntries(Object.entries(firmaOpts).filter(([, v]) => v)) } as typeof FIRMA & FirmaOpts
  // § 14 UStG: Steuernummer ODER USt-IdNr. Wer keine USt-IdNr. hat, muss die
  // Steuernummer nennen — sonst fehlt eine Pflichtangabe.
  const steuerId = firma.ust
    ? `USt-IdNr.: ${firma.ust}`
    : (firma.steuernummer ? `Steuernummer: ${firma.steuernummer}` : '')
  const ftrLine2 = `${steuerId}${steuerId && textOpts.zeigeTelefon && firma.telefon ? ' | ' : ''}${textOpts.zeigeTelefon && firma.telefon ? `Tel.: ${firma.telefon}` : ''}`
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
  /** Schriftart des Dokuments. Wird mitgeliefert, siehe SCHRIFTEN oben. */
  schriftart?: SchriftId
  /**
   * Woher die Schriftdateien geladen werden — im Browser window.location.origin,
   * auf dem Server die Adresse der eigenen Bereitstellung. Ohne diese Angabe bleibt
   * es bei der Systemschrift.
   */
  basisUrl?: string
  /**
   * Umsatzsteuersatz in Prozent. Stand bis 2026-09-08 mit 19 FEST im Code — fuer
   * jeden, der einen anderen Satz braucht, war das Dokument schlicht falsch.
   */
  mwstSatz?: number
  /**
   * Kleinunternehmer nach § 19 UStG: Es wird KEINE Umsatzsteuer ausgewiesen, dafuer
   * der vorgeschriebene Hinweis. Ohne diesen Schalter erzeugte CraftFlow fuer einen
   * ganzen Teil seiner Zielgruppe ein formal falsches Angebot.
   */
  kleinunternehmer?: boolean
  /** Bindefrist in Tagen. Vorher fest 30. */
  gueltigTage?: number
  /** Eigene Textbausteine, unter den Positionen. */
  bausteine?: Array<{ titel?: string; inhalt: string }>
  /** Spalte "Menge" in der Positionstabelle zeigen. */
  zeigeMenge?: boolean
  /**
   * Spalte "Einheitspreis" zeigen. Manche Betriebe wollen bewusst nur Endsummen
   * ausweisen, um nicht ueber Einzelpreise verhandeln zu muessen — andere brauchen
   * sie fuer die Nachvollziehbarkeit. Deshalb eine Einstellung, keine Vorgabe.
   */
  zeigeEinheitspreis?: boolean
}

export interface FirmaOpts {
  name?: string
  /**
   * Steuernummer. § 14 UStG verlangt ENTWEDER Steuernummer ODER USt-IdNr. — wer
   * keine USt-IdNr. hat (Kleinunternehmer), braucht diese hier. Sie wurde in den
   * Einstellungen abgefragt und bis 2026-09-08 nirgends gedruckt.
   */
  steuernummer?: string
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
  // Bindefrist: war fest 30 Tage, obwohl jeder Betrieb eine eigene hat.
  const gueltigTage = Number.isFinite(textOpts.gueltigTage) && Number(textOpts.gueltigTage) > 0
    ? Number(textOpts.gueltigTage) : 30
  const net = nettoSumme(pos)
  const klein = textOpts.kleinunternehmer === true
  const satz = klein ? 0 : (Number.isFinite(textOpts.mwstSatz) ? Number(textOpts.mwstSatz) : 19)
  const vat = net * (satz / 100)
  const gross = net + vat

  // 19, 7 oder 19,5 — ohne unnoetige Nullen.
  const satzText = String(satz).replace('.', ',')
  const accent = (firmaOpts.akzentfarbe || '#1a1a1a')
  const isKompakt = textOpts.layout === 'kompakt'
  const schrift = SCHRIFTEN[textOpts.schriftart ?? 'opensans'] ?? SCHRIFTEN.opensans
  const schriftBlock = fontFaces(textOpts.schriftart ?? 'opensans', textOpts.basisUrl ?? '')
  const ownLetterhead = textOpts.eigeneBriefpapier === true

  const zeigeMenge = textOpts.zeigeMenge === true
  const zeigeEP = textOpts.zeigeEinheitspreis === true

  // Aufeinanderfolgende Positionen mit derselben Gruppe bilden EINEN Block mit
  // gemeinsamer Kopfzeile — so wie im Referenzangebot "Pos. 1  Flurschrank" mit
  // 1.001 Korpusse, 1.002 Beleuchtung, 1.003 Tueren darunter.
  //
  // GEFUNDEN AM 2026-09-08 durch Constantin Ludewigt: "Die Positionsueberschriften
  // werden immer 2-mal aufgezaehlt." Er hatte recht — der Titel stand hart in BEIDEN
  // Zeilen, in der Gruppen- und in der Detailzeile. Ohne Gruppe gibt es jetzt gar
  // keine Kopfzeile mehr, mit Gruppe traegt sie den Gruppennamen.
  const bloecke = positionsBloecke(pos)

  const zeile = (nrText: string, p: Angebotsposition) => {
    const g = calcAngebotspos(p)
    const n = Math.max(1, Math.round(Number(p.stueckzahl ?? 1)) || 1)
    const zusatz = p.alternativ ? ' (Alternative Position)' : ''
    // Alternativen tragen ihren Preis in Klammern und stehen nicht in der Summe.
    const betrag = p.alternativ ? `(${eur(g)})` : eur(g)
    return `<tr>
      <td class="pos-nr">${nrText}</td>
      ${zeigeMenge ? `<td class="pos-menge">${n} Stk</td>` : ''}
      <td class="pos-bez">
        <strong>${p.titel}${zusatz}</strong>
        ${p.beschreibung ? `<div class="bez-desc">${alsAbsaetze(p.beschreibung)}</div>` : ''}
      </td>
      ${zeigeEP ? `<td class="pos-ep">${eur(g / n)}</td>` : ''}
      <td class="pos-ges">${betrag}</td>
    </tr>`
  }

  const leerZellen = `${zeigeEP ? '<td class="pos-ep"></td>' : ''}<td class="pos-ges"></td>`

  const rows = bloecke.map((b, bi) => {
    const nr = bi + 1
    if (!b.gruppe) return zeile(`Pos.&nbsp;${nr}`, b.teile[0])
    const kopf = `<tr class="pos-group">
      <td class="pos-nr">Pos.&nbsp;${nr}</td>
      ${zeigeMenge ? '<td class="pos-menge"></td>' : ''}
      <td class="pos-bez"><strong>${b.gruppe}</strong></td>
      ${leerZellen}
    </tr>`
    return kopf + b.teile.map((p, ti) => zeile(unterNummer(nr, ti + 1), p)).join('')
  }).join('')

  const anredeText = alsAbsaetze(anredeAus(textOpts.anredeVorlage ?? '', kunde))

  const defaultWiderruf = `Sie haben das Recht, binnen 14 Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Um Ihr Widerrufsrecht auszuüben, wenden Sie sich an: ${firma.name} – ${firma.inhaber}, ${firma.strasse}, ${firma.ort}, E-Mail: ${firma.email}.`
  const widerrufBlock = mitWiderruf
    ? `<div class="widerruf">
        <strong>Widerrufsrecht</strong>
        ${alsAbsaetze(textOpts.widerrufText || defaultWiderruf)}
      </div>`
    : ''

  const hinweisBlock = textOpts.hinweis
    ? `<div class="hinweis">${alsAbsaetze(textOpts.hinweis)}</div>`
    : ''

  const defaultZahlung = '50% Anzahlung nach Auftragserteilung, 50% nach Abnahme, zahlbar innerhalb von 7 Tagen netto.'
  const nachtextRaw = textOpts.nachtext || `Mit freundlichen Grüßen\n\n${firma.inhaber}\n${firma.name}`
  const nachtextHtml = alsAbsaetze(nachtextRaw)

  const defaultMassivholz = 'Hinweis: Massivholz ist ein Naturprodukt. Farbliche und strukturelle Abweichungen zwischen einzelnen Teilen sind natürlich und kein Mangel.'
  const massivholzBlock = textOpts.zeigeMassivholz !== false
    ? `<div class="holz">${alsAbsaetze(textOpts.massivholzText || defaultMassivholz)}</div>`
    : ''

  // Eigene Textbausteine des Betriebs — Materialpreisvorbehalt, Ausfuehrungszeitraum,
  // Entsorgung, was auch immer er braucht. Stehen unter den festen Bloecken.
  const bausteinBlock = (textOpts.bausteine ?? [])
    .filter(b => b && String(b.inhalt ?? '').trim())
    .map(b => `<div class="baustein">${b.titel ? `<strong>${b.titel}</strong>` : ''}${alsAbsaetze(b.inhalt)}</div>`)
    .join('')

  const defaultUnterschrift = 'Wir freuen uns auf die Zusammenarbeit und bitten um Unterzeichnung und Rücksendung.'
  const signBlock = docTyp !== 'Rechnung' && textOpts.zeigeUnterschrift !== false
    ? `<div class="sign-block">
        <div class="sign-intro">${alsAbsaetze(textOpts.unterschriftText || defaultUnterschrift)}</div>
        <div class="sign-lines">
          <div class="sign-line">Ort | Datum</div>
          <div class="sign-line">Unterschrift Auftraggeber</div>
        </div>
      </div>`
    : ''

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
${schriftBlock}
body{font-family:${schrift.stapel};font-size:${baseFontSize};color:#1a1a1a;line-height:1.5;background:#fff}

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
.hdr-logo{text-align:right;max-width:45%;flex-shrink:0}
/* GEFUNDEN AM 2026-09-08 durch Constantin Ludewigt: "Das Logo wird auf der pdf am
   rechten seitlichen Rand abgeschnitten." Vorher stand hier nur height:80px und
   width:auto — ein Logo im Querformat wurde dadurch beliebig breit und lief aus der
   Seite. max-width begrenzt es, object-fit haelt die Proportion. */
.hdr-logo img{max-height:80px;max-width:100%;width:auto;height:auto;object-fit:contain;display:block;margin-left:auto}

.addr-meta{display:flex;justify-content:space-between;align-items:flex-start;margin:${isKompakt ? '16px 0 18px' : '24px 0 26px'}}
.addr{line-height:1.9}
.addr .name{font-weight:700;font-size:13px}
.addr .sub{font-size:12px;color:#333}
.meta-t{font-size:11px}
.meta-t td{padding:2px 0 2px 18px;color:#444;vertical-align:top}
.meta-t td:first-child{color:#888;font-size:10px;text-align:right}

.bau{font-size:11px;color:#555;font-style:italic;margin-bottom:5px}
.doc-nr{font-size:${isKompakt ? '14px' : '16px'};font-weight:700;margin-bottom:${isKompakt ? '6px' : '10px'}}
/* Absaetze: Abstand ZWISCHEN den Absaetzen, nicht davor und dahinter. Sonst
   verschiebt sich der ganze Block gegenueber dem Rest der Seite. */
.intro{font-size:12px;margin-bottom:${isKompakt ? '16px' : '26px'};line-height:1.75;color:#222}
.intro p{margin:0 0 ${isKompakt ? '8px' : '11px'}}
.intro p:last-child{margin-bottom:0}
.holz p, .widerruf p, .hinweis p, .zahlung p, .sign-intro p, .gruss p, .bez-desc p{margin:0 0 6px}
.holz p:last-child, .widerruf p:last-child, .hinweis p:last-child, .zahlung p:last-child,
.sign-intro p:last-child, .gruss p:last-child, .bez-desc p:last-child{margin-bottom:0}
.zahlung p{display:inline}

table.pos{width:100%;border-collapse:collapse}
table.pos thead th{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:${isKompakt ? '5px 6px' : '8px 6px'};border-top:1.5px solid ${accent};border-bottom:1.5px solid ${accent};white-space:nowrap}
table.pos thead th.r{text-align:right}
.pos-nr{width:46px;font-size:11px;color:#888;vertical-align:top;padding:${isKompakt ? '5px 6px' : '8px 6px'}}
.pos-bez{padding:${isKompakt ? '5px 6px' : '8px 6px'};vertical-align:top;border-bottom:1px solid #f0f0f0}
.pos-bez strong{display:block;font-size:13px;margin-bottom:2px}
.bez-desc{display:block;font-size:11px;color:#555;line-height:1.55;margin-top:2px}
.pos-ges{width:110px;text-align:right;font-weight:600;font-size:12px;vertical-align:top;padding:${isKompakt ? '5px 6px' : '8px 6px'};white-space:nowrap;border-bottom:1px solid #f0f0f0}
.pos-menge{width:62px;text-align:right;font-size:11px;color:#555;vertical-align:top;padding:${isKompakt ? '5px 6px' : '8px 6px'};white-space:nowrap;border-bottom:1px solid #f0f0f0}
.pos-ep{width:96px;text-align:right;font-size:11px;color:#555;vertical-align:top;padding:${isKompakt ? '5px 6px' : '8px 6px'};white-space:nowrap;border-bottom:1px solid #f0f0f0}
tr.pos-group .pos-menge, tr.pos-group .pos-ep{border-bottom:none;padding-top:${isKompakt ? '10px' : '16px'};padding-bottom:2px}
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
.baustein{font-size:10.5px;color:#444;line-height:1.7;margin-bottom:14px;break-inside:avoid;page-break-inside:avoid}
.baustein strong{display:block;margin-bottom:3px;color:#1a1a1a}
.baustein p{margin:0 0 5px}
.baustein p:last-child{margin-bottom:0}
.klein-hinweis{font-size:10.5px;color:#444;text-align:right;margin:-8px 0 18px}
/* Zusammengehoerendes nicht auseinanderreissen. Ein Unterschriftsblock, dessen
   Linien allein auf der naechsten Seite stehen, sieht nach Fehler aus — und eine
   Position, die mitten in der Beschreibung umbricht, liest sich schlecht.
   Ergaenzt am 2026-09-08 zusammen mit den uebrigen Formatfehlern. */
.sign-block{margin-top:${isKompakt ? '18px' : '28px'};break-inside:avoid;page-break-inside:avoid}
.sum-wrap,.widerruf,.hinweis,.holz,.zahlung,.gruss{break-inside:avoid;page-break-inside:avoid}
table.pos tr{break-inside:avoid;page-break-inside:avoid}
table.pos thead{display:table-header-group}
tr.pos-group{break-after:avoid;page-break-after:avoid}
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
    ${docTyp !== 'Rechnung' ? `<tr><td>Gültig bis</td><td>${savedDatum ? inDays(gueltigTage, new Date(savedDatum.split('.').reverse().join('-'))) : inDays(gueltigTage)}</td></tr>` : ''}
  </table>
</div>

<div class="bau">Bauvorhaben: ${kunde.projekt || '–'}</div>
<div class="doc-nr">${docTyp}-Nr. ${docNr}</div>
<div class="intro">${anredeText}${alsAbsaetze(anschr)}</div>

<table class="pos">
  <thead><tr>
    <th>Pos</th>
    ${zeigeMenge ? '<th class="r">Menge</th>' : ''}
    <th>Bezeichnung</th>
    ${zeigeEP ? '<th class="r">Einheitspreis</th>' : ''}
    <th class="r">Gesamt</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="tab-end"></div>

<div class="sum-wrap"><div class="sum-inner">
  ${klein ? '' : `<div class="sr"><span>Nettobetrag</span><span>${eur(net)}</span></div>
  <div class="sr"><span>zzgl. ${satzText}% MwSt.</span><span>${eur(vat)}</span></div>`}
  <div class="st"><span>Gesamtsumme</span><span>${eur(gross)}</span></div>
</div></div>
${klein ? '<div class="klein-hinweis">Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.</div>' : ''}

${massivholzBlock}
<div class="zahlung"><strong>Zahlungskondition:</strong> ${alsAbsaetze(textOpts.zahlungText || defaultZahlung)}</div>
${widerrufBlock}
${hinweisBlock}
${bausteinBlock}
${signBlock}
<div class="gruss">${nachtextHtml}</div>


</div>
</body></html>`
}
