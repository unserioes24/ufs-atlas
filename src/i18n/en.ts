import type { Dict } from './index'

/**
 * English. Keys are the same as in de.ts; anything missing falls back to the
 * German text, so a half-finished translation never shows a placeholder.
 */
export const en: Partial<Dict> = {
  // ------------------------------------------------------------- General
  'app.name': 'UFS Atlas',
  'app.tagline': 'Ultimate Fishing Simulator 1',
  'app.searchPlaceholder': 'Search fish, bait, spot or method …',
  'app.loading': 'Loading …',
  'app.back': '← Back',
  'app.ok': 'Ok',
  'app.close': 'Close',
  'app.save': 'Save',
  'app.cancel': 'Cancel',
  'app.copy': 'Copy',
  'app.copied': '✓ Copied',
  'app.none': '–',
  'app.offline':
    'Accounts and groups need the server. Open the guide at {url} instead of as a local file.',

  // ---------------------------------------------------------- Navigation
  'nav.start': 'Start',
  'nav.fisheries': 'Fisheries',
  'nav.species': 'Species',
  'nav.baits': 'Baits',
  'nav.stats': 'Statistics',
  'nav.profile': 'Profile',
  'nav.login': 'Sign in',
  'nav.sources': 'Sources',
  'nav.caughtTotal': 'Species caught in total',

  // ----------------------------------------------------------- Fisheries
  'map.overview': 'All fisheries',
  'map.maps': 'Maps',
  'map.spotsFromFiles': 'Spots per game files',
  'map.speciesHere': 'Species in this fishery',
  'map.style': 'Style',
  'map.caughtOf': '{done} of {total} caught',
  'map.travelPoints': '{n} travel points from the game files',
  'map.swarms': 'Fish shoals ({n})',
  'map.hoverHint': 'Hover a point for details, click to filter',
  'map.guideOnly': 'guide only',
  'map.dlcSpecies': 'DLC species',
  'map.fishHere': '{n} fish',
  'map.noProjection':
    'For this fishery the world coordinates of the shoals cannot be projected onto the map image reliably. Spot numbers and the species per spot still hold – only the extra shoal points stay hidden.',
  'map.boatOnly':
    'The game files hold no map points for this fishery – here you fish from the boat only.',

  // ---------------------------------------------------------------- Fish
  'fish.spot': 'Spot',
  'fish.hook': 'Hook',
  'fish.bestTime': 'Best time',
  'fish.bestMethod': 'Best method',
  'fish.bestRetrieve': 'Best retrieve',
  'fish.baits': 'Baits',
  'fish.groundbait': 'Groundbait',
  'fish.fromGameFiles': 'From the game files',
  'fish.weight': 'Weight',
  'fish.length': 'Length',
  'fish.sizes': 'Matching size steps',
  'fish.weather': 'Weather',
  'fish.yourRecord': 'Your record',
  'fish.caught': 'caught',
  'fish.open': 'open',

  // ------------------------------------------------------------- Methods
  'method.fly': 'Fly',
  'method.lure': 'Lure',
  'method.natural': 'Natural bait',
  'method.boilie': 'Boilie',
  'method.flyRod': 'Fly rod',
  'method.spinRod': 'Spinning rod',
  'method.floatGround': 'Float / ground',
  'method.groundRig': 'Ground rig',
  'method.threshold':
    'The game needs weather × preference × line ≥ 0.4 for a bite (casual 0.29).',
  'method.needsWeather': 'With {method} a weather value from {pct} % is enough.',
  'method.hopeless': 'No method gets past the threshold here without perfect conditions.',
  'method.threePieces': 'Three pieces on the hook lift natural bait to {pct} %.',

  // ---------------------------------------------------------- Statistics
  'stats.title': 'Statistics',
  'stats.level': 'Level',
  'stats.points': 'Points',
  'stats.species': 'Species',
  'stats.fisheriesComplete': 'Fisheries complete',
  'stats.catches': 'Catches',
  'stats.bites': 'Bites',
  'stats.totalWeight': 'Total weight',
  'stats.time': 'Time fished',
  'stats.heaviest': 'Heaviest',
  'stats.longest': 'Longest',

  // -------------------------------------------------------------- Account
  'auth.title': 'Sign in',
  'auth.intro':
    'No password: you get a six-digit code by e-mail. With an account your profile lives on the server, you can join groups and compare.',
  'auth.email': 'your@mail.com',
  'auth.requestCode': 'Request code',
  'auth.sending': 'Sending …',
  'auth.checking': 'Checking …',
  'auth.codeSent': 'The code is on its way. It is valid for 15 minutes.',
  'auth.verify': 'Sign in',
  'auth.verifying': 'Checking …',
  'auth.stayLoggedIn': 'Stay signed in',
  'auth.stayHint': '(90 days, on this device only)',
  'auth.logout': 'Sign out',

  // --------------------------------------------------------------- Profile
  'profile.yours': 'Your profile',
  'profile.other': 'Profile',
  'profile.overview': 'Overview',
  'profile.records': 'Species',
  'profile.missing': 'Still missing',
  'profile.duel': 'Compared to you',
  'profile.groups': 'Groups',
  'profile.followers': 'Followers',
  'profile.follows': 'Following',
  'profile.settings': 'Settings',
  'profile.copyLink': 'Copy link',
  'profile.follow': 'Follow',
  'profile.following': '✓ Following',
  'profile.saveState': 'Save file from',
  'profile.noSave': 'No save file uploaded yet.',

  // ---------------------------------------------------------------- Groups
  'group.public': 'Public',
  'group.publicHint': 'listed in the directory, anyone may join',
  'group.unlisted': 'Unlisted',
  'group.unlistedHint': 'only found by link or code, joining is open',
  'group.private': 'Private',
  'group.privateHint': 'only members see it, joining needs the code',
  'group.create': 'New group',
  'group.join': 'Join',
  'group.joinWithCode': 'Join with code',
  'group.leave': 'Leave',
  'group.edit': 'Edit',
  'group.delete': 'Delete group',
  'group.members': 'Members',
  'group.admin': 'Group admin',
  'group.newCode': 'New code',
  'group.directory': 'Public groups',
}
