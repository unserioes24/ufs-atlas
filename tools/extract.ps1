<#
    Vollständige Extraktions-Pipeline: aus der Spielinstallation entstehen
    gamedata.js, maps\*.jpg und fish\*.jpg.

    Aufruf (Windows PowerShell 5.1):
        .\tools\extract.ps1
        .\tools\extract.ps1 -Game "D:\Steam\steamapps\common\Ultimate Fishing\UltimateFishing_Data"

    Es werden ausschließlich lokal installierte Spieldateien gelesen, nichts verändert.
#>
param(
    [string]$Game = 'C:\Program Files (x86)\Steam\steamapps\common\Ultimate Fishing\UltimateFishing_Data',
    [string]$Work = (Join-Path $PSScriptRoot '_work'),
    [string]$Proj = (Split-Path $PSScriptRoot -Parent),
    [switch]$SkipImages
)

$ErrorActionPreference = 'Stop'
[Threading.Thread]::CurrentThread.CurrentCulture = [Globalization.CultureInfo]::InvariantCulture
if (-not (Test-Path $Game)) { throw "Spielverzeichnis nicht gefunden: $Game" }
New-Item -ItemType Directory -Force $Work | Out-Null
New-Item -ItemType Directory -Force (Join-Path $Work 'fisheries') | Out-Null

# UfsFishery.cs nutzt Typen aus UfsAssets.cs, beide müssen gemeinsam übersetzt werden.
Add-Type -Path @("$PSScriptRoot\UfsAssets.cs", "$PSScriptRoot\UfsFishery.cs")
Add-Type -Path "$PSScriptRoot\UfsTex.cs" -ReferencedAssemblies 'System.Drawing'

# Szenenindex laut BuildSettings, siehe globalgamemanagers:
#  4 PinasBay   5 PinasBayOcean  6 Arizona     7 Baikal    8 BettyLake  9 Louisiana
# 10 Bluebell  11 UvacRiver     14 MoraineLake 15 KaribaDam 16 Greenland 17 GreenlandSea
# 18 AmazonRiver 19 Japan       20 Thailand    22 Tongariro 23 DryTortugas
$LEVELS = 4, 5, 6, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 20, 22, 23

# Kartentexturen: Datei, Byte-Offset und Größe im jeweiligen .resS
$MAPS = @(
    @{ k = 'pinas';          f = 'sharedassets4.assets.resS';  o = 402716520; s = 1778688; w = 1024; h = 579;  fmt = 3 },
    @{ k = 'powell';         f = 'sharedassets6.assets.resS';  o = 93832604;  s = 1778688; w = 1024; h = 579;  fmt = 3 },
    @{ k = 'baikal';         f = 'sharedassets7.assets.resS';  o = 157068776; s = 1778688; w = 1024; h = 579;  fmt = 3 },
    @{ k = 'baikal-winter';  f = 'sharedassets7.assets.resS';  o = 46935336;  s = 1778688; w = 1024; h = 579;  fmt = 3 },
    @{ k = 'betty';          f = 'sharedassets8.assets.resS';  o = 176599292; s = 1778688; w = 1024; h = 579;  fmt = 3 },
    @{ k = 'betty-winter';   f = 'sharedassets8.assets.resS';  o = 194281532; s = 1778688; w = 1024; h = 579;  fmt = 3 },
    @{ k = 'atchafalaya';    f = 'sharedassets9.assets.resS';  o = 21833400;  s = 1778688; w = 1024; h = 579;  fmt = 3 },
    @{ k = 'zeno';           f = 'sharedassets10.assets.resS'; o = 14680224;  s = 2712576; w = 1024; h = 883;  fmt = 3 },
    @{ k = 'uvac';           f = 'sharedassets11.assets.resS'; o = 699064;    s = 1778688; w = 1024; h = 579;  fmt = 3 },
    @{ k = 'moraine';        f = 'sharedassets14.assets.resS'; o = 133377416; s = 1778688; w = 1024; h = 579;  fmt = 3 },
    @{ k = 'moraine-winter'; f = 'sharedassets14.assets.resS'; o = 42381544;  s = 1778688; w = 1024; h = 579;  fmt = 3 },
    @{ k = 'kariba';         f = 'sharedassets15.assets.resS'; o = 77431640;  s = 1778688; w = 1024; h = 579;  fmt = 3 },
    @{ k = 'greenland';      f = 'sharedassets16.assets.resS'; o = 248111072; s = 294912;  w = 1024; h = 576;  fmt = 10 },
    @{ k = 'amazon';         f = 'sharedassets18.assets.resS'; o = 138805872; s = 3470652; w = 1284; h = 901;  fmt = 3 },
    @{ k = 'japan';          f = 'sharedassets19.assets.resS'; o = 11272520;  s = 294912;  w = 1024; h = 576;  fmt = 10 },
    @{ k = 'thailand';       f = 'sharedassets20.assets.resS'; o = 162617392; s = 2365125; w = 875;  h = 901;  fmt = 3 },
    @{ k = 'taupo';          f = 'sharedassets22.assets.resS'; o = 279304336; s = 6188400; w = 1910; h = 1080; fmt = 3 },
    @{ k = 'florida';        f = 'sharedassets23.assets.resS'; o = 19224320;  s = 4323600; w = 1201; h = 1200; fmt = 3 }
)

# ------------------------------------------------- 1) Lokalisierungstabelle
Write-Host "`n[1/6] Lokalisierungstabelle (I2, 12 Sprachen)" -ForegroundColor Cyan
$res = Join-Path $Game 'resources.assets'
$fs = [IO.File]::OpenRead($res)
try {
    $start = 152000000L
    $len = [int][Math]::Min(6500000L, $fs.Length - $start)
    $buf = New-Object byte[] $len
    $fs.Position = $start
    $got = 0
    while ($got -lt $len) { $n = $fs.Read($buf, $got, $len - $got); if ($n -le 0) { break }; $got += $n }
} finally { $fs.Close() }
[IO.File]::WriteAllBytes("$Work\terms.bin", $buf)
& "$PSScriptRoot\terms.ps1" -In "$Work\terms.bin" -Out "$Work\terms.tsv"

# ------------------------------------------------------------ 2) Reviere
Write-Host "`n[2/6] Reviere (Spots, Spawner, Reiseziele)" -ForegroundColor Cyan
foreach ($i in $LEVELS) {
    $lv = Join-Path $Game "level$i"
    if (-not (Test-Path $lv)) { Write-Host "  level$i fehlt"; continue }
    [IO.File]::WriteAllText("$Work\fisheries\level$i.json", [Ufs.Fishery]::Run($lv))
    Write-Host "  level$i"
}

# ---------------------------------------------------- 3) Fisch-Prefabs
Write-Host "`n[3/6] Fisch-Prefabs (Gewicht, Länge, Beißzeiten)" -ForegroundColor Cyan
[IO.File]::WriteAllText("$Work\fishprefabs.json",
    [Ufs.Extractor]::Run((Join-Path $Game 'sharedassets2.assets'), '^Fish_[A-Z]', $false, 1800))

$idx = @{}
foreach ($file in (Get-ChildItem "$Game\sharedassets*.assets") + @(Get-Item "$Game\resources.assets")) {
    try {
        $o = ConvertFrom-Json ([Ufs.Extractor]::Run($file.FullName, '^Fish_[A-Z]', $false, 0))
        if (-not $o.objects -or $o.objects.Count -eq 0) { continue }
        $m = @{}
        foreach ($ob in $o.objects) { foreach ($c in $ob.comps) { if ($c.cls -eq 114) { $m[[string]$c.id] = $ob.name } } }
        $idx[$file.Name] = $m
        Write-Host ("  {0}: {1} Prefabs" -f $file.Name, $o.objects.Count)
    } catch { }
}
$idx | ConvertTo-Json -Depth 4 -Compress | Set-Content "$Work\fishindex.json" -Encoding UTF8

# ------------------------------------------------------- 4) Kartenbilder
Write-Host "`n[4/6] Kartenbilder" -ForegroundColor Cyan
New-Item -ItemType Directory -Force "$Proj\maps" | Out-Null
foreach ($m in $MAPS) {
    $src = Join-Path $Game $m.f
    if (-not (Test-Path $src)) { Write-Host "  $($m.k): $($m.f) fehlt"; continue }
    $r = [Ufs.TexExport]::Save($src, $m.o, $m.s, $m.w, $m.h, $m.fmt, "$Proj\maps\$($m.k).jpg")
    Write-Host ("  {0,-16} {1}" -f $m.k, $r)
}

# ------------------------------------------- 5) Zusammenführen zu gamedata
Write-Host "`n[5/6] Datenaufbereitung" -ForegroundColor Cyan
& "$PSScriptRoot\baits.ps1"      -Work $Work -Game $Game
& "$PSScriptRoot\bitecurves.ps1" -Work $Work
& "$PSScriptRoot\hooks.ps1"      -Work $Work -Game $Game | Out-Null
& "$PSScriptRoot\build.ps1"  -Work $Work -Proj $Proj
& "$PSScriptRoot\build2.ps1" -Work $Work -Proj $Proj

$jsonPath = Join-Path $Proj 'gamedata.json'
if (Test-Path $jsonPath) {
    $j = [IO.File]::ReadAllText($jsonPath)
    [IO.File]::WriteAllText((Join-Path $Proj 'gamedata.js'), "window.UFS_GAME = $j;", (New-Object Text.UTF8Encoding($false)))
    Remove-Item $jsonPath -Force
    Write-Host "  gamedata.js geschrieben"
}

# -------------------------------------------------------- 6) Fischbilder
if ($SkipImages) { Write-Host "`n[6/6] Fischbilder übersprungen" -ForegroundColor Cyan }
else {
    Write-Host "`n[6/6] Fischbilder" -ForegroundColor Cyan
    & "$PSScriptRoot\fishimg.ps1" -Work $Work -Proj $Proj -Game $Game
}

Write-Host "`nFertig." -ForegroundColor Green
