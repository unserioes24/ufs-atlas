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
    if ($fit.affine) {
        # Compute in floating point on purpose: PowerShell follows the left
        # operand's type, and the hashtable can hand back an integer one.
        $xx = [double]$x; $zz = [double]$z
        $u = [double]$fit.ca * $xx + [double]$fit.cb * $zz + [double]$fit.cc
        $v = [double]$fit.cd * $xx + [double]$fit.ce * $zz + [double]$fit.cf
        return @($u, $v)
    }
    $ai = if ($fit.mirror) { -$z } else { $z }
    $u = $fit.sr * $x - $fit.si * $ai + $fit.tr
    $v = $fit.si * $x + $fit.sr * $ai + $fit.ti
    return @($u, $v)
}

<#
    Some map images are not true to scale: Florida for one is squeezed
    differently in width than in height. A similarity transform (rotation plus
    uniform scale) cannot express that, an affine one can. Solved through the
    normal equations, 3x3 by Cramer's rule.

        u = a*x + b*z + c        v = d*x + e*z + f
#>
function Det3($a11, $a12, $a13, $a21, $a22, $a23, $a31, $a32, $a33) {
    $t1 = $a11 * ($a22 * $a33 - $a23 * $a32)
    $t2 = $a12 * ($a21 * $a33 - $a23 * $a31)
    $t3 = $a13 * ($a21 * $a32 - $a22 * $a31)
    return [double]($t1 - $t2 + $t3)
}

function FitAffine($pts) {
    # From three points the map is exactly solvable but unchecked. Only from
    # four points does the residual mean anything.
    if ($pts.Count -lt 4) { return $null }
    $sxx = 0.0; $sxz = 0.0; $sx = 0.0; $szz = 0.0; $sz = 0.0; $s1 = 0.0
    $sux = 0.0; $suz = 0.0; $su = 0.0; $svx = 0.0; $svz = 0.0; $sv = 0.0
    foreach ($p in $pts) {
        $x = [double]$p.x; $z = [double]$p.z; $u = [double]$p.u; $v = [double]$p.v
        $sxx += $x * $x; $sxz += $x * $z; $sx += $x
        $szz += $z * $z; $sz += $z; $s1 += 1
        $sux += $u * $x; $suz += $u * $z; $su += $u
        $svx += $v * $x; $svz += $v * $z; $sv += $v
    }
    $det = Det3 $sxx $sxz $sx  $sxz $szz $sz  $sx $sz $s1
    if ([Math]::Abs($det) -lt 1e-9) { return $null }

    $a = (Det3 $sux $sxz $sx  $suz $szz $sz  $su $sz $s1) / $det
    $b = (Det3 $sxx $sux $sx  $sxz $suz $sz  $sx $su $s1) / $det
    $c = (Det3 $sxx $sxz $sux  $sxz $szz $suz  $sx $sz $su) / $det
    $d = (Det3 $svx $sxz $sx  $svz $szz $sz  $sv $sz $s1) / $det
    $e = (Det3 $sxx $svx $sx  $sxz $svz $sz  $sx $sv $s1) / $det
    $f = (Det3 $sxx $sxz $svx  $sxz $szz $svz  $sx $sz $sv) / $det

    # Drop degenerate solutions: the map has to preserve area and must not
    # collapse onto a line.
    $area = [Math]::Abs($a * $e - $b * $d)
    if ($area -lt 1e-9) { return $null }

    return @{ affine = $true; ca = [double]$a; cb = [double]$b; cc = [double]$c
              cd = [double]$d; ce = [double]$e; cf = [double]$f }
}

# --------------------------------------------------------------- main build
$speciesAgg = @{}
$out = [ordered]@{}

foreach ($fy in $FISH) {
    $lf = "$sp\fisheries\level$($fy.lvl).json"
    if (-not (Test-Path $lf)) { Write-Host "skipping $($fy.k)"; continue }
    $L = ConvertFrom-Json ([IO.File]::ReadAllText($lf))

    # Pick the right map board: winter fisheries use MapParentIce, else MapParentNormal.
    $wantIce = $fy.k -like '*-winter'
    $panel = $null
    if ($L.panels) {
        $panel = $L.panels | Where-Object { $_.name -eq $(if ($wantIce) { 'MapParentIce' } else { 'MapParentNormal' }) } | Select-Object -First 1
        if (-not $panel -and $wantIce -and $L.panels.Count -gt 1) { $panel = $L.panels[1] }
        if (-not $panel) { $panel = $L.panels[0] }
    }
    if (-not $panel) { $panel = [pscustomobject]@{ mapImage = $L.mapImage; spots = @() } }
    # If the board's MapImage is not where expected, the scene's first one is used.
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

    # Where the similarity transform does not hold, the affine one is tried. It
    # only wins when it hits the spots clearly better; otherwise the simpler
    # map stays.
    $aff = FitAffine $pairs
    if ($aff) {
        $errA = 0.0
        foreach ($p in $pairs) {
            $r = ApplyFit $aff $p.x $p.z
            $errA += [Math]::Sqrt(($r[0] - $p.u) * ($r[0] - $p.u) + ($r[1] - $p.v) * ($r[1] - $p.v))
        }
        $errA /= $pairs.Count
        if ($errA -lt 0.05 -and ($null -eq $best -or $errA -lt $bestErr * 0.7)) {
            $best = $aff; $bestErr = $errA
        }
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

        # Spawners with a species list draw among several species; the fish count
        # spreads accordingly, and every species involved is counted.
        $share = $cnt / $names.Count
        foreach ($nm in $names) {
            if (-not $agg.ContainsKey($nm)) { $agg[$nm] = @{ points = 0.0; fish = 0.0; spots = @{} } }
            $agg[$nm].points += 1.0 / $names.Count
            $agg[$nm].fish += $share
            if ($ns -gt 0 -and $nd -lt 250) { $agg[$nm].spots[$ns] = 1 + $(if ($agg[$nm].spots.ContainsKey($ns)) { $agg[$nm].spots[$ns] } else { 0 }) }
            if (-not $speciesAgg.ContainsKey($nm)) { $speciesAgg[$nm] = @{} }
            $speciesAgg[$nm][$fy.k] = $true
        }
    }
    if ($bmp) { $bmp.Dispose() }

    $sl = @()
    foreach ($kv in ($agg.GetEnumerator() | Sort-Object { -$_.Value.fish })) {
        $topSpots = ($kv.Value.spots.GetEnumerator() | Sort-Object { -$_.Value } | Select-Object -First 6 | ForEach-Object { [int]$_.Key })
        $sl += [pscustomobject][ordered]@{ s = $kv.Key; points = [Math]::Round($kv.Value.points); fish = [Math]::Round($kv.Value.fish); spots = @($topSpots) }
    }

    # Extra species of the New Fish Species DLC. GameController lists them under
    # fishFromDLC; they have no fixed spawn places, at runtime the game hands
    # them the share of the others stored in fishSpawnersDLCAmount.
    # Of the candidates the one is taken whose references resolve without a
    # Fisch-Prefabs auflösen lassen.
    $dlcNames = @()
    $dlcAmount = 0
    foreach ($cand in $L.dlcCandidates) {
        $names = @()
        $allOk = $true
        foreach ($r in $cand.fish) {
            $nm = ResolveRef $r $L.externals
            if (-not $nm) { $allOk = $false; break }
            if ($names -notcontains $nm) { $names += $nm }
        }
        if ($allOk -and $names.Count -gt $dlcNames.Count) { $dlcNames = $names; $dlcAmount = $cand.amount }
    }

    $out[$fy.k] = [ordered]@{
        dlcSpecies = @($dlcNames)
        dlcAmount  = $dlcAmount
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
    Write-Host ("{0,-16} spots={1,-3} species={2,-3} points={3,-5} fitErr={4:F4} score={5:F1}" -f $fy.k, $spots.Count, $sl.Count, $spw.Count, $bestErr, $bestScore)
}

New-Item -ItemType Directory -Force "$sp\out" | Out-Null
Get-ChildItem "$sp\out\*.json" -ErrorAction SilentlyContinue | Remove-Item -Force
foreach ($k in $out.Keys) {
    $j = $out[$k] | ConvertTo-Json -Depth 8 -Compress
    [IO.File]::WriteAllText("$sp\out\$k.json", $j)
}
Write-Host "-> $($out.Keys.Count) fishery files in out\"
