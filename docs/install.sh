#!/bin/bash
set -euo pipefail

if [ "$(uname)" != "Darwin" ]; then
  echo "Error: Airport is macOS-only." >&2
  exit 1
fi

ARCH=$(uname -m)
if [ "$ARCH" != "arm64" ]; then
  echo "Error: Airport currently requires Apple Silicon (arm64). Intel Mac support coming soon." >&2
  exit 1
fi
REPO="tomer-van-cohen/airport"

echo "Fetching latest release..."
LATEST=$(curl -sfL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | cut -d'"' -f4)
if [ -z "$LATEST" ]; then
  echo "Error: Could not find a release. Check https://github.com/${REPO}/releases" >&2
  exit 1
fi

URL="https://github.com/${REPO}/releases/download/${LATEST}/Airport-${ARCH}.tar.gz"

echo "Installing Airport ${LATEST} for ${ARCH}..."
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

curl -fSL "$URL" -o "$TMP_DIR/airport.tar.gz"
tar xzf "$TMP_DIR/airport.tar.gz" -C "$TMP_DIR"

if [ -d /Applications/Airport.app ]; then
  rm -rf /Applications/Airport.app
fi
mv "$TMP_DIR/Airport.app" /Applications/Airport.app

mkdir -p /usr/local/bin
ln -sf /Applications/Airport.app/Contents/Resources/bin/airport /usr/local/bin/airport

echo ""
echo "Airport ${LATEST} installed to /Applications/Airport.app"
echo "Run:  open /Applications/Airport.app"
