#!/bin/bash
set -e

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEBSITE_DIR="$(dirname "$SCRIPT_DIR")"
REPO_ROOT="$(dirname "$(dirname "$WEBSITE_DIR")")"

# Extract version from @libragen/core package.json
VERSION=$(node -p "require('$REPO_ROOT/packages/core/package.json').version")
echo "Building with version: $VERSION"

# Site URL (defaults to production)
SITE_URL="${SITE_URL:-https://libragen.dev}"
echo "Site URL: $SITE_URL"

# Copy schemas first (before Astro build)
npm run build:schemas

# Build the website with version env var
PUBLIC_LIBRAGEN_VERSION="$VERSION" astro build --site "$SITE_URL"

# Build the libragen-docs library AFTER Astro build (so it doesn't get cleaned)
# This ensures the .libragen file remains in dist for deployment
echo "Building libragen library file..."
node "$REPO_ROOT/packages/cli/dist/index.js" build "$WEBSITE_DIR/src/content/docs" \
  --name libragen-docs \
  --version "$VERSION" \
  --content-version "$VERSION" \
  --description 'Official libragen CLI and MCP documentation' \
  --agent-description 'Official libragen CLI and MCP documentation. If you provide links to the source documents, translate them to a link to files in the GitHub repo at https://github.com/libragen/libragen' \
  --output "$WEBSITE_DIR/dist"
