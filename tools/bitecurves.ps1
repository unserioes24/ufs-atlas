<#
    Liest je Fischart das Gewichtungsmodell für den Biss aus den Prefabs.

    In der Klasse Fish stehen neun Gewichte und danach zehn Kurven, in dieser
    Reihenfolge (Quelle: Assembly-CSharp.dll):

        float timeWeight, hungerWeight, baitDepthWeight, temperatureWeight,
              windWeight, pressureWeight, cloudinessWeight, rainWeight,
              baitSpeedWeight
        AnimationCurve timeCurve, hungerCurve, baitDepthCurve, temperatureCurve,
              windCurve, pressureCurve, cloudinessCurve, rainCurve,
              baitSpeedCurve, waterPlant

    Eine AnimationCurve serialisiert als [int Anzahl][je Schlüssel 16 Byte:
    Zeit, Wert, Eingangs- und Ausgangssteigung][3 int Nachspann], also 48 Byte
    bei zwei Schlüsseln.

    Angesetzt wird an der Beißzeitkurve: sie ist die einzige, die bei 0 beginnt
    und bei 24 endet. Von dort laufen die übrigen der Reihe nach, die neun
    Gewichte liegen unmittelbar davor.

    Ausgabe: tools\_work\bitecurves.json
#>
param(
    [string]$Work = (Join-Path $PSScriptRoot '_work')
)
$ErrorActionPreference = 'Stop'
[Threading.Thread]::CurrentThread.CurrentCulture = [Globalization.CultureInfo]::InvariantCulture

$NAMES = @('time', 'hunger', 'baitDepth', 'temperature', 'wind', 'pressure', 'cloudiness', 'rain', 'baitSpeed', 'waterPlant')

$fp = Get-Content (Join-Path $Work 'fishprefabs.json') -Raw | ConvertFrom-Json
$prefabKeys = Get-Content (Join-Path $Work 'prefabkeys.json') -Raw | ConvertFrom-Json

$out = [ordered]@{}
$skipped = 0
foreach ($ob in $fp.objects) {
    $key = $prefabKeys.($ob.name)
    if (-not $key -or $out.Contains($key)) { continue }
    $c = @($ob.comps | Where-Object { $_.cls -eq 114 -and $_.size -gt 1500 -and $_.size -lt 1900 })
    if (-not $c) { continue }

    $h = $c[0].hex
    $b = New-Object byte[] ($h.Length / 2)
    for ($i = 0; $i -lt $b.Length; $i++) { $b[$i] = [Convert]::ToByte($h.Substring($i * 2, 2), 16) }

    $start = -1
    for ($s = 600; $s -lt $b.Length - 60; $s += 4) {
        $n = [BitConverter]::ToInt32($b, $s)
        if ($n -lt 2 -or $n -gt 12 -or $s + 4 + $n * 16 + 12 -gt $b.Length) { continue }
        if ([BitConverter]::ToSingle($b, $s + 4) -eq 0 -and
            [BitConverter]::ToSingle($b, $s + 4 + ($n - 1) * 16) -eq 24) { $start = $s; break }
    }
    if ($start -lt 36) { $skipped++; continue }

    $weights = [ordered]@{}
    for ($i = 0; $i -lt 9; $i++) {
        $weights[$NAMES[$i]] = [Math]::Round([BitConverter]::ToSingle($b, $start - 36 + $i * 4), 3)
    }

    $curves = [ordered]@{}
    $p = $start
    for ($ci = 0; $ci -lt 10; $ci++) {
        $n = [BitConverter]::ToInt32($b, $p)
        if ($n -lt 1 -or $n -gt 12 -or $p + 4 + $n * 16 + 12 -gt $b.Length) { break }
        $pts = @()
        $bad = $false
        for ($k = 0; $k -lt $n; $k++) {
            $t = [BitConverter]::ToSingle($b, $p + 4 + $k * 16)
            $v = [BitConverter]::ToSingle($b, $p + 8 + $k * 16)
            if ([double]::IsNaN($t) -or [double]::IsNaN($v)) { $bad = $true; break }
            $pts += , @([Math]::Round($t, 3), [Math]::Round($v, 3))
        }
        if ($bad) { break }
        $curves[$NAMES[$ci]] = $pts
        $p = $p + 4 + $n * 16 + 12
    }
    if ($curves.Count -lt 9) { $skipped++; continue }

    # Direkt hinter den Kurven: List<float> spinningMethodFactor mit einem Wert
    # je Eintrag des Enums SpinningMethod (NONE, STRAIGHT_SLOW, STRAIGHT,
    # STRAIGHT_FAST, LIFT_DROP, STOP_GO, TWITCHING), danach floatMethodFactor.
    $spin = $null; $floatFactor = $null
    if ($curves.Count -eq 10 -and $p + 4 -le $b.Length) {
        $cnt = [BitConverter]::ToInt32($b, $p)
        if ($cnt -eq 7 -and $p + 4 + $cnt * 4 + 4 -le $b.Length) {
            $vals = @()
            $ok = $true
            for ($i = 0; $i -lt $cnt; $i++) {
                $v = [BitConverter]::ToSingle($b, $p + 4 + $i * 4)
                if ([double]::IsNaN($v) -or $v -lt 0 -or $v -gt 1) { $ok = $false; break }
                $vals += [Math]::Round($v, 3)
            }
            $f = [BitConverter]::ToSingle($b, $p + 4 + $cnt * 4)
            if ($ok -and -not [double]::IsNaN($f) -and $f -ge 0 -and $f -le 1) {
                $spin = $vals
                $floatFactor = [Math]::Round($f, 3)
            }
        }
    }

    $out[$key] = [ordered]@{
        weights = $weights; curves = $curves
        spin = $spin; floatFactor = $floatFactor
    }
}

($out | ConvertTo-Json -Depth 8) | Set-Content -Encoding utf8 (Join-Path $Work 'bitecurves.json')
"Arten mit Kurven : $($out.Count)"
"übersprungen     : $skipped"

# Welche Regler sind überhaupt bespielt?
"`nAbweichung von der Konstanten 1:"
foreach ($nm in $NAMES) {
    if ($nm -eq 'time' -or $nm -eq 'waterPlant') { continue }
    $n = 0
    foreach ($k in $out.Keys) {
        $cv = $out[$k].curves[$nm]
        if (-not $cv) { continue }
        foreach ($pt in $cv) { if ([Math]::Abs($pt[1] - 1) -gt 0.001) { $n++; break } }
    }
    "  {0,-12} {1,3} von {2} Arten" -f $nm, $n, $out.Count
}
$mitSpin = 0
foreach ($k in $out.Keys) { if ($out[$k].spin) { $mitSpin++ } }
"`nFührungsfaktoren gelesen: $mitSpin von $($out.Count) Arten"
