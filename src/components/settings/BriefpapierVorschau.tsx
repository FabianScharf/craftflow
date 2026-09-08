'use client'

import { useEffect, useMemo, useState } from 'react'
import { buildPDF } from '@/lib/pdf'
import { pdfTextOptionen, pdfFirmaOptionen } from '@/lib/pdfoptionen'
import type { Angebotsposition, Kunde } from '@/lib/types'

// Lebende Vorschau neben den Einstellungen.
//
// WARUM: Der Briefpapier-Reiter hat rund zwanzig Bedienelemente, und ein
// Testnutzer hat in seiner Rückmeldung vom 2026-08-26 kein einziges davon gefunden —
// er hat stattdessen aufgeschrieben, was ihm am PDF fehlt. Nicht die Funktionen
// fehlten, sondern der Weg dorthin.
//
// Er wünschte sich zudem, "den Brief im Format und im Text in der Druckansicht zu
// verändern, da mir aufgrund der besseren Übersichtlichkeit auch besser Fehler
// auffallen". Ein Editor in der Druckansicht wäre ein eigenes Vorhaben — eine
// Vorschau, die bei jedem Klick sofort mitgeht, löst dasselbe Anliegen und macht
// die Einstellungen von selbst auffindbar: Man sieht, was sie tun.
//
// Gerendert wird mit derselben Funktion wie das echte PDF (buildPDF). Was hier
// steht, steht auch im Dokument — keine zweite Vorlage, die auseinanderlaufen kann.

// NEUTRALE Beispieldaten — hier standen bis zum 2026-09-08 Name und Anschrift eines
// ECHTEN Kunden. Ich hatte sie aus der Rueckmeldung uebernommen, ohne nachzudenken.
// Damit sah jeder CraftFlow-Nutzer die Daten eines Dritten in seinen Einstellungen.
// In Beispieldaten gehoeren niemals echte Personen.
const BEISPIEL_KUNDE: Kunde = {
  name: 'Max Mustermann',
  zusatz: '',
  strasse: 'Musterstraße 1',
  ort: '12345 Musterstadt',
  projekt: 'Flurschrank und Garderobe',
  anrede: 'Herr',
  nachname: 'Mustermann',
}

// Das Beispiel zeigt absichtlich ALLES, was die Einstellungen beeinflussen können:
// eine Gruppe mit zwei Unterpositionen, eine Alternativposition und eine Position
// mit Stückzahl. So sieht man jede Einstellung wirken, ohne ein echtes Angebot zu
// brauchen.
const BEISPIEL_POSITIONEN: Angebotsposition[] = [
  {
    id: 1, gruppe: 'Flurschrank',
    titel: 'Korpus und Fronten',
    beschreibung: 'Einbauschrank 2,00 × 2,40 × 0,60 m, Egger Dekorspanplatte 19 mm weiß, Kanten ABS 1 mm.\n\n4 Drehtüren mit Topfscharnieren, 2 Schubkästen auf Systemauszügen, je Fach 2 Einlegeböden.',
    material: [{ id: 11, bezeichnung: 'Egger Dekorspanplatte 19 mm', menge: 16, einheit: 'm²', ekPreis: 16, aufschlag: 0.3 }],
    arbeitszeit: [{ id: 12, kostenstelle: 'Zusammenbau', minuten: 480, vkStunde: 65 }],
  },
  {
    id: 2, gruppe: 'Flurschrank',
    titel: 'LED-Beleuchtung', alternativ: true,
    beschreibung: 'LED-Band warmweiß 2700 K, senkrecht an den Schrankseiten, geschaltet über Türkontakt.',
    material: [{ id: 21, bezeichnung: 'LED-Band inkl. Trafo', menge: 1, einheit: 'Stk', ekPreis: 180, aufschlag: 0.3 }],
    arbeitszeit: [{ id: 22, kostenstelle: 'Zusammenbau', minuten: 90, vkStunde: 65 }],
  },
  {
    id: 3, titel: 'Garderobenbank', stueckzahl: 2,
    beschreibung: 'Sitzbank Eiche massiv geölt, 1,20 m, mit Ablage.',
    material: [{ id: 31, bezeichnung: 'Eiche massiv 40 mm', menge: 0.9, einheit: 'm²', ekPreis: 140, aufschlag: 0.3 }],
    arbeitszeit: [{ id: 32, kostenstelle: 'Oberfläche', minuten: 120, vkStunde: 72 }],
  },
]

type Profil = Record<string, string>

export default function BriefpapierVorschau({ profil }: { profil: Profil }) {
  // Die Bausteine mit "immer" gehoeren ins Beispielangebot — sonst zeigt die
  // Vorschau ein Dokument, das es so nie gibt.
  const [bausteine, setBausteine] = useState<Array<{ titel: string; inhalt: string }>>([])
  useEffect(() => {
    let aktiv = true
    void (async () => {
      const r = await fetch('/api/settings/textbausteine')
      if (!r.ok) return
      const j = await r.json().catch(() => ({}))
      if (!aktiv) return
      setBausteine((j.bausteine ?? [])
        .filter((b: { immer?: boolean; aktiv?: boolean }) => b.immer && b.aktiv !== false)
        .map((b: { titel: string; inhalt: string }) => ({ titel: b.titel, inhalt: b.inhalt })))
    })()
    return () => { aktiv = false }
  }, [])

  const html = useMemo(() => {
    return buildPDF(
      BEISPIEL_POSITIONEN, BEISPIEL_KUNDE, 'AN-2026-041', 'Angebot',
      String(profil.angebot_einleitung ?? '')
        || 'vielen Dank für Ihre Anfrage und das Interesse an unserer Arbeit.\n\nGerne unterbreiten wir Ihnen nachfolgendes Angebot. Alle Positionen sind auf Basis Ihrer Angaben kalkuliert.',
      true,
      // EINE Zuordnung fuer Vorschau und echtes Angebot (src/lib/pdfoptionen.ts).
      // Vorher baute jede ihre eigene — und drei neue Einstellungen wirkten im
      // Angebot, aber nicht hier. Die Vorschau zeigte etwas anderes als das Dokument.
      pdfTextOptionen(profil, {
        basisUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
        bausteine,
      }),
      pdfFirmaOptionen(profil),
    )
      // Skripte aus dem Vorschau-HTML entfernen — hier wird fremder Text gerendert
      // (eigene Bausteine des Nutzers), und der darf nichts ausführen.
      .replace(/<script[\s\S]*?<\/script>/gi, '')
  }, [profil, bausteine])

  // Fabian am 2026-09-08: "Die Vorschau finde ich gut, aber sehr klein. Hier kann man
  // kaum etwas erkennen." Stimmt — in der Spalte neben den Bedienelementen ist ein
  // A4-Blatt auf 43 % gestaucht. Deshalb zwei Stufen und ein Vollbild.
  const [gross, setGross] = useState(false)

  // A4 ist 794 px breit. transform:scale verkleinert nur die DARSTELLUNG, der
  // Platzbedarf im Layout bleibt — der Rahmen muss ihn also abschneiden.
  const A4_BREIT = 794
  const A4_HOCH = 1123
  const spaltenBreite = 340
  const kleinMassstab = spaltenBreite / A4_BREIT

  // Der Massstab wird uebergeben, nicht aus `gross` abgeleitet: Sonst waere die
  // kleine Vorschau in der Spalte mit vergroessert, sobald das Vollbild offen ist.
  const blatt = (hoehe: number, massstab: number, feste: boolean) => (
    <div style={{
      border: '1px solid #2E2E2E', borderRadius: 8, overflow: 'hidden',
      background: '#e8e8e8', height: hoehe,
      width: feste ? Math.round(A4_BREIT * massstab) + 2 : '100%',
      maxWidth: feste ? '100%' : spaltenBreite,
    }}>
      <iframe
        title="Vorschau des Angebots"
        srcDoc={html}
        sandbox=""
        style={{
          border: 'none', display: 'block',
          width: A4_BREIT, height: Math.ceil(hoehe / massstab),
          transform: `scale(${massstab})`, transformOrigin: 'top left',
        }}
      />
    </div>
  )

  return (
    <div>
      {gross && (
        // Vollbild: A4 fast in Originalgroesse, scrollbar. Zum Korrekturlesen —
        // genau das war Constantins Anliegen ("Fehler fallen mir in der
        // Druckansicht besser auf").
        <div
          onClick={() => setGross(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,.82)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '18px 16px', overflow: 'auto',
          }}
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexShrink: 0 }}>
            <div style={{ color: '#C8885A', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' }}>
              Vorschau — Beispielangebot
            </div>
            <button
              onClick={e => { e.stopPropagation(); setGross(false) }}
              style={{ background: 'transparent', color: '#8A8A8A', border: '1px solid #2E2E2E',
                borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer',
                fontFamily: 'Helvetica Neue,sans-serif' }}
            >
              Schließen
            </button>
          </div>
          <div onClick={e => e.stopPropagation()} style={{ flexShrink: 0 }}>
            {blatt(Math.ceil(A4_HOCH * 0.92), 0.92, true)}
          </div>
        </div>
      )}

      <div style={{
        fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
        color: '#8A8A8A', marginBottom: 8,
      }}>
        Vorschau — Beispielangebot
      </div>
      {blatt(520, kleinMassstab, false)}
      <button
        onClick={() => setGross(true)}
        style={{ marginTop: 8, width: '100%', background: 'transparent', color: '#C8885A',
          border: '1px solid #2E2E2E', borderRadius: 6, padding: '9px 0', fontSize: 12,
          cursor: 'pointer', fontFamily: 'Helvetica Neue,sans-serif' }}
      >
        ⤢ Groß anzeigen
      </button>
      <div style={{ fontSize: 11, color: '#7A7A7A', marginTop: 8, lineHeight: 1.6 }}>
        Beispieldaten. Das Angebot zeigt eine Gruppe mit Unterpositionen, eine
        Alternativposition und eine Position mit Stückzahl — damit jede Einstellung
        hier sichtbar wird. Änderungen greifen sofort, gespeichert wird erst mit
        &bdquo;Speichern&ldquo;.
      </div>
    </div>
  )
}
