param(
    [ValidateSet('linux/amd64', 'linux/arm64')]
    [string]$Platform = 'linux/amd64'
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Push-Location $projectRoot
try {
    & node tools/verify-webhook-sources.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Pinned webhook source verification failed.' }
    $architecture = $Platform.Split('/')[1]
    $candidate = "fragai-http-webhook-converter:phase4-$architecture"
    & docker build --platform $Platform --tag $candidate runtime/http-webhook-converter
    if ($LASTEXITCODE -ne 0) { throw 'Webhook converter build failed.' }
    $sourceLock = Get-Content runtime/http-webhook-converter/sources.lock.json -Raw | ConvertFrom-Json
    & docker pull --platform $Platform $sourceLock.baselineImage
    if ($LASTEXITCODE -ne 0) { throw 'Retained webhook baseline pull failed.' }
    & node tools/verify-webhook-converter.mjs --image $candidate --platform $Platform
    if ($LASTEXITCODE -ne 0) { throw 'Webhook compatibility checks failed; keep the application default unchanged.' }
    Write-Output "Verified $candidate. No image was published and no application deployment/default was changed."
} finally {
    Pop-Location
}
