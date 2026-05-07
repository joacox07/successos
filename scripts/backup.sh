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

TIMEZONE="${TIMEZONE:-America/Buenos_Aires}"
DB_PATH="${DB_PATH:-./data/successos.db}"
BACKUP_ROOT="${BACKUP_ROOT:-/home/ubuntu/backups/successos}"
BACKUP_STATUS_FILE="${BACKUP_STATUS_FILE:-$BACKUP_ROOT/latest.json}"
BACKUP_REMOTE_MODE="${BACKUP_REMOTE_MODE:-none}"
BACKUP_RCLONE_REMOTE="${BACKUP_RCLONE_REMOTE:-}"
BACKUP_RCLONE_PREFIX="${BACKUP_RCLONE_PREFIX:-prod}"
BACKUP_S3_BUCKET="${BACKUP_S3_BUCKET:-}"
BACKUP_S3_PREFIX="${BACKUP_S3_PREFIX:-prod}"
BACKUP_LOCAL_DAILY_RETENTION="${BACKUP_LOCAL_DAILY_RETENTION:-7}"
BACKUP_LOCAL_WEEKLY_RETENTION="${BACKUP_LOCAL_WEEKLY_RETENTION:-4}"
SERVICE_NAME="${BACKUP_SERVICE_NAME:-successos.service}"

log() {
  printf '[backup] %s\n' "$*"
}

json_escape() {
  printf '%s' "$1" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))'
}

write_status() {
  local success="$1"
  local message="$2"
  local archive_path="${3:-}"
  local checksum="${4:-}"
  local remote_path="${5:-}"
  local uploaded="${6:-false}"
  local ts_utc
  ts_utc="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

  mkdir -p "$(dirname "$BACKUP_STATUS_FILE")"
  cat >"$BACKUP_STATUS_FILE" <<EOF
{
  "success": ${success},
  "message": $(json_escape "$message"),
  "timestampUtc": $(json_escape "$ts_utc"),
  "service": $(json_escape "$SERVICE_NAME"),
  "dbPath": $(json_escape "$DB_PATH"),
  "archivePath": $(json_escape "$archive_path"),
  "checksum": $(json_escape "$checksum"),
  "remoteMode": $(json_escape "$BACKUP_REMOTE_MODE"),
  "remotePath": $(json_escape "$remote_path"),
  "remoteUploaded": ${uploaded}
}
EOF
}

cleanup_old_archives() {
  local dir="$1"
  local keep="$2"
  [[ -d "$dir" ]] || return 0

  mapfile -t archives < <(find "$dir" -type f -name 'successos-*.tar.gz' | sort -r)
  if (( ${#archives[@]} <= keep )); then
    return 0
  fi

  for archive in "${archives[@]:keep}"; do
    rm -f -- "$archive" "${archive}.sha256"
  done
}

upload_remote() {
  local archive_path="$1"
  local checksum_path="$2"
  local remote_dir="$3"

  case "$BACKUP_REMOTE_MODE" in
    none|'')
      return 0
      ;;
    rclone)
      command -v rclone >/dev/null 2>&1 || {
        log "rclone no instalado; se omite upload remoto"
        return 0
      }
      [[ -n "$BACKUP_RCLONE_REMOTE" ]] || {
        log "BACKUP_RCLONE_REMOTE vacio; se omite upload remoto"
        return 0
      }
      rclone copyto "$archive_path" "${BACKUP_RCLONE_REMOTE}:${remote_dir}/$(basename "$archive_path")"
      rclone copyto "$checksum_path" "${BACKUP_RCLONE_REMOTE}:${remote_dir}/$(basename "$checksum_path")"
      ;;
    aws)
      command -v aws >/dev/null 2>&1 || {
        log "aws cli no instalado; se omite upload remoto"
        return 0
      }
      [[ -n "$BACKUP_S3_BUCKET" ]] || {
        log "BACKUP_S3_BUCKET vacio; se omite upload remoto"
        return 0
      }
      aws s3 cp "$archive_path" "s3://${BACKUP_S3_BUCKET}/${remote_dir}/$(basename "$archive_path")"
      aws s3 cp "$checksum_path" "s3://${BACKUP_S3_BUCKET}/${remote_dir}/$(basename "$checksum_path")"
      ;;
    *)
      log "modo remoto desconocido: $BACKUP_REMOTE_MODE"
      return 0
      ;;
  esac
}

main() {
  local db_abs
  db_abs="$(python3 - <<'PY' "$APP_DIR" "$DB_PATH"
import os, sys
app_dir, db_path = sys.argv[1], sys.argv[2]
print(os.path.abspath(db_path if os.path.isabs(db_path) else os.path.join(app_dir, db_path)))
PY
)"

  [[ -f "$db_abs" ]] || {
    write_status false "No se encontro la base de datos" "" "" "" false
    echo "Base no encontrada: $db_abs" >&2
    exit 1
  }

  local timestamp_utc timestamp_local year_month daily_dir weekly_dir staging_dir snapshot_path metadata_path archive_path checksum_path
  timestamp_utc="$(date -u +"%Y%m%dT%H%M%SZ")"
  timestamp_local="$(TZ="$TIMEZONE" date +"%Y-%m-%d %H:%M:%S %Z")"
  year_month="$(date -u +"%Y/%m")"
  daily_dir="$BACKUP_ROOT/daily/$year_month"
  weekly_dir="$BACKUP_ROOT/weekly"
  staging_dir="$(mktemp -d)"
  snapshot_path="$staging_dir/successos.db"
  metadata_path="$staging_dir/metadata.json"

  mkdir -p "$daily_dir" "$weekly_dir"

  log "Generando snapshot consistente de SQLite"
  sqlite3 "$db_abs" ".backup '$snapshot_path'"

  local row_count sha256 size_bytes weekday remote_dir remote_path uploaded
  row_count="$(sqlite3 "$snapshot_path" 'select count(*) from sqlite_master;' || echo 0)"
  sha256="$(sha256sum "$snapshot_path" | awk '{print $1}')"
  size_bytes="$(stat -c%s "$snapshot_path")"
  weekday="$(TZ="$TIMEZONE" date +%u)"
  remote_dir=""
  remote_path=""
  uploaded=false

  cat >"$metadata_path" <<EOF
{
  "timestampUtc": $(json_escape "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"),
  "timestampLocal": $(json_escape "$timestamp_local"),
  "hostname": $(json_escape "$(hostname)"),
  "service": $(json_escape "$SERVICE_NAME"),
  "dbPath": $(json_escape "$db_abs"),
  "snapshotSha256": $(json_escape "$sha256"),
  "snapshotSizeBytes": $size_bytes,
  "sqliteObjects": $row_count
}
EOF

  archive_path="$daily_dir/successos-$timestamp_utc.tar.gz"
  checksum_path="${archive_path}.sha256"

  tar -C "$staging_dir" -czf "$archive_path" successos.db metadata.json
  sha256sum "$archive_path" > "$checksum_path"

  if [[ "$weekday" == "7" ]]; then
    cp "$archive_path" "$weekly_dir/$(basename "$archive_path")"
    cp "$checksum_path" "$weekly_dir/$(basename "$checksum_path")"
  fi

  cleanup_old_archives "$BACKUP_ROOT/daily" "$BACKUP_LOCAL_DAILY_RETENTION"
  cleanup_old_archives "$BACKUP_ROOT/weekly" "$BACKUP_LOCAL_WEEKLY_RETENTION"

  case "$BACKUP_REMOTE_MODE" in
    rclone)
      remote_dir="${BACKUP_RCLONE_PREFIX%/}/daily/$year_month"
      ;;
    aws)
      remote_dir="${BACKUP_S3_PREFIX%/}/daily/$year_month"
      ;;
  esac

  if [[ -n "$remote_dir" ]]; then
    upload_remote "$archive_path" "$checksum_path" "$remote_dir"
    remote_path="$remote_dir/$(basename "$archive_path")"
    uploaded=true
  fi

  write_status true "Backup completado" "$archive_path" "$(cut -d' ' -f1 "$checksum_path")" "$remote_path" "$uploaded"
  rm -rf "$staging_dir"
  log "Backup completado: $archive_path"
}

trap 'write_status false "Backup fallido" "" "" "" false' ERR

main "$@"
