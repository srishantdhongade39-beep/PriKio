import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, IndianRupee, Printer, Server } from 'lucide-react'

export default async function AdminDashboard() {
  const supabase = await createClient()

  // 1. Get Active Kiosks
  const { data: kiosks } = await supabase.from('kiosks').select('*')
  const activeKiosks = kiosks?.filter(k => k.is_online).length || 0

  // 2. Get Today's Jobs (from midnight)
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const { data: jobs } = await supabase
    .from('print_jobs')
    .select('kiosk_id, total_amount')
    .eq('payment_status', 'paid')
    .gte('created_at', startOfDay.toISOString())

  const totalPrints = jobs?.length || 0
  const totalEarnings = jobs?.reduce((sum, job) => sum + (Number(job.total_amount) || 0), 0) || 0

  const revenuePerKiosk: Record<string, number> = {}
  jobs?.forEach(job => {
    const kId = job.kiosk_id || 'Unknown'
    if (!revenuePerKiosk[kId]) revenuePerKiosk[kId] = 0
    revenuePerKiosk[kId] += Number(job.total_amount) || 0
  })

  // 3. Unread Notifications
  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('is_read', false)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-[#1d1d1f]">Overview</h1>
          <p className="text-[#86868b] mt-1.5 text-[15px]">Real-time kiosk performance and metrics.</p>
        </div>
        <div className="flex items-center gap-2 text-[13px] font-medium text-[#1d1d1f] bg-white px-3.5 py-2 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] border border-black/[0.04]">
          <div className="w-2 h-2 rounded-full bg-[#34c759]"></div>
          Live
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-white rounded-2xl border-0 shadow-[0_4px_24px_rgba(0,0,0,0.02)] transition-shadow duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-6 px-6 space-y-0">
            <CardTitle className="text-[13px] font-medium text-[#86868b]">Daily Earnings</CardTitle>
            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center">
              <IndianRupee className="h-4 w-4 text-[#1d1d1f]" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-2">
            <div className="text-[32px] font-semibold text-[#1d1d1f] tracking-[-0.03em]">₹{totalEarnings.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card className="bg-white rounded-2xl border-0 shadow-[0_4px_24px_rgba(0,0,0,0.02)] transition-shadow duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-6 px-6 space-y-0">
            <CardTitle className="text-[13px] font-medium text-[#86868b]">Total Prints</CardTitle>
            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center">
              <Printer className="h-4 w-4 text-[#1d1d1f]" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-2">
            <div className="text-[32px] font-semibold text-[#1d1d1f] tracking-[-0.03em]">{totalPrints}</div>
          </CardContent>
        </Card>

        <Card className="bg-white rounded-2xl border-0 shadow-[0_4px_24px_rgba(0,0,0,0.02)] transition-shadow duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-6 px-6 space-y-0">
            <CardTitle className="text-[13px] font-medium text-[#86868b]">Active Kiosks</CardTitle>
            <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center">
              <Server className="h-4 w-4 text-[#1d1d1f]" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[32px] font-semibold text-[#1d1d1f] tracking-[-0.03em]">{activeKiosks}</span>
              <span className="text-[15px] font-medium text-[#86868b]">/ {kiosks?.length || 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white rounded-2xl border-0 shadow-[0_4px_24px_rgba(0,0,0,0.02)] transition-shadow duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-6 px-6 space-y-0">
            <CardTitle className="text-[13px] font-medium text-[#86868b]">Active Alerts</CardTitle>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${notifications && notifications.length > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
              <AlertCircle className={`h-4 w-4 ${notifications && notifications.length > 0 ? 'text-[#ff3b30]' : 'text-[#1d1d1f]'}`} />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-2">
            <div className={`text-[32px] font-semibold tracking-[-0.03em] ${notifications && notifications.length > 0 ? 'text-[#ff3b30]' : 'text-[#1d1d1f]'}`}>
              {notifications?.length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Kiosk Hardware Status */}
        <Card className="col-span-1 bg-white rounded-2xl border-0 shadow-[0_4px_24px_rgba(0,0,0,0.02)] overflow-hidden">
          <CardHeader className="border-b border-black/[0.04] bg-white py-5 px-7">
            <CardTitle className="text-[15px] font-semibold text-[#1d1d1f]">Hardware Status</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-black/[0.04]">
              {kiosks?.length === 0 && (
                <div className="text-center py-14">
                  <p className="text-[#86868b] text-[15px]">No kiosks found.</p>
                </div>
              )}
              {kiosks?.map(k => (
                <div key={k.id} className="flex items-center justify-between p-6 hover:bg-gray-50/50 transition-colors">
                  <div className="space-y-1">
                    <p className="text-[15px] font-semibold text-[#1d1d1f] tracking-[-0.01em]">{k.name || k.id}</p>
                    <div className="flex gap-4 text-[13px] text-[#86868b] mt-1">
                      <span className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${k.ink_level_percent < 20 ? 'bg-[#ff3b30]' : 'bg-[#d2d2d7]'}`}></div>
                        Ink {k.ink_level_percent ?? 100}%
                      </span>
                      <span className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${k.paper_level_percent < 20 ? 'bg-[#ff9500]' : 'bg-[#d2d2d7]'}`}></div>
                        Paper {k.paper_level_percent ?? 100}%
                      </span>
                    </div>
                  </div>
                  <div className={`px-3 py-1.5 rounded-lg text-[13px] font-medium ${k.is_online ? 'bg-[#e8f5e9] text-[#2e7d32]' : 'bg-[#ffebee] text-[#c62828]'}`}>
                    {k.is_online ? 'Online' : 'Offline'}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Notifications */}
        <Card className="col-span-1 bg-white rounded-2xl border-0 shadow-[0_4px_24px_rgba(0,0,0,0.02)] overflow-hidden">
          <CardHeader className="border-b border-black/[0.04] bg-white py-5 px-7 flex flex-row items-center justify-between">
            <CardTitle className="text-[15px] font-semibold text-[#1d1d1f]">Recent Alerts</CardTitle>
            {notifications && notifications.length > 0 && (
              <span className="bg-[#ff3b30] text-white text-[12px] font-medium px-2.5 py-1 rounded-full">{notifications.length} New</span>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-black/[0.04]">
              {notifications?.length === 0 && (
                <div className="text-center py-14">
                  <p className="text-[#86868b] text-[15px]">All systems operational.</p>
                </div>
              )}
              {notifications?.slice(0, 5).map(n => (
                <div key={n.id} className="flex items-start space-x-4 p-6 hover:bg-red-50/30 transition-colors">
                  <div className="mt-0.5">
                    <AlertCircle className="h-[18px] w-[18px] text-[#ff3b30]" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-[15px] font-semibold text-[#1d1d1f] tracking-[-0.01em]">{n.type.replace('_', ' ').toUpperCase()}</p>
                    <p className="text-[14px] text-[#86868b] leading-relaxed">{n.message}</p>
                    <p className="text-[12px] text-[#86868b]/70 pt-1.5">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
