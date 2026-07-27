<#
    Liest je Köder-Prefab den Ködertyp aus dem Baustein Bait. Die Klasse
    beginnt unmittelbar hinter m_Name mit

        BaitType baitType     0 HOOK, 1 SPINNER, 2 SPOON, 3 WOBBLER,
                              4 SOFT_BAIT, 5 FLY, 6 SAKURA_DLC_01
        int      hookSize     Größenstufe 0..17
        float    sizeScaleFactor
        Vector2  fishLengthRange
        Vector2  fishWeightRang
        FlyType  flyType      0 DRY, 1 WET, 2 NYMPH, 3 STREAMER
        HookColor hookColor

    Naturköder tragen diesen Baustein nicht: sie werden als baitParts an einen
    Haken gesteckt, und der Haken ist das Bait-Objekt. Ein Prefab mit
    Fischtabelle, aber ohne Bait-Baustein, ist deshalb ein Naturköder.

    Ausgabe: tools\_work\baittypes.json
#>
param(
    [string]$Game = 'C:\Program Files (x86)\Steam\steamapps\common\Ultimate Fishing\UltimateFishing_Data',
    [string]$Work = (Join-Path $PSScriptRoot '_work'),
    [string]$Assets = 'sharedassets2.assets'
)
$ErrorActionPreference = 'Stop'
[Threading.Thread]::CurrentThread.CurrentCulture = [Globalization.CultureInfo]::InvariantCulture
Add-Type -Path @("$PSScriptRoot\UfsAssets.cs", "$PSScriptRoot\UfsFishery.cs")

$BAIT_TYPE = @('HOOK', 'SPINNER', 'SPOON', 'WOBBLER', 'SOFT_BAIT', 'FLY', 'SAKURA_DLC')
$FLY_TYPE = @('DRY', 'WET', 'NYMPH', 'STREAMER')

function New-Rdr([byte[]]$b) { New-Object Ufs.Reader -ArgumentList @(, $b) }

$sf = New-Object Ufs.SerializedFile((Join-Path $Game $Assets))
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

$result = [ordered]@{}
$keys = @($goName.Keys | Where-Object { $goName[$_] -match '^(Bait_|Boilie)' } | Sort-Object { $goName[$_] })
foreach ($k in $keys) {
    $name = $goName[$k]
    foreach ($cid in $goComps[$k]) {
        if (-not $sf.ById.ContainsKey([long]$cid)) { continue }
        $co = $sf.ById[[long]$cid]
        if ($co.ClassId -ne 114) { continue }
        $d = $sf.Read($co)
        if ($d.Length -lt 80) { continue }

        $len = [BitConverter]::ToInt32($d, 28)
        if ($len -lt 0 -or $len -gt 200) { continue }
        $p = 32 + $len
        if ($p % 4) { $p += 4 - ($p % 4) }
        if ($p + 32 -gt $d.Length) { continue }

        $bt = [BitConverter]::ToInt32($d, $p)
        $hs = [BitConverter]::ToInt32($d, $p + 4)
        $l0 = [BitConverter]::ToSingle($d, $p + 12); $l1 = [BitConverter]::ToSingle($d, $p + 16)
        $w0 = [BitConverter]::ToSingle($d, $p + 20); $w1 = [BitConverter]::ToSingle($d, $p + 24)
        $ft = [BitConverter]::ToInt32($d, $p + 28)
        if ($bt -lt 0 -or $bt -gt 6) { continue }
        if ($hs -lt 0 -or $hs -gt 20) { continue }
        if ($ft -lt 0 -or $ft -gt 3) { continue }
        if ([double]::IsNaN($l0) -or [double]::IsNaN($w0)) { continue }
        if ($l1 -lt $l0 -or $l1 -gt 20 -or $w1 -lt $w0 -or $w1 -gt 5000) { continue }

        $e = [ordered]@{ type = $BAIT_TYPE[$bt]; hookSize = $hs }
        if ($bt -eq 5) { $e.fly = $FLY_TYPE[$ft] }
        $result[$name] = $e
        break
    }
}
$sf.Close()

New-Item -ItemType Directory -Force $Work | Out-Null
($result | ConvertTo-Json -Depth 4) | Set-Content -Encoding utf8 (Join-Path $Work 'baittypes.json')

"Köder-Prefabs         : $($keys.Count)"
"davon mit Bait-Baustein: $($result.Count)"
"ohne (= Naturköder)    : $($keys.Count - $result.Count)"
""
$result.GetEnumerator() | Group-Object { $_.Value.type } | Sort-Object Count -Descending |
    ForEach-Object { '  {0,-12} {1}' -f $_.Name, $_.Count }
