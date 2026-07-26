<#
    Exportiert die 3D-Modelle der Fische für den WebGL-Viewer.

    Ergebnis je Art:
      models/<KEY>.js   Mesh als Base64 (Positionen, UVs, Indizes)
      models/<KEY>.jpg  vollständige Modelltextur, max. 1024 px
      models/index.js   Liste der verfügbaren Modelle

    Base64 in einer JS-Datei statt .bin, damit die Seite auch direkt über
    file:// funktioniert – fetch() ist dort gesperrt, <script> nicht.
#>
param(
    [string]$Work = (Join-Path $PSScriptRoot '_work'),
    [string]$Proj = (Split-Path $PSScriptRoot -Parent),
    [string]$Game = 'C:\Program Files (x86)\Steam\steamapps\common\Ultimate Fishing\UltimateFishing_Data',
    [int]$MaxVerts = 20000
)

$ErrorActionPreference = 'Stop'
[Threading.Thread]::CurrentThread.CurrentCulture = [Globalization.CultureInfo]::InvariantCulture
Add-Type -Path @("$PSScriptRoot\UfsAssets.cs", "$PSScriptRoot\UfsMesh.cs")
Add-Type -Path "$PSScriptRoot\UfsTex.cs" -ReferencedAssemblies 'System.Drawing'

$src = Join-Path $Game 'sharedassets2.assets'
$resS = Join-Path $Game 'sharedassets2.assets.resS'
$models = Join-Path $Proj 'models'
New-Item -ItemType Directory -Force $models | Out-Null
New-Item -ItemType Directory -Force $Work | Out-Null

Write-Host "Meshes und Materialien zuordnen …"
$map = ConvertFrom-Json ([Ufs.MeshTool]::MapFishMeshes($src, '^Fish_[A-Z]'))
$tex = (ConvertFrom-Json ([Ufs.Extractor]::Run($src, '^__x__$', $true, 0))).textures
$texById = @{}
foreach ($x in $tex) { $texById[[string]$x.id] = $x }

$keyFile = Join-Path $Work 'prefabkeys.json'
if (-not (Test-Path $keyFile)) { throw "prefabkeys.json fehlt – bitte zuerst build2.ps1 laufen lassen." }
$prefabKeys = ConvertFrom-Json ([IO.File]::ReadAllText($keyFile))

$done = @{}
$ok = 0; $skip = 0
foreach ($m in $map) {
    $pk = $prefabKeys.PSObject.Properties[$m.fish]
    if (-not $pk) { $skip++; continue }
    $key = $pk.Value
    if ($done[$key]) { continue }

    $tmp = Join-Path $Work 'mesh.tmp'
    $r = [Ufs.MeshTool]::Export($src, [long]$m.mesh, $tmp, $MaxVerts)
    if ($r -notlike 'ok*') { Write-Host ("  {0,-26} {1}" -f $key, $r); $skip++; continue }

    $b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($tmp))

    # Textur als data:-URI mit einbetten. Über file:// gilt eine Bilddatei als
    # fremde Herkunft und WebGL verweigert das Hochladen; data: geht.
    $t = $texById[[string]$m.tex]
    $texOk = $false
    $texB64 = ''
    if ($t -and $t.ss -gt 0) {
        $jpg = Join-Path $Work 'tex.tmp.jpg'
        $tr = [Ufs.TexExport]::SaveScaled($resS, $t.so, $t.ss, $t.w, $t.h, $t.fmt, $jpg, 512)
        if ($tr -like 'ok*') {
            $texB64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($jpg))
            $texOk = $true
        }
    }
    $js = 'window.UFS_MESH=window.UFS_MESH||{};window.UFS_MESH["' + $key + '"]={m:"' + $b64 + '"' +
          $(if ($texOk) { ',t:"data:image/jpeg;base64,' + $texB64 + '"' } else { '' }) + '};'
    [IO.File]::WriteAllText((Join-Path $models "$key.js"), $js, (New-Object Text.UTF8Encoding($false)))
    $done[$key] = $texOk
    $ok++
    Write-Host ("  {0,-26} {1}  Textur: {2}" -f $key, $r, $(if ($texOk) { $t.name } else { 'fehlt' }))
}

$list = @($done.Keys | Sort-Object)
$idx = 'window.UFS_MODELS=' + ($list | ConvertTo-Json -Compress) + ';'
if ($list.Count -eq 1) { $idx = 'window.UFS_MODELS=["' + $list[0] + '"];' }
[IO.File]::WriteAllText((Join-Path $models 'index.js'), $idx, (New-Object Text.UTF8Encoding($false)))

Remove-Item (Join-Path $Work 'mesh.tmp') -ErrorAction SilentlyContinue
$size = (Get-ChildItem $models | Measure-Object Length -Sum).Sum / 1MB
Write-Host ("`nModelle: {0}, übersprungen: {1}, Gesamtgröße: {2:N1} MB" -f $ok, $skip, $size)
