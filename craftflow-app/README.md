# CraftFlow – KI-Angebotssystem für FS Crafted

## 🔑 Schritt 1: Gemini API Key holen (kostenlos, keine Kreditkarte)

1. **aistudio.google.com** öffnen
2. Mit Google Account anmelden
3. Links auf **"Get API Key"**
4. **"Create API key"** klicken
5. Key kopieren und sicher speichern

---

## 📁 Schritt 2: GitHub Repository befüllen

1. **github.com** → dein Repository `craftflow` öffnen
2. **"uploading an existing file"** klicken
3. Folgende Dateien hochladen (Ordnerstruktur beachten!):

```
craftflow/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── api/
│       └── analyze/
│           └── route.ts
├── lib/
│   ├── types.ts
│   └── pdf.ts
├── public/
│   └── manifest.json
├── package.json
├── next.config.js
├── tsconfig.json
└── .gitignore
```

⚠️ Die `.env.local` Datei NICHT hochladen (steht in .gitignore)

---

## 🚀 Schritt 3: Vercel Deployment

1. **vercel.com** → "New Project"
2. GitHub Repository `craftflow` importieren
3. Framework: **Next.js** (automatisch erkannt)
4. Unter **"Environment Variables"** hinzufügen:
   - **Name:** `GEMINI_API_KEY`
   - **Value:** dein Key von Google AI Studio
5. **"Deploy"** klicken
6. Nach ~2 Minuten ist die App live! ✅

---

## 📱 Schritt 4: Als iPhone App hinzufügen

1. Vercel-URL in **Safari** öffnen (nicht Chrome!)
2. Teilen-Symbol (□ mit Pfeil) antippen
3. **"Zum Home-Bildschirm"** wählen
4. CraftFlow erscheint als App-Icon 🎉

---

## 💰 Kosten

| Service | Kosten |
|---------|--------|
| Vercel Hosting | Kostenlos |
| Google Gemini API | Kostenlos bis 1.500 Anfragen/Tag |
| Ab 1.500+ täglich | $0,075 per 1M Tokens (~0,001€/Angebot) |

Bei normalem Gebrauch (10-30 Angebote/Tag): **0,00 €**

