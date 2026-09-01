# SDD ledger — plan: docs/superpowers/plans/2026-07-31-lernfunktion-bauweise-vault.md

Branch: dev (Isolation gegenueber main; Projektregel: nie direkt auf main)
Start-BASE: ff1653c942343776982fc4f5855c56df59c14d99

Task 1: Diff-Engine — implementiert, 14/14 Tests gruen (commit 0e22d36)
Befund: npm run lint hat keine saubere Repo-Basis (513 Bestandsfehler) -> Plan korrigiert auf gezieltes npx eslint
Task 1: complete (commits ff1653c..0e22d36, review clean)
Task 1: minor (deferred): MODULE_TYPELESS_PACKAGE_JSON-Warnung bei npm run test (package.json ohne "type"); Fix waere "type":"module" root-weit -> Risiko fuer Next-Build, bewusst aufgeschoben
Task 1: minor (deferred): arbeitszeit-Paarung nur per Name, doppelte Kostenstellen in einer Position nicht disambiguiert (learn.ts:159,167)
Task 1: minor (deferred): normalisiere strippt Bindestriche -> "Multiplex-Birke" == "Multiplex Birke" (bewusst, fuzzy match)
Task 1: erledigt-Hinweis: Reviewer-Warnung zu eslint.config.mjs vom Controller selbst geprueft -> npx eslint auf beide neuen Dateien = leere Ausgabe, kein Handlungsbedarf
Task 2: implementiert, 28/28 Tests gruen (commit 36ac559)
Befund: npm run build laeuft lokal nicht (vorbestehend, /api/stripe/checkout, fehlende Keys) -> Plan auf npx tsc --noEmit umgestellt (Exit 0 verifiziert)
Task 2: Review -> 1 Important (plan-mandated): Zitat-Beleg ab 3 Zeichen aushebelbar. Fabian entschieden: streng (6 Zeichen + ganze Wortfolge). Spec+Plan angepasst.
Task 2: fix round 1/5 (1 addressed, 0 open — Zitat-Beleg jetzt 6 Zeichen + Wortfolge; commits 36ac559..b47fdb4)
Task 2: complete (commits ee8d509..b47fdb4, review clean)
Task 2: minor (deferred): Test "beschreibeAenderung ... fuer jede Art" deckt nur 2 von 7 Aenderungs-Arten ab (Titel ueberzeichnet)
Task 2: minor (deferred): kein Test fuer primitive Array-Elemente in kandidaten (z.B. [null], [42]); Code faengt es per !k ab
Task 3: complete (commits b47fdb4..8d2b0df, review clean)
Task 3: minor (deferred): kein Test fuer blank/null "dann" (nur "wenn" getestet) — Asymmetrie in der Abdeckung
Task 3: minor (deferred): WARNUNG_AB_REGELN noch unbenutzt; MUSS in Task 8 (Vault-UI) verdrahtet werden, sonst toter Code -> Task-8-Reviewer darauf hinweisen
Task 3: minor (deferred): learn.ts jetzt 253 Zeilen; bei weiterem Wachstum Trennung Diff-Logik vs. Prompt-Formatierung erwaegen
Task 4: implementiert (commit a800351), Review (opus): Mandantentrennung lueckenlos (alle 5 Route-Queries + Prompt-Load auf user_id, RLS + security invoker korrekt, learn.ts importfrei)
Task 4: 2 Important (beide plan-mandated, Plan korrigiert in 0e5bedb): .single() auf Ersetzen-Pfad -> 500 + Regelverlust; fire-and-forget Zaehler auf Vercel verschluckbar -> after()
Task 4: minor (deferred): SQL-Funktion ohne eigenen user_id-Filter, haengt allein an RLS — waere robuster falls je Service-Role-Client durchgereicht wird
Task 4: minor (deferred): keine Laengenbegrenzung fuer wenn/dann; Texte gehen wortwoertlich in JEDEN System-Prompt -> Prompt-Bloat moeglich (Cap ~300/400 Zeichen erwaegen)
Task 4: minor (deferred): kein Duplikat-Schutz fuer manuell angelegte Regeln (istGleicheRegel ungenutzt in der Route) -> in Task 8 pruefen, sonst widerspruechliche Regeln moeglich
Task 4: minor (deferred): PUT/DELETE liefern {ok:true} auch bei 0 betroffenen Zeilen (entspricht bestehendem kostenstellen-Muster)
Task 4: minor (deferred): konflikt_hinweis wird auch bei No-op-PUT (z.B. nur deaktivieren) zurueckgesetzt -> entwertet das Signal
Task 4: minor (deferred): .order('bereich') sortiert alphabetisch, nicht in BEREICHE-Reihenfolge (im UI korrigierbar, Task 8 gruppiert selbst)
Task 4: fix round 1/5 (2 addressed, 0 open; commits a800351..12c86ef) — Mandantentrennung nicht regressiert
Task 4: complete (commits 8d2b0df..12c86ef, review clean)
Task 4: minor (deferred): herkunft wird beim Ersetzen nicht aktualisiert (Vorzustand, nicht Teil der Befunde)
Task 4: OFFEN BEI FABIAN: SQL aus docs/sql/2026-07-31-bauweise-regeln.sql im Supabase-Dashboard ausfuehren (Gate fuer Live-Test in Task 9)
Task 5: WICHTIG aus Task-4-Re-Review: after() setzt einen aktiven Request-Kontext voraus -> zaehleRegelnHoch MUSS synchron im Route-Handler aufgerufen werden
Task 5: complete (commits 12c86ef..e49e5d0, review clean, opus)
Task 5: Ordering per Grep bestaetigt: regelBlock ist letzter Append (analyze:902, optimize:210); Firmenstandort-Verhalten unveraendert (innerer catch greift erst nach der Zuweisung)
Task 5: minor (deferred, KANDIDAT FUER FINAL-FIX-WELLE): Zaehler-Aufruf (analyze:934, optimize:237) ist die einzige neue Zeile ohne eigenen try/catch. Wuerfe von after() landen im aeusseren catch -> 500 obwohl die KI-Antwort schon vorliegt. Widerspricht dem Grundsatz "Lernen darf die Route nie brechen". Einzeiler.
Task 5: minor (deferred): schlaegt createClient()/getUser() fehl, greift der stumme aeussere catch -> kein [learn]-Log, erschwert Diagnose beim Live-Test
Task 5: minor (deferred): regelIds.length>0 doppelt geprueft, supabaseFuerZaehler-Check redundant
Task 6: implementiert (commit 02b9c42), Review: alle 7 Exit-Pfade 200 ausser 401 (unabhaengig nachgerechnet); Beleg-/Chat-/Kundendaten-/user_id-Verdrahtung korrekt
Task 6: 1 Important (plan-mandated, Plan korrigiert in d281561): error der bauweise_regeln-Abfrage wurde verworfen -> Konflikt-Erkennung degradiert still
Task 6: minor (deferred): System-Prompt sagt nirgends explizit "auf Deutsch antworten" (Prompt selbst ist durchgaengig deutsch, Risiko gering)
Task 6: minor (deferred): Preis-Ausschluss im Prompt hat keine Code-Pruefung; Blast Radius begrenzt, da Aenderung-Typen keine Preisfelder tragen
Task 6: KONZEPTIONELLE GRENZE (fuer Final-Review + Fabian): pruefeKandidaten prueft nur, DASS eine zitierte diff-nr existiert, nicht ob sie inhaltlich zur Regel passt. Die KI koennte eine echte Nummer als Beleg fuer eine unpassende Regel angeben. Abgemildert dadurch, dass der Dialog den Beleg sichtbar anzeigt und Fabian jeden Kandidaten bestaetigen muss.
Task 6: fix round 1/5 (1 addressed, 0 open; commits 02b9c42..9bc806a)
Task 6: complete (commits e49e5d0..9bc806a, review clean)
Task 7: implementiert (commit d536c22), Review (opus): Save-/PDF-Pfad nachweislich unantastbar, Deep Copy korrekt, Wire-Contracts stimmen feldweise
Task 7: 3 Important (alle plan-mandated, Plan korrigiert in a55b45d):
  (1) PDF-Trigger feuerte auf pdf-preview, wo der Dialog nicht gerendert wird -> Dialog erschien spaeter, ggf. mit Kandidaten eines anderen Angebots
  (2) kiVorschlagRef nie geleert -> nach resetAll/loadProject Diff gegen fremden Erstvorschlag, Muellregeln VORANGEHAKT -> ein Klick vermuellt den Vault dauerhaft
  (3) lernRegelnSpeichern verwarf bestaetigte Regeln still (kein res.ok-Check, Schleife brach bei Netzfehler ab)
Task 7: minor (deferred): zwei Literal-Hexfarben im Dialog ausserhalb der C-Palette (konsistent mit Bestand)
Task 7: Abweichung akzeptiert: useCallback-Bloecke hinter checkChatRef statt neben saveProject (Deps-Arrays werden synchron ausgewertet, TS2448/TS2454) — Plan in 62b3c2e/a55b45d nachgezogen
Task 7: fix round 1/5 (3 addressed, 1 NEU offen; commits d536c22..9228cc2) — offen gelassener Dialog machte Wiederholversuch moeglich, ohne zu merken welche Regeln schon gespeichert waren -> Doppelanlage im Vault (POST-Route hat keine Dublettenpruefung fuer neue Regeln)
Task 7: minor (deferred): drei weitere Literal-Hexfarben in der Fehlerbox ausserhalb der C-Palette
Task 7: fix round 2/5 laeuft — lernErledigt-State, erledigte Kandidaten ueberspringen + im Dialog als "gespeichert" markieren (Plan 688fabe)
Task 7: fix round 2/5 (1 addressed, 1 NEU offen; commits 9228cc2..4941a8f) — lernErledigt auf den Abbruchwegen (Backdrop, "Nicht merken") nicht zurueckgesetzt -> stehengebliebene Marke laesst spaeteren echten Kandidaten still ueberspringen
Task 7: fix round 3/5 laeuft — zentrale lernDialogSchliessen() fuer alle Wege + Reset beim Befuellen neuer Kandidaten (Plan e0b46f5)
Task 7: fix round 3/5 (1 addressed, 0 open; commits 4941a8f..9975f8a)
Task 7: complete (commits 9bc806a..9975f8a, review clean nach 3 Runden)
Task 7: minor (deferred): loadProject/resetAll wiederholen 5 Feld-Resets, die lernDialogSchliessen auch macht (reine Dopplung, kein Bug)
Task 8: implementiert (commit 3f1ba7a), Review: 60er-Sortierung spiegelt Backend korrekt inkl. Null-Handling, Beschriftung ehrlich ("mitgeschickt"), Muster/Palette/Strings ok
Task 8: 2 Important: (1) plan-mandated, kein res.ok-Check bei anlegen/aendern -> Fehlschlag sah aus wie Erfolg (Plan a76df03); (2) Dubletten-Pruefung matcht auch deaktivierte Regeln -> blockt legitime neue Regel mit irrefuehrender Meldung
Task 8: minor (deferred): drei Literal-Hexfarben statt C-Palette; kein Lade-Indikator pro Zeile
Task 8: OFFENE PRODUKTFRAGE fuer Fabian: kein PlanGate am Vault-Reiter — Lernfunktion aktuell in allen Plaenen (auch solo) verfuegbar. Bewusst so gelassen, ist eine Preisentscheidung.
Task 8: PRODUKTENTSCHEIDUNG Fabian (2026-08-01): kein PlanGate — Lernfunktion bleibt in ALLEN Tarifen, zur Verbesserung der Produktqualitaet insgesamt. Kein Handlungsbedarf, aktueller Stand ist bereits so.
Task 8: fix round 1/5 (2 addressed, 0 open; commits 3f1ba7a..2d8d491)
Task 8: complete (commits 9975f8a..2d8d491, review clean)
Task 8: minor (deferred): listenFehler wird von erfolgreichem anlegen nicht geleert -> alte Fehlermeldung kann stehenbleiben
Task 8: minor (deferred): loadRegeln ohne try/catch -> unhandled rejection moeglich bei totalem Netzausfall (Vorzustand des Musters)
Task 9 Step 1: complete (commit 07c8a86, docs review clean — alle Faktenaussagen gegen den Code verifiziert)
Task 9 Steps 2-6: offen (Push auf dev, Live-Test, Mandantentrennungstest, main-Freigabe) — braucht Fabian

== FINAL WHOLE-BRANCH REVIEW (opus, ff1653c..07c8a86) ==
Ergebnis: "Ready to merge: With fixes". Architektur, Beleg-Trustmodell, Mandantentrennung, Fail-safe-Verhalten und die Byte-Identitaet des Prompts ohne Regeln alle bestaetigt. End-to-End-Trace: alle Feldnamen passen, Aenderung.nr ist beweisbar dasselbe Array fuer Prompt und Validierung.
3 Important:
  F1 kiVorschlagRef wird in lernDialogSchliessen nicht geleert -> Dialog + bezahlter KI-Call bei JEDEM erneuten Speichern desselben Angebots
  F2 konflikt_hinweis hat Leser und Ruecksetzer, aber keinen Schreiber -> im Spec zugesagtes Qualitaetssignal ist tot; Plan und Spec widersprechen sich
  F3 zaehleRegelnHoch ohne eigenen try/catch -> 500 moeglich, obwohl die KI-Antwort schon vorliegt
Ausgewaehlte Minors fuer dieselbe Welle: Batch-Dedup gleicher Kandidaten, Laengenbegrenzung wenn/dann, restoreVersion leert die Vergleichsbasis nicht, Diagnose-Warnung wenn keine Position gepaart wurde, SQL-Haertung (search_path + check constraints), listenFehler bei Erfolg leeren
Bewusst aufgeschoben: Literal-Hexfarben, MODULE_TYPELESS-Warnung, {ok:true} bei 0 Zeilen, Doppelung der Reset-Felder, semantische Beleg-Pruefung (strukturell durch Nutzerbestaetigung abgesichert)
FINAL FIX WAVE: complete (commit c3219ec, F1-F9 alle ADDRESSED, Re-Review opus: "Ready for production: Yes")
Eigene Verifikation am Ende: 39/39 Tests, tsc Exit 0, Arbeitsbaum sauber
PARKED (residual, nicht blockierend):
  - candidates/route.ts: konflikt_hinweis-Write nicht in eigenem try/catch; ein GEWORFENER (nicht zurueckgegebener) Fehler wuerde die schon berechneten Kandidaten verwerfen. 200-Vertrag bleibt gewahrt. supabase-js meldet Fehler ueblicherweise per {error}, daher schmales Fenster. Ruling: real, klein, aufgeschoben — 2-Zeilen-Fix jederzeit moeglich.
  - learn.ts Dedup-Schluessel: zwei verschiedene "gilt immer"-Regeln im selben Bereich fallen im selben Durchlauf zusammen. Entspricht istGleicheRegel und der bestehenden Vault-Semantik. Ruling: konsistent, bewusst so.
HINWEIS fuer den ersten Live-Lauf: konflikt_hinweis wird beim VORSCHLAGEN gesetzt. Lehnt Fabian den Kandidaten ab, bleibt das Warndreieck an der bestehenden Regel stehen, bis er sie bearbeitet. Spec-konform, aber ueberraschend.
WORKSPACE BLEIBT bestehen bis Live-Test + main-Merge erledigt sind (Task 9 Steps 2-6 offen).
Task 9 Step 3: dev gepusht (origin/dev 55d79c6..7962cf2, inkl. Merge des Cover-Bild-Commits). Nach dem Merge erneut verifiziert: 39/39 Tests, tsc Exit 0.
OFFEN: SQL in Supabase (Fabian), Live-Test, Mandantentrennungstest, main-Freigabe.

== NACHTRAG 2026-08-02/05: die zwei geparkten Minors + Folgeentscheidung ==
a32eab1 konflikt_hinweis-Write eigenes try/catch (geparkter Minor 1) — erledigt
f962898 Regel-Identitaet: leeres wenn ("gilt immer") zaehlt NIE als Identitaet.
  URSACHE: geparkter Minor 2 war KEIN Minor. Identitaet (bereich, wenn) bedeutete:
  pro Bereich nur EINE Immer-Regel, ueber sechs Bereiche also sechs im Betrieb.
  ENTSCHEIDUNG Fabian 2026-08-02: Immer-Regeln nie als Dublette werten.
1b760c1 UI-Dublettenpruefung fuer Immer-Regeln nachgezogen (Loch aus f962898 geschlossen)
952bc24 weitereImmerRegel: Folgefehler der Entscheidung behoben — fuer Immer-Regeln ist
  aendertRegelId immer null, damit war auch das Warndreieck tot UND der Kandidat
  vorangehakt: ein Klick haette zwei widersprechende Dauer-Regeln in jeden Prompt
  gestellt. Jetzt nicht vorangehakt + eigener Hinweis. Dazu: normalisiere statt trim
  in der UI-Pruefung, Test fuer den bereich-Teil der Identitaet.
Review (opus) auf 7962cf2..1b760c1: "With fixes" — beide genannten Einzeiler sowie
  Empfehlung A umgesetzt in 952bc24. Spec nachgezogen (Minors 3+4 des Reviews).
Stand: 45/45 Tests, tsc Exit 0, origin/dev = 952bc24.
PARKED (aus dem Review, nicht umgesetzt):
  - Plan-Codeblock fuer pruefeKandidaten enthaelt den Batch-Dedup nicht (Divergenz zum Code)
  - Lern-Dialog: wenn ist editierbar, ersetztRegelId stammt aus dem unbearbeiteten Kandidaten.
    Leert der Nutzer das Feld eines mit Warndreieck markierten Kandidaten, wird die bestehende
    bedingte Regel per UPDATE zur Immer-Regel. Verhalten wie vorher, passt aber nicht mehr zum
    neuen Invariant.
