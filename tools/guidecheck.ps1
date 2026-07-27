<#
    Compares data.json (the researched guide) against the game files: which
    species does the guide list at a fishery without it occurring there in the
    game files?

    -Apply writes data.json back without those entries.
#>
param(
    [string]$Proj = (Split-Path $PSScriptRoot -Parent),
    [switch]$Apply
)
$ErrorActionPreference = 'Stop'

$data = Get-Content (Join-Path $Proj 'data.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$gtext = Get-Content (Join-Path $Proj 'gamedata.js') -Raw -Encoding UTF8
$gjson = $gtext.Substring($gtext.IndexOf('{'))
$gjson = $gjson.TrimEnd() -replace ';$', ''
$game = $gjson | ConvertFrom-Json

# Name index of the game data: English and German -> species key
$byName = @{}
foreach ($p in $game.species.PSObject.Properties) {
    $k = $p.Name; $s = $p.Value
    foreach ($n in @($s.en, $s.de)) {
        if (-not $n) { continue }
        $norm = ($n.ToLower() -replace '[^a-z0-9]', '')
        if ($norm -and -not $byName.ContainsKey($norm)) { $byName[$norm] = $k }
    }
}
# The same rules as NAME_ALIAS and EQUIV in the app.
$NAME_ALIAS = @{
    'apapa' = 'APAPA'; 'grayling' = 'WHITE_GRAYLING'; 'commonbleak' = 'BLEAK'
    'longfineel' = 'LONGFIN_EEL'; 'redlionfish' = 'COMMON_LIONFISH'; 'graysnapper' = 'GREY_SNAPER'
}
$EQUIV = @(
    @('GREAT_BARRACUDA', 'BARRACUDA'),
    @('GRAY_SNAPPER_C', 'GREY_SNAPER'),
    @('GIANT_GROUPER', 'GIANT_GROUPER_D'),
    @('BLACKTIP_REEF_SHARK', 'BLACKTIP_SHARK_D')
)
function Get-Key($name, $de) {
    foreach ($n in @($name, $de)) {
        if (-not $n) { continue }
        $norm = ($n.ToLower() -replace '[^a-z0-9]', '')
        if ($NAME_ALIAS.ContainsKey($norm)) { return $NAME_ALIAS[$norm] }
        if ($byName.ContainsKey($norm)) { return $byName[$norm] }
    }
    return $null
}
function Test-InFishery($key, $mapId) {
    if (-not $key) { return $false }
    $set = $inFishery[$mapId]
    if ($set.ContainsKey($key)) { return $true }
    foreach ($grp in $EQUIV) {
        if ($grp -notcontains $key) { continue }
        foreach ($alt in $grp) { if ($set.ContainsKey($alt)) { return $true } }
    }
    return $false
}

# Arten je Revier laut Spieldateien (inklusive DLC-Arten)
$inFishery = @{}
foreach ($p in $game.fisheries.PSObject.Properties) {
    $set = @{}
    foreach ($s in $p.Value.species) { $set[$s.s] = $true }
    $inFishery[$p.Name] = $set
}

$mapName = @{}
foreach ($m in $game.PSObject.Properties) { }
foreach ($m in $data.maps) { $mapName[$m.id] = $m.name }

$keep = New-Object System.Collections.ArrayList
$drop = New-Object System.Collections.ArrayList
foreach ($f in $data.fish) {
    $key = Get-Key $f.name $f.de
    $known = $inFishery.ContainsKey($f.mapId)
    if (-not $known) { [void]$keep.Add($f); continue }          # fishery without game data (Italy)
    if (Test-InFishery $key $f.mapId) { [void]$keep.Add($f); continue }
    [void]$drop.Add([pscustomobject]@{
        Revier = $mapName[$f.mapId]; MapId = $f.mapId
        Art    = $f.name; De = $f.de
        Key    = if ($key) { $key } else { '(no species key)' }
        Id     = $f.id
    })
}

"Guide-Einträge gesamt : $($data.fish.Count)"
"davon in Spieldaten   : $($keep.Count)"
"nicht in Spieldaten   : $($drop.Count)"
""
$drop | Sort-Object Revier, Art | Format-Table Revier, Art, De, Key -AutoSize | Out-String -Width 200

if ($Apply) {
    $data.fish = $keep.ToArray()
    $json = $data | ConvertTo-Json -Depth 12
    [IO.File]::WriteAllText((Join-Path $Proj 'data.json'), $json, (New-Object Text.UTF8Encoding($false)))
    "data.json geschrieben: $($keep.Count) Einträge."
}
