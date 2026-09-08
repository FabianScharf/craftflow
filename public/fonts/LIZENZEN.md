# Schriften im PDF — Herkunft und Lizenz

Diese Dateien werden per `@font-face` in das erzeugte Angebots-PDF eingebunden.

**Warum überhaupt mitgeliefert:** Gemessen am 2026-09-08 ist im Serverless-Chromium
auf Vercel **genau eine** Schrift installiert. Ein Test mit vier Familien (Helvetica
Neue, Arial, Times New Roman, Georgia) ergab im fertigen PDF exakt einen eingebetteten
Font: `OpenSans-Regular`. Jede Schriftwahl, die sich auf Systemschriften verlässt,
wäre also wirkungslos — deshalb liefert CraftFlow die Schrift selbst aus.

Es ist jeweils nur der **latin**-Ausschnitt (U+0000–00FF). Der deckt Deutsch
vollständig ab, einschließlich ä ö ü ß, und hält die Dateien klein.

| Datei | Familie | Lizenz |
|---|---|---|
| `open-sans-400/700.woff2` | Open Sans | SIL Open Font License 1.1 |
| `inter-400/700.woff2` | Inter | SIL Open Font License 1.1 |
| `lato-400/700.woff2` | Lato | SIL Open Font License 1.1 |
| `pt-serif-400/700.woff2` | PT Serif | SIL Open Font License 1.1 |

Alle vier stehen unter der SIL Open Font License 1.1. Sie erlaubt Einbettung,
Weitergabe und kommerzielle Nutzung. Bezogen über die Google-Fonts-Auslieferung
(`fonts.gstatic.com`) am 2026-09-08.

Lizenztexte: <https://openfontlicense.org/>
