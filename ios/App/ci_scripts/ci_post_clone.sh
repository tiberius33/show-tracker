#!/bin/bash
set -eo pipefail

echo "========================================="
echo "CI Post-Clone Script — MySetlists"
echo "========================================="
echo "Date: $(date)"
echo "PWD: $(pwd)"
echo "CI_PRIMARY_REPOSITORY_PATH: ${CI_PRIMARY_REPOSITORY_PATH:-not set}"

# ── Step 1: Ensure Node.js is available ──
echo ""
echo "── Step 1: Node.js ──"
if command -v node > /dev/null 2>&1; then
  echo "Node.js found: $(node --version)"
else
  echo "Node.js not found. Installing via Homebrew..."
  export HOMEBREW_NO_AUTO_UPDATE=1
  brew install node
  echo "Node.js installed: $(node --version)"
fi
echo "npm version: $(npm --version)"

# ── Step 2: Navigate to repo root ──
echo ""
echo "── Step 2: Navigate to repo root ──"
if [ -n "$CI_PRIMARY_REPOSITORY_PATH" ]; then
  cd "$CI_PRIMARY_REPOSITORY_PATH"
elif [ -f "../../../package.json" ]; then
  cd "../../.."
else
  echo "ERROR: Cannot find repo root"
  echo "Script location: $(dirname "$0")"
  ls -la "$(dirname "$0")/../../.."
  exit 1
fi
echo "Repo root: $(pwd)"
echo "package.json exists: $(test -f package.json && echo YES || echo NO)"

# ── Step 3: Install dependencies ──
echo ""
echo "── Step 3: npm install ──"
npm install 2>&1
echo "node_modules exists: $(test -d node_modules && echo YES || echo NO)"

# ── Step 4: Build web assets ──
echo ""
echo "── Step 4: next build ──"
npm run build 2>&1
echo "out/ directory exists: $(test -d out && echo YES || echo NO)"
echo "out/index.html exists: $(test -f out/index.html && echo YES || echo NO)"

# ── Step 5: Capacitor sync ──
echo ""
echo "── Step 5: cap sync ios ──"
npx cap sync ios 2>&1

echo ""
echo "========================================="
echo "✅ CI Post-Clone Complete"
echo "========================================="
