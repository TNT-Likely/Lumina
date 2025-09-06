#!/usr/bin/env bash
set -euo pipefail

# Env
export NODE_ENV=production

# Start server via pnpm workspace
pnpm -w -F server start &

# Start nginx in foreground
nginx -g 'daemon off;'
