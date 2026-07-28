import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://cmhckkpdifpnmewyyqrh.supabase.co'
const SUPABASE_KEY = 'sb_publishable_I3NVyNL1LT6mn4aM5dsARA_GQu526D2'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

console.log('Subscribing...')
supabase
  .channel('public:print_jobs')
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'print_jobs' }, payload => {
    console.log('Change received!', JSON.stringify(payload, null, 2))
  })
  .subscribe()

setTimeout(async () => {
  console.log('Triggering an update...')
  const updateRes = await supabase
    .from('print_jobs')
    .update({ status: 'printing' })
    .eq('id', '1e6dfd0e-6540-45dd-997e-233382d80599')
  console.log('Update:', updateRes.error ? updateRes.error : 'Success')
}, 2000)

setTimeout(() => process.exit(0), 6000)
