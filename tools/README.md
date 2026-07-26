# Extraktion aus den Spieldateien

Diese Skripte erzeugen `gamedata.js`, `maps/*.jpg` und `fish/*.jpg` direkt aus einer
lokalen Installation von *Ultimate Fishing Simulator* (Unity 2017.4.29f1). Sie lesen
ausschließlich und verändern nichts am Spiel.

```powershell
# Windows PowerShell 5.1, im Projektordner:
.\tools\extract.ps1
.\tools\extract.ps1 -Game "D:\Steam\steamapps\common\Ultimate Fishing\UltimateFishing_Data"
.\tools\extract.ps1 -SkipImages          # ohne Fischtexturen (spart ~3 Minuten)
```

Zwischenergebnisse landen in `tools/_work/` und können gelöscht werden.

## Woher welche Angabe stammt

| Angabe | Quelle im Spiel |
| --- | --- |
| Spotnummern und ihre Position auf der Karte | `MapButton`-Objekte im UI der jeweiligen Szene, Position relativ zu `MapImage` |
| Sommer- und Eis-Spots getrennt | jede Szene hat zwei Kartentafeln, `MapParentNormal` und `MapParentIce`, mit eigenen Buttons |
| Zusatzarten des New-Fish-Species-DLC | `GameController.fishFromDLC`, Anteil aus `fishSpawnersDLCAmount` |
| Weltkoordinaten eines Spots | Reiseziel (`QuickJump…`), auf das der Kartenbutton verweist |
| Arten je Revier, Schwarmpunkte, Fischzahl | `FishSpawner_*`-Objekte: `fishPrefab` und die Liste `fishPrefabs` |
| Gewicht, Länge, Beißzeitkurve | Fisch-Prefab in `sharedassets2.assets` (Feldversatz 592 ff., AnimationCurve über 0–24 h) |
| Deutsche Namen, Beschreibungen, Ködernamen | I2-Localization-Tabelle in `resources.assets` (12 Sprachen) |
| Kartenbilder | `Map*`-Texturen in den `sharedassets*.resS` (RGB24 bzw. DXT1) |
| Fischbilder | Albedo-/Diffuse-Texturen der Fischmodelle, automatisch auf den sichtbaren Bereich zugeschnitten |
| 3D-Modelle | Mesh (Klasse 43) des SkinnedMeshRenderers im Fisch-Prefab, Textur über die Material-Eigenschaft `_MainTex` |

## Dateien

- `UfsAssets.cs` – Parser für Unity-`SerializedFile` (Header, Typen, Objekttabelle, externe Referenzen).
  Die Builds enthalten keine Type-Trees, deshalb werden nur Klassen mit bekanntem Layout gelesen:
  GameObject (1), Transform (4), RectTransform (224), Texture2D (28) sowie MonoBehaviour-Rohdaten (114).
- `UfsFishery.cs` – zieht pro Szene Spots, Reiseziele und Spawner heraus.
- `UfsTex.cs` – Texturdecoder (RGB24, RGBA32, ARGB32, BC1/DXT1, BC3/DXT5) und JPEG-Export.
- `terms.ps1` – liest die I2-Termtabelle aus einem Speicherauszug von `resources.assets`.
- `build.ps1` – rechnet Spots auf Kartenkoordinaten um, schätzt die Welt→Karte-Abbildung und
  ordnet jeden Schwarm dem nächstgelegenen Spot zu.
- `build2.ps1` – führt alles zu `gamedata.json` zusammen, inklusive Namensauflösung auf
  Lokalisierungsschlüssel (dieselben Schlüssel nutzt auch der Spielstand).
- `fishimg.ps1` – ordnet Fischtexturen den Arten zu und schneidet sie zu.

## Spawner und DLC-Arten

`FishSpawner` trägt drei Fischfelder, die Reihenfolge stammt aus `Assembly-CSharp.dll`:
`fishPrefab` (ein Fisch), `fishPrefabs` (Liste, aus der gewürfelt wird) und `fishPrefabsDLC`.
An Kariba, Grönland, Grönland-See und Thailand ist `fishPrefab` oft leer und nur die Liste
gefüllt – wer sie überliest, verliert dort mehr als ein Dutzend Arten.

`fishPrefabsDLC` ist in allen 17 Szenen leer, ebenso `GameController.fishSpawnersDLC`.
Die Arten des New-Fish-Species-DLC haben also keine festen Plätze: `GameController.fishFromDLC`
nennt nur, welche Arten ein Revier bekommt, und `fishSpawnersDLCAmount` (0,25 bis 0,40),
welchen Anteil der gewöhnlichen Spawner das Spiel zur Laufzeit an sie abgibt. Betroffen sind
allein die acht Basisreviere; die DLC-Karten führen keine Zusatzarten.

`tools/dlcfish.ps1` und `tools/dlccheck.ps1` prüfen beides nach, `tools/guidecheck.ps1`
vergleicht `data.json` gegen die Spieldateien.

## Köder und Bissmodell

Welcher Fisch auf welchen Köder anspricht, steht doch in den Spieldateien: jedes
Köder-Prefab in `sharedassets2.assets` trägt ein `FishLikesParams` mit einer Liste
`fishInterests`, je Eintrag eine Artennummer und ein Interesse zwischen 0 und 1.
`tools/baits.ps1` liest das aus (161 Köder, `_work/baits.json`). Erkannt wird der
Block über sein Ende – hinter der Liste steht `paramsParseText`, danach hört der
Baustein auf; die Artennummern selbst sind stellenweise unsortiert.

Ob ein Fisch beißt, gewichtet `Fish` über neun Regler mit je einer Kurve:
Uhrzeit, Hunger, Köderhöhe, Temperatur, Wind, Luftdruck, Bewölkung, Regen und
Ködergeschwindigkeit. `tools/bitecurves.ps1` liest sie (`_work/bitecurves.json`).

Bespielt sind davon nur vier: Uhrzeit, Wind, Bewölkung und Regen. Hunger,
**Köderhöhe**, Temperatur, Luftdruck und Ködergeschwindigkeit stehen bei allen
134 Arten auf der Konstanten 1, alle neun Gewichte ebenfalls. Die Ködertiefe
entscheidet also nicht über die Bissbereitschaft – sie entscheidet nur darüber,
ob der Köder überhaupt dort ankommt, wo der Schwarm steht.

## Größenstufen

Haken- und Ködergröße rechnet das Spiel über 18 Stufen ab. Im Hauptmenü (`level2`)
führt `FishManager` vier Listen aus `Vector2`, jede mit einer Zeile je Stufe:

| Liste | Bedeutung |
| --- | --- |
| `baitToFishSize` | Ködergröße → Fischlänge in Metern |
| `hookToFishWeight` | Hakengröße → Fischgewicht in kg |
| `lureToFishWeight` | dasselbe für Kunstköder |
| `flyToFishWeight` | dasselbe für Fliegen |

Dazu kommt `EquipmentManager.hookSizesCm` – die Spaltbreite des Hakens, trotz des
Feldnamens in Metern (6 bis 90 mm). `tools/hooks.ps1` liest alles nach
`_work/hooks.json`.

Die Spannen überlappen und wandern mit der Größe nach oben: Stufe 1 fängt 0–4 kg,
Stufe 18 dann 964–3277 kg. Ein zu großer Haken lässt kleine Fische also aus, daher
die Meldung „Denke über einen kleineren Haken nach“. Kunstköder greifen erst ab
Stufe 2, Fliegen ab Stufe 4; darunter fangen sie nichts.

Die Beschriftung steht nicht als Tabelle in den Daten, sondern entsteht in
`UtilitiesUnits.GetHookSizeString(int)`. Der IL-Code dort macht nur zweierlei:
Index 0 bis 5 wird zu `#12, #8, #6, #4, #2, #1`, alles darüber zu
`#` + (Index − 5) + `/0`. Ergibt genau die 18 Größen **#12, #8, #6, #4, #2, #1,
#1/0 … #12/0**; `hooks.ps1` legt sie als Liste mit ab.

## Führung beim Spinnfischen

Hinter den Kurven steht in `Fish` die Liste `spinningMethodFactor`, ein Wert
zwischen 0 und 1 je Eintrag des Enums `SpinningMethod`: `NONE`, `STRAIGHT_SLOW`,
`STRAIGHT`, `STRAIGHT_FAST`, `LIFT_DROP`, `STOP_GO`, `TWITCHING`. Danach folgt
`floatMethodFactor` für das Posenfischen, der bei allen Arten auf 1 steht.
`bitecurves.ps1` liest beides; für 128 der 134 Arten ist die Liste vorhanden.

Ein Karpfen etwa steht auf `Straight langsam` bei 100 %, auf `Lift & Drop` und
`Stop & Go` bei 60 % und auf `Straight`, `Straight schnell` und `Twitching` bei 0 –
diese drei Führungen bringen bei ihm also gar nichts.

## Grenzen

- Die Welt→Karte-Abbildung wird aus den Spotpaaren geschätzt. Liegen die Spots fast auf einer
  Linie oder ist das Kartenbild nicht maßstabsgetreu, wird sie verworfen (`fitOk: false`) und
  es werden nur die Spots gezeichnet, keine Schwarmpunkte. Betroffen sind Baikal, Grönland,
  Japan, Kariba, Taupo und Florida.
- Hakengrößen stehen nicht als eigenes Feld in den Spieldaten; das Spiel leitet sie aus der
  Fischgröße ab. Die Hakenangaben im Guide bleiben deshalb Community-Werte.
- Die Byte-Offsets der Kartentexturen in `extract.ps1` gelten für den Spielstand vom Juli 2026.
  Nach einem Spiel-Update müssen sie neu ermittelt werden (Texturnamen beginnen mit `Map`
  bzw. heißen `map_03`, `map_japan_01`, `florida_map_01`).
