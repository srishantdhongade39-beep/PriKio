import os
import time
import asyncio
from supabase import create_client
from supabase.lib.client_options import ClientOptions
from supabase import acreate_client

SUPABASE_URL = 'https://cmhckkpdifpnmewyyqrh.supabase.co'
SUPABASE_KEY = 'sb_publishable_I3NVyNL1LT6mn4aM5dsARA_GQu526D2'

def handle_update(payload):
    try:
        record = payload.get("data", {}).get("record", {})
        files = record.get("files", [])
        print("Files type:", type(files))
        print("Files:", files)
        if isinstance(files, str):
            import json
            files = json.loads(files)
            print("Parsed files type:", type(files))
    except Exception as e:
        print("Error:", e)

async def main():
    print("Connecting...")
    async_client = await acreate_client(SUPABASE_URL, SUPABASE_KEY)
        
    channel = async_client.channel("public:print_jobs")
    channel.on_postgres_changes("UPDATE", schema="public", table="print_jobs", callback=handle_update)
    await channel.subscribe()
    print("Subscribed!")
    
    # trigger update
    sync_client = create_client(SUPABASE_URL, SUPABASE_KEY)
    sync_client.table("print_jobs").update({"status": "pending"}).eq("id", "1e6dfd0e-6540-45dd-997e-233382d80599").execute()
    time.sleep(1)
    sync_client.table("print_jobs").update({"status": "printing"}).eq("id", "1e6dfd0e-6540-45dd-997e-233382d80599").execute()

    
    await asyncio.sleep(5)

if __name__ == "__main__":
    asyncio.run(main())
