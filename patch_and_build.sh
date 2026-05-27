#!/bin/bash
set -e
echo "→ Running static analysis..."
npx eslint src/
if [ $? -ne 0 ]; then
  echo "❌ Static analysis failed. Fix errors before deploying."
  exit 1
fi
echo "✅ Static analysis passed."
echo "Building PreQual..."
node build.js
echo "Build complete. public/ is ready."
echo ""
echo "To deploy to Vercel: vercel --prod"
