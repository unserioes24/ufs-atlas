# Reading the game files

These scripts produce `src/data/gamedata.json` and `public/maps/*.jpg` straight from a
local installation of *Ultimate Fishing Simulator* (Unity 2017.4.29f1). They only read;
nothing about the game is changed.

```powershell
# Windows PowerShell 5.1, from the project folder:
.\tools\extract.ps1
.\tools\extract.ps1 -Game "D:\Steam\steamapps\common\Ultimate Fishing\UltimateFishing_Data"
```

Intermediate results land in `tools/_work/` and can be deleted. Afterwards run
`npm run build` so the site picks up the new numbers.

No game assets are redistributed with this repository beyond the map images the guide
needs to place its spots.

## Where each value comes from

| Value | Source in the game |
| --- | --- |
| Spot numbers and their place on the map | `MapButton` objects in the UI of each scene, positioned relative to `MapImage` |
| Summer and ice spots kept apart | every scene has two map boards, `MapParentNormal` and `MapParentIce`, with their own buttons |
| Extra species of the New Fish Species DLC | `GameController.fishFromDLC`, share from `fishSpawnersDLCAmount` |
| World coordinates of a spot | the travel target (`QuickJump…`) the map button points at |
| Species per fishery, shoal points, fish counts | `FishSpawner_*` objects: `fishPrefab` and the list `fishPrefabs` |
| Weight, length, bite curve | fish prefab in `sharedassets2.assets` (field offset 592 ff., AnimationCurve over 0–24 h) |
| Names, descriptions, bait names | I2 localisation table in `resources.assets` (12 languages) |
| Map images | `Map*` textures in the `sharedassets*.resS` (RGB24 or DXT1) |

## Files

- `UfsAssets.cs` – parser for Unity `SerializedFile` (header, types, object table, external
  references). The builds carry no type trees, so only classes with a known layout are read:
  GameObject (1), Transform (4), RectTransform (224), Texture2D (28) and raw MonoBehaviour
  data (114).
- `UfsFishery.cs` – pulls spots, travel targets and spawners out of a scene.
- `UfsTex.cs` – texture decoder (RGB24, RGBA32, ARGB32, BC1/DXT1, BC3/DXT5) and JPEG export.
- `terms.ps1` – reads the I2 term table from a memory dump of `resources.assets`.
- `build.ps1` – turns spots into map coordinates, estimates the world→map projection and
  assigns every shoal to its nearest spot.
- `build2.ps1` – merges everything into `src/data/gamedata.json`, including the resolution of
  names onto localisation keys (the save file uses the same keys).
- `baits.ps1`, `baittypes.ps1`, `bitecurves.ps1`, `hooks.ps1` – bait tables, bait types, the
  bite model and the size steps.

## Spawners and DLC species

`FishSpawner` carries three fish fields; the order comes from `Assembly-CSharp.dll`:
`fishPrefab` (a single fish), `fishPrefabs` (a list to draw from) and `fishPrefabsDLC`.
At Kariba, Greenland, Greenland Sea and Thailand `fishPrefab` is often empty and only the
list is filled — miss it and more than a dozen species disappear there.

`fishPrefabsDLC` is empty in all 17 scenes, and so is `GameController.fishSpawnersDLC`. The
species of the New Fish Species DLC therefore have no fixed places: `GameController.fishFromDLC`
only names which species a fishery gets, and `fishSpawnersDLCAmount` (0.25 to 0.40) says what
share of the ordinary spawners the game hands to them at runtime. This affects the eight base
fisheries only; the DLC maps carry no extra species.

`tools/dlcfish.ps1` and `tools/dlccheck.ps1` verify both; `tools/guidecheck.ps1` compares the
guide data against the game files.

## Baits and the bite model

Which fish wants which bait is in the game files after all: every bait prefab in
`sharedassets2.assets` carries a `FishLikesParams` with a list `fishInterests`, one entry per
species number and an interest between 0 and 1. `tools/baits.ps1` reads it (161 baits,
`_work/baits.json`). The block is recognised by its end — behind the list sits
`paramsParseText`, and that is where the component stops; the species numbers themselves are
partly unsorted.

Whether a fish bites is weighted by `Fish` across nine dials, each with its own curve: time of
day, hunger, bait depth, temperature, wind, pressure, cloudiness, rain and bait speed.
`tools/bitecurves.ps1` reads them (`_work/bitecurves.json`).

Only four of them are filled in: time, wind, cloudiness and rain. Hunger, **bait depth**,
temperature, pressure and bait speed sit at a constant 1 for all 134 species, and so do all
nine weights. Bait depth therefore does not decide whether a fish is willing to bite — it only
decides whether the bait reaches where the shoal stands.

## Method: fly, lure, float, ground

Which method works for a species is decided in `Fish.LikesBait`:

```
eval  = mean(time, wind, clouds, rain)               FishBaitEvaluator.Evaluate
eval *= Bait.CheckTaste(fish)                        bait preference 0…1
   with a float (float/ground):
        + Boilie.GetFishInterest(species) × 0.2      ground rig with a feeder only
   without a float (spinning, fly):
        × spinningMethodFactor[retrieve]             0 for "no retrieve"
        × 0.8 on top when the reel level does not match the fish size
eval *= Mathf.Lerp(0.6, 1, 1 − FishingLine.scareFactor)
bite when eval ≥ 0.4   (casual mode ≥ 0.29)
```

Three things follow from that:

- **Float and ground have no factor of their own.** `floatMethodFactor` sits at 1 for every
  species and is never read outside the constructor.
- **The threshold is hard.** A preference of 0.4 demands a weather value of 1.0 — practically
  out of reach. The difference between two methods is therefore often not "rarer" but "never".
- **Natural bait stacks.** With several pieces on the hook `CheckTaste` computes
  `best piece + 0.2 × each further one`, so three pieces give 1.4×.

`tools/baittypes.ps1` reads the bait type from the `Bait` component of the prefabs
(`_work/baittypes.json`): `BaitType` is the first field behind `m_Name`. Natural baits do not
carry that component — they are `baitParts` on a hook, and the hook is the bait object. A
prefab with a species table but no `Bait` is therefore a natural bait. Of 171 prefabs, 16 are
flies, 123 lures (spinners, spoons, wobblers, soft baits), 22 natural baits and 10 boilies.

From this `build2.ps1` stores four percentages per species in `species.m`: the best preference
reachable with fly, lure, natural bait and boilie. Across all 153 species the median spread
between the best and the weakest method is 0.50; for 51 species it is 0.8 or more.

## Size steps

Hook and bait size are settled over 18 steps. In the main menu (`level2`) `FishManager` carries
four lists of `Vector2`, each with one row per step:

| List | Meaning |
| --- | --- |
| `baitToFishSize` | bait size → fish length in metres |
| `hookToFishWeight` | hook size → fish weight in kg |
| `lureToFishWeight` | the same for lures |
| `flyToFishWeight` | the same for flies |

On top of that comes `EquipmentManager.hookSizesCm` — the gap of the hook, in metres despite
the field name (6 to 90 mm). `tools/hooks.ps1` reads it all into `_work/hooks.json`.

The ranges overlap and move up with the size: step 1 catches 0–4 kg, step 18 then 964–3277 kg.
A hook that is too big misses small fish, hence the in-game hint to think about a smaller one.
Lures only start at step 2, flies at step 4; below that they catch nothing.

The labels are not a table in the data; they are built in `UtilitiesUnits.GetHookSizeString(int)`.
The IL there does only two things: index 0 to 5 become `#12, #8, #6, #4, #2, #1`, anything above
becomes `#` + (index − 5) + `/0`. That gives exactly the 18 sizes **#12, #8, #6, #4, #2, #1,
#1/0 … #12/0**; `hooks.ps1` stores them as a list.

## Retrieve when spin fishing

Behind the curves `Fish` holds the list `spinningMethodFactor`, a value between 0 and 1 per
entry of the `SpinningMethod` enum: `NONE`, `STRAIGHT_SLOW`, `STRAIGHT`, `STRAIGHT_FAST`,
`LIFT_DROP`, `STOP_GO`, `TWITCHING`. After it comes `floatMethodFactor` for float fishing,
which sits at 1 for every species. `bitecurves.ps1` reads both; the list is present for 128 of
the 134 species.

A carp, for example, sits at 100 % on `Straight slow`, at 60 % on `Lift & drop` and `Stop & go`,
and at 0 on `Straight`, `Straight fast` and `Twitching` — those three do nothing for it.

## World → map

The projection from world coordinates onto the map image is estimated from the spots that carry
both: a position in the scene and a position on the map image.

A similarity transform is tried first (rotation, uniform scale, translation, optionally
mirrored). Where that does not hold, an affine map with separate scales per axis takes over.
Several maps need it because the image is squeezed differently in width than in height — most
clearly Florida, where the mean error drops from 0.19 to 0.008. The affine solution is only
accepted from four spots upwards and when it is clearly better; otherwise the simpler one stays.

## Limits

- Without spots on the map image there is no projection: `Piñas Bay – Ocean` and
  `Greenland – Sea` are pure offshore maps and therefore show no shoal points (`fitOk: false`).
- Hook sizes are not a field of their own in the game data; the game derives them from the fish
  size. The hook values in the guide therefore stay community knowledge.
- The byte offsets of the map textures in `extract.ps1` hold for the July 2026 build. After a
  game update they have to be found again (texture names start with `Map`, or are called
  `map_03`, `map_japan_01`, `florida_map_01`).
