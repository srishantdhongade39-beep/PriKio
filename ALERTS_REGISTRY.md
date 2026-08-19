# CampusPrint - Alerts Registry

This document serves as the master registry of all automated alerts that the CampusPrint kiosk network can trigger. These alerts are pushed from the physical Raspberry Pi endpoints to the Supabase backend and are instantly displayed on the Admin Dashboard.

---

## 1. Consumable Alerts
Alerts related to physical supplies requiring technician intervention.

* **`low_ink`**
  * **Trigger:** Kiosk reports ink levels have dropped below 10%.
  * **Action Required:** Schedule a toner/cartridge replacement.
* **`out_of_paper`**
  * **Trigger:** Kiosk's internal laser sensors report the paper tray has dropped below 10% capacity.
  * **Action Required:** Dispatch technician to refill the tray immediately to prevent pending jobs from stalling.

## 2. Hardware & Connectivity Faults
Alerts indicating a critical failure in the machine's ability to operate.

* **`offline`**
  * **Trigger:** Kiosk explicitly reports it is entering offline or maintenance mode, or misses its scheduled heartbeat.
  * **Action Required:** Investigate power or network issues at the kiosk location.
* **`printer_jam`**
  * **Trigger:** The background `lpstat` thread detects the physical printer has stopped mid-job due to a mechanical jam.
  * **Automated Action:** Kiosk marks itself "Out of Order" on the live map and automatically issues refunds to the active user.
* **`tablet_offline`**
  * **Trigger:** The 16-inch capacitive touch display loses power or the frontend browser crashes (misses its frontend-specific heartbeat), but the Raspberry Pi backend is still alive.
  * **Action Required:** Restart the kiosk's display application or check the physical HDMI/USB connections to the tablet.

## 3. Security & Vandalism
Alerts related to potential malicious activity or tampering.

* **`usb_disconnect`**
  * **Trigger:** The Raspberry Pi's `udev` rules detect that the authorized printer USB cable has been unplugged. (Mitigation against the "USB Rubber Ducky" attack).
  * **Automated Action:** Pi locks down USB ports and refuses further local connections until reset by an admin.
* **`power_cycle_triggered`**
  * **Trigger:** A maliciously complex PDF (or genuine glitch) causes a printer "brain freeze", forcing the Raspberry Pi to use the Smart Plug to cut physical power and force a reboot.
  * **Action Required:** Monitor the kiosk to ensure it successfully reconnects to the network after the forced reboot.
