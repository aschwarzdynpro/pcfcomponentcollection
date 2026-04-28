#Requires -Version 5.1
<#
    Builds the FlagPhoneControl PCF and packs it into Dataverse-importable
    solution zips (unmanaged + managed).

    Output:
        bin\FlagPhoneControl.zip          (Unmanaged)
        bin\FlagPhoneControl_managed.zip  (Managed)

    Prerequisites:
        - Node.js + npm
        - Power Platform CLI (pac)
#>

param(
    [string]$Configuration = 'Release'
)

# Don't use 'Stop' globally — PowerShell 5.1 turns native-command stderr into
# terminating ErrorRecords, even when the exe exits 0. We check $LASTEXITCODE
# explicitly after each native call instead.
$ErrorActionPreference = 'Continue'

$solutionRoot = $PSScriptRoot
$featureRoot  = Split-Path $solutionRoot -Parent  # ../FlagPhoneControl (wrapper)
$pcfRoot      = Join-Path $featureRoot 'FlagPhoneControl'
$controlOut   = Join-Path $pcfRoot 'out\controls'
$stageRoot    = Join-Path $solutionRoot 'src\Controls\wal_FlagPhone.FlagPhoneControl'
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
$unmanaged = Join-Path $binDir 'FlagPhoneControl.zip'
$managed   = Join-Path $binDir 'FlagPhoneControl_managed.zip'
Remove-Item $unmanaged, $managed -Force -ErrorAction SilentlyContinue

pac solution pack --zipfile $unmanaged --folder (Join-Path $solutionRoot 'src') --packagetype Unmanaged
if ($LASTEXITCODE -ne 0) { throw 'pac solution pack (Unmanaged) failed.' }

pac solution pack --zipfile $managed   --folder (Join-Path $solutionRoot 'src') --packagetype Managed
if ($LASTEXITCODE -ne 0) { throw 'pac solution pack (Managed) failed.' }

Write-Host ''
Write-Host 'Built solution packages:' -ForegroundColor Green
Get-ChildItem $binDir -Filter '*.zip' | Format-Table Name, Length, LastWriteTime
