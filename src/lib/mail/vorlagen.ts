// Mail-Vorlagen: Willkommens-Mail für neue Nutzer und die einmalige
// „Was ist neu“-Mail an Bestandsnutzer (September 2026).
//
// Importiert bewusst NICHTS — damit tests/mail-vorlagen.test.mjs ohne Bundler läuft.
// Beide Vorlagen verweisen auf die Starthilfe www.getcraftflow.de/willkommen; die
// Kapitel-Anker dort (#einrichtung, #optimierung, #check …) sind Teil des Vertrags
// mit der Website — wer sie dort umbenennt, muss hier nachziehen.

export const STARTHILFE_URL = 'https://www.getcraftflow.de/willkommen'
export const APP_URL = 'https://app.getcraftflow.de'
export const KONTAKT_MAIL = 'anfrage@fscrafted.de'
export const KONTAKT_TELEFON = '+49 160 4416822'

export type Mail = { subject: string; html: string; text: string }

// ── Gestaltung ──────────────────────────────────────────────────────────────
// Helle Fläche mit schwarzer Kopfzeile und Kupfer-Akzent. Bewusst kein dunkler
// Hintergrund: Mail-Programme kehren Farben im Dunkelmodus teils um, und weiße
// Schrift auf Schwarz wird dann unlesbar. Alles inline — externe CSS-Dateien
// werden von den meisten Mail-Programmen ignoriert.
const F = 'Helvetica Neue, Helvetica, Arial, sans-serif'
const KUPFER = '#C8885A'
const SCHWARZ = '#0D0D0D'
const TEXT = '#2B2B2B'
const GRAU = '#6B6B6B'

function rahmen(vorschau: string, inhalt: string): string {
  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CraftFlow</title></head>
<body style="margin:0;padding:0;background:#F3F0EB;">
<span style="display:none;font-size:1px;color:#F3F0EB;max-height:0;overflow:hidden;">${vorschau}</span>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F3F0EB;">
<tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#FFFFFF;border-radius:14px;overflow:hidden;">
  <tr><td style="background:${SCHWARZ};padding:18px 28px;font-family:${F};font-size:16px;font-weight:600;color:#F0EDE8;letter-spacing:-0.2px;">Craft<span style="color:${KUPFER};">Flow</span></td></tr>
  <tr><td style="padding:32px 28px 8px;font-family:${F};font-size:15px;line-height:1.65;color:${TEXT};">
${inhalt}
  </td></tr>
  <tr><td style="padding:20px 28px 28px;font-family:${F};font-size:12px;line-height:1.6;color:${GRAU};border-top:1px solid #EEE9E2;">
    Fabian Scharf · Schreinermeister · FS Crafted, Fuldaer Straße 15, 63517 Rodenbach<br>
    <a href="mailto:${KONTAKT_MAIL}" style="color:${KUPFER};text-decoration:none;">${KONTAKT_MAIL}</a> · ${KONTAKT_TELEFON} · <a href="https://www.getcraftflow.de" style="color:${KUPFER};text-decoration:none;">getcraftflow.de</a>
  </td></tr>
</table>
</td></tr></table>
</body></html>`
}

function knopf(text: string, url: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:22px 0 26px;"><tr><td style="background:${KUPFER};border-radius:9px;">
  <a href="${url}" style="display:inline-block;padding:13px 26px;font-family:${F};font-size:14px;font-weight:600;color:${SCHWARZ};text-decoration:none;">${text}</a>
</td></tr></table>`
}

function h1(text: string): string {
  return `<h1 style="margin:0 0 14px;font-family:${F};font-size:24px;line-height:1.2;font-weight:600;color:${SCHWARZ};letter-spacing:-0.3px;">${text}</h1>`
}

function p(text: string): string {
  return `<p style="margin:0 0 14px;">${text}</p>`
}

function punkt(titel: string, text: string, url?: string): string {
  const t = url ? `<a href="${url}" style="color:${SCHWARZ};text-decoration:none;font-weight:600;">${titel}</a>` : `<strong style="color:${SCHWARZ};">${titel}</strong>`
  return `<tr><td style="padding:10px 0;border-top:1px solid #EEE9E2;font-family:${F};font-size:14px;line-height:1.6;color:${TEXT};">
  <span style="color:${KUPFER};font-weight:700;">→</span>&nbsp; ${t}<br><span style="color:${GRAU};">${text}</span></td></tr>`
}

function liste(zeilen: string[]): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:6px 0 10px;">${zeilen.join('')}</table>`
}

// ── Willkommens-Mail ────────────────────────────────────────────────────────

/** Anrede aus dem Firmennamen, wenn vorhanden — sonst neutral. */
function anrede(firma?: string | null): string {
  const f = (firma ?? '').trim()
  return f ? `Hallo und willkommen bei CraftFlow, ${f}!` : 'Hallo und willkommen bei CraftFlow!'
}

export function willkommensMail(opts: { firma?: string | null } = {}): Mail {
  const subject = 'Willkommen bei CraftFlow — dein erstes Angebot in einer halben Stunde'
  const vorschau = 'Zehn Minuten Einrichtung, dann steht deinem ersten Angebot nichts mehr im Weg.'

  const html = rahmen(vorschau, [
    h1(anrede(opts.firma)),
    p('Ich bin Fabian Scharf, Schreinermeister aus Rodenbach, und ich habe CraftFlow gebaut, weil ich selbst zu viele Freitagabende mit Angeboten verbracht habe. Schön, dass du es ausprobierst.'),
    p('Eine Bitte vorweg, weil daran fast alles hängt: <strong style="color:' + SCHWARZ + ';">Nimm dir zuerst zehn Minuten für die Einrichtung.</strong> CraftFlow rechnet mit deinen Stundensätzen und deinen Zeiten — wenn die nicht stimmen, stimmt kein Ergebnis.'),
    liste([
      punkt('1 · Firmendaten & Logo', 'Landet automatisch auf jedem Angebots-PDF.', STARTHILFE_URL + '#einrichtung'),
      punkt('2 · Mein Betrieb', 'Ein paar Fragen zu deinem Betrieb und zu einem Referenzmöbel — du wählst aus, statt Zahlen einzutippen. Daraus rechnet CraftFlow mit deinen Zeiten statt mit den CraftFlow-Werten. Der Schritt, an dem fast alles hängt.', STARTHILFE_URL + '#einrichtung'),
      punkt('3 · Kostenstellen', 'Stundensätze eintragen und abschalten, was du nicht hast — kein CNC, kein Kantenanleimer.', STARTHILFE_URL + '#einrichtung'),
    ]),
    p('Alles Weitere — wie du ein Projekt beschreibst, wie du das Ergebnis liest und vor allem, wie du die beiden KI-Werkzeuge <strong style="color:' + SCHWARZ + ';">KI-Optimierung</strong> und <strong style="color:' + SCHWARZ + ';">Kalkulations-Check</strong> richtig nutzt — steht in der Starthilfe. Mit echten Beispielen, in der Reihenfolge, in der du es brauchst.'),
    knopf('Starthilfe öffnen →', STARTHILFE_URL),
    p('Wenn etwas unklar ist oder ein Ergebnis nicht zu deiner Erfahrung passt: Antworte einfach auf diese Mail. Kein Ticket-System, kein Support-Bot — du schreibst direkt mir.'),
    p('Viel Erfolg mit deinem ersten Angebot!<br>Fabian'),
  ].join('\n'))

  const text = [
    anrede(opts.firma),
    '',
    'Ich bin Fabian Scharf, Schreinermeister aus Rodenbach, und ich habe CraftFlow gebaut, weil ich selbst zu viele Freitagabende mit Angeboten verbracht habe. Schön, dass du es ausprobierst.',
    '',
    'Eine Bitte vorweg, weil daran fast alles hängt: Nimm dir zuerst zehn Minuten für die Einrichtung. CraftFlow rechnet mit deinen Stundensätzen und deinen Zeiten — wenn die nicht stimmen, stimmt kein Ergebnis.',
    '',
    '1. Firmendaten & Logo — landet automatisch auf jedem Angebots-PDF.',
    '2. Mein Betrieb — ein paar Fragen zu deinem Betrieb und zu einem Referenzmöbel. Du wählst aus, statt Zahlen einzutippen. Daraus rechnet CraftFlow mit deinen Zeiten statt mit den CraftFlow-Werten. Der Schritt, an dem fast alles hängt.',
    '3. Kostenstellen — Stundensätze eintragen und abschalten, was du nicht hast.',
    '',
    'Alles Weitere — Projekt beschreiben, Ergebnis lesen, KI-Optimierung und Kalkulations-Check richtig nutzen — steht in der Starthilfe:',
    STARTHILFE_URL,
    '',
    'Wenn etwas unklar ist oder ein Ergebnis nicht zu deiner Erfahrung passt: Antworte einfach auf diese Mail. Du schreibst direkt mir.',
    '',
    'Viel Erfolg mit deinem ersten Angebot!',
    'Fabian',
    '',
    `Fabian Scharf · Schreinermeister · FS Crafted, Fuldaer Straße 15, 63517 Rodenbach · ${KONTAKT_MAIL} · ${KONTAKT_TELEFON}`,
  ].join('\n')

  return { subject, html, text }
}

// ── „Was ist neu“ an Bestandsnutzer (September 2026) ────────────────────────

export const NEUIGKEITEN_KENNUNG = 'neuigkeiten_2026_09_am'

export function neuigkeitenMail(): Mail {
  const subject = 'CraftFlow rechnet jetzt mit deinem Betrieb — was neu ist'
  const vorschau = 'Mein Betrieb, Meine Bauweise, Alternativpositionen, Stückzahl — und eine Starthilfe, die alles erklärt.'

  const neu = [
    ['Mein Betrieb', 'Ein paar Fragen unter Einstellungen → Mein Betrieb — du wählst aus, statt Zahlen einzutippen. Daraus rechnet CraftFlow mit deinen Zeiten statt mit den CraftFlow-Werten. Wenn dir Preise bisher zu hoch oder zu niedrig vorkamen: Das ist die Stellschraube.', STARTHILFE_URL + '#einrichtung'],
    ['Meine Bauweise — CraftFlow lernt von dir', 'Sag im Chat „Rückwände sind bei mir immer 8 mm Spanplatte“, bestätige den Regelvorschlag — ab dem nächsten Angebot gilt es automatisch. Alle Regeln unter Einstellungen → Meine Bauweise.', STARTHILFE_URL + '#check'],
    ['Alternativpositionen, Stückzahl, Gruppen', 'Eine Position als Alternative führen (Preis in Klammern, zählt nicht zur Summe), Stückzahl je Position, zusammengehörende Positionen unter einer Überschrift.', STARTHILFE_URL + '#ergebnis'],
    ['Textbausteine & Briefpapier', 'Eigene Absätze fürs Angebot, Schriftwahl, Layout — mit lebender Vorschau.', STARTHILFE_URL + '#angebot'],
    ['Die Starthilfe', 'Eine Seite, die CraftFlow von vorn erklärt — mit echten Beispielen dafür, wie man die KI-Optimierung und den Kalkulations-Check so nutzt, dass am Ende eine Kalkulation steht, hinter der man steht.', STARTHILFE_URL],
  ] as const

  const html = rahmen(vorschau, [
    h1('Was in CraftFlow neu ist'),
    p('Hallo,'),
    p('in den letzten Wochen ist in CraftFlow einiges dazugekommen — das meiste davon direkt aus Rückmeldungen von euch. Das Wichtigste in einer Minute:'),
    liste(neu.map(([t, d, u]) => punkt(t, d, u))),
    knopf('Starthilfe ansehen →', STARTHILFE_URL),
    p('Wenn du CraftFlow schon eine Weile nicht geöffnet hast: Der schnellste Weg zu brauchbaren Zahlen ist <strong style="color:' + SCHWARZ + ';">Einstellungen → Mein Betrieb</strong>. Zwei Minuten, dann rechnet CraftFlow mit deinen Werten.'),
    p('Und wie immer: Was funktioniert, was verwirrt, was fehlt? Antworte einfach auf diese Mail — ich lese jede.'),
    p('Danke, dass du dabei bist.<br>Fabian'),
    `<p style="margin:22px 0 0;font-size:12px;line-height:1.6;color:${GRAU};">Du bekommst diese Mail, weil du ein CraftFlow-Konto hast. Es ist eine einmalige Information zu neuen Funktionen, kein Newsletter. Möchtest du auch solche Hinweise nicht mehr: kurze Antwort mit „keine Infos“ genügt.</p>`,
  ].join('\n'))

  const text = [
    'Was in CraftFlow neu ist',
    '',
    'Hallo,',
    '',
    'in den letzten Wochen ist in CraftFlow einiges dazugekommen — das meiste davon direkt aus Rückmeldungen von euch. Das Wichtigste in einer Minute:',
    '',
    ...neu.map(([t, d, u]) => `→ ${t}\n  ${d}\n  ${u}`),
    '',
    'Wenn du CraftFlow schon eine Weile nicht geöffnet hast: Der schnellste Weg zu brauchbaren Zahlen ist Einstellungen → Mein Betrieb. Zwei Minuten, dann rechnet CraftFlow mit deinen Werten.',
    '',
    'Was funktioniert, was verwirrt, was fehlt? Antworte einfach auf diese Mail — ich lese jede.',
    '',
    'Danke, dass du dabei bist.',
    'Fabian',
    '',
    'Du bekommst diese Mail, weil du ein CraftFlow-Konto hast. Es ist eine einmalige Information zu neuen Funktionen, kein Newsletter. Möchtest du auch solche Hinweise nicht mehr: kurze Antwort mit „keine Infos“ genügt.',
    '',
    `Fabian Scharf · Schreinermeister · FS Crafted, Fuldaer Straße 15, 63517 Rodenbach · ${KONTAKT_MAIL} · ${KONTAKT_TELEFON}`,
  ].join('\n')

  return { subject, html, text }
}
