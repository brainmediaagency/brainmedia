#!/usr/bin/env bash
# Developer-only: Firestore rules tests under emulator. No production writes.
set -euo pipefail
cd "$(dirname "$0")/../.."

java_major() {
  local home="${1:-}"
  local bin="${home}/bin/java"
  if [[ ! -x "$bin" ]]; then
    return 1
  fi
  # Example: openjdk version "21.0.12" 2026-07-21
  "$bin" -version 2>&1 | head -1 | sed -n 's/.*version "\([0-9]*\).*/\1/p'
}

use_java_home() {
  local home="$1"
  local maj
  maj="$(java_major "$home" || true)"
  if [[ -z "$maj" ]]; then
    return 1
  fi
  if (( maj < 21 )); then
    return 1
  fi
  export JAVA_HOME="$home"
  export PATH="${JAVA_HOME}/bin:${PATH}"
  return 0
}

pick_java21() {
  local candidates=()

  # Prefer known Homebrew OpenJDK 21 locations first (not always linked in java_home).
  candidates+=(
    "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
    "/opt/homebrew/opt/openjdk@21"
    "/usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
    "/usr/local/opt/openjdk@21"
  )

  if command -v /usr/libexec/java_home >/dev/null 2>&1; then
    # Only accept if the major version is actually 21+ (macOS may fall back to 17).
    local jhome
    jhome="$(/usr/libexec/java_home -v 21 2>/dev/null || true)"
    if [[ -n "$jhome" ]]; then
      candidates+=("$jhome")
    fi
    jhome="$(/usr/libexec/java_home -v 22 2>/dev/null || true)"
    if [[ -n "$jhome" ]]; then
      candidates+=("$jhome")
    fi
  fi

  if [[ -n "${JAVA_HOME:-}" ]]; then
    candidates+=("$JAVA_HOME")
  fi

  local home
  for home in "${candidates[@]}"; do
    if use_java_home "$home"; then
      return 0
    fi
  done

  echo ""
  echo "Firestore rules emulator needs JDK 21+."
  echo "This machine reports: $(java -version 2>&1 | head -1 || true)"
  echo ""
  echo "Install (Homebrew):"
  echo "  brew install openjdk@21"
  echo ""
  echo "Then re-run:"
  echo "  npm run test:rules:emu"
  echo ""
  exit 1
}

pick_java21

echo "Using JAVA_HOME=${JAVA_HOME}"
java -version 2>&1 | head -1

exec firebase emulators:exec --only firestore "npm run test:rules:run"
