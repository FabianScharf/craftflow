# Lernabfrage im Chat — Design

**Datum:** 2026-09-05 · **Status:** von Fabian freigegeben, Umsetzungsplan folgt
**Ersetzt:** den Speichern-Dialog aus `2026-07-31-lernfunktion-bauweise-vault-design.md`

## Warum

Der Bauweise-Vault funktioniert (Live-Test 2026-09-05, alle sechs Schritte bestanden).
Beim ersten praktischen Einsatz hat Fabian den Lern-Dialog aber als am falschen Ort
empfunden: Er erscheint beim Speichern, also lange nachdem die Entscheidung im Chat
gefallen ist. Im Chat sagt die KI bereits "Ich merke mir das" — eingelöst wird das
erst Schritte später in einem Fenster.

Damit wird die Entscheidung vom 2026-07-31 ("gesammelt beim Speichern, ein Dialog")
bewusst revidiert. Grundlage ist Praxiserfahrung, nicht Theorie.

## Entscheidungen von Fabian (2026-09-05)

| Frage | Entscheidung |
|---|---|
| Zeitpunkt | Die KI fragt selbst im Chat, direkt in ihrer Antwort |
| Umfang | **Nur der Chat lernt.** Stumme Feldaenderungen loesen nichts mehr aus |
| Speichern-Dialog | Faellt ersatzlos weg |
| Beleg-Strenge | Lockerer: woertliche Aussage **oder** nachweislich wiederholte Aenderung |
| Gedaechtnis | Nur innerhalb des laufenden Angebots. Angebotsuebergreifend spaeter, wenn die Praxis es verlangt |

## Wie es sich anfuehlt

```
DU:  Rueckwand bitte in 8mm Spanplatte

KI:  Rueckwand auf 8 mm Spanplatte geaendert.
     Der Materialpreis sinkt um 12 EUR.

     Du hast Rueckwaende jetzt zum zweiten Mal in diesem
     Angebot auf Spanplatte geaendert. Soll ich mir das
     als deinen Standard merken?

DU:  ja

KI:  Gemerkt. Gilt ab dem naechsten Angebot.
     Aenderbar unter Einstellungen -> Meine Bauweise.
```

## Aufbau

### Auesserer Ablauf

1. `/api/optimize` bekommt zusaetzlich: die bestehenden Regeln des Nutzers, den Diff
   gegenueber dem ersten KI-Vorschlag und einen Zaehler je Merkmal (wie oft wurde
   dasselbe in diesem Angebot schon geaendert).
2. Erkennt die KI einen Standard-Kandidaten, haengt sie **eine** Frage an ihre Antwort.
   Nie mehr als eine pro Antwort — sonst wird der Chat zum Fragebogen.

   *Was als "dasselbe Merkmal" zaehlt:* eine Materialzeile mit gleicher Funktion im
   Angebot, erkannt ueber den Diff-Eintrag — also z. B. "die Rueckwand", unabhaengig
   davon, in welcher Position sie steckt. Nicht der exakte Wortlaut der Bezeichnung.
3. Antwortet der Nutzer zustimmend, ruft die KI im naechsten Zug das Werkzeug
   `regel_merken` auf. **Kein Deuten von Freitext** — die Zustimmung wird zur Aktion.
4. Der Server prueft, speichert und gibt das Ergebnis als Werkzeug-Antwort zurueck.
   Die KI bestaetigt in ihrer naechsten Aeusserung.

### Das Werkzeug

`regel_merken` mit `strict: true`, damit die Argumente garantiert dem Schema
entsprechen. Felder: `bereich`, `wenn`, `dann`, `quelle` (woertlich | wiederholung).

### Der Erfindungsschutz — die zentrale Sicherung

Weil der woertliche Beleg entfaellt, wandert die Pruefung auf den Server. Vor dem
Speichern wird geprueft:

- Der **Inhalt** von `dann` muss in der tatsaechlichen Kalkulation oder woertlich im
  Chatverlauf vorkommen. Erfundene Materialien, Holzarten, Kunden, Orte, Ereignisse
  oder Zahlen werden abgelehnt.
- Abgeleitet werden darf ausschliesslich die **Absicht** ("das ist dein Standard"),
  niemals der **Inhalt**.
- Wird abgelehnt, bekommt die KI eine Fehlermeldung als Werkzeug-Antwort und darf es
  nicht stillschweigend erneut versuchen.

Diese Grenze ist dieselbe, die im Projekt `stimme` gerissen ist, als das Modell eine
Holzart und eine persoenliche Anekdote dazuerfunden hat. Siehe die Vault-Notiz
"KI erfindet Fakten".

### Die KI darf nichts zusagen, was das System nicht kann

Befund vom 2026-09-06, im Praxiseinsatz aufgefallen. Fabian schrieb: "Der Blum Movento
kostet mich 26,27 EUR, aendere den Preis und merke dir das fuer die Zukunft."
Die KI antwortete: "Blum Movento EK-Preis auf 26,27 EUR aktualisiert — merke ich mir
fuer kuenftige Angebote."

**Das war falsch.** Der Lernmechanismus vergleicht ausschliesslich `bezeichnung` und
`menge` (`LernMaterial` in `src/lib/learn.ts`); Einkaufspreise kommen im Diff nicht vor.
Zusaetzlich gilt die Engine-Invariante: der Vault beeinflusst nie `vkStunde`,
`aufschlag` oder Preise. Die Zusage war strukturell uneinloesbar.

Ein zu frueh gegebenes Versprechen ist aergerlich; ein falsches fuehrt den Nutzer in die
Irre und beschaedigt die Kalkulation, auf die er sich verlaesst.

**Anforderung:** Der System-Prompt von `optimize` muss der KI ausdruecklich verbieten,
Merken zuzusagen, wo der Vault nicht greift — namentlich bei Einkaufspreisen,
Stundensaetzen und Aufschlaegen. Stattdessen soll sie sagen, dass sie das fuer dieses
Angebot uebernimmt, sich aber nicht dauerhaft merken kann.

**Offen, eigenes Thema:** Einkaufspreise haben in CraftFlow bislang gar keinen
dauerhaften Ort — `materialgruppen` haelt nur Aufschlaege in Prozent, `suppliers` nur
Lieferanten. Eine gelernte Materialpreisliste waere ein eigenes Feature, kein Teil des
Bauweise-Vaults. Fabian entscheidet, ob das gebaut wird.

### Einkaufspreise fixieren (Anforderung Fabian, 2026-09-06)

> "Auch Einkaufspreise muessen fixiert werden koennen. Es ist nicht praktikabel, wenn
> jedes mal Preise falsch sind, denn diese beeinflussen erheblich die Kalkulation."

Fachlich richtig: Ein falscher EK schlaegt ueber den Aufschlag direkt in den
Verkaufspreis durch. Ein geratener Blum-Preis verfaelscht die Position.

**Getrennter Speicher, gleicher Weg.** Der Bauweise-Vault bleibt preisfrei — die
Engine-Invariante ("der Vault beeinflusst nie vkStunde, aufschlag oder Preise") bleibt
unangetastet. Einkaufspreise bekommen eine eigene Tabelle `materialpreise`
(pro `user_id`, mit RLS wie `bauweise_regeln`):

| Spalte | Zweck |
|---|---|
| `bezeichnung` | Wonach gematcht wird, z. B. "Blum Movento Softclose-Auszug" |
| `ek` | Einkaufspreis netto |
| `einheit` | Stk / m2 / lfdm / pauschal |
| `lieferant` | optional, frei |
| `stand` | Datum der letzten Bestaetigung — **Pflicht**, siehe unten |

**Warum ein Datum Pflicht ist:** EK-Preise veralten. Ein 2026 fixierter Preis ist 2028
falsch, und zwar unbemerkt — genau die Sorte Fehler, die eine Kalkulation still
kaputtmacht. Unter *Einstellungen -> Materialpreise* wird jeder Preis mit seinem Stand
angezeigt; Eintraege aelter als 12 Monate werden sichtbar markiert. Es wird nichts
automatisch geloescht und nichts automatisch angepasst — der Nutzer entscheidet.

**Wirkung:** Beim naechsten Angebot bekommt die KI die fixierten Preise als eigenen
Block. Trifft eine Materialbezeichnung zu, gilt der fixierte EK statt eines geratenen.
Der Aufschlag bleibt davon unberuehrt — der kommt weiterhin aus `materialgruppen`.

**Uebersteuerbar:** Ein fixierter Preis ist kein Zwang. Aendert der Nutzer den EK in
einem Angebot, gilt fuer dieses Angebot sein Wert; die KI fragt dann, ob der fixierte
Preis dauerhaft aktualisiert werden soll.

**Kein Erfindungsschutz-Sonderfall:** Wie bei den Regeln muss der Wert aus dem
Chatverlauf oder der Kalkulation stammen. Einen EK darf die KI nie selbst ausdenken
und fixieren.

### Fehler muessen sichtbar sein

Ausdrueckliche Anforderung aus dem Test vom 2026-09-05: Schlaegt das Speichern fehl,
muss der Nutzer **erfahren, woran es lag**. Die bisherige Meldung "Eine Regel konnte
nicht gespeichert werden" hat die eigentliche Ursache (fehlende Tabellenrechte)
verschluckt und rund 20 Minuten Suche gekostet. Der Grund aus der Serverantwort
gehoert in den Chat.

### Was wegfaellt

- Der Dialog beim Speichern samt Zustand im Frontend (`lernKandidaten`, `lernAuswahl`,
  `lernWenn`, `lernErledigt`, `lernDialogSchliessen`, `pruefeLernkandidaten`).
- `POST /api/learn/candidates` als eigener KI-Aufruf. **Der Umbau senkt die Kosten:**
  bisher lief bei jedem Speichern ein zusaetzlicher Aufruf, kuenftig keiner.
- Der Aufhaenger an der PDF-Rueckkehr.

### Was bleibt unveraendert

- `bauweise_regeln`, RLS und die Trennung je `user_id`.
- Der Regelblock als letzter Anhang am System-Prompt von `analyze` und `optimize`.
- `Einstellungen -> Meine Bauweise` als Ort zum Ansehen, Aendern und Abschalten.
- Der Vault beeinflusst nie `vkStunde`, `aufschlag` oder Preise.
- Lernen darf Speichern und PDF-Export nie blockieren.

## Bewusst nicht Teil dieses Umbaus

- **Angebotsuebergreifendes Gedaechtnis.** Erst wenn die Praxis zeigt, dass zu selten
  gefragt wird.
- **Modellwechsel.** Die Routen laufen auf `claude-sonnet-4-6`; aktuell waeren
  `claude-opus-5` / `claude-sonnet-5`. Eigene Entscheidung mit eigenen Kosten,
  wird getrennt vorgelegt.
- **Die Registrierungs-Probleme** (Bestaetigungsmail, toter Bestaetigungslink,
  Testphase schaltet nicht frei). Eigener Arbeitsblock, geschaeftlich dringender.

## Pruefkriterien

1. Sage ich einmal "Rueckwand bitte Multiplex", fragt die KI **nicht**.
2. Sage ich "Rueckwand mache ich immer in Multiplex", fragt sie — und speichert nach ja.
3. Aendere ich dasselbe Merkmal zweimal im selben Angebot, fragt sie beim zweiten Mal.
4. Nie mehr als eine Frage pro Antwort.
5. Eine Regel mit erfundenem Inhalt wird serverseitig abgelehnt.
6. Schlaegt das Speichern fehl, steht der Grund im Chat.
7. Beim Speichern des Angebots erscheint kein Dialog mehr.
8. Ein zweites Konto sieht die Regeln nicht (Trennungstest erneut).
9. Sage ich "Der Blum Movento kostet mich 26,27 EUR, merk dir das", wird der Preis
   fixiert — und taucht im naechsten Angebot mit 26,27 EUR auf.
10. Unter Einstellungen -> Materialpreise steht der Preis mit Datum und ist aenderbar.
11. Ein zweites Konto sieht die Materialpreise nicht.
12. Die KI sagt nie "merke ich mir", wo sie es nicht kann (Stundensaetze, Aufschlaege).
