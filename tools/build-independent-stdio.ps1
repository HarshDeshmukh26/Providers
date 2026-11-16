param(
    [ValidateSet('linux/amd64', 'linux/arm64')]
    [string]$Platform = 'linux/amd64'
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Push-Location $projectRoot
try {
    node tools/verify-stdio-sources.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Pinned STDIO source verification failed.' }
    docker build --target source-tests runtime/stdio-wrapper
    if ($LASTEXITCODE -ne 0) { throw 'STDIO source tests failed.' }
    $architecture = $Platform.Split('/')[1]
    $candidate = "fragai-stdio-wrapper:phase4-$architecture"
    docker build --platform $Platform --tag $candidate runtime/stdio-wrapper
    if ($LASTEXITCODE -ne 0) { throw 'STDIO wrapper image build failed.' }
    $sourceLock = Get-Content runtime/stdio-wrapper/sources.lock.json -Raw | ConvertFrom-Json
    docker pull --platform $Platform $sourceLock.baselineImage
    if ($LASTEXITCODE -ne 0) { throw 'Baseline wrapper pull failed.' }
    node tools/verify-stdio-wrapper.mjs --image $candidate --platform $Platform
    if ($LASTEXITCODE -ne 0) { throw 'STDIO wrapper compatibility checks failed; keep the current default.' }
    Write-Output "Verified local image $candidate. No images were published and no application deployment/default was changed."
} finally {
    Pop-Location
}
