import os
import time
import logging
import threading
import platform
import subprocess
import asyncio
from dotenv import load_dotenv
from supabase import create_client, Client, acreate_client
from printer import print_job

load_dotenv()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
KIOSK_ID = os.getenv("KIOSK_ID", "LIB-04")

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.error("SUPABASE_URL and SUPABASE_KEY are required in .env")
    exit(1)

# We keep the sync client for normal DB operations (like updates and storage)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def check_lte_connection():
    """Simulates checking the Hologram/Twilio IoT Cellular Modem"""
    logger.info("📶 Checking LTE Cellular Modem status... Connection Secure.")

def simulate_smart_plug_reboot():
    """Simulates sending a physical power cycle command to a Smart Plug"""
    logger.critical("🔌 Printer frozen for >5 mins. Triggering Smart Plug hard reboot...")
    time.sleep(2)
    logger.info("🔌 Smart Plug reboot complete. Printer restarting...")

from datetime import datetime, timezone
from printer import print_job, get_printer_capabilities

_CAPABILITIES_SUPPORTED = None

def send_telemetry(is_online=True, ink_percent=100, paper_percent=100):
    global _CAPABILITIES_SUPPORTED
    try:
        now_iso = datetime.now(timezone.utc).isoformat()
        caps = get_printer_capabilities()
        payload = {
            "is_online": is_online,
            "ink_level_percent": ink_percent,
            "paper_level_percent": paper_percent,
            "last_ping": now_iso
        }
        if _CAPABILITIES_SUPPORTED is not False:
            try:
                supabase.table("kiosks").update({
                    **payload,
                    "capabilities": {
                        "supports_duplex": caps.get("supports_duplex", False),
                        "supports_color": caps.get("supports_color", True),
                        "supports_a4": caps.get("supports_a4", True)
                    }
                }).eq("id", KIOSK_ID).execute()
                _CAPABILITIES_SUPPORTED = True
                return
            except Exception:
                _CAPABILITIES_SUPPORTED = False

        supabase.table("kiosks").update(payload).eq("id", KIOSK_ID).execute()
    except Exception as e:
        logger.error(f"Failed to send telemetry: {e}")

def push_notification(alert_type, message):
    try:
        supabase.table("notifications").insert({
            "kiosk_id": KIOSK_ID,
            "type": alert_type,
            "message": message
        }).execute()
    except Exception as e:
        logger.error(f"Failed to push notification: {e}")

def poll_printer():
    printer_name = os.getenv("PRINTER_NAME", "test_printer")
    logger.info(f"Started hardware monitoring for kiosk: {KIOSK_ID}, printer: {printer_name}")
    
    frozen_counter = 0
    last_telemetry_time = 0
    
    while True:
        try:
            current_time = time.time()
            # Send heartbeat every 60 seconds
            if current_time - last_telemetry_time > 60:
                send_telemetry(is_online=True)
                last_telemetry_time = current_time

            if platform.system() == "Windows":
                # We can't poll lpstat on Windows, so just heartbeat and sleep
                time.sleep(10)
                continue

            result = subprocess.run(["lpstat", "-p", printer_name], capture_output=True, text=True)
            output = result.stdout.lower()
            
            if "paused" in output or "error" in output or "jam" in output:
                logger.error(f"Printer error detected: {output.strip()}")
                push_notification("hardware_error", f"Printer reported an error or is paused: {output.strip()}")
                frozen_counter = 0
                time.sleep(60) # Wait before spamming
            elif "now printing" in output or "active" in output:
                frozen_counter += 5
                if frozen_counter >= 300:
                    push_notification("hardware_error", "Printer frozen for 5 minutes. Triggering reboot.")
                    simulate_smart_plug_reboot()
                    frozen_counter = 0
                    time.sleep(60)
                else:
                    time.sleep(5)
            else:
                frozen_counter = 0
                time.sleep(5)
        except Exception as e:
            logger.error(f"Polling error: {str(e)}")
            send_telemetry(is_online=False)
            time.sleep(10)

def handle_job_update(payload):
    record = payload.get("data", {}).get("record", {})
    job_id = record.get("id")
    status = record.get("status")
    
    if status == "printing":
        logger.info(f"Received job update: {job_id} -> {status}")
        logger.info(f"Job verified, starting print for: {job_id}")
        
        files = record.get("files", [])
        
        # Realtime sometimes delivers JSONB arrays as strings depending on the library version
        if isinstance(files, str):
            import json
            try:
                files = json.loads(files)
            except Exception as e:
                logger.error(f"Error parsing files JSON: {e}")
                files = []

        if files:
            all_succeeded = True
            failed_filenames = []
            for file_info in files:
                fname = file_info.get("filename", "unknown")
                # We pass the full file_info dict to print_job so it can read settings
                success = print_job(job_id, file_info, supabase)
                if not success:
                    all_succeeded = False
                    failed_filenames.append(fname)
                
            try:
                # Use sync client for DB updates
                final_status = "completed" if all_succeeded else "failed"
                supabase.table("print_jobs").update({"status": final_status}).eq("id", job_id).execute()
                if not all_succeeded:
                    reason = f"Print job {job_id} failed for: {', '.join(failed_filenames)}"
                    push_notification("hardware_error", reason)
                    logger.error(f"Hardware spool failed: {reason}")
                else:
                    logger.info(f"Marked job {job_id} as completed in Supabase.")
            except Exception as e:
                logger.error(f"Failed to update job status: {e}")
        else:
            logger.error(f"Job {job_id} has no files in record! Marking as failed.")
            try:
                supabase.table("print_jobs").update({"status": "failed"}).eq("id", job_id).execute()
                push_notification("hardware_error", f"Print job {job_id} failed: No files found in record.")
            except Exception as e:
                logger.error(f"Failed to update empty job status: {e}")

async def listen_to_supabase():
    logger.info("Connecting to Supabase Realtime...")
    try:
        # Create an async client strictly for realtime subscriptions
        async_client = await acreate_client(SUPABASE_URL, SUPABASE_KEY)
        
        channel = async_client.channel('public:print_jobs')
        channel.on_postgres_changes(
            event="UPDATE",
            schema="public",
            table="print_jobs",
            callback=handle_job_update
        )
        
        await channel.subscribe()
        logger.info("Subscribed to print_jobs updates!")
        
        # Keep the event loop running
        while True:
            await asyncio.sleep(1)
            
    except Exception as e:
        logger.error(f"Realtime connection error: {e}")

if __name__ == "__main__":
    logger.info("Starting PrintFlow Pi Controller (Supabase Edition)...")
    check_lte_connection()
    
    t = threading.Thread(target=poll_printer, daemon=True)
    t.start()
    
    while True:
        try:
            asyncio.run(listen_to_supabase())
        except Exception as e:
            logger.error(f"Connection failed: {e}")
        logger.info("Reconnecting in 5 seconds...")
        time.sleep(5)
