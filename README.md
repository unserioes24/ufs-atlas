<div align="center">

# UFS Atlas

**Every number in this guide was read out of the game. Not guessed, not measured by hand — read.**

A companion for *Ultimate Fishing Simulator 1* that opens the game's own Unity
files and takes out what the wiki pages estimate: which species stands at which
spot, how keenly it takes each of 79 baits, when it bites over 24 hours, and
which hook size actually reaches it.

[**ufs-atlas.de**](https://ufs-atlas.de) · [Download the offline version](https://github.com/unserioes24/ufs-atlas/releases/latest) · German and English

</div>

---

## Why this exists

Community guides say things like *"use a medium hook and a worm"*. The game
knows better than that. Inside `sharedassets2.assets`, every fish prefab carries
a `FishLikesParams` block: one entry per species, one interest value between 0
and 1, per bait. `Fish.LikesBait` then decides a bite from nine weighted curves.

That means a sentence like

> Pike take a Rush Diver at 100 %, Straight and Twitching retrieves both work,
> best around 12:00, and hooks #12 to #6 reach them.

is not an opinion. It is four values out of the installed game, and you can
reproduce every one of them from your own copy with the scripts in `tools/`.

Where the game says nothing — hook sizes per fishery, depth advice, which spot
farms best — the guide falls back on community research and **marks it as such**,
with a confidence level. The two are never mixed silently.

## What you get

| | |
| --- | --- |
| **21 fisheries** | the game's own map image with its numbered travel points. Hover a point for the species within casting range; the shoal positions are projected from world coordinates onto the picture. |
| **136 species** | weight and length range, the 24-hour bite curve, wind, cloud and rain curves, the encyclopedia text, and which of fly, lure, float or ground gets past the bite threshold. |
| **79 baits** | interest per species in percent, straight from the prefabs, plus the bait type read from the `Bait` component. |
| **18 size steps** | hooks from #12 to #12/0 with the weight each one catches, and the separate tables for lures and flies. |
| **Your save file** | drop in `PROFILE_0` and the guide fills itself: catches per fishery, personal records, rod sets, the skill tree. The file is read in the browser and goes nowhere. |
| **Profiles and groups** | a shareable page of your figures. Anyone signed in who opens it sees their own state beside yours — figure by figure, fishery by fishery, species by species, each with the date of both save files. Groups carry eight leaderboards. |

## Run it

```bash
npm install
npm run dev          # http://localhost:5173, /api proxied to the live server
npm run build        # server build into dist/
npm run build:offline # single-file build into dist-offline/
```

Point the proxy elsewhere with `UFS_API=http://localhost:8080 npm run dev`.

**Without a server the guide still works.** Maps, species, baits, size steps and
the save-file statistics all run in the browser — that is what the offline
release is. Only accounts, profiles and groups need the backend.

## Reading the game files

```powershell
.\tools\extract.ps1    # Windows PowerShell 5.1, with the game installed
```

Out comes `src/data/gamedata.json` and the map images. Nothing about the
installation is changed; the scripts only read. The pipeline is a Unity
`SerializedFile` parser in C# plus PowerShell around it — the builds carry no
type trees, so classes are read at known byte offsets and every value is
sanity-checked before it is kept.

[`tools/README.md`](tools/README.md) documents where each figure comes from,
down to the field in the prefab.

### A few things it had to work out

- **Spot numbers.** The number the game draws on a map button is not the order
  the buttons sit in the Unity hierarchy. At Saint Zeno the two run 1…8 against
  8, 6, 3, 1, 4, 7, 2, 5. The real number lives in a `Text` under the button and
  is only trusted where the labels form a complete run for the whole board.
- **World → map.** Shoal coordinates are fitted onto the map image, first as a
  similarity transform, and where that does not hold as an affine one. Florida
  needs it: the picture is squeezed differently in width than in height, and the
  mean error drops from 0.19 to 0.008.
- **DLC species.** `fishPrefabsDLC` is empty in all 17 scenes. The New Fish
  Species DLC has no fixed spawn points at all — the game hands those species a
  share of the ordinary spawners at runtime, and the guide says so instead of
  inventing spots.

## Layout

| Path | What it is |
| --- | --- |
| `src/` | the app: TypeScript, React, Tailwind |
| `src/data/` | `guide.json` (research) and `gamedata.json` (extracted) |
| `src/i18n/` | interface text, one file per language |
| `tools/` | the extraction pipeline, PowerShell and C# |
| `server/` | Symfony backend; in production it serves the guide too |
| `deploy/`, `Dockerfile.web` | container and delivery |

## Honest limits

Shoals move in the game. Spot numbers and the species per spot follow the spawn
definitions of the scene — they are not a promise that a fish stands there right
now. Hook and rig values from the community are tested starting points, and low
confidence is labelled in the interface. Two offshore fisheries, Greenland Sea
and Piñas Bay Ocean, have no map board in the game at all, so the guide shows
none either.

The byte offsets of the map textures hold for the July 2026 build. After a game
update they have to be found again.

---

<div align="center">

A fan project, not affiliated with the developers. *Ultimate Fishing Simulator*
is a trademark of its owners; no game assets are redistributed here.

</div>
