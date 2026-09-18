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

// ── Einladung in einen Betrieb (Teamfunktion, Fabian 2026-09-17) ────────────

/**
 * Entschärft Text, der aus einem Eingabefeld kommt, bevor er in HTML landet.
 * Firmenname und Einlader-Adresse tippt der Inhaber selbst ein — ungeschützt
 * wäre die Mail ein Träger für fremdes Markup beim Empfänger.
 */
function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/**
 * Einladung eines Mitarbeiters in einen Betrieb. `link` ist
 * `https://app.getcraftflow.de/einladung/<token>` — der Token ist das Geheimnis,
 * deshalb steht diese Mail nie in einem Rundschreiben-Register.
 *
 * WICHTIGSTER SATZ DER MAIL: „Melde dich mit genau dieser E-Mail-Adresse an."
 * `POST /api/team/annehmen` vergleicht die angemeldete Adresse mit der
 * eingeladenen und lehnt sonst ab — ohne den Hinweis vorher registrieren sich
 * Empfänger mit ihrer privaten Adresse und stehen vor einer Fehlermeldung.
 */
export function einladungsMail(opts: { betriebName?: string | null; einladerEmail: string; link: string }): Mail {
  const einlader = String(opts.einladerEmail ?? '').trim()
  // Ein Konto kann arbeiten, ohne je einen Firmennamen eingetragen zu haben —
  // dann darf im Betreff kein „null lädt dich ein" stehen.
  const wer = (opts.betriebName ?? '').trim() || einlader
  const subject = `${wer} lädt dich zu CraftFlow ein`
  const vorschau = 'Ein Klick, und du arbeitest im Betrieb mit — Angebote, Projekte, Kunden.'

  const html = rahmen(vorschau, [
    h1(`${esc(wer)} lädt dich ein`),
    p(`<strong style="color:${SCHWARZ};">${esc(einlader)}</strong> hat dich als Mitarbeiter zu CraftFlow eingeladen. CraftFlow ist das Angebotsprogramm für Schreiner — du arbeitest damit auf den Projekten, Kunden und Einstellungen des Betriebs, als wären es deine eigenen.`),
    p('Plan und Abrechnung bleiben beim Inhaber. Alles andere — Angebote rechnen, Projekte anlegen, PDFs erzeugen — kannst du wie er.'),
    knopf('Einladung annehmen →', opts.link),
    p(`Melde dich mit <strong style="color:${SCHWARZ};">genau dieser E-Mail-Adresse</strong> an, an die diese Mail ging — sonst passt die Einladung nicht. Wenn du noch kein CraftFlow-Konto hast, kannst du dir über den Link direkt eines anlegen.`),
    p(`Falls der Knopf nicht geht, öffne diese Adresse im Browser:<br><span style="color:${GRAU};font-size:13px;word-break:break-all;">${esc(opts.link)}</span>`),
    p('Du weißt nicht, warum du diese Mail bekommst? Dann ignoriere sie einfach — ohne deinen Klick passiert nichts.'),
    p('Viel Erfolg!<br>Fabian'),
  ].join('\n'))

  const text = [
    `${wer} lädt dich ein`,
    '',
    `${einlader} hat dich als Mitarbeiter zu CraftFlow eingeladen. CraftFlow ist das Angebotsprogramm für Schreiner — du arbeitest damit auf den Projekten, Kunden und Einstellungen des Betriebs, als wären es deine eigenen.`,
    '',
    'Plan und Abrechnung bleiben beim Inhaber. Alles andere — Angebote rechnen, Projekte anlegen, PDFs erzeugen — kannst du wie er.',
    '',
    'Einladung annehmen:',
    opts.link,
    '',
    'Melde dich mit genau dieser E-Mail-Adresse an, an die diese Mail ging — sonst passt die Einladung nicht. Wenn du noch kein CraftFlow-Konto hast, kannst du dir über den Link direkt eines anlegen.',
    '',
    'Du weißt nicht, warum du diese Mail bekommst? Dann ignoriere sie einfach — ohne deinen Klick passiert nichts.',
    '',
    'Viel Erfolg!',
    'Fabian',
    '',
    `Fabian Scharf · Schreinermeister · FS Crafted, Fuldaer Straße 15, 63517 Rodenbach · ${KONTAKT_MAIL} · ${KONTAKT_TELEFON}`,
  ].join('\n')

  return { subject, html, text }
}

// ── „Was ist neu“ an Bestandsnutzer (September 2026) ────────────────────────

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

// ── Rechnung nach der Abbuchung ─────────────────────────────────────────────
//
// WARUM SELBST UND NICHT VON STRIPE (Fabian, 18.09.2026): Stripe verschickt seine
// Rechnungsmail in seinem eigenen Layout — Logo und eine Akzentfarbe, mehr lässt sich
// dort nicht gestalten. Die Mail hier trägt dieselbe Handschrift wie Willkommens- und
// Tag-3-Mail, und das Rechnungs-PDF liegt im Anhang statt hinter einem Link: Ein
// Buchhalter braucht die Datei, keinen Verweis.
//
// WICHTIG: Solange diese Mail läuft, müssen die Stripe-eigenen Rechnungsmails im
// Dashboard AUS bleiben, sonst bekommt jeder Kunde alles doppelt.

/** Cent → „58,31 €“. */
function eur(cent: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format((cent ?? 0) / 100)
}

/** Sekunden (Stripe-Zeitstempel) → „18. September 2026“. Leer, wenn nichts da ist. */
function tag(sekunden?: number | null): string {
  if (!sekunden) return ''
  return new Date(sekunden * 1000).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
}

function betragsZeile(bezeichnung: string, betrag: string, stark = false): string {
  const farbe = stark ? SCHWARZ : TEXT
  const gewicht = stark ? '600' : '400'
  const linie = stark ? `border-top:2px solid ${SCHWARZ};` : 'border-top:1px solid #EEE9E2;'
  return `<tr>
  <td style="${linie}padding:9px 0;font-family:${F};font-size:14px;color:${farbe};font-weight:${gewicht};">${bezeichnung}</td>
  <td style="${linie}padding:9px 0;font-family:${F};font-size:14px;color:${farbe};font-weight:${gewicht};text-align:right;white-space:nowrap;">${betrag}</td>
</tr>`
}

export function rechnungsMail(opts: {
  /** Rechnungsnummer von Stripe, z. B. „A1B2C3-0001“. */
  nummer: string
  /** Anzeigename des Plans, z. B. „Pro“. Fehlt er, steht nur „CraftFlow“ da. */
  planName?: string | null
  nettoCent: number
  steuerCent: number
  gesamtCent: number
  /** Abrechnungszeitraum als Stripe-Zeitstempel (Sekunden). */
  vonSek?: number | null
  bisSek?: number | null
  /** Die Rechnung bei Stripe, zum Ansehen im Browser. */
  rechnungUrl?: string | null
  /** Liegt das PDF in dieser Mail? Sonst steht nur der Link da. */
  mitAnhang: boolean
  firma?: string | null
}): Mail {
  const plan = (opts.planName ?? '').trim()
  const bezeichnung = plan ? `CraftFlow ${plan}` : 'CraftFlow'
  const von = tag(opts.vonSek)
  const bis = tag(opts.bisSek)
  const zeitraum = von && bis ? `${von} – ${bis}` : ''
  const hallo = (opts.firma ?? '').trim() ? `Hallo ${(opts.firma ?? '').trim()},` : 'Hallo,'

  const subject = `Deine CraftFlow-Rechnung ${opts.nummer}`
  const vorschau = `${bezeichnung}${zeitraum ? `, ${zeitraum}` : ''} · ${eur(opts.gesamtCent)}`

  const tabelle = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 18px;">
${betragsZeile(bezeichnung + (zeitraum ? `<br><span style="font-size:12px;color:${GRAU};">${zeitraum}</span>` : ''), eur(opts.nettoCent))}
${betragsZeile('Umsatzsteuer 19 %', eur(opts.steuerCent))}
${betragsZeile('Gesamtbetrag', eur(opts.gesamtCent), true)}
</table>`

  const anhangSatz = opts.mitAnhang
    ? 'Die Rechnung als PDF liegt dieser Mail bei.'
    : 'Die Rechnung kannst du über den Knopf unten herunterladen.'

  const html = rahmen(vorschau, [
    h1('Deine Rechnung'),
    p(hallo),
    p(`vielen Dank — deine Zahlung ist angekommen. ${anhangSatz}`),
    `<p style="margin:0 0 6px;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${GRAU};">Rechnung ${opts.nummer}</p>`,
    tabelle,
    opts.rechnungUrl ? knopf('Rechnung ansehen →', opts.rechnungUrl) : '',
    p(`Alle deine Rechnungen findest du jederzeit in CraftFlow unter <strong style="color:${SCHWARZ};">Einstellungen → Mein Plan → Abonnement verwalten</strong>. Dort kannst du auch dein Zahlungsmittel ändern oder kündigen.`),
    p('Fragen zur Rechnung? Antworte einfach auf diese Mail.'),
    p('Viele Grüße<br>Fabian'),
  ].filter(Boolean).join('\n'))

  const text = [
    `Deine Rechnung ${opts.nummer}`,
    '',
    hallo,
    '',
    `vielen Dank — deine Zahlung ist angekommen. ${anhangSatz}`,
    '',
    `${bezeichnung}${zeitraum ? ` (${zeitraum})` : ''}: ${eur(opts.nettoCent)}`,
    `Umsatzsteuer 19 %: ${eur(opts.steuerCent)}`,
    `Gesamtbetrag: ${eur(opts.gesamtCent)}`,
    '',
    opts.rechnungUrl ? `Rechnung ansehen: ${opts.rechnungUrl}` : '',
    '',
    'Alle deine Rechnungen findest du jederzeit in CraftFlow unter Einstellungen → Mein Plan → Abonnement verwalten. Dort kannst du auch dein Zahlungsmittel ändern oder kündigen.',
    '',
    'Fragen zur Rechnung? Antworte einfach auf diese Mail.',
    '',
    'Viele Grüße',
    'Fabian',
    '',
    `Fabian Scharf · Schreinermeister · FS Crafted, Fuldaer Straße 15, 63517 Rodenbach · ${KONTAKT_MAIL} · ${KONTAKT_TELEFON}`,
  ].filter(z => z !== '').join('\n')

  return { subject, html, text }
}

// ── Register der Rundschreiben ─────────────────────────────────────────────
//
// Ablauf (Fabian, 2026-09-09: „so unkompliziert wie möglich“):
//   1. Neue Mail als Funktion schreiben (wie neuigkeitenMail oben) und hier mit
//      eindeutiger Kennung eintragen. Sonst nichts — kein Datenbankfeld, keine Route.
//   2. Auf der dev-Vorschau unter Einstellungen → Admin erscheint sie automatisch mit
//      „Vorschau“, „Test an mich“, „Probelauf“, „Senden“.
//   3. Freigabe → main → Fabian klickt live auf Senden.
//
// Die Kennung ist zugleich der Merker in den app_metadata jedes Empfängers
// (`rundschreiben_<kennung>`): Wer sie hat, bekommt dieses Rundschreiben nie ein
// zweites Mal. Deshalb darf eine Kennung nach dem Versand NIE wiederverwendet werden.
//
// Das Register steht in DIESER Datei, weil die Tests ohne Bundler laufen und Node
// keine Importe ohne Dateiendung auflöst — ein eigenes Modul müsste importieren.

export type Rundschreiben = {
  /** Eindeutig, nur Kleinbuchstaben, Ziffern und Bindestrich. Beginnt mit Jahr-Monat. */
  kennung: string
  /** Für die Admin-Liste. */
  titel: string
  /** Wann die Mail geschrieben wurde — nur zur Orientierung in der Liste. */
  erstellt: string
  mail: () => Mail
}

export const RUNDSCHREIBEN: Rundschreiben[] = [
  {
    kennung: '2026-09-neuigkeiten',
    titel: 'Was ist neu: Mein Betrieb, Meine Bauweise, Alternativen, Starthilfe',
    erstellt: '2026-09-08',
    mail: neuigkeitenMail,
  },
]

export const KENNUNG_MUSTER = /^\d{4}-\d{2}-[a-z0-9-]+$/

export function rundschreibenFinden(kennung: string): Rundschreiben | undefined {
  return RUNDSCHREIBEN.find(r => r.kennung === kennung)
}

/** Name des Merkers in den app_metadata eines Nutzers. */
export function merkerName(kennung: string): string {
  return `rundschreiben_${kennung}`
}
