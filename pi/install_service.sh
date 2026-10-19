#!/bin/bash
set -e

echo "=========================================="
echo " PriKIO Raspberry Pi 5 Service Installer  "
echo "=========================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CURRENT_USER="$(whoami)"

echo "[1/5] Checking system packages (CUPS, Python venv)..."
sudo apt-get update -y
sudo apt-get install -y cups cups-client python3-venv python3-pip

echo "[2/5] Setting up Python virtual environment..."
cd "$SCRIPT_DIR"

if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "Virtual environment created."
fi

# Activate venv and install dependencies
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

echo "[3/5] Checking .env configuration..."
if [ ! -f ".env" ]; then
    echo "ERROR: .env file missing in $SCRIPT_DIR!"
    echo "Please create $SCRIPT_DIR/.env with SUPABASE_URL, SUPABASE_KEY, and PRINTER_NAME."
    exit 1
fi

echo "[4/5] Creating systemd service file..."
SERVICE_FILE="/etc/systemd/system/prikio.service"

sudo bash -c "cat <<EOF > $SERVICE_FILE
[Unit]
Description=PriKIO Kiosk Controller & Printer Listener
After=network.target cups.service
Wants=network.target

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$SCRIPT_DIR
ExecStart=$SCRIPT_DIR/venv/bin/python $SCRIPT_DIR/main.py
Restart=always
RestartSec=5
EnvironmentFile=$SCRIPT_DIR/.env
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF"

echo "Service file written to $SERVICE_FILE"

echo "[5/5] Enabling and starting prikio.service..."
sudo systemctl daemon-reload
sudo systemctl enable prikio.service
sudo systemctl restart prikio.service

echo ""
echo "=========================================="
echo " SUCCESS! PriKIO service is now running!  "
echo "=========================================="
echo ""
echo "Useful commands:"
echo "  Check status:      sudo systemctl status prikio"
echo "  View live logs:    journalctl -u prikio -f"
echo "  Restart service:   sudo systemctl restart prikio"
echo "  Stop service:      sudo systemctl stop prikio"
echo ""
