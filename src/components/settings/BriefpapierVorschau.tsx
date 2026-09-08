'use client'

import { useMemo } from 'react'
import { buildPDF, type SchriftId } from '@/lib/pdf'
import type { Angebotsposition, Kunde } from '@/lib/types'

// Lebende Vorschau neben den Einstellungen.
//
// WARUM: Der Briefpapier-Reiter hat rund zwanzig Bedienelemente, und Constantin
// Ludewigt hat in seiner Rückmeldung vom 2026-08-26 kein einziges davon gefunden —
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

const BEISPIEL_KUNDE: Kunde = {
  name: 'Constantin Ludewigt',
  zusatz: '',
  strasse: 'Grenzstraße 13',
  ort: '06112 Halle (Saale)',
  projekt: 'Flurschrank und Garderobe',
  anrede: 'Herr',
  nachname: 'Ludewigt',
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
  const html = useMemo(() => {
    const an = (k: string) => profil[k] === 'true'
    const zahl = (k: string, standard: number) => {
      const n = Number(profil[k])
      return Number.isFinite(n) && n > 0 ? n : standard
    }
    const eigenes = an('pdf_eigenes_briefpapier') && !!profil.pdf_briefpapier_url

    return buildPDF(
      BEISPIEL_POSITIONEN, BEISPIEL_KUNDE, 'AN-2026-041', 'Angebot',
      profil.angebot_einleitung
        || 'vielen Dank für Ihre Anfrage und das Interesse an unserer Arbeit.\n\nGerne unterbreiten wir Ihnen nachfolgendes Angebot. Alle Positionen sind auf Basis Ihrer Angaben kalkuliert.',
      true,
      {
        anredeVorlage: profil.anrede_vorlage || undefined,
        nachtext: profil.angebot_abschluss || undefined,
        widerrufText: profil.widerrufsbelehrung_text || undefined,
        zahlungText: profil.zahlungskonditionen_text || undefined,
        hinweis: profil.pdf_hinweis || undefined,
        logoUrl: profil.logo_url || undefined,
        layout: profil.pdf_layout === 'kompakt' ? 'kompakt' : 'klassisch',
        schriftart: (profil.pdf_schriftart as SchriftId) || 'opensans',
        // Dieselbe Adresse wie im echten PDF — sonst zeigt die Vorschau eine
        // andere Schrift als das Dokument.
        basisUrl: typeof window !== 'undefined' ? window.location.origin : undefined,
        zeigeMenge: an('pdf_zeige_menge'),
        zeigeEinheitspreis: an('pdf_zeige_einheitspreis'),
        zeigeMassivholz: profil.pdf_zeige_massivholz !== 'false',
        massivholzText: profil.pdf_massivholz_text || undefined,
        zeigeUnterschrift: profil.pdf_zeige_unterschrift !== 'false',
        unterschriftText: profil.pdf_unterschrift_text || undefined,
        zeigeBic: an('pdf_zeige_bic'),
        zeigeTelefon: an('pdf_zeige_telefon'),
        zeigeWebsite: an('pdf_zeige_website'),
        eigeneBriefpapier: eigenes,
        margins: eigenes ? {
          top: zahl('pdf_margin_top', 45), bottom: zahl('pdf_margin_bottom', 30),
          left: zahl('pdf_margin_left', 20), right: zahl('pdf_margin_right', 20),
        } : undefined,
      },
      {
        name: profil.firma_name || undefined,
        inhaber: profil.inhaber || undefined,
        strasse: profil.strasse || undefined,
        ort: [profil.plz, profil.ort].filter(Boolean).join(' ') || undefined,
        email: profil.email || undefined,
        ust: profil.ust_id || undefined,
        iban: profil.iban || undefined,
        bank: profil.bank_name || undefined,
        bic: profil.bic || undefined,
        telefon: profil.telefon || undefined,
        website: profil.website || undefined,
        akzentfarbe: profil.farbe_akzent || undefined,
      },
    )
      // Skripte aus dem Vorschau-HTML entfernen — hier wird fremder Text gerendert
      // (eigene Bausteine des Nutzers), und der darf nichts ausführen.
      .replace(/<script[\s\S]*?<\/script>/gi, '')
  }, [profil])

  return (
    <div>
      <div style={{
        fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
        color: '#8A8A8A', marginBottom: 8,
      }}>
        Vorschau — Beispielangebot
      </div>
      {/* 210 mm auf 320 px gestaucht: Man sieht das Seitenbild, nicht den Text.
          Genau darum geht es — Format, Absätze, Logo, Schrift. */}
      <div style={{
        border: '1px solid #2E2E2E', borderRadius: 8, overflow: 'hidden',
        background: '#e8e8e8', height: 520, width: '100%', maxWidth: 340,
      }}>
        {/* A4 ist 794 px breit. Die Skalierung verkleinert nur die Darstellung, der
            Platzbedarf im Layout bleibt — deshalb muss der Rahmen ihn abschneiden,
            sonst ragt der iframe in die Bedienelemente hinein. */}
        <iframe
          title="Vorschau des Angebots"
          srcDoc={html}
          sandbox=""
          style={{
            border: 'none', display: 'block',
            width: 794, height: 1220,
            transform: 'scale(0.428)', transformOrigin: 'top left',
          }}
        />
      </div>
      <div style={{ fontSize: 11, color: '#7A7A7A', marginTop: 8, lineHeight: 1.6 }}>
        Beispieldaten. Das Angebot zeigt eine Gruppe mit Unterpositionen, eine
        Alternativposition und eine Position mit Stückzahl — damit jede Einstellung
        hier sichtbar wird. Änderungen greifen sofort, gespeichert wird erst mit
        &bdquo;Speichern&ldquo;.
      </div>
    </div>
  )
}
