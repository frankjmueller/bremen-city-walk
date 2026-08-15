# Ausbau auf weitere Städte — Analyse

Recherchestand: 15. August 2026. Vier unabhängige Analysen (Wettbewerb, Datenverfügbarkeit,
Monetarisierung, Architektur) zusammengeführt. Preise, Provisionssätze und Förderfristen
ändern sich — vor Entscheidungen gegenprüfen.

---

## 1. Ergebnis in fünf Sätzen

1. Als Consumer-App für „beliebige Städte" hat das Konzept keine Chance — Google (Gemini +
   Maps), Expedia (kaufte im Juli 2026 Layla), Tripadvisor und Questo besetzen jedes Feld, und
   der gesamte Markt schafft es nicht, Einmalnutzer zu monetarisieren.
2. Drei Lücken sind trotzdem echt: **Gruppen-Logistik**, **barrierefreie/zielgruppengerechte
   Touren als Ganzes**, und ein **bezahlbares PWA-White-Label** unterhalb der 30.000-€-Schwelle
   von SmartGuide.
3. Rund 70 % der Feature-Liste ist aus OSM, Wikidata und Wikimedia Commons für unter 100 € pro
   Stadt automatisierbar — aber genau diese 70 % sind nicht das, was den Guide gut macht.
4. Das Geld liegt im B2B; die zahlungskräftigste Nische ist die, zu der ohnehin Zugang besteht:
   Konferenz-Rahmenprogramme, Firmen-Events, Uni-Welcome. Erster realistischer Auftrag
   500–2.500 €, in 4–8 Wochen erreichbar.
5. Zwei Ideen streichen: „sketchy areas" (rechtlich/ethisch vermint) und „Things Trump would
   hate" als Produktname (Inhalte behalten, Framing nicht).

## 2. Der zentrale Widerspruch

> Was den Guide gut macht, skaliert nicht. Was skaliert, macht ihn nicht gut.

Der Guide funktioniert wegen Sätzen wie „Bei Frost bleibt das Glockenspiel stumm — sonst
zerspringt das Porzellan" und wegen des Antikolonial-Elefanten als „this place belongs to your
story too". Das ist recherchierte Ortskenntnis mit Haltung; ein LLM halluziniert so etwas nicht.

Der Markt hat beide Enden schon durchgespielt: **Detour** produzierte handgemachte Audio-Touren,
wurde 2018 an Bose verkauft und abgeschaltet — Produktion pro Stadt trug sich nicht.
**Audiala** macht das Gegenteil (1.890 Städte, 117.000 Orte, KI-generiert) und liefert genau den
flachen Brei, von dem sich dieser Guide abhebt.

**Konsequenz:** 8–12 Städte mit namentlichen Kurator:innen, nicht 50 automatisierte.
Der Engpass ist nie der Service Worker — es ist der Satz über das Porzellan bei Frost.

## 3. Ist-Analyse

### Unbedingt behalten

- **Echtes Offline inkl. iOS-Audio.** `sw.js` beantwortet HTTP-Range-Requests aus dem Cache mit
  selbstgebauten 206-Antworten. Ohne diesen Trick spielt iOS Safari offline kein Audio ab.
  Das unauffälligste und wertvollste Detail im Code.
- **Null Serverkosten, null Betrieb.** Statisch auf GitHub Pages.
- **Kein Login, kein Tracking.** Im B2B-Verkauf an Kommunen/Unis ein Verkaufsargument.
- **Der handgeschriebene Ton.** Das *ist* das Produkt; Technik ist Verpackung.
- Sauberes Update-Handling (`controllerchange`-Reload mit `hadController`-Guard,
  Precache-Fortschritt via MessageChannel, plattformspezifischer Install-Fallback).
- Lizenz-Disziplin (CC-Attribution, TTS-Transparenzhinweis).

### Wo es bricht (gemessen)

| Bruchstelle | Heute | Bei 50 Städten × 5 Sprachen |
|---|---|---|
| Duplikation | 170/186 CSS-Zeilen identisch (91 %); alle 4 JS-Blöcke logisch gleich; Maps-Pin-SVG-Pfad 21× im Repo | 250 Kopien; jeder Player-Bugfix 250× |
| `ASSETS`-Array | handgepflegt, dreistufiger manueller Release | vergessener Eintrag = Asset fehlt offline, **still** (Fortschritt meldet trotzdem „ready", weil `total` mitschrumpft) |
| Precache-Monolith | `addAll()` atomar; englischer Gast lädt 2,5 MB deutsches Teen-Audio | ≈ 1,75 GB — physikalisch unmöglich |
| Inhalt im Markup | Koordinaten, Preise, Texte im HTML | Preisänderung = HTML-Edit + Bump + Redeploy |
| Ein Manifest | `start_url: './'` für beide Editionen | Teen-Edition installiert startet auf englischer Seite |

### Konkrete Bugs (unabhängig vom Ausbau)

1. **Fehlgeschlagener Precache ist unsichtbar.** Funkloch bei Datei 30/41 → `addAll()` scheitert,
   SW wird nie aktiv, `serviceWorker.ready` resolved nie, Polling gibt nach ~3 min still auf.
   Nutzer sieht dauerhaft „Saving…" und geht mit halbem Cache los. Kein Retry, kein Fehlertext.
2. **iOS löscht den Cache nach 7 Tagen** Nichtnutzung, außer die PWA liegt auf dem Homescreen.
   `navigator.storage.persist()` wird nie angefragt.
3. **Audio-Player ohne `error`-Listener** — fehlende MP3 = stummer Player bei „–:–".
4. **`contenteditable` als Eingabefeld** — XSS-sicher, aber Rich-Text-Paste erzeugt live
   `<b>`/`<div>`-Kinder, kein Längenlimit, Enter-Umbrüche gehen beim Roundtrip verloren.
   Gehört ein `<input>` zu sein.
5. **`rangeResponse()` puffert die ganze Datei** (`arrayBuffer()`) pro Request; iOS feuert viele.
6. Kleinigkeiten: `navigator.platform` deprecated; kein `geo:`/Apple-Maps-Fallback; Seek ohne
   Drag; `skipWaiting` kann mitten im Hören reloaden; Treffpunkt synct nicht zwischen Editionen.

## 4. Markt

### Gesättigt — nicht antreten

| Kategorie | Wer dort sitzt |
|---|---|
| KI-Reiseplaner | Google Gemini + „Ask Maps", Tripadvisor (OpenAI), Expedia (kaufte Layla 07/2026), Mindtrip (22,5 Mio. $). Expedias eigener „Romie" wurde depriorisiert. |
| Audio-Tour-Marktplätze | izi.TRAVEL (25.000 Touren), VoiceMap, GPSmyCity (1.500 Städte), Audiala (1.890 Städte, KI) |
| Gamifizierte Schnitzeljagden | Questo (1 Mio. Spieler), myCityHunt, Secret City Trails, Geocaching Adventure Labs (50.000+), Actionbound, Loquiz |
| Offline-Karten | Organic Maps/CoMaps, OsmAnd, Google Maps offline — gelöst und gratis |
| Tickets/Reservierung/Gepäck/Vegan | GetYourGuide, Tiqets, TheFork, Bounce, HappyCow — andocken statt nachbauen |

### Echte Lücken

1. **Gruppen-Ausflugslogistik** — Treffpunkte, Zeit-Reminder, „Sammeln um 15 Uhr am Roland",
   offline. Für Schulklassen, Vereins-/Betriebsausflüge existiert kein Produkt; die Leute
   behelfen sich mit WhatsApp-Pins. Actionbound ist spiel-, nicht logistikfokussiert.
   Der editierbare Treffpunkt ist ein Embryo davon.
2. **Barrierefreie/zielgruppengerechte Touren als Ganzes** — Wheelmap (2 Mio. Orte, ODbL) und
   AccessNow sind POI-Datenbanken, keine Touren. Niemand baut daraus eine Route mit Steigung,
   Toilette, Sitzbank, Tempo. SmartGuide hat 2025 angefangen — Fenster offen, nicht ewig.
3. **Bezahlbares PWA-White-Label für den Long Tail** — SmartGuide: ~30.000 € Setup + 6.000 €/Jahr.
   Darunter wenig Seriöses für Kleinstädte, Museen, Kirchengemeinden, Schulen. Verstärkt durch
   das izi.TRAVEL-Vertrauensvakuum (gehört zu MWM, monetarisiert vormals freie Inhalte,
   Beschwerden über nicht abspielbare Guides).
4. *(bedingt)* **Crowd-bewusstes Tages-Routing** — Daten existieren (BestTime, Avoid Crowds),
   niemand sortiert daraus eine Route um. Als Feature stark, als Produkt riskant.
5. *(nicht für uns)* POI-Aktualität durch Nutzer-Meldungen — Netzwerkeffekt-Geschäft, das selbst
   Google nicht sauber löst.

**Rückenwind:** Nubart (Berlin) verkauft Museums-Audioguides ausdrücklich *als PWA ohne
App-Download* (QR-Karten ab 4.000 Stück, 48 % Nutzungsquote wenn im Eintritt enthalten) — der
technische Ansatz ist im Kulturmarkt bewiesen verkäuflich. Actionbound beweist die
Zahlungsbereitschaft deutscher Institutionen für Lizenzsoftware.

## 5. Die ~50 Ideen sind 9 Cluster

„Vegetarisch" ist kein Feature. Es ist ein Tag-Wert.

| # | Cluster | Enthält | Urteil |
|---|---|---|---|
| 1 | **Präferenzprofil + getaggte Orte** | Vegetarisch · Essensvorlieben (2×) · Interessen · Geschichte/Architektur/Action/Games · Tiefe/Snapshots · Kinder mit Alter · Hunde · Barrierefreiheit · Kirchen · Geld-Limit · Sprache(n) (2×) · lokale Spezialitäten — **~14 Stichpunkte, ein Mechanismus** | Kern |
| 2 | **Survival-Layer** | Toiletten · Eis · Park · Abkühlen · Gepäck · Shopping · Kunst · Nearby · Ortsliste · Parkplätze (statisch) | Bauen |
| 3 | **Zeit & Logistik** | Zeitplan · Tickets vorab · Schlange · Crowds · Reservieren | Nur statischer Teil |
| 4 | **Gruppe & Koordination** | Treffpunkte + Zeiten · Reminder | Marktlücke |
| 5 | **Content-Stil & Editionen** | Fun Facts · Dad Jokes · Bilder/Audio · lokaler Stil · Walks · Jogging | Ist die DNA |
| 6 | **Live & Community** | Nutzer-Updates · Parkplatz live · Konzerte · Crowds/Schlangen live | Kompromiss (s.u.) |
| 7 | **Buchung & Fremd-Inventar** | Unterkünfte · Reservierung · Ticketkauf · Taxi | Nur Deeplinks |
| 8 | **B2B / White-Label** | Brandable · DNS proof · Handout/QR | Zahlt alles |
| 9 | **Werte & Sicherheit** | Things Trump would hate · diverse Orte · sketchy areas · Transport-Sicherheit | Umdeuten |

### Widersprüche und ihre Auflösung

| Spannung | Auflösung |
|---|---|
| Offline ⟷ Live-Daten | Live ist *Enhancement, nie Requirement*. Drei Stufen: Bundle → opportunistischer Sync → Online-Extras, die sauber degradieren. UI zeigt ehrlich „Stand: 12. Aug". |
| Personalisierung ⟷ kein Login | Profil in `localStorage`, Teilen per URL-Parameter/QR. Login ist nie nötig. |
| Kuratierter Ton ⟷ Automatisierung | LLM entwirft, Mensch mit Ortskenntnis redigiert und unterschreibt namentlich. Ohne lokale Redaktion keine Stadt-Freigabe. |
| Alles-Precache ⟷ 50 × 5 | Pro Stadt+Sprache ein Bundle mit eigenem Scope. Man installiert „Bremen (DE)", nie „das Produkt". |

### Die fünf Ideen mit 80 % des Werts

1. Tag-basierter Filter über Orte (vereint 14 Stichpunkte)
2. Sprachen als Datendimension statt Dateikopie
3. Survival-Layer (Toiletten, Abkühlen, Wasser, Gepäck, Eis)
4. Offline-Vektorkarte mit Route und POIs
5. Treffpunkt + Reminder + QR-Teilen — einziges Gruppen-Feature ohne Backend, zugleich die
   stärkste Marktlücke

## 6. Datenlage

| Feature | Quelle | Abdeckung | Kosten | Offline |
|---|---|---|---|---|
| Toiletten | `amenity=toilets`, `fee`, `wheelchair`, `changing_table` | gut | 0 € | ✔ |
| Parks/Spielplätze | `leisure=park/garden/playground` | gut | 0 € | ✔ |
| Interessen-Tags | `historic=*`, `tourism=artwork/museum` + Wikidata P31 | gut | 0 € | ✔ |
| Bilder | Wikimedia Commons via Wikidata P18 — **Attributionspflicht**, CC BY-SA zieht Share-Alike nach | gut (Sights) / schlecht (Gastro) | 0 € | ✔ |
| Offline-Karten | Protomaps/PMTiles + MapLibre GL, 5–30 MB/Stadt | weltweit | 0 € | ✔ Kern |
| Fußgänger-Routing | OpenRouteService (inkl. Rollstuhlprofil), Valhalla-Tiles bundlebar | gut | 0 € | ✔ |
| ÖPNV | **Transitous/MOTIS** — kostenlos, DE via DELFI komplett | gut | 0 € | Fahrplan ✔ / Echtzeit ✘ |
| Barrierefreiheit | `wheelchair`, `tactile_paving`, `kerb=lowered` | mittel–gut (DE) | 0 € | ✔ |
| Vegetarisch/vegan | `diet:vegetarian`, `diet:vegan` | mittel (rein vegan ja, „auch Veggie" untererfasst) | 0 € | ✔ |
| Events | Ticketmaster Discovery API (5.000 Calls/Tag gratis). Eventbrite-Suche seit 2019 tot, Songkick zu | mittel | 0 € | ✘ |
| Crowd-Prognosen | **Nur BestTime.app.** Google Popular Times ist in *keinem* Preistier der Places API — Bibliotheken dafür scrapen und brechen die ToS | mittel | ab 29 $/Mon. | als Wochen-Snapshot ✔ |
| Hunde | `dog=yes/no/leashed` | schlecht | 0 € | ✔ |
| Preise/Eintritt | `fee`, `charge` | schlecht (selten, veraltet) | Handarbeit | ✔ |
| Parkplatz-Belegung | nur kommunale Open-Data-APIs, jede Stadt anders; Parkopedia B2B vierstellig+ | fragmentiert | pro Stadt | ✘ |
| Kleiderordnung, Kinder-Alter, A/C, Street-Art-Aktualität | existieren **nicht als Daten** | — | Kuration | ✔ |

### „Sketchy areas" — streichen

Die deutsche PKS gibt es nur auf Ebene von ~400 Landkreisen/kreisfreien Städten. Berlin
(Kriminalitätsatlas) und London (straßengenau) sind Insellösungen — und selbst dort misst die
Statistik Anzeigeverhalten und Polizeipräsenz, nicht Gefährdung von Tourist:innen.

Präzedenzfälle: **SketchFactor** (NYC 2014) wurde binnen Tagen von Washington Post, Mic und NBC
als rassistisch verrissen, weil „sketchy" mit arm und nicht-weiß korrelierte — App ist tot.
Microsofts Patent „Pedestrian avoidance routing" (2012) wurde als „Avoid Ghetto"-Feature
gebrandmarkt und nie ausgeliefert. Moovit musste sich 2021 für eine crowdgesourcte
Ortsbezeichnung mit rassistischem Slur entschuldigen. In DE kämen Klagen von Bezirksämtern wegen
Rufschädigung und DSGVO-Probleme beim Crowdsourcing hinzu.

**Stattdessen:** Nie Gebiete markieren, Routen positiv auszeichnen. Routing bevorzugt belebte,
beleuchtete Wege (`lit=yes` in OSM), dazu neutrale zeitbezogene Fakten („nachts fährt die 6 nur
alle 30 Minuten"). Nenn es *Wohlfühl-Route*, nicht *Gefahrenkarte*. Liefert 90 % des Nutzens
ohne das Risiko.

### Zwei Punkte zum jetzigen Stack

- **edge-tts ist für ein kommerzielles Produkt tabu.** Das Paket spricht den internen
  Edge-Browser-Endpoint ohne Azure-Vertrag an; Microsoft stellt klar, dass kommerzielle Nutzung
  ohne Subscription ToS-widrig ist. Azure Neural oder Google Cloud TTS kosten **5–15 € pro Stadt
  und Sprache, einmalig** (Vorproduktion). ElevenLabs nur, falls die Stimme Markenkern wird.
- **Textproduktion ist nicht das Kostenproblem** (30 Stopps × 2 Tiefen × 5 Sprachen < 10 €/Stadt
  über Batch-API). Der Engpass ist Halluzination — gerade bei „Fun Facts". Pflicht-Pipeline:
  Generierung nur mit beigelegtem Quellmaterial → zweiter Pass als Claim-Extraktor gegen die
  Quellen → menschliche Prüfung aller Zahlen und Namen.

### Was eine neue Stadt kostet

|  | Vollautomatisch | Leichte Kuration | Handkuratiert |
|---|---|---|---|
| Direkte Kosten | 20–60 € | 30–80 € | 50–150 € + Reise |
| Personenstunden | 1–4 h | 20–40 h | 80–200 h |
| Vollkosten à 50 €/h | 100–200 € | 1.000–2.000 € | 4.000–10.000 € |
| Rolle | Long Tail, Beta-Label | **Sweetspot** | Flagship |

Vorausgesetzt, die Pipeline existiert — sie zu bauen ist der eigentliche Invest: 300–600
Personenstunden einmalig.

## 7. Monetarisierung

Ein Stadtführer wird pro Person *einmal* genutzt: kein Abo-Fall, kein Retention-Fall.
Reise-Apps haben Day-30-Retention von ~3 %; Akquisekosten von 2,50–6 $ pro Install übersteigen
den Umsatz eines Einmalnutzers. izi.TRAVEL und Rick Steves sind gratis; SmartGuide, Nubart und
xamoom verdienen an Institutionen. Bei 8 € pro Tour und 50 % Royalty braucht es 250 Verkäufe
für 1.000 €.

| Modell | Realistisch Jahr 1–2 (nebenberuflich) | Erstes Geld nach | |
|---|---|---|---|
| Konferenzen, Events, Firmen | **2.000–15.000 €** | 4–8 Wochen | anfangen |
| Uni-Nische (Welcome, Gastwissenschaftler:innen) | 1.000–5.000 € | 1–3 Monate | anfangen |
| Hotels, Hostels | 500–3.000 € | 2–4 Monate | ja |
| DMO / Stadtmarketing | 0 *oder* 5.000–25.000 € | 6–18 Monate | binär |
| Affiliate (GetYourGuide 5–8 %, Bounce 8 %, Airalo ~10 %) | 50–500 € | 1–3 Monate | Beifang |
| VoiceMap-Zweitverwertung | 100–1.500 € | 2–3 Monate | optional |
| EXIST-Gründungsstipendium | 36.000 € / 12 Monate | 6–9 Monate Vorlauf | Entscheidung |
| B2C-Verkauf/Abo | 0–1.000 € | 6–12 Monate | nein |
| Sponsoring lokaler Läden | 0–1.000 € | 2–3 Monate | nein |
| Werbung, Spenden | 0–300 € | — | Produktschaden |

- **Schnellster Weg zu 1.000 €:** ein einziger Konferenz-/Firmenevent-Auftrag. Marktpreis
  vergleichbarer Anbieter 20–35 €/Person — die zahlungskräftigste Nische im Feld.
- **Weg zu 10.000 €:** 4–6 Kunden plus ein öffentlicher Auftrag. Bremens Direktvergabegrenze
  liegt aktuell bei ~3.000 €, die Bürgerschaft hat 2026 die Anhebung auf **100.000 €**
  beschlossen — danach kann die WFB einen 5.000–20.000-€-Auftrag formlos vergeben.
- **Fördermittel:** Nicht selbst Antragsteller sein. EFRE-/Tourismus-Digitalisierungsmittel gehen
  an Kommunen und DMOs. Richtige Bewegung: DMOs ansprechen mit „Ihr könnt das fördern lassen,
  ich liefere." An der Uni: **BRIDGE** (kostenlose Beratung, EXIST-Betreuung),
  **CAMPUSiDEEN** (Ideenwettbewerb, niedrigschwellig). **Prototype Fund** (bis 95.000 €, nur
  Open Source) fokussiert aktuell Software-Infrastruktur — passt kaum; nächste Bewerbungsphase
  1.10.–30.11.2026.

### Rechtliches — vor dem ersten Euro

1. **Nebentätigkeit bei Dezernat 2 anzeigen** (§ 3 Abs. 4 TV-L; bei wissenschaftlichem Personal
   auch für unentgeltliche Tätigkeiten). Nicht in Dienstaufgaben fallend, keine Uni-Ressourcen.
2. **Projekt dokumentiert privat halten** — § 69b UrhG: in Erfüllung der Dienstpflichten
   geschaffene Software gehört dem Arbeitgeber. Bei einem Uni-Welcome-Guide ist die Nähe real:
   entweder sauber als Werkvertrag über Dezernat 2, oder bewusst unentgeltlich.
3. **Impressum (§ 5 DDG) + Datenschutzerklärung**, sobald Affiliate-Links oder kommerzielle
   Absicht bestehen. GitHub Pages überträgt IPs in die USA — gehört in die Erklärung;
   für B2B-Kunden ggf. EU-Hosting.
4. **Kleinunternehmerregelung** seit 2025 bis 25.000 € Vorjahresumsatz — deckt alles Realistische.
5. **Kein Tracking ist ein Verkaufsargument.** Nicht leichtfertig für Analytics aufgeben.

**Gesamteinschätzung:** 2 h/Woche → 1.000–3.000 €/Jahr (Affiliate + 1–2 B2B-Deals), stressfrei.
Konsequenter B2B-Vertrieb in 2–3 Städten → 5.000–20.000 €/Jahr bei 10–20 h/Woche. Kein
VC-skalierbares Startup. **Der gefährlichste Zustand ist die Mitte:** Wartungsversprechen an
zahlende Kunden bei 2 h Zeit pro Woche.

## 8. Architektur

**Empfehlung: A als Fundament, C-light für Drafts/Übersetzungen/TTS (mit Kurationspflicht),
B frühestens Jahr 2 und nur additiv.**

- **A · Statisch + Build (empfohlen).** Inhalt als JSON, ein Template, generierter Service
  Worker. Pro Stadt und Sprache ein Bundle mit eigenem Scope und eigenem Manifest. Hosting
  weiter GitHub Pages, laufende Kosten 0 €. Erhält alle Kernstärken verlustfrei.
- **B · Edge-Backend (später, additiv).** Ein Cloudflare Worker für Melde-Formular und
  Gruppen-Sync; Free Tier reicht praktisch ewig. Der Preis ist nicht Geld, sondern dass das
  Produkt einen *Betreiber-Modus* bekommt: Moderation, Missbrauch, Uptime, AVV. Das Produkt muss
  ohne den Worker voll funktionieren.
- **C · LLM-Pipeline (orthogonal).** Beantwortet nicht „wie ausliefern", sondern „wie füllen".
  Mit **verpflichtendem** Kurations-Gate als PR-Review — ohne dieses Gate entsteht genau der
  Brei, von dem sich das Produkt abhebt.

### Kern des Refactorings

```js
// build.mjs — Cache-Version bumpt sich selbst, exakt dann, wenn sich Inhalt ändert.
// Bug-Klassen "vergessenes Asset" und "vergessener Versionsbump" verschwinden ersatzlos.
import { createHash } from 'node:crypto';

const files    = await collectFiles(`dist/bremen/de`);
const manifest = files.map(f => ({ url: f.rel, rev: hash8(f) }));
const version  = createHash('sha256')
  .update(JSON.stringify(manifest)).digest('hex').slice(0, 8);

await writeTemplate('sw.js', {
  ASSETS:     manifest,
  CACHE_NAME: `walk-bremen-de-${version}`,
});
// Range-Request-Code und controllerchange-Reload werden 1:1 übernommen.
```

Dazu `addAll()` durch einzelne `put`-Aufrufe mit Retry und Fehlerliste ersetzen, damit
Teilausfälle sichtbar werden.

### Datenschema

Entscheidend: **Orte sind unabhängig von Touren** (Toiletten-Layer und Teen-Tour teilen sich
Daten). Alle Filterattribute sind aufzählbare Enums, keine Freitexte — sonst ist
Offline-Filtern Glückssache.

```jsonc
// content/bremen/pois.json — ein Eintrag
{
  "id": "boettcherstrasse",
  "coord": [53.07508, 8.80609],
  "kind": "sight",              // sight|food|wc|park|cooldown|luggage|icecream|art|…
  "tags": {
    "interests":  ["architecture", "history", "art"],
    "kids":       { "min": 4, "note": { "de": "Glockenspiel + Bonbon-Werkstatt" } },
    "wheelchair": "partial",    // yes | partial | no
    "dogs":       "leash",
    "diet":       null,         // bei kind:"food": ["vegetarian","vegan",…]
    "values":     ["street-art"],  // lgbtq-friendly | memory-culture | climate
    "crowd":      { "peakDays": [6, 0], "peakHours": [11, 17] }   // offline!
  },
  "cost":  { "amount": 0, "perPerson": true },
  "visit": { "minutes": 20 },
  "body":  { "de": { "snapshot": "…", "full": "…", "deep": "…" } },
  "funFact": { "de": "Bei Frost bleibt das Glockenspiel stumm — sonst zerspringt das Porzellan." },
  "sources": ["https://…"], "factsChecked": "2026-07-01"
}
```

Damit ist „vegetarisch + Kind 6 + Rollstuhl + max. 20 € + 3 Stunden" ein `Array.filter` im
Browser — offline, ohne Login, in ~40 Zeilen. Gehzeit per Haversine / 4,5 km/h; kein
Routing-Server nötig. „Lernen, was du gut fandest" = Daumen-hoch pro Stopp erhöht Tag-Gewichte
in `localStorage`.

### Stufenplan

**Ein Wochenende — das Refactoring, null sichtbare Änderung**

- Inhalt aus beiden HTMLs nach `content/bremen/` extrahieren
- Ein Template + `build.mjs`, das `dist/bremen/{de,en}/` erzeugt
- SW-Generator: Asset-Manifest und Hash-Version automatisch
- Vier Quick-Fixes: `storage.persist()`, Einzel-Puts mit sichtbarem Fehler, `<input>` statt
  `contenteditable`, `error`-Listener am Audio

→ Gleiches Produkt, aber Stadt Nr. 2 ist ab jetzt Content-Arbeit statt Copy-Paste.

**Ein Monat — aus einem Guide wird ein Produkt**

- Woche 1–2: Präferenzprofil + Filter-Engine, Onboarding „Wer seid ihr heute?"; Treffpunkt
  strukturiert, QR-Teilen, ICS-Reminder
- Woche 3: PMTiles + MapLibre (Route, POI-Layer, „Nearby"). SVG-Schemakarte bleibt — sie ist Stil
- Woche 4: Survival-Layer per Overpass aus OSM importieren und handverlesen; **Stadt Nr. 2** als
  Proof, mit lokalem Kurator

**Ein Jahr — 8–12 Städte, nicht 50**

- LLM-Drafts, Auto-Übersetzung, TTS mit PR-basiertem Kurations-Workflow; jede Stadt mit
  namentlichem Kurator
- White-Label: Theme-Tokens (existieren als CSS-Variablen schon), Logo, Custom Domain mit
  DNS-TXT-Verifikation. Hotels/DMOs zahlen einmalig → finanziert die Kuration
- Optional Q4: *ein* Cloudflare Worker fürs Melde-Formular; Client funktioniert 100 % ohne ihn

Das Handout mit QR-Code ist der fertige Vertriebskanal.

## 9. Angriffsfläche

Bedrohungsmodell: nicht der Geheimdienst, sondern der gelangweilte Mensch mit einer Schleife,
das Café, das die Konkurrenz gegenüber als „dauerhaft geschlossen" meldet, und der verärgerte
Besucher. Dagegen ist der jetzige Aufbau bemerkenswert gut aufgestellt — weil es nichts gibt.

Kein Server, keine Datenbank, kein Login, keine Session; keine Nutzereingabe erreicht jemals
einen Server. Nichts zu injizieren, keine Sessions zu übernehmen, keine Credentials im Client.
Statische Dateien hinter einem CDN sind das, was CDNs am besten wegstecken.

**Der wichtigste Punkt:** Es fallen keine Kosten pro Request an. Damit ist
**Denial of Wallet** ausgeschlossen — der Angriff, der Solo-Entwickler heute tatsächlich
ruiniert (nicht die Seite lahmlegen, sondern die Rechnung hochtreiben; Serverless skaliert
automatisch, ohne explizite Limits gibt es keine Obergrenze).

**Offline-first ist Resilienz:** Selbst wenn der Origin verschwindet, funktionieren installierte
Guides weiter. Ein Angriff auf die Website trifft nicht die Gruppe, die gerade läuft.

### Vier reale Angriffsflächen

1. **Der GitHub-Account ist das Produkt.** Größtes Restrisiko: Wer ihn übernimmt, deployt
   beliebigen Inhalt an Menschen, die dem QR vertrauen — und der Service Worker verteilt es
   zuverlässig. Gegenmittel: Hardware-Passkey statt SMS-2FA, Branch Protection auf `main`,
   Deploy nur über Actions.
2. **100 GB Bandbreite/Monat (soft limit).** Keine Rechnung, keine harte Sperre, aber GitHub
   „may not be able to serve your site" bzw. eine Mail mit der Bitte, ein CDN davorzusetzen.
   Bei ~7 MB pro Erstbesuch ≈ **14.000 Installationen/Monat** — im Normalbetrieb nie erreicht,
   von einem Idioten mit einer Schleife in einer Stunde. Verfügbarkeits-, kein Sicherheitsproblem.
3. **GitHub Pages kann keine HTTP-Header setzen.** Kein CSP, kein HSTS, keine
   Permissions-Policy — kein `_headers`, kein `.htaccess`. Nur `<meta http-equiv>`, das schwächer
   ist (kein `frame-ancestors`, kein sinnvolles Reporting). Für ein Hobbyprojekt egal; für ein
   B2B-Security-Review ein Findings-Generator.
4. **Subdomain-Takeover — genau beim White-Label.** Entsteht in dem Moment, in dem
   `walk.hotel-x.de` angelegt wird: Bleibt der CNAME des Kunden stehen, während die Domain aus
   dem Repo genommen wird, kann irgendwer eine GitHub-Pages-Site mit dieser CNAME anlegen und
   unter dem Namen des Hotels ausliefern. GitHubs Domain-Verifikation ist optional und verhindert
   nur, dass Fremde für den *eigenen* Account claimen — sie sichert die Kundendomain nicht
   automatisch. **Prozessregel: Offboarding heißt zuerst DNS beim Kunden löschen, dann bei dir.**

### Was jedes Feature aufmacht

| Feature | Öffnet | Angriff |
|---|---|---|
| **Nutzer-Meldungen** | anonymer Schreib-Endpunkt + DB | **Drei Angriffe in einem:** Flood → Denial of Wallet; inhaltlicher Missbrauch („Restaurant X hat Ratten") → du bist der Verbreiter (Anschwärzung, üble Nachrede); Manipulation durch Konkurrenz |
| **Gruppen-Sync (Raumcodes)** | beschreibbarer KV ohne Auth | Codes erraten, fremde Treffpunkte umschreiben, Codes squatten → lange Codes + kurze TTL + kein PII |
| **Live-APIs im Client** | API-Key im Bundle | Kontingent abbrennen. Lösung trivial: nur aus dem *Build* aufrufen, nie zur Laufzeit — Key liegt in Actions Secrets |
| **LLM zur Laufzeit** | metered Compute | Lehrbuchziel für Denial of Wallet. Content wird gebaut, nicht generiert |
| **npm-Abhängigkeiten** | Supply Chain | Heute **null Dependencies** = null Risiko. MapLibre + Generator ändern das → pinnen, `npm ci`, Dependabot, bewusst niedrig halten |

Genau deshalb ist der „Melden"-Button als vorbefüllter GitHub-Issue elegant: **GitHub trägt
Spam-Abwehr, Rate Limiting und Identität**, und nichts wird veröffentlicht, bevor es gemergt ist.
Kein eigener Endpunkt, kein eigenes Problem.

### Härtung, gestaffelt

**Diese Woche (kostenlos, ein Abend)**
- Hardware-Passkey auf GitHub, Branch Protection auf `main`
- **Cloudflare Free vor die Domain:** Cache Everything, eine Rate-Limiting-Regel, Bot Fight Mode
  → Bandbreitenproblem und halber DDoS-Vektor erledigt, GitHub sieht fast keinen Traffic
- `<meta http-equiv="Content-Security-Policy">` als Minimum

**Wenn B2B ernst wird: Umzug auf Cloudflare Pages**
- Echte Header via `_headers` (CSP, HSTS, `X-Content-Type-Options`, Permissions-Policy)
- Gleiches Preisniveau (0 €), gleicher Git-Push-Deploy, EU-Hosting-Argument inklusive
- Keine externen Skripte einführen — heute null, das ist die stärkste CSP, die es gibt

**Pro White-Label-Kunde (Prozess, nicht Technik)**
- Domain-Verifikation beim Anlegen, dokumentiertes Offboarding (DNS beim Kunden zuerst)
- Periodischer Dangling-CNAME-Check über alle Kundendomains
- Vertraglich festhalten, wer die DNS-Kontrolle hat

**Merksatz:** Die Angriffsfläche ist heute fast null, weil es nichts gibt, das man angreifen
kann. Jedes Feature aus Cluster 6 tauscht genau das gegen Bequemlichkeit — ein zweites, von der
Kostenfrage unabhängiges Argument für Architektur A. Und im Gespräch mit einer Kommune oder
Universität öffnet „es gibt keinen Server, der kompromittiert werden könnte" Türen.

## 10. Nicht bauen

- **Accounts, Login, Profil-Cloud** — `localStorage` + URL-Sharing deckt jeden echten Bedarf.
- **Echtzeit-Crowds und Wartezeiten** — teuer, offline unmöglich, Prognosefehler sichtbar.
  Wochen-Heuristiken im Bundle liefern 80 % zum Nulltarif.
- **Buchung, Reservierung, Unterkünfte, Taxi** — anderes Geschäft. Deeplinks genügen und
  verdienen per Affiliate sogar mit.
- **„Sketchy areas"-Markierung** — Haftungs- und Diskriminierungsrisiko ohne Datengrundlage.
- **Native Apps / App Store** — die PWA *ist* der Wettbewerbsvorteil: kein Review, kein 30 %
  Plattform-Cut, ein QR-Code als vollständige Distribution.
- **Eigener Tileserver, eigenes CMS** — PMTiles, Git und JSON *sind* das CMS.
- **„Things Trump would hate" als Produktname** — Substanz stark und teilweise schon da (der
  Antikolonial-Elefant *ist* genau das und der beste Stopp im Guide). Aber als Branding datiert
  der Name schnell, halbiert die B2B-Kundschaft und importiert US-Kulturkampf in ein
  Bremen-Produkt. Inhalte als neutrale Tags behalten: `lgbtq-friendly`, `street-art`,
  `memory-culture`, `climate`. Höchstens eine kuratierte Themen-Tour daraus.
- **Werbung und Paywall** — AdSense bringt bei optimistischen 20.000 Seitenaufrufen 40–300 €/Jahr,
  gegen Consent-Banner und verschandeltes Produkt. Offline-Nutzung bricht Ads ohnehin.

## 11. Offene Entscheidungen

1. **Nebenprojekt oder Vorhaben?** 2 h/Woche mit Affiliate und gelegentlichen Event-Aufträgen ist
   ein legitimes Ziel. 10–20 h mit BRIDGE, CAMPUSiDEEN und ggf. EXIST ist ein anderes Leben.
   Die Mitte ist der einzige Zustand, der schiefgeht.
2. **Welche der drei Lücken?** Gruppen-Logistik, barrierefreie Touren oder Long-Tail-White-Label.
   Alle drei echt, aber unterschiedliche Produkte und Kund:innen. Empfehlung: **Gruppen-Logistik**
   — angefangen ist sie schon, und der nächste Kunde ist jemand, der eine Gruppe durch eine Stadt
   bewegen muss.

Unabhängig davon lohnt sich das Wochenend-Refactoring auch dann, wenn nie eine zweite Stadt
entsteht: Es beseitigt die stille Precache-Fehlermeldung, den iOS-Sieben-Tage-Verlust und die
doppelte Wartung.
