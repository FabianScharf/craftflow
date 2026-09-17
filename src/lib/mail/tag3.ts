// Die Tag-3-Mail: drei Tage nach der Registrierung eine persönliche Nachfrage von
// Fabian — ob alles läuft, was sich lohnt, und wie man ihn direkt erreicht.
//
// Fabian 2026-09-17: „Höflich, persönlich und nicht einfach ein Verkaufstext. Sondern
// ehrlich nachfragen ob alles funktioniert … damit die Nutzer nicht in der Testphase
// abspringen.“ Entwurf abgenommen („Die Mail gefällt mir. Können wir so einrichten.“).
//
// Importiert bewusst nichts (Tests führen die Datei direkt aus). Die Gestaltung ist
// bewusst NICHT aus vorlagen.ts geteilt: diese Mail hat ein Portrait, einen grünen
// WhatsApp-Knopf und eine nummerierte Tippliste — eigene Bausteine, alles inline.

export type Mail = { subject: string; html: string; text: string }

/** Konten, die VOR diesem Zeitpunkt entstanden sind, bekommen die Mail nie (Bestand). */
export const TAG3_AB = '2026-09-14T00:00:00Z'
/** Frühestens drei Tage nach der Registrierung … */
export const TAG3_MINDEST_TAGE = 3
/** … und spätestens nach 14 Tagen — danach ist die Testphase vorbei, die Frage passt nicht mehr. */
export const TAG3_HOECHST_TAGE = 14
export const TAG3_MERKER = 'tag3_mail_am'

export const WHATSAPP_NUMMER = '491604416822'
export const TELEFON_ANZEIGE = '+49 160 4416822'
export const PORTRAIT_URL = 'https://www.getcraftflow.de/fabian.jpg'
export const KONTAKT_MAIL = 'fabian@fscrafted.de'

export type Konto = {
  created_at: string
  email_confirmed_at?: string | null
  email?: string | null
  meta?: Record<string, unknown> | null
}

/**
 * Ist dieses Konto heute dran? Reine Funktion, damit der Test jede Regel einzeln
 * prüfen kann. `mindestTage` darf der Admin auf 0 setzen (Sofortversand).
 */
export function tag3Faellig(k: Konto, jetzt: Date, mindestTage = TAG3_MINDEST_TAGE): { faellig: boolean; grund: string } {
  if (!k.email) return { faellig: false, grund: 'keine E-Mail' }
  if (!k.email_confirmed_at) return { faellig: false, grund: 'E-Mail nicht bestätigt' }
  if (k.meta && k.meta[TAG3_MERKER]) return { faellig: false, grund: 'bereits gesendet' }
  const angelegt = new Date(k.created_at)
  if (Number.isNaN(angelegt.getTime())) return { faellig: false, grund: 'Datum unlesbar' }
  if (angelegt < new Date(TAG3_AB)) return { faellig: false, grund: 'Bestandskonto' }
  const tage = (jetzt.getTime() - angelegt.getTime()) / 86_400_000
  if (tage < mindestTage) return { faellig: false, grund: `erst ${tage.toFixed(1)} Tage alt` }
  if (tage > TAG3_HOECHST_TAGE) return { faellig: false, grund: 'Testphase vorbei' }
  return { faellig: true, grund: 'fällig' }
}

/** Vorname aus dem Inhaberfeld („Max Mustermann“ → „Max“); leer, wenn nichts Brauchbares da ist. */
export function vornameAus(inhaber?: string | null): string {
  const w = (inhaber ?? '').trim().split(/\s+/)[0] ?? ''
  return /^[A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß\-]{1,}$/.test(w) ? w : ''
}

// ── Gestaltung (inline, wie in vorlagen.ts begründet: Mail-Programme ignorieren CSS-Dateien) ──
const F = 'Helvetica Neue, Helvetica, Arial, sans-serif'
const SERIF = 'Georgia, "Times New Roman", serif'
const KUPFER = '#B87333'
const INK = '#1A1714'
const TEXT = '#2F2A25'
const GRAU = '#6B6259'
const LINIE = '#E6DDD1'
const TIPP_GRUND = '#FBF7F1'
const WA = '#25A244'

const TIPPS: Array<{ titel: string; text: string; pfad: string }> = [
  { titel: 'Mein Betrieb einrichten', text: 'Fünf Fragen in den Einstellungen, danach rechnet CraftFlow mit deinen Zeiten statt mit Standardwerten.', pfad: 'Einstellungen → Mein Betrieb · etwa 10 Minuten' },
  { titel: 'KI-Optimierung laufen lassen', text: 'Angebot rechnen, dann oben auf „KI-Optimierung“: CraftFlow prüft Zeiten, Material und Lücken und schlägt Verbesserungen vor.', pfad: 'Kalkulation → KI-Optimierung' },
  { titel: 'Materialpreise hinterlegen', text: 'Deine Einkaufspreise einmal eintragen, dann stimmen sie in jedem Angebot.', pfad: 'Einstellungen → Materialpreise' },
  { titel: 'Textbausteine und Briefpapier', text: 'Dein Angebot sieht aus wie deins, mit Logo, Farben und deinen Formulierungen, nicht wie ein Formular.', pfad: 'Einstellungen → Textbausteine · Briefpapier' },
]

function tippZeile(nr: number, t: { titel: string; text: string; pfad: string }): string {
  return `<tr>
  <td valign="top" width="34" style="padding:12px 0;border-top:1px solid ${LINIE};font-family:${SERIF};font-size:22px;line-height:1.1;color:${KUPFER};">${nr}</td>
  <td valign="top" style="padding:12px 0 12px 8px;border-top:1px solid ${LINIE};font-family:${F};font-size:15px;line-height:1.5;color:${TEXT};">
    <strong style="color:${INK};">${t.titel}</strong><br>${t.text}<br><span style="font-size:13px;color:${GRAU};">${t.pfad}</span>
  </td></tr>`
}

export function tag3Mail(opts: { inhaber?: string | null; firma?: string | null } = {}): Mail {
  const vorname = vornameAus(opts.inhaber)
  const gruss = vorname ? `Hallo ${vorname}, läuft alles?` : 'Hallo, läuft alles?'
  const subject = vorname ? `Wie läuft es mit CraftFlow, ${vorname}?` : 'Wie läuft es mit CraftFlow?'
  const waText = encodeURIComponent('Hallo Fabian, ich teste gerade CraftFlow und habe eine Frage: ')
  const waUrl = `https://wa.me/${WHATSAPP_NUMMER}?text=${waText}`
  const mailUrl = `mailto:${KONTAKT_MAIL}?subject=${encodeURIComponent('Frage zu CraftFlow')}`
  const vorschau = 'Drei Tage CraftFlow: Funktioniert alles? Ich frage ehrlich nach — und zeige dir, was sich am meisten lohnt.'

  const html = `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CraftFlow</title></head>
<body style="margin:0;padding:0;background:#F1ECE4;">
<span style="display:none;font-size:1px;color:#F1ECE4;max-height:0;overflow:hidden;">${vorschau}</span>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F1ECE4;">
<tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#FFFFFF;border-radius:12px;overflow:hidden;">
  <tr><td style="height:6px;background:${KUPFER};font-size:0;line-height:0;">&nbsp;</td></tr>
  <tr><td style="padding:22px 36px 0;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
      <td style="font-family:${F};font-size:15px;font-weight:700;letter-spacing:4px;color:${INK};">CRAFT<span style="color:${KUPFER};">FLOW</span></td>
      <td align="right" style="font-family:${F};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${GRAU};">Tag 3 deiner Testphase</td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:28px 36px 6px;">
    <table role="presentation" cellspacing="0" cellpadding="0"><tr>
      <td valign="middle" width="112" style="padding-right:22px;"><img src="${PORTRAIT_URL}" width="100" height="100" alt="Fabian Scharf, Schreinermeister" style="display:block;width:100px;height:100px;border-radius:50px;border:3px solid ${LINIE};object-fit:cover;"></td>
      <td valign="middle">
        <h1 style="margin:0 0 6px;font-family:${SERIF};font-size:28px;line-height:1.15;font-weight:600;color:${INK};">${gruss}</h1>
        <p style="margin:0;font-family:${F};font-size:15px;color:${GRAU};">Ein paar ehrliche Zeilen vom Schreinermeister hinter CraftFlow.</p>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:14px 36px 6px;font-family:${F};font-size:16px;line-height:1.55;color:${TEXT};">
    <p style="margin:0 0 16px;">Du bist seit drei Tagen bei CraftFlow. Ich wollte kurz nachfragen: Funktioniert alles? Ist etwas unklar oder umständlich? Ich baue CraftFlow selbst, in der Werkstatt und am Schreibtisch, und jede Rückmeldung hilft mir mehr als jede Statistik.</p>
    <p style="margin:0 0 6px;">Falls du noch nicht alles ausprobiert hast: Das hier bringt am meisten, in dieser Reihenfolge.</p>
  </td></tr>
  <tr><td style="padding:8px 36px 10px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${TIPP_GRUND};border:1px solid ${LINIE};border-radius:10px;"><tr><td style="padding:16px 22px 6px;">
      <h2 style="margin:0 0 10px;font-family:${SERIF};font-size:19px;font-weight:600;color:${INK};">Vier Dinge, die sich sofort lohnen</h2>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${TIPPS.map((t, i) => tippZeile(i + 1, t)).join('')}</table>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:20px 36px 0;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${INK};border-radius:10px;"><tr><td style="padding:22px 24px;">
      <h2 style="margin:0 0 6px;font-family:${SERIF};font-size:19px;font-weight:600;color:#F1ECE4;">Wenn etwas hakt: Schreib mir direkt.</h2>
      <p style="margin:0 0 16px;font-family:${F};font-size:15px;line-height:1.5;color:#D9D0C3;">Kein Ticket, kein Formular. Ich lese jede Nachricht selbst und melde mich persönlich, meist noch am selben Tag.</p>
      <table role="presentation" cellspacing="0" cellpadding="0"><tr>
        <td style="background:${WA};border-radius:8px;"><a href="${waUrl}" style="display:inline-block;padding:12px 18px;font-family:${F};font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;">WhatsApp an Fabian</a></td>
        <td width="12" style="font-size:0;">&nbsp;</td>
        <td style="border:1px solid #5A5148;border-radius:8px;"><a href="${mailUrl}" style="display:inline-block;padding:11px 18px;font-family:${F};font-size:15px;font-weight:700;color:#F1ECE4;text-decoration:none;">Auf diese Mail antworten</a></td>
      </tr></table>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:26px 36px 28px;">
    <table role="presentation" cellspacing="0" cellpadding="0"><tr>
      <td valign="middle" width="72"><img src="${PORTRAIT_URL}" width="56" height="56" alt="" style="display:block;width:56px;height:56px;border-radius:28px;object-fit:cover;"></td>
      <td valign="middle" style="font-family:${F};font-size:14px;line-height:1.5;color:${GRAU};"><strong style="display:block;font-family:${SERIF};font-size:18px;color:${INK};">Fabian Scharf</strong>Schreinermeister · Gründer von CraftFlow<br>${TELEFON_ANZEIGE} · <a href="mailto:${KONTAKT_MAIL}" style="color:${KUPFER};text-decoration:none;">${KONTAKT_MAIL}</a></td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:16px 36px 22px;border-top:1px solid ${LINIE};font-family:${F};font-size:12px;line-height:1.6;color:${GRAU};">
    Du bekommst diese Mail einmalig, weil du dich vor drei Tagen bei CraftFlow registriert hast. Deine Testphase läuft weiter, unabhängig davon, ob du antwortest.<br>
    FS Crafted · Fabian Scharf · Fuldaer Straße 15, 63517 Rodenbach · <a href="https://www.getcraftflow.de/impressum" style="color:${KUPFER};text-decoration:none;">Impressum</a> · <a href="https://www.getcraftflow.de/datenschutz" style="color:${KUPFER};text-decoration:none;">Datenschutz</a>
  </td></tr>
</table>
</td></tr></table>
</body></html>`

  const text = `${gruss}

Du bist seit drei Tagen bei CraftFlow. Ich wollte kurz nachfragen: Funktioniert alles? Ist etwas unklar oder umständlich? Ich baue CraftFlow selbst, in der Werkstatt und am Schreibtisch, und jede Rückmeldung hilft mir mehr als jede Statistik.

Falls du noch nicht alles ausprobiert hast — das bringt am meisten, in dieser Reihenfolge:
${TIPPS.map((t, i) => `${i + 1}. ${t.titel}: ${t.text} (${t.pfad})`).join('\n')}

Wenn etwas hakt: Schreib mir direkt per WhatsApp (${TELEFON_ANZEIGE}, ${waUrl}) oder antworte einfach auf diese Mail. Ich melde mich persönlich.

Viele Grüße
Fabian Scharf
Schreinermeister · Gründer von CraftFlow
${TELEFON_ANZEIGE} · ${KONTAKT_MAIL}

Du bekommst diese Mail einmalig, weil du dich vor drei Tagen bei CraftFlow registriert hast. Deine Testphase läuft weiter, unabhängig davon, ob du antwortest.
FS Crafted · Fabian Scharf · Fuldaer Straße 15, 63517 Rodenbach`

  return { subject, html, text }
}
