#!/bin/bash
set -e

echo "Building api-server..."
pnpm --filter @workspace/api-server run build

echo "Copying built files to deploy/..."
cp artifacts/api-server/dist/*.mjs deploy/

echo "Done! Commit and push the deploy/ folder to update Railway."
