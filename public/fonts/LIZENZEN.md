# Schriften im PDF — Herkunft und Lizenz

Diese Dateien werden per `@font-face` in das erzeugte Angebots-PDF eingebunden.

**Warum überhaupt mitgeliefert:** Gemessen am 2026-09-08 ist im Serverless-Chromium
auf Vercel **genau eine** Schrift installiert. Ein Test mit vier Familien (Helvetica
Neue, Arial, Times New Roman, Georgia) ergab im fertigen PDF exakt einen eingebetteten
Font: `OpenSans-Regular`. Jede Schriftwahl, die sich auf Systemschriften verlässt,
wäre also wirkungslos — deshalb liefert CraftFlow die Schrift selbst aus.

Es ist jeweils nur der **latin**-Ausschnitt (U+0000–00FF). Der deckt Deutsch
vollständig ab, einschließlich ä ö ü ß, und hält die Dateien klein.

| Familie | Dateien | Ähnlich wie | Lizenz |
|---|---|---|---|
| Open Sans | `open-sans-400/700` | — (Voreinstellung) | Apache 2.0 |
| Inter | `inter-400/700` | Helvetica Neue | SIL OFL 1.1 |
| Arimo | `arimo-400/700` | **metrisch identisch zu Arial** | Apache 2.0 |
| Lato | `lato-400/700` | — | SIL OFL 1.1 |
| Roboto | `roboto-400/700` | — | Apache 2.0 |
| Source Sans 3 | `source-sans-400/700` | — | SIL OFL 1.1 |
| IBM Plex Sans | `plex-sans-400/700` | — | SIL OFL 1.1 |
| Work Sans | `work-sans-400/700` | — | SIL OFL 1.1 |
| Jost | `jost-400/700` | Futura | SIL OFL 1.1 |
| Nunito Sans | `nunito-sans-400/700` | — | SIL OFL 1.1 |
| PT Serif | `pt-serif-400/700` | — | SIL OFL 1.1 |
| Tinos | `tinos-400/700` | **metrisch identisch zu Times New Roman** | Apache 2.0 |
| EB Garamond | `eb-garamond-400/700` | Garamond | SIL OFL 1.1 |
| Merriweather | `merriweather-400/700` | — | SIL OFL 1.1 |
| Libre Baskerville | `baskerville-400/700` | Baskerville | SIL OFL 1.1 |
| Lora | `lora-400/700` | — | SIL OFL 1.1 |
| Source Serif 4 | `source-serif-400/700` | — | SIL OFL 1.1 |

**Metrisch identisch** heißt: gleiche Zeichenbreiten wie das Original. Ein Text in
Arimo bricht an denselben Stellen um wie in Arial. Für einen Betrieb, der „wir nutzen
Arial" sagt, ist das der richtige Ersatz — nicht nur etwas Ähnliches.

Alle stehen unter SIL Open Font License 1.1 oder Apache 2.0. Beide erlauben Einbettung,
Weitergabe und kommerzielle Nutzung. Bezogen über die Google-Fonts-Auslieferung
(`fonts.gstatic.com`) am 2026-09-08.

Lizenztexte: <https://openfontlicense.org/>
