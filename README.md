# UFS Atlas — a guide for Ultimate Fishing Simulator 1

Web app for **Ultimate Fishing Simulator 1 (PC/Steam)**. It combines numbers read
straight out of a local game installation with values researched by the community,
and it always says which is which.

Live at **[ufs-atlas.de](https://ufs-atlas.de)**. The interface is German today;
English is being added.

## Running it

```bash
npm install
npm run dev        # development server on http://localhost:5173
npm run build      # production build into dist/
```

`npm run dev` proxies `/api` to the live server. Point it somewhere else with
`UFS_API=http://localhost:8080 npm run dev`.

Without the API the guide still works: maps, species, baits, size steps and the
save-file statistics all run in the browser. Accounts, profiles and groups need
the server.

## What it does

- **Fishery maps from the game** — the original map of every fishery with its
  numbered travel points. Hovering a point shows the species within casting
  range, clicking filters the list to that spot. Shoal positions are projected
  from the scene onto the map image.
- **A catch list** — tick species off by hand or import your save file
  (`PROFILE_0` / `PROFILE_1`), which also brings your personal records.
- **Per species from the game files** — weight and length range, the 24-hour
  bite curve, weather curves, encyclopedia text, and the best fishing method.
- **Baits and methods** — how strongly each species wants each bait, in percent;
  which of fly, lure, float or ground actually works; and the factor of every
  retrieve when spin fishing.
- **Size steps** — hooks from #12 to #12/0 with the fish weight each one catches,
  plus the separate tables for lures and flies.
- **Statistics** from your save file: progress per fishery and per species, your
  record next to what the species can reach.
- **Profiles** (`#angler/<name>`) — a shareable page with your numbers. Anyone
  signed in who opens it sees their own state next to yours: figure by figure,
  fishery by fishery, species by species, each with the date of both save files.
- **Groups** — public, unlisted or private, with eight leaderboards.
- **The address bar is the state**: `#revier/betty`, `#revier/moraine/spot3`,
  `#arten/PIKE`, `#koeder`, `#statistik`, `#angler/Name/gruppen`.

## Where the numbers come from

| From the game files | From community research |
| --- | --- |
| Spot numbers and their position on the map | Hook sizes per species and fishery |
| Species per fishery and per spot, with fish counts | Depth hints and rig notes |
| Weight and length range, bite curve, weather curves | Strategies per spot |
| Bait preference per species, bait type, retrieve factors | |
| Size steps for hooks, lures, flies and baits | |
| Names and descriptions from the localisation table | |

The split is visible in the interface: game data sits in the blue block, community
values carry a confidence level. See [`tools/README.md`](tools/README.md) for how
the extraction works — every number can be reproduced from your own install.

## Layout

| Path | What it is |
| --- | --- |
| `src/` | the app: TypeScript, React, Tailwind |
| `src/data/` | `guide.json` (research) and `gamedata.json` (extracted) |
| `src/i18n/` | interface texts, one file per language |
| `maps/` | fishery maps from the game |
| `tools/` | the extraction pipeline, PowerShell and C# |
| `server/` | Symfony backend; in production it also serves the guide |
| `deploy/`, `Dockerfile.web` | container and delivery |

## A note on the data

Shoals move in the game. Spot numbers and species per spot follow the spawn
definitions of the scene; they are not a promise that a fish stands there right
now. Community values for hooks and rigs are tested starting points, and low
confidence is marked as such in the interface.

Fan project, not affiliated with the developers. Ultimate Fishing Simulator is a
trademark of its owners; no game assets are redistributed here.
