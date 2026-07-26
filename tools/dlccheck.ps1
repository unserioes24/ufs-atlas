<#
    Prüft, ob die Arten des New-Fish-Species-DLC eigene Spawnpunkte haben.

    Liest jede Szene mit dem echten Feld-Layout von FishSpawner (aus
    Assembly-CSharp.dll) und zählt, an welchen Spawnern eine fishPrefabsDLC-Liste
    hängt. Ergebnis: tools\_work\dlc\<level>.json plus eine Übersicht auf der
    Konsole.
#>
param(
    [string]$Game = 'C:\Program Files (x86)\Steam\steamapps\common\Ultimate Fishing\UltimateFishing_Data',
    [string]$Work = (Join-Path $PSScriptRoot '_work')
)

$ErrorActionPreference = 'Stop'
[Threading.Thread]::CurrentThread.CurrentCulture = [Globalization.CultureInfo]::InvariantCulture

Add-Type -Path @("$PSScriptRoot\UfsAssets.cs", "$PSScriptRoot\UfsFishery.cs", "$PSScriptRoot\UfsSpawnerDlc.cs")

$LEVELS = 4, 5, 6, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 20, 22, 23
$dst = Join-Path $Work 'dlc'
New-Item -ItemType Directory -Force $dst | Out-Null

# Nummer -> Artenschlüssel, aus dem Enum Fish.Species
$enum = @{}
foreach ($e in (Get-Content (Join-Path $Work 'species_enum.json') -Raw | ConvertFrom-Json)) { $enum[[int]$e.v] = $e.n }

# Prefab-Pfad -> Artenschlüssel, über fishindex/prefabkeys aus der bestehenden Pipeline
$fishIndex = Get-Content (Join-Path $Work 'fishindex.json') -Raw | ConvertFrom-Json
$prefabKeys = Get-Content (Join-Path $Work 'prefabkeys.json') -Raw | ConvertFrom-Json

function Resolve-Ptr($externals, $ref) {
    $parts = $ref -split ':'
    $fileId = [int]$parts[0]
    $pathId = $parts[1]
    $src = if ($fileId -eq 0) { $null } else {
        if ($fileId -le $externals.Count) { Split-Path $externals[$fileId - 1] -Leaf } else { $null }
    }
    if (-not $src) { return $null }
    $tbl = $fishIndex.$src
    if (-not $tbl) { return $null }
    $prefab = $tbl.$pathId
    if (-not $prefab) { return $null }
    $key = $prefabKeys.$prefab
    if ($key) { return $key }
    return $prefab
}

$summary = @()
foreach ($lv in $LEVELS) {
    $path = Join-Path $Game "level$lv"
    if (-not (Test-Path $path)) { continue }
    $json = [Ufs.SpawnerDlc]::Run($path)
    Set-Content -Path (Join-Path $dst "level$lv.json") -Value $json -Encoding utf8
    $d = $json | ConvertFrom-Json

    $withDlc = @($d.spawners | Where-Object { $_.dlc.Count -gt 0 })
    $dlcSpecies = @{}
    foreach ($s in $withDlc) {
        foreach ($ref in $s.dlc) {
            $k = Resolve-Ptr $d.externals $ref
            if ($k) { $dlcSpecies[$k] = $true } else { $dlcSpecies["?$ref"] = $true }
        }
    }
    $summary += [pscustomobject]@{
        Level      = "level$lv"
        Spawner    = $d.spawners.Count
        MitDLC     = $withDlc.Count
        DLCArten   = ($dlcSpecies.Keys | Sort-Object) -join ', '
    }
}

$summary | Format-Table -AutoSize | Out-String -Width 200
