<#
    Liest aus den Köder-Prefabs, welcher Fisch wie stark auf welchen Köder beißt.

    Die Klasse Bait trägt ein Feld fishLikesParams (FishLikesParams):

        float             defaultValue     Grundinteresse aller übrigen Arten
        List<FishInterest> fishInterests   je Eintrag: int species, float interest
        string            paramsParseText  im Build leer, nur Editor-Hilfe
        string[]          split            ebenso leer

    Im serialisierten Block ergibt das die Folge
        [float][int n][n * (int, float)][int 0][int 0]
    und die ist zusammen mit dem Wertebereich der Artennummern eindeutig genug.

    Ausgabe: tools\_work\baits.json
#>
param(
    [string]$Game = 'C:\Program Files (x86)\Steam\steamapps\common\Ultimate Fishing\UltimateFishing_Data',
    [string]$Work = (Join-Path $PSScriptRoot '_work'),
    [string]$Assets = 'sharedassets2.assets'
)
$ErrorActionPreference = 'Stop'
[Threading.Thread]::CurrentThread.CurrentCulture = [Globalization.CultureInfo]::InvariantCulture
Add-Type -Path @("$PSScriptRoot\UfsAssets.cs", "$PSScriptRoot\UfsFishery.cs")

$enum = @{}
foreach ($e in (Get-Content (Join-Path $Work 'species_enum.json') -Raw | ConvertFrom-Json)) { $enum[[int]$e.v] = $e.n }

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
    $best = $null
    foreach ($cid in $goComps[$k]) {
        if (-not $sf.ById.ContainsKey([long]$cid)) { continue }
        $co = $sf.ById[[long]$cid]
        if ($co.ClassId -ne 114) { continue }
        $d = $sf.Read($co)

        # Erkannt wird der Block über sein Ende: hinter der Liste steht
        # paramsParseText, und damit hört der Baustein auf. Die Artennummern
        # sind teils unsortiert, taugen also nicht als Merkmal.
        for ($p = 28; $p + 8 -le $d.Length; $p += 4) {
            $def = [BitConverter]::ToSingle($d, $p)
            if ($def -lt 0 -or $def -gt 1) { continue }
            $n = [BitConverter]::ToInt32($d, $p + 4)
            if ($n -lt 50 -or $n -gt 200) { continue }
            $end = $p + 8 + $n * 8
            if ($end + 4 -gt $d.Length) { continue }
            $len = [BitConverter]::ToInt32($d, $end)
            if ($len -lt 0 -or $end + 4 + $len -gt $d.Length) { continue }
            $after = $end + 4 + $len
            if ($after % 4 -ne 0) { $after += 4 - ($after % 4) }
            if ($after -ne $d.Length) { continue }

            $list = [ordered]@{}
            $ok = $true
            $nonZero = 0
            $seen = @{}
            for ($i = 0; $i -lt $n; $i++) {
                $q = $p + 8 + $i * 8
                $sp = [BitConverter]::ToInt32($d, $q)
                $iv = [BitConverter]::ToSingle($d, $q + 4)
                if ($sp -lt 0 -or $sp -gt 160 -or $seen.ContainsKey($sp)) { $ok = $false; break }
                if ($iv -lt 0 -or $iv -gt 1) { $ok = $false; break }
                $seen[$sp] = $true
                if ($iv -gt 0.02) { $nonZero++ }
                if ($enum.ContainsKey($sp)) { $list[$enum[$sp]] = [Math]::Round($iv, 3) }
            }
            if (-not $ok -or $nonZero -lt 1) { continue }
            $best = [ordered]@{ defaultValue = [Math]::Round($def, 3); fish = $list }
            break
        }
        if ($best) { break }
    }
    if ($best) { $result[$goName[$k]] = $best }
}
$sf.Close()

New-Item -ItemType Directory -Force $Work | Out-Null
($result | ConvertTo-Json -Depth 6) | Set-Content -Encoding utf8 (Join-Path $Work 'baits.json')

"Köder-Prefabs gefunden : $($keys.Count)"
"davon mit Fischtabelle : $($result.Count)"
""
$result.GetEnumerator() | Select-Object -First 12 | ForEach-Object {
    $top = ($_.Value.fish.GetEnumerator() | Sort-Object { -$_.Value } | Select-Object -First 5 |
            ForEach-Object { "$($_.Key) $($_.Value)" }) -join ', '
    "{0,-34} default={1,-6} Arten={2,-4} {3}" -f $_.Key, $_.Value.defaultValue, $_.Value.fish.Count, $top
}
