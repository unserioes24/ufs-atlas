param(
    [string]$Work = (Join-Path $PSScriptRoot '_work'),
    [string]$Proj = (Split-Path $PSScriptRoot -Parent)
)
[Threading.Thread]::CurrentThread.CurrentCulture = [Globalization.CultureInfo]::InvariantCulture
$sp = $Work
$proj = $Proj

# ------------------------------------------------------------- Localisation
$terms = @{}
foreach ($line in [IO.File]::ReadAllLines("$sp\terms.tsv")) {
    $c = $line -split "`t"
    if ($c.Count -lt 4) { continue }
    $terms[$c[0]] = @{ en = $c[1]; de = $c[3] }
}
$locKeys = @{}
foreach ($t in $terms.Keys) { if ($t -match '^FISH/(.+)_NAME$') { $locKeys[$Matches[1]] = $true } }
Write-Host "Localised species: $($locKeys.Count)"

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
    # Florida keeps some species under their own prefab names, partly with a
    # place suffix or a depth variant.
    'DrumBlack_D_under'='DRUM_BLACK_D'; 'AtlanticTarponDryTortugas'='ATLANTIC_TARPON_D'
    'BlueMarlin_DryTortugas'='BLUE_MARLIN'
    # Taupo shares one model for rainbow and cutthroat trout.
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
    $n = $n -replace '_[vV]\d+$', ''      # version suffix, e.g. VunduCatfish_v1
    $base = $n
    if ($DROP -contains ($n -replace '_.*$', '')) { $resolveCache[$raw] = $null; return $null }

    # optional variant suffix (the Florida DLC uses e.g. TIGER_SHARK_D)
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

# ---------------------------------------------------------------- 1) Species
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
# Prefab name -> species key, used when resolving references
$prefabKeys = [ordered]@{}
foreach ($ob in $fp.objects) {
    $raw = $ob.name.Substring(5)
    $k = ToKey $raw
    if ($k) { $prefabKeys[$ob.name] = $k }
}
$prefabKeys | ConvertTo-Json -Compress | Set-Content (Join-Path $sp 'prefabkeys.json') -Encoding UTF8

Write-Host "Species with game data: $($species.Count)   unresolved: $($unres.Keys.Count)"
if ($unres.Keys.Count) { Write-Host ("  " + (($unres.Keys | Sort-Object) -join ', ')) }

# species that exist in localisation but have no prefab stats
foreach ($lk in $locKeys.Keys) {
    if ($species.ContainsKey($lk)) { continue }
    $e = [ordered]@{ en = $terms["FISH/${lk}_NAME"].en; de = $terms["FISH/${lk}_NAME"].de }
    if ($terms.ContainsKey("FISH/${lk}_DESC")) { $e.info = $terms["FISH/${lk}_DESC"].de }
    $species[$lk] = $e
}

# -------------------------------------------------------------- 2) Fisheries
$ORDER = @('betty','betty-winter','powell','zeno','baikal','baikal-winter','atchafalaya','moraine','moraine-winter',
           'uvac','pinas','pinas-ocean','greenland','greenland-sea','kariba','amazon','japan','thailand','taupo','florida')

# Prefix the save file stores its fishery statistics under
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

    # Append DLC species unless they already have spawners of their own
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
    Write-Host ("{0,-16} spots={1,-3} species={2,-3} dots={3}" -f $k, $spots.Count, $sl.Count, $dots.Count)
}

# -------------------------------------------------------------- 3) Glossary
$gl = [ordered]@{ bait = [ordered]@{}; lure = [ordered]@{}; method = [ordered]@{}; categories = @() }
foreach ($t in $terms.GetEnumerator()) {
    if ($t.Key -like 'EQUIPMENT/NATURAL_BAITS/*' -or $t.Key -like 'EQUIPMENT/BOILIE/*') { $gl.bait[$t.Value.en] = $t.Value.de }
    elseif ($t.Key -like 'GUI/METHODS_*') { $gl.method[$t.Value.en] = $t.Value.de }
    elseif ($t.Key -match '^EQUIPMENT/(SPOON|SPINNER|WOBBLER|CRANKBAIT|SOFT_BAIT|LURES|FLIES|FLOAT|HOOK|FEEDER|LINE|REEL|ROD|BOILIE|ARTIFICIAL_BAIT|FISHING_NET|ROD_POD|BITE_INDICATOR)S?$') { $gl.lure[$t.Value.en] = $t.Value.de }
}

# The bait side, grouped. Heading and note are not written here: the site takes
# them from its own dictionaries under gloss.<key>.title and .note, so the page
# follows the chosen language. Only the key and the items belong in the data.
function CatItems($pattern) {
    $list = @()
    foreach ($t in ($terms.GetEnumerator() | Where-Object { $_.Key -match $pattern } | Sort-Object { $_.Value.en })) {
        $list += [pscustomobject]@{ en = $t.Value.en; de = $t.Value.de; key = $t.Key }
    }
    return @($list)
}
$gl.categories = @(
    [pscustomobject]@{ key = 'natural'; items = CatItems '^EQUIPMENT/NATURAL_BAITS/' },
    [pscustomobject]@{ key = 'boilie';  items = CatItems '^EQUIPMENT/BOILIE/' },
    [pscustomobject]@{ key = 'lure';    items = CatItems '^EQUIPMENT/(SPOON|SPINNER|WOBBLER|CRANKBAIT|SOFT_BAIT|LURES|FLIES|ARTIFICIAL_BAIT)S?$' },
    [pscustomobject]@{ key = 'method';  items = CatItems '^GUI/METHODS_' },
    [pscustomobject]@{ key = 'gear';    items = CatItems '^EQUIPMENT/(HOOK|FLOAT|FEEDER|LINE|REEL|ROD|ROD_POD|BITE_INDICATOR|FLOAT_WEIGHT|FISHING_NET)S?$' }
)

# ------------------------------ 3b) Baits and the bite model from the prefabs
# baits.ps1 gives the list fishInterests per bait prefab, bitecurves.ps1 the
# nine weighting curves per species. Both are folded together here:
#  - prefabs that differ only in their running number are merged into one
#    entry (BellamySwimJig_01..03 is the same bait),
#  - the interests go into the file as an "index:percent" list, otherwise it
#    would be several times its size,
#  - of the curves the three that are filled in at all are kept.

function BaitNorm($s) {
    $x = ($s -replace '[^A-Za-z0-9]', '').ToLower()
    $x = $x -replace '\d+$', ''
    return ($x -replace 's$', '')
}
# Spellings that drift apart between prefab and localisation. Keys match both
# the raw base name and the normalised form.
$BAIT_ALIAS = @{
    'gingerbreadherbal' = 'gingerherbal'
    # The young-fish prefabs and Bait_LiveBait are one item in the game, and the
    # game calls it plain live bait.
    'Young_Fish'   = 'livebait'
    'CutbaitSmall' = 'cutbaitsmall'
    'CutbaitBig'   = 'cutbaitbig'
}
# Product names the CamelCase split gets wrong on its own.
$BAIT_NAMES = @{
    'Sakura PopNDog' = @("Sakura Pop'N'Dog", "Sakura Pop'N'Dog")
}
# Fly types carry no equipment name, only the type
$FLY_NAMES = @{
    'FlyDry' = @('Dry fly', 'Trockenfliege'); 'FlyWet' = @('Wet fly', 'Nassfliege')
    'FlyNymph' = @('Nymph', 'Nymphe'); 'FlyStreamer' = @('Streamer', 'Streamer')
}

$baitTerm = @{}
foreach ($tk in $terms.Keys) {
    if ($tk -notmatch '^EQUIPMENT/(NATURAL_BAITS|BOILIE)/') { continue }
    $kind = if ($tk -like '*BOILIE*') { 'boilie' } else { 'natural' }
    $n = BaitNorm (($tk -split '/')[-1])
    if ($n -and -not $baitTerm.ContainsKey($n)) {
        $baitTerm[$n] = [pscustomobject]@{ en = $terms[$tk].en; de = $terms[$tk].de; kind = $kind }
    }
}

# The interest list names some species under a variant key (TENCH_B) or, the
# other way round, without the one the species list carries (RED_DRUM next to
# RED_DRUM_D). Both are pulled onto the species list's key.
$SPECIES_ALIAS = @{
    'ATLANTIC_GOLIATH_GROUPER' = 'GIANT_GROUPER_D'; 'BLACK_DRUM' = 'DRUM_BLACK_D'
    'GIANT_TRAVELLY' = 'GIANT_TREVALLY'; 'KOI_CARP' = 'CARP_KOI'; 'MAHI_MAHI' = 'DORADO'
    'RED_LIONFISH' = 'COMMON_LIONFISH'; 'GREAT_BARRACUDA_FLORIDA' = 'BARRACUDA'
}
$speciesAlias = @{}
function BaitSpeciesKey($k) {
    if ($speciesAlias.ContainsKey($k)) { return $speciesAlias[$k] }
    $res = $null
    if ($k -like 'old_*') { $res = $null }                       # discarded leftovers
    elseif ($species.Contains($k)) { $res = $k }
    elseif ($SPECIES_ALIAS.ContainsKey($k) -and $species.Contains($SPECIES_ALIAS[$k])) { $res = $SPECIES_ALIAS[$k] }
    elseif ($k -match '^(.*)_FLORIDA$' -and $species.Contains($Matches[1])) { $res = $Matches[1] }
    elseif ($k -match '^(.*)_[A-Z]{1,2}$' -and $species.Contains($Matches[1])) { $res = $Matches[1] }
    else {
        foreach ($cand in $species.Keys) {
            if ($cand -like "$k`_*") { $res = $cand; break }
        }
    }
    $speciesAlias[$k] = $res
    return $res
}

# The bait type comes from the Bait component, not from the naming:
# baittypes.ps1 reads it per prefab. Prefabs without that component are
# natural baits – they go onto a hook as pieces of bait.
$baitKindOf = @{}
$baitFactsOf = @{}
$typeFile = Join-Path $sp 'baittypes.json'
if (Test-Path $typeFile) {
    $bt = Get-Content $typeFile -Raw | ConvertFrom-Json
    foreach ($p in $bt.PSObject.Properties) {
        $baitKindOf[$p.Name] = if ($p.Value.type -eq 'FLY') { 'fly' } else { 'lure' }
        # The same component also states what kind of lure it is and which hook
        # it carries – both are worth showing, so keep them.
        $baitFactsOf[$p.Name] = $p.Value
    }
}
function BaitKind($prefab) {
    if ($baitKindOf.ContainsKey($prefab)) { return $baitKindOf[$prefab] }
    if ($prefab -like 'Boilie*') { return 'boilie' }
    return 'natural'
}

$baits = [ordered]@{}
$baitSpecies = @()
$baitSpeciesIdx = @{}
$baitDropped = @{}
$baitBest = @{}          # highest interest per species and method
$baitFile = Join-Path $sp 'baits.json'
if (Test-Path $baitFile) {
    $raw = Get-Content $baitFile -Raw | ConvertFrom-Json
    foreach ($p in $raw.PSObject.Properties) {
        $base = $p.Name -replace '^(Bait_|Boilie_)', '' -replace '_\d+$', ''
        # The game offers live bait in one size. Bait_LiveBait is that item;
        # small, medium and large are three older prefabs of the same thing, so
        # all four become one entry and the highest interest per species wins.
        if ($base -match '^Young_Fish_[SML]$' -or $base -eq 'LiveBait') { $base = 'Young_Fish' }
        # Cut bait, on the other hand, really is two items: _01 is the small one,
        # _02 the large one, in the order the prefabs sit in. Their interest
        # tables are identical, only the name differs.
        if ($base -eq 'Cutbait') {
            $base = if ($p.Name -match '_02$') { 'CutbaitBig' } else { 'CutbaitSmall' }
        }
        $kind = BaitKind $p.Name
        if ($baits.Contains($base)) { $merge = $true } else { $merge = $false }

        $n = BaitNorm $base
        if ($BAIT_ALIAS.ContainsKey($base)) { $n = $BAIT_ALIAS[$base] }
        elseif ($BAIT_ALIAS.ContainsKey($n)) { $n = $BAIT_ALIAS[$n] }
        $t = $baitTerm[$n]
        if ($t) { $en = $t.en; $de = $t.de }
        elseif ($BAIT_NAMES.ContainsKey($base)) { $en = $BAIT_NAMES[$base][0]; $de = $BAIT_NAMES[$base][1] }
        elseif ($FLY_NAMES.ContainsKey($base)) { $en = $FLY_NAMES[$base][0]; $de = $FLY_NAMES[$base][1] }
        else {
            # Produktname: CamelCase auftrennen, Unterstriche zu Leerzeichen
            $en = ($base -replace '_', ' ')
            $en = [Regex]::Replace($en, '(?<=[a-z0-9])(?=[A-Z])', ' ')
            $de = $en
        }

        # Fold variants of the same species together, the higher value wins
        $merged = [ordered]@{}
        foreach ($f in $p.Value.fish.PSObject.Properties) {
            $v = [double]$f.Value
            if ($v -lt 0.05) { continue }
            $sk = BaitSpeciesKey $f.Name
            if (-not $sk) { $baitDropped[$f.Name] = $true; continue }
            if (-not $merged.Contains($sk) -or $merged[$sk] -lt $v) { $merged[$sk] = $v }
        }
        # String keys on purpose: an [ordered] dictionary reads an int in
        # brackets as a position, not as a key.
        $byIdx = @{}
        $order = New-Object System.Collections.ArrayList
        if ($merge) {
            foreach ($old in ($baits[$base].i -split ',')) {
                if (-not $old) { continue }
                $kv = $old -split ':'
                $byIdx[$kv[0]] = [int]$kv[1]
                [void]$order.Add($kv[0])
            }
        }
        foreach ($sk in $merged.Keys) {
            if (-not $baitSpeciesIdx.ContainsKey($sk)) {
                $baitSpeciesIdx[$sk] = $baitSpecies.Count
                $baitSpecies += $sk
            }
            $ix = [string]$baitSpeciesIdx[$sk]
            $pct = [int][Math]::Round($merged[$sk] * 100)
            if (-not $byIdx.ContainsKey($ix)) { [void]$order.Add($ix) }
            if (-not $byIdx.ContainsKey($ix) -or $byIdx[$ix] -lt $pct) { $byIdx[$ix] = $pct }
        }
        $pairs = @($order | ForEach-Object { '{0}:{1}' -f $_, $byIdx[$_] })
        if ($pairs.Count -eq 0) { continue }
        $e = [ordered]@{ en = $en; de = $de; kind = $kind }
        $facts = $baitFactsOf[$p.Name]
        if ($facts) {
            # HOOK is the naked hook of a natural-bait rig and says nothing about
            # a lure, so it is not worth a badge.
            if ($facts.type -and $facts.type -ne 'HOOK') { $e.type = $facts.type }
            if ($facts.fly) { $e.fly = $facts.fly }
            # hookSize is deliberately left out: the int behind the type reads 8
            # for every one of the 50 lures, so it is a default and not the hook
            # the lure carries. A constant is not a figure worth printing.
        }
        $e.i = ($pairs -join ',')
        $baits[$base] = $e
    }
    Write-Host "Baits: $($baits.Count)   species in the tables: $($baitSpecies.Count)"
    if ($baitDropped.Count) {
        Write-Host ("  without a match in the species list: " + (($baitDropped.Keys | Sort-Object) -join ', '))
    }

    # Best reachable bait preference per species and method. Every prefab counts
    # here, including the variants merged into one entry above.
    foreach ($p in $raw.PSObject.Properties) {
        $kind = BaitKind $p.Name
        foreach ($f in $p.Value.fish.PSObject.Properties) {
            $v = [double]$f.Value
            if ($v -le 0) { continue }
            $sk = BaitSpeciesKey $f.Name
            if (-not $sk) { continue }
            if (-not $baitBest.ContainsKey($sk)) { $baitBest[$sk] = @{} }
            if (-not $baitBest[$sk].ContainsKey($kind) -or $baitBest[$sk][$kind] -lt $v) {
                $baitBest[$sk][$kind] = $v
            }
        }
    }

    # Attach four percentages to the species: fly, lure, natural bait, boilie.
    # The natural bait figure is for a single piece;
    # Bait.CheckTaste rechnet bei mehreren "bestes + 0,2 je weiteres".
    $withMethods = 0
    foreach ($sk in $baitBest.Keys) {
        if (-not $species.Contains($sk)) { continue }
        $b = $baitBest[$sk]
        $vals = @()
        foreach ($kd in 'fly', 'lure', 'natural', 'boilie') {
            $vals += [int][Math]::Round(($(if ($b.ContainsKey($kd)) { $b[$kd] } else { 0 })) * 100)
        }
        $species[$sk].m = $vals
        $withMethods++
    }
    Write-Host "Fishing methods rated per species: $withMethods"
}

# Only the three curves that are filled in per species at all.
$curveFile = Join-Path $sp 'bitecurves.json'
if (Test-Path $curveFile) {
    $bc = Get-Content $curveFile -Raw | ConvertFrom-Json
    foreach ($p in $bc.PSObject.Properties) {
        if (-not $species.Contains($p.Name)) { continue }
        $bite = [ordered]@{}
        foreach ($cn in 'wind', 'cloudiness', 'rain') {
            $cv = $p.Value.curves.$cn
            if (-not $cv) { continue }
            $flat = $true
            foreach ($pt in $cv) { if ([Math]::Abs($pt[1] - 1) -gt 0.001) { $flat = $false; break } }
            if ($flat) { continue }
            $bite[$cn] = @($cv | ForEach-Object { , @([Math]::Round($_[0], 2), [Math]::Round($_[1], 2)) })
        }
        if ($bite.Count) { $species[$p.Name].bite = $bite }

        # Retrieve when spin fishing: one factor per entry of the enum
        # SpinningMethod. Der erste Wert (NONE) bleibt weg, er beschreibt
        # "no retrieve" and sits at 0 for every species.
        if ($p.Value.spin -and $p.Value.spin.Count -eq 7) {
            $species[$p.Name].spin = @($p.Value.spin[1..6])
        }
    }
}

# Size tables: hook and bait size against fish weight and length.
$hooks = $null
$hookFile = Join-Path $sp 'hooks.json'
if (Test-Path $hookFile) {
    $hooks = Get-Content $hookFile -Raw | ConvertFrom-Json
    Write-Host "Size tables: $($hooks.steps) steps"
}

# Names for the skill tree. The save file records one flag per step
# (skill_unlocked_MORE_EXP_2). How many steps a skill has is counted from the
# save file, not from here: the localisation names only the first step of
# Hunter Vision although the game has three.
#
# Craft hooks, fillet and fry are in SkillsManager.SkillType and are named in
# the localisation, but the game never unlocks them: they stay false in save
# files at maximum level with no points left. They are left out rather than
# shown as a step nobody can take.
$SKILLS_UNUSED = @('CRAFT_HOOKS', 'FILLET', 'FRY')
$skills = @()
$skillSeen = @{}
foreach ($t in $terms.GetEnumerator()) {
    if ($t.Key -notmatch '^SKILLS/(.+)_(\d+)_NAME$') { continue }
    $base = $Matches[1]
    if ($SKILLS_UNUSED -contains $base) { continue }
    $step = [int]$Matches[2]
    if (-not $skillSeen.ContainsKey($base)) {
        $skillSeen[$base] = [ordered]@{ key = $base; en = ''; de = ''; descEn = ''; descDe = '' }
    }
    $e = $skillSeen[$base]
    if ($step -eq 1) {
        $e.en = $t.Value.en
        $e.de = $t.Value.de
        $d = $terms["SKILLS/${base}_1_DESC"]
        if ($d) { $e.descEn = $d.en; $e.descDe = $d.de }
    }
}
foreach ($k in ($skillSeen.Keys | Sort-Object)) { $skills += [pscustomobject]$skillSeen[$k] }
Write-Host "Skills named: $($skills.Count)"

$data = [ordered]@{
    generated   = (Get-Date -Format 'yyyy-MM-dd')
    source      = 'Ultimate Fishing Simulator, Spieldateien (Unity 2017.4.29f1)'
    species     = $species
    fisheries   = $fisheries
    glossary    = $gl
    baitSpecies = $baitSpecies
    baits       = $baits
    hooks       = $hooks
    skills      = $skills
}
$json = $data | ConvertTo-Json -Depth 12 -Compress
New-Item -ItemType Directory -Force (Join-Path $proj 'src\data') | Out-Null
[IO.File]::WriteAllText("$proj\src\data\gamedata.json", $json)

# ------------------------------------------------- 4) Master data for the API
# The Symfony service evaluates uploaded save files itself and needs the
# species list, the fisheries with their species and the save-file keys.
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
Write-Host "-> src/data/gamedata.json  $([Math]::Round($json.Length/1KB)) KB   species in total: $($species.Count)"
