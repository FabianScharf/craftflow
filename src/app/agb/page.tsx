import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'AGB — CraftFlow' }

const VERSION = '2026-07'

const st = {
  page:    { background: '#0D0D0D', color: '#F5F2EE', fontFamily: 'system-ui, sans-serif', minHeight: '100vh', lineHeight: 1.65 } as React.CSSProperties,
  nav:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid #1E1E1E' } as React.CSSProperties,
  logo:    { fontWeight: 600, fontSize: 15, color: '#F5F2EE', textDecoration: 'none' } as React.CSSProperties,
  copper:  { color: '#C8885A' } as React.CSSProperties,
  back:    { fontSize: 13, color: '#8A8A8A', textDecoration: 'none' } as React.CSSProperties,
  wrap:    { maxWidth: 680, margin: '0 auto', padding: '56px 24px 80px' } as React.CSSProperties,
  label:   { fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: '#8A8A8A', marginBottom: 12 },
  h1:      { fontSize: 28, fontWeight: 600, color: '#F5F2EE', marginBottom: 6, letterSpacing: '-0.01em' } as React.CSSProperties,
  sub:     { fontSize: 13, color: '#8A8A8A', marginBottom: 44 } as React.CSSProperties,
  section: { marginBottom: 32 } as React.CSSProperties,
  h2:      { fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#C8885A', marginBottom: 10 },
  p:       { fontSize: 14, color: '#8A8A8A', lineHeight: 1.75, marginBottom: 10 } as React.CSSProperties,
  hi:      { color: '#F5F2EE', fontWeight: 600 } as React.CSSProperties,
  divider: { height: 1, background: '#1E1E1E', margin: '32px 0' } as React.CSSProperties,
  table:   { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13, marginTop: 8 } as React.CSSProperties,
  th:      { textAlign: 'left' as const, color: '#F5F2EE', fontWeight: 600, padding: '6px 12px 6px 0', borderBottom: '1px solid #1E1E1E', fontSize: 12 },
  td:      { color: '#8A8A8A', padding: '8px 12px 8px 0', borderBottom: '1px solid #1A1A1A', verticalAlign: 'top' as const },
}

const Hi = ({ children }: { children: React.ReactNode }) => <span style={st.hi}>{children}</span>
const Link = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} style={{ color: '#C8885A' }}>{children}</a>
)

export default function AGB() {
  return (
    <div style={st.page}>
      <nav style={st.nav}>
        <a href="/" style={st.logo}>Craft<span style={st.copper}>Flow</span></a>
        <a href="/" style={st.back}>← Zurück</a>
      </nav>

      <div style={st.wrap}>
        <p style={st.label}>Rechtliches</p>
        <h1 style={st.h1}>Allgemeine Geschäftsbedingungen</h1>
        <p style={st.sub}>
          Version {VERSION} · FS Crafted — Fabian Scharf
        </p>

        {/* § 1 */}
        <div style={st.section}>
          <p style={st.h2}>§ 1 — Geltungsbereich</p>
          <p style={st.p}>
            Diese Allgemeinen Geschäftsbedingungen (nachfolgend <Hi>„AGB"</Hi>) gelten für
            alle Verträge zwischen <Hi>FS Crafted — Fabian Scharf</Hi>, Fuldaer Straße 15,
            63517 Rodenbach (nachfolgend <Hi>„Anbieter"</Hi>) und Nutzern der Software
            CraftFlow (nachfolgend <Hi>„Nutzer"</Hi>).
          </p>
          <p style={st.p}>
            CraftFlow richtet sich ausschließlich an <Hi>Unternehmer im Sinne von § 14 BGB</Hi>
            {' '}(B2B). Die Nutzung durch Verbraucher im Sinne von § 13 BGB ist ausgeschlossen.
          </p>
          <p style={st.p}>
            Abweichende Bedingungen des Nutzers finden keine Anwendung, es sei denn, der
            Anbieter stimmt diesen ausdrücklich schriftlich zu.
          </p>
        </div>

        <div style={st.divider} />

        {/* § 2 */}
        <div style={st.section}>
          <p style={st.h2}>§ 2 — Leistungsbeschreibung</p>
          <p style={st.p}>
            CraftFlow ist eine cloudbasierte Software-as-a-Service-Lösung (SaaS) zur
            KI-gestützten Angebotserstellung für Schreiner, Tischler und verwandte Handwerksbetriebe.
            Der Anbieter stellt dem Nutzer folgende Kernfunktionen zur Verfügung:
          </p>
          <p style={st.p}>
            — KI-gestützte Kalkulation von Handwerksangeboten auf Basis von Texteingaben,
            Fotos und Beschreibungen<br />
            — Verwaltung und Speicherung von Projekten und Kalkulationen<br />
            — Erstellung von Angebots-PDFs im Corporate-Design des Nutzers<br />
            — KI-Optimierungschat zur Verfeinerung bestehender Kalkulationen<br />
            — Export von Kalkulationsdaten (CSV, Excel, JSON, GAEB je nach Plan)<br />
            — Lieferantenanfragen per E-Mail
          </p>
          <p style={st.p}>
            Der Anbieter erbringt die Leistung mit einer angestrebten Verfügbarkeit von
            <Hi> 99 % im Jahresmittel</Hi>, ausgenommen geplante Wartungsarbeiten. Ein Rechtsanspruch
            auf eine bestimmte Verfügbarkeit besteht nicht, sofern nichts anderes schriftlich
            vereinbart wurde.
          </p>
          <p style={st.p}>
            Der Anbieter behält sich vor, den Funktionsumfang von CraftFlow weiterzuentwickeln,
            zu ändern oder einzelne Funktionen einzustellen, sofern dies dem Nutzer zumutbar ist.
            Wesentliche Einschränkungen des vertraglich vereinbarten Funktionsumfangs werden
            mit einer Frist von <Hi>30 Tagen</Hi> angekündigt.
          </p>
        </div>

        <div style={st.divider} />

        {/* § 3 */}
        <div style={st.section}>
          <p style={st.h2}>§ 3 — Vertragsschluss und Registrierung</p>
          <p style={st.p}>
            Der Vertrag kommt durch die Registrierung des Nutzers und die Bestätigung der
            E-Mail-Adresse zustande. Mit der Registrierung akzeptiert der Nutzer diese AGB,
            die <Link href="/datenschutz">Datenschutzerklärung</Link> sowie den{' '}
            <Link href="/avv">Auftragsverarbeitungsvertrag (AVV)</Link>.
          </p>
          <p style={st.p}>
            Der Nutzer ist verpflichtet, bei der Registrierung wahrheitsgemäße Angaben zu
            machen und diese aktuell zu halten. Pro Unternehmen ist grundsätzlich ein Konto
            vorgesehen; weitere Nutzerkonten richten sich nach dem gebuchten Plan.
          </p>
          <p style={st.p}>
            Der Nutzer ist für die Sicherheit seiner Zugangsdaten verantwortlich. Unbefugte
            Nutzung des Kontos ist dem Anbieter unverzüglich zu melden.
          </p>
        </div>

        <div style={st.divider} />

        {/* § 4 */}
        <div style={st.section}>
          <p style={st.h2}>§ 4 — Pläne, Preise und Zahlungsbedingungen</p>
          <p style={st.p}>
            CraftFlow wird in verschiedenen Plänen angeboten. Die jeweils aktuellen Preise
            und enthaltenen Leistungen sind in der App unter <Hi>Einstellungen → Mein Plan</Hi>{' '}
            einsehbar. Alle Preise verstehen sich in Euro, <Hi>netto zzgl. der gesetzlichen
            Mehrwertsteuer</Hi>.
          </p>
          <table style={st.table}>
            <thead>
              <tr>
                <th style={st.th}>Plan</th>
                <th style={st.th}>Abrechnung</th>
                <th style={st.th}>Zahlungsweise</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Solo', 'Monatlich oder jährlich', 'Kreditkarte / SEPA via Stripe'],
                ['Team', 'Monatlich oder jährlich', 'Kreditkarte / SEPA via Stripe'],
                ['Enterprise', 'Jährlich', 'Kreditkarte / SEPA / Rechnung auf Anfrage'],
              ].map(([plan, abrechnung, zahlung]) => (
                <tr key={plan}>
                  <td style={st.td}><Hi>{plan}</Hi></td>
                  <td style={st.td}>{abrechnung}</td>
                  <td style={st.td}>{zahlung}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ ...st.p, marginTop: 12 }}>
            Die Zahlung wird jeweils zu Beginn des Abrechnungszeitraums fällig. Bei
            fehlgeschlagener Zahlung ist der Anbieter berechtigt, den Zugang zur Software
            nach einer Nachfrist von <Hi>7 Tagen</Hi> zu sperren. Gespeicherte Projektdaten
            bleiben für weitere 30 Tage abrufbar.
          </p>
          <p style={st.p}>
            Preisänderungen werden dem Nutzer mindestens <Hi>30 Tage im Voraus</Hi> per
            E-Mail mitgeteilt. Widerspricht der Nutzer nicht innerhalb dieser Frist, gilt
            die Preisänderung als akzeptiert. Bei Widerspruch hat der Nutzer das Recht zur
            außerordentlichen Kündigung zum Zeitpunkt des Inkrafttretens der Preisänderung.
          </p>
        </div>

        <div style={st.divider} />

        {/* § 5 */}
        <div style={st.section}>
          <p style={st.h2}>§ 5 — Testphase</p>
          <p style={st.p}>
            Neuen Nutzern kann eine kostenlose Testphase gewährt werden. Umfang und Dauer
            der Testphase werden bei der Registrierung oder in der App kommuniziert. Nach
            Ablauf der Testphase wechselt der Zugang automatisch in den Basis-Funktionsumfang,
            sofern kein kostenpflichtiger Plan aktiviert wurde.
          </p>
          <p style={st.p}>
            Während der Testphase gilt diese AGB vollumfänglich. Eine Verpflichtung zur
            Buchung eines kostenpflichtigen Plans entsteht durch die Testphase nicht.
          </p>
        </div>

        <div style={st.divider} />

        {/* § 6 */}
        <div style={st.section}>
          <p style={st.h2}>§ 6 — Laufzeit und Kündigung</p>
          <p style={st.p}>
            Monatliche Pläne verlängern sich automatisch um einen weiteren Monat, sofern
            nicht mit einer Frist von <Hi>7 Tagen vor Ablauf</Hi> gekündigt wird. Jährliche
            Pläne verlängern sich automatisch um ein weiteres Jahr, sofern nicht mit einer
            Frist von <Hi>30 Tagen vor Ablauf</Hi> gekündigt wird.
          </p>
          <p style={st.p}>
            Die Kündigung erfolgt durch den Nutzer selbst in der App unter{' '}
            <Hi>Einstellungen → Mein Plan</Hi> oder per E-Mail an{' '}
            <Link href="mailto:anfrage@fscrafted.de">anfrage@fscrafted.de</Link>.
          </p>
          <p style={st.p}>
            Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt.
            Ein wichtiger Grund liegt insbesondere vor bei:
          </p>
          <p style={st.p}>
            — Zahlungsverzug von mehr als 30 Tagen trotz Mahnung<br />
            — Schwerwiegendem oder wiederholtem Verstoß gegen diese AGB<br />
            — Nutzung der Software für rechtswidrige Zwecke
          </p>
          <p style={st.p}>
            Nach Vertragsende werden alle Projektdaten des Nutzers innerhalb von
            <Hi> 30 Tagen</Hi> unwiderruflich gelöscht (vgl. AVV § 7). Der Nutzer ist
            verantwortlich, vor Kündigung alle benötigten Daten zu exportieren.
          </p>
        </div>

        <div style={st.divider} />

        {/* § 7 */}
        <div style={st.section}>
          <p style={st.h2}>§ 7 — Nutzungsbeschränkungen und Pflichten des Nutzers</p>
          <p style={st.p}>Der Nutzer verpflichtet sich:</p>
          <p style={st.p}>
            — CraftFlow ausschließlich für rechtmäßige geschäftliche Zwecke zu nutzen<br />
            — Keine automatisierten Abfragen, Scraping oder Massenanfragen durchzuführen<br />
            — Die Software nicht zu reverse-engineeren, zu kopieren oder weiterzuverkaufen<br />
            — Zugangsdaten nicht an Dritte weiterzugeben, es sei denn, der Plan sieht
            Mehrnutzer ausdrücklich vor<br />
            — Keine falschen oder irreführenden Informationen in die Software einzugeben
          </p>
          <p style={st.p}>
            Bei Verstößen ist der Anbieter berechtigt, den Zugang unverzüglich zu sperren
            und den Vertrag außerordentlich zu kündigen. Schadensersatzansprüche bleiben
            vorbehalten.
          </p>
        </div>

        <div style={st.divider} />

        {/* § 8 */}
        <div style={st.section}>
          <p style={st.h2}>§ 8 — KI-Ergebnisse und Haftungsausschluss für Kalkulationen</p>
          <p style={st.p}>
            Die von CraftFlow erzeugten Kalkulationen und Angebote basieren auf
            KI-Modellen und stellen <Hi>Vorschläge und Richtwerte</Hi> dar. Sie ersetzen
            nicht die fachkundige Prüfung durch den Nutzer.
          </p>
          <p style={st.p}>
            Der Nutzer ist allein verantwortlich für die Überprüfung, Freigabe und
            Verwendung aller durch CraftFlow erstellten Kalkulationen, Angebote und
            Dokumente. Der Anbieter übernimmt <Hi>keine Haftung</Hi> für:
          </p>
          <p style={st.p}>
            — Kalkulationsfehler, die auf unvollständigen oder falschen Eingaben des
            Nutzers beruhen<br />
            — Wirtschaftliche Schäden durch Angebote, die auf Basis der KI-Ergebnisse
            erstellt wurden<br />
            — Abweichungen zwischen KI-Schätzungen und tatsächlichem Aufwand
          </p>
        </div>

        <div style={st.divider} />

        {/* § 9 */}
        <div style={st.section}>
          <p style={st.h2}>§ 9 — Haftung des Anbieters</p>
          <p style={st.p}>
            Der Anbieter haftet unbeschränkt für Schäden aus der Verletzung des Lebens,
            des Körpers oder der Gesundheit sowie für Schäden, die auf Vorsatz oder grober
            Fahrlässigkeit beruhen.
          </p>
          <p style={st.p}>
            Bei leichter Fahrlässigkeit haftet der Anbieter nur bei Verletzung einer
            wesentlichen Vertragspflicht (Kardinalpflicht), und zwar begrenzt auf den
            vorhersehbaren, typischen Schaden. Die Haftung ist in diesem Fall auf den
            <Hi> Betrag der vom Nutzer im letzten Monat geleisteten Zahlungen</Hi>, mindestens
            jedoch auf <Hi>100 €</Hi>, begrenzt.
          </p>
          <p style={st.p}>
            Für den Verlust von Daten haftet der Anbieter nur, wenn der Nutzer zuvor
            angemessene Datensicherungsmaßnahmen getroffen hat. Der Anbieter stellt
            automatische Datenbankbackups bereit; eine Wiederherstellung von mehr als
            24 Stunden zurückliegenden Daten ist nicht garantiert.
          </p>
        </div>

        <div style={st.divider} />

        {/* § 10 */}
        <div style={st.section}>
          <p style={st.h2}>§ 10 — Geistiges Eigentum</p>
          <p style={st.p}>
            CraftFlow, einschließlich aller Designs, Algorithmen, KI-Modelle, Texte und
            Grafiken, ist urheberrechtlich geschützt und Eigentum von FS Crafted.
          </p>
          <p style={st.p}>
            Dem Nutzer wird für die Dauer des Vertragsverhältnisses ein{' '}
            <Hi>nicht-exklusives, nicht übertragbares Nutzungsrecht</Hi> an CraftFlow
            eingeräumt, beschränkt auf den vereinbarten Nutzungsumfang.
          </p>
          <p style={st.p}>
            Inhalte, die der Nutzer in CraftFlow eingibt (Texte, Projektdaten, Logos),
            verbleiben im Eigentum des Nutzers. Der Nutzer räumt dem Anbieter die
            notwendigen Rechte ein, diese Inhalte zur Erbringung des Dienstes zu
            verarbeiten und zu speichern.
          </p>
        </div>

        <div style={st.divider} />

        {/* § 11 */}
        <div style={st.section}>
          <p style={st.h2}>§ 11 — Datenschutz und AVV</p>
          <p style={st.p}>
            Die Verarbeitung personenbezogener Daten richtet sich nach der{' '}
            <Link href="/datenschutz">Datenschutzerklärung</Link> und dem{' '}
            <Link href="/avv">Auftragsverarbeitungsvertrag (AVV)</Link>, die beide
            Bestandteil dieses Vertrags sind.
          </p>
        </div>

        <div style={st.divider} />

        {/* § 12 */}
        <div style={st.section}>
          <p style={st.h2}>§ 12 — Änderungen der AGB</p>
          <p style={st.p}>
            Der Anbieter behält sich vor, diese AGB mit einer Ankündigungsfrist von
            mindestens <Hi>30 Tagen</Hi> zu ändern. Die Ankündigung erfolgt per E-Mail
            an die hinterlegte Adresse des Nutzers.
          </p>
          <p style={st.p}>
            Widerspricht der Nutzer den geänderten AGB nicht innerhalb von 30 Tagen nach
            Zugang der Ankündigung, gelten die geänderten AGB als akzeptiert. Auf diese
            Folge wird in der Ankündigung ausdrücklich hingewiesen.
          </p>
          <p style={st.p}>
            Bei Widerspruch hat der Nutzer das Recht zur außerordentlichen Kündigung zum
            Zeitpunkt des Inkrafttretens der Änderung. In diesem Fall erstattet der Anbieter
            anteilig bereits gezahlte Beträge für nicht genutzte Zeiträume.
          </p>
        </div>

        <div style={st.divider} />

        {/* § 13 */}
        <div style={st.section}>
          <p style={st.h2}>§ 13 — Anwendbares Recht und Gerichtsstand</p>
          <p style={st.p}>
            Es gilt das Recht der <Hi>Bundesrepublik Deutschland</Hi> unter Ausschluss des
            UN-Kaufrechts (CISG).
          </p>
          <p style={st.p}>
            Gerichtsstand für alle Streitigkeiten aus diesem Vertrag ist{' '}
            <Hi>Hanau</Hi> (Landgericht Hanau / Amtsgericht Hanau), sofern der Nutzer
            Kaufmann, juristische Person des öffentlichen Rechts oder öffentlich-rechtliches
            Sondervermögen ist.
          </p>
        </div>

        <div style={st.divider} />

        {/* § 14 */}
        <div style={st.section}>
          <p style={st.h2}>§ 14 — Salvatorische Klausel</p>
          <p style={st.p}>
            Sollten einzelne Bestimmungen dieser AGB ganz oder teilweise unwirksam sein
            oder werden, berührt dies die Wirksamkeit der übrigen Bestimmungen nicht. Die
            unwirksame Bestimmung ist durch eine wirksame zu ersetzen, die dem wirtschaftlichen
            Zweck der unwirksamen Bestimmung am nächsten kommt.
          </p>
        </div>

        <div style={st.divider} />

        <div style={st.section}>
          <p style={{ ...st.p, fontSize: 12, fontStyle: 'italic' }}>
            Fragen zu diesen AGB:{' '}
            <Link href="mailto:anfrage@fscrafted.de">anfrage@fscrafted.de</Link>
            {' '}· Version {VERSION} · FS Crafted — Fabian Scharf, Rodenbach
          </p>
        </div>

      </div>
    </div>
  )
}
