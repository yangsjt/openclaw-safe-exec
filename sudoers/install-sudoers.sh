#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$SCRIPT_DIR/openclaw-agents.sudoers"
DEST="/etc/sudoers.d/openclaw-agents"

if [ ! -f "$SRC" ]; then
  echo "❌ $SRC not found."
  echo "   Copy openclaw-agents.sudoers.example → openclaw-agents.sudoers"
  echo "   and replace <USERNAME> / <DISPATCHER_PATH> with real values."
  exit 1
fi

echo "=== OpenClaw Agent sudoers installer ==="

# 1. Syntax check (critical — bad sudoers can lock out sudo)
echo "Validating syntax..."
sudo visudo -cf "$SRC" || { echo "❌ Syntax error, aborting"; exit 1; }

# 2. Install
sudo cp "$SRC" "$DEST"
sudo chmod 0440 "$DEST"
sudo chown root:wheel "$DEST"
echo "✅ Installed to $DEST"

# 3. Verify NOPASSWD works — extract first command from sudoers file
echo "Verifying NOPASSWD..."
FIRST_CMD=$(grep "NOPASSWD:" "$SRC" | head -1 | sed 's/.*NOPASSWD: //')
if [ -n "$FIRST_CMD" ]; then
  if sudo -n $FIRST_CMD >/dev/null 2>&1; then
    echo "✅ NOPASSWD verification passed"
  else
    echo "⚠️  NOPASSWD verification failed (target service may not be installed)"
  fi
else
  echo "⚠️  No NOPASSWD rules found in $SRC"
fi
