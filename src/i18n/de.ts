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
