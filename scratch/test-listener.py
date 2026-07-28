import asyncio
from supabase import acreate_client
import os
from dotenv import load_dotenv

load_dotenv("pi/.env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

def handle_update(payload):
    print("GOT PAYLOAD:", payload)

async def main():
    client = await acreate_client(SUPABASE_URL, SUPABASE_KEY)
    ch = client.channel('public:print_jobs')
    ch.on_postgres_changes(
        event="*",
        schema="public",
        table="print_jobs",
        callback=handle_update
    )
    await ch.subscribe()
    print("Subscribed. Waiting for updates... (Press Ctrl+C to stop)")
    while True:
        await asyncio.sleep(1)

if __name__ == "__main__":
    asyncio.run(main())
