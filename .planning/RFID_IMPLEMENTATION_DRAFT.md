# RFID Implementation Plan & Security Analysis (Draft)

## Overview
This document outlines the planned approach for implementing an RFID-based authentication system for the CampusPrint Kiosk, along with associated security concerns and proposed mitigations. The goal is to allow students to access their cloud documents directly from the Kiosk using their university ID cards.

## Technical Approach: Global Keystroke Listener
Most off-the-shelf USB RFID readers act as **keystroke emulators** (HIDs). When a card is tapped:
1. The reader wirelessly scans the UID (e.g., 10-digit student ID).
2. It rapidly "types" these digits into the computer as if a real keyboard were being used.
3. It finishes by simulating an "Enter" keypress.

### Proposed Implementation Steps
1. **`useRFIDListener` Hook:** Create a custom React hook to listen for `keydown` events in the background, specifically looking for rapid number sequences followed by an "Enter" key (ignoring input if a user is actively typing in a text field).
2. **Kiosk UI Integration:** Attach this listener to the Kiosk's idle/welcome screen. Upon a successful tap, immediately transition the UI to a "Loading your cloud documents..." state.
3. **API Integration (`/api/kiosk/cloud-docs`):** Build a backend endpoint that accepts the captured `student_id`, looks up the user's profile, and fetches their associated cloud documents (e.g., via Google Drive/OneDrive API or mocked Supabase storage).
4. **Cloud Documents UI:** Display a grid of the fetched documents allowing the user to select files and proceed to print settings.

## Security Issues & Vulnerabilities
Treating the RFID reader as a keyboard emulator introduces several critical security risks:

1. **Trivial Card Cloning (No Cryptographic Authentication)**
   - *Risk:* Basic 125kHz or MIFARE cards transmit static, unencrypted UIDs. Anyone can clone a card or skim it from a distance. The Kiosk only requires this 10-digit number, granting full access to a victim's cloud drive.
2. **"Walk-Away" Session Hijacking**
   - *Risk:* If a student forgets to log out and walks away, the next person in line has full access to their private documents and wallet balance until the inactivity timeout (60s) expires.
3. **Keystroke Injection (Rubber Ducky Attacks)**
   - *Risk:* Since the system relies on a generic global keystroke listener, a malicious actor could plug in a USB Rubber Ducky or Bluetooth keyboard and rapidly inject thousands of IDs to brute-force logins or explicitly target a known victim.
4. **Excessive Cloud Privileges (OAuth Token Risk)**
   - *Risk:* The Kiosk backend must hold highly privileged OAuth Refresh Tokens to access a student's entire cloud drive. A backend compromise would expose all students' private files.
5. **Lack of Intent Verification (2FA)**
   - *Risk:* A single tap does not prove the cardholder's intent or verify their actual identity.

## Proposed Security Mitigations
To maintain the convenience of an RFID tap while securing the system, the following mitigations should be considered before final implementation:

1. **RFID + PIN Code (2FA):** Require a 4-digit PIN after the RFID tap. This completely defeats card cloning and keystroke injection attacks.
2. **Dynamic Scoped Access (Pre-Queuing):** Instead of pulling the entire cloud drive, require students to queue specific documents via their personal phone/web dashboard first. The RFID tap only unlocks the pre-queued print jobs, limiting exposure.
3. **Hardware Lockout:** Restrict the Kiosk operating system (e.g., via Linux `udev` rules on the Raspberry Pi) to only accept input from the specific Vendor ID/Product ID of the official RFID reader, blocking unauthorized keyboards.
