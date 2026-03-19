#!/bin/sh
set -e

echo "📦 Installing Node.js dependencies..."
cd ../../..
npm install

echo "🔨 Building web assets..."
npm run build

echo "🔄 Syncing Capacitor..."
npx cap sync ios

echo "✅ CI post-clone complete"
