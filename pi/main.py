import os
import time
import logging
import threading
import platform
import subprocess
import asyncio
import socket
import json
from datetime import datetime, timezone
from dotenv import load_dotenv
from supabase import create_client, Client, acreate_client
from printer import print_job, get_printer_capabilities

load_dotenv()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
KIOSK_ID = os.getenv("KIOSK_ID", "LIB-04")
MAX_JOB_AGE_SECONDS = int(os.getenv("MAX_JOB_AGE_SECONDS", "300"))  # 5 minutes staleness TTL

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.error("SUPABASE_URL and SUPABASE_KEY are required in .env")
    exit(1)

# Database client for synchronous DB operations & storage
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Concurrency & Deduplication lock
_IN_PROGRESS_JOBS = set()
_JOBS_LOCK = threading.Lock()
_CAPABILITIES_SUPPORTED = None


def wait_for_network(max_attempts=30, delay=2):
    """
    Ensures active network connectivity before connecting to Supabase.
    Eliminates systemd network-online hangs while preventing early crashes.
    """
    logger.info("Checking network connectivity...")
    for attempt in range(1, max_attempts + 1):
        try:
            # Quick DNS/socket check to Cloudflare / Google DNS
            with socket.create_connection(("1.1.1.1", 53), timeout=2):
                logger.info(f"✅ Network connected on attempt {attempt}.")
                return True
        except OSError:
            logger.info(f"Network not yet ready (attempt {attempt}/{max_attempts}). Retrying in {delay}s...")
            time.sleep(delay)
    logger.warning("Network check timed out. Proceeding anyway...")
    return False


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


def process_print_job(record):
    """
    Processes a single print job in a dedicated worker thread.
    Enforces the 5-Minute Staleness Guard (TTL) and deduplication lock.
    """
    job_id = record.get("id")
    if not job_id:
        return

    # 1. Atomic Deduplication Lock
    with _JOBS_LOCK:
        if job_id in _IN_PROGRESS_JOBS:
            return
        _IN_PROGRESS_JOBS.add(job_id)

    try:
        logger.info(f"Processing print job: {job_id}")

        # 2. Staleness Guard (5-minute TTL check)
        ts_str = record.get("updated_at") or record.get("created_at")
        if ts_str:
            try:
                job_time = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                now = datetime.now(timezone.utc)
                age_seconds = (now - job_time).total_seconds()
                
                if age_seconds > MAX_JOB_AGE_SECONDS:
                    logger.warning(
                        f"⚠️ Job {job_id} is stale ({int(age_seconds)}s old > {MAX_JOB_AGE_SECONDS}s limit). "
                        "User likely left the kiosk. Cancelling to save paper."
                    )
                    supabase.table("print_jobs").update({
                        "status": "cancelled",
                        "error_message": f"Expired: Kiosk was offline or user left ({int(age_seconds)}s elapsed)"
                    }).eq("id", job_id).execute()
                    return
            except Exception as parse_err:
                logger.warning(f"Could not parse timestamp '{ts_str}': {parse_err}")

        # 3. Parse files list
        files = record.get("files", [])
        if isinstance(files, str):
            try:
                files = json.loads(files)
            except Exception as e:
                logger.error(f"Error parsing files JSON for job {job_id}: {e}")
                files = []

        if not files:
            logger.error(f"Job {job_id} has no files in record! Marking as failed.")
            supabase.table("print_jobs").update({
                "status": "failed",
                "error_message": "No files found in print record"
            }).eq("id", job_id).execute()
            return

        # 4. Spool each file to physical printer
        all_succeeded = True
        failed_filenames = []
        for file_info in files:
            fname = file_info.get("filename", "unknown")
            success = print_job(job_id, file_info, supabase)
            if not success:
                all_succeeded = False
                failed_filenames.append(fname)

        final_status = "completed" if all_succeeded else "failed"
        supabase.table("print_jobs").update({"status": final_status}).eq("id", job_id).execute()

        if not all_succeeded:
            reason = f"Print job {job_id} failed for: {', '.join(failed_filenames)}"
            push_notification("hardware_error", reason)
            logger.error(f"Hardware spool failed: {reason}")
        else:
            logger.info(f"✅ Marked job {job_id} as completed in Supabase.")

    except Exception as e:
        logger.error(f"Unhandled error processing job {job_id}: {e}")
    finally:
        # Release deduplication lock
        with _JOBS_LOCK:
            _IN_PROGRESS_JOBS.discard(job_id)


def poll_pending_jobs():
    """
    Fallback Active Poller (Runs every 3 seconds).
    Catches print jobs even if the WebSocket disconnects or if the Pi boots up after upload.
    """
    logger.info("Started 3-second database fallback poller.")
    while True:
        try:
            res = supabase.table("print_jobs").select("*").eq("status", "printing").execute()
            if res.data:
                for job in res.data:
                    job_id = job.get("id")
                    with _JOBS_LOCK:
                        already_running = job_id in _IN_PROGRESS_JOBS
                    if not already_running:
                        logger.info(f"Poller detected waiting job: {job_id}")
                        threading.Thread(target=process_print_job, args=(job,), daemon=True).start()
        except Exception as e:
            # Transient network drop - poller will auto-retry in next iteration
            pass
        time.sleep(3)


def poll_printer():
    """Hardware health monitor and periodic telemetry heartbeat."""
    printer_name = os.getenv("PRINTER_NAME", "L3250-Series")
    logger.info(f"Started hardware monitoring for kiosk: {KIOSK_ID}, printer: {printer_name}")
    last_telemetry_time = 0

    while True:
        try:
            current_time = time.time()
            if current_time - last_telemetry_time > 60:
                send_telemetry(is_online=True)
                last_telemetry_time = current_time

            if platform.system() == "Windows":
                time.sleep(10)
                continue

            result = subprocess.run(["lpstat", "-p", printer_name], capture_output=True, text=True, timeout=5)
            output = result.stdout.lower()

            if "paused" in output or "error" in output or "jam" in output:
                logger.error(f"Printer error detected: {output.strip()}")
                push_notification("hardware_error", f"Printer reported an error or is paused: {output.strip()}")
                time.sleep(60)
            else:
                time.sleep(5)
        except Exception as e:
            logger.error(f"Printer polling error: {e}")
            time.sleep(10)


def handle_job_update(payload):
    """Realtime WebSocket callback - instantly offloads work to a background thread."""
    record = payload.get("data", {}).get("record", {})
    job_id = record.get("id")
    status = record.get("status")

    if status == "printing" and job_id:
        logger.info(f"⚡ Instant WebSocket event received for job {job_id}")
        threading.Thread(target=process_print_job, args=(record,), daemon=True).start()


async def listen_to_supabase():
    """Maintains Supabase Realtime WebSocket subscription with auto-reconnect."""
    logger.info("Connecting to Supabase Realtime WebSocket...")
    async_client = await acreate_client(SUPABASE_URL, SUPABASE_KEY)
    
    channel = async_client.channel('public:print_jobs')
    channel.on_postgres_changes(
        event="UPDATE",
        schema="public",
        table="print_jobs",
        callback=handle_job_update
    )

    await channel.subscribe()
    logger.info("✅ Subscribed to print_jobs WebSocket updates!")

    while True:
        await asyncio.sleep(1)


if __name__ == "__main__":
    logger.info("🚀 Starting PrintFlow Pi Controller (High-Resilience Edition)...")
    wait_for_network()

    # 1. Start hardware health monitoring thread
    t_health = threading.Thread(target=poll_printer, daemon=True)
    t_health.start()

    # 2. Start 3-second database fallback poller thread
    t_poller = threading.Thread(target=poll_pending_jobs, daemon=True)
    t_poller.start()

    # 3. Main thread runs WebSocket listener with continuous auto-recovery
    while True:
        try:
            asyncio.run(listen_to_supabase())
        except Exception as e:
            logger.error(f"WebSocket disconnected ({e}). Reconnecting in 3s...")
        time.sleep(3)
