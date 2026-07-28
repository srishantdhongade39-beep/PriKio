import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://cmhckkpdifpnmewyyqrh.supabase.co'
const SUPABASE_KEY = 'sb_publishable_I3NVyNL1LT6mn4aM5dsARA_GQu526D2'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function check() {
  const { data, error } = await supabase
    .from('print_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3)
  
  if (error) console.error(error)
  else {
    console.log(JSON.stringify(data.map(d => ({id: d.id, status: d.status, files: d.files, created_at: d.created_at})), null, 2))
  }
}
check()
