# Erfassungs-Checkliste Windhoek

Abgeleitet aus `content/schema/poi.schema.json` — jede Frage hier füllt ein Schemafeld.
Grundregel der ganzen Reise:

> **Nur was du selbst gesehen hast, wird `verified`. Alles andere bleibt `draft`.**
> Ein ehrliches `draft` ist wertvoller als ein geratenes `verified` — die App kennzeichnet
> Ungeprüftes, und genau diese Ehrlichkeit ist der Unterschied zu Audiala.

Du fährst nicht hin, um eine Tour zu schreiben. Du fährst hin, um einen **Ortsbestand zu
verifizieren**. Die Tour entsteht später aus Profil + Bestand.

---

## 0. Vor der Reise (in Bremen erledigen)

- [ ] **Refactoring-Wochenende abgeschlossen** — vor Ort ist die knappe Ressource das Dortsein
- [ ] Offline-Karten laden: Organic Maps **und** OsmAnd mit Namibia (zwei Apps, weil eine spinnt)
- [ ] Diese Checkliste + leere Ort-Bögen offline aufs Handy (Notiz-App) und 10× auf Papier
- [ ] Powerbank; Fotos = Verifikationsbelege, der Akku ist die Pipeline
- [ ] `content/windhoek/pois.json` durchsehen: 4 Draft-Orte sind angelegt, Koordinaten sind
      **geraten** und werden vor Ort neu gesetzt
- [ ] Kandidatenliste erweitern (aus Reiseführer/OSM/Gastgeber-Tipps auf ~80 Kandidaten,
      damit vor Ort ~60 überleben) — als Drafts anlegen kostet nichts

## 1. Das Ziel in Zahlen

**~60 Orte, verteilt nach `kind`.** Die Quote schützt vor dem Sehenswürdigkeiten-Tunnelblick —
der Survival-Layer ist das, was täglich gebraucht wird:

| kind | Ziel | Merkhilfe |
|---|---|---|
| sight + memorial | 12–15 | inkl. des Bremen-Paars |
| food | 8–10 | davon **mind. 4 mit echten vegetarischen Hauptgerichten** (`diet`) |
| wc | 5–6 | die Panikfrage Nr. 1 |
| park + cooldown + water | 6–8 | Schatten ist in Windhoek das, was in Bremen der Regenschutz ist |
| art + viewpoint | 5–6 | Street Art, Aussichtspunkte |
| shop + market | 4–5 | Craft Centre & Co. |
| icecream | 2–3 | |
| transit | 3–4 | wo Sammeltaxis wirklich halten |
| playground | 2 | |
| luggage | 1–2 | gibt es das überhaupt? Auch „nein" ist ein Ergebnis |

## 2. Pro Ort: der Bogen

**Pflicht (ohne das kein `verified`):**

- [ ] **Koordinate am Objekt** neu setzen (nicht am Straßenrand davor), 5 Nachkommastellen
- [ ] **2 Fotos eigene**: quer (fürs Bundle, `license: "own"` — löst das Commons-Problem) + 1 Detail
- [ ] **Beleg-Fotos**: Öffnungszeiten-Schild, Preistafel — das *sind* die `sources`
      (`photo:2026-10-05-preistafel.jpg`)
- [ ] Name wie er **auf dem Schild steht** (`localName`, falls abweichend)
- [ ] `cost`: Betrag in N$ von der Tafel · **Karte oder nur bar?** (`cashOnly`)
- [ ] `hours.osm`: von der Tür, nicht aus dem Netz
- [ ] `wheelchair` real: Stufe am Eingang? Rampe? Innen eng? (`yes/partial/no` — nie raten)
- [ ] `shade`: gibt es echten Schatten? (Hitze-Filter)
- [ ] **1 Fakt von einer lokalen Person bestätigen lassen** — erst dann `verified`

**Kür (macht den Ort filterbar):**

- [ ] `kids`: ab welchem Alter lohnt es? Was machen Kinder hier konkret? (`note`!)
- [ ] `dogs`, `stroller`, `indoor`
- [ ] `diet` bei food: gibt es vollwertige vegetarische **Hauptgerichte** (nicht Beilagen)?
- [ ] `crowd`: wann ist es voll? (Die Person hinterm Tresen weiß es: „Wann ist am meisten los?")
- [ ] `visit.minutes`: ehrlich schätzen
- [ ] Toilette **im oder nahe** dem Ort? → ggf. eigener wc-Eintrag
- [ ] `funFact`-Kandidat: was erzählen Leute vor Ort? (Vor-Ort-Anekdoten halluzinieren nicht)

## 3. Stadt-Ebene (`city.json → practical`)

Alle Felder stehen als TODO in `content/windhoek/city.json`:

- [ ] Notrufnummern — am besten Gastgeber fragen und gegen offizielle Quelle prüfen
- [ ] **Leitungswasser**: trinkbar ja/nein — verifizieren, nicht behaupten
- [ ] Zahlungsrealität: Karte wo, Bargeld wo, ATMs
- [ ] SIM/eSIM: Anbieter, Preis, wo kaufen (Affiliate-Kandidat: Airalo — erst Realität prüfen)
- [ ] **Sammeltaxi-Realität**: woher → wohin, Preis, wie zahlt man, wie erkennt man seriöse,
      gibt es Apps? Das ist das Feld, in dem das Bremen-Schema (Linie 6, FAIRTIQ) bricht —
      genau deshalb ist es die wertvollste Erkenntnis der Reise
- [ ] Sonntage
- [ ] Sonne/Hitze-Basics

## 4. Sicherheit — die Erfassungsregel

Windhoek ist die Stadt, in der Sicherheitsinfo ein legitimes Bedürfnis ist. Die Regel aus der
Analyse gilt hier erst recht, und sie bestimmt, **was du notierst**:

- **Erfassen:** positive, prüfbare Fakten. Beleuchtet? Belebt bis wann? Wo laufen abends
  Menschen? Welche Wege empfehlen Locals zu Fuß, welche Strecke fahren sie?
- **Nicht erfassen:** Gebietsurteile („Viertel X meiden"). Nie. Auch nicht als private Notiz,
  die später „nur kurz" in die App rutscht.
- Format im Schema: gehört in `body`/`practical` als neutrale Fakten, nicht als eigenes Feld.

## 5. Perspektiven & Stimmen (die Haltung)

**Drei Fragen an jede lokale Person, mit der du ins Gespräch kommst:**

1. „Was zeigst du Besuch zuerst?"
2. „Was ist überbewertet?"
3. „Wohin gehst du, wenn es heiß ist?"

Die Antworten sind Gold: Sie füllen `perspectives`, korrigieren die Kandidatenliste und sind
die Sorte Wissen, die keine Pipeline erzeugt.

- [ ] **Bremen-Paar erarbeiten**: am Independence Memorial Museum (und ggf. weiteren Orten) die
      Perspektive `from-bremen` notieren — das Gegenstück zu „this place belongs to your story
      too" am Elefanten. `related` ist in pois.json schon verdrahtet.
- [ ] **Lokale Audio-Stimme**: 1–2 Personen fragen, ob sie Stopps einsprechen würden.
      Einverständnis schriftlich, Honorar klären, Namensnennung anbieten
      (`voice: "human/<Name>"`). Löst zugleich das edge-tts-Lizenzproblem — und ist das
      Gegenteil von dem, was eine Content-Farm kann.

## 6. Abends im Quartier (15 Min/Tag)

- [ ] Bögen des Tages in `pois.json` übertragen, solange das Gedächtnis frisch ist
- [ ] `verification` setzen: `{ "status": "verified", "by": "FJM", "on": "<heute>", "method": "on-site" }`
- [ ] Fotos des Tages sichern (zweiter Ort: Cloud oder zweite SD)
- [ ] Kandidatenliste für morgen anpassen (Frage 2 von oben streicht, Frage 1 ergänzt)

## 7. Ort-Bogen (Vorlage zum Kopieren)

```
ORT: ____________________  kind: ______  Datum: ______
Koordinate (am Objekt): ______________, ______________
Foto quer ☐  Detail ☐  Beleg Zeiten ☐  Beleg Preis ☐
Preis: ______ N$  bar/Karte: ______  Zeiten: __________________
Rollstuhl: yes/partial/no  Stufe? ____  Schatten: ja/nein
Kinder ab: ____  was machen sie hier: __________________
Veggie-Hauptgericht: ja/nein  Hunde: ____  WC nahe: ____
Voll wann (Tresen-Frage): __________________
Fakt bestätigt von: ______________  Fun-Fact-Kandidat:
__________________________________________________
Perspektive/Zitat:
__________________________________________________
```
