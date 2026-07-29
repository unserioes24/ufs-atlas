/**
 * What changed, per release.
 *
 * Kept by hand rather than generated from git: a commit log explains what was
 * touched, a changelog explains what someone gets out of it. The German text is
 * the original, English follows it line for line.
 *
 * Split three ways, because the two versions are not the same product. What is
 * under `general` holds everywhere; `offline` is the download, which knows no
 * accounts; `server` needs the hosted site to mean anything. A group with
 * nothing in it is left out rather than shown empty.
 */
export interface ChangeGroups {
  general?: string[]
  offline?: string[]
  server?: string[]
}

export interface ChangeEntry {
  version: string
  /** ISO date of the release. */
  date: string
  de: ChangeGroups
  en: ChangeGroups
}

export const CHANGELOG: ChangeEntry[] = [
  {
    version: '1.1.2',
    date: '2026-07-30',
    de: {
      server: [
        'Der Hinweis „Hier liegt der neuere Stand“ blieb auch nach dem Hochladen stehen. Der Browser hat den Zeitpunkt mit seiner eigenen Uhr gestempelt und lag damit hinter dem Server, der seine Zeile Millisekunden früher geschrieben hatte – beim nächsten Laden galt der lokale Stand wieder als der neuere. Jetzt übernimmt der Browser den Zeitstempel des Servers, und der Vergleich lässt anderthalb Minuten Spielraum, weil zwei Uhren nie genau gleich laufen.',
        'Ein Upload aus den Kontoeinstellungen lässt den Hinweis ebenfalls verschwinden – bisher blieb er bis zum nächsten Laden stehen.',
      ],
    },
    en: {
      server: [
        'The note “the newer state is here” stayed up even after uploading. The browser stamped the moment with its own clock and so fell behind the server, which had written its row milliseconds earlier – on the next page load the local state counted as the newer one again. The browser now takes the server’s timestamp, and the comparison allows a minute and a half of slack, because two clocks never run exactly alike.',
        'An upload from the account settings clears the note as well; until now it stayed until the next page load.',
      ],
    },
  },
  {
    version: '1.1.1',
    date: '2026-07-29',
    de: {
      general: [
        'Der Schnittköder hat sehr wohl Interessenwerte – 150 Arten, bis 90 %. Die Extraktion hatte seine Liste verworfen, weil vier Arten darin doppelt vorkommen; sie steht jetzt drin, klein und groß getrennt.',
        'Damit kamen vier weitere Köder zum Vorschein, die vorher fehlten: Gnome Mikado, Holo Reflex Slim, Sakura Pop’N’Dog und das eigentliche Lebendköder-Prefab. 81 Köder statt 79.',
        'Aus dem Speicherstand werden jetzt 18 statt 12 abweichende Artennamen erkannt, unter anderem Koi-Karpfen, Mahi-Mahi, Rotfeuerfisch und die vier Florida-Modelle. Der Riesenzackenbarsch war dabei falsch zugeordnet – er wäre mit dem Goliath-Zackenbarsch verrechnet worden.',
        'Die Fischschwärme auf der Revierkarte sind von Anfang an sichtbar, statt hinter einem Klick zu warten.',
      ],
      server: [
        'Beim Upload per curl oder geplantem Auftrag fehlte die Dickkopf-Stachelmakrele weiter: der Server hat seinen eigenen Parser, und die Namensliste steckte nur im Browser. Beide führen jetzt dieselbe Tabelle – ebenso beim Ausblenden der drei Fähigkeiten, die das Spiel nie freischaltet.',
      ],
    },
    en: {
      general: [
        'Cut bait does have interest values – 150 species, up to 90 %. The extraction had thrown its list away because four species appear in it twice; it is in now, small and large kept apart.',
        'That brought four more baits to light that were missing before: Gnome Mikado, Holo Reflex Slim, Sakura Pop’N’Dog and the actual live-bait prefab. 81 baits instead of 79.',
        'The save file now resolves 18 differing species names instead of 12, among them koi carp, mahi-mahi, red lionfish and the four Florida models. The giant grouper was mapped wrongly – it would have been counted as the goliath grouper.',
        'Fish shoals on the fishery map are visible from the start instead of waiting behind a click.',
      ],
      server: [
        'Uploading through curl or a scheduled job still lost the Giant Trevally: the server has a parser of its own, and the name table was only in the browser. Both carry the same table now – the same goes for hiding the three skills the game never unlocks.',
      ],
    },
  },
  {
    version: '1.1.0',
    date: '2026-07-28',
    de: {
      general: [
        'Zwölf Arten wurden aus dem Spielstand nicht erkannt, darunter die Dickkopf-Stachelmakrele: das Spiel zählt sie unter GIANT_TRAVELLY, seinem eigenen Tippfehler. Die Zuordnung ist jetzt vollständig, und Arten, die der Atlas nicht kennt, werden gemeldet statt verschluckt.',
        'Kunstköder sagen, was sie sind – Spinner, Blinker, Wobbler, Gummi –, mit den Wörtern aus den Spieldateien. Auch in der Köderliste einer Art, wo bisher nur „Kunstköder“ stand.',
        'Lebendköder gibt es im Spiel in einer Größe, nicht in drei. Der Schnittköder, klein und groß, war gar nicht aufgeführt und steht jetzt drin.',
        'Haken erstellen, Filetieren und Braten werden vom Spiel nie freigeschaltet und sind aus der Fähigkeitenliste raus. „Straight schnell“ gibt es als Führung nicht – das Tutorial des Spiels nennt selbst nur fünf.',
        'Die Ordnerpfade der Spielstände stehen für alle drei Systeme da, jeder mit Kopierknopf, und der Profilslot ist wählbar: 0, 1 oder 2.',
        'Diese Liste hier.',
      ],
      server: [
        'Ist der Spielstand im Browser neuer als der im Konto, wird er nicht mehr überschrieben. Stattdessen steht da, dass im Konto ein älterer liegt, mit einem Knopf zum Hochladen.',
        'Der Spielstand lässt sich in den Kontoeinstellungen direkt hochladen, ohne curl.',
        'Anleitung für den Upload von allein: Aufgabenplanung unter Windows, cron unter macOS und Linux, dazu der Pfad im Proton-Prefix.',
      ],
    },
    en: {
      general: [
        'Twelve species went unrecognised in the save file, the Giant Trevally among them: the game counts it as GIANT_TRAVELLY, its own typo. The mapping is complete now, and species the atlas does not know are reported instead of dropped.',
        'Lures say what they are – spinner, spoon, hard lure, soft lure – in the words of the game files. In the bait list of a species too, where it used to just say “lure”.',
        'The game has live bait in one size, not three. Cut bait, small and large, was missing entirely and is in now.',
        'Craft hooks, fillet and fry are never unlocked by the game and are out of the skill list. “Straight fast” does not exist as a retrieve – the game’s own tutorial names five.',
        'The save folder paths are listed for all three systems, each with a copy button, and the profile slot is selectable: 0, 1 or 2.',
        'This list.',
      ],
      server: [
        'When the save in your browser is newer than the one in your account, it is no longer overwritten. Instead the page says the account holds an older one, with a button to upload.',
        'The save file can be uploaded straight from the account settings, without curl.',
        'Instructions for uploading by itself: task scheduler on Windows, cron on macOS and Linux, plus the path inside the Proton prefix.',
      ],
    },
  },
  {
    version: '1.0.0',
    date: '2026-07-28',
    de: {
      general: [
        'Erste vollständige Fassung: 21 Reviere mit den Spotnummern aus den Spieldateien, 136 Arten mit Beißkurve, Wetter- und Köderinteressen, 79 Köder, 18 Größenstufen.',
        'Spielstand im Browser einlesen: Fänge je Revier, persönliche Rekorde, Rutensets und Fähigkeitenbaum. Die Datei bleibt im Browser.',
        'Englische Adressen ohne Raute, damit jede Seite verlinkbar und auffindbar ist.',
      ],
      offline: [
        'Die Offline-Version als Download: auspacken, index.html öffnen. Karten, Arten, Köder, Größenstufen und die Spielstand-Auswertung laufen ohne Server.',
      ],
      server: [
        'Konten mit Profilseite, Vergleich Zahl für Zahl und Gruppen mit acht Bestenlisten.',
        'Datenschutzerklärung, Cookie-Hinweis und Impressumslink.',
      ],
    },
    en: {
      general: [
        'First complete release: 21 fisheries with the spot numbers from the game files, 136 species with bite curve, weather and bait interests, 79 baits, 18 size steps.',
        'Read your save file in the browser: catches per fishery, personal records, rod sets and the skill tree. The file stays in the browser.',
        'English addresses without a hash, so every page can be linked and found.',
      ],
      offline: [
        'The offline version as a download: unzip, open index.html. Maps, species, baits, size steps and the save-file statistics run without a server.',
      ],
      server: [
        'Accounts with a profile page, a comparison figure by figure, and groups with eight leaderboards.',
        'Privacy policy, cookie note and imprint link.',
      ],
    },
  },
]
