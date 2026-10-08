#Requires -Version 5.1
<#
    Builds the RecordAuditHistory PCF and packs it into Dataverse-importable
    solution zips (unmanaged + managed).

    Output (canonical "latest" — overwritten each build):
        bin\RecordAuditHistory.zip          (Unmanaged)
        bin\RecordAuditHistory_managed.zip  (Managed)

    Plus versioned archive copies (never overwritten — version read from
    src\Other\Solution.xml):
        bin\RecordAuditHistory_<version>.zip
        bin\RecordAuditHistory_managed_<version>.zip

    Prerequisites: Node.js + npm, Power Platform CLI (pac).
#>

# Not 'Stop': PowerShell 5.1 turns native stderr into terminating errors even
# on exit 0. $LASTEXITCODE is checked after each native call instead.
$ErrorActionPreference = 'Continue'

$solutionRoot = $PSScriptRoot
$pcfRoot      = Join-Path (Split-Path $solutionRoot -Parent) 'RecordAuditHistory'
$controlOut   = Join-Path $pcfRoot 'out\controls'
$stageRoot    = Join-Path $solutionRoot 'src\Controls\pro_AuditExplorer.RecordAuditHistory'
$binDir       = Join-Path $solutionRoot 'bin'

Write-Host "==> Building PCF: $pcfRoot" -ForegroundColor Cyan
Push-Location $pcfRoot
try {
    if (-not (Test-Path (Join-Path $pcfRoot 'node_modules'))) {
        npm install
        if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' }
    }
    npm run build -- --buildMode production
    if ($LASTEXITCODE -ne 0) { throw 'npm run build failed.' }
}
finally {
    Pop-Location
}

Write-Host "==> Staging built control into $stageRoot" -ForegroundColor Cyan
# Copy-Item does not stop on a missing source here ('Continue'), so check the
# build output first — otherwise an empty solution gets packed silently.
if (-not (Test-Path (Join-Path $controlOut 'ControlManifest.xml'))) {
    throw "No build output in $controlOut."
}
$keep = @('ControlManifest.xml.data.xml')
Get-ChildItem -Path $stageRoot -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $keep -notcontains $_.Name } |
    Remove-Item -Force
Get-ChildItem -Path $stageRoot -Directory -ErrorAction SilentlyContinue |
    Remove-Item -Recurse -Force

New-Item -ItemType Directory -Path $stageRoot -Force | Out-Null
Copy-Item -Path (Join-Path $controlOut 'ControlManifest.xml') -Destination $stageRoot -Force
Copy-Item -Path (Join-Path $controlOut 'bundle.js')           -Destination $stageRoot -Force
Copy-Item -Path (Join-Path $controlOut 'css')                 -Destination $stageRoot -Recurse -Force
Copy-Item -Path (Join-Path $controlOut 'strings')             -Destination $stageRoot -Recurse -Force

Write-Host "==> Packing solution zips into $binDir" -ForegroundColor Cyan
New-Item -ItemType Directory -Path $binDir -Force | Out-Null
$unmanaged = Join-Path $binDir 'RecordAuditHistory.zip'
$managed   = Join-Path $binDir 'RecordAuditHistory_managed.zip'
Remove-Item $unmanaged, $managed -Force -ErrorAction SilentlyContinue

pac solution pack --zipfile $unmanaged --folder (Join-Path $solutionRoot 'src') --packagetype Unmanaged
if ($LASTEXITCODE -ne 0) { throw 'pac solution pack (Unmanaged) failed.' }

pac solution pack --zipfile $managed --folder (Join-Path $solutionRoot 'src') --packagetype Managed
if ($LASTEXITCODE -ne 0) { throw 'pac solution pack (Managed) failed.' }

$solutionXml = Join-Path $solutionRoot 'src\Other\Solution.xml'
$version = ([xml](Get-Content -Raw -Path $solutionXml)).ImportExportXml.SolutionManifest.Version
Copy-Item $unmanaged (Join-Path $binDir "RecordAuditHistory_$version.zip") -Force
Copy-Item $managed   (Join-Path $binDir "RecordAuditHistory_managed_$version.zip") -Force
Write-Host "==> Archived versioned copies for $version" -ForegroundColor Cyan

Write-Host ''
Write-Host 'Built solution packages:' -ForegroundColor Green
Get-ChildItem $binDir -Filter '*.zip' | Sort-Object Name | Format-Table Name, Length, LastWriteTime
