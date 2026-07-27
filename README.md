# UFS Atlas – Ultimate Fishing Simulator Guide

Interaktive React-/Tailwind-Webapp für **Ultimate Fishing Simulator 1 (PC/Steam)**.
Der Guide kombiniert recherchierte Community-Werte mit Daten, die direkt aus der
Spielinstallation ausgelesen wurden.

## Start

`index.html` direkt im Browser öffnen. React wird in Version 18.3.1 von UNPKG geladen,
alles Übrige liegt lokal vor.

Alternativ lokal ausliefern:

```bash
python -m http.server 8080
```

Dann `http://localhost:8080` öffnen.

## Funktionen

- **Revierkarte aus dem Spiel** – die Originalkarte jedes Reviers mit allen nummerierten
  Reisepunkten. Punkt überfahren zeigt die Arten in Wurfweite, Klick filtert die Liste
  auf diesen Spot.
- **Fangliste zum Abhaken** – jede Art lässt sich als gefangen markieren; Fortschritt je
  Revier und insgesamt. Wahlweise per Klick oder durch **Import des Spielstands**
  (`PROFILE_0` / `PROFILE_1`), inklusive persönlicher Rekorde und Rekordrevier.
- **Köder & Führung auf Deutsch** – Umschalter zwischen den englischen Originalbegriffen
  und den deutschen Bezeichnungen aus der Lokalisierungstabelle des Spiels.
- **Spieldaten je Art** – Gewichts- und Längenspanne, Beißzeitkurve über 24 Stunden,
  Anzahl der Schwarmpunkte im Revier, deutsche Enzyklopädie-Beschreibung, Modelltextur.
- **Artenseite** (`#arten`) – alle 136 Arten mit Größenspanne, Revieren, Ködern, Methode,
  Haken, Führung, Beißzeitkurve und der besten Angelart.
- **Statistik** (`#statistik`) – komplett aus dem geladenen Spielstand: Angler, Punkte,
  Geld, Angelzeit, je Revier Fänge, Bisse, Trefferquote, Gewicht und größter Fang,
  dazu je Art dein Rekord im Verhältnis zum möglichen Maximum.
- **Köderseite** (`#koeder`) – alle Naturköder, Boilies, Kunstköderarten, Methoden und
  Montageteile mit den Originalbezeichnungen des Spiels, jeweils mit den Arten, für die
  der Guide sie empfiehlt.
- **Konto, Gruppen und Vergleich** (`#gruppen`, nur mit Server) – Anmeldung per
  E-Mail-Code, ein Profil je Konto, Gruppen mit Ranglisten für schwersten und
  längsten Fisch, Gesamtmasse, größte Masse einer Art, Artenzahl und komplette
  Reviere. Gruppen sind öffentlich, nicht gelistet oder privat.
- **Anglerprofil** (`#angler/<Name>`, nur mit Server) – teilbare Seite mit
  Kennzahlen, Fortschritt je Revier, Rekorden je Art und dem, was noch fehlt.
  Wer angemeldet ist, sieht seinen eigenen Stand daneben: Kennzahl für
  Kennzahl, Revier für Revier und Art für Art, jeweils mit dem Datum beider
  Spielstände. Dort liegen auch Gruppen und Kontoeinstellungen.
- **Adressleiste als Zustand** – `#revier/betty`, `#revier/moraine/spot3`, `#arten/PIKE`,
  `#koeder`, `#statistik`, `#gruppen`, `#angler/Name/gruppen` sind direkt verlinkbar.
- 21 Karteneinträge, 204 recherchierte Fisch-/Strategieeinträge, ergänzt um alle Arten,
  die nur in den Spieldateien stehen.
- Suche, Filter nach Methode, Vertrauensstufe, offen/gefangen und Favoriten, Druckansicht.

## Datenquellen

| Aus den Spieldateien | Aus der Community-Recherche |
| --- | --- |
| Spotnummern und ihre Position auf der Karte | Köderempfehlungen |
| Artenliste je Revier und je Spot | Hakengrößen |
| Anzahl Schwarmpunkte und Fische | Führung und Rollengeschwindigkeit |
| Gewicht, Länge, Beißzeiten | Ködertiefe und Praxisnotizen |
| Deutsche Namen und Beschreibungen | |

Die Trennung ist in der Oberfläche sichtbar: Spieldaten stehen im blau abgesetzten Block,
Community-Werte tragen eine Vertrauensstufe.

## Dateien

- `index.html` – Einstieg mit eingebetteter Guide-Datenbasis
- `app.js` – die Anwendung; lesbares JavaScript, bewusst ohne Build-Schritt
- `styles.css` – lokal erzeugtes Tailwind-CSS
- `ui.css` – Bausteine für Revierkarte, Fangliste und Spieldaten-Block
- `data.json` – Guide-Datenbasis separat zur Weiterverarbeitung
- `gamedata.js` – aus dem Spiel extrahierte Daten (136 Arten, 20 Reviere)
- `maps/` – Revierkarten aus dem Spiel
- `fish/` – zugeschnittene Modelltexturen der Fische
- `tools/` – die Extraktions-Pipeline, siehe `tools/README.md`
- `server/` – Symfony-Backend, liefert im Betrieb auch den Guide aus
- `deploy/`, `Dockerfile.web`, `DEPLOY.md` – Container und Auslieferung

## Datenhinweis

Fischschwärme bewegen sich im Spiel. Spotnummern und Artenzuordnungen entsprechen den
Spawndefinitionen der Szene, sind aber keine Garantie für einen Fang zu jedem Zeitpunkt.
Community-Werte für Köder, Haken und Führung sind praxiserprobte Startpunkte; niedrige
Vertrauensstufen sind in der Oberfläche ausdrücklich markiert.

Fan-Projekt, nicht offiziell mit den Entwicklern verbunden.
