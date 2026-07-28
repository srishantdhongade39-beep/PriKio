import asyncio
import os
import sys
from supabase import acreate_client
from dotenv import load_dotenv

load_dotenv("pi/.env")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

def handle_update(payload):
    print("GOT PAYLOAD:", payload, flush=True)

async def main():
    client = await acreate_client(SUPABASE_URL, SUPABASE_KEY)
    ch = client.channel('public:print_jobs')
    ch.on_postgres_changes(
        event="UPDATE",
        schema="public",
        table="print_jobs",
        callback=handle_update
    )
    await ch.subscribe()
    print("Subscribed. Triggering an update now...", flush=True)
    
    # trigger an update ourselves using the client
    res = await client.table('print_jobs').update({"status": "printing"}).eq("id", "d9b2d63d-a233-4123-8478-3a9a1d1e4c8b").execute()
    print("Update result:", res, flush=True)
    
    await asyncio.sleep(5)
    print("Done listening.", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
