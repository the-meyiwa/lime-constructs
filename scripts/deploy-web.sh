#!/usr/bin/env bash
# Build the web app and publish it to the gh-pages branch.
# Expo's static export names the bundle after a constant hash, so every deploy
# sits behind GitHub Pages' 10 minute CDN cache under the same URL. Renaming
# the bundle per build gives each deploy a fresh URL.
set -euo pipefail
cd "$(dirname "$0")/.."

REPO=$(git config --get remote.origin.url)
npx expo export -p web >/dev/null

BUILD=$(git rev-parse --short HEAD 2>/dev/null || echo dev)
if [ -n "$(git status --porcelain)" ]; then BUILD="${BUILD}-dirty-$(date +%s)"; fi

BUNDLE=$(basename "$(ls dist/_expo/static/js/web/index-*.js)")
NEW="index-${BUILD}.js"
mv "dist/_expo/static/js/web/${BUNDLE}" "dist/_expo/static/js/web/${NEW}"
sed -i "s|${BUNDLE}|${NEW}|g" dist/index.html

rm -rf /tmp/lc-pages
mkdir -p /tmp/lc-pages
cp -r dist/* /tmp/lc-pages/
cd /tmp/lc-pages
git init -q
git checkout -qb gh-pages
git add -A
git commit -qm "web build ${BUILD}"
git push -q -f "${REPO}" gh-pages
echo "deployed ${NEW}"
