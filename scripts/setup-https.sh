#!/bin/bash
###############################################################################
# setup-https.sh — DuckDNS + Let's Encrypt + Nginx HTTPS for SuccessOS
#
# Run this ON the Oracle Cloud server (146.235.245.149) as root or with sudo.
#
# BEFORE RUNNING:
#   1. Go to https://www.duckdns.org, sign in (GitHub/Google/etc)
#   2. Create subdomain "successos" -> successos.duckdns.org
#   3. Set the IP to 146.235.245.149 (or leave blank to auto-detect)
#   4. Copy your DuckDNS token from the top of the page
#   5. Set it below or pass as env var: DUCKDNS_TOKEN=xxx ./setup-https.sh
#
# What this script does:
#   - Updates DuckDNS DNS record via API
#   - Installs certbot + DuckDNS DNS plugin
#   - Obtains Let's Encrypt certificate via DNS-01 challenge
#   - Installs nginx config with HTTPS
#   - Sets up auto-renewal cron + DuckDNS IP update cron
###############################################################################

set -euo pipefail

# ─── Configuration ───────────────────────────────────────────────────────────
DOMAIN="successos.duckdns.org"
SERVER_IP="146.235.245.149"
EMAIL="${LETSENCRYPT_EMAIL:-joaquin@successos.app}"  # change if needed
DUCKDNS_TOKEN="${DUCKDNS_TOKEN:?ERROR: Set DUCKDNS_TOKEN env var with your DuckDNS token}"

# ─── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# ─── Step 0: Check we're running as root ────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
    err "This script must be run as root (use sudo)"
fi

# ─── Step 1: Update DuckDNS record ──────────────────────────────────────────
log "Updating DuckDNS record: ${DOMAIN} -> ${SERVER_IP}"

DUCKDNS_RESPONSE=$(curl -s "https://www.duckdns.org/update?domains=successos&token=${DUCKDNS_TOKEN}&ip=${SERVER_IP}")

if [[ "$DUCKDNS_RESPONSE" == "OK" ]]; then
    log "DuckDNS updated successfully"
else
    err "DuckDNS update failed. Response: ${DUCKDNS_RESPONSE}. Check your token."
fi

# ─── Step 2: Install dependencies ───────────────────────────────────────────
log "Installing certbot and dependencies..."

apt-get update -qq
apt-get install -y -qq nginx python3 python3-pip python3-venv curl > /dev/null 2>&1

# Install certbot + DuckDNS plugin via pip (system-wide)
# The DNS plugin handles TXT record creation automatically during cert issuance
pip3 install certbot certbot-nginx certbot-dns-duckdns --break-system-packages 2>/dev/null \
    || pip3 install certbot certbot-nginx certbot-dns-duckdns

log "Certbot and DuckDNS plugin installed"

# ─── Step 3: Create DuckDNS credentials file ────────────────────────────────
CREDS_DIR="/etc/letsencrypt"
CREDS_FILE="${CREDS_DIR}/duckdns.ini"

mkdir -p "$CREDS_DIR"
cat > "$CREDS_FILE" <<EOF
dns_duckdns_token = ${DUCKDNS_TOKEN}
EOF
chmod 600 "$CREDS_FILE"

log "DuckDNS credentials saved to ${CREDS_FILE}"

# ─── Step 4: Obtain SSL certificate via DNS-01 challenge ────────────────────
log "Requesting Let's Encrypt certificate for ${DOMAIN}..."

# DNS-01 challenge: no need to open port 80 for validation.
# The plugin sets a TXT record on _acme-challenge.successos.duckdns.org
certbot certonly \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    --preferred-challenges dns \
    --authenticator dns-duckdns \
    --dns-duckdns-token "$DUCKDNS_TOKEN" \
    --dns-duckdns-propagation-seconds 120 \
    -d "$DOMAIN"

if [[ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]]; then
    log "SSL certificate obtained successfully!"
else
    err "Certificate files not found. Check /var/log/letsencrypt/letsencrypt.log"
fi

# ─── Step 5: Generate strong DH parameters (if not exists) ──────────────────
DH_PARAMS="/etc/ssl/dhparams.pem"
if [[ ! -f "$DH_PARAMS" ]]; then
    log "Generating DH parameters (this takes a minute)..."
    openssl dhparam -out "$DH_PARAMS" 2048
    log "DH parameters generated"
else
    log "DH parameters already exist, skipping"
fi

# ─── Step 6: Install nginx config ───────────────────────────────────────────
log "Installing nginx configuration..."

# Back up existing config
if [[ -f /etc/nginx/sites-available/successos ]]; then
    cp /etc/nginx/sites-available/successos /etc/nginx/sites-available/successos.bak.$(date +%s)
fi

# Copy the HTTPS config (should be alongside this script, or we generate it)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NGINX_CONF="${SCRIPT_DIR}/nginx-https.conf"

if [[ -f "$NGINX_CONF" ]]; then
    cp "$NGINX_CONF" /etc/nginx/sites-available/successos
else
    warn "nginx-https.conf not found next to this script. You must copy it manually."
    warn "Expected at: ${NGINX_CONF}"
fi

# Enable site, disable default
ln -sf /etc/nginx/sites-available/successos /etc/nginx/sites-enabled/successos
rm -f /etc/nginx/sites-enabled/default

# Test config
nginx -t || err "Nginx config test failed! Check /etc/nginx/sites-available/successos"

# Reload
systemctl reload nginx
log "Nginx reloaded with HTTPS config"

# ─── Step 7: Set up auto-renewal cron ───────────────────────────────────────
log "Setting up auto-renewal..."

# Certbot renewal runs twice daily, reloads nginx after success
CRON_RENEWAL="0 3,15 * * * certbot renew --quiet --deploy-hook 'systemctl reload nginx'"
CRON_DUCKDNS="*/30 * * * * curl -s 'https://www.duckdns.org/update?domains=successos&token=${DUCKDNS_TOKEN}&ip=' > /dev/null 2>&1"

# Write cron jobs (replace existing successos-related crons)
(crontab -l 2>/dev/null | grep -v 'certbot renew' | grep -v 'duckdns.org/update') | crontab -
(crontab -l 2>/dev/null; echo "$CRON_RENEWAL"; echo "$CRON_DUCKDNS") | crontab -

log "Cron jobs installed:"
echo "    - Certbot renewal: twice daily at 3:00 and 15:00"
echo "    - DuckDNS IP update: every 30 minutes"

# ─── Step 8: Open firewall ports ────────────────────────────────────────────
log "Ensuring firewall allows HTTPS..."

# iptables (Oracle Cloud Ubuntu default)
iptables -C INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null \
    || iptables -I INPUT -p tcp --dport 443 -j ACCEPT

iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null \
    || iptables -I INPUT -p tcp --dport 80 -j ACCEPT

# Persist iptables rules
if command -v netfilter-persistent &> /dev/null; then
    netfilter-persistent save
else
    warn "Install iptables-persistent to save firewall rules across reboots:"
    warn "  apt-get install -y iptables-persistent"
fi

log "Firewall ports 80 and 443 open"

# ─── Step 9: Verify ─────────────────────────────────────────────────────────
echo ""
echo "============================================"
log "HTTPS setup complete!"
echo "============================================"
echo ""
echo "  Domain:  https://${DOMAIN}"
echo "  Cert:    /etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
echo "  Key:     /etc/letsencrypt/live/${DOMAIN}/privkey.pem"
echo ""
echo "  Test with: curl -I https://${DOMAIN}"
echo ""
echo "  IMPORTANT — Oracle Cloud Network Security:"
echo "  Make sure your VCN Security List / NSG allows TCP 443 and 80 ingress."
echo "  Go to: Oracle Cloud Console > Networking > Virtual Cloud Networks"
echo "  > Your VCN > Security Lists > Add Ingress Rules for 443 and 80"
echo ""
echo "============================================"
