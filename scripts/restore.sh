#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/successos}"
cd "$APP_DIR"

if [[ -f "$APP_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$APP_DIR/.env"
  set +a
fi

DB_PATH="${DB_PATH:-./data/successos.db}"
SERVICE_NAME="${BACKUP_SERVICE_NAME:-successos.service}"

usage() {
  cat <<EOF
Uso:
  ./scripts/restore.sh /ruta/al/backup.tar.gz [--target-db /ruta/db.sqlite] [--force]

Notas:
  - Si restauras sobre la base productiva, el servicio debe estar detenido.
  - El backup debe haber sido generado por scripts/backup.sh.
EOF
}

ARCHIVE_PATH="${1:-}"
shift || true

TARGET_DB=""
FORCE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target-db)
      TARGET_DB="${2:-}"
      shift 2
      ;;
    --force)
      FORCE=true
      shift
      ;;
    *)
      echo "Argumento desconocido: $1" >&2
      usage
      exit 1
      ;;
  esac
done

[[ -n "$ARCHIVE_PATH" ]] || {
  usage
  exit 1
}

[[ -f "$ARCHIVE_PATH" ]] || {
  echo "No existe el archivo: $ARCHIVE_PATH" >&2
  exit 1
}

TARGET_DB="${TARGET_DB:-$DB_PATH}"

TARGET_DB_ABS="$(python3 - <<'PY' "$APP_DIR" "$TARGET_DB"
import os, sys
app_dir, db_path = sys.argv[1], sys.argv[2]
print(os.path.abspath(db_path if os.path.isabs(db_path) else os.path.join(app_dir, db_path)))
PY
)"

if [[ "$FORCE" != true ]] && systemctl is-active --quiet "$SERVICE_NAME" && [[ "$TARGET_DB_ABS" == *"/successos.db" ]]; then
  echo "El servicio $SERVICE_NAME sigue activo. Detenelo antes de restaurar sobre la base productiva." >&2
  exit 1
fi

STAGING_DIR="$(mktemp -d)"
trap 'rm -rf "$STAGING_DIR"' EXIT

tar -C "$STAGING_DIR" -xzf "$ARCHIVE_PATH"

[[ -f "$STAGING_DIR/successos.db" ]] || {
  echo "El backup no contiene successos.db" >&2
  exit 1
}

INTEGRITY_RESULT="$(sqlite3 "$STAGING_DIR/successos.db" 'pragma integrity_check;' | tr -d '\r')"
[[ "$INTEGRITY_RESULT" == "ok" ]] || {
  echo "Integrity check falló: $INTEGRITY_RESULT" >&2
  exit 1
}

mkdir -p "$(dirname "$TARGET_DB_ABS")"
cp "$STAGING_DIR/successos.db" "$TARGET_DB_ABS"

echo "Restore completado en: $TARGET_DB_ABS"
