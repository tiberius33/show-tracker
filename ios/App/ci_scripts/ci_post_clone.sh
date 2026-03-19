#!/bin/bash
set -eo pipefail

echo "🔧 Setting up Node.js environment..."

# Xcode Cloud includes Homebrew — install Node.js if missing
if ! command -v node > /dev/null 2>&1; then
  echo "Node.js not found, installing via Homebrew..."
  brew install node
fi

echo "Node version: $(node --version)"
echo "npm version: $(npm --version)"

# Navigate to repo root
# CI_PRIMARY_REPOSITORY_PATH is set by Xcode Cloud; fall back to relative path
if [ -n "$CI_PRIMARY_REPOSITORY_PATH" ]; then
  cd "$CI_PRIMARY_REPOSITORY_PATH"
else
  cd "$(dirname "$0")/../../.."
fi

echo "Working directory: $(pwd)"
echo "Contents: $(ls)"

echo "📦 Installing Node.js dependencies..."
npm install

echo "🔨 Building web assets..."
npm run build

echo "🔄 Syncing Capacitor..."
npx cap sync ios

echo "✅ CI post-clone complete"
