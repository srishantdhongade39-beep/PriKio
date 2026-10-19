#!/bin/bash
set -e

echo "Stopping and disabling prikio.service..."
sudo systemctl stop prikio.service || true
sudo systemctl disable prikio.service || true

if [ -f "/etc/systemd/system/prikio.service" ]; then
    sudo rm /etc/systemd/system/prikio.service
    echo "Removed /etc/systemd/system/prikio.service"
fi

sudo systemctl daemon-reload
echo "PriKIO service has been completely uninstalled."
