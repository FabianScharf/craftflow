import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

function xe(s: string) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

interface MatPos { menge: number; einheit: string; ekPreis: number; aufschlag: number }
interface ArbPos { minuten: number; vkStunde: number }
interface Pos { titel: string; beschreibung: string; material: MatPos[]; arbeitszeit: ArbPos[] }

function calcGesamt(p: Pos): number {
  const mat = p.material.reduce((s, m) => s + m.menge * m.ekPreis * (1 + m.aufschlag), 0)
  const arb = p.arbeitszeit.reduce((s, a) => s + (a.minuten / 60) * a.vkStunde, 0)
  return mat + arb
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Nicht eingeloggt' }, { status: 401 })

  const body = await req.json() as { positionen: Pos[]; kunde?: { name?: string; projekt?: string }; docNr?: string }
  const positionen = body.positionen ?? []
  const projektName = [body.kunde?.name, body.kunde?.projekt].filter(Boolean).join(' – ') || 'Angebot'
  const docNr = body.docNr ?? 'AN-001'
  const dateStr = new Date().toISOString().slice(0, 10)

  let itemsXml = ''
  positionen.forEach((p, i) => {
    const gesamt = calcGesamt(p)
    const rno = String((i + 1) * 10).padStart(4, '0')
    const menge = p.material[0]?.menge ?? 1
    const einheit = p.material[0]?.einheit ?? 'Psch'
    const up = menge > 0 ? gesamt / menge : gesamt
    itemsXml += `\n          <Item RNoPart="${rno}">
            <Qty>${menge.toFixed(3)}</Qty>
            <QU>${xe(einheit)}</QU>
            <Description>
              <ShortText>${xe(p.titel)}</ShortText>
              <CompleteText><DetailTxt><Text><p>${xe(p.beschreibung || p.titel)}</p></Text></DetailTxt></CompleteText>
            </Description>
            <UP>${up.toFixed(2)}</UP>
            <T>${gesamt.toFixed(2)}</T>
          </Item>`
  })

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<GAEB xmlns="http://www.gaeb.de/GAEB_DA_XML/3.2">
  <GAEBInfo>
    <FileName>${xe(docNr)}.X84</FileName>
    <Date>${dateStr}</Date>
    <Conversion>false</Conversion>
  </GAEBInfo>
  <Award><DP>DA84</DP></Award>
  <BoQ>
    <BoQInfo>
      <Name>${xe(projektName)}</Name>
      <LblBoQ>Angebot</LblBoQ>
    </BoQInfo>
    <BoQBody>
      <BoQCtgy RNoPart="01">
        <LblTx><p>${xe(projektName)}</p></LblTx>
        <BoQBody>
          <Itemlist>${itemsXml}
          </Itemlist>
        </BoQBody>
      </BoQCtgy>
    </BoQBody>
  </BoQ>
</GAEB>`

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=UTF-8',
      'Content-Disposition': `attachment; filename="${docNr}_${dateStr}.X84"`,
    },
  })
}
