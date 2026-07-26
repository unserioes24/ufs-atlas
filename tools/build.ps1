param(
    [string]$Work = (Join-Path $PSScriptRoot '_work'),
    [string]$Proj = (Split-Path $PSScriptRoot -Parent)
)
[Threading.Thread]::CurrentThread.CurrentCulture = [Globalization.CultureInfo]::InvariantCulture
$sp = $Work
$proj = $Proj
Add-Type -AssemblyName System.Drawing

# ---------------------------------------------------------------- fisheries
$FISH = @(
 @{k='pinas';         lvl=4;  map='pinas';          mw=1024; mh=579},
 @{k='pinas-ocean';   lvl=5;  map='pinas';          mw=1024; mh=579},
 @{k='powell';        lvl=6;  map='powell';         mw=1024; mh=579},
 @{k='baikal';        lvl=7;  map='baikal';         mw=1024; mh=579},
 @{k='baikal-winter'; lvl=7;  map='baikal-winter';  mw=1024; mh=579},
 @{k='betty';         lvl=8;  map='betty';          mw=1024; mh=579},
 @{k='betty-winter';  lvl=8;  map='betty-winter';   mw=1024; mh=579},
 @{k='atchafalaya';   lvl=9;  map='atchafalaya';    mw=1024; mh=579},
 @{k='zeno';          lvl=10; map='zeno';           mw=1024; mh=883},
 @{k='uvac';          lvl=11; map='uvac';           mw=1024; mh=579},
 @{k='moraine';       lvl=14; map='moraine';        mw=1024; mh=579},
 @{k='moraine-winter';lvl=14; map='moraine-winter'; mw=1024; mh=579},
 @{k='kariba';        lvl=15; map='kariba';         mw=1024; mh=579},
 @{k='greenland';     lvl=16; map='greenland';      mw=1024; mh=576},
 @{k='greenland-sea'; lvl=17; map='greenland';      mw=1024; mh=576},
 @{k='amazon';        lvl=18; map='amazon';         mw=1284; mh=901},
 @{k='japan';         lvl=19; map='japan';          mw=1024; mh=576},
 @{k='thailand';      lvl=20; map='thailand';       mw=875;  mh=901},
 @{k='taupo';         lvl=22; map='taupo';          mw=1910; mh=1080},
 @{k='florida';       lvl=23; map='florida';        mw=1201; mh=1200}
)

$idx = ConvertFrom-Json ([IO.File]::ReadAllText("$sp\fishindex.json"))

function ResolveRef($refStr, $externals) {
    if (-not $refStr) { return $null }
    $p = $refStr -split ':'
    $fid = [int]$p[0]; $pth = $p[1]
    if ($fid -lt 1 -or $fid -gt $externals.Count) { return $null }
    $ext = $externals[$fid - 1]
    $pm = $idx.PSObject.Properties[$ext]
    if (-not $pm) { return $null }
    $m = $pm.Value
    $pv = $m.PSObject.Properties[$pth]
    if (-not $pv) { return $null }
    return ($pv.Value) -replace '^Fish_', ''
}

# --------------------------------------------------- similarity fit helpers
function FitSimilarity($pts, [bool]$mirror) {
    # pts: array of @{x;z;u;v}
    $n = $pts.Count
    if ($n -lt 2) { return $null }
    $px = 0.0; $pz = 0.0; $qu = 0.0; $qv = 0.0
    foreach ($p in $pts) { $px += $p.x; $pz += $p.z; $qu += $p.u; $qv += $p.v }
    $px /= $n; $pz /= $n; $qu /= $n; $qv /= $n
    $num_r = 0.0; $num_i = 0.0; $den = 0.0
    foreach ($p in $pts) {
        $ar = $p.x - $px
        $ai = if ($mirror) { -($p.z - $pz) } else { $p.z - $pz }
        $br = $p.u - $qu; $bi = $p.v - $qv
        # b * conj(a)
        $num_r += $br * $ar + $bi * $ai
        $num_i += $bi * $ar - $br * $ai
        $den   += $ar * $ar + $ai * $ai
    }
    if ($den -le 1e-9) { return $null }
    $sr = $num_r / $den; $si = $num_i / $den
    # t = qbar - s * pbar
    $pi = if ($mirror) { -$pz } else { $pz }
    $tr = $qu - ($sr * $px - $si * $pi)
    $ti = $qv - ($si * $px + $sr * $pi)
    return @{ sr = $sr; si = $si; tr = $tr; ti = $ti; mirror = $mirror }
}

function ApplyFit($fit, $x, $z) {
    $ai = if ($fit.mirror) { -$z } else { $z }
    $u = $fit.sr * $x - $fit.si * $ai + $fit.tr
    $v = $fit.si * $x + $fit.sr * $ai + $fit.ti
    return @($u, $v)
}

# --------------------------------------------------------------- main build
$speciesAgg = @{}
$out = [ordered]@{}

foreach ($fy in $FISH) {
    $lf = "$sp\fisheries\level$($fy.lvl).json"
    if (-not (Test-Path $lf)) { Write-Host "skip $($fy.k)"; continue }
    $L = ConvertFrom-Json ([IO.File]::ReadAllText($lf))

    # Passende Kartentafel wählen: Winterreviere nutzen MapParentIce, sonst MapParentNormal.
    $wantIce = $fy.k -like '*-winter'
    $panel = $null
    if ($L.panels) {
        $panel = $L.panels | Where-Object { $_.name -eq $(if ($wantIce) { 'MapParentIce' } else { 'MapParentNormal' }) } | Select-Object -First 1
        if (-not $panel -and $wantIce -and $L.panels.Count -gt 1) { $panel = $L.panels[1] }
        if (-not $panel) { $panel = $L.panels[0] }
    }
    if (-not $panel) { $panel = [pscustomobject]@{ mapImage = $L.mapImage; spots = @() } }
    # Liegt das MapImage der Tafel nicht dort, wo erwartet, greift das erste der Szene.
    $mi = $panel.mapImage
    if (-not $mi -or $mi.w -le 0) { $mi = $L.mapImage }

    $imgW = $mi.w * $mi.scale
    $imgH = $mi.h * $mi.scale

    # --- spots -> uv
    $spots = @()
    foreach ($s in $panel.spots) {
        $e = [ordered]@{ n = $s.n }
        if ($imgW -gt 0 -and $imgH -gt 0 -and $null -ne $s.ax) {
            $e.u = 0.5 + ($s.ax - $panel.mapImage.ax) / $imgW
            $e.v = 0.5 - ($s.ay - $panel.mapImage.ay) / $imgH
        }
        if ($null -ne $s.wx) { $e.wx = [Math]::Round($s.wx, 1); $e.wz = [Math]::Round($s.wz, 1); $e.wy = [Math]::Round($s.wy, 1) }
        $spots += [pscustomobject]$e
    }

    # --- fit world -> map from spots that have both uv and world
    $pairs = @()
    foreach ($s in $spots) { if ($null -ne $s.u -and $null -ne $s.wx) { $pairs += @{ x = $s.wx; z = $s.wz; u = $s.u; v = $s.v } } }

    $bmpPath = "$proj\maps\$($fy.map).jpg"
    $bmp = $null
    if (Test-Path $bmpPath) { $bmp = [Drawing.Bitmap]::FromFile($bmpPath) }

    $best = $null; $bestScore = -1; $bestErr = 0
    foreach ($mirror in @($false, $true)) {
        $f = FitSimilarity $pairs $mirror
        if (-not $f) { continue }
        # residual
        $err = 0.0
        foreach ($p in $pairs) { $r = ApplyFit $f $p.x $p.z; $err += [Math]::Sqrt(($r[0] - $p.u) * ($r[0] - $p.u) + ($r[1] - $p.v) * ($r[1] - $p.v)) }
        if ($pairs.Count) { $err /= $pairs.Count }
        # score: spawners in bounds + blueness
        $inb = 0; $blue = 0.0; $tot = 0
        foreach ($sw in $L.spawners) {
            $r = ApplyFit $f $sw.x $sw.z
            $tot++
            if ($r[0] -ge 0 -and $r[0] -le 1 -and $r[1] -ge 0 -and $r[1] -le 1) {
                $inb++
                if ($bmp) {
                    $pxx = [int][Math]::Min($bmp.Width - 1, [Math]::Max(0, $r[0] * $bmp.Width))
                    $pyy = [int][Math]::Min($bmp.Height - 1, [Math]::Max(0, $r[1] * $bmp.Height))
                    $c = $bmp.GetPixel($pxx, $pyy)
                    $blue += ($c.B - $c.R)
                }
            }
            if ($tot -ge 400) { break }
        }
        $score = 0.0
        if ($tot -gt 0) { $score = ($inb / $tot) * 100 + ($(if ($inb) { $blue / $inb } else { 0 })) }
        if ($score -gt $bestScore) { $bestScore = $score; $best = $f; $bestErr = $err }
    }

    # --- spawners -> uv, nearest spot
    $spw = @()
    $agg = @{}
    foreach ($sw in $L.spawners) {
        $names = @()
        $n1 = ResolveRef $sw.ref $L.externals
        if ($n1) { $names += $n1 }
        if ($sw.alt) { foreach ($a in $sw.alt) { $na = ResolveRef $a $L.externals; if ($na -and $names -notcontains $na) { $names += $na } } }
        if ($names.Count -eq 0) { $names = @($sw.s) }
        $name = $names[0]
        $u = $null; $v = $null
        if ($best) { $r = ApplyFit $best $sw.x $sw.z; $u = $r[0]; $v = $r[1] }
        # nearest spot in world space
        $ns = 0; $nd = [double]::MaxValue
        foreach ($s in $spots) {
            if ($null -eq $s.wx) { continue }
            $dx = $sw.x - $s.wx; $dz = $sw.z - $s.wz
            $d = [Math]::Sqrt($dx * $dx + $dz * $dz)
            if ($d -lt $nd) { $nd = $d; $ns = $s.n }
        }
        $cnt = [int]$sw.n
        if ($cnt -le 0) { $cnt = 1 }
        $e = [ordered]@{ s = $name; n = $cnt }
        if ($names.Count -gt 1) { $e.ss = @($names) }
        if ($null -ne $u) { $e.u = [Math]::Round($u, 4); $e.v = [Math]::Round($v, 4) }
        if ($ns -gt 0) { $e.sp = $ns; $e.d = [int]$nd }
        $spw += [pscustomobject]$e

        if (-not $agg.ContainsKey($name)) { $agg[$name] = @{ points = 0; fish = 0; spots = @{} } }
        $agg[$name].points++
        $agg[$name].fish += $cnt
        if ($ns -gt 0 -and $nd -lt 250) { $agg[$name].spots[$ns] = 1 + $(if ($agg[$name].spots.ContainsKey($ns)) { $agg[$name].spots[$ns] } else { 0 }) }
        if (-not $speciesAgg.ContainsKey($name)) { $speciesAgg[$name] = @{} }
        $speciesAgg[$name][$fy.k] = $true
    }
    if ($bmp) { $bmp.Dispose() }

    $sl = @()
    foreach ($kv in ($agg.GetEnumerator() | Sort-Object { -$_.Value.fish })) {
        $topSpots = ($kv.Value.spots.GetEnumerator() | Sort-Object { -$_.Value } | Select-Object -First 6 | ForEach-Object { [int]$_.Key })
        $sl += [pscustomobject][ordered]@{ s = $kv.Key; points = $kv.Value.points; fish = $kv.Value.fish; spots = @($topSpots) }
    }

    # Zusatzarten des New-Fish-Species-DLC: im GameController hinterlegt, ohne Spawner.
    $dlcNames = @()
    foreach ($r in $L.extraFish) {
        $nm = ResolveRef $r $L.externals
        if ($nm -and $dlcNames -notcontains $nm) { $dlcNames += $nm }
    }

    $out[$fy.k] = [ordered]@{
        dlcSpecies = @($dlcNames)
        level    = $fy.lvl
        map      = "maps/$($fy.map).jpg"
        mapW     = $fy.mw
        mapH     = $fy.mh
        fitOk    = [bool]($best -ne $null -and $pairs.Count -ge 3 -and $bestErr -lt 0.09)
        fitErr   = [Math]::Round($bestErr, 4)
        spots    = $spots
        species  = $sl
        spawners = $spw
    }
    Write-Host ("{0,-16} spots={1,-3} arten={2,-3} punkte={3,-5} fitErr={4:F4} score={5:F1}" -f $fy.k, $spots.Count, $sl.Count, $spw.Count, $bestErr, $bestScore)
}

New-Item -ItemType Directory -Force "$sp\out" | Out-Null
Get-ChildItem "$sp\out\*.json" -ErrorAction SilentlyContinue | Remove-Item -Force
foreach ($k in $out.Keys) {
    $j = $out[$k] | ConvertTo-Json -Depth 8 -Compress
    [IO.File]::WriteAllText("$sp\out\$k.json", $j)
}
Write-Host "-> $($out.Keys.Count) Revierdateien in out\"
