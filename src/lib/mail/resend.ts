// Versand über Resend (HTTP-API, kein SDK — wie schon in /api/notify-signup).
//
// Absender kommt aus MAIL_FROM (Vercel-Env). Standard ist Fabians Adresse auf der
// Produktdomain; die muss in Resend als Domain verifiziert sein, sonst lehnt Resend
// den Versand ab — die Fehlermeldung wird durchgereicht, damit man das sieht.
// Antworten landen immer im Postfach von FS Crafted.

import type { Mail } from './mail-typen'

export const MAIL_FROM_STANDARD = 'Fabian Scharf | CraftFlow <fabian@getcraftflow.de>'
export const MAIL_REPLY_TO = 'anfrage@fscrafted.de'

export type Versandergebnis = { ok: true; id: string } | { ok: false; error: string }

export function mailAbsender(): string {
  return process.env.MAIL_FROM?.trim() || MAIL_FROM_STANDARD
}

export async function sendeMail(an: string, mail: Mail): Promise<Versandergebnis> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY nicht gesetzt' }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: mailAbsender(),
        to: an,
        reply_to: MAIL_REPLY_TO,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      }),
    })
    const json = await res.json().catch(() => ({})) as { id?: string; message?: string; name?: string }
    if (!res.ok) return { ok: false, error: json.message || json.name || `Resend antwortete mit ${res.status}` }
    return { ok: true, id: json.id ?? '' }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Netzwerkfehler' }
  }
}
