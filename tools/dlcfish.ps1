<#
    Dritter Anlauf: die Liste fishFromDLC im GameController finden.

    Muster im Block:  [int n][n PPtr auf Fisch-Prefabs][float amount][int m]
    wobei m die Länge von fishSpawnersDLC ist (0, wenn die Liste leer bleibt).
#>
param(
    [string]$Game = 'C:\Program Files (x86)\Steam\steamapps\common\Ultimate Fishing\UltimateFishing_Data',
    [string]$Work = (Join-Path $PSScriptRoot '_work')
)
$ErrorActionPreference = 'Stop'
[Threading.Thread]::CurrentThread.CurrentCulture = [Globalization.CultureInfo]::InvariantCulture
Add-Type -Path @("$PSScriptRoot\UfsAssets.cs", "$PSScriptRoot\UfsFishery.cs")

$LEVELS = 4, 5, 6, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 20, 22, 23
$fishIndex = Get-Content (Join-Path $Work 'fishindex.json') -Raw | ConvertFrom-Json
$prefabKeys = Get-Content (Join-Path $Work 'prefabkeys.json') -Raw | ConvertFrom-Json
function New-Rdr([byte[]]$bytes) { New-Object Ufs.Reader -ArgumentList @(, $bytes) }

$report = @()
foreach ($lv in $LEVELS) {
    $path = Join-Path $Game "level$lv"
    if (-not (Test-Path $path)) { continue }
    $sf = New-Object Ufs.SerializedFile($path)

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

    # Fisch-Prefabs dieser Szene: PPtr -> Artenschlüssel
    function Resolve-Fish($fid, $ptr) {
        if ($fid -le 0 -or $fid -gt $sf.Externals.Count) { return $null }
        $src = Split-Path $sf.Externals[$fid - 1] -Leaf
        $tbl = $fishIndex.$src
        if (-not $tbl) { return $null }
        $prefab = $tbl."$ptr"
        if (-not $prefab) { return $null }
        $k = $prefabKeys.$prefab
        if ($k) { return $k }
        return $prefab
    }

    $hits = @()
    foreach ($k in $goName.Keys) {
        if ($goName[$k] -ne 'GameController') { continue }
        foreach ($cid in $goComps[$k]) {
            if (-not $sf.ById.ContainsKey([long]$cid)) { continue }
            $co = $sf.ById[[long]$cid]
            if ($co.ClassId -ne 114 -or $co.ByteSize -lt 300) { continue }
            $d = $sf.Read($co)
            for ($p = 28; $p + 12 -le $d.Length; $p += 4) {
                $n = [BitConverter]::ToInt32($d, $p)
                if ($n -lt 1 -or $n -gt 40) { continue }
                if ($p + 4 + $n * 12 + 8 -gt $d.Length) { continue }
                $names = @(); $ok = $true
                for ($i = 0; $i -lt $n; $i++) {
                    $q = $p + 4 + $i * 12
                    $nm = Resolve-Fish ([BitConverter]::ToInt32($d, $q)) ([BitConverter]::ToInt64($d, $q + 4))
                    if (-not $nm) { $ok = $false; break }
                    $names += $nm
                }
                if (-not $ok) { continue }
                $q = $p + 4 + $n * 12
                $amount = [BitConverter]::ToSingle($d, $q)
                $m = [BitConverter]::ToInt32($d, $q + 4)
                $hits += [pscustomobject]@{ Offset = $p; Fische = $names; Amount = $amount; Folgezahl = $m }
            }
        }
    }
    foreach ($h in $hits) {
        $report += [pscustomobject]@{
            Level = "level$lv"; Offset = $h.Offset; Anzahl = $h.Fische.Count
            Amount = [Math]::Round($h.Amount, 4); Danach = $h.Folgezahl
            Arten = ($h.Fische | Sort-Object -Unique) -join ', '
        }
    }
    if (-not $hits) { $report += [pscustomobject]@{ Level = "level$lv"; Offset = ''; Anzahl = 0; Amount = ''; Danach = ''; Arten = '' } }
    $sf.Close()
}
$report | Format-Table -AutoSize | Out-String -Width 250
