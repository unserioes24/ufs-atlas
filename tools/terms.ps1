param([string]$In, [string]$Out)

$bytes = [IO.File]::ReadAllBytes($In)
$n = $bytes.Length
$utf8 = New-Object Text.UTF8Encoding($false, $true)
$LANGS = @('en','pl','de','fr','es','it','pt','ru','tr','zh','ko','ja')

function Read-Str([int]$p) {
    # returns @{ok;val;next} ; assumes $p is 4-aligned
    if ($p + 4 -gt $script:n) { return @{ok=$false} }
    $len = [BitConverter]::ToInt32($script:bytes, $p)
    if ($len -lt 0 -or $len -gt 20000 -or ($p + 4 + $len) -gt $script:n) { return @{ok=$false} }
    $s = ''
    if ($len -gt 0) {
        for ($k = $p + 4; $k -lt $p + 4 + $len; $k++) {
            $b = $script:bytes[$k]
            if ($b -lt 0x20 -and $b -ne 0x0A -and $b -ne 0x0D -and $b -ne 0x09) { return @{ok=$false} }
        }
        try { $s = $script:utf8.GetString($script:bytes, $p + 4, $len) } catch { return @{ok=$false} }
    }
    $nx = $p + 4 + $len
    if ($nx % 4 -ne 0) { $nx += 4 - ($nx % 4) }
    return @{ok=$true; val=$s; next=$nx}
}

$rows = New-Object Collections.Generic.List[string]
$rows.Add(("term`t" + ($LANGS -join "`t")))
$i = 0
$count = 0
while ($i -lt $n - 8) {
    $t = Read-Str $i
    if (-not $t.ok -or $t.val.Length -lt 3 -or $t.val -notmatch '^[A-Z][A-Z0-9_]*(/[A-Za-z0-9_ .\-]+)+$') { $i += 4; continue }
    $p = $t.next
    if ($p + 8 -gt $n) { $i += 4; continue }
    $termType = [BitConverter]::ToInt32($bytes, $p); $p += 4
    $d = Read-Str $p
    if (-not $d.ok) { $i += 4; continue }
    $p = $d.next
    $cnt = [BitConverter]::ToInt32($bytes, $p); $p += 4
    if ($cnt -ne 12) { $i += 4; continue }
    $vals = New-Object string[] 12
    $bad = $false
    for ($k = 0; $k -lt 12; $k++) {
        $v = Read-Str $p
        if (-not $v.ok) { $bad = $true; break }
        $vals[$k] = ($v.val -replace "`r", '' -replace "`n", '\n' -replace "`t", ' ')
        $p = $v.next
    }
    if ($bad) { $i += 4; continue }
    $rows.Add(($t.val + "`t" + ($vals -join "`t")))
    $count++
    $i = $p
}
[IO.File]::WriteAllLines($Out, $rows, (New-Object Text.UTF8Encoding($false)))
"terms=$count -> $Out"
