param(
    [string]$Work = (Join-Path $PSScriptRoot '_work'),
    [string]$Proj = (Split-Path $PSScriptRoot -Parent),
    [string]$Game = 'C:\Program Files (x86)\Steam\steamapps\common\Ultimate Fishing\UltimateFishing_Data'
)
[Threading.Thread]::CurrentThread.CurrentCulture = [Globalization.CultureInfo]::InvariantCulture
$sp = $Work
$proj = $Proj
$g = $Game
Add-Type -Path "$PSScriptRoot\UfsAssets.cs" -ErrorAction Stop
Add-Type -Path "$PSScriptRoot\UfsTex.cs" -ReferencedAssemblies 'System.Drawing' -ErrorAction Stop
New-Item -ItemType Directory -Force "$proj\fish" | Out-Null

# --- alle Texturen aus den relevanten Asset-Dateien sammeln
$tex = @()
foreach ($fn in 'sharedassets2.assets', 'sharedassets22.assets', 'sharedassets23.assets', 'sharedassets18.assets', 'sharedassets19.assets', 'sharedassets20.assets') {
    $o = ConvertFrom-Json ([Ufs.Extractor]::Run("$g\$fn", '^__x__$', $true, 0))
    foreach ($t in $o.textures) {
        if ($t.ss -le 0) { continue }
        if ($t.w -lt 256 -or $t.h -lt 256) { continue }
        $tex += [pscustomobject]@{ file = "$fn.resS"; name = $t.name; w = $t.w; h = $t.h; fmt = $t.fmt; so = $t.so; ss = $t.ss }
    }
    Write-Host "$fn -> $($tex.Count)"
}

$BAD  = '(?i)(normal|_n$|_n[ _0-9]|nrm|spec|smooth|metallic|mask|_ao|occlusion|rough|disp|height|emis|_ms$|fixedcolor)'
$GOOD = '(?i)(diffuse|albedo|_d$|_d[ _0-9]|_a$|_a[ _0-9]|color|dif)'

$STOP = @('COMMON','GREAT','GIANT','ATLANTIC','BLACK','WHITE','BLUE','RED','GREEN','GREY','GRAY','PINK','SILVER','GOLDEN','LARGE','SMALL','NORTHERN','DEEPWATER','THREESPOT','RAINBOW','STRIPED','SPOTTED','YELLOW','BROWN')

function TN($s) { return ($s -replace '[^A-Za-z0-9]', '').ToUpper() }

$G2 = ConvertFrom-Json ([IO.File]::ReadAllText("$proj\gamedata.js").Substring('window.UFS_GAME = '.Length).TrimEnd(';'))
$keys = @($G2.species.PSObject.Properties.Name)
Write-Host "Arten: $($keys.Count)   Texturen: $($tex.Count)"

$map = [ordered]@{}
$miss = @()
foreach ($k in $keys) {
    $words = @($k -split '_' | Where-Object { $_.Length -gt 2 })
    $core  = @($words | Where-Object { $STOP -notcontains $_ })
    if ($core.Count -eq 0) { $core = $words }
    $best = $null; $bestScore = 0
    foreach ($t in $tex) {
        if ($t.name -match $BAD) { continue }
        $tn = TN $t.name
        $score = 0
        foreach ($w in $core) { if ($tn -like "*$w*") { $score += 20 } }
        if ($score -eq 0) { continue }
        foreach ($w in $words) { if ($tn -like "*$w*") { $score += 4 } }
        if ($t.name -match $GOOD) { $score += 12 }
        $joined = ($words -join '')
        if ($tn -like "$joined*") { $score += 25 }
        $rev = @($words); [Array]::Reverse($rev)
        if ($tn -like "$($rev -join '')*") { $score += 25 }
        $score -= [Math]::Min(10, [int]($tn.Length / 6))
        if ($score -gt $bestScore) { $bestScore = $score; $best = $t }
    }
    if ($best -and $bestScore -ge 55) {
        $out = "$proj\fish\$($k.ToLower()).jpg"
        $r = [Ufs.TexExport]::SaveFishCrop("$g\$($best.file)", $best.so, $best.ss, $best.w, $best.h, $best.fmt, $out, 560)
        if ($r -like 'ok*') { $map[$k] = "fish/$($k.ToLower()).jpg" }
        Write-Host ("{0,-26} <- {1,-34} score={2,-4} {3}" -f $k, $best.name, $bestScore, $r)
    } else { $miss += $k }
}
Write-Host "`nBilder: $($map.Count)   ohne Bild: $($miss.Count)"
Write-Host ("  " + ($miss -join ', '))
$map | ConvertTo-Json -Compress | Set-Content "$sp\fishimg.json" -Encoding UTF8
