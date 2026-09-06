# Betriebskalibrierung — Design

**Stand:** 2026-09-06 · Entwurf abgestimmt mit Fabian, noch nicht gebaut.

## Warum

Testkunden springen ab. Ein Nutzer meldete „die Preise waren utopisch" und war
danach nicht mehr erreichbar. Andere sagen dasselbe. Gleichzeitig berichtet Fabian
aus der Praxis das Gegenteil: Die Betriebe rechnen mit *zu hohen* Stundensätzen und
*zu wenig* Zeit — und beschweren sich hinterher, dass die Arbeit länger gedauert hat.

Beides zugleich kann stimmen, wenn zwei Rechensysteme vermischt werden.

### Der Rechenfehler in der Methode

Ein Stundensatz nach Handwerkskammer-Art ist auf **produktive** Stunden gerechnet:
monatliche Gesamtkosten ÷ ca. 130–140 produktive Stunden. Suchen, Laden, Rüsten und
Aufräumen stecken oben als Kosten drin und sind unten herausgerechnet. Genau deshalb
ist der Satz so hoch.

CraftFlow schätzt aber **Bruttozeiten**. Fabian zum Testangebot: 8,8 Stunden für
einen kleinen Rollcontainer sei „wahrscheinlich gar nicht so verkehrt, wenn man alles
betrachtet" — also inklusive der unproduktiven Anteile.

Damit wird dieselbe unproduktive Zeit **zweimal bezahlt**: einmal eingepreist im
Stundensatz, einmal als abgerechnete Stunde. Grob 25–30 % zu viel auf der Lohnseite.

Am gemessenen Testangebot (Rollcontainer 450 × 600 × 550 mm):

| | Stunden | Satz | Lohn | Netto |
|---|---|---|---|---|
| Heute | 8,8 h | ⌀ 76 €/h | 675 € | **1.100 €** |
| Bruttozeit × Bruttosatz | 8,8 h | ⌀ 60 €/h | 528 € | **954 €** |
| Nettozeit × Nettosatz | 6,9 h | ⌀ 76 €/h | 528 € | **954 €** |

Die untere Zeile entspricht dem Bauchgefühl des Schreiners, die mittlere der
ehrlichen Betrachtung. Beide kommen auf dieselbe Zahl. Sie widersprechen sich nur in
der Mischung — und die rechnet CraftFlow heute.

**Fabian bestätigt:** „Die meisten kalkulieren reine Produktivitätszeiten." Die
Betriebe denken also in Nettozeit und tragen Nettosätze ein.

### Zwei weitere belegte Ursachen

**Die Maschinen-Kostenstellen gelten für alle.** Im Testangebot entfielen 200 € —
knapp 30 % der Lohnkosten — auf Kantenanleimen (100 €/h) und CNC (120 €/h). Ein
Solo-Betrieb hat weder das eine noch das andere. Niemand sagt ihm, dass er sie
abschalten kann.

**Abschalten löscht die Arbeit.** `src/app/api/analyze/route.ts:623`:

```ts
az = az.filter(a => !deaktiviert.has(a.kostenstelle))
```

Wer CNC abschaltet, verliert die Stunden für die Griffmulden ersatzlos. Das Angebot
wird zu billig, die Arbeit fällt trotzdem an — und erzeugt genau die zweite
Beschwerde. **Die einzige heute vorhandene Stellschraube erzeugt das zweite Problem.**

### Die Zeitschätzung liegt über der eigenen Wissensbasis

Gegenprobe mit den Zeitrichtwerten aus der Projekt-`CLAUDE.md`: Korpus 2,5–4 h, drei
Systemschubladen 1–1,75 h, Fronten 0,5–1 h, Montage 0,75 h, Planung ~1 h — also
**5,5 bis 6,5 h**. CraftFlow sagte 8,8 h, rund 40 % darüber.

## Entscheidungen von Fabian (2026-09-06)

- **Wir bauen für den Markt, nicht fürs Lehrbuch.** Wenn ein Betrieb den
  kostendeckenden Preis nicht durchsetzen kann, rechnet CraftFlow mit *seinem* Wert.
  Der Hinweis auf die Deckung bleibt, als Hinweis, nie als Sperre.
- **Nicht nach dem Stundensatz fragen.** Den kennt der Schreiner nachweislich nicht.
  Auch nicht nach den Monatskosten — die kann er meist nicht beantworten.
- **Stattdessen Referenz-Kalkulation:** fünf kurze Fragen zum Betrieb, dann eine
  vollständig beschriebene Musterbeschreibung mit **Antwortmöglichkeiten** statt
  Freitext. „Was nimmst du für so einen Schrank?" kann jeder beantworten, und die
  Antwort ist per Definition marktfähig.
- **Überspringbar und nachholbar.** Fünf Fragen vor dem ersten Erfolgserlebnis kosten
  Anmeldungen.
- **Mengengeschäft ist ein eigenes Vorhaben**, danach.

## Aufbau

### 1 · Wann

Beim ersten Start: fünf Fragen, dann die Musterbeschreibung. Überspringbar mit
ehrlichem Hinweis („dann rechne ich mit Branchenwerten, das kann daneben liegen").
Jederzeit nachholbar unter *Einstellungen → Mein Betrieb*.

Zweiter Einstieg **vom Ergebnis aus**: Unter jeder Kalkulation steht „Passt der Preis
nicht zu deinem Betrieb? Fünf Fragen, dann rechne ich mit deinen Werten." Der Nutzer
kalibriert dort, wo er den größten Grund dazu hat — genau an der Stelle, an der der
abgesprungene Kunde stattdessen die App geschlossen hat.

### 2 · Die fünf Fragen

1. **Wie viele arbeiten in der Werkstatt mit?** — nur ich · 2–3 · 4–10 · mehr
2. **Welche Maschinen hast du?** (Mehrfachauswahl) — Formatkreissäge ·
   Kantenanleimmaschine · CNC · Lackierkabine · keine davon
3. **Was baust du hauptsächlich?** — Möbel nach Maß · Innenausbau und Einbauschränke ·
   Küchen · Türen und Böden · gemischt
4. **Montierst du selbst beim Kunden?** — immer · manchmal · nie
5. **Einzelstücke oder auch größere Stückzahlen?** — fast nur Einzelstücke · gemischt ·
   oft Serien

Frage 5 rechnet nichts. Sie beantwortet Fabian die Frage, die ihm heute fehlt: wie
viele Nutzer überhaupt Mengengeschäft machen. Das entscheidet den Wert des zweiten
Vorhabens. Die Schreiner sagen ihm das im Gespräch nicht.

### 3 · Die Musterbeschreibung

Ein festes Möbel, vollständig beschrieben. Der Text ist zugleich die **Vorlage**, wie
der Nutzer künftig selbst beschreiben soll — das greift die schlechte Eingabequalität
an derselben Stelle an:

> **Einbauschrank Flur**, 2,00 m breit × 2,40 m hoch × 0,60 m tief.
> Korpus und Fronten Egger Dekorspanplatte 19 mm weiß, Kanten ABS 1 mm.
> 4 Drehtüren mit Topfscharnieren, je Fach 2 Einlegeböden, Sockel 100 mm.
> Rückwand. Lieferung und Montage beim Kunden, 20 km entfernt, Neubau, gerade Wände.

Hervorgehoben werden die fünf Dinge, die CraftFlow immer braucht: **Möbelart, Maße,
Material, Ausstattung, Montage.**

Frage: *Was nimmst du für so einen Schrank, netto?*
◯ unter 1.200 € ◯ 1.200–1.600 € ◯ 1.600–2.100 € ◯ 2.100–2.700 € ◯ über 2.700 €

Darunter sichtbar, nicht im Kleingedruckten: **Diese Angabe sieht niemand außer dir.**
Schreiner reden ungern über ihre Preise; in der eigenen App ist das etwas anderes —
aber nur, wenn das unmissverständlich dasteht.

Die Bänder sind gleichmäßig gespreizt und **nicht** um das eigene Ergebnis herum
gebaut, sonst ankert die Vorgabe die Antwort.

### 4 · Was daraus wird

**Frage 1 und 2** bestimmen, welche Kostenstellen es überhaupt gibt und mit welchen
Startsätzen. Kein CNC im Betrieb heißt: keine CNC-Stunden — die Arbeit wandert zur
Handarbeit, nicht in den Papierkorb.

**Die Preisantwort** erzeugt einen **Zeitfaktor**. Wichtig: Der Musterschrank wird
**zuerst mit den Einstellungen aus Frage 1 und 2 gerechnet** — sonst korrigiert der
Faktor ein zweites Mal, was die Kostenstellen schon korrigiert haben.

Die Rechnung, ausgeschrieben:

```
Zeitfaktor = (Preis des Nutzers − Material-VK − Fixkosten-Sockel)
             ────────────────────────────────────────────────────
                        unser skalierbarer Lohnanteil
```

Beispiel: CraftFlow rechnet den Musterschrank mit 2.150 € — davon 650 € Material,
110 € Fixkosten-Sockel (Besprechung, Planung, Konstruktion, Arbeitsvorbereitung) und
1.390 € skalierbarer Lohn. Der Nutzer wählt „1.600–2.100" → Mitte 1.850 €.

    (1.850 − 650 − 110) ÷ 1.390 = **0,78**

Ab da rechnet CraftFlow seine Werkstatt- und Montagezeiten 22 % knapper als den
Branchenrichtwert. Material und Fixkosten-Sockel bleiben unangetastet — deshalb
stehen sie oben in der Formel, sonst träfe der kalibrierte Preis sein Band nicht.

**Warum auf die Zeit und nicht auf den Stundensatz:** Die Diagnose sagt, der Fehler
liegt bei den Zeiten (8,8 h gegen 5,5–6,5 h Richtwert). Und der Stundensatz bleibt so
eine ehrliche Zahl, mit der sich dem Nutzer etwas sagen lässt — sonst wäre der
Hinweis aus Abschnitt 5 sinnlos.

Gedeckelt auf **0,6 bis 1,4**, damit ein Fehlklick nicht die Kalkulation kippt.
Sichtbar und änderbar in den Einstellungen, mit Klartext: „Zeitfaktor 0,78 — ich
rechne deine Zeiten 22 % knapper als den Branchenrichtwert, weil du es so kalibriert
hast."

### 5 · Der ehrliche Hinweis

Einmal, freundlich, keine Sperre:

> „Aus deiner Angabe ergibt sich ein Stundensatz von 52 €. Der Branchenwert liegt bei
> 65–90 €. Ich rechne mit deinem Wert — wollte es dir nur einmal gesagt haben."

### 6 · Was sich in der Engine ändert

- `analyze/route.ts:623` streicht die Arbeit abgeschalteter Kostenstellen nicht mehr
  ersatzlos. Die Minuten wandern zur Handarbeits-Kostenstelle, mit Zeitzuschlag statt
  Maschinensatz. Handarbeit ist nicht billiger — Kantenanleimen von Hand dauert 1,5–2 h
  zu 65 €/h gegenüber 1,0 h zu 100 €/h. Wer das ignoriert, erzeugt wieder zu billige
  Angebote.
- Der **Zeitfaktor** greift deterministisch nach der KI-Antwort, an derselben Stelle,
  an der heute schon `vkStunde` und `aufschlag` überschrieben werden
  (`validateAndFix` in analyze, `applyUserRates` in optimize). Den KI-Zahlen wird auch
  hier nicht vertraut.
- Der Faktor gilt für **Werkstatt- und Montagezeit**, nicht für die Fixkosten-Minima
  je Position (Besprechung, Planung, Konstruktion, Arbeitsvorbereitung). Diese decken
  einen Sockel ab, der nicht mit der Betriebsgröße skaliert.

### 7 · Verhältnis zur Lernfunktion

Die Kalibrierung ist die **Grobeinstellung**, der Bauweise-Vault die
**Feineinstellung**. Fünf Fragen bringen den Betrieb in die richtige Größenordnung;
ab da schleift die Lernfunktion seine Eigenheiten ein — Rückwand 8 mm, fixierte
Einkaufspreise, eigene Bauweise. Beides greift an verschiedenen Stellen und stört
sich nicht: Die Kalibrierung wirkt auf Zeiten und Kostenstellen, der Vault auf
Bauweise und Material.

## Bewusst nicht Teil dieses Vorhabens

- **Mengengeschäft.** 100 Spinde folgen anderen Gesetzen: Rüsten fällt einmal an statt
  hundertmal, Planung und Konstruktion verteilen sich auf die Stückzahl, ab dem
  zweiten Stück greift die Lernkurve, beim Material kommen Mengenstaffel und weniger
  Verschnitt dazu. Eigene Eingabe, eigene Rechenlogik, eigene Prüfung. **Danach.**
- **Nachkalkulation** (Ist-Stunden zurückmelden, Zeitfaktor automatisch nachziehen).
  Langfristig der stärkste Hebel, hilft einem Testkunden in Woche eins aber nicht.
- **Regionalfaktor.** Die PLZ steht bereits im Betriebsprofil, wird hier aber nicht
  ausgewertet.

## Prüfkriterien

1. Ein Solo-Betrieb ohne Maschinen bekommt nach der Kalibrierung für den
   Musterschrank einen Preis **innerhalb** des von ihm gewählten Bandes. Das ist die
   Selbstprobe: Wer den Faktor aus einer Rechnung ableitet, muss dieselbe Rechnung
   damit auch treffen.
2. Derselbe Betrieb bekommt für den Rollcontainer aus dem Testangebot einen Preis
   deutlich unter 1.100 € — nachgerechnet, nicht geschätzt.
3. Wer CNC abschaltet, verliert **keine** Minuten: Bei sonst gleichen Einstellungen
   sinkt die Summe der Arbeitszeit nicht, sie verschiebt sich zur Handarbeit (und
   steigt dort leicht). Ohne Zeitfaktor gemessen, damit sich die beiden Effekte nicht
   überlagern.
4. Der Zeitfaktor ist in den Einstellungen sichtbar, in Klartext erklärt und
   von Hand änderbar.
5. Der Faktor bleibt zwischen 0,6 und 1,4, auch bei extremen Antworten.
6. Überspringen führt zu einer lauffähigen Kalkulation mit Branchenwerten und einem
   sichtbaren Hinweis, dass nicht kalibriert wurde.
7. Die Musterbeschreibung ist als Vorlage erkennbar — die fünf Pflichtangaben sind
   hervorgehoben.
8. Ein zweites Konto sieht die Kalibrierung des ersten nicht.
9. Der Deckungshinweis erscheint **einmal** und blockiert nichts.
10. Die Fixkosten-Minima je Position werden vom Zeitfaktor **nicht** verändert.
11. Fabians Vorbehalt, ausdrücklich: „wenn es genau so funktioniert" — der Faktor muss
    an echten Zahlen nachgerechnet werden, bevor etwas live geht. Rechenweg in einem
    Testskript, nicht nur im Kopf.
