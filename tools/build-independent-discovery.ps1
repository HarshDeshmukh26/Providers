param(
    [ValidateSet('linux/amd64', 'linux/arm64')]
    [string]$Platform = 'linux/amd64',
    [ValidateSet('default', 'host')]
    [string]$BuildNetwork = 'default'
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Push-Location $projectRoot
try {
    & node tools/verify-discovery-sources.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Discovery source verification failed.' }
    $architecture = $Platform.Split('/')[1]
    $candidate = "fragai-mcp-server:phase4-$architecture"
    & docker build --network $BuildNetwork --platform $Platform --target test runtime/mcp-discovery
    if ($LASTEXITCODE -ne 0) { throw 'Discovery source tests failed.' }
    & docker build --network $BuildNetwork --platform $Platform --tag $candidate runtime/mcp-discovery
    if ($LASTEXITCODE -ne 0) { throw 'Discovery image build failed.' }
    $sourceLock = Get-Content runtime/mcp-discovery/sources.lock.json -Raw | ConvertFrom-Json
    & docker pull --platform $Platform $sourceLock.baselineImage
    if ($LASTEXITCODE -ne 0) { throw 'Retained discovery baseline pull failed.' }
    & node tools/verify-discovery-server.mjs --image $candidate --platform $Platform
    if ($LASTEXITCODE -ne 0) { throw 'Discovery compatibility checks failed; keep the application default unchanged.' }
    Write-Output "Verified $candidate locally. No image was published and no application deployment/default was changed."
} finally {
    Pop-Location
}
