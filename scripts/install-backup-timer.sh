#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/successos}"
SERVICE_FILE="$APP_DIR/scripts/successos-backup.service"
TIMER_FILE="$APP_DIR/scripts/successos-backup.timer"

sudo cp "$SERVICE_FILE" /etc/systemd/system/successos-backup.service
sudo cp "$TIMER_FILE" /etc/systemd/system/successos-backup.timer
sudo systemctl daemon-reload
sudo systemctl enable --now successos-backup.timer
sudo systemctl start successos-backup.service
sudo systemctl status successos-backup.timer --no-pager
