# CampusPrint - Edge Cases & Solutions Report

This document serves as a persistent record of critical edge cases, hardware vulnerabilities, and architectural constraints discovered during the development of the CampusPrint kiosk network, along with their robust production-grade solutions.

---

## 1. Hardware & Physical Failures

### 1.1 Sudden Power Outages & Data Loss
* **Problem:** Sudden power loss corrupts Raspberry Pi SD cards and leaves the printer mechanically jammed if a print is actively feeding.
* **Solution:** Upgrade the Pi boot drive to an SSD. Utilize CUPS spooling so jobs are safely written to disk. On reboot, the Pi emits a `system:boot` WebSocket event to the server to instantly clear the queue (preventing abandoned jobs from printing later) and refund the student automatically.

### 1.2 Physical Printer Jams & Silent Failures
* **Problem:** The printer jams, runs out of ink, or gets stuck. Standard `lp` commands silently fail because they only check if the queue accepted the job, not if the paper came out.
* **Solution:** Implement **Bi-Directional Polling**. A background thread runs `lpstat` every 5 seconds. If it detects a fault, it fires a `printer_error` WebSocket message to the backend. The backend marks the kiosk "Out of Order" on the live map and instantly refunds the user's wallet with a notification.

### 1.3 The "Empty Tray" Silent Failure
* **Problem:** The printer runs out of paper, but holds the job in a "Pending" state rather than throwing a hard error. Students enter their OTP, but nothing prints.
* **Solution:** Implement **SNMP (Simple Network Management Protocol)** in the Python script to communicate directly with the printer's internal laser sensors. The kiosk monitors exactly how much paper is left and marks itself "Out of Paper" before a student even attempts to upload.

### 1.4 The Printer "Brain Freeze"
* **Problem:** A highly complex CAD drawing overloads the printer's internal CPU. It refuses to print and refuses new jobs.
* **Solution:** Connect the printer to a **Smart Plug**. If the Raspberry Pi detects the printer has been stuck on a single job for >5 minutes, it sends a signal to physically cut power to the plug, waits 10 seconds, and restores power to forcefully reboot the printer motherboard.

### 1.5 The "Smashed Screen" Scenario (Vandalism)
* **Problem:** The tablet/touchscreen on top of the printer is physically broken, preventing users from entering their OTPs.
* **Solution:** **Headless Failsafe.** A static QR code is permanently pasted on the physical machine. Users can scan it with their phone, the web app verifies their GPS location (Geofencing) to ensure they are standing next to the printer, and allows them to trigger the print job directly from their own phone screen.

---

## 2. Security & Exploit Prevention

### 2.1 The "Pure Black" Exploit (Financial Drain)
* **Problem:** A user uploads a 50-page PDF of solid black boxes. They pay ₹100, but completely drain a ₹3,000 toner cartridge.
* **Solution:** **Ink Density Scanner.** Use `Ghostscript` during the backend upload phase to calculate average ink coverage. If it exceeds 70%, the backend instantly rejects the file or applies a premium "Heavy Ink" surcharge.

### 2.2 The ASCII Garbage Attack
* **Problem:** A student renames a binary `.mp4` file to `.pdf` and bypasses basic validation. The printer misinterprets the binary code and prints hundreds of pages of raw ASCII gibberish, wasting an entire tray of paper.
* **Solution:** Use `pdf2image` during upload to attempt to render the first page into an invisible buffer. If the rendering engine crashes, the file is confirmed as fake/corrupted and is rejected.

### 2.3 The "Infinite Page Scaling" Attack (The PDF Bomb)
* **Problem:** A student uploads a 1-page PDF (paying only ₹2), but modifies the metadata so the physical dimensions are 1,000,000 x 1,000,000 inches. The printer's Raster Image Processor (RIP) exhausts all RAM trying to scale it, bricking the hardware.
* **Solution:** **Bounding Box Constraint.** Use `PyMuPDF` to mathematically measure the physical dimensions of the uploaded PDF. If it deviates from standard A4/Letter size by >5%, reject the file.

### 2.4 The "USB Rubber Ducky" Attack (Hardware Hacking)
* **Problem:** A student unplugs the printer's USB cable and plugs in a malicious flash drive to run scripts or print for free.
* **Solution:** Physically encase the Pi and printer ports in a locked steel box. Configure `udev` rules on the Linux OS to instantly disable all USB ports if an unauthorized device is plugged in, and lock the printer firmware to only accept jobs from the Pi's specific MAC address.

### 2.5 The "Refund Abuse" Loop
* **Problem:** A student starts a print, pulls the wall plug to trigger the "Power Outage Refund" system, and then plugs it back in. The printer's onboard RAM resumes and finishes the print for free.
* **Solution:** **Hardware Memory Wipe.** When the Pi boots, the very first USB command it issues is a hardware interrupt that flushes the printer's internal RAM, guaranteeing abandoned jobs are destroyed before refunds process.

---

## 3. Software, Network & Concurrency

### 3.1 The Wi-Fi "Captive Portal" Death
* **Problem:** The college Wi-Fi requires users to click "I Agree" on a captive portal every 24 hours. The kiosk has no way to click it, so it drops offline permanently.
* **Solution:** Bypass college Wi-Fi entirely. Equip every kiosk with a **4G LTE IoT Cellular Modem** (e.g., Twilio/Hologram SIM) for a dedicated, unblockable connection.

### 3.2 Payment Network Glitches (Lost OTPs)
* **Problem:** The user pays via UPI, but their phone drops network the exact millisecond the payment completes. They never see their 6-digit OTP to unlock the printer.
* **Solution:** 
  1. **Server Webhooks:** Rely on Razorpay server-side webhooks to confirm payment, not the client browser.
  2. **Session Recovery:** When the user refreshes, the app polls the backend session state and restores the OTP screen.
  3. **SMS Fallback:** Automatically dispatch the OTP via SMS the moment payment is captured.

### 3.3 The Queue Collision (Concurrency)
* **Problem:** Student A enters an OTP for a 100-page document. Ten seconds later, Student B enters their OTP. The printer interleaves their pages.
* **Solution:** **Hardware Lock.** When an OTP is entered, the Pi checks `lpstat`. If a job is actively printing, the Pi holds Student B's job in a local "Pending" queue and the UI displays: *"Printer is currently busy. Your document will start in approx. X minutes."*

### 3.4 The Abandoned OTP (Storage Bloat)
* **Problem:** A student pays from their dorm but never walks to the printer. Their PDF sits on the AWS/Supabase servers forever, bloating storage costs.
* **Solution:** Implement a **24-Hour TTL (Time-To-Live) Cron Job**. If an OTP is unused for 24 hours, automatically delete the PDF from storage and refund the student (or expire the code).

### 3.5 The "iPad Unplugged" Problem
* **Problem:** The tablet screen loses power or Wi-Fi. The physical printer is fine, but the kiosk is unusable.
* **Solution:** **Frontend Heartbeat.** The `/kiosk` webpage silently pings the backend every 60 seconds. If a ping is missed for >5 minutes, the backend automatically removes the kiosk from the live map so students don't waste time walking to it.

---

## 4. Architecture & Formatting Constraints

### 4.1 Double-Sided Printing with Multiple Files
* **Problem:** Uploading multiple single-page PDFs and selecting "Double-Sided" causes the printer to print them on separate sheets.
* **Solution:** Use `pdf-lib` to merge the separate PDFs into a single master PDF *before* sending it to the printer queue.

### 4.2 Server-Side Document Conversion (Vercel Constraints)
* **Problem:** We cannot natively preview `.docx`/`.xlsx` files, and we cannot install LibreOffice on Vercel/Supabase Edge functions due to serverless constraints.
* **Solution:** Either restrict uploads to PDF/Images, or utilize an external Cloud API (like CloudConvert) triggered via Supabase Webhooks to convert Office files to PDF off-server.
### 4.3 Password-Protected Documents
* **Problem:** Encrypted PDFs will crash the hardware print spooler.
* **Solution:** Use `pypdf` during backend upload validation to detect encryption metadata. Instantly reject with an HTTP 400 error before the user reaches the payment phase.

### 4.4 URL Encoding & Filename Sanitation Mismatch
* **Problem:** If a user uploads a file with spaces or special characters (e.g. `final ppt (1).pdf`), and the frontend manually reconstructs the storage path using the un-sanitized filename, the Raspberry Pi printer script will receive a 400 Bad Request / 404 Not Found error when trying to download the file from Supabase via an unencoded URL path.
* **Solution:** Generate a `safeFileName` (replacing non-alphanumeric characters with underscores) during the initial upload initialization. Pass this sanitized `storagePath` back to the frontend and ensure all subsequent database inserts (like the `print_jobs` table) strictly use this sanitized path rather than re-constructing it from the original filename.
