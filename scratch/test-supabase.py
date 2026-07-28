import asyncio
from supabase import create_async_client

async def main():
    try:
        client = await create_async_client('https://dummy.supabase.co', 'dummy-key')
        print("Client type:", type(client))
        channel = client.channel('public:print_jobs')
        print('channel:', channel)
    except Exception as e:
        print("Error:", repr(e))

asyncio.run(main())
