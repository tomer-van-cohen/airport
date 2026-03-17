#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$repo = "tomer-van-cohen/airport"
$installDir = Join-Path $env:LOCALAPPDATA "Airport"

Write-Host "Fetching latest release..."
$release = Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest"
$tag = $release.tag_name
$asset = $release.assets | Where-Object { $_.name -like "*x64*.zip" } | Select-Object -First 1

if (-not $asset) {
    Write-Error "Could not find Windows release. Check https://github.com/$repo/releases"
    exit 1
}

Write-Host "Installing Airport $tag..."
$zipPath = Join-Path $env:TEMP "Airport-x64.zip"
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zipPath

# Remove existing installation
if (Test-Path $installDir) {
    Remove-Item -Recurse -Force $installDir
}

# Extract
New-Item -ItemType Directory -Force -Path $installDir | Out-Null
Expand-Archive -Path $zipPath -DestinationPath $installDir -Force
Remove-Item -Force $zipPath

# Add bin to PATH
$binDir = Join-Path $installDir "bin"
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$binDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$userPath;$binDir", "User")
    Write-Host "Added $binDir to user PATH"
}

# Create Start Menu shortcut
$startMenu = [Environment]::GetFolderPath("StartMenu")
$shortcutPath = Join-Path $startMenu "Programs\Airport.lnk"
$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($shortcutPath)
$shortcut.TargetPath = Join-Path $installDir "Airport.exe"
$shortcut.WorkingDirectory = $installDir
$shortcut.Description = "Airport - Terminal Multiplexer for AI Coding"
$shortcut.Save()
Write-Host "Created Start Menu shortcut"

# Check for WebView2 runtime
$webview2Key = "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BEB-E856EAFB0103}"
if (-not (Test-Path $webview2Key)) {
    Write-Host "WebView2 runtime not found. Installing..."
    $bootstrapper = Join-Path $env:TEMP "MicrosoftEdgeWebview2Setup.exe"
    Invoke-WebRequest -Uri "https://go.microsoft.com/fwlink/p/?LinkId=2124703" -OutFile $bootstrapper
    Start-Process -FilePath $bootstrapper -ArgumentList "/silent", "/install" -Wait
    Remove-Item -Force $bootstrapper -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Airport $tag installed to $installDir"
Write-Host "Launching Airport..."
Start-Process (Join-Path $installDir "Airport.exe")
