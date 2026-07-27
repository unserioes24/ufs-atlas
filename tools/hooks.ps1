<#
    Reads the size tables from the main menu (level2).

    FishManager holds four lists of Vector2, each with 18 steps:

        baitToFishSize    bait size   -> fish length (metres)
        hookToFishWeight  hook size   -> fish weight (kg)
        lureToFishWeight  lure        -> fish weight (kg)
        flyToFishWeight   fly         -> fish weight (kg)

    On top of that EquipmentManager holds hookSizesCm, 18 values as well: the
    gap of the hook, in metres despite the field name.

    The four lists sit at the end of the FishManager class and can therefore be
    read safely from the end of the block backwards.

    Output: tools\_work\hooks.json
#>
param(
    [string]$Game = 'C:\Program Files (x86)\Steam\steamapps\common\Ultimate Fishing\UltimateFishing_Data',
    [string]$Work = (Join-Path $PSScriptRoot '_work'),
    [string]$Scene = 'level2'
)
$ErrorActionPreference = 'Stop'
[Threading.Thread]::CurrentThread.CurrentCulture = [Globalization.CultureInfo]::InvariantCulture
Add-Type -Path @("$PSScriptRoot\UfsAssets.cs", "$PSScriptRoot\UfsFishery.cs")

function New-Rdr([byte[]]$b) { New-Object Ufs.Reader -ArgumentList @(, $b) }

$sf = New-Object Ufs.SerializedFile((Join-Path $Game $Scene))
$goName = @{}; $goComps = @{}
foreach ($o in $sf.Objects) {
    if ($o.ClassId -ne 1) { continue }
    try {
        $r = New-Rdr $sf.Read($o)
        $n = $r.I32(); if ($n -lt 0 -or $n -gt 500) { continue }
        $c = New-Object System.Collections.ArrayList
        for ($i = 0; $i -lt $n; $i++) { [void]$r.I32(); [void]$c.Add($r.I64()) }
        [void]$r.I32()
        $goName[[long]$o.PathId] = $r.Str(); $goComps[[long]$o.PathId] = $c
    } catch { }
}

function Get-Blob($name, $minSize) {
    $k = @($goName.Keys | Where-Object { $goName[$_] -eq $name })[0]
    if ($null -eq $k) { throw "$name not found in $Scene" }
    foreach ($cid in $goComps[$k]) {
        if (-not $sf.ById.ContainsKey([long]$cid)) { continue }
        $co = $sf.ById[[long]$cid]
        if ($co.ClassId -eq 114 -and $co.ByteSize -ge $minSize) { return $sf.Read($co) }
    }
    throw "Kein passender Baustein an $name"
}

# --- FishManager: four Vector2 lists, read backwards from the end of the block
$d = Get-Blob 'FishManager' 4000
$p = $d.Length
$lists = @()
for ($round = 0; $round -lt 4; $round++) {
    $hit = $null
    for ($n = 1; $n -le 64; $n++) {
        $start = $p - 4 - $n * 8
        if ($start -lt 28) { break }
        if ([BitConverter]::ToInt32($d, $start) -ne $n) { continue }
        $rows = @(); $ok = $true
        for ($i = 0; $i -lt $n; $i++) {
            $x = [BitConverter]::ToSingle($d, $start + 4 + $i * 8)
            $y = [BitConverter]::ToSingle($d, $start + 8 + $i * 8)
            if ([double]::IsNaN($x) -or [double]::IsNaN($y) -or $x -lt 0 -or $y -lt $x -or $y -gt 100000) { $ok = $false; break }
            $rows += , @([Math]::Round($x, 3), [Math]::Round($y, 3))
        }
        if (-not $ok) { continue }
        $hit = @{ start = $start; rows = $rows }
        break
    }
    if (-not $hit) { throw "list $round not found (position $p)" }
    $lists = , $hit + $lists
    $p = $hit.start
}

# --- EquipmentManager: hookSizesCm, a rising row of the same length
$e = Get-Blob 'EquipmentManager' 4000
$want = $lists[0].rows.Count
$sizes = $null
for ($q = 28; $q + 4 -le $e.Length; $q += 4) {
    if ([BitConverter]::ToInt32($e, $q) -ne $want) { continue }
    if ($q + 4 + $want * 4 -gt $e.Length) { continue }
    $vals = @(); $ok = $true; $prev = 0
    for ($i = 0; $i -lt $want; $i++) {
        $v = [BitConverter]::ToSingle($e, $q + 4 + $i * 4)
        if ([double]::IsNaN($v) -or $v -le $prev -or $v -gt 1) { $ok = $false; break }
        $prev = $v; $vals += [Math]::Round($v, 4)
    }
    if ($ok) { $sizes = $vals; break }
}
$sf.Close()

# Labels for the steps. They are nowhere as a table; they are built in
# UtilitiesUnits.GetHookSizeString(int). The code there does nothing but:
#     Index 0..5  ->  "#" + {12, 8, 6, 4, 2, 1}
#     Index > 5   ->  "#" + (Index - 5) + "/0"
# giving #12, #8, #6, #4, #2, #1, #1/0, #2/0 ... #12/0 – exactly 18 steps.
$SMALL = 12, 8, 6, 4, 2, 1
$labels = @()
for ($i = 0; $i -lt $want; $i++) {
    if ($i -lt $SMALL.Count) { $labels += '#' + $SMALL[$i] }
    else { $labels += '#' + ($i - 5) + '/0' }
}

$out = [ordered]@{
    steps      = $want
    label      = $labels                # labels as in the shop
    gap        = $sizes                 # gap of the hook, in metres
    baitLength = $lists[0].rows         # bait size -> fish length in metres
    hook       = $lists[1].rows         # hook size -> fish weight in kg
    lure       = $lists[2].rows
    fly        = $lists[3].rows
}
New-Item -ItemType Directory -Force $Work | Out-Null
($out | ConvertTo-Json -Depth 6) | Set-Content -Encoding utf8 (Join-Path $Work 'hooks.json')

"Stufen: $want"
"{0,-6} {1,-10} {2,-18} {3,-18} {4,-18} {5}" -f 'Größe', 'Spalt', 'Haken kg', 'Kunstköder kg', 'Fliege kg', 'Köder -> Länge m'
for ($i = 0; $i -lt $want; $i++) {
    "{0,-6} {1,-10} {2,-18} {3,-18} {4,-18} {5}" -f $labels[$i],
        $(if ($sizes) { [string]([Math]::Round($sizes[$i] * 1000)) + ' mm' } else { '?' }),
        ("{0}-{1}" -f $out.hook[$i][0], $out.hook[$i][1]),
        ("{0}-{1}" -f $out.lure[$i][0], $out.lure[$i][1]),
        ("{0}-{1}" -f $out.fly[$i][0], $out.fly[$i][1]),
        ("{0}-{1}" -f $out.baitLength[$i][0], $out.baitLength[$i][1])
}
