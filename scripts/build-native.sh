#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

ARCH="${1:-$(uname -m)}"
NODE_VERSION="22.14.0"
VERSION=$(node -p "require('./package.json').version")

echo "==> Building Airport v${VERSION} for ${ARCH}"

# 1. Build renderer
echo "==> Building renderer..."
npx vite build --config vite.standalone.config.ts

# 2. Build backend
echo "==> Building backend..."
node esbuild.backend.mjs

# 3. Download Node.js binary
NODE_DIR="$PROJECT_DIR/.cache/node-${NODE_VERSION}-${ARCH}"
NODE_BIN="$NODE_DIR/bin/node"
if [ ! -f "$NODE_BIN" ]; then
    echo "==> Downloading Node.js v${NODE_VERSION} for ${ARCH}..."
    mkdir -p "$NODE_DIR"
    NODE_ARCH="$ARCH"
    if [ "$ARCH" = "aarch64" ]; then NODE_ARCH="arm64"; fi
    if [ "$ARCH" = "x86_64" ]; then NODE_ARCH="x64"; fi
    curl -sL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-darwin-${NODE_ARCH}.tar.gz" | \
        tar xz -C "$NODE_DIR" --strip-components=1
fi

# 4. Rebuild node-pty with the downloaded Node
echo "==> Rebuilding node-pty for ${ARCH}..."
"$NODE_BIN" "$NODE_DIR/bin/npx" --yes node-gyp rebuild \
    --directory=node_modules/node-pty \
    --arch="$ARCH" \
    --target="$NODE_VERSION" \
    --nodedir="$NODE_DIR" 2>&1 || \
"$NODE_BIN" node_modules/.bin/electron-rebuild -f -w node-pty -a "$ARCH" 2>&1 || \
echo "WARNING: node-pty rebuild may have failed — using existing build"

# 5. Build Swift app
echo "==> Building Swift app..."
cd macos/Airport
swift build -c release
SWIFT_BIN="$(swift build -c release --show-bin-path)/Airport"
cd "$PROJECT_DIR"

# 6. Assemble .app bundle
echo "==> Assembling Airport.app..."
APP_DIR="$PROJECT_DIR/dist/Airport.app"
rm -rf "$APP_DIR"
mkdir -p "$APP_DIR/Contents/MacOS"
mkdir -p "$APP_DIR/Contents/Resources"

# Info.plist
sed "s/__VERSION__/$VERSION/g" macos/Airport/Info.plist.template > "$APP_DIR/Contents/Info.plist"

# Swift binary
cp "$SWIFT_BIN" "$APP_DIR/Contents/MacOS/Airport"

# Node binary
cp "$NODE_BIN" "$APP_DIR/Contents/Resources/node"
chmod +x "$APP_DIR/Contents/Resources/node"

# Backend
cp dist/backend.js "$APP_DIR/Contents/Resources/backend.js"

# Renderer
cp -r dist/renderer "$APP_DIR/Contents/Resources/renderer"

# node-pty native addon
mkdir -p "$APP_DIR/Contents/Resources/node_modules/node-pty"
cp -r node_modules/node-pty/lib "$APP_DIR/Contents/Resources/node_modules/node-pty/lib"
cp -r node_modules/node-pty/build "$APP_DIR/Contents/Resources/node_modules/node-pty/build"
cp node_modules/node-pty/package.json "$APP_DIR/Contents/Resources/node_modules/node-pty/package.json"

# bin scripts
mkdir -p "$APP_DIR/Contents/Resources/bin"
cp bin/airport-spawn "$APP_DIR/Contents/Resources/bin/airport-spawn"
chmod +x "$APP_DIR/Contents/Resources/bin/airport-spawn"
if [ -f bin/airport.js ]; then
    cp bin/airport.js "$APP_DIR/Contents/Resources/bin/airport.js"
fi

# 7. Ad-hoc codesign
echo "==> Codesigning..."
codesign --force --deep --sign - "$APP_DIR"

# 8. Create tar.gz
echo "==> Creating tar.gz..."
TAR_PATH="$PROJECT_DIR/dist/Airport-${ARCH}.tar.gz"
rm -f "$TAR_PATH"
tar -czf "$TAR_PATH" -C "$PROJECT_DIR/dist" Airport.app

# 9. Create DMG
echo "==> Creating DMG..."
DMG_PATH="$PROJECT_DIR/dist/Airport-${ARCH}.dmg"
rm -f "$DMG_PATH"
hdiutil create -volname "Airport" -srcfolder "$APP_DIR" -ov -format UDZO "$DMG_PATH"

echo "==> Done!"
echo "    App bundle: $APP_DIR"
echo "    tar.gz:     $TAR_PATH"
echo "    DMG:        $DMG_PATH"
