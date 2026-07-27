/**
 * Deutsch ist die Ausgangssprache: Was hier steht, ist der Maßstab für alle
 * anderen Dateien. Fehlt anderswo ein Schlüssel, wird dieser Text gezeigt.
 *
 * Aufbau der Schlüssel: <bereich>.<sache>. Platzhalter in {geschweiften
 * Klammern} werden zur Laufzeit gefüllt.
 */
export const de = {
  // ------------------------------------------------------------- Allgemein
  'app.name': 'UFS Atlas',
  'app.tagline': 'Ultimate Fishing Simulator 1',
  'app.searchPlaceholder': 'Fisch, Köder, Spot oder Methode suchen …',
  'app.loading': 'Wird geladen …',
  'app.back': '← Zurück',
  'app.ok': 'Ok',
  'app.close': 'Schließen',
  'app.save': 'Speichern',
  'app.cancel': 'Abbrechen',
  'app.copy': 'Kopieren',
  'app.copied': '✓ Kopiert',
  'app.none': '–',
  'app.offline':
    'Konten und Gruppen brauchen den Server. Öffne den Guide dafür über {url} statt als lokale Datei.',

  // ------------------------------------------------------------ Navigation
  'nav.start': 'Start',
  'nav.fisheries': 'Reviere',
  'nav.species': 'Arten',
  'nav.baits': 'Köder',
  'nav.stats': 'Statistik',
  'nav.profile': 'Profil',
  'nav.login': 'Anmelden',
  'nav.sources': 'Quellen',
  'nav.caughtTotal': 'Gefangene Arten insgesamt',

  // --------------------------------------------------------------- Reviere
  'map.overview': 'Gesamtübersicht',
  'map.maps': 'Karten',
  'map.spotsFromFiles': 'Spots laut Spieldaten',
  'map.speciesHere': 'Arten in diesem Revier',
  'map.style': 'Angelstil',
  'map.caughtOf': '{done} von {total} gefangen',
  'map.travelPoints': '{n} Reisepunkte aus den Spieldateien',
  'map.swarms': 'Fischschwärme ({n})',
  'map.hoverHint': 'Punkt überfahren für Details, klicken zum Filtern',
  'map.guideOnly': 'nur Guide',
  'map.dlcSpecies': 'DLC-Art',
  'map.fishHere': '{n} Fische',
  'map.noProjection':
    'Bei diesem Revier lassen sich die Weltkoordinaten der Schwärme nicht verlässlich auf das Kartenbild projizieren. Spotnummern und die Artenzuordnung je Spot stimmen trotzdem – nur die zusätzlichen Schwarm-Punkte bleiben ausgeblendet.',
  'map.boatOnly':
    'Für dieses Revier enthalten die Spieldateien keine Kartenpunkte – hier wird ausschließlich vom Boot aus gefischt.',

  // ------------------------------------------------------------------ Fisch
  'fish.spot': 'Spot',
  'fish.hook': 'Haken',
  'fish.bestTime': 'Beste Zeit',
  'fish.bestMethod': 'Beste Angelart',
  'fish.bestRetrieve': 'Beste Führung',
  'fish.baits': 'Köder',
  'fish.groundbait': 'Grundfutter / Anfütterung',
  'fish.fromGameFiles': 'Aus den Spieldateien',
  'fish.weight': 'Gewicht',
  'fish.length': 'Länge',
  'fish.sizes': 'Passende Größenstufen',
  'fish.weather': 'Wetter',
  'fish.yourRecord': 'Dein Rekord',
  'fish.caught': 'gefangen',
  'fish.open': 'offen',

  // ------------------------------------------------------------- Angelarten
  'method.fly': 'Fliege',
  'method.lure': 'Kunstköder',
  'method.natural': 'Naturköder',
  'method.boilie': 'Boilie',
  'method.flyRod': 'Fliegenrute',
  'method.spinRod': 'Spinnrute',
  'method.floatGround': 'Pose / Grund',
  'method.groundRig': 'Grundmontage',
  'method.threshold':
    'Das Spiel verlangt Wetter × Vorliebe × Schnur ≥ 0,4 für einen Biss (Casual 0,29).',
  'method.needsWeather': 'Mit {method} reicht ein Wetterwert ab {pct} %.',
  'method.hopeless': 'Keine Angelart kommt hier ohne perfekte Bedingungen über die Schwelle.',
  'method.threePieces':
    'Drei Köderstücke am Haken heben den Naturköder auf bis zu {pct} %.',

  // -------------------------------------------------------------- Statistik
  'stats.title': 'Statistik',
  'stats.level': 'Level',
  'stats.points': 'Punkte',
  'stats.species': 'Arten',
  'stats.fisheriesComplete': 'Reviere komplett',
  'stats.catches': 'Fänge',
  'stats.bites': 'Bisse',
  'stats.totalWeight': 'Masse gesamt',
  'stats.time': 'Angelzeit',
  'stats.heaviest': 'Schwerster',
  'stats.longest': 'Längster',

  // ----------------------------------------------------------------- Konto
  'auth.title': 'Anmelden',
  'auth.intro':
    'Kein Passwort: Du bekommst einen sechsstelligen Code per E-Mail. Mit dem Konto liegt dein Profil auf dem Server, du kannst Gruppen beitreten und dich vergleichen.',
  'auth.email': 'deine@mail.de',
  'auth.requestCode': 'Code anfordern',
  'auth.sending': 'Sende …',
  'auth.checking': 'Prüfung läuft …',
  'auth.codeSent': 'Code ist unterwegs. Er gilt 15 Minuten.',
  'auth.verify': 'Anmelden',
  'auth.verifying': 'Prüfe …',
  'auth.stayLoggedIn': 'Angemeldet bleiben',
  'auth.stayHint': '(90 Tage, nur auf diesem Gerät)',
  'auth.logout': 'Abmelden',

  // ---------------------------------------------------------------- Profil
  'profile.yours': 'Dein Profil',
  'profile.other': 'Profil',
  'profile.overview': 'Übersicht',
  'profile.records': 'Arten',
  'profile.missing': 'Was noch fehlt',
  'profile.duel': 'Vergleich mit dir',
  'profile.groups': 'Gruppen',
  'profile.followers': 'Follower',
  'profile.follows': 'Folgt',
  'profile.settings': 'Einstellungen',
  'profile.copyLink': 'Link kopieren',
  'profile.follow': 'Folgen',
  'profile.following': '✓ Du folgst',
  'profile.saveState': 'Stand des Spielstands',
  'profile.noSave': 'Noch kein Spielstand hochgeladen.',

  // ------------------------------------------------------------ Startseite
  'start.eyebrow': 'Fan-Atlas · Ultimate Fishing Simulator 1',
  'start.headline': 'Die Zahlen kommen aus den Spieldateien.',
  'start.lead':
    'Spots, Artenlisten, Beißzeiten, Ködervorlieben und Größenstufen sind ausgelesen, nicht geschätzt. Was aus der Community-Recherche stammt, steht als solches dabei.',
  'start.ctaMaps': 'Reviere öffnen',
  'start.ctaSpecies': 'Arten ansehen',
  'start.ctaSave': 'Spielstand laden',
  'start.wallTitle': 'Beißzeit über 24 Stunden, je Art aus dem Spiel',
  'start.wallHint': 'dunkel = Nacht · zum Öffnen anklicken',

  'start.factFisheries': 'Reviere',
  'start.factSpecies': 'Arten',
  'start.factSpots': 'Spots',
  'start.factShoals': 'Schwarmpunkte',
  'start.factBaits': 'Köder',
  'start.factCurves': 'Beißzeitkurven',

  'start.featuresTitle': 'Was der Atlas kann',
  'start.mapsTitle': 'Reviere und Spots',
  'start.mapsText':
    '{maps} Karten mit den Spotnummern aus dem Spiel, den Schwarmpunkten auf dem Kartenbild und der Artenliste je Spot – mitsamt der Zahl der Fische, die dort stehen.',
  'start.mapsCta': 'Karten öffnen',
  'start.speciesTitle': 'Arten',
  'start.speciesText':
    '{species} Arten mit Gewichts- und Längenspanne, Beißzeitkurve, Wetterkurven und der Beschreibung aus der Enzyklopädie des Spiels.',
  'start.speciesCta': 'Artenliste',
  'start.baitsTitle': 'Köder und Angelart',
  'start.baitsText':
    'Für jede Art die Ködervorliebe in Prozent, dazu die beste Angelart – Fliege, Kunstköder, Pose oder Grund – und der Faktor jeder Führung beim Spinnfischen.',
  'start.baitsCta': 'Köderseite',
  'start.sizesTitle': 'Größenstufen',
  'start.sizesText':
    'Haken von #12 bis #12/0 mit der Gewichtsspanne, die sie fangen, dazu die Stufen für Kunstköder und Fliegen. {steps} Stufen, direkt aus dem FishManager.',
  'start.sizesCta': 'Zu den Arten',
  'start.saveTitle': 'Dein Spielstand',
  'start.saveText':
    'Die PROFILE-Datei laden und sehen, was fehlt: je Revier, je Art, mit deinem Rekord neben dem möglichen Maximum. Die Datei bleibt im Browser.',
  'start.saveCta': 'Spielstand laden',
  'start.profileTitle': 'Profil und Vergleich',
  'start.profileText':
    'Ein Konto gibt dir eine teilbare Profilseite. Wer sie öffnet und selbst angemeldet ist, sieht seinen Stand daneben – Kennzahl für Kennzahl, Revier für Revier, Art für Art.',
  'start.profileCta': 'Konto anlegen',
  'start.groupsTitle': 'Gruppen',
  'start.groupsText':
    'Öffentlich, nicht gelistet oder privat. Acht Ranglisten: schwerster und längster Fisch, Gesamtmasse, stärkste Art, Arten, komplette Reviere, Fänge, Angelzeit.',
  'start.groupsCta': 'Gruppen ansehen',
  'start.offlineTitle': 'Läuft auch ohne Server',
  'start.offlineText':
    'Der Guide ist fertiges HTML und JavaScript. Ohne Netz bleibt alles außer Konto und Gruppen benutzbar; abgehakte Arten liegen im Browser.',
  'start.offlineCta': 'Ausprobieren',

  'start.sourcesTitle': 'Woher die Zahlen kommen',
  'start.fromGame': 'Aus den Spieldateien',
  'start.fromGame1': 'Spotnummern und ihre Lage auf dem Kartenbild',
  'start.fromGame2': 'Artenliste je Revier und je Spot, mit der Zahl der Fische',
  'start.fromGame3': 'Gewichts- und Längenspanne, Beißzeitkurve, Wetterkurven',
  'start.fromGame4': 'Ködervorliebe je Art, Ködertyp, Führungsfaktoren',
  'start.fromGame5': 'Größenstufen für Haken, Kunstköder, Fliegen und Köder',
  'start.fromGame6': 'Namen und Beschreibungen aus der Lokalisierung',
  'start.fromCommunity': 'Aus der Community-Recherche',
  'start.fromCommunity1': 'Hakengrößen als Erfahrungswert je Art und Revier',
  'start.fromCommunity2': 'Tiefenangaben und Montagehinweise',
  'start.fromCommunity3': 'Strategien je Spot und Vertrauensstufe je Eintrag',
  'start.communityNote':
    'Diese Angaben sind im Guide als Community-Werte gekennzeichnet. Wo die Spieldateien etwas Genaueres hergeben, ersetzt es sie.',

  'start.openTitle': 'Offen und nachprüfbar',
  'start.openText':
    'Der Quelltext und die Werkzeuge, die die Spieldateien auslesen, liegen offen. Wer die Zahlen anzweifelt, kann sie mit derselben Spielinstallation nachziehen.',
  'start.openCta': 'Auf GitHub ansehen',
  'start.footer': 'Fan-Projekt, nicht mit den Entwicklern verbunden. Guide-Stand {guide}.',

  // --------------------------------------------------------------- Gruppen
  'group.public': 'Öffentlich',
  'group.publicHint': 'steht im Verzeichnis, jeder darf beitreten',
  'group.unlisted': 'Nicht gelistet',
  'group.unlistedHint': 'nur über Link oder Code zu finden, Beitritt frei',
  'group.private': 'Privat',
  'group.privateHint': 'nur Mitglieder sehen sie, Beitritt nur mit Code',
  'group.create': 'Neue Gruppe',
  'group.join': 'Beitreten',
  'group.joinWithCode': 'Mit Code beitreten',
  'group.leave': 'Verlassen',
  'group.edit': 'Bearbeiten',
  'group.delete': 'Gruppe löschen',
  'group.members': 'Mitglieder',
  'group.admin': 'Gruppenadmin',
  'group.newCode': 'Neuer Code',
  'group.directory': 'Öffentliche Gruppen',
} as const
