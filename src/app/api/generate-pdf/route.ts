import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'
import { createClient } from '@/utils/supabase/server'

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

  const { html, letterheadUrl, filename, margins } = await req.json() as {
    html: string
    letterheadUrl?: string
    filename?: string
    margins?: { top: number; bottom: number; left: number; right: number }
  }

  if (!html) return NextResponse.json({ error: 'Kein HTML' }, { status: 400 })

  // HTML → PDF via Puppeteer
  const browser = await launchBrowser()
  let contentPdfBytes: Uint8Array
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'load', timeout: 30000 })
    const m = margins ?? { top: 45, bottom: 20, left: 20, right: 20 }
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: `${m.top}mm`,
        right: `${m.right}mm`,
        bottom: `${m.bottom}mm`,
        left: `${m.left}mm`,
      },
    })
    contentPdfBytes = new Uint8Array(pdfBuffer)
  } finally {
    await browser.close()
  }

  let finalBytes: Uint8Array = contentPdfBytes

  // Briefpapier-Overlay via pdf-lib
  if (letterheadUrl) {
    const lhRes = await fetch(letterheadUrl)
    if (lhRes.ok) {
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
