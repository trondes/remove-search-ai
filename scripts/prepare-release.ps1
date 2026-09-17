param(
    [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
    [string]$OutDir = "dist"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-True {
    param(
        [bool]$Condition,
        [string]$Message
    )

    if (-not $Condition) {
        throw $Message
    }
}

function Get-ManifestPropertyValue {
    param(
        [object]$Object,
        [string]$Name
    )

    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) {
        return $null
    }

    return $property.Value
}

$manifestPath = Join-Path $ProjectRoot "manifest.json"
Assert-True (Test-Path $manifestPath) "manifest.json was not found in $ProjectRoot"

$manifestRaw = Get-Content -Path $manifestPath -Raw -Encoding UTF8
$manifest = $manifestRaw | ConvertFrom-Json

Assert-True ($manifest.manifest_version -eq 3) "manifest_version must be 3."
Assert-True (-not [string]::IsNullOrWhiteSpace($manifest.name)) "manifest.name is required."
Assert-True (-not [string]::IsNullOrWhiteSpace($manifest.version)) "manifest.version is required."

$hostPermissions = Get-ManifestPropertyValue -Object $manifest -Name "host_permissions"
if ($null -ne $hostPermissions -and $hostPermissions.Count -gt 0) {
    foreach ($permission in $hostPermissions) {
        if ($permission -match "google\.com/\*$" -or $permission -match "bing\.com/\*$") {
            throw "host_permissions is too broad: $permission"
        }
    }
}

Assert-True ($null -ne $manifest.content_scripts -and $manifest.content_scripts.Count -gt 0) "manifest.content_scripts is required."

foreach ($script in $manifest.content_scripts) {
    Assert-True ($null -ne $script.matches -and $script.matches.Count -gt 0) "Each content script entry must include matches."

    foreach ($matchPattern in $script.matches) {
        if ($matchPattern -match "google\.com/\*$" -or $matchPattern -match "bing\.com/\*$") {
            throw "Content script match pattern is too broad: $matchPattern"
        }
    }

    foreach ($scriptPath in $script.js) {
        $fullScriptPath = Join-Path $ProjectRoot $scriptPath
        Assert-True (Test-Path $fullScriptPath) "Missing content script file: $scriptPath"
    }
}

$icons = Get-ManifestPropertyValue -Object $manifest -Name "icons"
Assert-True ($null -ne $icons) "manifest.icons is required."

foreach ($iconSize in $icons.PSObject.Properties.Name) {
    $iconRelativePath = $icons.$iconSize
    $iconPath = Join-Path $ProjectRoot $iconRelativePath
    Assert-True (Test-Path $iconPath) "Missing icon file for size ${iconSize}: $iconRelativePath"
}

$outputDirectory = Join-Path $ProjectRoot $OutDir
$stagingDirectory = Join-Path $outputDirectory "chrome-package"

if (Test-Path $stagingDirectory) {
    Remove-Item -Path $stagingDirectory -Recurse -Force
}

New-Item -Path $stagingDirectory -ItemType Directory -Force | Out-Null

Copy-Item -Path (Join-Path $ProjectRoot "manifest.json") -Destination $stagingDirectory -Force
Copy-Item -Path (Join-Path $ProjectRoot "logo.png") -Destination $stagingDirectory -Force
Copy-Item -Path (Join-Path $ProjectRoot "src") -Destination $stagingDirectory -Recurse -Force

if (-not (Test-Path $outputDirectory)) {
    New-Item -Path $outputDirectory -ItemType Directory -Force | Out-Null
}

$zipName = "chrome-remove-search-ai-v$($manifest.version).zip"
$zipPath = Join-Path $outputDirectory $zipName

if (Test-Path $zipPath) {
    Remove-Item -Path $zipPath -Force
}

Compress-Archive -Path (Join-Path $stagingDirectory "*") -DestinationPath $zipPath -CompressionLevel Optimal

$zipFile = Get-Item -Path $zipPath
$sizeKb = [math]::Round($zipFile.Length / 1KB, 2)

Write-Host "Release package created: $zipPath"
Write-Host "Package size: $sizeKb KB"
Write-Host "Package includes: manifest.json, logo.png, src/**"
Write-Host "Validation checks passed: manifest schema basics, narrow matches, script/icon existence"
