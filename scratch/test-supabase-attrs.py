from supabase import acreate_client
import asyncio

async def main():
    client = await acreate_client('https://dummy.supabase.co', 'dummy')
    ch = client.channel('test')
    print("Methods of AsyncRealtimeChannel:")
    for attr in dir(ch):
        if not attr.startswith('_'):
            print(attr)

asyncio.run(main())
