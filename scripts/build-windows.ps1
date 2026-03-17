#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ProjectDir = Split-Path -Parent $ScriptDir
Set-Location $ProjectDir

$NodeVersion = "22.14.0"
$Version = (Get-Content package.json | ConvertFrom-Json).version

Write-Host "==> Building Airport v$Version for Windows x64"

# 1. Build renderer
Write-Host "==> Building renderer..."
npx vite build --config vite.standalone.config.ts

# 2. Build backend
Write-Host "==> Building backend..."
node esbuild.backend.mjs

# 3. Download Node.js binary
$NodeDir = Join-Path $ProjectDir ".cache\node-$NodeVersion-win-x64"
$NodeBin = Join-Path $NodeDir "node.exe"
if (-not (Test-Path $NodeBin)) {
    Write-Host "==> Downloading Node.js v$NodeVersion for x64..."
    New-Item -ItemType Directory -Force -Path $NodeDir | Out-Null
    $nodeZip = Join-Path $env:TEMP "node-v$NodeVersion-win-x64.zip"
    Invoke-WebRequest -Uri "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-win-x64.zip" -OutFile $nodeZip
    Expand-Archive -Path $nodeZip -DestinationPath (Split-Path $NodeDir) -Force
    # The zip extracts to node-v$NodeVersion-win-x64/ — rename
    $extractedDir = Join-Path (Split-Path $NodeDir) "node-v$NodeVersion-win-x64"
    if ((Test-Path $extractedDir) -and ($extractedDir -ne $NodeDir)) {
        if (Test-Path $NodeDir) { Remove-Item -Recurse -Force $NodeDir }
        Rename-Item $extractedDir $NodeDir
    }
    Remove-Item -Force $nodeZip -ErrorAction SilentlyContinue
}

# 4. Download Node.js headers (required by node-gyp)
$HeadersDir = Join-Path $ProjectDir ".cache\node-$NodeVersion-headers"
if (-not (Test-Path $HeadersDir)) {
    Write-Host "==> Downloading Node.js headers..."
    $headersTar = Join-Path $env:TEMP "node-v$NodeVersion-headers.tar.gz"
    Invoke-WebRequest -Uri "https://nodejs.org/dist/v$NodeVersion/node-v$NodeVersion-headers.tar.gz" -OutFile $headersTar
    New-Item -ItemType Directory -Force -Path $HeadersDir | Out-Null
    tar xzf $headersTar -C $HeadersDir --strip-components=1
    Remove-Item -Force $headersTar -ErrorAction SilentlyContinue
}

# 5. Rebuild node-pty for standalone Node
Write-Host "==> Rebuilding node-pty..."
npx --yes node-gyp rebuild `
    --directory=node_modules/node-pty `
    --arch=x64 `
    --target=$NodeVersion `
    --nodedir=$HeadersDir

# 6. Build Go shell
Write-Host "==> Building Go shell..."
Push-Location (Join-Path $ProjectDir "windows")
$env:CGO_ENABLED = "0"
go build -ldflags "-H windowsgui -X main.version=$Version" -o (Join-Path $ProjectDir "dist\Airport\Airport.exe") .
Pop-Location

# 7. Assemble distribution
Write-Host "==> Assembling distribution..."
$DistDir = Join-Path $ProjectDir "dist\Airport"
New-Item -ItemType Directory -Force -Path $DistDir | Out-Null

# Node binary
Copy-Item $NodeBin (Join-Path $DistDir "node.exe")

# Backend
Copy-Item (Join-Path $ProjectDir "dist\backend.js") (Join-Path $DistDir "backend.js")

# Renderer
$rendererDest = Join-Path $DistDir "renderer"
if (Test-Path $rendererDest) { Remove-Item -Recurse -Force $rendererDest }
Copy-Item -Recurse (Join-Path $ProjectDir "dist\renderer") $rendererDest

# node-pty native addon
$nptyDest = Join-Path $DistDir "node_modules\node-pty"
New-Item -ItemType Directory -Force -Path $nptyDest | Out-Null
Copy-Item -Recurse (Join-Path $ProjectDir "node_modules\node-pty\lib") (Join-Path $nptyDest "lib")
Copy-Item -Recurse (Join-Path $ProjectDir "node_modules\node-pty\build") (Join-Path $nptyDest "build")
Copy-Item (Join-Path $ProjectDir "node_modules\node-pty\package.json") (Join-Path $nptyDest "package.json")

# Hooks
$hooksDest = Join-Path $DistDir "hooks"
New-Item -ItemType Directory -Force -Path $hooksDest | Out-Null
Copy-Item (Join-Path $ProjectDir "hooks\airport-busy.js") (Join-Path $hooksDest "airport-busy.js")
Copy-Item (Join-Path $ProjectDir "hooks\airport-done.js") (Join-Path $hooksDest "airport-done.js")

# Bin scripts
$binDest = Join-Path $DistDir "bin"
New-Item -ItemType Directory -Force -Path $binDest | Out-Null
Copy-Item (Join-Path $ProjectDir "bin\airport-spawn.js") (Join-Path $binDest "airport-spawn.js")
Copy-Item (Join-Path $ProjectDir "bin\airport-spawn.cmd") (Join-Path $binDest "airport-spawn.cmd")

# Setup hooks script
$scriptsDest = Join-Path $DistDir "scripts"
New-Item -ItemType Directory -Force -Path $scriptsDest | Out-Null
Copy-Item (Join-Path $ProjectDir "scripts\setup-hooks.mjs") (Join-Path $scriptsDest "setup-hooks.mjs")

# 8. Create zip
Write-Host "==> Creating zip..."
$ZipPath = Join-Path $ProjectDir "dist\Airport-x64.zip"
if (Test-Path $ZipPath) { Remove-Item -Force $ZipPath }
Compress-Archive -Path (Join-Path $DistDir "*") -DestinationPath $ZipPath

Write-Host "==> Done!"
Write-Host "    Distribution: $DistDir"
Write-Host "    Zip: $ZipPath"
