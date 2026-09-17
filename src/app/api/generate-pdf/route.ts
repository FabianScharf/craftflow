import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { createClient } from '@/utils/supabase/server'
import { pruefeZugang, ladeEffektivenPlan } from '@/lib/planpruefung'
import { erlaubt } from '@/lib/plaene'
import { istEigenesBriefpapier } from '@/lib/briefpapier'
import { kontoIdFuer, kontoGesperrt } from '@/lib/kontoserver'

/**
 * Schriften in das HTML einbacken, statt sie laden zu lassen.
 *
 * GEMESSEN AM 2026-09-08: Mit @font-face ueber eine Adresse kam die gewaehlte
 * Schrift NICHT ins PDF — eingebettet war weiter nur OpenSans. Zwei Gruende, beide
 * unabhaengig voneinander toedlich:
 *
 *  1. Schriften sind CORS-pflichtig. page.setContent() gibt der Seite eine leere
 *     Herkunft, der Abruf traegt "Origin: null" — und statische Dateien aus /public
 *     senden keine CORS-Kopfzeilen. Der Browser verwirft die Schrift stillschweigend.
 *  2. Vorschau-Bereitstellungen liegen hinter der Vercel-Anmeldung. Der Abruf aus
 *     der Lambda bekaeme dort eine Anmeldeseite statt der Schriftdatei.
 *
 * Eingebettet als data:-Adresse gibt es weder Netz noch Herkunft noch Anmeldung.
 * Rund 27 KB je Schnitt — das faellt neben dem PDF nicht ins Gewicht.
 *
 * Im Browser bleibt die Adressvariante: Dort ist es dieselbe Herkunft, also kein
 * CORS-Fall, und die Vorschau muss nichts nachladen, was sie nicht ohnehin hat.
 */
async function schriftenEinbacken(html: string, darfGestalten = true): Promise<string> {
  const treffer = [...html.matchAll(/url\('[^']*\/fonts\/([a-z0-9-]+\.woff2)'\)/g)]
  if (treffer.length === 0) return html
  let raus = html
  for (const t of treffer) {
    let datei = t[1]
    // Nur Namen aus dem eigenen Schriftordner — nie ein Pfad aus der Anfrage.
    if (!/^[a-z0-9-]+\.woff2$/.test(datei)) continue
    // Schriftwahl ist eine Plan-Funktion (Audit 2026-09-17, I5). Das fertige HTML
    // baut der Browser — der Server kann es nicht neu setzen, aber er kann dafür
    // sorgen, dass ohne 'gestaltung' die GLYPHEN aus der Standardschrift kommen.
    // Der Schnitt (400/700) bleibt erhalten, das Layout ändert sich nicht.
    if (!darfGestalten) datei = datei.endsWith('-700.woff2') ? 'open-sans-700.woff2' : 'open-sans-400.woff2'
    try {
      const daten = await readFile(path.join(process.cwd(), 'public', 'fonts', datei))
      raus = raus.replace(t[0], `url(data:font/woff2;base64,${daten.toString('base64')})`)
    } catch (e) {
      // Faellt eine Datei aus, bleibt die Adressvariante stehen und die Schrift
      // greift auf den Ersatz zurueck. Ein Angebot ohne Wunschschrift ist besser
      // als gar keins.
      console.error('[pdf] Schrift nicht einbackbar:', datei, e)
    }
  }
  return raus
}

export const maxDuration = 60
export const runtime = 'nodejs'

async function launchBrowser() {
  if (process.env.NODE_ENV === 'development') {
    const puppeteer = await import('puppeteer-core')
    const executablePath =
      process.platform === 'darwin'
        ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        : process.platform === 'win32'
        ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
        : '/usr/bin/google-chrome'
    return puppeteer.default.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
  } else {
    const chromium = (await import('@sparticuz/chromium')).default
    const puppeteer = await import('puppeteer-core')
    return puppeteer.default.launch({
      args: [
        ...(chromium.args as string[]),
        '--disable-dev-shm-usage', // Vercel hat kein /dev/shm → shared memory im /tmp
        '--single-process',        // Kein fork() in Vercel Lambdas möglich
      ],
      executablePath: await chromium.executablePath(),
      headless: true,
    })
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const konto = await kontoIdFuer(supabase, user)
  const sperreKonto = kontoGesperrt(konto)
  if (sperreKonto) return sperreKonto
  const kontoId = konto.kontoId
  const zu = await pruefeZugang(supabase, kontoId)
  if (zu) return zu

  // `letterheadUrl` aus dem Anfragekörper wird BEWUSST ignoriert (Audit 2026-09-17,
  // Critical 3): Sie wurde ungeprüft serverseitig abgerufen und der Inhalt ins PDF
  // gelegt — jede interne Adresse war damit erreichbar (SSRF). Das Briefpapier kommt
  // ab jetzt ausschließlich aus dem eigenen Betriebsprofil, siehe unten.
  const { html, filename, footerTemplate } = await req.json() as {
    html: string
    filename?: string
    footerTemplate?: string
  }

  if (!html) return NextResponse.json({ error: 'Kein HTML' }, { status: 400 })

  // Gestaltung ist eine Plan-Funktion (ab Starter). Bisher entschied darüber allein
  // der Browser (pdfTextOptionen mit `effectivePlan`) — der Server nahm fertiges HTML
  // plus Briefpapier entgegen und fragte nicht nach (Audit 2026-09-17, I5). Jetzt
  // kommt der Plan serverseitig, nie aus einem Feld im Anfragekörper.
  const plan = await ladeEffektivenPlan(supabase, kontoId)
  const darfGestalten = erlaubt(plan, 'gestaltung')

  // Eigenes Briefpapier: aus dem EIGENEN Profil laden, nicht aus der Anfrage.
  let letterheadUrl: string | null = null
  if (darfGestalten) {
    const { data: profil, error: profilErr } = await supabase
      .from('betriebsprofil')
      .select('pdf_eigenes_briefpapier, pdf_briefpapier_url')
      .eq('user_id', kontoId)
      .single()
    // Supabase wirft nicht — ohne diese Prüfung sähe ein Ausfall aus wie „kein
    // Briefpapier hinterlegt", und das Angebot käme still ohne Briefpapier heraus.
    if (profilErr) {
      console.error('[pdf] Betriebsprofil:', profilErr.message)
      return NextResponse.json({ error: 'Dein Betriebsprofil ist gerade nicht erreichbar. Bitte gleich noch einmal versuchen.' }, { status: 503 })
    }
    const eigenes = profil?.pdf_eigenes_briefpapier === true
    const adresse = (profil?.pdf_briefpapier_url as string | null) ?? null
    if (eigenes && adresse) {
      if (!istEigenesBriefpapier(adresse, process.env.NEXT_PUBLIC_SUPABASE_URL, kontoId)) {
        console.error('[pdf] Briefpapier-Adresse abgelehnt:', adresse)
        return NextResponse.json(
          { error: 'Die hinterlegte Briefpapier-Datei liegt nicht in deinem CraftFlow-Speicher. Bitte lade das Briefpapier in den Einstellungen neu hoch.' },
          { status: 400 },
        )
      }
      letterheadUrl = adresse
    }
  }

  // HTML → PDF via Puppeteer
  const browser = await launchBrowser()
  let contentPdfBytes: Uint8Array
  try {
    const page = await browser.newPage()
    await page.setContent(await schriftenEinbacken(html, darfGestalten), { waitUntil: 'load', timeout: 30000 })
    // Margins are set via @page CSS in the HTML — Puppeteer margin must be 0
    // to avoid double-applying margins (CSS @page takes precedence over Puppeteer).
    // Auf die Schriften warten, bevor gedruckt wird.
    //
    // NOETIG SEIT 2026-09-08: Die Schriftart ist waehlbar, und die Dateien kommen per
    // @font-face ueber das Netz. `waitUntil: 'load'` wartet darauf NICHT — Schriften
    // werden nachgeladen. Ohne dieses Warten druckt Chromium die erste Seite noch mit
    // der Ersatzschrift, und das Angebot sieht anders aus als die Vorschau.
    //
    // Faellt der Abruf aus, geht es nach zwei Sekunden trotzdem weiter: Ein Angebot in
    // der Ersatzschrift ist besser als gar keins.
    try {
      await page.evaluate(() => Promise.race([
        document.fonts.ready,
        new Promise(fertig => setTimeout(fertig, 2000)),
      ]))
    } catch (e) {
      console.error('[pdf] Schriften konnten nicht geladen werden:', e)
    }

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      // CSS @page im HTML steuert Margins (Vorrang vor Puppeteer wenn margin=0).
      // displayHeaderFooter rendert footerTemplate in den CSS @page bottom-Margin (26mm).
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      ...(footerTemplate ? {
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate,
      } : {}),
    })
    contentPdfBytes = new Uint8Array(pdfBuffer)
  } finally {
    await browser.close()
  }

  let finalBytes: Uint8Array = contentPdfBytes

  // Briefpapier-Overlay via pdf-lib
  if (letterheadUrl) {
    // Mit Zeitgrenze: Ein hängender Abruf hielte sonst die ganze Lambda bis zum
    // maxDuration-Ende fest (Audit 2026-09-17, Critical 3).
    const lhRes = await fetch(letterheadUrl, { signal: AbortSignal.timeout(10_000) })
      .catch(e => { console.error('[pdf] Briefpapier nicht abrufbar:', e); return null })
    if (lhRes?.ok) {
      const lhBytes = new Uint8Array(await lhRes.arrayBuffer())

      const lhDoc = await PDFDocument.load(lhBytes)
      const contentDoc = await PDFDocument.load(contentPdfBytes)
      const merged = await PDFDocument.create()

      const lhPageCount = lhDoc.getPageCount()
      const contentPageCount = contentDoc.getPageCount()

      // Alle Seiten auf einmal einbetten (effizienter als einzeln)
      const lhIndices = Array.from({ length: lhPageCount }, (_, i) => i)
      const contentIndices = Array.from({ length: contentPageCount }, (_, i) => i)
      const lhEmbedded = await merged.embedPdf(lhDoc, lhIndices)
      const contentEmbedded = await merged.embedPdf(contentDoc, contentIndices)

      for (let i = 0; i < contentPageCount; i++) {
        // Seite 1 des Briefpapiers → erste Seite; Seite 2 (falls vorhanden) → alle Folgeseiten
        const lhPage = lhPageCount > 1 ? lhEmbedded[Math.min(i, lhPageCount - 1)] : lhEmbedded[0]
        const contentPage = contentEmbedded[i]

        const newPage = merged.addPage([595.28, 841.89]) // A4 in Punkten
        const { width, height } = newPage.getSize()

        // Briefpapier als Hintergrund
        newPage.drawPage(lhPage, { x: 0, y: 0, width, height })
        // Angebot darüber
        newPage.drawPage(contentPage, { x: 0, y: 0, width, height })
      }

      finalBytes = await merged.save()
    }
  }

  const outputFilename = (filename || 'dokument').replace(/[^a-zA-Z0-9_\-]/g, '_') + '.pdf'

  return new NextResponse(Buffer.from(finalBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${outputFilename}"`,
    },
  })
}
