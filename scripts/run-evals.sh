#!/usr/bin/env bash
# Run Sharry promptfoo evals (requires Node 20 due to better-sqlite3)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

CONFIG="$PROJECT_ROOT/evals/promptfooconfig.yaml"
ENV_FILE="$PROJECT_ROOT/.env.local"

# --- Node version check ---
REQUIRED_MAJOR=20

current_major=$(node -v | sed 's/v\([0-9]*\).*/\1/')

if [ "$current_major" -gt "$REQUIRED_MAJOR" ]; then
  echo "Node $current_major detected — evals need Node $REQUIRED_MAJOR (better-sqlite3 compat)."

  # Try nvm
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    # shellcheck source=/dev/null
    . "$NVM_DIR/nvm.sh"
    echo "Switching to Node $REQUIRED_MAJOR via nvm..."
    nvm use "$REQUIRED_MAJOR" || { echo "Run: nvm install $REQUIRED_MAJOR"; exit 1; }
  else
    echo "nvm not found. Please switch to Node $REQUIRED_MAJOR manually."
    exit 1
  fi
fi

echo "Using Node $(node -v)"

# --- Run evals ---
ARGS=(-c "$CONFIG")

if [ -f "$ENV_FILE" ]; then
  ARGS+=(--env-file "$ENV_FILE")
fi

# Pass through any extra args (e.g. --filter-pattern "Brand")
ARGS+=("$@")

npx promptfoo eval "${ARGS[@]}"
