param(
    [string]$Work = (Join-Path $PSScriptRoot '_work'),
    [string]$Proj = (Split-Path $PSScriptRoot -Parent)
)
[Threading.Thread]::CurrentThread.CurrentCulture = [Globalization.CultureInfo]::InvariantCulture
$sp = $Work
$proj = $Proj

# ------------------------------------------------------------ Lokalisierung
$terms = @{}
foreach ($line in [IO.File]::ReadAllLines("$sp\terms.tsv")) {
    $c = $line -split "`t"
    if ($c.Count -lt 4) { continue }
    $terms[$c[0]] = @{ en = $c[1]; de = $c[3] }
}
$locKeys = @{}
foreach ($t in $terms.Keys) { if ($t -match '^FISH/(.+)_NAME$') { $locKeys[$Matches[1]] = $true } }
Write-Host "Lokalisierte Fischarten: $($locKeys.Count)"

$ALIAS = @{
    'Cods'='ATLANTIC_COD'; 'Sharks'='GREENLAND_SHARK'; 'Halibuts'='ATLANTIC_HALIBUT'
    'Salmon'='ATLANTIC_SALMON'; 'Wolffish'='ATLANTIC_WOLFFISH'; 'Redfish'='DEEPWATER_REDFISH'
    'Sculpin'='FOURHORNED_SCULPIN'; 'Barb'='AFRICAN_BARB'; 'Bream'='ZAMBEZI_BREAM'
    'Killifish'='KAFUE_KILLIFISH'; 'Tilapia'='KARIBA_TILAPIA'; 'Crappie'='BLACK_CRAPPIE'
    'NorthernPike'='PIKE'; 'Coregonus'='LAKE_WHITEFISH'; 'Whitefish'='LAKE_WHITEFISH'
    'AligatorGal'='ALIGATOR_GAR'; 'GiantTrevally'='GIANT_TRAVELLY'; 'GiantTravelly'='GIANT_TRAVELLY'
    'GreatBaracuda'='BARRACUDA'; 'GreatBarracuda'='BARRACUDA'; 'Barracuda'='BARRACUDA'
    'GraySnapper'='GREY_SNAPER'; 'GreySnaper'='GREY_SNAPER'; 'GraySnaper'='GREY_SNAPER'
    'MahiMahi'='DORADO'; 'DoradoNewModel'='DORADO'; 'RedLionfish'='COMMON_LIONFISH'
    'TroutRainCut'='RAINBOW_TROUT'; 'RedBreastedTilapia'='REDBREASTED_TILAPIA'
    'CatfishBullhead'='BROWN_BULLHEAD_CATFISH'; 'CatfishBullheadBrown'='BROWN_BULLHEAD_CATFISH'
    'StripedBass'='STRIPPED_BASS'
    'CommonLionfishFlorida'='COMMON_LIONFISH'; 'GreatBarracudaFlorida'='BARRACUDA'
    'GraySnaperFlorida'='GREY_SNAPER'
    'SalmonSoc'='SOCKEYE_SALMON'; 'SharkBlacktip'='BLACKTIP_REEF_SHARK'
    'MulletFlatheadGreyD'='FLATHEAD_GREY_MULLET'; 'MulletFlatheadGrey'='FLATHEAD_GREY_MULLET'
    'CoregonusLavaretus'='LAKE_WHITEFISH'; 'TroutBrown'='BROWN_TROUT'; 'TroutBrook'='BROOK_TROUT'
    'SalmonChinook'='CHINOOK_SALMON'; 'KokopuGiant'='GIANT_KOKOPU'
    'TunaYellowfin'='YELLOWFIN_TUNA'
    'SharkSpinner'='SPINNER_SHARK_D'; 'SharkTiger'='TIGER_SHARK_D'; 'DrumRed'='RED_DRUM_D'; 'DrumBlack'='DRUM_BLACK_D'
    'SeabassBlack'='BLACK_SEABASS_DM'; 'SeabassBl'='BLACK_SEABASS_DM'
    'AtlanticTarponFlorida'='ATLANTIC_TARPON_D'; 'TarponAtl'='ATLANTIC_TARPON_D'
    'TunnyLittle'='LITTLE_TUNNY_C'; 'TunaBlackfin'='BLACKFIN_TUNA_C'
    'GraySnapperFlorida'='GREY_SNAPER'; 'GreatBaracudaFlorida'='BARRACUDA'
    # Florida führt einzelne Arten unter eigenen Prefabnamen, teils mit
    # Ortszusatz oder Tiefenvariante.
    'DrumBlack_D_under'='DRUM_BLACK_D'; 'AtlanticTarponDryTortugas'='ATLANTIC_TARPON_D'
    'BlueMarlin_DryTortugas'='BLUE_MARLIN'
    # Taupo nutzt ein gemeinsames Modell für Regenbogen- und Cutthroat-Forelle.
    'TroutRain+Cut_D'='RAINBOW_TROUT'; 'TroutRain+Cut'='RAINBOW_TROUT'
}
$DROP = @('NearCoast','Test','Rig','Fish','SharkTest')

function Words($n) {
    $parts = @()
    foreach ($seg in ($n -split '_')) {
        if (-not $seg) { continue }
        $parts += @([Regex]::Split($seg, '(?<=[a-z0-9])(?=[A-Z])') | Where-Object { $_ })
    }
    return $parts
}

$resolveCache = @{}
function ToKey($raw) {
    if ($resolveCache.ContainsKey($raw)) { return $resolveCache[$raw] }
    $n = ($raw -replace '\(Clone\)', '' -replace '\s*\(\d+\)\s*$', '').Trim()
    $n = $n -replace '\s+', ''
    $n = $n -replace '_\d+$', ''
    $n = $n -replace '_[vV]\d+$', ''      # Versionszusatz, z. B. VunduCatfish_v1
    $base = $n
    if ($DROP -contains ($n -replace '_.*$', '')) { $resolveCache[$raw] = $null; return $null }

    # optionaler Varianten-Suffix (Florida-DLC nutzt z. B. TIGER_SHARK_D)
    $suffix = ''
    if ($n -match '^(.*)_([A-Za-z]{1,2})$') { $base = $Matches[1]; $suffix = $Matches[2].ToUpper() }

    $res = $null
    foreach ($cand in @($n, $base)) {
        $w = Words $cand
        if ($w.Count -eq 0) { continue }
        $perms = @()
        $perms += , $w
        if ($w.Count -ge 2) {
            $rev = @($w); [Array]::Reverse($rev); $perms += , $rev
            $perms += , (@($w[-1]) + $w[0..($w.Count - 2)])
            $perms += , ($w[1..($w.Count - 1)] + @($w[0]))
        }
        foreach ($p in $perms) {
            $c1 = ($p -join '_').ToUpper()
            if ($locKeys.ContainsKey($c1)) { $res = $c1; break }
            if ($suffix -and $cand -eq $base) {
                $c2 = "${c1}_$suffix"
                if ($locKeys.ContainsKey($c2)) { $res = $c2; break }
            }
        }
        if ($res) { break }
    }
    if (-not $res -and $ALIAS.ContainsKey($base)) { $res = $ALIAS[$base] }
    if (-not $res -and $ALIAS.ContainsKey($n)) { $res = $ALIAS[$n] }
    if (-not $res) {
        $w = (Words $base | ForEach-Object { $_.ToUpper() })
        $hit = @()
        foreach ($lk in $locKeys.Keys) {
            $parts = $lk -split '_'
            $all = $true
            foreach ($x in $w) { if ($parts -notcontains $x) { $all = $false; break } }
            if ($all -and $w.Count -gt 0) { $hit += $lk }
        }
        if ($hit.Count -eq 1) { $res = $hit[0] }
    }
    if ($res -and -not $locKeys.ContainsKey($res)) { $res = $null }
    $resolveCache[$raw] = $res
    return $res
}

# ------------------------------------------------------------- 1) Fischarten
$fp = ConvertFrom-Json ([IO.File]::ReadAllText("$sp\fishprefabs.json"))
function ReadCfg($ob) {
    $c = ($ob.comps | Where-Object { $_.cls -eq 114 -and $_.size -gt 1500 -and $_.size -lt 1900 })
    if (-not $c) { return $null }
    $h = $c[0].hex
    $b = New-Object byte[] ($h.Length / 2)
    for ($i = 0; $i -lt $b.Length; $i++) { $b[$i] = [Convert]::ToByte($h.Substring($i * 2, 2), 16) }
    return $b
}
function FindStats($b) {
    foreach ($p in 592, 600, 584, 608, 576, 616, 624, 560, 568, 632, 640, 648) {
        if ($p + 20 -gt $b.Length) { continue }
        $wmin = [BitConverter]::ToSingle($b, $p); $wmax = [BitConverter]::ToSingle($b, $p + 4)
        $lmin = [BitConverter]::ToSingle($b, $p + 12); $lmax = [BitConverter]::ToSingle($b, $p + 16)
        if ([double]::IsNaN($wmin) -or [double]::IsNaN($lmin)) { continue }
        if ($wmin -gt 0 -and $wmax -gt $wmin -and $wmax -le 2000 -and
            $lmin -gt 0.01 -and $lmax -gt $lmin -and $lmax -le 9 -and $lmin -lt 3) {
            return @{ wMin = $wmin; wMax = $wmax; lMin = $lmin; lMax = $lmax }
        }
    }
    return $null
}
function FindActivity($b) {
    for ($p = 620; $p -lt $b.Length - 40; $p += 4) {
        $n = [BitConverter]::ToInt32($b, $p)
        if ($n -lt 2 -or $n -gt 12) { continue }
        if ($p + 4 + $n * 16 -gt $b.Length) { continue }
        $ts = @(); $vs = @(); $ok = $true
        for ($k = 0; $k -lt $n; $k++) {
            $t = [BitConverter]::ToSingle($b, $p + 4 + $k * 16)
            $v = [BitConverter]::ToSingle($b, $p + 8 + $k * 16)
            if ([double]::IsNaN($t) -or $t -lt 0 -or $t -gt 24 -or $v -lt 0 -or $v -gt 1.0001) { $ok = $false; break }
            if ($k -gt 0 -and $t -le $ts[-1]) { $ok = $false; break }
            $ts += $t; $vs += $v
        }
        if ($ok -and $ts[0] -eq 0 -and $ts[-1] -eq 24) {
            $out = @()
            for ($k = 0; $k -lt $n; $k++) { $out += , @([Math]::Round($ts[$k], 1), [Math]::Round($vs[$k], 2)) }
            return $out
        }
    }
    return $null
}

$species = @{}
$unres = @{}
foreach ($ob in $fp.objects) {
    $raw = $ob.name.Substring(5)
    $key = ToKey $raw
    if (-not $key) { if (-not ($DROP -contains ($raw -replace '_.*$', ''))) { $unres[$raw] = $true }; continue }
    $b = ReadCfg $ob
    if (-not $b) { continue }
    $st = FindStats $b
    $ac = FindActivity $b
    if ($species.ContainsKey($key)) {
        if (-not $species[$key].Contains('wMax') -and $st) {
            $species[$key].wMin = [Math]::Round($st.wMin, 3); $species[$key].wMax = [Math]::Round($st.wMax, 2)
            $species[$key].lMin = [Math]::Round($st.lMin * 100); $species[$key].lMax = [Math]::Round($st.lMax * 100)
        }
        continue
    }
    $e = [ordered]@{}
    if ($terms.ContainsKey("FISH/${key}_NAME")) { $e.en = $terms["FISH/${key}_NAME"].en; $e.de = $terms["FISH/${key}_NAME"].de }
    if ($terms.ContainsKey("FISH/${key}_DESC")) { $e.info = $terms["FISH/${key}_DESC"].de }
    if ($st) {
        $e.wMin = [Math]::Round($st.wMin, 3); $e.wMax = [Math]::Round($st.wMax, 2)
        $e.lMin = [Math]::Round($st.lMin * 100); $e.lMax = [Math]::Round($st.lMax * 100)
    }
    if ($ac) { $e.act = $ac }
    $species[$key] = $e
}
# Zuordnung Prefabname -> Artenschlüssel, wird vom Mesh-Export gebraucht
$prefabKeys = [ordered]@{}
foreach ($ob in $fp.objects) {
    $raw = $ob.name.Substring(5)
    $k = ToKey $raw
    if ($k) { $prefabKeys[$ob.name] = $k }
}
$prefabKeys | ConvertTo-Json -Compress | Set-Content (Join-Path $sp 'prefabkeys.json') -Encoding UTF8

Write-Host "Arten mit Spieldaten: $($species.Count)   nicht auflösbar: $($unres.Keys.Count)"
if ($unres.Keys.Count) { Write-Host ("  " + (($unres.Keys | Sort-Object) -join ', ')) }

# species that exist in localisation but have no prefab stats
foreach ($lk in $locKeys.Keys) {
    if ($species.ContainsKey($lk)) { continue }
    $e = [ordered]@{ en = $terms["FISH/${lk}_NAME"].en; de = $terms["FISH/${lk}_NAME"].de }
    if ($terms.ContainsKey("FISH/${lk}_DESC")) { $e.info = $terms["FISH/${lk}_DESC"].de }
    $species[$lk] = $e
}

# ---------------------------------------------------------------- 2) Reviere
$ORDER = @('betty','betty-winter','powell','zeno','baikal','baikal-winter','atchafalaya','moraine','moraine-winter',
           'uvac','pinas','pinas-ocean','greenland','greenland-sea','kariba','amazon','japan','thailand','taupo','florida')

# Präfix, unter dem der Spielstand die Revierstatistik ablegt
$SAVEKEY = @{
    'betty' = 'LEVELS/BETTY_NAME'; 'betty-winter' = 'LEVELS/BETTY_NAME_WINTER'
    'powell' = 'LEVELS/ARIZONA_NAME'; 'zeno' = 'LEVELS/BLUEBELL_NAME'
    'baikal' = 'LEVELS/BAIKAL_NAME'; 'baikal-winter' = 'LEVELS/BAIKAL_NAME_WINTER'
    'atchafalaya' = 'LEVELS/LOUISIANA_NAME'; 'moraine' = 'LEVELS/MORAINE_NAME'
    'moraine-winter' = 'LEVELS/MORAINE_NAME_WINTER'; 'uvac' = 'LEVELS/UVAC_RIVER_NAME'
    'pinas' = 'LEVELS/PINAS_BAY_NAME'; 'pinas-ocean' = 'LEVELS/PINAS_BAY_OCEAN_NAME'
    'greenland' = 'LEVELS/GREENLAND_NAME'; 'greenland-sea' = 'LEVELS/GREENLAND_SEA_NAME'
    'kariba' = 'LEVELS/KARIBA_DAM_NAME'; 'amazon' = 'LEVELS/AMAZON_RIVER_NAME'
    'japan' = 'LEVELS/JAPAN_NAME'; 'thailand' = 'LEVELS/THAILAND_NAME'
    'taupo' = 'LEVELS/TAUPO_LAKE_NAME'; 'florida' = 'LEVELS/FLORIDA_NAME'
}
$fisheries = [ordered]@{}
foreach ($k in $ORDER) {
    $path = "$sp\out\$k.json"
    if (-not (Test-Path $path)) { continue }
    $f = ConvertFrom-Json ([IO.File]::ReadAllText($path))

    # spawner -> resolved species keys
    $swKeys = @()
    foreach ($sw in $f.spawners) {
        $ks = @()
        if ($sw.ss) { foreach ($x in $sw.ss) { $kk = ToKey $x; if ($kk -and $ks -notcontains $kk) { $ks += $kk } } }
        if ($ks.Count -eq 0) { $kk = ToKey $sw.s; if ($kk) { $ks = @($kk) } }
        $swKeys += , $ks
    }

    $spots = @()
    for ($si = 0; $si -lt $f.spots.Count; $si++) {
        $s = $f.spots[$si]
        $near = @{}
        for ($i = 0; $i -lt $f.spawners.Count; $i++) {
            $sw = $f.spawners[$i]
            if ($sw.sp -ne $s.n) { continue }
            $eff = [Math]::Max(0, $sw.d - 45)
            if ($eff -gt 130) { continue }
            $ks = $swKeys[$i]
            if ($ks.Count -eq 0) { continue }
            $share = [double]$sw.n / $ks.Count
            foreach ($kk in $ks) {
                if (-not $near.ContainsKey($kk)) { $near[$kk] = @{ fish = 0.0; best = 99999 } }
                $near[$kk].fish += $share
                if ($eff -lt $near[$kk].best) { $near[$kk].best = $eff }
            }
        }
        $list = @()
        foreach ($kv in ($near.GetEnumerator() | Sort-Object { -$_.Value.fish })) {
            $list += [pscustomobject][ordered]@{ s = $kv.Key; f = [Math]::Round($kv.Value.fish); d = [int]$kv.Value.best }
        }
        $e = [ordered]@{ n = $s.n }
        if ($null -ne $s.u) { $e.u = [Math]::Round($s.u, 4); $e.v = [Math]::Round($s.v, 4) }
        if ($null -ne $s.wx) { $e.wx = $s.wx; $e.wz = $s.wz }
        $e.fish = $list
        $spots += [pscustomobject]$e
    }

    $tot = @{}
    for ($i = 0; $i -lt $f.spawners.Count; $i++) {
        $sw = $f.spawners[$i]; $ks = $swKeys[$i]
        if ($ks.Count -eq 0) { continue }
        $share = [double]$sw.n / $ks.Count
        foreach ($kk in $ks) {
            if (-not $tot.ContainsKey($kk)) { $tot[$kk] = @{ points = 0.0; fish = 0.0; spots = @{} } }
            $tot[$kk].points += 1.0 / $ks.Count
            $tot[$kk].fish += $share
            if ($sw.sp -and ([Math]::Max(0, $sw.d - 45) -le 130)) { $tot[$kk].spots[[int]$sw.sp] = $true }
        }
    }
    $sl = @()
    foreach ($kv in ($tot.GetEnumerator() | Sort-Object { -$_.Value.fish })) {
        $sl += [pscustomobject][ordered]@{
            s = $kv.Key; points = [Math]::Round($kv.Value.points); fish = [Math]::Round($kv.Value.fish)
            spots = @($kv.Value.spots.Keys | Sort-Object)
        }
    }

    # DLC-Zusatzarten anhängen, sofern sie nicht ohnehin Spawner besitzen
    $have = @{}
    foreach ($x in $sl) { $have[$x.s] = $true }
    foreach ($dn in $f.dlcSpecies) {
        $dk = ToKey $dn
        if (-not $dk -or $have[$dk]) { continue }
        $have[$dk] = $true
        $sl += [pscustomobject][ordered]@{ s = $dk; points = 0; fish = 0; spots = @(); dlc = $true }
    }

    $dots = @()
    if ($f.fitOk) {
        $step = [Math]::Max(1, [Math]::Ceiling($f.spawners.Count / 900))
        for ($i = 0; $i -lt $f.spawners.Count; $i += $step) {
            $sw = $f.spawners[$i]
            if ($null -eq $sw.u) { continue }
            if ($sw.u -lt -0.05 -or $sw.u -gt 1.05 -or $sw.v -lt -0.05 -or $sw.v -gt 1.05) { continue }
            $ks = $swKeys[$i]
            if ($ks.Count -eq 0) { continue }
            $dots += , @($ks[0], [Math]::Round($sw.u, 3), [Math]::Round($sw.v, 3))
        }
    }

    $fisheries[$k] = [ordered]@{
        level = $f.level; map = $f.map; mapW = $f.mapW; mapH = $f.mapH
        save = $SAVEKEY[$k]
        fitOk = $f.fitOk; spots = $spots; species = $sl; dots = $dots
    }
    Write-Host ("{0,-16} spots={1,-3} arten={2,-3} dots={3}" -f $k, $spots.Count, $sl.Count, $dots.Count)
}

# --------------------------------------------------------------- 3) Glossar
$gl = [ordered]@{ bait = [ordered]@{}; lure = [ordered]@{}; method = [ordered]@{}; categories = @() }
foreach ($t in $terms.GetEnumerator()) {
    if ($t.Key -like 'EQUIPMENT/NATURAL_BAITS/*' -or $t.Key -like 'EQUIPMENT/BOILIE/*') { $gl.bait[$t.Value.en] = $t.Value.de }
    elseif ($t.Key -like 'GUI/METHODS_*') { $gl.method[$t.Value.en] = $t.Value.de }
    elseif ($t.Key -match '^EQUIPMENT/(SPOON|SPINNER|WOBBLER|CRANKBAIT|SOFT_BAIT|LURES|FLIES|FLOAT|HOOK|FEEDER|LINE|REEL|ROD|BOILIE|ARTIFICIAL_BAIT|FISHING_NET|ROD_POD|BITE_INDICATOR)S?$') { $gl.lure[$t.Value.en] = $t.Value.de }
}

# Köderseite: Kategorien mit den Originalbezeichnungen aus dem Spiel
function CatItems($pattern) {
    $list = @()
    foreach ($t in ($terms.GetEnumerator() | Where-Object { $_.Key -match $pattern } | Sort-Object { $_.Value.de })) {
        $list += [pscustomobject]@{ en = $t.Value.en; de = $t.Value.de; key = $t.Key }
    }
    return @($list)
}
$gl.categories = @(
    [pscustomobject]@{ key = 'natural'; title = 'Naturköder'; note = 'Werden am Haken angeboten, mehrere Stücke vergrößern den Anziehungsradius.'; items = CatItems '^EQUIPMENT/NATURAL_BAITS/' },
    [pscustomobject]@{ key = 'boilie';  title = 'Boilies';    note = 'Für Karpfen und Großfisch, an der Haarmontage.'; items = CatItems '^EQUIPMENT/BOILIE/' },
    [pscustomobject]@{ key = 'lure';    title = 'Kunstköder-Arten'; note = 'Werden aktiv geführt; die Führungsart entscheidet mit über den Biss.'; items = CatItems '^EQUIPMENT/(SPOON|SPINNER|WOBBLER|CRANKBAIT|SOFT_BAIT|LURES|FLIES|ARTIFICIAL_BAIT)S?$' },
    [pscustomobject]@{ key = 'method';  title = 'Angelmethoden'; note = 'Die fünf Spinnfisch-Führungen haben je drei Geschwindigkeitsstufen.'; items = CatItems '^GUI/METHODS_' },
    [pscustomobject]@{ key = 'gear';    title = 'Montage & Ausrüstung'; note = ''; items = CatItems '^EQUIPMENT/(HOOK|FLOAT|FEEDER|LINE|REEL|ROD|ROD_POD|BITE_INDICATOR|FLOAT_WEIGHT|FISHING_NET)S?$' }
)

$data = [ordered]@{
    generated = (Get-Date -Format 'yyyy-MM-dd')
    source    = 'Ultimate Fishing Simulator, Spieldateien (Unity 2017.4.29f1)'
    species   = $species
    fisheries = $fisheries
    glossary  = $gl
}
$json = $data | ConvertTo-Json -Depth 12 -Compress
[IO.File]::WriteAllText("$proj\gamedata.json", $json)

# ---------------------------------------------- 4) Stammdaten für den Server
# Der Symfony-Dienst wertet hochgeladene Spielstände selbst aus und braucht
# dafür Artenliste, Reviere mit ihren Arten und die Spielstand-Schlüssel.
$srvSpecies = [ordered]@{}
foreach ($k in $species.Keys) {
    $s = $species[$k]
    $e = [ordered]@{}
    if ($s.Contains('de')) { $e.de = $s.de }
    if ($s.Contains('en')) { $e.en = $s.en }
    if ($s.Contains('wMax')) { $e.wMax = $s.wMax }
    $srvSpecies[$k] = $e
}
$srvFishery = [ordered]@{}
$srvSave = [ordered]@{}
foreach ($k in $fisheries.Keys) {
    $srvFishery[$k] = @($fisheries[$k].species | ForEach-Object { $_.s })
    if ($SAVEKEY[$k]) { $srvSave[$k] = $SAVEKEY[$k] }
}
$srv = [ordered]@{
    generated       = $data.generated
    species         = $srvSpecies
    fisherySpecies  = $srvFishery
    fisherySaveKeys = $srvSave
}
New-Item -ItemType Directory -Force (Join-Path $proj 'server\data') | Out-Null
[IO.File]::WriteAllText((Join-Path $proj 'server\data\gamedata-server.json'),
    ($srv | ConvertTo-Json -Depth 8 -Compress))
Write-Host "-> server/data/gamedata-server.json"
Write-Host "-> gamedata.json  $([Math]::Round($json.Length/1KB)) KB   Arten gesamt: $($species.Count)"
