// Betriebsprofil → PDF-Optionen. EINE Zuordnung für alle Aufrufer.
//
// GEFUNDEN AM 2026-09-08: Die Vorschau in den Einstellungen und die echte
// Angebotserstellung bauten diese Optionen JEDE FÜR SICH zusammen. Ergebnis: Drei
// neue Einstellungen (Kleinunternehmer, Gültigkeitsdauer, Textbausteine) wirkten im
// Angebot, aber nicht in der Vorschau — die also etwas anderes zeigte als das
// Dokument. Genau das, was die Vorschau verhindern sollte.
//
// Wer eine Einstellung ergänzt, ergänzt sie hier. Sonst nirgends.

import type { PDFTextOpts, FirmaOpts, SchriftId } from './pdf'

/** Rohes Betriebsprofil, wie es aus /api/settings/betriebsprofil kommt. */
export type Profilwerte = Record<string, unknown>

const text = (p: Profilwerte, k: string) => {
  const v = p[k]
  return v === null || v === undefined ? '' : String(v)
}
const ja = (p: Profilwerte, k: string) => p[k] === true || p[k] === 'true'
const zahl = (p: Profilwerte, k: string, standard: number) => {
  const n = Number(p[k])
  return Number.isFinite(n) && n > 0 ? n : standard
}

export type Zusatz = {
  /** window.location.origin — ohne das bleibt es bei der Systemschrift. */
  basisUrl?: string
  /** Ausgewählte Textbausteine dieses Angebots. */
  bausteine?: Array<{ titel?: string; inhalt: string }>
  /** Angebotsdatum, falls schon gespeichert. */
  angebotsdatum?: string
}

export function pdfTextOptionen(p: Profilwerte, zusatz: Zusatz = {}): PDFTextOpts {
  const eigenes = ja(p, 'pdf_eigenes_briefpapier') && !!text(p, 'pdf_briefpapier_url')
  return {
    anredeVorlage: text(p, 'anrede_vorlage') || undefined,
    nachtext: text(p, 'angebot_abschluss') || undefined,
    widerrufText: text(p, 'widerrufsbelehrung_text') || undefined,
    zahlungText: text(p, 'zahlungskonditionen_text') || undefined,
    hinweis: text(p, 'pdf_hinweis') || undefined,
    logoUrl: text(p, 'logo_url') || undefined,
    angebotsdatum: zusatz.angebotsdatum,
    layout: text(p, 'pdf_layout') === 'kompakt' ? 'kompakt' : 'klassisch',
    schriftart: (text(p, 'pdf_schriftart') || 'opensans') as SchriftId,
    basisUrl: zusatz.basisUrl,
    // Steuer: bis 2026-09-08 standen 19 % fest im Code. Fuer Kleinunternehmer nach
    // § 19 UStG war das Dokument damit formal falsch.
    mwstSatz: zahl(p, 'mwst_satz', 19),
    kleinunternehmer: ja(p, 'kleinunternehmer'),
    gueltigTage: zahl(p, 'angebot_gueltig_tage', 30),
    bausteine: zusatz.bausteine ?? [],
    zeigeMenge: ja(p, 'pdf_zeige_menge'),
    zeigeEinheitspreis: ja(p, 'pdf_zeige_einheitspreis'),
    zeigeMassivholz: text(p, 'pdf_zeige_massivholz') !== 'false',
    massivholzText: text(p, 'pdf_massivholz_text') || undefined,
    zeigeUnterschrift: text(p, 'pdf_zeige_unterschrift') !== 'false',
    unterschriftText: text(p, 'pdf_unterschrift_text') || undefined,
    zeigeBic: ja(p, 'pdf_zeige_bic'),
    zeigeTelefon: ja(p, 'pdf_zeige_telefon'),
    zeigeWebsite: ja(p, 'pdf_zeige_website'),
    eigeneBriefpapier: eigenes,
    margins: eigenes ? {
      top: zahl(p, 'pdf_margin_top', 45),
      bottom: zahl(p, 'pdf_margin_bottom', 30),
      left: zahl(p, 'pdf_margin_left', 20),
      right: zahl(p, 'pdf_margin_right', 20),
    } : undefined,
  }
}

export function pdfFirmaOptionen(p: Profilwerte): FirmaOpts {
  return {
    name: text(p, 'firma_name') || undefined,
    inhaber: text(p, 'inhaber') || undefined,
    strasse: text(p, 'strasse') || undefined,
    ort: [text(p, 'plz'), text(p, 'ort')].filter(Boolean).join(' ') || undefined,
    email: text(p, 'email') || undefined,
    ust: text(p, 'ust_id') || undefined,
    // § 14 UStG: Steuernummer ODER USt-IdNr. Wurde abgefragt und nie gedruckt.
    steuernummer: text(p, 'steuernummer') || undefined,
    iban: text(p, 'iban') || undefined,
    bank: text(p, 'bank_name') || undefined,
    bic: text(p, 'bic') || undefined,
    telefon: text(p, 'telefon') || undefined,
    website: text(p, 'website') || undefined,
    akzentfarbe: text(p, 'farbe_akzent') || undefined,
  }
}
