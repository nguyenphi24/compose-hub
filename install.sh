#!/bin/sh
set -eu

REPOSITORY="tpcodelabs/composehub"
INSTALL_HOME="${COMPOSEHUB_HOME:-${HOME}/.composehub}"
WEB_PORT="${COMPOSEHUB_PORT:-5173}"
API_PORT="${COMPOSEHUB_API_PORT:-8000}"
REQUESTED_VERSION="${COMPOSEHUB_VERSION:-latest}"

say() {
  printf '%s\n' "[ComposeHub] $*"
}

fail() {
  printf '%s\n' "[ComposeHub] Error: $*" >&2
  exit 1
}

need() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

need curl
need tar
need docker
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 is required (docker compose)."
docker info >/dev/null 2>&1 || fail "Docker daemon is unavailable or your user cannot access it."

case "$WEB_PORT:$API_PORT" in
  *[!0-9:]*|:*|*:) fail "COMPOSEHUB_PORT and COMPOSEHUB_API_PORT must be numeric." ;;
esac

if [ "$REQUESTED_VERSION" = "latest" ]; then
  say "Resolving the latest release..."
  RELEASE_URL=$(curl -fsSL -o /dev/null -w '%{url_effective}' "https://github.com/${REPOSITORY}/releases/latest") \
    || fail "Could not resolve the latest GitHub release."
  VERSION=${RELEASE_URL##*/}
  [ -n "$VERSION" ] && [ "$VERSION" != "latest" ] || fail "No GitHub release is available yet."
else
  VERSION=$REQUESTED_VERSION
fi

case "$VERSION" in
  *[!A-Za-z0-9._-]*) fail "Invalid version: $VERSION" ;;
esac

RELEASE_DIR="${INSTALL_HOME}/releases/${VERSION}"
DATA_DIR="${INSTALL_HOME}/data"
ARCHIVE_URL="https://github.com/${REPOSITORY}/archive/refs/tags/${VERSION}.tar.gz"
TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/composehub.XXXXXX")
trap 'rm -rf "$TMP_DIR"' EXIT HUP INT TERM

say "Installing ${VERSION} into ${INSTALL_HOME}..."
curl -fL "$ARCHIVE_URL" -o "${TMP_DIR}/composehub.tar.gz" \
  || fail "Could not download ${VERSION}. Check COMPOSEHUB_VERSION or the release status."
mkdir -p "$RELEASE_DIR" "$DATA_DIR"
tar -xzf "${TMP_DIR}/composehub.tar.gz" -C "$RELEASE_DIR" --strip-components=1

cat > "${RELEASE_DIR}/.env" <<EOF
COMPOSEHUB_PORT=${WEB_PORT}
COMPOSEHUB_API_PORT=${API_PORT}
COMPOSEHUB_DATA_PATH=${DATA_DIR}
EOF

if [ -e "${INSTALL_HOME}/current" ] && [ ! -L "${INSTALL_HOME}/current" ]; then
  fail "${INSTALL_HOME}/current exists but is not an installer-managed symlink."
fi
if [ -L "${INSTALL_HOME}/current" ]; then
  if [ -f "${INSTALL_HOME}/current/docker-compose.yml" ]; then
    say "Stopping the currently installed version..."
    docker compose --project-directory "${INSTALL_HOME}/current" down --remove-orphans
  fi
  LEGACY_DATA_DIR="${INSTALL_HOME}/current/data"
  if [ -d "$LEGACY_DATA_DIR" ] && [ ! -f "${DATA_DIR}/composehub.db" ]; then
    say "Migrating data from the legacy installation layout..."
    cp -R "${LEGACY_DATA_DIR}/." "$DATA_DIR/"
  fi
  rm "${INSTALL_HOME}/current"
fi
ln -s "$RELEASE_DIR" "${INSTALL_HOME}/current"

say "Building and starting ComposeHub..."
docker compose --project-directory "${INSTALL_HOME}/current" up -d --build --remove-orphans

say "ComposeHub ${VERSION} is ready at http://localhost:${WEB_PORT}"
say "Data directory: ${DATA_DIR}"
say "Run this installer again to upgrade to the latest release."
