#!/bin/sh
set -e

echo "🔧 Setting up Node.js environment..."

# Xcode Cloud may not have Node.js — install via Homebrew
if ! command -v node &> /dev/null; then
  echo "Node.js not found, installing via Homebrew..."
  brew install node
fi

echo "Node version: $(node --version)"
echo "npm version: $(npm --version)"

# Navigate to repo root (ci_scripts is at ios/App/ci_scripts/)
cd "$CI_PRIMARY_REPOSITORY_PATH"

echo "📦 Installing Node.js dependencies..."
npm ci --prefer-offline

echo "🔨 Building web assets..."
npm run build

echo "🔄 Syncing Capacitor..."
npx cap sync ios

echo "✅ CI post-clone complete"
